const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(__dirname,'..');
const origen = 'http://localhost:38638/';

(async () => {
  const navegador = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM
    ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM} : {channel:'msedge'});
  try {
    const pagina = await navegador.newPage({viewport:{width:390,height:800}});
    await pagina.route('**/*',async r => {
      const url = r.request().url();
      if(url === origen) return r.fulfill({path:path.join(raiz,'index.html')});
      if(url.startsWith(origen)) return r.fulfill({path:path.join(raiz,new URL(url).pathname)});
      if(url.includes('@supabase/supabase-js')) return r.fulfill({contentType:'application/javascript',
        body:'window.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}})}'});
      if(/\/(jszip.min|jspdf.umd.min|html2canvas-pro.min)\.js$/.test(url)) {
        if(process.env.REPORTES_LIB_DIR) return r.fulfill({path:path.join(process.env.REPORTES_LIB_DIR,path.basename(url))});
        return r.continue();
      }
      return r.abort();
    });
    await pagina.goto(origen);
    await pagina.evaluate(() => {
      currentClinicaId = 1;
      currentClinica = {id:1,nombre:'Clínica de prueba',tipo:'clinica'};
      hasPermiso = permiso => ['exportar','estadisticas','finanzas','inventario','contabilidad'].includes(permiso);
      getClinicaConfig = () => ({nombreClinica:'Clínica de prueba'});
      hoy = () => '2026-11-17';
      window.prueba = {consultas:[],notificaciones:[]};
      const tablas = {
        citas:[{fecha:'2026-10-18',estado:'completada'},{fecha:'2026-11-18',estado:'pendiente'}],
        finanzas:[
          {fecha:'2025-10-01',tipo:'ingreso',descripcion:'Consulta',categoria:'consulta',monto:100.50},
          {fecha:'2026-11-17',tipo:'egreso',descripcion:'Papelería',categoria:'general',monto:20.25},
          {fecha:'2026-11-18',tipo:'ingreso',descripcion:'Movimiento futuro',monto:999}
        ],
        facturas:[{fecha:'2026-11-16',numero:'F-01',estado:'pagada',total:100.50}],
        inventario:[{id:1,nombre:'Guantes',categoria:'insumo',unidad:'caja',stock_actual:10,stock_minimo:4,costo_unitario:2}],
        inventario_movimientos:[{fecha:'2026-11-10',inventario_id:1,tipo:'salida',cantidad:3,motivo:'Consumo'}],
        proveedores:[{id:1,nombre:'Proveedor A',activo:true}],
        compras:[{fecha:'2026-11-10',proveedor_id:1,numero_factura:'C-01',estado:'registrada',condicion:'credito',total:60,
          compra_pagos:[{fecha:'2026-11-15',monto:10},{fecha:'2026-11-18',monto:20}]}]
      };
      _consultarTablaBackup = async (d,clinica) => {
        prueba.consultas.push([d.tabla,clinica]);
        return {tabla:d.tabla,filas:tablas[d.tabla] || []};
      };
      _notificarReportesRespaldo = async (b,f) => { prueba.notificaciones.push([b.clinica.id,f]); };
      document.querySelectorAll('.loading-overlay,#login-screen').forEach(e=>e.style.display='none');
      document.getElementById('app').classList.add('visible');
      document.getElementById('view-exportar').classList.add('active');
      window.informes = _armarReportesZip(tablas,['actividad','finanzas','inventario','contabilidad'],hoy(),false);
    });
    const informes = await pagina.evaluate(() => informes);
    assert.equal(informes.length,9);
    assert.match(informes.find(x=>x.titulo==='Finanzas').secciones.join(''),/80[.,]25/);
    assert.doesNotMatch(informes.find(x=>x.titulo==='Finanzas').secciones.join(''),/Movimiento futuro/);
    assert.match(informes.find(x=>x.titulo==='Compras y cuentas por pagar').secciones.join(''),/50[.,]00/);
    const archivo = pagina.waitForEvent('download',{timeout:90000});
    await pagina.locator('#export-reportes-zip button').click();
    const desc = await archivo;
    assert.match(desc.suggestedFilename(),/^lumea-reportes-.*\.zip$/);
    const bytes = fs.readFileSync(await desc.path());
    const entradas = await pagina.evaluate(async data => {
      const zip = await JSZip.loadAsync(new Uint8Array(data),{checkCRC32:true});
      return Promise.all(Object.values(zip.files).map(async f => [f.name,(await f.async('string')).slice(0,5)]));
    },[...bytes]);
    assert.equal(entradas.length,informes.length);
    assert.ok(entradas.every(([n,f])=>n.endsWith('.pdf')&&f==='%PDF-'));
    assert.deepEqual(await pagina.evaluate(() => prueba.notificaciones),[[1,'zip']]);
    assert.ok((await pagina.evaluate(()=>prueba.consultas)).every(([,c])=>c===1));
    if(process.env.REPORTES_LIB_DIR) fs.writeFileSync(path.join(process.env.REPORTES_LIB_DIR,'reportes-prueba.zip'),bytes);
    console.log('OK: reporte histórico, fecha de corte, permisos, ZIP con PDF válidos y aviso por correo.');
  } finally {
    await navegador.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
