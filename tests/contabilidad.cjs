// Contabilidad de la empresa médica: lotes (FIFO), ventas de contado y al
// crédito con IVA manual, cobros, anulación, estado de resultados, balance que
// cuadra, gráfica, reportes y cómo se ve en teléfono. Supabase está simulado:
// se anota cada escritura. Ejecutar con PLAYWRIGHT_MODULE (y PLAYWRIGHT_CHROMIUM).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
const sql=fs.readFileSync(path.join(root,'migracion_contabilidad.sql'),'utf8');
// Las pruebas toman trozos de app.js: esto confirma que el archivo entero se puede cargar.
new (require('node:vm').Script)(source,{filename:'app.js'});

function extraer(name) {
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  let abiertas=0;
  for(const ch of primeraLinea) { if(ch==='{') abiertas++; else if(ch==='}') abiertas--; }
  if(abiertas===0 && primeraLinea.includes('{')) return primeraLinea;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const bloque=(desde,hasta)=>{const a=source.indexOf(desde);assert(a>=0,desde);const b=source.indexOf(hasta,a);assert(b>a,hasta);return source.slice(a,b);};

const preambulo=`
  let currentUser={id:'u1',name:'Ana'}, currentClinicaId=9, currentClinica={id:9,tipo:'empresa_medica'}, currentView='contabilidad';
  window.__toasts=[]; window.__llamadas=[]; window.__pdf=[]; let __id=1000; window.__fallar=null;
  const toast=(m,t='success')=>__toasts.push([t,m]);
  const setLoading=()=>{};
  const _exigeClinica=()=>!!currentClinicaId;
  const _faltaColumna=(e,c)=>String(e?.message||'').includes(c);
  const esEmpresaMedica=(c=currentClinica)=>c?.tipo==='empresa_medica';
  const hasPermiso=()=>true;
  const loadAll=async()=>{}; const renderInventario=()=>{};
  let __confirmar=true; const customConfirm=async()=>__confirmar;
  const closeModal=id=>{document.getElementById(id).classList.remove('open');};
  const openModalCompra=()=>{}; const switchInvTab=()=>{};
  const _guiaModulo={modulo:null}; const isSuperAdmin=()=>false; const esVeterinaria=()=>false;
  const VISTAS_CLINICAS=[]; const closeSidebar=()=>{};
  const renderView=v=>{if(v==='contabilidad') renderContabilidad();};
  const getClinicaConfig=()=>({});
  const CATEGORIA_PAGO_PROFESIONAL='pago_profesionales';
  let finTab='balance', finPeriodo='mes';
  ${extraer('navigate')}
  const pdfAbrir=(titulo,body)=>__pdf.push({titulo,body});
  const descargarDocumento=fn=>fn();
  const formatFecha=f=>f;
  const hoy=()=>'2026-11-14';
  const escAttr=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtC=n=>'C$ '+Number(n||0).toFixed(2);
  const _etiquetaCategoria=id=>id;
  let _movItems={}, _movTipo='salida';
  ${extraer('fechaLocal')}
  ${extraer('_lumiNormal')}
  ${extraer('openModalOverlay')}
  // Supabase simulado. insert().select().single() devuelve la fila con id nuevo;
  // insert().select() devuelve todas las filas insertadas con su id.
  const sb={from(t){
    const q={t,op:'select',datos:null,filtros:[]};
    const b={insert(d){q.op='insert';q.datos=d;return b;},update(d){q.op='update';q.datos=d;return b;},delete(){q.op='delete';return b;},
      select(){q.sel=true;return b;},single(){q.single=true;return b;},eq(c,v){q.filtros.push([c,v]);return b;},order(){return b;},limit(){return b;},
      then(ok,ko){__llamadas.push(q);
        const f=__fallar&&__fallar(q);
        if(f) return Promise.resolve({data:null,error:typeof f==='object'?f:{message:f}}).then(ok,ko);
        let data=null;
        if(q.single) data={id:++__id,...(Array.isArray(q.datos)?{}:q.datos)};
        else if(q.sel&&q.op==='insert') data=(Array.isArray(q.datos)?q.datos:[q.datos]).map(d=>({id:++__id,...d}));
        return Promise.resolve({data,error:null}).then(ok,ko);}};
    return b;}};
  const C={inv:[],prov:[],comp:[],mov:[],fin:[],lotes:[],ventas:[],cliCom:[]};
  ${bloque('const fromProv','const fromMov')}
  ${bloque('let _comprasDisponibles','// ════════════════════ CATÁLOGO INVENTARIO')}
  ${extraer('_pctMargen')}
  ${extraer('confirmarMovMasivo')}
  ${bloque('const TIPOS_SERVICIO_FACTURA', 'async function anularFactura')}
  ${['_etiquetaRol','_contextoEstablecimiento','_textoEstablecimiento','actualizarIdentidadEstablecimiento',
    '_tituloBalanceFinanzas','puedeVerBalance','getFinDateRange','renderFinanzas','switchFinTab',
    'renderResumenFinanzas','imprimirResumenFinanzas'].map(extraer).join('\n')}
  window.__estado=(o)=>{ for(const k of Object.keys(o.C||{})) C[k]=JSON.parse(JSON.stringify(o.C[k]));
    if('tipo' in o) { currentClinica.tipo=o.tipo; currentUser.key=o.tipo==='empresa_medica'?'admin_empresa':'medico_admin'; }
    if('rol' in o) currentUser.key=o.rol;
    if('confirmar' in o) __confirmar=o.confirmar; if('periodo' in o) contPeriodo=o.periodo; if('tab' in o) contTab=o.tab; if('mov' in o) { _movItems=o.mov; _movTipo='salida'; } };
  Object.assign(window,{C,fromVenta,fromLote,fromCompra,fromCliCom,_asignarLotes,_stockSinLote,_valorInventario,_estadoResultados,_balanceGeneral,_rangoCont,
    abrirNuevaVenta,agregarLineaVenta,cambiarLineaVenta,guardarVenta,_lineasV:()=>_lineasVenta,_ajustarCondicionVenta,_ajustarIvaVenta,
    abrirCobroVenta,guardarCobroVenta,_saldoVenta,_estadoCobroVenta,_diasVencida,_tramoCobro,verVenta,anularVenta,
    abrirNuevaCompra,agregarLineaCompra,cambiarLineaCompra,guardarCompra,anularCompra,_lineasC:()=>_lineasCompra,confirmarMovMasivo,_htmlLotesProducto,
    renderContabilidad,switchContTab,renderVentas,renderPorCobrar,
    imprimirEstadoResultados,imprimirBalanceGeneral,imprimirReporteVentas,imprimirCuentasPorCobrar,imprimirEstadoCuenta,imprimirGananciaProductos,
    imprimirReporteIva,imprimirExistenciasLotes,imprimirVenta,abrirClienteCom,guardarClienteCom});
`;
const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});
const abrir=async p=>{
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith('http://app.test/css/')) return r.fulfill({contentType:'text/css',body:css});
    if(u==='http://app.test/') return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
    return r.abort();});
  await p.goto('http://app.test/');
  await p.addScriptTag({content:preambulo});
  await p.evaluate(()=>{
    document.getElementById('app').classList.add('visible');
    document.querySelectorAll('.loading-overlay,#login-screen').forEach(e=>e.style.display='none');
    document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
    document.getElementById('view-contabilidad').classList.add('active');
  });
};

// Guantes: 30 cajas. 5 sin lote (existencia anterior, a C$ 6), lote L-A con 10
// a C$ 5 (octubre) y lote L-B con 15 a C$ 7 (noviembre).
const INV=[{id:1,nombre:'Guantes de nitrilo M',unidad:'caja',stock:30,stockMin:5,costo:6,precio:10,categoria:'material'},
           {id:2,nombre:'Jeringas 5 ml',unidad:'unidad',stock:0,stockMin:0,costo:null,precio:3,categoria:'material'}];
const LOTES=[{id:11,invId:1,proveedorId:7,compraId:50,lote:'L-A',fecha:'2026-10-01',inicial:10,disponible:10,costo:5},
             {id:12,invId:1,proveedorId:7,compraId:51,lote:'L-B',fecha:'2026-11-01',inicial:15,disponible:15,costo:7}];
