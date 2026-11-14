// Compras a proveedores: contado y crédito, con y sin IVA, pagos, costo
// promedio, anulación, reportes y respaldo. Supabase está simulado: se anota
// cada escritura. Ejecutar con PLAYWRIGHT_MODULE (y PLAYWRIGHT_CHROMIUM).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
const sql=fs.readFileSync(path.join(root,'migracion_compras_proveedores.sql'),'utf8');

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
  let currentUser={id:'u1',name:'Ana'}, currentClinicaId=9, currentClinica={id:9,tipo:'empresa_medica'};
  window.__toasts=[]; window.__llamadas=[]; window.__pdf=[]; let __id=100; window.__fallar=null;
  const toast=(m,t='success')=>__toasts.push([t,m]);
  const setLoading=()=>{};
  const _exigeClinica=()=>!!currentClinicaId;
  const _faltaColumna=(e,c)=>String(e?.message||'').includes(c);
  const loadAll=async()=>{}; const renderInventario=()=>{};
  let __confirmar=true; const customConfirm=async()=>__confirmar;
  const closeModal=id=>{document.getElementById(id).classList.remove('open');};
  const openModalCompra=()=>__llamadas.push({t:'entrada-antigua'});
  const switchInvTab=()=>{};
  const pdfAbrir=(titulo,body)=>__pdf.push({titulo,body});
  const formatFecha=f=>f;
  const hoy=()=>'2026-11-14';
  const escAttr=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtC=n=>'C$ '+Number(n||0).toFixed(2);
  ${extraer('fechaLocal')}
  ${extraer('_lumiNormal')}
  ${extraer('openModalOverlay')}
  // Supabase simulado: cada consulta se anota; con select().single() devuelve una fila con id nuevo.
  const sb={from(t){
    const q={t,op:'select',datos:null,filtros:[]};
    const b={insert(d){q.op='insert';q.datos=d;return b;},update(d){q.op='update';q.datos=d;return b;},delete(){q.op='delete';return b;},
      select(){return b;},single(){q.single=true;return b;},eq(c,v){q.filtros.push([c,v]);return b;},order(){return b;},limit(){return b;},
      then(ok,ko){__llamadas.push(q);
        if(__fallar&&__fallar(q)) return Promise.resolve({data:null,error:{message:__fallar(q)}}).then(ok,ko);
        const data=q.single?{id:++__id,...(Array.isArray(q.datos)?{}:q.datos)}:null;
        return Promise.resolve({data,error:null}).then(ok,ko);}};
    return b;}};
  const C={inv:[],prov:[],comp:[],mov:[],fin:[],lotes:[],ventas:[],cliCom:[]};
  ${bloque('const fromProv','const fromMov')}
  ${bloque('let _comprasDisponibles','// ════════════════════ CATÁLOGO INVENTARIO')}
  ${extraer('_pctMargen')}
  ${extraer('_margenProducto')}
  // Los lotes de la empresa médica se prueban en contabilidad.cjs.
  const esEmpresaMedica=()=>false; _contabilidadDisponible=false;
  window.__estado=(o)=>{ Object.assign(C,o.C||{}); if('confirmar' in o) __confirmar=o.confirmar; if('disponibles' in o) _comprasDisponibles=o.disponibles; if('periodo' in o) comprasPeriodo=o.periodo; };
  Object.assign(window,{C,_costoPromedio,_pctMargen,abrirNuevaCompra,agregarLineaCompra,cambiarLineaCompra,guardarCompra,anularCompra,verCompra,
    renderCompras,renderProveedores,guardarProveedor,abrirProveedor,_margenProducto,_lineas:()=>_lineasCompra,_ajustarCondicionCompra,_ajustarIvaCompra,
    abrirPagoCompra,guardarPagoCompra,_saldoCompra,_pagadoCompra,_estadoPagoCompra,imprimirReporteCompras,imprimirCuentasPorPagar,imprimirCompra,imprimirProveedores,fromCompra});
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
    document.getElementById('view-inventario').classList.add('active');
  });
};
const INV=[{id:1,nombre:'Guantes de nitrilo M',unidad:'caja',stock:10,stockMin:5,costo:5,precio:8,categoria:'material'},
           {id:2,nombre:'Jeringas 5 ml',unidad:'unidad',stock:0,stockMin:0,costo:null,precio:3,categoria:'material'}];
