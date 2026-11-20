const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const XLSX=require('../js/vendor/xlsx-0.20.3.full.min.js');
const raiz=path.join(__dirname,'..');

function datos() {
  const producto={id:1,nombre:'=Guantes de prueba',sku:'0007',categoria:'Insumos',unidad:'caja',saldo_inicio:10,saldo_corte:8};
  const base={inventario_id:1,bodega:'Central',nombre:producto.nombre,sku:'0007',costo:'11.00',archivo:'Control.xlsx',hoja:'Central',fila:6};
  const fecha='2026-10-14';
  const cuentas=[
    {codigo:'0012',clase:'activo',nombre:'Inventario',inicial:'110',debe:'0',haber:'0',saldo:'110',usada:true},
    {codigo:'3100',clase:'patrimonio',nombre:'Capital',inicial:'-110',debe:'0',haber:'0',saldo:'-110',usada:true},
    {codigo:'5100',clase:'costo',nombre:'Costo de ventas',inicial:'0',debe:'0',haber:'0',saldo:'0',usada:false}];
  return {revision:'revision-1',productos:[producto],compras:[],kardex:[],incidencias_documentos:[],libro:{cuentas},diario:[],
    aperturas:[{...base,fecha:'2026-09-30',actual:10,costo_total:110}],
    conteos:[{...base,fecha:'2026-10-31',inicial:10,entradas:0,salidas:2,actual:8,costo_total:88,ganancia_pct:'22.75'}],
    ventas:[{id:11,venta_id:55,inventario_id:1,fecha,documento:'V-02',cantidad:2,costo_unitario:11,subtotal:32}],
    movimientos:[{id:19,inventario_id:1,fecha,tipo:'salida',motivo:'Venta V-02 · Cliente',cantidad:2}]};
}

