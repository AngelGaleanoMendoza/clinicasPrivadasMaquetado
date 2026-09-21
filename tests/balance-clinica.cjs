// Balance de la clínica (ingresos propios − gastos), categorías configurables
// y el nombre del documento de cobro.
// Ejecutar con PLAYWRIGHT_MODULE apuntando a una instalación de playwright.
// PLAYWRIGHT_CHROMIUM permite usar un Chromium propio en vez del canal msedge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');

function extraer(name) {
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  let abiertas=0;
  for(const ch of primeraLinea) { if(ch==='{') abiertas++; else if(ch==='}') abiertas--; }
  if(abiertas===0 && primeraLinea.includes('{')) return primeraLinea;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
// Las constantes se leen del archivo igual que las funciones: si alguien añade
// una categoría de fábrica, la prueba la ve.
function extraerConst(name) {
  const start=source.search(new RegExp('^const '+name+'\\s*=','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  // Si abre y cierra en su propia línea, termina ahí: buscar el siguiente "\n};"
  // se llevaría por delante la constante de abajo.
  let abiertas=0;
  for(const ch of primeraLinea) { if('{['.includes(ch)) abiertas++; else if('}]'.includes(ch)) abiertas--; }
  if(abiertas===0) return primeraLinea;
  return source.slice(start,source.indexOf('\n};',start)+3);
}

const code=[extraerConst('_FACT_ANULADA'),extraerConst('CATEGORIA_PAGO_PROFESIONAL'),extraerConst('CATEGORIAS_FIN_FIJAS'),
  extraerConst('CATEGORIAS_FIN_DEFECTO'),
  ...['_categoriasPropias','_categoriasFin','_etiquetaCategoria','_idCategoria',
      '_docFactura','_aplicarNombreDocumento','_balanceManual','_facturaDeIngreso','_indiceFacturasPorNumero',
  '_facturasConRastroDeCobro','_tieneRastroDeCobro','_facturaVale','_pctDeLinea','_baseFactura','_factorCobro',
      '_porcentajeClinica','_repartoFactura','_balanceClinica','renderTransacciones'].map(extraer)].join('\n');

const preambulo=`
  const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const fmtC=n=>'C$ '+Number(n||0).toFixed(2);
  const hoy=()=>'2026-09-18';
  const toast=()=>{};
  let finTipoFiltro='';
  let currentClinica={id:7};
  window.__clinica=c=>{currentClinica=c;};
  const C={fin:[],fact:[],factItems:[],reparto:[]};
  window.__fin=xs=>{C.fin=xs;};
  window.__fact=(f,i,r)=>{C.fact=f||[];C.factItems=i||[];C.reparto=r||[];};
  const getFinDateRange=()=>({from:'2026-09-01',to:'2026-09-30'});
  window.FACT_40=()=>{
    C.fact=[{id:1,numero:'F-1',fecha:'2026-08-28',estado:'pagada',total:1000}];
    C.factItems=[{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,
      porcentajeClinica:40,montoClinica:null}];
    C.reparto=[];
  };

  ${code}
  Object.assign(window,{_categoriasFin,_etiquetaCategoria,_idCategoria,_docFactura,
    _aplicarNombreDocumento,_balanceClinica,renderTransacciones,CATEGORIAS_FIN_FIJAS});
`;

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await page.setContent(`<html><body>
      <div id="lista"></div>
      <span data-doc="plural">x</span><h3 data-doc="titulo">x</h3>
      <h3 data-doc="ultimas">x</h3><button data-doc="nuevo">x</button>
      <h2 data-doc="nuevo-modal">x</h2>
    </body></html>`);
    await page.addScriptTag({content:preambulo});

    // FACT_40(): factura de C$1000 al 40 % — C$400 clínica, C$600 profesional.
    // ── El cobro no se cuenta dos veces: solo entra la parte de la clínica ──
    const sinDoble=await page.evaluate(()=>{
      FACT_40();
      window.__fin([
        {fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000},
        {fecha:'2026-09-11',tipo:'egreso', categoria:'alquiler',monto:300}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(sinDoble.deServicios,400,'De los C$1000 cobrados solo son suyos C$400');
    assert.equal(sinDoble.otrosIngresos,0,'El cobro no puede volver a sumar como ingreso suelto');
    assert.equal(sinDoble.ingresos,400);
    assert.equal(sinDoble.balance,100,'400 − 300');
    assert.equal(sinDoble.profesionales,600,'Se informa, pero fuera de toda suma');

    // ── El dinero cuenta el día que ENTRA, no el día de emisión ──
    // La factura es del 28-ago; se cobró el 3-sep. Antes septiembre salía a cero
    // y agosto subía retroactivamente el día del cobro.
    const caja=await page.evaluate(()=>{
      FACT_40();
      window.__fin([
        {fecha:'2026-09-03',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000},
        {fecha:'2026-09-11',tipo:'egreso', categoria:'alquiler',monto:300}
      ]);
      const sep=_balanceClinica('2026-09-01','2026-09-30');
      const ago=_balanceClinica('2026-08-01','2026-08-31');
      return {sep,ago};
    });
    assert.equal(caja.sep.deServicios,400,'El cobro es de septiembre, que es cuando entró');
    assert.equal(caja.sep.balance,100,'400 − 300');
    assert.equal(caja.ago.deServicios,0,'Agosto no debe llevarse un dinero que aún no había entrado');
    assert.equal(caja.ago.balance,0);

    // ── El pago al profesional NO se resta: ese dinero nunca fue de la clínica ──
    const pagoProf=await page.evaluate(()=>{
      FACT_40();
      window.__fin([
        {fecha:'2026-09-03',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000},
        {fecha:'2026-09-05',tipo:'egreso', categoria:'pago_profesional',monto:600},
        {fecha:'2026-09-11',tipo:'egreso', categoria:'alquiler',monto:100}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(pagoProf.gastos,100,'Solo el alquiler es gasto propio');
    assert.equal(pagoProf.pagoProfesional,600,'Lo entregado al médico se informa aparte');
    assert.equal(pagoProf.balance,300,'400 − 100. Antes salía −300 al restarlo dos veces');

    // ── Lo cobrado sin reparto acordado se queda en la clínica, y se avisa ──
    const sinRep=await page.evaluate(()=>{
      window.__fact(
        [{id:2,numero:'F-2',fecha:'2026-09-05',estado:'pagada',total:20000}],
        [{id:9,facturaId:2,tipo:'producto',cantidad:1,precioUnitario:20000,subtotal:20000,
          porcentajeClinica:null,montoClinica:null}],
        []);
      window.__fin([
        {fecha:'2026-09-05',tipo:'ingreso',categoria:'factura',facturaId:2,monto:20000},
        {fecha:'2026-09-08',tipo:'egreso', categoria:'medicamento',monto:15000}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(sinRep.deServicios,20000,'Antes valía 0 y el balance salía absurdamente negativo');
    assert.equal(sinRep.sinReparto,20000,'Se marca para poder avisarlo en pantalla');
    assert.equal(sinRep.balance,5000,'20000 − 15000');

    // ── Un cobro parcial reparte en la misma proporción ──
    const abono=await page.evaluate(()=>{
      FACT_40();
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:500}]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(abono.deServicios,200,'Medio cobro, media parte: 40 % de 500');
    assert.equal(abono.profesionales,300);

    // ── Cobro viejo sin factura_id: se reconoce por el número de referencia ──
    const legado=await page.evaluate(()=>{
      FACT_40();
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',referencia:'F-1',monto:1000}]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(legado.deServicios,400,'Sin factura_id debe encontrarla por el número');

    // ── Los ingresos registrados a mano sí suman enteros ──
    const conOtros=await page.evaluate(()=>{
      FACT_40();
      window.__fin([
        {fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000},
        {fecha:'2026-09-12',tipo:'ingreso',categoria:'general',monto:250},
        {fecha:'2026-09-13',tipo:'ingreso',categoria:'consulta',monto:150},
        {fecha:'2026-09-11',tipo:'egreso', categoria:'nomina',monto:500}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(conOtros.otrosIngresos,400,'250 + 150');
    assert.equal(conOtros.ingresos,800,'400 de servicios + 400 sueltos');
    assert.equal(conOtros.balance,300,'800 − 500');

    // ── Fuera del período no entra nada ──
    const fuera=await page.evaluate(()=>{
      window.__fact([],[],[]);
      window.__fin([
        {fecha:'2026-08-31',tipo:'ingreso',categoria:'general',monto:999},
        {fecha:'2026-10-01',tipo:'egreso', categoria:'general',monto:999}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(fuera.ingresos,0);
    assert.equal(fuera.gastos,0);

    // ── Balance negativo cuando se gasta de más ──
    const negativo=await page.evaluate(()=>{
      FACT_40();
      window.__fin([
        {fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000},
        {fecha:'2026-09-11',tipo:'egreso',categoria:'nomina',monto:900}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(negativo.balance,-500,'Debe poder dar negativo, no cortarse en cero');

    // ── Dos facturas con el mismo número no duplican el dinero ──
    // El cobro viejo no lleva factura_id y el número no las distingue: antes se
    // atribuía a una y la otra se volvía a contar por su fecha.
    const duplicado=await page.evaluate(()=>{
      window.__fact(
        [{id:1,numero:'F-DUP',fecha:'2026-09-05',estado:'pagada', total:1000},
         {id:2,numero:'F-DUP',fecha:'2026-09-06',estado:'pendiente',total:5000}],
        [{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,porcentajeClinica:40,montoClinica:null},
         {id:2,facturaId:2,tipo:'consulta',cantidad:1,precioUnitario:5000,subtotal:5000,porcentajeClinica:40,montoClinica:null}],
        []);
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',referencia:'F-DUP',monto:1000}]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(duplicado.ingresos,1000,'Entraron C$1000: no puede contarse más de una vez');
    assert.equal(duplicado.cobrosSinDetalle,1000,'Al no poder identificar la factura, se avisa');

    // ── Una factura anulada tras cobrarse deja de contar como venta ──
    const anulada=await page.evaluate(()=>{
      window.__fact(
        [{id:1,numero:'F-1',fecha:'2026-09-05',estado:'anulada',total:1000}],
        [{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,porcentajeClinica:40,montoClinica:null}],
        []);
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000}]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(anulada.deServicios,0,'El documento se invalidó');
    assert.equal(anulada.anulados,1000,'Se informa aparte en vez de desaparecer sin rastro');

    // ── El impuesto del documento no infla el reparto ──
    // El apunte se graba por el total (1150) y las líneas suman 1000: antes el
    // factor salía 1,15 y repartía el impuesto como si fuera ingreso repartible.
    const conImpuesto=await page.evaluate(()=>{
      window.__fact(
        [{id:1,numero:'F-1',fecha:'2026-09-05',estado:'pagada',total:1150}],
        [{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,porcentajeClinica:40,montoClinica:null}],
        []);
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1150}]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(conImpuesto.profesionales,600,'Antes salía 690 al repartir el impuesto');
    assert.equal(conImpuesto.deServicios,550,'400 de su parte + 150 de impuesto que no se reparte');
    assert.equal(conImpuesto.noRepartible,150);

    // ── Un cobro sobre líneas que suman cero no desaparece ──
    const lineasCero=await page.evaluate(()=>{
      window.__fact(
        [{id:1,numero:'F-1',fecha:'2026-09-05',estado:'pagada',total:500}],
        [{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:0,subtotal:0,porcentajeClinica:40,montoClinica:null}],
        []);
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:500}]);
      return _balanceClinica('2026-09-01','2026-09-30');
    });
    assert.equal(lineasCero.ingresos,500,'Entraron C$500 y antes el balance los perdía del todo');
    assert.equal(lineasCero.noRepartible,500);

    // ── En modo manual, la casilla vacía NO cae al porcentaje anterior ──
    const manualVacio=await page.evaluate(()=>{
      window.__clinica({id:7,balance_modo:'manual'});
      window.__fact(
        [{id:1,numero:'F-1',fecha:'2026-09-05',estado:'pagada',total:1000}],
        [{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,porcentajeClinica:null,montoClinica:null}],
        [{tipo:'consulta',porcentaje:40}]);   // configuración de la etapa anterior
      window.__fin([{fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',facturaId:1,monto:1000}]);
      const r=_balanceClinica('2026-09-01','2026-09-30');
      window.__clinica({id:7});
      return r;
    });
    assert.equal(manualVacio.deServicios,1000,'Sin reparto escrito el dinero es de la clínica');
    assert.equal(manualVacio.profesionales,0,'Antes asignaba C$600 con un % que nadie acordó en este modo');
    assert.equal(manualVacio.sinReparto,1000,'Y se avisa de que falta escribirlo');

    // ── Categorías: las cuatro nuevas están de fábrica ──
    const nuevas=await page.evaluate(()=>{
      window.__clinica({id:7});
      return _categoriasFin('egreso').map(c=>c.id);
    });
    for(const id of ['impuestos','abarrotes','desechos','consumibles'])
      assert.ok(nuevas.includes(id),'Falta la categoría de fábrica '+id);
    for(const id of ['nomina','alquiler','servicios','medicamento','insumo','equipo','general'])
      assert.ok(nuevas.includes(id),'Se perdió la categoría que ya existía: '+id);

    // ── Las propias se añaden, y una con el mismo id renombra la de fábrica ──
    const propias=await page.evaluate(()=>{
      window.__clinica({id:7,categorias_finanzas:{egreso:[
        {id:'gasolina',label:'Gasolina',icon:'⛽'},
        {id:'nomina',  label:'Planilla', icon:'👥'}
      ]}});
      const lista=_categoriasFin('egreso');
      return {ids:lista.map(c=>c.id), nomina:lista.filter(c=>c.id==='nomina').map(c=>c.label)};
    });
    assert.ok(propias.ids.includes('gasolina'),'La propia debe aparecer');
    assert.deepEqual(propias.nomina,['Planilla'],'Renombrar no debe duplicar la categoría');

    // ── Un registro viejo con una categoría que ya no se ofrece conserva su id ──
    const etiquetas=await page.evaluate(()=>{
      window.__clinica({id:7});
      return {conocida:_etiquetaCategoria('nomina'), desconocida:_etiquetaCategoria('lo_que_sea')};
    });
    assert.match(etiquetas.conocida,/Nómina/);
    // 'factura' solo existe como categoría de gasto: un cobro no puede salir
    // rotulado como si fuera el pago a un proveedor.
    const rotulo=await page.evaluate(()=>({
      ingreso:_etiquetaCategoria('factura','ingreso'),
      egreso:_etiquetaCategoria('factura','egreso')
    }));
    assert.match(rotulo.ingreso,/Cobro de/);
    assert.match(rotulo.egreso,/Pago de factura/);
    assert.equal(etiquetas.desconocida,'lo_que_sea','Sin nombre, se enseña el id en vez de perderlo');

    // ── El id se deriva del nombre y aguanta tildes y espacios ──
    const ids=await page.evaluate(()=>['Desechos Clínicos','  Impuestos  ','Café & té','###'].map(_idCategoria));
    assert.deepEqual(ids,['desechos_clinicos','impuestos','cafe_te','']);

    // ── El nombre del documento cambia con la clínica ──
    const docs=await page.evaluate(()=>{
      const r={};
      window.__clinica({id:7});
      _aplicarNombreDocumento();
      r.factura=[...document.querySelectorAll('[data-doc]')].map(e=>e.textContent);
      window.__clinica({id:7,tipo_documento_factura:'comprobante_pago'});
      _aplicarNombreDocumento();
      r.comprobante=[...document.querySelectorAll('[data-doc]')].map(e=>e.textContent);
      return r;
    });
    assert.deepEqual(docs.factura,
      ['🧾 Facturas','🧾 Facturas','🧾 Últimas facturas','+ Nueva Factura','🧾 Nueva Factura']);
    assert.deepEqual(docs.comprobante,
      ['🧾 Comprobantes de pago','🧾 Comprobantes de pago','🧾 Últimos comprobantes de pago',
       '+ Nuevo Comprobante de pago','🧾 Nuevo Comprobante de pago']);

    // ── Las pestañas Ingresos y Gastos filtran y solo enseñan su total ──
    const pestanas=await page.evaluate(()=>{
      window.__fin([
        {id:1,fecha:'2026-09-10',tipo:'ingreso',categoria:'general',monto:100,descripcion:'A',metodoPago:'efectivo'},
        {id:2,fecha:'2026-09-11',tipo:'egreso', categoria:'nomina', monto:70, descripcion:'B',metodoPago:'efectivo'},
        {id:3,fecha:'2026-09-12',tipo:'ingreso',categoria:'general',monto:50, descripcion:'C',metodoPago:'efectivo'}
      ]);
      const r={};
      renderTransacciones('lista','ingreso');
      r.ingresos={filas:document.querySelectorAll('#lista .fin-item').length,
                  cabecera:document.querySelector('#lista .fin-list-header').textContent};
      renderTransacciones('lista','egreso');
      r.gastos={filas:document.querySelectorAll('#lista .fin-item').length,
                cabecera:document.querySelector('#lista .fin-list-header').textContent};
      renderTransacciones('lista',null);
      r.todas={filas:document.querySelectorAll('#lista .fin-item').length};
      return r;
    });
    assert.equal(pestanas.ingresos.filas,2);
    assert.match(pestanas.ingresos.cabecera,/2 ingresos/);
    assert.match(pestanas.ingresos.cabecera,/\+C\$ 150\.00/);
    assert.ok(!/−C\$/.test(pestanas.ingresos.cabecera),'En Ingresos no debe salir un total de gastos');
    assert.equal(pestanas.gastos.filas,1);
    assert.match(pestanas.gastos.cabecera,/1 gasto\b/);
    assert.equal(pestanas.todas.filas,3,'Sin tipo fijado salen todas');

    // ── Vacío: el mensaje dice de qué está vacío ──
    const vacios=await page.evaluate(()=>{
      window.__fin([]);
      const r={};
      renderTransacciones('lista','ingreso'); r.ing=document.querySelector('#lista p').textContent;
      renderTransacciones('lista','egreso');  r.egr=document.querySelector('#lista p').textContent;
      return r;
    });
    assert.match(vacios.ing,/No hay ingresos/);
    assert.match(vacios.egr,/No hay gastos/);

    console.log('OK: caja, doble conteo, pago al profesional, sin reparto, abono, legado, número duplicado, anulada, impuesto, líneas a cero, modo manual, categorías, documento y pestañas.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
