// Compras a proveedores: costo promedio, stock, gasto en Finanzas, anulación,
// validaciones y cómo se ve. Supabase está simulado: se anota cada escritura.
// Ejecutar con PLAYWRIGHT_MODULE (y PLAYWRIGHT_CHROMIUM si hace falta).
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');

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
  window.__toasts=[]; window.__llamadas=[]; let __id=100; window.__fallar=null;
  const toast=(m,t='success')=>__toasts.push([t,m]);
  const setLoading=()=>{};
  const _exigeClinica=()=>!!currentClinicaId;
  const loadAll=async()=>{}; const renderInventario=()=>{};
  let __confirmar=true; const customConfirm=async()=>__confirmar;
  const closeModal=id=>{document.getElementById(id).classList.remove('open');};
  const openModalCompra=()=>__llamadas.push({t:'entrada-antigua'});
  const switchInvTab=()=>{};
  const formatFecha=f=>f;
  const hoy=()=>'2026-11-14';
  const escAttr=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtC=n=>'C$ '+Number(n||0).toFixed(2);
  ${extraer('fechaLocal')}
  ${extraer('_lumiNormal')}
  ${extraer('openModalOverlay')}
  // Supabase simulado: cada consulta se anota; insert/update con select().single() devuelven una fila.
  const sb={from(t){
    const q={t,op:'select',datos:null,filtros:[]};
    const b={insert(d){q.op='insert';q.datos=d;return b;},update(d){q.op='update';q.datos=d;return b;},delete(){q.op='delete';return b;},
      select(){return b;},single(){q.single=true;return b;},eq(c,v){q.filtros.push([c,v]);return b;},order(){return b;},limit(){return b;},
      then(ok,ko){__llamadas.push(q);
        if(__fallar&&__fallar(q)) return Promise.resolve({data:null,error:{message:'falló '+q.t}}).then(ok,ko);
        const data=q.single?{id:++__id,...(Array.isArray(q.datos)?{}:q.datos)}:null;
        return Promise.resolve({data,error:null}).then(ok,ko);}};
    return b;}};
  const C={inv:[],prov:[],comp:[],mov:[],fin:[]};
  ${bloque('const fromProv','const fromMov')}
  ${bloque('let _comprasDisponibles','function _nombreProveedor')}
  ${['_nombreProveedor','renderProveedores','abrirProveedor','guardarProveedor','eliminarProveedor','_rangoCompras','setComprasPeriodo','renderCompras',
     '_llenarProveedoresCompra','abrirNuevaCompra','agregarLineaCompra','quitarLineaCompra','cambiarLineaCompra','_pintarLineasCompra','_totalCompra',
     '_costoPromedio','guardarCompra','verCompra','anularCompra','_pctMargen','_margenProducto'].map(extraer).join('\n')}
  window.__estado=(o)=>{ Object.assign(C,o.C||{}); if('confirmar' in o) __confirmar=o.confirmar; if('disponibles' in o) _comprasDisponibles=o.disponibles; };
  Object.assign(window,{C,_costoPromedio,_pctMargen,abrirNuevaCompra,agregarLineaCompra,cambiarLineaCompra,guardarCompra,anularCompra,verCompra,
    renderCompras,renderProveedores,guardarProveedor,abrirProveedor,_margenProducto,_lineas:()=>_lineasCompra});
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

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await abrir(page);

    // ── Costo promedio y margen ──
    const calc=await page.evaluate(()=>({
      promedio:_costoPromedio(10,5,10,7), sinPrevio:_costoPromedio(0,null,100,1.5), sinStock:_costoPromedio(0,9,4,6),
      negativo:_costoPromedio(-3,5,10,7), margen:_pctMargen(6,8), margenNeg:_pctMargen(10,8), sinCosto:_pctMargen(null,8),
    }));
    assert.equal(calc.promedio,6,'10 a C$ 5 + 10 a C$ 7 = 20 a C$ 6');
    assert.equal(calc.sinPrevio,1.5);
    assert.equal(calc.sinStock,6,'Sin stock, el costo es el de lo que entra');
    assert.equal(calc.negativo,7,'Un stock negativo se trata como cero');
    assert.equal(calc.margen,'25 %');
    assert.equal(calc.margenNeg,'-25 %');
    assert.equal(calc.sinCosto,'—');

    // ── Registrar una compra ──
    const compra=await page.evaluate(async(INV)=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV)),prov:[{id:7,nombre:'Proveedor A',activo:true},{id:8,nombre:'Viejo',activo:false}],comp:[]}});
      abrirNuevaCompra();
      const provs=[...document.querySelectorAll('#compra-proveedor option')].map(o=>o.textContent);
      // Sin proveedor no se registra nada
      __llamadas.length=0; await guardarCompra();
      const sinProveedor={toast:__toasts.at(-1),llamadas:__llamadas.length};
      document.getElementById('compra-proveedor').value='7';
      document.getElementById('compra-numero').value='F-123';
      const ls=_lineas();
      cambiarLineaCompra(ls[0].id,'invId','1');
      const costoPropuesto=_lineas()[0].costo;
      cambiarLineaCompra(_lineas()[0].id,'cantidad','10'); cambiarLineaCompra(_lineas()[0].id,'costo','7');
      agregarLineaCompra(); cambiarLineaCompra(_lineas()[1].id,'invId','2'); cambiarLineaCompra(_lineas()[1].id,'cantidad','100'); cambiarLineaCompra(_lineas()[1].id,'costo','1.5');
      agregarLineaCompra(); cambiarLineaCompra(_lineas()[2].id,'invId','1'); cambiarLineaCompra(_lineas()[2].id,'cantidad','5'); cambiarLineaCompra(_lineas()[2].id,'costo','4');
      const total=document.getElementById('compra-total').textContent;
      const margenLinea=document.querySelector('.compra-linea-margen')?.textContent;
      __llamadas.length=0;
      await guardarCompra();
      return {provs,sinProveedor,costoPropuesto,total,margenLinea,llamadas:JSON.parse(JSON.stringify(__llamadas)),toast:__toasts.at(-1),abierto:document.getElementById('modal-compra').classList.contains('open')};
    },INV);
    assert.deepEqual(compra.provs,['Elige el proveedor…','Proveedor A'],'Un proveedor inactivo no se ofrece');
    assert.deepEqual([compra.sinProveedor.toast[0],compra.sinProveedor.llamadas],['error',0]);
    assert.equal(compra.costoPropuesto,5,'Se propone el costo actual del producto');
    assert.equal(compra.total,'C$ 240.00');
    assert.match(compra.margenLinea,/Lo vendes a C\$ 8\.00 · margen 12[.,]5 %/);
    const de=(t,op)=>compra.llamadas.filter(q=>q.t===t&&q.op===op);
    const cab=de('compras','insert')[0].datos;
    assert.deepEqual([cab.proveedor_id,cab.total,cab.numero_factura,cab.clinica_id],[7,240,'F-123',9]);
    assert.equal(de('compra_items','insert')[0].datos.length,3);
    const inv=Object.fromEntries(de('inventario','update').map(q=>[q.filtros[0][1],q.datos]));
    assert.deepEqual(inv[1],{stock_actual:25,costo_unitario:5.6},'Guantes: 10 a 5, +10 a 7, +5 a 4 → 25 a 5,60');
    assert.deepEqual(inv[2],{stock_actual:100,costo_unitario:1.5});
    const movs=de('inventario_movimientos','insert').flatMap(q=>q.datos);
    assert.equal(movs.length,3);
    assert(movs.every(m=>m.tipo==='entrada'&&m.motivo==='Compra a Proveedor A · Fact. F-123'));
    const gasto=de('finanzas','insert')[0].datos;
    assert.deepEqual([gasto.tipo,gasto.categoria,gasto.monto,gasto.referencia],['egreso','compras',240,'COMPRA-101']);
    assert(de('compras','update').some(q=>q.datos.finanzas_id),'La compra recuerda su gasto');
    assert.deepEqual([compra.toast[0],compra.abierto],['success',false]);

    // Sin anotar gasto, no toca Finanzas
    const sinGasto=await page.evaluate(async(INV)=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV))}});
      abrirNuevaCompra(); document.getElementById('compra-proveedor').value='7'; document.getElementById('compra-gasto').checked=false;
      cambiarLineaCompra(_lineas()[0].id,'invId','2'); cambiarLineaCompra(_lineas()[0].id,'cantidad','2'); cambiarLineaCompra(_lineas()[0].id,'costo','1');
      __llamadas.length=0; await guardarCompra();
      return __llamadas.filter(q=>q.t==='finanzas').length;
    },INV);
    assert.equal(sinGasto,0);

    // Si fallan las líneas, la compra se borra y el inventario no se toca
    const fallo=await page.evaluate(async(INV)=>{
      __estado({C:{inv:JSON.parse(JSON.stringify(INV))}});
      abrirNuevaCompra(); document.getElementById('compra-proveedor').value='7';
      cambiarLineaCompra(_lineas()[0].id,'invId','1'); cambiarLineaCompra(_lineas()[0].id,'cantidad','1'); cambiarLineaCompra(_lineas()[0].id,'costo','5');
      window.__fallar=q=>q.t==='compra_items'; __llamadas.length=0; await guardarCompra(); window.__fallar=null;
      return {borrada:__llamadas.some(q=>q.t==='compras'&&q.op==='delete'),inventario:__llamadas.filter(q=>q.t==='inventario').length,toast:__toasts.at(-1)[0]};
    },INV);
    assert.deepEqual(fallo,{borrada:true,inventario:0,toast:'error'});

    // ── Anular: el stock y el costo vuelven a como estaban ──
    const anular=await page.evaluate(async()=>{
      __estado({confirmar:true,C:{inv:[{id:1,nombre:'Guantes de nitrilo M',unidad:'caja',stock:25,costo:5.6,precio:8},{id:2,nombre:'Jeringas 5 ml',unidad:'unidad',stock:100,costo:1.5,precio:3}],
        comp:[{id:101,proveedorId:7,fecha:'2026-11-14',numeroFactura:'F-123',metodoPago:'efectivo',total:240,estado:'registrada',notas:'',finanzasId:555,creadoPor:'Ana',
          items:[{id:1,invId:1,descripcion:'Guantes',cantidad:10,costo:7,subtotal:70},{id:2,invId:2,descripcion:'Jeringas',cantidad:100,costo:1.5,subtotal:150},{id:3,invId:1,descripcion:'Guantes',cantidad:5,costo:4,subtotal:20}]}]}});
      verCompra(101);
      const detalle={filas:document.querySelectorAll('.compra-detalle-tabla tbody tr').length,anular:!!document.querySelector('#compra-detalle-acciones .btn-danger')};
      __llamadas.length=0; await anularCompra(101);
      return {detalle,llamadas:JSON.parse(JSON.stringify(__llamadas))};
    });
    assert.deepEqual(anular.detalle,{filas:3,anular:true});
    const inv2=Object.fromEntries(anular.llamadas.filter(q=>q.t==='inventario'&&q.op==='update').map(q=>[q.filtros[0][1],q.datos]));
    assert.deepEqual(inv2[1],{stock_actual:10,costo_unitario:5},'Guantes vuelve a 10 a C$ 5');
    assert.deepEqual(inv2[2],{stock_actual:0,costo_unitario:1.5},'Sin stock, el costo se conserva');
    assert(anular.llamadas.some(q=>q.t==='finanzas'&&q.op==='delete'&&q.filtros[0][1]===555),'Se borra el gasto');
    assert(anular.llamadas.some(q=>q.t==='compras'&&q.op==='update'&&q.datos.estado==='anulada'));
    assert.equal(anular.llamadas.filter(q=>q.t==='inventario_movimientos').length,2,'Una salida por producto');

    // ── Proveedores ──
    const prov=await page.evaluate(async()=>{
      __estado({C:{prov:[{id:7,nombre:'Proveedor A',activo:true}]}});
      abrirProveedor(); document.getElementById('prov-nombre').value='  proveedor a ';
      await guardarProveedor(); const repetido=__toasts.at(-1);
      document.getElementById('prov-nombre').value='Droguería Central'; document.getElementById('prov-telefono').value='8888 0000';
      __llamadas.length=0; await guardarProveedor();
      return {repetido,insert:__llamadas.find(q=>q.t==='proveedores')?.datos,lista:C.prov.map(p=>p.nombre)};
    });
    assert.deepEqual(prov.repetido[0],'error','No se repite un proveedor con otro espacio o mayúscula');
    assert.deepEqual([prov.insert.nombre,prov.insert.telefono,prov.insert.clinica_id,prov.insert.activo],['Droguería Central','8888 0000',9,true]);
    assert.deepEqual(prov.lista.sort(),['Droguería Central','Proveedor A']);

    // Sin la migración, «Compra» abre la entrada de antes y avisa
    const sinTablas=await page.evaluate(()=>{ __estado({disponibles:false}); __llamadas.length=0; abrirNuevaCompra(); const r={antigua:__llamadas.some(q=>q.t==='entrada-antigua'),toast:__toasts.at(-1)[0]}; __estado({disponibles:true}); return r; });
    assert.deepEqual(sinTablas,{antigua:true,toast:'warning'});

    // Margen en el formulario de producto
    const margen=await page.evaluate(()=>{
      const leer=(c,p)=>{document.getElementById('prod-costo').value=c;document.getElementById('prod-precio').value=p;_margenProducto();const el=document.getElementById('prod-margen');return el.hidden?null:el.textContent;};
      return {bien:leer('6','8'),mal:leer('10','8'),vacio:leer('','8')};
    });
    assert.equal(margen.bien,'Ganas C$ 2.00 por unidad · margen 25 %');
    assert.match(margen.mal,/^Pierdes C\$ 2\.00/);
    assert.equal(margen.vacio,null);

    // ── Cómo se ve: lista, resumen por proveedor y formulario en teléfono y escritorio ──
    for(const w of [360,390,1280]) {
      await page.setViewportSize({width:w,height:900});
      const m=await page.evaluate(()=>{
        document.querySelectorAll('.modal-overlay.open').forEach(x=>x.classList.remove('open'));
        __estado({C:{prov:[{id:7,nombre:'Proveedor A con un nombre bastante largo, S.A.',activo:true},{id:8,nombre:'Droguería Central',activo:true}],
          comp:[{id:1,proveedorId:7,fecha:'2026-11-10',numeroFactura:'F-123',total:2400,estado:'registrada',items:[{cantidad:10},{cantidad:5}]},
                {id:2,proveedorId:8,fecha:'2026-11-12',numeroFactura:'',total:800,estado:'registrada',items:[{cantidad:100}]},
                {id:3,proveedorId:8,fecha:'2026-11-13',numeroFactura:'X',total:50,estado:'anulada',items:[{cantidad:1}]}]}});
        ['productos','movimientos','compras','proveedores','reportes'].forEach(t=>document.getElementById('inv-panel-'+t).style.display=t==='compras'?'block':'none');
        renderCompras();
        const panel=document.getElementById('inv-panel-compras');
        const fuera=el=>[...el.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).map(e=>e.className||e.tagName).slice(0,4);
        const r={kpi:panel.querySelector('.stat-card h3').textContent,filas:panel.querySelectorAll('.compra-item').length,porProv:panel.querySelectorAll('.compras-prov-fila').length,fueraLista:fuera(panel)};
        abrirNuevaCompra(); agregarLineaCompra();
        const modal=document.querySelector('#modal-compra .modal');
        r.fueraModal=[...modal.querySelectorAll('*')].filter(e=>{const b=e.getBoundingClientRect(),mb=modal.getBoundingClientRect();return b.width&&b.right>mb.right+1;}).map(e=>e.className||e.tagName).slice(0,4);
        r.scroll=document.documentElement.scrollWidth-innerWidth;
        return r;
      });
      assert.equal(m.kpi,'C$ 3200.00','Lo anulado no suma');
      assert.equal(m.filas,3);
      assert.equal(m.porProv,2);
      assert.deepEqual(m.fueraLista,[],`La lista cabe en ${w}px`);
      assert.deepEqual(m.fueraModal,[],`El formulario cabe en ${w}px`);
      const dest=path.join(process.env.TEMP||'/tmp',`compras-${w}.png`);
      await page.screenshot({path:dest,fullPage:false});
      console.log(`Compra ${w}px: ${dest}`);
    }
    console.log('OK: costo promedio, margen, compra, gasto, fallo sin rastro, anulación, proveedores, sin migración y layout.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
