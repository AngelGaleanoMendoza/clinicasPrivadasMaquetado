// «Hoy» es la fecha de la clínica, no la de UTC: en Nicaragua (UTC-6), a las
// 19:30 sigue siendo el mismo día. Antes hoy() usaba toISOString y desde las
// 18:00 devolvía mañana: no dejaba agendar citas para ese día.
// Ejecutar con: node tests/fecha-local.cjs
process.env.TZ='America/Managua';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'..','js/app.js'),'utf8');
const linea=n=>{const m=source.match(new RegExp('^function '+n+'\\(.*$','m'));assert(m,'No se encontró '+n);return m[0];};
const {fechaLocal,hoy}=new Function(linea('fechaLocal')+'\n'+linea('hoy')+'\nreturn {fechaLocal,hoy};')();

const RealDate=Date;
const fijar=iso=>{ global.Date=class extends RealDate{ constructor(...a){ super(...(a.length?a:[iso])); } static now(){ return new RealDate(iso).getTime(); } }; };

fijar('2026-11-07T19:30:00-06:00');            // sábado 7, 7:30 p. m. en Managua (8 de noviembre en UTC)
assert.equal(new Date().toISOString().slice(0,10),'2026-11-08','En UTC ya es mañana');
assert.equal(hoy(),'2026-11-07','A las 19:30 sigue siendo hoy');
assert.equal('2026-11-07'<hoy(),false,'Una cita para hoy no es «fecha pasada»');

fijar('2026-11-07T00:15:00-06:00');            // pasada la medianoche local
assert.equal(hoy(),'2026-11-07');
fijar('2026-12-31T23:59:00-06:00');
assert.equal(hoy(),'2026-12-31','Fin de año: sigue siendo 31');
global.Date=RealDate;

assert.equal(fechaLocal(new Date(2026,0,5)),'2026-01-05','Rellena mes y día con cero');
assert.equal(fechaLocal(new Date('2026-03-10T12:00:00')),'2026-03-10');

// Ninguna cuenta de días vuelve a pasar por UTC (salvo las dos que parten de
// una fecha leída como UTC, en el vencimiento del inventario).
const restos=source.split('\n').filter(l=>/toISOString\(\)\.split\('T'\)\[0\]/.test(l));
assert.equal(restos.length,2,'Quedan cuentas de fecha en UTC:\n'+restos.join('\n'));
assert(restos.every(l=>/alerta|alertStr/i.test(l)),'Solo las de la alerta de vencimiento');
console.log('OK: hoy() en hora local de la clínica, de noche, de madrugada, fin de año, y sin fechas de día en UTC.');