const PROV=[{id:7,nombre:'Proveedor A',activo:true,telefono:'8888 0000'},{id:8,nombre:'Viejo',activo:false}];
// Rellena el formulario de compra: [[invId, cantidad, costo], ...]
const llenar=`(lineas)=>{ lineas.forEach(([inv,cant,costo],i)=>{ if(i) agregarLineaCompra(); const l=_lineas()[i];
  cambiarLineaCompra(l.id,'invId',String(inv)); cambiarLineaCompra(_lineas()[i].id,'cantidad',String(cant)); cambiarLineaCompra(_lineas()[i].id,'costo',String(costo)); }); }`;

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await abrir(page);
    await page.evaluate(`window.__llenar=${llenar}`);

    // ── Migración: tablas con RLS, pagos, IVA y crédito ──
    for(const t of ['proveedores','compras','compra_items','compra_pagos']) {
      assert.match(sql,new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`),`${t} sin RLS`);
      assert.match(sql,new RegExp(`CREATE POLICY "${t}_clinica"`),`${t} sin política`);
    }
    for(const col of ['subtotal','iva','iva_pct','condicion','vencimiento']) assert.match(sql,new RegExp(`ADD COLUMN IF NOT EXISTS ${col}\\b`));
    assert.match(fs.readFileSync(path.join(root,'rls_setup.sql'),'utf8'),/'proveedores','compras','compra_items','compra_pagos'/);
    assert.match(source,/\{tabla:'compras', opcional:true, select:'\*,compra_items\(\*\),compra_pagos\(\*\)'\}/,'Las compras van en el respaldo');
    assert.match(source,/proveedores:t\.proveedores\|\|\[\], compras:t\.compras\|\|\[\]/);

    // ── Costo promedio y margen ──
    const calc=await page.evaluate(()=>({
      promedio:_costoPromedio(10,5,10,7), sinPrevio:_costoPromedio(0,null,100,1.5), sinStock:_costoPromedio(0,9,4,6),
      negativo:_costoPromedio(-3,5,10,7), margen:_pctMargen(6,8), sinCosto:_pctMargen(null,8),
    }));
    assert.deepEqual(calc,{promedio:6,sinPrevio:1.5,sinStock:6,negativo:7,margen:'25 %',sinCosto:'—'});

    // ── Compra de contado, sin IVA ──
    const contado=await page.evaluate(async({INV,PROV})=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV)),prov:PROV,comp:[]}});
      abrirNuevaCompra();
      const provs=[...document.querySelectorAll('#compra-proveedor option')].map(o=>o.textContent);
      __llamadas.length=0; await guardarCompra();
      const sinProveedor={toast:__toasts.at(-1)[0],llamadas:__llamadas.length};
      document.getElementById('compra-proveedor').value='7';
      document.getElementById('compra-numero').value='F-123';
      cambiarLineaCompra(_lineas()[0].id,'invId','1');
      const costoPropuesto=_lineas()[0].costo;
      __llenar([[1,10,7],[2,100,1.5],[1,5,4]]);
      const ui={total:document.getElementById('compra-total').textContent,ivaOculto:document.getElementById('compra-iva-linea').hidden,
        venceOculto:document.getElementById('compra-vence-wrap').hidden,margen:document.querySelector('.compra-linea-margen')?.textContent};
      __llamadas.length=0; await guardarCompra();
      return {provs,sinProveedor,costoPropuesto,ui,llamadas:JSON.parse(JSON.stringify(__llamadas)),toast:__toasts.at(-1)};
    },{INV,PROV});
    assert.deepEqual(contado.provs,['Elige el proveedor…','Proveedor A'],'Un proveedor inactivo no se ofrece');
    assert.deepEqual(contado.sinProveedor,{toast:'error',llamadas:0});
    assert.equal(contado.costoPropuesto,5,'Se propone el costo actual del producto');
    assert.deepEqual([contado.ui.total,contado.ui.ivaOculto,contado.ui.venceOculto],['C$ 240.00',true,true]);
    assert.match(contado.ui.margen,/Lo vendes a C\$ 8\.00 · margen 12[.,]5 %/);
    const de=(ll,t,op)=>ll.filter(q=>q.t===t&&q.op===op);
    const cab=de(contado.llamadas,'compras','insert')[0].datos;
    assert.deepEqual([cab.proveedor_id,cab.subtotal,cab.iva,cab.total,cab.condicion,cab.vencimiento,cab.metodo_pago],[7,240,0,240,'contado',null,'efectivo']);
    assert.equal(de(contado.llamadas,'compra_items','insert')[0].datos.length,3);
    const inv=Object.fromEntries(de(contado.llamadas,'inventario','update').map(q=>[q.filtros[0][1],q.datos]));
    assert.deepEqual(inv[1],{stock_actual:25,costo_unitario:5.6},'Guantes: 10 a 5, +10 a 7, +5 a 4 → 25 a 5,60');
    assert.deepEqual(inv[2],{stock_actual:100,costo_unitario:1.5});
    assert.equal(de(contado.llamadas,'inventario_movimientos','insert').flatMap(q=>q.datos).length,3);
    const pago=de(contado.llamadas,'compra_pagos','insert')[0].datos;
    assert.deepEqual([pago.monto,pago.metodo_pago],[240,'efectivo'],'De contado nace con un pago por el total');
    const gasto=de(contado.llamadas,'finanzas','insert')[0].datos;
    assert.deepEqual([gasto.tipo,gasto.categoria,gasto.monto,gasto.descripcion],['egreso','compras',240,'Pago a Proveedor A (fact. F-123)']);
    assert(de(contado.llamadas,'compra_pagos','update').some(q=>q.datos.finanzas_id),'El pago recuerda su gasto');
    assert.equal(contado.toast[0],'success');

    // ── Con IVA: el costo del producto se lleva sin IVA ──
    const conIva=await page.evaluate(async({INV,PROV})=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV)),prov:PROV,comp:[]}});
      abrirNuevaCompra(); document.getElementById('compra-proveedor').value='7';
      document.getElementById('compra-con-iva').checked=true; _ajustarIvaCompra();
      __llenar([[2,100,1]]);
      const ui={sub:document.getElementById('compra-subtotal').textContent,iva:document.getElementById('compra-iva').textContent,lbl:document.getElementById('compra-iva-lbl').textContent,total:document.getElementById('compra-total').textContent};
      __llamadas.length=0; await guardarCompra();
      return {ui,llamadas:JSON.parse(JSON.stringify(__llamadas))};
    },{INV,PROV});
    assert.deepEqual(conIva.ui,{sub:'C$ 100.00',iva:'C$ 15.00',lbl:'IVA (15 %)',total:'C$ 115.00'});
    const cabIva=de(conIva.llamadas,'compras','insert')[0].datos;
    assert.deepEqual([cabIva.subtotal,cabIva.iva,cabIva.iva_pct,cabIva.total],[100,15,15,115]);
    assert.equal(de(conIva.llamadas,'inventario','update')[0].datos.costo_unitario,1,'El IVA no entra en el costo del producto');
    assert.equal(de(conIva.llamadas,'finanzas','insert')[0].datos.monto,115,'Se paga el total con IVA');

    // ── Al crédito: sin pagos ni gasto hasta que se pague ──
    const credito=await page.evaluate(async({INV,PROV})=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV)),prov:PROV,comp:[]}});
      abrirNuevaCompra(); document.getElementById('compra-proveedor').value='7';
      document.getElementById('compra-condicion').value='credito'; _ajustarCondicionCompra();
      const visto=id=>getComputedStyle(document.getElementById(id)).display!=='none';
      const ui={vence:document.getElementById('compra-vencimiento').value,metodoOculto:!visto('compra-metodo-wrap'),gastoOculto:!visto('compra-gasto-wrap'),venceVisible:visto('compra-vence-wrap')};
      __llenar([[1,4,6]]);
      document.getElementById('compra-vencimiento').value='2026-11-01'; __llamadas.length=0; await guardarCompra();
      const venceAntes={toast:__toasts.at(-1)[0],llamadas:__llamadas.length};
      document.getElementById('compra-vencimiento').value='2026-12-14'; __llamadas.length=0; await guardarCompra();
      return {ui,venceAntes,llamadas:JSON.parse(JSON.stringify(__llamadas)),toast:__toasts.at(-1)[1]};
    },{INV,PROV});
    assert.deepEqual(credito.ui,{vence:'2026-12-14',metodoOculto:true,gastoOculto:true,venceVisible:true},'A crédito: vence a los 30 días y no se pide forma de pago (de verdad oculta)');
    assert.deepEqual(credito.venceAntes,{toast:'error',llamadas:0},'No vence antes de la compra');
    const cabCred=de(credito.llamadas,'compras','insert')[0].datos;
    assert.deepEqual([cabCred.condicion,cabCred.vencimiento,cabCred.metodo_pago],['credito','2026-12-14','credito']);
    assert.equal(credito.llamadas.filter(q=>q.t==='compra_pagos'||q.t==='finanzas').length,0);
    assert.match(credito.toast,/queda por pagar/);
    assert.equal(de(credito.llamadas,'inventario','update').length,1,'El stock entra aunque no se haya pagado');

    // Sin las columnas nuevas no se guarda una compra a medias
    const sinColumnas=await page.evaluate(async({INV,PROV})=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV)),prov:PROV}});
      abrirNuevaCompra(); document.getElementById('compra-proveedor').value='7'; __llenar([[1,1,5]]);
      window.__fallar=q=>q.t==='compras'&&q.op==='insert'?'column "condicion" of relation "compras" does not exist':null;
      __llamadas.length=0; await guardarCompra(); window.__fallar=null;
      return {toast:__toasts.at(-1),abierto:document.getElementById('modal-compra').classList.contains('open'),otras:__llamadas.filter(q=>q.t!=='compras').length};
    },{INV,PROV});
    assert.equal(sinColumnas.toast[0],'error');
    assert.match(sinColumnas.toast[1],/migracion_compras_proveedores\.sql/);
    assert.deepEqual([sinColumnas.abierto,sinColumnas.otras],[true,0]);

    // ── Pagos: parcial, de más y estados ──
    const COMPRA_CRED={id:200,proveedor_id:7,fecha:'2026-10-01',numero_factura:'C-9',metodo_pago:'credito',total:115,subtotal:100,iva:15,iva_pct:15,condicion:'credito',vencimiento:'2026-10-31',estado:'registrada',compra_items:[{id:1,inventario_id:2,descripcion:'Jeringas',cantidad:100,costo_unitario:1,subtotal:100}],compra_pagos:[]};
    const pagos=await page.evaluate(async({COMPRA_CRED,PROV})=>{
      const c=fromCompra(COMPRA_CRED);
      __estado({C:{prov:PROV,comp:[c]}});
      const r={estado:_estadoPagoCompra(c),saldo:_saldoCompra(c)};
      abrirPagoCompra(200);
      r.montoPropuesto=document.getElementById('pago-compra-monto').value;
      document.getElementById('pago-compra-monto').value='200'; __llamadas.length=0; await guardarPagoCompra();
      r.deMas={toast:__toasts.at(-1)[0],llamadas:__llamadas.length};
      abrirPagoCompra(200); document.getElementById('pago-compra-monto').value='50'; document.getElementById('pago-compra-metodo').value='transferencia';
      document.getElementById('pago-compra-referencia').value='TR-77'; __llamadas.length=0; await guardarPagoCompra();
      r.llamadas=JSON.parse(JSON.stringify(__llamadas)); r.toast=__toasts.at(-1);
      // Con ese pago guardado: parcial; y otro por el resto: pagada
      const parcial=fromCompra({...COMPRA_CRED,vencimiento:'2026-12-31',compra_pagos:[{id:1,fecha:'2026-11-14',monto:50,metodo_pago:'transferencia'}]});
      const pagada=fromCompra({...COMPRA_CRED,compra_pagos:[{id:1,fecha:'2026-11-14',monto:50},{id:2,fecha:'2026-11-15',monto:65}]});
      const anulada=fromCompra({...COMPRA_CRED,estado:'anulada'});
      const contadoViejo=fromCompra({...COMPRA_CRED,condicion:'contado',vencimiento:null});
      r.estados=[_estadoPagoCompra(parcial),_saldoCompra(parcial),_estadoPagoCompra(pagada),_saldoCompra(anulada),_saldoCompra(contadoViejo)];
      return r;
    },{COMPRA_CRED,PROV});
    assert.deepEqual([pagos.estado,pagos.saldo,pagos.montoPropuesto],['vencida',115,'115'],'Vencida y con todo por pagar');
    assert.deepEqual(pagos.deMas,{toast:'error',llamadas:0},'No se paga más de lo que se debe');
    const pp=de(pagos.llamadas,'compra_pagos','insert')[0].datos;
    assert.deepEqual([pp.compra_id,pp.monto,pp.metodo_pago,pp.referencia],[200,50,'transferencia','TR-77']);
    assert.equal(de(pagos.llamadas,'finanzas','insert')[0].datos.monto,50,'Cada pago es un gasto en Finanzas');
    assert.match(pagos.toast[1],/falta C\$ 65\.00/);
    assert.deepEqual(pagos.estados,['parcial',65,'pagada',0,0]);

    // ── Anular: stock, costo y todos los gastos de sus pagos ──
    const anular=await page.evaluate(async()=>{
      __estado({confirmar:true,C:{inv:[{id:1,nombre:'Guantes de nitrilo M',unidad:'caja',stock:25,costo:5.6,precio:8},{id:2,nombre:'Jeringas 5 ml',unidad:'unidad',stock:100,costo:1.5,precio:3}],
        comp:[fromCompra({id:101,proveedor_id:7,fecha:'2026-11-14',numero_factura:'F-123',total:240,subtotal:240,condicion:'credito',estado:'registrada',finanzas_id:null,
          compra_items:[{id:1,inventario_id:1,descripcion:'Guantes',cantidad:10,costo_unitario:7,subtotal:70},{id:2,inventario_id:2,descripcion:'Jeringas',cantidad:100,costo_unitario:1.5,subtotal:150},{id:3,inventario_id:1,descripcion:'Guantes',cantidad:5,costo_unitario:4,subtotal:20}],
          compra_pagos:[{id:1,fecha:'2026-11-14',monto:100,finanzas_id:555},{id:2,fecha:'2026-11-20',monto:40,finanzas_id:556}]})]}});
      verCompra(101);
      const detalle={filas:document.querySelectorAll('.compra-detalle-tabla tbody tr').length,pagos:document.querySelectorAll('.compra-pagos>div').length,
        botones:[...document.querySelectorAll('#compra-detalle-acciones .btn')].map(b=>b.textContent)};
      __llamadas.length=0; await anularCompra(101);
      return {detalle,llamadas:JSON.parse(JSON.stringify(__llamadas))};
    });
    assert.deepEqual(anular.detalle,{filas:3,pagos:2,botones:['Cerrar','🖨️ Imprimir','❌ Anular','💵 Registrar pago']});
    const inv2=Object.fromEntries(de(anular.llamadas,'inventario','update').map(q=>[q.filtros[0][1],q.datos]));
    assert.deepEqual(inv2[1],{stock_actual:10,costo_unitario:5},'Guantes vuelve a 10 a C$ 5');
    assert.deepEqual(inv2[2],{stock_actual:0,costo_unitario:1.5});
    assert.deepEqual(de(anular.llamadas,'finanzas','delete').map(q=>q.filtros[0][1]),[555,556],'Se borran los gastos de todos sus pagos');
    assert(anular.llamadas.some(q=>q.t==='compras'&&q.op==='update'&&q.datos.estado==='anulada'));

    // ── Reportes ──
    const rep=await page.evaluate(()=>{
      const mk=(o)=>fromCompra({proveedor_id:7,numero_factura:'',metodo_pago:'efectivo',estado:'registrada',compra_items:[{id:1,inventario_id:1,descripcion:'Guantes',cantidad:1,costo_unitario:1,subtotal:1}],compra_pagos:[],...o});
      __estado({periodo:'mes',C:{prov:[{id:7,nombre:'Proveedor A',activo:true,telefono:'8888 0000',identificacion:'J031'},{id:8,nombre:'Droguería Central',activo:true}],
        comp:[mk({id:1,fecha:'2026-11-02',total:115,subtotal:100,iva:15,iva_pct:15,condicion:'credito',vencimiento:'2026-11-10'}),
              mk({id:2,proveedor_id:8,fecha:'2026-11-05',total:200,subtotal:200,condicion:'contado'}),
              mk({id:3,fecha:'2026-10-20',total:50,subtotal:50,condicion:'credito',vencimiento:'2026-12-01',compra_pagos:[{id:9,fecha:'2026-10-25',monto:20}]})]}});
      renderCompras();
      __pdf.length=0;
      imprimirReporteCompras(); imprimirCuentasPorPagar(); imprimirCompra(1); imprimirProveedores();
      const texto=b=>{const d=document.createElement('div');d.innerHTML=b;return d.textContent.replace(/\s+/g,' ');};
      return {kpis:[...document.querySelectorAll('#compras-resumen h3')].map(e=>e.textContent),pdf:__pdf.map(p=>({titulo:p.titulo,texto:texto(p.body)}))};
    });
    assert.deepEqual(rep.kpis,['C$ 315.00','C$ 15.00','C$ 145.00'],'Comprado en el mes, su IVA, y todo lo pendiente (de cualquier mes)');
    const [rc,cxp,comp,dir]=rep.pdf;
    assert.equal(rc.titulo,'Reporte de compras');
    assert.match(rc.texto,/Del 2026-11-01 al 2026-11-14/);
    assert.match(rc.texto,/Total \(sin anuladas\)C\$ 300\.00C\$ 15\.00C\$ 315\.00C\$ 200\.00C\$ 115\.00/);
    assert.equal(cxp.titulo,'Cuentas por pagar');
    assert.match(cxp.texto,/C\$ 145\.00Total por pagar/);
    assert.match(cxp.texto,/C\$ 115\.00Vencido/);
    assert.match(cxp.texto,/Total a Proveedor AC\$ 145\.00/);
    assert.doesNotMatch(cxp.texto,/Droguería Central/,'Lo pagado no aparece');
    assert.match(comp.texto,/Comprobante de compra N\.º 1/);
    assert.match(comp.texto,/RUC J031/);
    assert.match(comp.texto,/IVA \(15 %\)C\$ 15\.00/);
    assert.match(comp.texto,/Pendiente de pago: C\$ 115\.00/);
    assert.match(dir.texto,/Droguería Central/);
    assert.match(dir.texto,/Proveedor A.*J031.*8888 0000/);

    // ── Proveedores ──
    const prov=await page.evaluate(async()=>{
      __estado({C:{prov:[{id:7,nombre:'Proveedor A',activo:true}],comp:[]}});
      abrirProveedor(); document.getElementById('prov-nombre').value='  proveedor a ';
      await guardarProveedor(); const repetido=__toasts.at(-1)[0];
      document.getElementById('prov-nombre').value='Droguería Central'; document.getElementById('prov-telefono').value='8888 0000';
      __llamadas.length=0; await guardarProveedor();
      return {repetido,insert:__llamadas.find(q=>q.t==='proveedores')?.datos,lista:C.prov.map(p=>p.nombre).sort()};
    });
    assert.equal(prov.repetido,'error','No se repite un proveedor con otro espacio o mayúscula');
    assert.deepEqual([prov.insert.nombre,prov.insert.telefono,prov.insert.clinica_id,prov.insert.activo],['Droguería Central','8888 0000',9,true]);
    assert.deepEqual(prov.lista,['Droguería Central','Proveedor A']);

    // Sin la migración, «Compra» abre la entrada de antes y avisa
    const sinTablas=await page.evaluate(()=>{ __estado({disponibles:false}); __llamadas.length=0; abrirNuevaCompra(); const r={antigua:__llamadas.some(q=>q.t==='entrada-antigua'),toast:__toasts.at(-1)[0]}; __estado({disponibles:true}); return r; });
    assert.deepEqual(sinTablas,{antigua:true,toast:'warning'});

    // Margen en el formulario de producto
    const margen=await page.evaluate(()=>{
      const leer=(c,p)=>{document.getElementById('prod-costo').value=c;document.getElementById('prod-precio').value=p;_margenProducto();const el=document.getElementById('prod-margen');return getComputedStyle(el).display==='none'?null:el.textContent;};
      return {bien:leer('6','8'),mal:leer('10','8'),vacio:leer('','8')};
    });
    assert.equal(margen.bien,'Ganas C$ 2.00 por unidad · margen 25 %');
    assert.match(margen.mal,/^Pierdes C\$ 2\.00/);
    assert.equal(margen.vacio,null);

    // ── Cómo se ve: lista, formulario con IVA y crédito, y pago, en teléfono y escritorio ──
    for(const w of [360,390,1280]) {
      await page.setViewportSize({width:w,height:900});
      const m=await page.evaluate(()=>{
        document.querySelectorAll('.modal-overlay.open').forEach(x=>x.classList.remove('open'));
        ['productos','movimientos','compras','proveedores','reportes'].forEach(t=>document.getElementById('inv-panel-'+t).style.display=t==='compras'?'block':'none');
        renderCompras();
        const fuera=el=>[...el.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>Math.min(innerWidth,el.getBoundingClientRect().right)+1;}).map(e=>e.className||e.tagName).slice(0,4);
        const r={fueraLista:fuera(document.getElementById('inv-panel-compras'))};
        abrirNuevaCompra(); agregarLineaCompra();
        document.getElementById('compra-con-iva').checked=true; _ajustarIvaCompra();
        document.getElementById('compra-condicion').value='credito'; _ajustarCondicionCompra();
        r.fueraCompra=fuera(document.querySelector('#modal-compra .modal'));
        document.getElementById('modal-compra').classList.remove('open');
        abrirPagoCompra(1);
        r.fueraPago=fuera(document.querySelector('#modal-pago-compra .modal'));
        r.scroll=document.documentElement.scrollWidth-innerWidth;
        document.getElementById('modal-pago-compra').classList.remove('open');
        abrirNuevaCompra(); agregarLineaCompra(); document.getElementById('compra-con-iva').checked=true; _ajustarIvaCompra();
        document.getElementById('compra-condicion').value='credito'; _ajustarCondicionCompra();
        return r;
      });
      assert.deepEqual(m.fueraLista,[],`La lista cabe en ${w}px`);
      assert.deepEqual(m.fueraCompra,[],`El formulario de compra cabe en ${w}px`);
      assert.deepEqual(m.fueraPago,[],`El pago cabe en ${w}px`);
      const dest=path.join(process.env.TEMP||'/tmp',`compras-${w}.png`);
      await page.screenshot({path:dest,fullPage:false});
      console.log(`Compra ${w}px: ${dest}`);
    }
    console.log('OK: migración, costo promedio, contado, IVA, crédito, sin columnas, pagos, vencidas, anulación, reportes, respaldo, proveedores y layout.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
