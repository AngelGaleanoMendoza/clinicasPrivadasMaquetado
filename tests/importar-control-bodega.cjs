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

function archivo({actual=5,total=12.65,actualizacion='31/10/2026',nombre='Formato control inventario.xlsx'}={}) {
  const libro = XLSX.utils.book_new();
  const filas = [
    ['Área / Bodega:','Central',null,'Fecha de actualización:',actualizacion],encabezados,
    ['0007','Producto A','','BLISTER',7,1,3,actual,2.53,2.68,3.51,{t:'n',v:0.2278,z:'0.00%'},0.98,total],
    [null,'Producto B','','UNIDAD',8,null,null,8,null,null,null,null,null,0],
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
      const {rows}=await db.query('SELECT fecha::text,bodega,modo,vigente FROM controles_inventario WHERE clinica_id=$1 ORDER BY creado_en DESC',[filtros.clinica_id]);
      return rows.filter(row=>(!filtros.modo || row.modo===filtros.modo) && (filtros.vigente==null || row.vigente===filtros.vigente));
    });
    await p.exposeFunction('rpcPrueba',async(n,args)=>{
      calls.push({n,args});
      assert.equal(n,'importar_control_inventario');
      const {p_clinica,p_fecha,p_bodega,p_modo,p_filas,p_confirmar,p_revision}=args;
      try {
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
      Object.assign(window,{currentClinicaId:10,currentUser:{id:'u1'},currentClinica:{nombre:'Medicsa'},currentView:'libro-contable',
        hasPermiso:p=>['inventario','contabilidad'].includes(p),esEmpresaMedica:()=>true,hoy:()=>'2026-11-10',escAttr:v=>String(v??''),
        fmtC:v=>'C$ '+Number(v).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2}),
        openModalOverlay:id=>document.getElementById(id).classList.add('open'),closeModal:()=>{},
        consultarPaginas:f=>Promise.resolve(f()),loadAll:async()=>{},sb:{from,rpc:async(n,a)=>{
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
  } finally {await browser.close();await db.close();}
  console.log('Control de bodega: reconocimiento, faltantes, corte y confirmación correctos.');
})().catch(e=>{console.error(e);process.exitCode=1;});
