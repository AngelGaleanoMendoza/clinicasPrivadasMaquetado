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
    [null,null,null,null,null,null,null,null,null,null,null,null,'VALOR TOTAL DEL INVENTARIO:',12.65]
  ];
  XLSX.utils.book_append_sheet(libro,XLSX.utils.aoa_to_sheet(filas),'Inventario');
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
    const p=await browser.newPage({viewport:{width:480,height:900}});
    const calls=[];
    await p.exposeFunction('rpcPrueba',async(n,args)=>{
      calls.push({n,args});
      assert.equal(n,'importar_control_inventario');
      const {p_clinica,p_fecha,p_bodega,p_modo,p_filas,p_confirmar,p_revision}=args;
      const {rows}=await db.query('SELECT importar_control_inventario($1,$2,$3,$4,$5,$6,$7) AS data',
        [p_clinica,p_fecha,p_bodega,p_modo,JSON.stringify(p_filas),p_confirmar,p_revision]);
      return rows[0];
    });
    await p.route('**/*',r=>{
      const u=new URL(r.request().url());
      if(u.origin!=='http://bodega.test') return r.abort();
      if(u.pathname==='/') {
        const html=fs.readFileSync(path.join(raiz,'index.html'),'utf8');
        const modal=html.slice(html.indexOf('<div class="modal-overlay" id="modal-importar-excel"'), html.indexOf('<script src="js/app.js'));
        return r.fulfill({contentType:'text/html; charset=utf-8',body:modal+'<script src="/js/importar-excel.js"></script>'});
      }
      return r.fulfill({path:path.join(raiz,u.pathname)});
    });
    await p.addInitScript(()=>{
      Object.assign(window,{currentClinicaId:10,currentUser:{id:'u1'},currentClinica:{nombre:'Medicsa'},currentView:'libro-contable',
        hasPermiso:p=>p==='inventario',esEmpresaMedica:()=>true,hoy:()=>'2026-11-10',escAttr:v=>String(v??''),
        fmtC:v=>'C$ '+v,openModalOverlay:()=>{},closeModal:()=>{},loadAll:async()=>{},sb:{rpc:(n,a)=>rpcPrueba(n,a)}});
      document.addEventListener('inventario-importado',e=>window.corteGuardado=e.detail);
    });
    await p.goto('http://bodega.test');
    await p.evaluate(()=>ExcelImportacion.abrir());
    const subir=f=>p.locator('#excel-archivos').setInputFiles(f);
    const estado=async s=>{
      try {await p.waitForFunction(s=>document.querySelector('#excel-estado').textContent.includes(s),s,{timeout:10000});}
      catch {throw new Error('Se esperaba '+s+'. La pantalla indica '+await p.locator('#excel-estado').textContent());}
    };
    await subir(archivo());
    await estado('Se reconoció el control');
    assert.equal(await p.locator('#excel-control-fecha').inputValue(),'2026-10-31');
    assert.equal(await p.locator('#excel-control-bodega').inputValue(),'Central');
    assert.equal(calls.length,0);
    await p.locator('#excel-control-modo').selectOption('cierre');
    await p.locator('#excel-revisar').click();
    await estado('Comprueba el detalle');
    const plan=calls.at(-1);
    assert.equal(plan.n,'importar_control_inventario');
    assert.equal(plan.args.p_filas.length,2);
    assert.deepEqual(plan.args.p_filas[0].datos,{nombre:'Producto A',sku:'0007',unidad:'blister',
      inicial:7,entradas:1,salidas:3,actual:5,costo:2.53,costo_total:12.65,precio_compra:2.68,precio:3.51,ganancia_pct:22.78,margen_ganancia:0.98,
      fecha_actualizacion:'2026-10-31'});
    const faltante=plan.args.p_filas[1].datos;
    assert.equal(faltante.costo,undefined);assert.equal(faltante.costo_total,undefined);
    assert.deepEqual([faltante.entradas,faltante.salidas],[0,0]);
    await p.locator('#excel-control-modo').selectOption('apertura');
    assert.equal(await p.locator('#excel-confirmar').isHidden(),true);
    await p.locator('#excel-revisar').click();await estado('Comprueba el detalle');
    await p.locator('#excel-confirmar').click();await estado('Apertura de inventario registrada');
    assert.deepEqual(await p.evaluate(()=>corteGuardado),{clinica:10,fecha:'2026-10-31',modo:'apertura'});
    assert.equal(calls.at(-1).args.p_modo,'apertura');
    assert.ok(calls.at(-1).args.p_revision);
    const inventario=async()=>(await db.query('SELECT nombre,stock_actual,costo_unitario,unidad FROM inventario ORDER BY nombre')).rows;
    const fichas=await inventario();
    assert.deepEqual(fichas.map(x=>[x.nombre,Number(x.stock_actual),x.costo_unitario===null?null:Number(x.costo_unitario),x.unidad]),
      [['Producto A',5,2.53,'blister'],['Producto B',8,null,'unidad']]);
    await subir(archivo({actualizacion:'02/11/2026'}));await estado('Se reconoció el control');
    assert.equal(await p.locator('#excel-control-fecha').inputValue(),'2026-11-02');
    await p.locator('#excel-control-fecha').fill('2026-10-31');
    await p.locator('#excel-control-modo').selectOption('apertura');await p.locator('#excel-revisar').click();
    await estado('Este control ya está guardado');
    assert.equal((await db.query('SELECT count(*) FROM controles_inventario')).rows[0].count,1);
    await p.locator('#excel-control-modo').selectOption('cierre');await p.locator('#excel-revisar').click();
    await estado('Comprueba el detalle');await p.locator('#excel-confirmar').click();await estado('Conteo mensual guardado');
    assert.deepEqual(await inventario(),fichas);
    const {rows}=await db.query("SELECT filas FROM controles_inventario WHERE modo='cierre'");
    assert.deepEqual(rows[0].filas.map(f=>[f.sku,f.costo_total==null?null:Number(f.costo_total),f.precio_compra,f.precio,f.ganancia_pct,f.margen_ganancia,f.fecha_actualizacion]),
      [['0007',12.65,2.68,3.51,22.78,0.98,'2026-11-02'],[null,null,null,null,null,null,'2026-11-02']]);
    const cantidad=calls.length;
    for(const [datos,mensaje] of [[{actual:7},'difiere de la existencia actual'],[{total:15},'coincidir al centavo']]) {
      await subir(archivo(datos));await estado('Se reconoció el control');
      await p.locator('#excel-control-modo').selectOption('cierre');await p.locator('#excel-revisar').click();
      await estado('Corrige los errores');assert.match(await p.locator('#excel-resultados').innerText(),new RegExp(mensaje));
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
