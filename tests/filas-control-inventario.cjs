const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const ctx = vm.createContext({
  URL, esEmpresaMedica:()=>true, hasPermiso:()=>true,
  document:{currentScript:{src:'http://localhost/js/importar-excel.js'}}
});
vm.runInContext(fs.readFileSync(require.resolve('../js/importar-excel.js'),'utf8'),ctx);
const {detectar, normalizar, filaIgnorable, piesDeControl} = vm.runInContext('ExcelImportacion._probar',ctx);

function fila(numero, valores) {
  return {numero, celdas:valores.map(valor => valor == null ? undefined : {valor})};
}
const encabezado = fila(7,['Fecha','N.º','Código','Descripción del artículo','Categoría','Unidad de medida',
  'Existencia inicial','UNIDADES Entradas','UNIDADES Salidas','Existencia actual','Costo unitario (C$)',
  'Precio de compra (C$)','Precio de venta (C$)','Porcentaje de Ganancia (%)','Margen de ganancia (C$)',
  'Valor total del inventario (C$)','Ubicación / Observaciones']);
const producto = fila(8,['31/08/2026',1,'007','Total',null,'UNIDAD',5,null,null,5,2,null,null,null,null,10,'Prueba']);
const vacia = fila(83,[null,78,null,null,null,null,null,null,null,'',null,null,null,0.4,'','']);
const hoja = detectar({nombre:'Productos para bonificación',archivo:'Control.xlsx',filas:[encabezado,producto,vacia],fijos:{}});
assert.equal(hoja.bonificacion,true);
assert.equal(hoja.metadataControl.fechaFilas,'2026-08-31');
assert.equal(normalizar(hoja,producto).datos.fecha_origen,'2026-08-31');
assert.equal(normalizar(hoja,producto).datos.observaciones,'Prueba');
assert.equal(normalizar(hoja,producto).datos.bonificacion,true);
assert.equal(filaIgnorable(hoja,vacia),true);
assert.equal(filaIgnorable(hoja,producto),false);
assert.equal(piesDeControl(hoja,[producto]).pies.size,0);

for (const [col,valor] of [[2,'SKU sin nombre'],[5,'CAJA'],[6,4],[7,2],[9,6],[10,13],[15,10],[16,'Existencias por identificar']]) {
  const incompleta = {numero:84,celdas:vacia.celdas.slice()};
  incompleta.celdas[col] = {valor};
  assert.equal(filaIgnorable(hoja,incompleta),false);
  assert.throws(()=>normalizar(hoja,incompleta),/Falta la descripción de un artículo/);
}

// Un total impreso ocupa O:P o dos filas contiguas. Un artículo «Total» con existencias sigue siendo un artículo.
for (const partes of [
  [fila(85,[...Array(14),'Valor total del inventario:',10])],
  [fila(84,[...Array(14),'Valor total del']),fila(85,[...Array(14),'Inventario:',10])],
  [fila(84,[...Array(14),'Valor total del inventario:']),fila(85,[...Array(15),10])]
]) {
  const {pies,totales}=piesDeControl(hoja,[producto,vacia,...partes]);
  assert.deepEqual([...pies],partes.map(p=>p.numero));
  assert.equal(totales.length,1);
  assert.equal(totales[0].importe.valor,10);
}
console.log('OK · Fila prellenada, artículos incompletos, bonificación, fecha común y pies de tabla.');