(async()=>{
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{channel:'msedge'});
  try {
    const p=await browser.newPage({locale:'es-NI',viewport:{width:1280,height:850}});
    p.setDefaultTimeout(10000);
    const muestra=datos(), acciones=[], origen='http://localhost:38759';
    const errores=[];
    p.on('pageerror',e=>errores.push(e.message));
    await p.route('**/*',r=>{
      const u=new URL(r.request().url());
      if(u.origin===origen) return r.fulfill({path:path.join(raiz,u.pathname==='/'?'index.html':u.pathname)});
      if(u.href.includes('@supabase/supabase-js')) return r.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}})}'});
      return r.abort();
    });
    await p.exposeFunction('rpcMaestro',async(n,a)=>{
      if(n==='reporte_libro_contable') return {data:muestra.libro};
      if(n==='datos_informe_maestro') {
        if(a.p_mes==='2026-09-01') return {data:{...muestra,aprobado:false,aperturas:[],conteos:[],compras:[],ventas:[],movimientos:[]}};
        return {data:muestra};
      }
      acciones.push([n,a]);
      if(n==='registrar_ajuste_maestro') {
        const [activo,,costo]=muestra.libro.cuentas;
        Object.assign(activo,{haber:'22',saldo:'88'});Object.assign(costo,{debe:'22',saldo:'22',usada:true});
        muestra.diario=[{fecha:'2026-10-31',documento:'MAESTRO-2026-10',concepto:'Ajuste de costo',lineas:[
          {cuenta:costo.codigo,nombre_cuenta:costo.nombre,debe:22,haber:0},
          {cuenta:activo.codigo,nombre_cuenta:activo.nombre,debe:0,haber:22}]}];
        muestra.revision='revision-2';
        return {data:1};
      }
      if(n==='aprobar_informe_maestro') {muestra.aprobado=true;return {data:true};}
      throw new Error(n);
    });
    await p.goto(origen);
    await p.evaluate(async()=>{
      currentClinicaId=10;currentClinica={id:10,tipo:'empresa_medica',nombre:'Medicsa prueba'};
      currentUser={id:'u10',key:'admin_empresa'};hasPermiso=()=>true;hoy=()=>'2026-11-20';
      loadAll=async()=>{};
      sb.rpc=rpcMaestro;
      sb.from=()=>({select(){return this;},eq(){return this;},order(){return this;},range:async()=>({data:[]}),maybeSingle:async()=>({data:null})});
      document.getElementById('login-screen').style.display='none';
      document.getElementById('loading-overlay').classList.remove('show','boot');
      document.getElementById('app').classList.add('visible');await navigate('libro-contable');
    });
    await p.locator('#lc-filtros').waitFor();
    await p.locator('[data-panel="maestro"]').click();
    const periodo=p.locator('#im-filtros [name=mes]');
    await periodo.fill('2026-10');
    await p.getByText('Listo para aprobar',{exact:true}).waitFor();
    for(const width of [360,430,1280]) {
      await p.setViewportSize({width,height:850});
      assert.ok(await p.locator('.lc-modulo').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Ancho del módulo a '+width);
      if(process.env.MAESTRO_XLSX_PRUEBA && width!==430)
        await p.screenshot({animations:'disabled',path:path.join(path.dirname(process.env.MAESTRO_XLSX_PRUEBA),'maestro-'+width+'.png')});
    }
    await p.locator('#im-traza summary').click();
    await p.locator('#im-fuentes td').filter({hasText:'Control.xlsx'}).first().waitFor();
    await p.locator('#im-ajuste summary').click();
    await p.locator('#im-costo').selectOption('5100');await p.locator('#im-inventario').selectOption('0012');
    assert.match(await p.locator('#im-comparacion').innerText(),/Debe 5100 · Haber 0012/);
    await p.locator('#im-registrar').click();
    await p.getByText('Ajuste registrado en el libro diario.',{exact:true}).waitFor();
    assert.equal(acciones[0][1].p_costo_objetivo,22);
    await p.getByRole('button',{name:'Aprobar cierre de inventario'}).click();
    await p.getByText('Cierre aprobado',{exact:true}).waitFor();
    assert.equal(acciones[1][1].p_revision,'revision-2');
    const descarga=p.waitForEvent('download');await p.locator('#im-excel').click();
    const archivo=await descarga;
    assert.equal(archivo.suggestedFilename(),'Informe maestro - Medicsa prueba - 2026-10.xlsx');
    const libro=XLSX.read(fs.readFileSync(await archivo.path()),{type:'buffer',cellFormula:true,cellNF:true});
    assert.deepEqual(libro.SheetNames,['Resumen','Maestro de inventario','Conciliación de costo','Libro diario','Balanza de comprobación','Estado de resultados','Balance general','Documentos de origen']);
    const maestro=libro.Sheets['Maestro de inventario'], conciliacion=libro.Sheets['Conciliación de costo'];
    assert.equal(maestro.A6.v,'0007');assert.equal(maestro.B6.t,'s');assert.equal(maestro.B6.f,undefined);
    assert.deepEqual(['H6','L6','M6','N6','O6'].map(c=>maestro[c].v),[8,88,22,32,10]);
    assert.equal(maestro.R6.v,0.2275);assert.match(maestro.R6.z,/%$/);
    assert.match(maestro.H6.f,/E6\+F6-G6/);assert.match(conciliacion.F5.f,/C5\+D5-E5/);assert.equal(conciliacion.J5.v,0);
    assert.equal(libro.Sheets['Libro diario'].D6.v,'0012');assert.equal(libro.Sheets['Libro diario'].G6.v,22);
    assert.equal(libro.Sheets.Resumen.A2.v,'2026-10 · Aprobado');
    assert.match(libro.Sheets.Resumen.B9.f,/'Conciliación de costo'!F/);
    assert.equal(libro.Sheets.Resumen.A18.v,'Inventario contado menos saldo en 0012');
    assert.equal(libro.Sheets.Resumen.B18.v,0);
    if(process.env.MAESTRO_XLSX_PRUEBA) await archivo.saveAs(process.env.MAESTRO_XLSX_PRUEBA);
    await periodo.fill('2026-09');
    await p.getByText('Falta el conteo independiente del último día del mes.',{exact:true}).waitFor();
    assert.equal(await p.getByRole('button',{name:'Aprobar cierre de inventario'}).count(),0);
    const borrador=p.waitForEvent('download');await p.locator('#im-excel').click();
    const parcial=XLSX.read(fs.readFileSync(await (await borrador).path()),{type:'buffer'});
    assert.equal(parcial.Sheets.Resumen.B7,undefined);
    assert.equal(parcial.Sheets.Resumen.C7.v,'Pendiente');
    assert.equal(parcial.Sheets['Maestro de inventario'].L6,undefined);
    await p.evaluate(()=>document.dispatchEvent(new CustomEvent('inventario-importado',{detail:{clinica:10,fecha:'2026-10-31'}})));
    await p.getByText('Cierre aprobado',{exact:true}).waitFor();
    assert.deepEqual(errores,[]);
  } finally {await browser.close();}
  console.log('OK · Consulta mensual, ajuste, cierre, refresco tras carga y Excel de ocho hojas en Edge.');
})().catch(e=>{console.error(e);process.exitCode=1;});
