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
// En el libro corregido la fecha desaparece, las columnas se desplazan y la hoja de movimientos puede venir vacía.
const corregida = fila(7, encabezado.celdas.slice(1).map(c=>c?.valor));
const articulo = fila(8, producto.celdas.slice(1).map(c=>c?.valor));
const control = detectar({nombre:'Inventario',archivo:'Inventario corregido.xlsx',filas:[corregida,articulo],fijos:{}});
assert.equal(control.tipo,'control_inventario');
assert.equal(control.metadataControl.fechaFilas,undefined);
const partida = normalizar(control,articulo).datos;
assert.equal(partida.costo_total,10);
assert.equal(partida.actual,5);
assert.equal(partida.observaciones,'Prueba');
assert.equal(partida.fecha_origen,undefined);

const registro = [fila(1,['REGISTRO DE ENTRADAS Y SALIDAS']),
  fila(3,['Fecha','Tipo de movimiento','Código','Descripción','Cantidad','Documento / Referencia','Entregado / Recibido por','Observaciones'])];
const detectarRegistro = filas=>detectar({nombre:'Movimientos',archivo:'Inventario corregido.xlsx',filas,fijos:{}});
const vacio=detectarRegistro(registro);
assert.ok(vacio.plantillaMovimientosVacia);
assert.ok(vacio.omitida);
assert.equal(detectarRegistro([...registro,fila(4,['01/11/2026','entrada','007','Producto',2])]).tipo,'movimientos');
assert.equal(detectarRegistro([...registro,fila(4,[null,null,null,null,null,null,null,'Por aclarar'])]).tipo,'movimientos');

// La plantilla ofrecida en la aplicación debe volver a pasar por el mismo lector que los archivos subidos.
const lector=vm.createContext({XLSX:require('../js/vendor/xlsx-0.20.3.full.min.js'),importScripts:()=>{},self:{}});
vm.runInContext(fs.readFileSync(require.resolve('../js/importar-excel-parser.js'),'utf8'),lector);
const libro=fs.readFileSync(require.resolve('../plantillas/control-inventario.xlsx'));
const plantillas=lector.leerLibroExcel(libro.buffer.slice(libro.byteOffset,libro.byteOffset+libro.byteLength),'control-inventario.xlsx')
  .map(h=>detectar({...h,archivo:'control-inventario.xlsx',fijos:{}}));
assert.equal(plantillas.length,3);
for(const h of plantillas.slice(0,2)) {
  assert.equal(h.tipo,'control_inventario');
  const despues=h.filas.filter(f=>f.numero>h.encabezado);
  const pie=piesDeControl(h,despues);
  assert.ok(despues.every(f=>pie.pies.has(f.numero) || filaIgnorable(h,f)),'La plantilla debe estar vacía.');
}
assert.equal(plantillas[1].bonificacion,true);
assert.equal(plantillas[2].plantillaMovimientosVacia,true);
console.log('OK · Existencias con y sin fecha, movimientos con y sin filas, bonificación y pies de tabla.');
