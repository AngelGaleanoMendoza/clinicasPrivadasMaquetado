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
      window.prueba = {consultas:[],notificaciones:[],cargas:[],marcos:[],progreso:[]};
      const cargaOriginal = setLoading;
      setLoading = visible => {
        prueba.cargas.push(visible);
        cargaOriginal(visible);
      };
      const aviso = document.querySelector('#loading-overlay .load-text-op');
      new MutationObserver(() => prueba.progreso.push(aviso.textContent)).observe(aviso,{childList:true,subtree:true});
      new MutationObserver(registros => {
        for(const registro of registros) for(const nodo of registro.addedNodes) {
          if(nodo.nodeName === 'IFRAME' && nodo.hasAttribute('srcdoc')) prueba.marcos.push([nodo.style.opacity,nodo.inert]);
        }
      }).observe(document.body,{childList:true});
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
      LibroContable.datosLibro = async () => ({apertura:null,cuentas:[
        {codigo:'001',nombre:'Caja',clase:'activo',inicial:'0',debe:'20',haber:'0',saldo:'20',usada:true},
        {codigo:'300',nombre:'Capital',clase:'patrimonio',inicial:'0',debe:'0',haber:'20',saldo:'-20',usada:true}
      ]});
      LibroDiario.obtener = async () => ({
        cuentas:[['001','Caja','C$ 0.00','C$ 20.00','C$ 0.00','C$ 20.00'],
          ['300','Capital','C$ 0.00','C$ 0.00','C$ 20.00','C$ -20.00'],
          ['','Totales','C$ 0.00','C$ 20.00','C$ 20.00','C$ 0.00']],
        lineas:[['17 nov 2026','AP-01','001','Caja','Apertura','—','C$ 20.00','C$ 0.00'],
          ['17 nov 2026','AP-01','300','Capital','Apertura','—','C$ 0.00','C$ 20.00']]
      });
      BorradorDiario.auxiliarInventario = async (clinica,desde,hasta) => {
        if (clinica!==1 || !['0001-01-01','2026-01-01'].includes(desde) || hasta!==hoy()) throw new Error('Corte incorrecto');
        return [{fecha:'2026-10-01',producto:'Guantes',cantidad:2,unidad:'caja',clase:'salida',documental:true,
          motivo:'Consumo interno',importe:850n,fuente:'Kardex.xlsx · Hoja 1 · fila 5'}];
      };
      _notificarReportesRespaldo = async (b,f) => {
        prueba.notificaciones.push([b.clinica.id,f]);
        await new Promise(resolver => { prueba.terminarCorreo = resolver; });
      };
      document.getElementById('login-screen').style.display='none';
      document.getElementById('loading-overlay').classList.remove('show','boot');
      document.getElementById('app').classList.add('visible');
      document.getElementById('view-exportar').classList.add('active');
      window.informes = _armarReportesZip(tablas,['actividad','finanzas','inventario','contabilidad'],hoy(),false);
      window.aperturas = _armarReportesZip({...tablas,
        compras:[...tablas.compras,{fecha:'2026-11-01',numero_factura:'Apertura-P',condicion:'credito',total:600,saldo_inicial:true}],
        ventas:[
          {fecha:'2026-11-01',numero:'Apertura-C',total:700,saldo_inicial:true,venta_items:[{descripcion:'Ignorar apertura',cantidad:1,subtotal:700}]},
          {fecha:'2026-11-02',numero:'Venta-100',total:100,subtotal:100}
        ]},['contabilidad'],hoy(),true);
    });
    const informes = await pagina.evaluate(() => informes);
    assert.equal(informes.length,9);
    assert.match(informes.find(x=>x.titulo==='Finanzas').secciones.join(''),/80[.,]25/);
    assert.doesNotMatch(informes.find(x=>x.titulo==='Finanzas').secciones.join(''),/Movimiento futuro/);
    assert.match(informes.find(x=>x.titulo==='Compras y cuentas por pagar').secciones.join(''),/50[.,]00/);
    assert.match(informes.find(x=>x.titulo==='Existencias de inventario').secciones.join(''),/Valor total a costo<\/td><td>C\$ 20[.,]00/);
    const inventarioImportado = await pagina.evaluate(() => {
      const inventario = [
        {id:1,sku:'A-001',nombre:'Reactivo <A>',categoria:'insumo',unidad:'frasco',stock_actual:10,costo_unitario:null},
        {id:2,sku:'A-002',nombre:'Reactivo B',categoria:'insumo',unidad:'ml',stock_actual:20,costo_unitario:0.125},
        {id:3,nombre:'Reactivo donado',categoria:'insumo',unidad:'frasco',stock_actual:1,costo_unitario:0}
      ];
      const inventario_lotes = [{inventario_id:1,fecha_ingreso:hoy(),cantidad_disponible:4,costo_unitario:3}];
      const motivos = ['Consumo interno','Venta','Traslado a sucursal','Devolución','Despacho','Uso en consulta','Merma','Anulación de compra'];
      const inventario_movimientos = motivos.map((motivo,i) => ({inventario_id:2,tipo:'salida',fecha:hoy(),motivo:'Excel · ' + motivo,cantidad:2,
        costo_importado:true,costo_unitario:i < 5 ? 4.275 : null, valor_costo:i < 5 ? 8.55 : null}));
      const reportes = _armarReportesZip({inventario, inventario_lotes, inventario_movimientos},['inventario','contabilidad'],hoy(),false);
      const datosAnteriores = {inv:C.inv, lotes:C.lotes, mov:C.mov};
      Object.assign(C,{inv:inventario.map(fromInv), lotes:inventario_lotes.map(fromLote), mov:inventario_movimientos.map(fromMov)});
      renderReportesInv();
      const pantalla = document.getElementById('rep-inv-content');
      const grupos = [...pantalla.querySelectorAll('[aria-label="Existencias por categoría y unidad"] tbody tr')]
        .map(tr => [...tr.cells].map(td => td.textContent));
      const texto = pantalla.textContent;
      Object.assign(C,datosAnteriores);
      return {grupos, texto, informes:Object.fromEntries(reportes.map(r => [r.titulo,r.secciones.join('')]))};
    });
    assert.deepEqual(inventarioImportado.grupos.map(f => f.slice(0,4)), [['insumo','frasco','11','6'], ['insumo','ml','20','0']]);
    assert.match(inventarioImportado.texto, /A-001 · Reactivo <A>/);
    assert.match(inventarioImportado.informes['Existencias de inventario'], /A-001 · Reactivo &lt;A&gt;/);
    assert.match(inventarioImportado.informes['Existencias de inventario'], /Valor conocido a costo<\/td><td>C\$ 14[.,]50/);
    assert.match(inventarioImportado.informes['Balance general'], /Inventario \(valor conocido\)<\/td><td>C\$ 14[.,]50/);
    assert.match(inventarioImportado.informes['Estado de resultados'], /Costo de inventario utilizado o vendido<\/td><td>C\$ 17[.,]10/);
    assert.match(inventarioImportado.informes['Estado de resultados'], /Salidas pendientes de valorar \(resultado provisional\)<\/td><td>1/);
    assert.match(inventarioImportado.informes['Estado de resultados'], /Salidas por clasificar \(resultado provisional\)<\/td><td>2/);
    assert.match(inventarioImportado.informes['Movimientos de inventario'], /Movimientos sin costo documentado: 3/);
    const aperturas = await pagina.evaluate(() => aperturas);
    const resumen = aperturas.find(x=>x.titulo==='Contabilidad').secciones.join('');
    assert.match(resumen,/Compras vigentes<\/td><td>C\$ 60[.,]00/);
    assert.match(resumen,/Cuentas por pagar<\/td><td>C\$ 650[.,]00/);
    assert.match(resumen,/Ventas comerciales vigentes<\/td><td>C\$ 100[.,]00/);
    assert.match(resumen,/Cuentas comerciales por cobrar<\/td><td>C\$ 800[.,]00/);
    const venta = aperturas.find(x=>x.titulo==='Ventas y cuentas por cobrar').secciones;
    assert.doesNotMatch(venta[0],/Apertura-C/);
    assert.match(venta[1],/Apertura-C/);
    assert.doesNotMatch(aperturas.find(x=>x.titulo==='Ganancia por producto').secciones.join(''),/Ignorar apertura/);
    await pagina.evaluate(()=>LibroDiario.abrir(null,true));
    await pagina.locator('#libro-diario-pdf:visible').waitFor();
    await pagina.locator('#libro-diario-resultados summary').click();
    assert.match(await pagina.locator('#libro-diario-resultados').innerText(),/Kardex.xlsx · Hoja 1 · fila 5/);
    for (const width of [360,430,1280]) {
      await pagina.setViewportSize({width,height:800});
      const modal=await pagina.locator('#modal-libro-diario .modal').boundingBox();
      assert.ok(modal.x>=0 && modal.x+modal.width<=width+1);
      assert.ok(await pagina.locator('#libro-diario-resultados').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    }
    await pagina.evaluate(()=>LibroDiario.cerrar());
    await pagina.setViewportSize({width:390,height:800});
    const archivo = pagina.waitForEvent('download',{timeout:90000});
    await pagina.locator('#export-reportes-zip button').click();
    const desc = await archivo;
    assert.match(desc.suggestedFilename(),/^lumea-reportes-.*\.zip$/);
    const bytes = fs.readFileSync(await desc.path());
    const entradas = await pagina.evaluate(async data => {
      const zip = await JSZip.loadAsync(new Uint8Array(data),{checkCRC32:true});
      return Promise.all(Object.values(zip.files).map(async f => [f.name,(await f.async('string')).slice(0,5)]));
    },[...bytes]);
    assert.equal(entradas.length,informes.length+5);
    assert.ok(entradas.some(([nombre])=>nombre==='Balance-general-por-cuentas.pdf'));
    assert.ok(entradas.some(([nombre])=>nombre==='Estado-de-resultados-por-cuentas.pdf'));
    assert.ok(entradas.some(([nombre])=>nombre==='Auxiliar-de-inventario-importado.pdf'));
    assert.ok(entradas.some(([nombre])=>nombre==='Balanza-de-comprobacion.pdf'));
    assert.ok(entradas.some(([nombre])=>nombre==='Libro-diario.pdf'));
    assert.ok(entradas.every(([n,f])=>n.endsWith('.pdf')&&f==='%PDF-'));
    assert.deepEqual(await pagina.evaluate(() => prueba.notificaciones),[[1,'zip']]);
    const presentacion = await pagina.evaluate(() => {
      const overlay = document.getElementById('loading-overlay');
      return {cargas:prueba.cargas,marcos:prueba.marcos,progreso:prueba.progreso,visible:overlay.classList.contains('show')};
    });
    assert.deepEqual(presentacion.cargas,[true,false]);
    assert.equal(presentacion.visible,false);
    assert.deepEqual(presentacion.marcos,entradas.map(()=>['0',true]));
    for(const i of entradas.keys()) assert.ok(presentacion.progreso.some(p=>p.startsWith(`Reporte ${i+1} de ${entradas.length}`)));
    await pagina.evaluate(() => prueba.terminarCorreo());
    assert.ok((await pagina.evaluate(()=>prueba.consultas)).every(([,c])=>c===1));
    if(process.env.REPORTES_LIB_DIR) fs.writeFileSync(path.join(process.env.REPORTES_LIB_DIR,'reportes-prueba.zip'),bytes);
    console.log('OK: reporte histórico, fecha de corte, permisos, ZIP con PDF válidos y aviso por correo.');
  } finally {
    await navegador.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