const PROV=[{id:7,nombre:'Proveedor A',activo:true}];
const CLIENTES=[{id:21,nombre:'Clínica Norte',identificacion:'J031',contacto:'Luis',telefono:'8888 1111',email:'',direccion:'Managua',diasCredito:45,notas:'',activo:true}];
const de=(ll,t,op)=>ll.filter(q=>q.t===t&&q.op===op);

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await abrir(page);

    // La cuenta administrativa, la empresa y las especialidades usan sus
    // propios términos. El usuario sin permiso de reparto sigue viendo caja bruta.
    for(const [tipo,rol,entidad,verBalance] of [
      ['empresa_medica','admin_empresa','empresa',true],
      ['clinica','medico_admin','clínica',true],
      ['optica','medico_admin','óptica',true],
      ['farmacia','medico_admin','farmacia',true],
      ['clinica','optometrista','óptica',false],
      ['clinica','admin','clínica',false],
      ['dental','medico_admin','clínica dental',true]
    ]) {
      const datos=await page.evaluate(async({tipo,rol})=>{
        __estado({tipo,rol,C:{fin:[{tipo:'ingreso',monto:500,descripcion:'Venta de productos',fecha:getFinDateRange().to},{tipo:'egreso',monto:115,descripcion:'Pago a proveedor',fecha:getFinDateRange().to}],fact:[],factItems:[],reparto:[]}});
        actualizarIdentidadEstablecimiento();
        finTab='resumen'; await navigate('finanzas'); __pdf.length=0; imprimirResumenFinanzas();
        const resumen={texto:document.getElementById('fin-stats').textContent,pdf:__pdf.at(-1).body};
        if(puedeVerBalance()) {renderBalanceFinanzas();imprimirBalanceReparto();}
        return {resumen,balance:document.getElementById('fin-balance').textContent,pdfBalance:__pdf.at(-1).body,
          ingreso:_textoEstablecimiento('Ingresos de la clínica'), permiso:puedeVerBalance()};
      },{tipo,rol});
      assert.equal(datos.ingreso,'Ingresos de la '+entidad);
      assert.equal(datos.permiso,verBalance,'Las etiquetas no conceden acceso al reparto');
      assert.match(datos.resumen.texto,/C\$ 500\.00[\s\S]*C\$ 385\.00/,'Mismos importes después del cambio de etiquetas');
      if(verBalance) {
        for(const texto of [datos.resumen.texto,datos.resumen.pdf,datos.balance,datos.pdfBalance]) {
          assert(texto.includes('Ingresos de la '+entidad));
          if(entidad==='empresa'||entidad==='óptica'||entidad==='farmacia') assert(!/clínica/i.test(texto),'Sin términos clínicos en '+entidad);
        }
      } else assert.match(datos.resumen.texto,/Entradas del período/);
      for(const width of [360,390,430,1280]) for(const dark of [false,true]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(dark=>{document.body.classList.toggle('dark',dark);document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));document.getElementById('view-finanzas').classList.add('active');},dark);
        const fuera=await page.locator('#fin-stats').evaluate(el=>[...el.querySelectorAll('h3,p')].filter(e=>{const r=e.getBoundingClientRect();return r.right>innerWidth+1||r.left<0;}).map(e=>e.textContent));
        assert.deepEqual(fuera,[],`${rol} ${tipo} ${width}px ${dark?'oscuro':'claro'}: etiquetas sin desbordes`);
        if(width===360||width===1280) await page.screenshot({path:path.join(process.env.TEMP||'/tmp',`roles-${tipo}-${rol}-${width}-${dark?'oscuro':'claro'}.png`),fullPage:true,animations:'disabled'});
      }
    }
    console.log('OK: ingresos, gastos, roles e impresos por empresa/óptica/farmacia/clínica; mismos importes y permisos, móvil y escritorio en ambos temas.');

    // Finanzas solo cambia su nombre en la empresa; Contabilidad conserva el
    // balance de activos/pasivos. Se pulsa el botón con navigate() real.
    for(const tipo of ['empresa_medica','clinica']) {
      const titulo=tipo==='empresa_medica'?'Flujo de caja':'Balance general';
      await page.evaluate(tipo=>{
        __estado({tipo,C:{fin:[],fact:[],factItems:[],reparto:[]}});
        finTab='balance'; navigate('finanzas');
      },tipo);
      assert.equal(await page.locator('#tab-fin-balance').textContent(),tipo==='empresa_medica'?'⚖️ Flujo de caja':'⚖️ Balance');
      assert.equal(await page.locator('#fin-balance .doc-header h3').textContent(),'⚖️ '+titulo);
      assert.equal(await page.locator('.balance-enlace-contable').count(),tipo==='empresa_medica'?1:0);
      const impresos=await page.evaluate(()=>{
        __pdf.length=0; imprimirBalanceReparto(); imprimirResumenFinanzas();
        renderResumenFinanzas(); return {pdf:__pdf,tarjeta:document.querySelector('#fin-stats').textContent};
      });
      assert.match(impresos.tarjeta,new RegExp(titulo));
      assert.match(impresos.pdf[0].body,new RegExp(titulo));
      assert.match(impresos.pdf[1].body,new RegExp(titulo));
      if(tipo==='empresa_medica') assert.match(impresos.pdf[0].titulo,/^Flujo de caja — /);
      else assert.match(impresos.pdf[0].titulo,/^Balance de servicios — /);
      for(const width of [360,390,430,1280]) for(const dark of [false,true]) {
        await page.setViewportSize({width,height:900});
        await page.evaluate(dark=>document.body.classList.toggle('dark',dark),dark);
        const fuera=await page.locator('#fin-panel-balance').evaluate(el=>{
          return [...el.querySelectorAll('.doc-header h3,.doc-acciones .btn,.balance-enlace-contable,.balance-enlace-contable p,.balance-enlace-contable .btn')]
            .filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&(r.left<0||r.right>innerWidth+1);}).map(e=>e.outerHTML);
        });
        assert.deepEqual(fuera,[],`${tipo} ${width}px ${dark?'oscuro':'claro'} sin desbordes`);
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Sin scroll horizontal');
        await page.evaluate(()=>window.scrollTo(0,0));
        await page.screenshot({path:path.join(process.env.TEMP||'/tmp',`flujo-${tipo}-${width}-${dark?'oscuro':'claro'}.png`),fullPage:true,animations:'disabled'});
      }
      if(tipo==='empresa_medica') {
        assert.match(await page.locator('.balance-enlace-contable p').textContent(),/^El balance general contable está en Contabilidad → Balance$/);
        await page.locator('.balance-enlace-contable button').click();
        await page.waitForSelector('#cont-panel-balance',{state:'visible'});
        assert.equal(await page.evaluate(()=>currentView),'contabilidad');
        assert.equal(await page.evaluate(()=>contTab),'balance');
        assert.equal(await page.locator('#cont-panel-balance h3').first().textContent(),'⚖️ Balance general');
      }
    }
    await page.evaluate(()=>{__estado({tipo:'empresa_medica'});document.body.classList.remove('dark');});
    console.log('OK: Flujo de caja solo en empresa, clínica intacta, tarjetas, PDF y navegación al balance contable; claro/oscuro a 360–430 y 1280 px.');

    // ── Migración: tablas con RLS, en rls_setup, auditoría y respaldo ──
    for(const t of ['clientes_comerciales','inventario_lotes','ventas','venta_items','venta_cobros']) {
      assert.match(sql,new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`),`${t} sin RLS`);
      assert.match(sql,new RegExp(`CREATE POLICY "${t}_clinica"`),`${t} sin política`);
    }
    assert.match(sql,/ADD COLUMN IF NOT EXISTS lote\s+TEXT/);
    assert.doesNotMatch(sql,/vencimiento\s+DATE[^\n]*inventario_lotes|fecha_vencimiento/,'Los lotes no llevan vencimiento por ahora');
    assert.match(fs.readFileSync(path.join(root,'rls_setup.sql'),'utf8'),/'clientes_comerciales','inventario_lotes','ventas','venta_items','venta_cobros'/);
    assert.match(fs.readFileSync(path.join(root,'audit_migraciones.sql'),'utf8'),/contabilidad/);
    assert.match(source,/\{tabla:'ventas', opcional:true, select:'\*,venta_items\(\*\),venta_cobros\(\*\)'\}/,'Las ventas van en el respaldo');
    assert.match(source,/\{tabla:'inventario_lotes', opcional:true\}/);
    assert.match(source,/lotesInventario:t\.inventario_lotes\|\|\[\], clientesComerciales:t\.clientes_comerciales\|\|\[\], ventas:t\.ventas\|\|\[\]/);
    assert.match(extraer('navigate'),/view==='contabilidad' && !hasPermiso\('contabilidad'\)/,'Contabilidad se abre con su permiso');
    assert.doesNotMatch(extraer('navigate'),/Contabilidad es el módulo de las empresas médicas/,'Una clínica con el permiso también entra');

    // ── Lotes: primero lo más antiguo ──
    const fifo=await page.evaluate(({INV,LOTES})=>{
      __estado({C:{inv:INV,lotes:LOTES}});
      const usado=new Map();
      return {
        auto:_asignarLotes(1,18), corto:_asignarLotes(1,40).falta, elegido:_asignarLotes(1,20,12),
        compartido:[_asignarLotes(1,8,null,usado).partes.map(x=>[x.lote,x.cantidad]),_asignarLotes(1,8,null,usado).partes.map(x=>[x.lote,x.cantidad])],
        sinLote:_stockSinLote(C.inv[0]), valor:_valorInventario(),
      };
    },{INV,LOTES});
    assert.deepEqual(fifo.auto,{partes:[{loteId:null,lote:'',cantidad:5,costo:6},{loteId:11,lote:'L-A',cantidad:10,costo:5},{loteId:12,lote:'L-B',cantidad:3,costo:7}],falta:0},
      'Sale primero lo que no tiene lote, después L-A y lo que falta de L-B');
    assert.equal(fifo.corto,10);
    assert.deepEqual(fifo.elegido,{partes:[{loteId:12,lote:'L-B',cantidad:15,costo:7}],falta:5},'Con un lote elegido no se toma de otro');
    assert.deepEqual(fifo.compartido,[[['',5],['L-A',3]],[['L-A',7],['L-B',1]]],'Dos líneas no cuentan dos veces el mismo lote');
    assert.equal(fifo.sinLote,5);
    assert.deepEqual(fifo.valor,{total:185,lotes:155,sinLote:30});

    // ── Venta de contado, sin IVA ──
    const contado=await page.evaluate(async({INV,LOTES})=>{
      localStorage.clear();
      __estado({C:{inv:INV,lotes:LOTES,ventas:[],cliCom:[]}});
      abrirNuevaVenta();
      const l=_lineasV()[0];
      cambiarLineaVenta(l.id,'invId','1');
      const precio=_lineasV()[0].precio;
      cambiarLineaVenta(_lineasV()[0].id,'cantidad','18');
      const ui={numero:document.getElementById('venta-numero-sig').textContent,total:document.getElementById('venta-total').textContent,
        ganancia:document.getElementById('venta-ganancia').textContent,info:document.querySelector('.compra-linea-margen').textContent,
        ivaOculto:document.getElementById('venta-iva-linea').hidden,lotes:[...document.querySelectorAll('.compra-campo-lote option')].map(o=>o.textContent),
        sinStock:document.querySelector('#venta-lineas select option[value="2"]').disabled};
      // A crédito sin cliente no se puede
      document.getElementById('venta-condicion').value='credito'; _ajustarCondicionVenta(true);
      __llamadas.length=0; await guardarVenta();
      const sinCliente={toast:__toasts.at(-1),llamadas:__llamadas.length};
      document.getElementById('venta-condicion').value='contado'; _ajustarCondicionVenta();
      // Más de lo que hay tampoco
      cambiarLineaVenta(_lineasV()[0].id,'cantidad','40');
      const falta=document.querySelector('.compra-linea-margen').textContent;
      __llamadas.length=0; await guardarVenta();
      const sinStock={toast:__toasts.at(-1),llamadas:__llamadas.length};
      cambiarLineaVenta(_lineasV()[0].id,'cantidad','18');
      __llamadas.length=0; await guardarVenta();
      return {precio,ui,sinCliente,falta,sinStock,llamadas:JSON.parse(JSON.stringify(__llamadas)),toast:__toasts.at(-1),lotes:C.lotes.map(x=>x.disponible)};
    },{INV,LOTES});
    assert.equal(contado.precio,10,'Se propone el precio de venta del producto');
    assert.equal(contado.ui.numero,'V-000001');
    assert.equal(contado.ui.total,'C$ 180.00');
    assert.equal(contado.ui.ganancia,'C$ 79.00','180 − (5×6 + 10×5 + 3×7)');
    assert.match(contado.ui.info,/^Disponible 30 caja · costo C\$ 5\.61 · margen 43[.,]9 % · sale de sin lote \(5\), L-A \(10\), L-B \(3\)$/);
    assert.equal(contado.ui.ivaOculto,true,'El IVA no se cobra si no se marca');
    assert.deepEqual(contado.ui.lotes,['Automático (más antiguo)','L-A · 10 disp.','L-B · 15 disp.']);
    assert.equal(contado.ui.sinStock,true,'Un producto sin stock no se puede elegir');
    assert.deepEqual([contado.sinCliente.toast[0],contado.sinCliente.llamadas],['error',0]);
    assert.match(contado.sinCliente.toast[1],/al crédito necesita un cliente/);
    assert.match(contado.falta,/Solo hay 30 caja disponibles/);
    assert.deepEqual([contado.sinStock.toast[0],contado.sinStock.llamadas],['error',0]);
    assert.match(contado.sinStock.toast[1],/Faltan 10 caja/);
    const ll=contado.llamadas;
    const cab=de(ll,'ventas','insert')[0].datos;
    assert.deepEqual([cab.numero,cab.cliente_id,cab.subtotal,cab.iva,cab.total,cab.condicion,cab.vencimiento,cab.estado],['V-000001',null,180,0,180,'contado',null,'registrada']);
    const items=de(ll,'venta_items','insert')[0].datos.map(i=>[i.lote_id,i.lote,i.cantidad,i.costo_unitario,i.precio_unitario,i.subtotal]);
    assert.deepEqual(items,[[null,null,5,6,10,50],[11,'L-A',10,5,10,100],[12,'L-B',3,7,10,30]],'Cada parte de la venta lleva el costo de su lote');
    assert.deepEqual(de(ll,'inventario_lotes','update').map(q=>[q.filtros[0][1],q.datos.cantidad_disponible]),[[11,0],[12,12]]);
    assert.deepEqual(contado.lotes,[0,12]);
    assert.deepEqual(de(ll,'inventario','update').map(q=>q.datos),[{stock_actual:12}]);
    const mov=de(ll,'inventario_movimientos','insert')[0].datos;
    assert.deepEqual([mov.tipo,mov.cantidad,mov.motivo],['salida',18,'Venta V-000001 · Venta de mostrador']);
    const cobro=de(ll,'venta_cobros','insert')[0].datos;
    assert.deepEqual([cobro.monto,cobro.metodo_pago],[180,'efectivo'],'De contado nace cobrada');
    const ingreso=de(ll,'finanzas','insert')[0].datos;
    assert.deepEqual([ingreso.tipo,ingreso.categoria,ingreso.monto,ingreso.descripcion],['ingreso','ventas',180,'Cobro venta V-000001 · Venta de mostrador'],'Finanzas se alimenta sola');
    assert.match(ingreso.referencia,/^VENTA-\d+$/);
    assert(de(ll,'venta_cobros','update').some(q=>q.datos.finanzas_id),'El cobro recuerda su ingreso');
    assert.equal(contado.toast[0],'success');

    // ── Al crédito, con IVA manual: vence según el cliente y no se cobra todavía ──
    const credito=await page.evaluate(async({INV,LOTES,CLIENTES})=>{
      __estado({C:{inv:INV,lotes:LOTES,ventas:[],cliCom:CLIENTES}});
      abrirNuevaVenta();
      document.getElementById('venta-cliente').value='21';
      document.getElementById('venta-condicion').value='credito'; _ajustarCondicionVenta(true);
      document.getElementById('venta-con-iva').checked=true; document.getElementById('venta-iva-pct').value='13'; _ajustarIvaVenta();
      cambiarLineaVenta(_lineasV()[0].id,'invId','1'); cambiarLineaVenta(_lineasV()[0].id,'cantidad','2');
      const visto=id=>getComputedStyle(document.getElementById(id)).display!=='none';
      const ui={vence:document.getElementById('venta-vencimiento').value,metodoOculto:!visto('venta-metodo-wrap'),
        iva:document.getElementById('venta-iva').textContent,lbl:document.getElementById('venta-iva-lbl').textContent,total:document.getElementById('venta-total').textContent};
      __llamadas.length=0; await guardarVenta();
      const r={ui,llamadas:JSON.parse(JSON.stringify(__llamadas)),toast:__toasts.at(-1)[1]};
      abrirNuevaVenta();
      r.recuerda={con:document.getElementById('venta-con-iva').checked,pct:document.getElementById('venta-iva-pct').value,visible:!document.getElementById('venta-iva-pct-wrap').hidden};
      return r;
    },{INV,LOTES,CLIENTES});
    assert.deepEqual(credito.ui,{vence:'2026-12-29',metodoOculto:true,iva:'C$ 2.60',lbl:'IVA (13 %)',total:'C$ 22.60'},'45 días de crédito del cliente; IVA al 13 % escrito a mano');
    const cabC=de(credito.llamadas,'ventas','insert')[0].datos;
    assert.deepEqual([cabC.cliente_id,cabC.condicion,cabC.vencimiento,cabC.subtotal,cabC.iva_pct,cabC.iva,cabC.total],[21,'credito','2026-12-29',20,13,2.6,22.6]);
    assert.equal(credito.llamadas.filter(q=>q.t==='venta_cobros'||q.t==='finanzas').length,0,'Al crédito no hay cobro ni ingreso hasta que pague');
    assert.equal(de(credito.llamadas,'inventario','update').length,1,'El stock sale aunque no se haya cobrado');
    assert.match(credito.toast,/queda por cobrar/);
    assert.deepEqual(credito.recuerda,{con:true,pct:'13',visible:true},'La próxima venta propone el mismo IVA');

    // ── Número repetido (dos personas a la vez): se toma el siguiente ──
    const numero=await page.evaluate(async({INV,LOTES})=>{
      __estado({C:{inv:INV,lotes:LOTES,cliCom:[],ventas:[fromVenta({id:1,numero:'V-000003',fecha:'2026-11-01',total:1,subtotal:1,estado:'registrada',venta_items:[],venta_cobros:[{id:1,fecha:'2026-11-01',monto:1}]})]}});
      abrirNuevaVenta(); cambiarLineaVenta(_lineasV()[0].id,'invId','1');
      window.__fallar=q=>q.t==='ventas'&&q.op==='insert'&&q.datos.numero==='V-000004'?{code:'23505',message:'duplicate key value violates unique constraint "idx_ventas_numero"'}:null;
      __llamadas.length=0; await guardarVenta(); window.__fallar=null;
      return {numeros:de(__llamadas,'ventas','insert').map(q=>q.datos.numero),toast:__toasts.at(-1)};
      function de(ll,t,op){return ll.filter(q=>q.t===t&&q.op===op);}
    },{INV,LOTES});
    assert.deepEqual(numero.numeros,['V-000004','V-000005']);
    assert.equal(numero.toast[0],'success');

    // ── Cobros: parcial, de más y estados de cuentas por cobrar ──
    const VENTA_CRED={id:300,cliente_id:21,numero:'V-000010',fecha:'2026-10-01',subtotal:100,iva_pct:15,iva:15,total:115,condicion:'credito',vencimiento:'2026-10-31',estado:'registrada',
      venta_items:[{id:1,inventario_id:1,lote_id:11,lote:'L-A',descripcion:'Guantes de nitrilo M',cantidad:10,precio_unitario:10,costo_unitario:5,subtotal:100}],venta_cobros:[]};
    const cobros=await page.evaluate(async({VENTA_CRED,CLIENTES})=>{
      const v=fromVenta(VENTA_CRED);
      __estado({C:{cliCom:CLIENTES,ventas:[v]}});
      const r={estado:_estadoCobroVenta(v),saldo:_saldoVenta(v),dias:_diasVencida(v),tramo:_tramoCobro(v)};
      abrirCobroVenta(300);
      r.propuesto=document.getElementById('cobro-venta-monto').value;
      document.getElementById('cobro-venta-monto').value='200'; __llamadas.length=0; await guardarCobroVenta();
      r.deMas={toast:__toasts.at(-1)[0],llamadas:__llamadas.length};
      abrirCobroVenta(300); document.getElementById('cobro-venta-fecha').value='2026-09-01'; await guardarCobroVenta();
      r.antes=__toasts.at(-1)[0];
      abrirCobroVenta(300); document.getElementById('cobro-venta-monto').value='50'; document.getElementById('cobro-venta-metodo').value='transferencia';
      document.getElementById('cobro-venta-referencia').value='TR-1'; __llamadas.length=0; await guardarCobroVenta();
      r.llamadas=JSON.parse(JSON.stringify(__llamadas)); r.toast=__toasts.at(-1);
      const mk=o=>fromVenta({...VENTA_CRED,...o});
      r.estados=[_estadoCobroVenta(mk({vencimiento:'2026-12-31',venta_cobros:[{id:1,fecha:'2026-11-14',monto:50}]})),
        _estadoCobroVenta(mk({venta_cobros:[{id:1,fecha:'2026-11-14',monto:50},{id:2,fecha:'2026-11-15',monto:65}]})),
        _saldoVenta(mk({estado:'anulada'})),
        _estadoCobroVenta(mk({condicion:'contado',vencimiento:null,fecha:'2026-11-14'})),
        _estadoCobroVenta(mk({condicion:'contado',vencimiento:null,fecha:'2026-11-10'})),
        _tramoCobro(mk({vencimiento:'2026-08-01'}))];
      return r;
    },{VENTA_CRED,CLIENTES});
    assert.deepEqual([cobros.estado,cobros.saldo,cobros.dias,cobros.tramo,cobros.propuesto],['vencida',115,14,'d30','115']);
    assert.deepEqual(cobros.deMas,{toast:'error',llamadas:0},'No se cobra más de lo que se debe');
    assert.equal(cobros.antes,'error','Un cobro no puede ser antes de la venta');
    const cc=de(cobros.llamadas,'venta_cobros','insert')[0].datos;
    assert.deepEqual([cc.venta_id,cc.monto,cc.metodo_pago,cc.referencia],[300,50,'transferencia','TR-1']);
    const ing=de(cobros.llamadas,'finanzas','insert')[0].datos;
    assert.deepEqual([ing.tipo,ing.categoria,ing.monto],['ingreso','ventas',50],'Cada cobro es un ingreso en Finanzas');
    assert.match(cobros.toast[1],/falta C\$ 65\.00/);
    assert.deepEqual(cobros.estados,['parcial','cobrada',0,'por_cobrar','vencida','mas90'],'Contado sin cobro vence el mismo día');

    // ── Anular una venta: vuelve a sus lotes y se borran sus ingresos ──
    const anular=await page.evaluate(async({VENTA_CRED,INV,LOTES})=>{
      const v=fromVenta({...VENTA_CRED,venta_items:[...VENTA_CRED.venta_items,{id:2,inventario_id:1,lote_id:null,lote:null,descripcion:'Guantes de nitrilo M',cantidad:2,precio_unitario:10,costo_unitario:6,subtotal:20}],
        venta_cobros:[{id:1,fecha:'2026-11-01',monto:30,finanzas_id:777},{id:2,fecha:'2026-11-02',monto:20,finanzas_id:778}]});
      __estado({confirmar:true,C:{inv:[{...INV[0],stock:20}],lotes:[{...LOTES[0],disponible:0}],ventas:[v]}});
      verVenta(300);
      const detalle={filas:document.querySelectorAll('#venta-detalle-cuerpo tbody tr').length,botones:[...document.querySelectorAll('#venta-detalle-acciones .btn')].map(b=>b.textContent),
        ganancia:document.querySelector('.venta-ganancia-det').textContent};
      __llamadas.length=0; await anularVenta(300);
      return {detalle,llamadas:JSON.parse(JSON.stringify(__llamadas))};
    },{VENTA_CRED,INV,LOTES});
    assert.deepEqual(anular.detalle.botones,['Cerrar','🖨️ Imprimir','❌ Anular','💵 Registrar cobro']);
    assert.equal(anular.detalle.filas,2);
    assert.match(anular.detalle.ganancia,/Costo de lo vendido C\$ 62\.00 · ganancia C\$ 38\.00 \(38 %\)/);
    assert.deepEqual(de(anular.llamadas,'inventario_lotes','update').map(q=>[q.filtros[0][1],q.datos.cantidad_disponible]),[[11,10]],'Las 10 vuelven a L-A');
    assert.deepEqual(de(anular.llamadas,'inventario','update').map(q=>q.datos),[{stock_actual:32}]);
    const movA=de(anular.llamadas,'inventario_movimientos','insert')[0].datos;
    assert.deepEqual([movA.tipo,movA.cantidad,movA.motivo],['entrada',12,'Anulación de venta V-000010']);
    assert.deepEqual(de(anular.llamadas,'finanzas','delete').map(q=>q.filtros[0][1]),[777,778]);
    assert(anular.llamadas.some(q=>q.t==='ventas'&&q.op==='update'&&q.datos.estado==='anulada'));

    // ── Compra de la empresa: cada línea crea su lote con proveedor y costo ──
    const compra=await page.evaluate(async({INV,PROV})=>{
      __estado({C:{inv:INV,prov:PROV,comp:[],lotes:[]}});
      abrirNuevaCompra(); document.getElementById('compra-proveedor').value='7';
      const r={conLote:document.querySelector('#compra-lineas .compra-linea').classList.contains('con-lote'),
        gastoOculto:getComputedStyle(document.getElementById('compra-gasto-wrap')).display==='none'};
      document.getElementById('compra-gasto').checked=false;
      cambiarLineaCompra(_lineasC()[0].id,'invId','1'); cambiarLineaCompra(_lineasC()[0].id,'cantidad','10'); cambiarLineaCompra(_lineasC()[0].id,'costo','7'); cambiarLineaCompra(_lineasC()[0].id,'lote','LOT-99');
      agregarLineaCompra(); const l2=_lineasC()[1];
      cambiarLineaCompra(l2.id,'invId','2'); cambiarLineaCompra(_lineasC()[1].id,'cantidad','100'); cambiarLineaCompra(_lineasC()[1].id,'costo','1.5');
      r.loteEnPantalla=document.querySelector('.compra-campo-lote input').value;
      __llamadas.length=0; await guardarCompra();
      r.llamadas=JSON.parse(JSON.stringify(__llamadas)); r.toast=__toasts.at(-1);
      return r;
    },{INV,PROV});
    assert.deepEqual([compra.conLote,compra.gastoOculto,compra.loteEnPantalla],[true,true,'LOT-99']);
    const compraId=compra.llamadas.find(q=>q.t==='compras'&&q.op==='insert');
    const lotesIns=de(compra.llamadas,'inventario_lotes','insert')[0].datos;
    assert.equal(lotesIns.length,2);
    assert.deepEqual(lotesIns.map(l=>[l.inventario_id,l.proveedor_id,l.cantidad_inicial,l.cantidad_disponible,l.costo_unitario]),[[1,7,10,10,7],[2,7,100,100,1.5]]);
    assert.equal(lotesIns[0].lote,'LOT-99');
    assert.match(lotesIns[1].lote,/^C\d+-2$/,'Sin número, el lote se nombra por la compra');
    const itemsC=de(compra.llamadas,'compra_items','insert')[0].datos;
    assert.deepEqual(itemsC.map(i=>i.lote),['LOT-99',lotesIns[1].lote]);
    assert(itemsC.every(i=>i.lote_id>0),'Cada línea apunta a su lote');
    assert.equal(de(compra.llamadas,'finanzas','insert')[0].datos.categoria,'compras','En la empresa el pago siempre va a Finanzas');
    assert.equal(compra.toast[0],'success');
    assert(compraId);

    // Anular una compra: no si ya se vendió de sus lotes; si no, se borran sus lotes
    const anularCompraR=await page.evaluate(async({INV})=>{
      const c=fromCompra({id:50,proveedor_id:7,fecha:'2026-10-01',total:50,subtotal:50,condicion:'contado',estado:'registrada',compra_items:[{id:1,inventario_id:1,descripcion:'Guantes',cantidad:10,costo_unitario:5,subtotal:50,lote:'L-A',lote_id:11}],compra_pagos:[]});
      __estado({confirmar:true,C:{inv:INV,comp:[c],lotes:[{id:11,invId:1,compraId:50,lote:'L-A',inicial:10,disponible:4,costo:5}]}});
      __llamadas.length=0; await anularCompra(50);
      const r={usado:{toast:__toasts.at(-1),llamadas:__llamadas.length}};
      __estado({C:{lotes:[{id:11,invId:1,compraId:50,lote:'L-A',inicial:10,disponible:10,costo:5}]}});
      __llamadas.length=0; await anularCompra(50);
      r.borrado=__llamadas.filter(q=>q.t==='inventario_lotes'&&q.op==='delete').map(q=>q.filtros);
      return r;
    },{INV});
    assert.equal(anularCompraR.usado.toast[0],'error');
    assert.match(anularCompraR.usado.toast[1],/ya salieron unidades del lote L-A/);
    assert.equal(anularCompraR.usado.llamadas,0);
    assert.deepEqual(anularCompraR.borrado,[[['compra_id',50]]]);

    // Salida manual en la empresa: saca de los lotes y no es una venta
    const salida=await page.evaluate(async({INV,LOTES})=>{
      __estado({C:{inv:INV,lotes:LOTES},mov:{1:8}});
      document.getElementById('mov-fecha').value='2026-11-14'; document.getElementById('mov-motivo').value='Merma';
      __llamadas.length=0; await confirmarMovMasivo();
      return JSON.parse(JSON.stringify(__llamadas));
    },{INV,LOTES});
    assert.deepEqual(de(salida,'inventario_lotes','update').map(q=>[q.filtros[0][1],q.datos.cantidad_disponible]),[[11,7]],'5 sin lote y 3 de L-A');
    assert.equal(de(salida,'inventario_movimientos','insert')[0].datos.motivo,'Merma · lote L-A (3)');
    assert.equal(de(salida,'finanzas','insert').length,0,'Una salida manual no se anota como ingreso');

    // Kardex: lotes con proveedor
    const kardex=await page.evaluate(({INV,LOTES,PROV})=>{
      __estado({C:{inv:INV,lotes:[...LOTES,{id:13,invId:1,proveedorId:7,lote:'L-0',fecha:'2026-09-01',inicial:4,disponible:0,costo:4}],prov:PROV}});
      const d=document.createElement('div'); d.innerHTML=_htmlLotesProducto(C.inv[0]);
      return [...d.querySelectorAll('tbody tr')].map(tr=>[...tr.children].map(td=>td.textContent));
    },{INV,LOTES,PROV});
    assert.deepEqual(kardex,[['L-B','Proveedor A','2026-11-01','15 / 15','C$ 7.00'],['L-A','Proveedor A','2026-10-01','10 / 10','C$ 5.00'],
      ['L-0','Proveedor A','2026-09-01','0 / 4','C$ 4.00'],['Sin lote','—','—','5','C$ 6.00']]);

    // ── Estado de resultados ──
    const mkV=(o,costo)=>({cliente_id:21,condicion:'contado',estado:'registrada',iva_pct:15,venta_cobros:[],
      venta_items:[{id:1,inventario_id:1,lote_id:null,descripcion:'Guantes de nitrilo M',cantidad:10,precio_unitario:o.subtotal/10,costo_unitario:costo/10,subtotal:o.subtotal}],...o});
    const VENTAS=[mkV({id:1,numero:'V-000001',fecha:'2026-11-05',subtotal:100,iva:15,total:115,venta_cobros:[{id:1,fecha:'2026-11-05',monto:115}]},60),
      mkV({id:2,numero:'V-000002',fecha:'2026-10-10',subtotal:200,iva:0,total:200,venta_cobros:[{id:2,fecha:'2026-10-10',monto:200}]},150),
      mkV({id:3,numero:'V-000003',fecha:'2026-11-06',subtotal:999,iva:0,total:999,estado:'anulada'},500)];
    const FIN=[{id:1,tipo:'ingreso',categoria:'ventas',monto:115,fecha:'2026-11-05'},{id:2,tipo:'ingreso',categoria:'general',monto:20,fecha:'2026-11-08'},
      {id:3,tipo:'egreso',categoria:'compras',monto:500,fecha:'2026-11-02'},{id:4,tipo:'egreso',categoria:'alquiler',monto:30,fecha:'2026-11-01'},
      {id:5,tipo:'egreso',categoria:'pago_iva',monto:10,fecha:'2026-11-10'},{id:6,tipo:'egreso',categoria:'alquiler',monto:40,fecha:'2026-10-01'}];
    const er=await page.evaluate(({VENTAS,FIN})=>{
      __estado({C:{ventas:VENTAS.map(fromVenta),fin:FIN}});
      const res=p=>{const e=_estadoResultados(_rangoCont(p));return [e.ingresosVentas,e.costoVentas,e.bruta,e.totOtros,e.totGastos,e.neta];};
      return {mes:res('mes'),anterior:res('mes_anterior'),todo:res('todo'),margen:_estadoResultados(_rangoCont('mes')).margen,rangoAnt:_rangoCont('mes_anterior'),anioAnt:_rangoCont('anio_anterior')};
    },{VENTAS,FIN});
    assert.deepEqual(er.mes,[100,60,40,20,30,30],'Sin el cobro de ventas, el pago de compras, el pago de IVA ni la anulada');
    assert.deepEqual(er.anterior,[200,150,50,0,40,10]);
    assert.deepEqual(er.todo,[300,210,90,20,70,40]);
    assert.equal(er.margen,40);
    assert.deepEqual(er.rangoAnt,{desde:'2026-10-01',hasta:'2026-10-31'});
    assert.deepEqual(er.anioAnt,{desde:'2025-01-01',hasta:'2025-12-31'});

    // ── Balance general: cuadra y el capital es el inventario con que se empezó ──
    // Inicio: 10 cajas sin lote a C$ 5 (C$ 50). Compra a crédito de 10 a C$ 7 + 15 % IVA
    // (80,50), se abonan 40. Venta a crédito de 12 a C$ 10 + 15 % (138): sale 10 sin
    // lote y 2 de L1 (costo 64); se cobran 100. Alquiler 10.
    const balance=await page.evaluate(()=>{
      __estado({C:{inv:[{id:1,nombre:'Guantes de nitrilo M',unidad:'caja',stock:8,costo:6,precio:10}],
        lotes:[{id:31,invId:1,compraId:60,proveedorId:7,lote:'L1',fecha:'2026-11-02',inicial:10,disponible:8,costo:7}],
        comp:[fromCompra({id:60,proveedor_id:7,fecha:'2026-11-02',subtotal:70,iva:10.5,iva_pct:15,total:80.5,condicion:'credito',vencimiento:'2026-12-02',estado:'registrada',
          compra_items:[{id:1,inventario_id:1,descripcion:'Guantes',cantidad:10,costo_unitario:7,subtotal:70}],compra_pagos:[{id:1,fecha:'2026-11-03',monto:40,finanzas_id:901}]})],
        ventas:[fromVenta({id:70,cliente_id:21,numero:'V-000001',fecha:'2026-11-05',subtotal:120,iva_pct:15,iva:18,total:138,condicion:'credito',vencimiento:'2026-12-05',estado:'registrada',
          venta_items:[{id:1,inventario_id:1,lote_id:null,lote:null,descripcion:'Guantes',cantidad:10,precio_unitario:10,costo_unitario:5,subtotal:100},
                       {id:2,inventario_id:1,lote_id:31,lote:'L1',descripcion:'Guantes',cantidad:2,precio_unitario:10,costo_unitario:7,subtotal:20}],
          venta_cobros:[{id:1,fecha:'2026-11-06',monto:100,finanzas_id:902}]})],
        fin:[{id:901,tipo:'egreso',categoria:'compras',monto:40,fecha:'2026-11-03'},{id:902,tipo:'ingreso',categoria:'ventas',monto:100,fecha:'2026-11-06'},
             {id:903,tipo:'egreso',categoria:'alquiler',monto:10,fecha:'2026-11-07'}]},tab:'balance'});
      const b=_balanceGeneral();
      renderContabilidad();
      return {b:{efectivo:b.efectivo,cxc:b.cxc,inventario:b.inventario.total,ivaPorPagar:b.ivaPorPagar,ivaFavor:b.ivaFavor,cxp:b.cxp,activos:b.activos,pasivos:b.pasivos,resultados:b.resultados,capital:b.capital,patrimonio:b.patrimonio},
        cuadre:document.querySelector('.bg-cuadre').textContent,periodoOculto:document.getElementById('cont-periodo-fila').hidden};
    });
    assert.deepEqual(balance.b,{efectivo:50,cxc:38,inventario:56,ivaPorPagar:7.5,ivaFavor:0,cxp:40.5,activos:144,pasivos:48,resultados:46,capital:50,patrimonio:96});
    assert.equal(balance.cuadre,'✅ Activos = Pasivos + Patrimonio');
    assert.equal(balance.periodoOculto,true,'El balance es a hoy: no se elige período');

    // ── Resumen y gráfica (12 meses, 2 series, tabla, tooltip, modo oscuro) ──
    await page.setViewportSize({width:1280,height:900});
    const grafica=await page.evaluate(({VENTAS,FIN,CLIENTES})=>{
      __estado({C:{ventas:[...VENTAS,{...VENTAS[1],id:4,numero:'V-000004',fecha:'2026-06-15'}].map(fromVenta),fin:FIN,cliCom:CLIENTES,comp:[],inv:[],lotes:[]},tab:'resumen',periodo:'mes'});
      renderContabilidad();
      const el=document.getElementById('cont-grafica');
      const r={lineas:el.querySelectorAll('path.cg-linea').length,puntos:el.querySelectorAll('circle.cg-punto').length,
        leyenda:[...document.querySelectorAll('.cg-leyenda span')].map(s=>s.textContent),etiquetas:[...el.querySelectorAll('.cg-etiqueta')].map(t=>t.textContent),
        meses:[...el.querySelectorAll('.cg-eje text[text-anchor="middle"]')].map(t=>t.textContent),filasTabla:document.querySelectorAll('.cg-tabla tbody tr').length,
        kpis:[...document.querySelectorAll('.cont-kpis h3')].map(h=>h.textContent),
        periodos:[...document.querySelectorAll('#cont-periodos .chip')].map(c=>c.textContent)};
      el.querySelectorAll('.cg-zona')[11].dispatchEvent(new PointerEvent('pointerenter'));
      const tip=el.querySelector('.cg-tooltip');
      r.tooltip=tip.hidden?null:tip.textContent.replace(/\s+/g,' ').trim();
      r.cruz=el.querySelector('.cg-cruz').getAttribute('visibility');
      el.querySelector('svg').dispatchEvent(new PointerEvent('pointerleave'));
      r.oculto=tip.hidden;
      r.claro=getComputedStyle(el.querySelector('path.cg-ventas')).stroke;
      document.body.classList.add('dark');
      r.oscuro=getComputedStyle(el.querySelector('path.cg-ventas')).stroke;
      document.body.classList.remove('dark');
      return r;
    },{VENTAS,FIN,CLIENTES});
    assert.equal(grafica.lineas,2);
    assert.equal(grafica.puntos,24);
    assert.deepEqual(grafica.leyenda,['Ventas','Utilidad bruta']);
    assert.deepEqual(grafica.etiquetas,['Ventas','Utilidad'],'Cada línea tiene su nombre al final');
    assert.deepEqual(grafica.meses,['dic','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov']);
    assert.equal(grafica.filasTabla,12);
    assert.deepEqual(grafica.kpis.slice(0,4),['C$ 100.00','C$ 60.00','C$ 40.00','C$ 30.00']);
    assert.deepEqual(grafica.periodos,['Este mes','Mes anterior','Este año','Año anterior','Todo']);
    assert.match(grafica.tooltip,/^Noviembre de 2026 Ventas C\$ 100\.00 Utilidad bruta C\$ 40\.00 1 venta$/);
    assert.equal(grafica.cruz,'visible');
    assert.equal(grafica.oculto,true);
    assert.equal(grafica.claro,'rgb(37, 99, 235)');
    assert.equal(grafica.oscuro,'rgb(59, 130, 246)');

    // ── Reportes (PDF) ──
    const rep=await page.evaluate(({VENTA_CRED,CLIENTES,INV,LOTES,PROV})=>{
      const v1=fromVenta({...VENTA_CRED,venta_cobros:[{id:1,fecha:'2026-11-01',monto:15,metodo_pago:'efectivo'}]});
      const v2=fromVenta({...VENTA_CRED,id:301,numero:'V-000011',fecha:'2026-11-10',vencimiento:'2026-12-10',subtotal:200,iva:30,total:230});
      const v3=fromVenta({...VENTA_CRED,id:302,numero:'V-000012',cliente_id:null,condicion:'contado',vencimiento:null,fecha:'2026-11-12',subtotal:50,iva:0,total:50,venta_cobros:[{id:3,fecha:'2026-11-12',monto:50}]});
      __estado({periodo:'mes',tab:'reportes',C:{ventas:[v1,v2,v3],cliCom:CLIENTES,inv:INV,lotes:LOTES,prov:PROV,
        comp:[fromCompra({id:60,proveedor_id:7,fecha:'2026-11-02',subtotal:70,iva:10.5,iva_pct:15,total:80.5,condicion:'contado',estado:'registrada',compra_items:[],compra_pagos:[]})],
        fin:[{id:1,tipo:'egreso',categoria:'pago_iva',monto:5,fecha:'2026-11-12'}]}});
      renderContabilidad();
      const tarjetas=[...document.querySelectorAll('.cont-reporte strong')].map(s=>s.textContent);
      __pdf.length=0;
      imprimirEstadoResultados(); imprimirBalanceGeneral(); imprimirReporteVentas(); imprimirCuentasPorCobrar(); imprimirEstadoCuenta(21);
      imprimirGananciaProductos(); imprimirReporteIva(); imprimirExistenciasLotes(); imprimirVenta(300);
      const texto=b=>{const d=document.createElement('div');d.innerHTML=b;return d.textContent.replace(/\s+/g,' ');};
      return {tarjetas,pdf:__pdf.map(p=>({titulo:p.titulo,texto:texto(p.body)}))};
    },{VENTA_CRED,CLIENTES,INV,LOTES,PROV});
    assert.equal(rep.tarjetas.length,9);
    const P=Object.fromEntries(rep.pdf.map(p=>[p.titulo.split(' — ')[0],p.texto]));
    assert.deepEqual(rep.pdf.map(p=>p.titulo),['Estado de resultados','Balance general','Reporte de ventas','Cuentas por cobrar','Estado de cuenta — Clínica Norte',
      'Ganancia por producto','Reporte de IVA','Existencias por lote','Venta V-000010 — Clínica Norte']);
    assert.match(P['Estado de resultados'],/Ventas netas \(2\)C\$ 250\.00/,'Solo noviembre: V-000011 y V-000012');
    assert.match(P['Reporte de ventas'],/Total \(sin anuladas\)C\$ 250\.00C\$ 30\.00C\$ 280\.00C\$ 50\.00C\$ 230\.00/);
    assert.match(P['Cuentas por cobrar'],/C\$ 330\.00Total por cobrar/);
    assert.match(P['Cuentas por cobrar'],/Clínica Norte(C\$ 230\.00)C\$ 100\.00—(—)+C\$ 330\.00/,'230 por vencer y 100 vencidos 1–30 días');
    assert.match(P['Estado de cuenta'],/2026-10-01Venta V-000010.*C\$ 115\.00C\$ 115\.00.*2026-11-01Cobro V-000010.*C\$ 15\.00C\$ 100\.00.*2026-11-10Venta V-000011.*C\$ 230\.00C\$ 330\.00/,'Cargo, abono y saldo corrido');
    assert.match(P['Estado de cuenta'],/TotalesC\$ 345\.00C\$ 15\.00C\$ 330\.00/);
    assert.match(P['Reporte de IVA'],/C\$ 30\.00IVA cobrado \(ventas\) ?C\$ 10\.50IVA pagado \(compras\) ?C\$ 19\.50IVA a pagar ?C\$ 5\.00Pagado a la DGI/);
    assert.match(P['Existencias por lote'],/Guantes de nitrilo ML-BProveedor A.*15 caja.*Sin lote/);
    assert.match(P['Venta V-000010'],/Comprobante de venta V-000010/);
    assert.match(P['Venta V-000010'],/RUC J031/);
    assert.match(P['Venta V-000010'],/L-A/);
    assert.match(P['Venta V-000010'],/Saldo pendiente: C\$ 100\.00/);
    assert.match(P['Balance general'],/Capital y saldos iniciales/);

    // ── Clínica con el módulo marcado: versión reducida con Finanzas e Inventario ──
    await page.setViewportSize({width:360,height:800});
    const clinica=await page.evaluate(()=>{
      document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
      document.getElementById('view-contabilidad').classList.add('active'); currentView='contabilidad';
      currentClinica={id:3,nombre:'Clínica Norte',tipo:'clinica'}; currentClinicaId=3;
      __estado({periodo:'mes',tab:'ventas',C:{ventas:[],cliCom:[],lotes:[],prov:[{id:7,nombre:'Proveedor A',activo:true}],
        inv:[{id:1,nombre:'Guantes',unidad:'caja',stock:30,costo:6,precio:10}],
        mov:[{id:1,invId:1,tipo:'salida',cantidad:10,fecha:'2026-11-03',motivo:'Uso en consulta'},
             {id:2,invId:1,tipo:'salida',cantidad:5,fecha:'2026-11-04',motivo:'Anulación de compra a Proveedor A'},
             {id:3,invId:1,tipo:'entrada',cantidad:40,fecha:'2026-11-02',motivo:'Compra a Proveedor A'},
             {id:4,invId:1,tipo:'salida',cantidad:2,fecha:'2026-10-20',motivo:'Uso en consulta'}],
        fin:[{id:1,tipo:'ingreso',categoria:'consulta',monto:1000,fecha:'2026-11-05'},{id:2,tipo:'ingreso',categoria:'factura',monto:500,fecha:'2026-11-06'},
             {id:3,tipo:'egreso',categoria:'alquiler',monto:300,fecha:'2026-11-01'},{id:4,tipo:'egreso',categoria:'compras',monto:200,fecha:'2026-11-02'},
             {id:5,tipo:'egreso',categoria:'pago_profesional',monto:200,fecha:'2026-11-07'}],
        comp:[fromCompra({id:80,proveedor_id:7,fecha:'2026-11-02',subtotal:400,iva:0,total:400,condicion:'credito',vencimiento:'2026-12-02',estado:'registrada',
          compra_items:[],compra_pagos:[{id:1,fecha:'2026-11-02',monto:200}]})]}});
      renderContabilidad();
      const ver=id=>getComputedStyle(document.getElementById(id)).display!=='none';
      const er=_estadoResultados();
      const r={tab:contTab,tabs:['resumen','ventas','cobrar','clientes','resultados','balance','reportes'].filter(t=>ver('tab-cont-'+t)),
        botones:[ver('btn-cont-cliente'),ver('btn-cont-venta')],nota:document.querySelector('#cont-aviso .cont-modo-nota')?.textContent||'',
        er:[er.ingresosVentas,er.costoVentas,er.totOtros,er.totGastos,er.bruta,er.neta],
        kpis:[...document.querySelectorAll('.cont-kpis h3')].map(h=>h.textContent),
        leyenda:[...document.querySelectorAll('.cg-leyenda span')].map(s=>s.textContent),
        etiquetas:[...document.querySelectorAll('#cont-grafica .cg-etiqueta')].map(t=>t.textContent),
        serie:_serieMensual(12).slice(-2)};
      switchContTab('cobrar'); r.cobrar=contTab;
      switchContTab('resultados'); r.resultados=document.getElementById('cont-panel-resultados').textContent.replace(/\s+/g,' ');
      switchContTab('balance'); r.balance=document.getElementById('cont-panel-balance').textContent.replace(/\s+/g,' ');
      switchContTab('reportes'); r.reportes=[...document.querySelectorAll('#cont-panel-reportes .cont-reporte strong')].map(s=>s.textContent);
      const fuera=[];
      for(const t of ['resumen','resultados','balance','reportes']) {
        switchContTab(t);
        fuera.push(...[...document.querySelectorAll('#view-contabilidad *')].filter(e=>{const b=e.getBoundingClientRect();return b.width&&b.right>innerWidth+1&&!e.closest('.tabs,.cg-tooltip');})
          .map(e=>t+': '+((e.className?.baseVal??e.className)||e.tagName)));
      }
      r.fuera=fuera.slice(0,4);
      r.visibles=document.getElementById('cont-panel-reportes').getBoundingClientRect().width>0;
      __pdf.length=0; imprimirEstadoResultados();
      const d=document.createElement('div'); d.innerHTML=__pdf[0].body; r.pdf=d.textContent.replace(/\s+/g,' ');
      currentClinica={id:9,nombre:'Distribuidora Demo',tipo:'empresa_medica'}; currentClinicaId=9; contTab='resumen'; renderContabilidad();
      r.vuelve={tabs:['ventas','cobrar','clientes'].every(t=>ver('tab-cont-'+t)),boton:ver('btn-cont-venta'),nota:!!document.querySelector('#cont-aviso .cont-modo-nota')};
      return r;
    });
    assert.equal(clinica.tab,'resumen','Ventas no existe en una clínica: se abre el resumen');
    assert.deepEqual(clinica.tabs,['resumen','resultados','balance','reportes']);
    assert.deepEqual(clinica.botones,[false,false],'Sin «+ Cliente» ni «+ Nueva venta»');
    assert.match(clinica.nota,/^Versión para clínicas/);
    assert.deepEqual(clinica.er,[0,60,1500,500,1440,940],'Ingresos de Finanzas; costo = 10 usadas a C$ 6 (la anulación no cuenta); sin el pago de compras');
    assert.deepEqual(clinica.kpis,['C$ 1500.00','C$ 60.00','C$ 500.00','C$ 940.00','C$ 200.00','C$ 180.00']);
    assert.deepEqual(clinica.leyenda,['Ingresos','Utilidad neta']);
    assert.deepEqual(clinica.etiquetas,['Ingresos','Utilidad']);
    assert.deepEqual(clinica.serie,[{mes:'2026-10',ventas:0,utilidad:-12,n:null},{mes:'2026-11',ventas:1500,utilidad:940,n:null}]);
    assert.equal(clinica.cobrar,'resumen','Por cobrar no existe en una clínica');
    assert.match(clinica.resultados,/Total ingresosC\$ 1500\.00/);
    assert.match(clinica.resultados,/\(−\) Costo de lo usado del inventario/);
    assert.doesNotMatch(clinica.resultados,/Ventas netas/);
    assert.doesNotMatch(clinica.balance,/Cuentas por cobrar/);
    assert.match(clinica.balance,/a costo promedio/);
    assert.deepEqual(clinica.reportes,['Estado de resultados','Balance general','Cuentas por pagar']);
    assert.equal(clinica.visibles,true,'La vista medida está en pantalla');
    assert.deepEqual(clinica.fuera,[],'La versión reducida cabe en 360px');
    assert.match(clinica.pdf,/Total ingresosC\$ 1500\.00/);
    assert.match(clinica.pdf,/Utilidad neta del períodoC\$ 940\.00/);
    assert.deepEqual(clinica.vuelve,{tabs:true,boton:true,nota:false},'En la empresa vuelve completo');
    await page.evaluate(()=>{currentClinica={id:3,nombre:'Clínica Norte',tipo:'clinica'};currentClinicaId=3;contTab='resumen';renderContabilidad();window.scrollTo(0,0);});
    await page.screenshot({path:path.join(process.env.TEMP||'/tmp','cont-clinica-360.png'),fullPage:true,animations:'disabled'});
    await page.evaluate(()=>{switchContTab('resultados');window.scrollTo(0,0);});
    await page.screenshot({path:path.join(process.env.TEMP||'/tmp','cont-clinica-resultados-360.png'),fullPage:true,animations:'disabled'});
    await page.evaluate(()=>{currentClinica={id:9,nombre:'Distribuidora Demo',tipo:'empresa_medica'};currentClinicaId=9;contTab='resumen';renderContabilidad();});
    await page.setViewportSize({width:1280,height:900});

    // ── Clientes: sin repetir y con sus días de crédito ──
    const cli=await page.evaluate(async({CLIENTES})=>{
      __estado({C:{cliCom:CLIENTES,ventas:[]}});
      abrirClienteCom(); document.getElementById('cli-com-nombre').value=' clínica norte ';
      await guardarClienteCom(); const repetido=__toasts.at(-1)[0];
      document.getElementById('cli-com-nombre').value='Farmacia Sur'; document.getElementById('cli-com-dias').value='15';
      __llamadas.length=0; await guardarClienteCom();
      return {repetido,insert:__llamadas.find(q=>q.t==='clientes_comerciales')?.datos};
    },{CLIENTES});
    assert.equal(cli.repetido,'error');
    assert.deepEqual([cli.insert.nombre,cli.insert.dias_credito,cli.insert.clinica_id,cli.insert.activo],['Farmacia Sur',15,9,true]);

    // ── Cómo se ve: cada pestaña y el formulario, en teléfono y escritorio ──
    for(const w of [360,390,430,1280]) {
      await page.setViewportSize({width:w,height:900});
      const m=await page.evaluate(({VENTA_CRED,CLIENTES,INV,LOTES,VENTAS,FIN})=>{
        document.querySelectorAll('.modal-overlay.open').forEach(x=>x.classList.remove('open'));
        const v1=fromVenta(VENTA_CRED), v2=fromVenta({...VENTA_CRED,id:301,numero:'V-000011',fecha:'2026-11-10',vencimiento:'2026-12-10'});
        __estado({periodo:'mes',C:{ventas:[v1,v2,...VENTAS.map(fromVenta)],cliCom:CLIENTES,inv:INV,lotes:LOTES,fin:FIN,comp:[]}});
        const fuera=el=>[...el.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>Math.min(innerWidth,el.getBoundingClientRect().right)+1&&!e.closest('.tabs,.cg-tooltip');}).map(e=>(e.className?.baseVal??e.className)||e.tagName).slice(0,4);
        const r={};
        for(const t of ['resumen','ventas','cobrar','clientes','resultados','balance','reportes']) {
          contTab=t; renderContabilidad();
          r[t]=fuera(document.getElementById('view-contabilidad'));
          r['activa-'+t]=[...document.querySelectorAll('#view-contabilidad .tab.active')].map(x=>x.id).filter(id=>id!=='tab-cont-'+t);
        }
        abrirNuevaVenta(); document.getElementById('venta-cliente').value='21';
        document.getElementById('venta-condicion').value='credito'; _ajustarCondicionVenta(true);
        document.getElementById('venta-con-iva').checked=true; _ajustarIvaVenta();
        cambiarLineaVenta(_lineasV()[0].id,'invId','1'); cambiarLineaVenta(_lineasV()[0].id,'cantidad','12'); agregarLineaVenta();
        r.venta=fuera(document.querySelector('#modal-venta .modal'));
        document.getElementById('modal-venta').classList.remove('open');
        abrirCobroVenta(300);
        r.cobro=fuera(document.querySelector('#modal-cobro-venta .modal'));
        document.getElementById('modal-cobro-venta').classList.remove('open');
        r.scroll=document.documentElement.scrollWidth-innerWidth;
        return r;
      },{VENTA_CRED,CLIENTES,INV,LOTES,VENTAS,FIN});
      for(const [k,v] of Object.entries(m)) if(k!=='scroll') assert.deepEqual(v,[],`${k} cabe en ${w}px`);
      assert.ok(m.scroll<=0,`Sin scroll horizontal a ${w}px`);
      const tmp=process.env.TEMP||'/tmp';
      for(const t of ['resumen','cobrar','resultados','balance']) {
        await page.evaluate(t=>{contTab=t;renderContabilidad();window.scrollTo(0,0);},t);
        await page.screenshot({path:path.join(tmp,`cont-${t}-${w}.png`),fullPage:true});
      }
      await page.evaluate(()=>{abrirNuevaVenta();document.getElementById('venta-cliente').value='21';document.getElementById('venta-condicion').value='credito';_ajustarCondicionVenta(true);
        document.getElementById('venta-con-iva').checked=true;_ajustarIvaVenta();cambiarLineaVenta(_lineasV()[0].id,'invId','1');const qi=document.querySelectorAll('#venta-lineas input')[0];qi.value='12';qi.dispatchEvent(new Event('input'));
        const md=document.querySelector('#modal-venta .modal'); md.scrollTop=document.getElementById('venta-lineas').offsetTop-120;});
      await page.waitForTimeout(450);   // el formulario entra con una animación
      await page.evaluate(()=>{const md=document.querySelector('#modal-venta .modal'); md.scrollTop=document.getElementById('venta-lineas').offsetTop-160;});
      await page.screenshot({path:path.join(tmp,`cont-venta-${w}.png`),fullPage:false});
      await page.evaluate(()=>document.getElementById('modal-venta').classList.remove('open'));
      console.log(`Contabilidad ${w}px: ${tmp}/cont-*-${w}.png`);
    }
    console.log('OK: migración, lotes FIFO, venta de contado y al crédito, IVA manual, número único, cobros, anulación, compra con lotes, salida, kardex, resultados, balance, gráfica, reportes, clientes y layout.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
