// Reconoce la estructura de bodega, revisa y confirma el mismo plan desde la interfaz real.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {crearBase} = require('./importar-excel.cjs');
const raiz = path.resolve(__dirname,'..');
const XLSX = require(path.join(raiz,'js/vendor/xlsx-0.20.3.full.min.js'));
const encabezados = ['Código','Descripción del artículo','Categoría','Unidad de medida','Existencia inicial','Entradas',
  'Salidas','Existencia actual','Costo unitario (C$)','Precio de compra (C$)','Precio de venta (C$)',
  'Porcentaje de Ganancia (%)','Margen de ganancia (C$)','Valor total del inventario (C$)'];

function archivo({actual=5,total=12.65,actualizacion='31/10/2026',nombre='Formato control inventario.xlsx',nombreB='Producto B'}={}) {
  const libro = XLSX.utils.book_new();
  const filas = [
    ['Área / Bodega:','Central',null,'Fecha de actualización:',actualizacion],encabezados,
    ['0007','Producto A','','BLISTER',7,1,3,actual,2.53,2.68,3.51,{t:'n',v:0.2278,z:'0.00%'},0.98,total],
    [null,nombreB,'','UNIDAD',8,null,null,8,null,null,null,null,null,0],
    [null,null,null,null,null,null,null,0,null,null,null,null,null,0],
    [null,null,null,null,null,null,null,null,null,null,null,{t:'n',v:0.4,z:'0%'},null,null],
    [null,null,null,null,null,null,null,null,null,null,null,null,'VALOR TOTAL DEL INVENTARIO:',12.65]
  ];
  XLSX.utils.book_append_sheet(libro,XLSX.utils.aoa_to_sheet(filas),'Inventario');
  XLSX.utils.book_append_sheet(libro,XLSX.utils.aoa_to_sheet([filas[0],encabezados,
    ['0090','Producto C','','UNIDAD',2,0,0,2,1.50,null,null,null,null,3]
  ]),'PRODUCTO PARA BONIFICACION');
  return {name:nombre,mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(libro,{type:'array',bookType:'xlsx'}))};
}

