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

const code=[extraerConst('CATEGORIAS_FIN_FIJAS'),extraerConst('CATEGORIAS_FIN_DEFECTO'),
  ...['_categoriasPropias','_categoriasFin','_etiquetaCategoria','_idCategoria',
      '_docFactura','_aplicarNombreDocumento','_balanceClinica','renderTransacciones'].map(extraer)].join('\n');

const preambulo=`
  const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const fmtC=n=>'C$ '+Number(n||0).toFixed(2);
  const hoy=()=>'2026-09-18';
  const toast=()=>{};
  let finTipoFiltro='';
  let currentClinica={id:7};
  window.__clinica=c=>{currentClinica=c;};
  const C={fin:[]};
  window.__fin=xs=>{C.fin=xs;};
  const getFinDateRange=()=>({from:'2026-09-01',to:'2026-09-30'});

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

    // ── El cobro de una factura NO se cuenta dos veces ──
    const sinDoble=await page.evaluate(()=>{
      // La clínica cobró 1000 y le quedaron 400. El cobro dejó además un ingreso
      // de 1000 en finanzas con categoría 'factura', que NO debe sumarse.
      window.__fin([
        {fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',monto:1000},
        {fecha:'2026-09-11',tipo:'egreso', categoria:'alquiler',monto:300}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30',{clinica:400,profesionales:600});
    });
    assert.equal(sinDoble.otrosIngresos,0,'El ingreso de la factura no puede volver a sumar');
    assert.equal(sinDoble.ingresos,400,'Solo entra lo que quedó a la clínica');
    assert.equal(sinDoble.gastos,300);
    assert.equal(sinDoble.balance,100,'400 − 300');
    assert.equal(sinDoble.profesionales,600,'Se informa, pero no está en ingresos ni en balance');

    // ── Los ingresos registrados a mano sí suman ──
    const conOtros=await page.evaluate(()=>{
      window.__fin([
        {fecha:'2026-09-10',tipo:'ingreso',categoria:'factura',monto:1000},
        {fecha:'2026-09-12',tipo:'ingreso',categoria:'general',monto:250},
        {fecha:'2026-09-13',tipo:'ingreso',categoria:'consulta',monto:150},
        {fecha:'2026-09-11',tipo:'egreso', categoria:'nomina',monto:500}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30',{clinica:400,profesionales:600});
    });
    assert.equal(conOtros.otrosIngresos,400,'250 + 150');
    assert.equal(conOtros.ingresos,800,'400 de servicios + 400 sueltos');
    assert.equal(conOtros.balance,300,'800 − 500');

    // ── Fuera del período no entra nada ──
    const fuera=await page.evaluate(()=>{
      window.__fin([
        {fecha:'2026-08-31',tipo:'ingreso',categoria:'general',monto:999},
        {fecha:'2026-10-01',tipo:'egreso', categoria:'general',monto:999}
      ]);
      return _balanceClinica('2026-09-01','2026-09-30',{clinica:0,profesionales:0});
    });
    assert.equal(fuera.ingresos,0);
    assert.equal(fuera.gastos,0);

    // ── Balance negativo cuando se gasta de más ──
    const negativo=await page.evaluate(()=>{
      window.__fin([{fecha:'2026-09-11',tipo:'egreso',categoria:'nomina',monto:900}]);
      return _balanceClinica('2026-09-01','2026-09-30',{clinica:400,profesionales:600});
    });
    assert.equal(negativo.balance,-500,'Debe poder dar negativo, no cortarse en cero');

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

    console.log('OK: sin doble conteo, otros ingresos, período, negativo, categorías, documento y pestañas.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
