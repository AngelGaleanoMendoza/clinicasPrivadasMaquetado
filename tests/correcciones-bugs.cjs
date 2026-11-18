// Correcciones de la revisión de bugs: cálculos de fechas, dosis, escape de
// textos y restauración del respaldo. Funciones puras, sin navegador.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'js/app.js'), 'utf8');

function extraer(name) {
  const start = source.search(new RegExp('^(async )?function ' + name + '\\(', 'm'));
  assert(start >= 0, 'No se encontró ' + name);
  const primera = source.slice(start, source.indexOf('\n', start));
  let abiertas = 0;
  for (const ch of primera) { if (ch === '{') abiertas++; else if (ch === '}') abiertas--; }
  if (abiertas === 0 && primera.includes('{')) return primera;
  return source.slice(start, source.indexOf('\n}', start) + 2);
}

const ctx = {DOSIS_UNIDADES:['tableta(s)','cápsula(s)','mg','ml'], C:{ventas:[]}};
vm.createContext(ctx);
vm.runInContext(['fechaLocal','escAttr','_jsArg','_getEdadNum','calcEdad','_mismoDiaOtroMes','_lunesSemanaISO','_fechaAlertaVenc',
  'parseDosisStr','_siguienteNumeroVenta','_agregarFilasBackup','_tablasDesdeBackupV2'].map(extraer).join('\n')
  + '\nconst _sanitizarUsuarioBackup = u => u;', ctx);
const f = ctx;

// Semana ISO: la semana 1 contiene el 4 de enero.
assert.equal(f.fechaLocal(f._lunesSemanaISO(2027, 1)), '2027-01-04', '2027 empieza en viernes');
assert.equal(f.fechaLocal(f._lunesSemanaISO(2026, 1)), '2025-12-29');
assert.equal(f.fechaLocal(f._lunesSemanaISO(2028, 10)), '2028-03-06');

// Flechas del calendario: sin saltarse febrero.
assert.equal(f._mismoDiaOtroMes('2026-01-31', 1), '2026-02-28');
assert.equal(f._mismoDiaOtroMes('2028-01-31', 1), '2028-02-29');
assert.equal(f._mismoDiaOtroMes('2026-05-31', 1), '2026-06-30');
assert.equal(f._mismoDiaOtroMes('2026-03-15', -1), '2026-02-15');
assert.equal(f._mismoDiaOtroMes('2026-01-10', -1), '2025-12-10');

// Alerta de vencimiento: en hora local y sin desbordar el mes.
assert.equal(f._fechaAlertaVenc('2026-05-01', 1), '2026-04-01');
assert.equal(f._fechaAlertaVenc('2026-03-31', 1), '2026-02-28');
assert.equal(f._fechaAlertaVenc('2026-08-31', 6), '2026-02-28');

// Edad: el día del cumpleaños, no el anterior.
const hoyD = new Date(), iso = d => f.fechaLocal(d);
const cumpleHoy = new Date(hoyD.getFullYear() - 30, hoyD.getMonth(), hoyD.getDate());
const cumpleManana = new Date(hoyD.getFullYear() - 30, hoyD.getMonth(), hoyD.getDate() + 1);
assert.equal(f._getEdadNum(iso(cumpleHoy)), 30, 'Cumple hoy: ya tiene 30');
assert.equal(f._getEdadNum(iso(cumpleManana)), 29, 'Cumple mañana: todavía 29');
assert.equal(f.calcEdad(null), '—');

// Dosis por peso: nunca se toma como dosis total.
assert.deepEqual({...f.parseDosisStr('50 mg/kg')}, {qty:'', unit:'mg'});
assert.deepEqual({...f.parseDosisStr('10-15mg/kg cada 6h')}, {qty:'', unit:'mg'});
assert.deepEqual({...f.parseDosisStr('500 mg')}, {qty:'500', unit:'mg'});
assert.deepEqual({...f.parseDosisStr('1 tableta')}, {qty:'1', unit:'tableta(s)'});

// Escape: el 0 no desaparece y un nombre con comillas no rompe ni inyecta en un onclick.
assert.equal(f.escAttr(0), '0');
assert.equal(f.escAttr('<img onerror=x>'), '&lt;img onerror=x&gt;');
const decodificar = s => s.replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
for (const nombre of ["O'Malley", 'x\');alert(1);(\'', 'Dr. "Juan" \\ Pérez']) {
  const js = decodificar(f._jsArg(nombre));   // lo que el navegador ejecuta tras decodificar el atributo
  assert.equal(JSON.parse(js), nombre, 'El argumento llega intacto: ' + nombre);
}

// Número de venta: los saldos importados (SI-…) no mueven la secuencia V-.
ctx.C.ventas = [{numero:'V-000004'}, {numero:'SI-F-2025-889'}, {numero:'V-000010'}];
assert.equal(f._siguienteNumeroVenta(), 11);

// Respaldo: compras, ventas, lotes, proveedores y clientes se restauran con sus líneas y pagos.
const t = f._tablasDesdeBackupV2({datosClinica:{
  proveedores:[{id:1,nombre:'P'}], clientesComerciales:[{id:2,nombre:'C'}], lotesInventario:[{id:3,lote:'L'}],
  compras:[{id:4,compra_items:[{id:5}],compra_pagos:[{id:6}]}],
  ventas:[{id:7,numero:'V-000001',venta_items:[{id:8}],venta_cobros:[{id:9},{id:10}]}]
}});
assert.deepEqual(Object.fromEntries(['proveedores','clientes_comerciales','inventario_lotes','compras','compra_items','compra_pagos','ventas','venta_items','venta_cobros']
  .map(k => [k, JSON.parse(JSON.stringify((t[k]||[]).map(r => r.id)))])),
  {proveedores:[1],clientes_comerciales:[2],inventario_lotes:[3],compras:[4],compra_items:[5],compra_pagos:[6],ventas:[7],venta_items:[8],venta_cobros:[9,10]});
assert.equal('compra_items' in t.compras[0], false, 'La compra se guarda sin sus líneas anidadas');
const orden = /const orden=\[([^\]]+)\]/.exec(source)[1];
const pos = n => orden.indexOf(`'${n}'`);
for (const [antes, despues] of [['proveedores','compras'],['compras','compra_items'],['compras','inventario_lotes'],['inventario_lotes','venta_items'],['clientes_comerciales','ventas'],['ventas','venta_cobros']])
  assert(pos(antes) >= 0 && pos(antes) < pos(despues), `${antes} se restaura antes que ${despues}`);

console.log('OK: semana ISO, meses del calendario, alerta de vencimiento, edad, dosis por peso, escape de textos, numeración de ventas y restauración del respaldo.');