(async()=>{
  const db=await crearBase();
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM} : {channel:'msedge'});
  try {
    await db.exec('CREATE TABLE inventario_lotes(id bigserial,clinica_id bigint,inventario_id bigint,lote text,fecha_ingreso date,cantidad_inicial numeric,cantidad_disponible numeric,costo_unitario numeric)');
    for (const migracion of ['migracion_libro_contable.sql','migracion_informe_maestro.sql'])
      await db.exec(fs.readFileSync(path.join(raiz,migracion),'utf8'));
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000003'");
    const p=await browser.newPage({viewport:{width:430,height:820},locale:'es-NI'});
    p.setDefaultTimeout(10000);
    const calls=[];
    await p.exposeFunction('controlesPrueba',async filtros=>{
      assert.equal(filtros.clinica_id,10);
      const {rows}=await db.query('SELECT id,creado_en,fecha::text,bodega,modo,vigente,anulado_en,motivo_anulacion FROM controles_inventario WHERE clinica_id=$1 ORDER BY creado_en DESC,id',[filtros.clinica_id]);
      return rows.filter(row=>(!filtros.modo || row.modo===filtros.modo) && (filtros.vigente==null || row.vigente===filtros.vigente));
    });
    await p.exposeFunction('rpcPrueba',async(n,args)=>{
      calls.push({n,args});
      assert.ok(['importar_control_inventario','anular_control_inventario'].includes(n),n);
      const {p_clinica,p_fecha,p_bodega,p_modo,p_filas,p_confirmar,p_revision}=args;
      try {
        if(n==='anular_control_inventario') {
          const {rows}=await db.query('SELECT anular_control_inventario($1,$2,$3) AS data',[p_clinica,args.p_control,args.p_motivo]);
          return rows[0];
        }
        const {rows}=await db.query('SELECT importar_control_inventario($1,$2,$3,$4,$5,$6,$7) AS data',
          [p_clinica,p_fecha,p_bodega,p_modo,JSON.stringify(p_filas),p_confirmar,p_revision]);
        return rows[0];
      } catch (error) {
        return {error:{code:error.code,message:error.message}};
      }
    });
    await p.route('**/*',r=>{
      const u=new URL(r.request().url());
      if(u.origin!=='http://bodega.test') return r.abort();
      if(u.pathname==='/') {
        const html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');
        const modal=html.slice(html.indexOf('<div class="modal-overlay" id="modal-importar-excel"'), html.indexOf('<script src="js/app.js'));
        return r.fulfill({contentType:'text/html; charset=utf-8',body:'<!doctype html><link rel="stylesheet" href="/css/styles.css">'+modal+'<script src="/js/importar-excel.js"></script>'});
      }
      return r.fulfill({path:path.join(raiz,u.pathname)});
    });
    await p.addInitScript(()=>{
      const from=tabla=>{
        const filtros={};
        return {select(){return this;},eq(c,v){filtros[c]=v;return this;},order(){return this;},not(){return this;},
          limit(){return this;},range(){return this;},
          async then(resolve,reject){try{resolve({data:tabla==='controles_inventario'?await controlesPrueba(filtros):
            tabla==='expediente_fiscal_excel'?[{id:'fiscal',archivo:'IVA.xlsx'}]:[]});}catch(e){reject(e);}}
        };
      };
      Object.assign(window,{currentClinicaId:10,currentUser:{id:'u1',key:'admin_empresa'},currentClinica:{nombre:'Medicsa'},currentView:'libro-contable',
        hasPermiso:p=>['inventario','contabilidad'].includes(p),esEmpresaMedica:()=>true,hoy:()=>'2026-11-10',escAttr:v=>String(v??''),
        fmtC:v=>'C$ '+Number(v).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2}),
        openModalOverlay:id=>document.getElementById(id).classList.add('open'),closeModal:()=>{},
        consultarPaginas:f=>Promise.resolve(f()),recargas:0,loadAll:async()=>{window.recargas++;},sb:{from,rpc:async(n,a)=>{
          const respuesta=await rpcPrueba(n,a);
          if(window.retenerCierre && a.p_modo==='cierre' && !a.p_confirmar)
            await new Promise(resolve=>{window.continuarRevision=resolve;});
          return respuesta;
        }}});
      document.addEventListener('inventario-importado',e=>window.corteGuardado=e.detail);
    });
    await p.goto('http://bodega.test');
    await p.evaluate(()=>ExcelImportacion.abrir());
    const subir=f=>p.locator('#excel-archivos').setInputFiles(f);
    const estado=async s=>{
      try {await p.waitForFunction(s=>document.querySelector('#excel-estado').textContent.includes(s),s,{timeout:10000});}
      catch {throw new Error('Se esperaba '+s+'. La pantalla indica '+await p.locator('#excel-estado').textContent());}
    };
    const original=archivo();
    // La base antigua falla durante la revisión; la misma selección debe poder reintentarse.
    await db.exec('ALTER TABLE inventario DROP COLUMN sku');
    await subir([original,{...original,name:'Formato control inventario (1).xlsx'}]);
    const guardar=p.locator('#excel-confirmar');
    await estado('Falta actualizar el inventario en Supabase');
    assert.ok(await guardar.isHidden());
    await db.exec(fs.readFileSync(path.join(raiz,'migracion_informe_maestro.sql'),'utf8'));
    await p.getByRole('button',{name:'Volver a revisar'}).click();
    const opciones=p.locator('#excel-opciones-control');
    const modo=p.locator('#excel-control-modo'),fecha=p.locator('#excel-control-fecha');
    await guardar.waitFor();
    assert.equal(await p.locator('#excel-control-fecha').inputValue(),'2026-10-31');
    assert.equal(await p.locator('#excel-control-bodega').inputValue(),'Central');
    assert.equal(await modo.inputValue(),'apertura');
    assert.equal(await p.locator('#excel-hojas select:visible').count(),0);
    for(const selector of ['#excel-plantilla','#excel-carpeta','#excel-expediente','#excel-situacion','#excel-revisar'])
      assert.ok(await p.locator(selector).isHidden(),selector);
    const plan=calls.at(-1);
    assert.equal(plan.args.p_confirmar,false);
    assert.ok(calls.every(c=>!c.args.p_confirmar));
    assert.equal((await db.query('SELECT count(*) FROM controles_inventario')).rows[0].count,0);
    assert.equal(plan.n,'importar_control_inventario');
    assert.equal(plan.args.p_filas.length,3);
    const producto={nombre:'Producto A',sku:'0007',unidad:'blister',
      inicial:7,entradas:1,salidas:3,actual:5,costo:2.53,costo_total:12.65,precio_compra:2.68,precio:3.51,ganancia_pct:22.78,margen_ganancia:0.98,
      fecha_actualizacion:'2026-10-31'};
    for(const [clave,valor] of Object.entries(producto)) assert.equal(plan.args.p_filas[0].datos[clave],valor,clave);
    const faltante=plan.args.p_filas[1].datos;
    assert.equal(faltante.costo,undefined);assert.equal(faltante.costo_total,undefined);
    assert.deepEqual([faltante.entradas,faltante.salidas],[0,0]);
    const resumenes=await p.locator('#excel-resultados .excel-resumen-hoja').allTextContents();
    assert.ok(resumenes.some(s=>/inventario/i.test(s) && /12[.,]65/.test(s)),resumenes.join(' '));
    assert.ok(resumenes.some(s=>/bonificaci[oó]n/i.test(s) && /C\$\s*3\b/.test(s)),resumenes.join(' '));
    assert.match(await p.locator('#excel-resultados').innerText(),/copias idénticas omitidas:\s*1/i);
    for(const ancho of [360,430,1280]) {
      await p.setViewportSize({width:ancho,height:820});
      assert.ok(await p.locator('.excel-modal').evaluate(n=>n.scrollWidth<=n.clientWidth+1));
      if(process.env.EXCEL_SCREENSHOT_DIR) await p.screenshot({animations:'disabled',path:path.join(process.env.EXCEL_SCREENSHOT_DIR,'control-medicsa-'+ancho+'.png')});
    }
    // El resultado de una vista previa anterior no puede sobrescribir el corte elegido.
    await opciones.locator('summary').first().click();
    await p.evaluate(()=>{window.retenerCierre=true;});
    await modo.selectOption('cierre');
    await p.waitForFunction(()=>typeof window.continuarRevision==='function');
    await modo.selectOption('apertura');await guardar.waitFor();
    await p.evaluate(async()=>{
      window.retenerCierre=false;window.continuarRevision();
      await new Promise(resolve=>setTimeout(resolve,0));
    });
    assert.ok(calls.every(c=>!c.args.p_confirmar));
    await guardar.click();await estado('Apertura de inventario registrada');
    assert.deepEqual(await p.evaluate(()=>corteGuardado),{clinica:10,fecha:'2026-10-31',modo:'apertura'});
    assert.equal(calls.at(-1).args.p_modo,'apertura');
    assert.ok(calls.at(-1).args.p_revision);
    const inventario=async()=>(await db.query('SELECT nombre,stock_actual,costo_unitario,unidad FROM inventario ORDER BY nombre')).rows;
    const fichas=await inventario();
    assert.deepEqual(fichas.map(x=>[x.nombre,Number(x.stock_actual),x.costo_unitario===null?null:Number(x.costo_unitario),x.unidad]),
      [['Producto A',5,2.53,'blister'],['Producto B',8,null,'unidad'],['Producto C',2,1.5,'unidad']]);
    await subir(archivo({actualizacion:'02/11/2026'}));
    await p.waitForFunction(()=>document.querySelector('#excel-control-modo').value!=='' && !document.querySelector('#excel-control').disabled);
    if(!(await opciones.evaluate(el=>el.open))) await opciones.locator('summary').first().click();
    await modo.selectOption('apertura');await fecha.fill('2026-10-31');
    await estado('Este control ya está guardado');
    assert.equal((await db.query('SELECT count(*) FROM controles_inventario')).rows[0].count,1);
    await modo.selectOption('cierre');await guardar.waitFor();
    assert.equal(calls.at(-1).args.p_modo,'cierre');
    assert.ok(!calls.at(-1).args.p_confirmar);
    await guardar.click();await estado('Conteo mensual guardado');
    assert.deepEqual(await inventario(),fichas);
    const {rows}=await db.query("SELECT filas FROM controles_inventario WHERE modo='cierre'");
    assert.deepEqual(rows[0].filas.map(f=>[f.sku,f.costo_total==null?null:Number(f.costo_total),f.precio_compra,f.precio,f.ganancia_pct,f.margen_ganancia,f.fecha_actualizacion]),
      [['0007',12.65,2.68,3.51,22.78,0.98,'2026-11-02'],[null,null,null,null,null,null,'2026-11-02'],
        ['0090',3,null,null,null,null,'2026-11-02']]);
    const cantidad=calls.length;
    for(const [datos,mensaje] of [[{actual:7},'difiere de la existencia actual'],[{total:15},'coincidir al centavo']]) {
      await subir(archivo(datos));
      await p.locator('#excel-resultados').getByText(new RegExp(mensaje)).first().waitFor();
      assert.ok(await guardar.isHidden());
    }
    // El mismo archivo de ejemplo también puede venir en un libro XLS genuino.
    const wb=XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet([['OFFICE SUPPLY'],['Maestro de Inventario'],encabezados]),'Ejemplo');
    await subir({name:'InformeMaestroInventario Oct 26.xls',mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(wb,{type:'array',bookType:'xls'}))});
    await estado('El informe maestro es un reporte de consulta');
    assert.equal(await p.locator('#excel-confirmar').isHidden(),true);
    // Exportar y volver a seleccionar el maestro del sistema también debe ser inocuo.
    const reporte=XLSX.utils.book_new();
    reporte.Props={Title:'Informe maestro mensual · Medicsa · 2026-10'};
    for(const hoja of ['Maestro de inventario','Conciliación de costo','Libro diario'])
      XLSX.utils.book_append_sheet(reporte,XLSX.utils.aoa_to_sheet([encabezados]),hoja);
    await subir({name:'Medicsa octubre.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(reporte,{type:'array',bookType:'xlsx'}))});
    await estado('El informe maestro es un reporte de consulta');
    assert.equal(await p.locator('#excel-revisar').isDisabled(),true);
    assert.equal(calls.length,cantidad);

    await p.evaluate(()=>ExcelImportacion.abrir('inventario'));
    const historial=p.locator('#excel-historial');
    await p.locator('#excel-historial-nombre').click();
    const anularRecibo=rotulo=>historial.locator('.excel-recibo').filter({hasText:rotulo}).getByRole('button',{name:'Anular carga'});
    const confirmarAnulacion=p.getByRole('button',{name:'Confirmar anulación'});
    const motivo=p.getByLabel('Motivo de la anulación');
    await anularRecibo('Conteo mensual').click();
    await p.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal(calls.filter(c=>c.n==='anular_control_inventario').length,0);
    assert.equal(await motivo.isHidden(),true);
    await anularRecibo('Apertura').click();
    await motivo.fill('Verificar dependencia del conteo');
    await confirmarAnulacion.click();
    await p.locator('#excel-anulacion-estado').getByText(/control posterior/).waitFor();
    assert.deepEqual(await inventario(),fichas);
    await p.getByRole('button',{name:'Cancelar',exact:true}).click();
    const anular=async(rotulo,razon)=>{
      const antes=await p.evaluate(()=>recargas);
      await anularRecibo(rotulo).click();
      await motivo.fill(razon);
      await confirmarAnulacion.click();
      await p.waitForFunction(()=>{
        const aviso=document.getElementById('excel-anulacion-estado').textContent;
        return document.getElementById('excel-anulacion').hidden || (aviso && aviso!=='Anulando la carga…');
      });
      assert.ok(await motivo.isHidden(),await p.locator('#excel-anulacion-estado').textContent());
      await historial.getByText('Anulada · '+razon,{exact:false}).waitFor();
      await p.waitForFunction(antes=>recargas>antes,antes);
    };
    await anular('Conteo mensual','Se eligió el corte equivocado');
    assert.deepEqual(await inventario(),fichas,'Anular el conteo documental conserva todas las existencias');
    await anular('Apertura','Se seleccionó otro inventario');
    assert.deepEqual(await inventario(),[]);
    assert.equal((await db.query('SELECT count(*) FROM inventario_movimientos')).rows[0].count,0);
    assert.equal((await db.query('SELECT count(*) FROM inventario_lotes')).rows[0].count,0);

    await subir(original);await guardar.waitFor();await guardar.click();await estado('Apertura de inventario registrada');
    const saldos=async()=>(await db.query('SELECT id,stock_actual,costo_unitario FROM inventario ORDER BY id')).rows;
    const previos=await saldos();
    const idB=(await db.query("SELECT id FROM inventario WHERE nombre='Producto B'")).rows[0].id;
    await subir(archivo({actualizacion:null,nombre:'Control corregido.xlsx',nombreB:'Producto de B'}));
    await p.getByRole('button',{name:'Usar apertura del 31/10/2026'}).click();
    await guardar.waitFor();
    await p.locator('#excel-resultados').getByText('Producto B → Producto de B',{exact:true}).waitFor();
    await p.locator('#excel-resultados').getByText('Ver partidas pendientes de costo (1)').click();
    await p.locator('#excel-resultados').getByText('Producto de B · 8 unidad · Inventario (fila 4)').waitFor();
    await guardar.click();await estado('Apertura actualizada con las mismas unidades');
    assert.deepEqual(await saldos(),previos,'La corrección conserva los ID, cantidades y costos');
    assert.deepEqual((await db.query('SELECT nombre FROM inventario WHERE id=$1',[idB])).rows,[{nombre:'Producto de B'}]);
    assert.equal((await db.query('SELECT count(*) FROM inventario_movimientos')).rows[0].count,3,'Una sola entrada física por producto');
  } finally {await browser.close();await db.close();}
  console.log('Control de bodega: reconocimiento, costos pendientes, confirmación, anulación, recarga y corrección de nombre verificados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
