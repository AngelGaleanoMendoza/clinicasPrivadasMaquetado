const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../js/maestro-inventario.js'),'utf8'),ctx);
const maestro=vm.runInContext('MaestroInventario',ctx);
const mes='2026-10', fecha='2026-10-08';
const producto={id:1,nombre:'Agua estéril',sku:'AG-01',categoria:'Insumos',unidad:'unidad',saldo_inicio:10,saldo_corte:12};
function control(modo,actual,otros={}) {
  return {inventario_id:1,sku:'AG-01',nombre:producto.nombre,fecha:modo==='apertura'?'2026-09-30':'2026-10-31',
    archivo:modo+'.xlsx',hoja:'Bodega',fila:8,bodega:'Principal',modo,inicial:actual,entradas:0,salidas:0,
    actual,costo:'2.50',costo_total:(actual*2.50).toFixed(2),precio_compra:'2.50',precio:'4.00',...otros};
}
function mov(id,tipo,motivo,cantidad,extras={}) {
  return {id,inventario_id:1,fecha,tipo,motivo,cantidad,...extras};
}
function datos() {
  return {revision:'una',aperturas:[control('apertura',10)],conteos:[control('cierre',12,{inicial:10,entradas:5,salidas:3})],
    productos:[{...producto}],
    movimientos:[mov(3,'salida','Venta V-01 · Cliente',3),mov(2,'entrada','Compra a Proveedor · Fact. P1',5)],
    compras:[{id:1,compra_id:10,inventario_id:1,fecha,documento:'P1',cantidad:5,costo_unitario:'2.50',subtotal:'12.50'}],
    ventas:[{id:2,venta_id:20,inventario_id:1,fecha,documento:'V-01',lote:'L1',cantidad:3,costo_unitario:'2.50',precio_unitario:4,subtotal:12}],
    incidencias_documentos:[],kardex:[],libro:{cuentas:[]},diario:[]};
}
function calcular(cambiar=()=>{}) {
  const d=datos();cambiar(d);return maestro.calcular(mes,d);
}
const base=calcular();
assert.equal(base.aprobable,true);
assert.deepEqual(Object.fromEntries(Object.entries(base.totales)),{valorInicial:25,compras:12.5,valorFinal:30,valorFinalConocido:30,
  costoPeriodico:7.5,costoVentas:7.5,ventas:12,utilidad:4.5,diferenciaCosto:0,ajusteNeto:0,diferenciaSinExplicar:0});
assert.equal(base.filas[0].finalCalculado,12);
assert.equal(base.fuentes.length,7);
assert.ok(base.fuentes.every(f=>f.idProducto==='1' && f.fecha));
assert.doesNotThrow(()=>JSON.stringify(base));
assert.equal(JSON.stringify(calcular(d=>d.movimientos.reverse())),JSON.stringify(base));
assert.equal(maestro.periodo('2024-02').hasta,'2024-02-29');
assert.throws(()=>maestro.periodo('2026-13'),/mes/);

// El mismo artículo en dos bodegas conserva el saldo total; los documentos operativos
// solo llevan establecimiento. Una merma independiente explica la diferencia monetaria.
const merma=calcular(d=>{
  d.aperturas=[control('apertura',7),control('apertura',3,{bodega:'Secundaria'})];
  d.conteos=[control('cierre',6,{inicial:7,entradas:3,salidas:4}),
    control('cierre',5,{inicial:3,entradas:2,bodega:'Secundaria'})];
  d.movimientos.push(mov(4,'salida','Merma · lote L1',1,{costo_unitario:'2.5000'}));
  d.productos[0].saldo_corte=11;
});
assert.equal(merma.aprobable,true);
assert.equal(merma.totales.diferenciaCosto,2.5);
assert.equal(merma.totales.diferenciaSinExplicar,0);
assert.equal(merma.cobertura.bodegasApertura.length,2);

const parcial=calcular(d=>{
  d.conteos[0].costo=null;d.conteos[0].costo_total=0;
  d.productos.push({id:2,nombre:'Reactivo',stock_actual:300,saldo_corte:5,saldo_inicio:5});
  d.conteos.push({...control('cierre',5),inventario_id:2});
});
assert.equal(parcial.totales.valorFinal,null);
assert.equal(parcial.totales.valorFinalConocido,12.5);
assert.equal(parcial.totales.costoPeriodico,null);
assert.equal(parcial.aprobable,false);
assert.ok(parcial.pendientes.some(p=>p.includes('valorar')));
assert.equal(calcular(d=>d.conteos=[]).totales.valorFinal,null);
assert.equal(calcular(d=>d.aperturas=[]).totales.valorInicial,null);
const omitido=calcular(d=>d.productos.push({id:5,nombre:'Saldo omitido',saldo_corte:1,saldo_inicio:1}));
assert.equal(omitido.filas.length,2);
assert.equal(omitido.aprobable,false);
assert.equal(calcular(d=>d.productos[0].saldo_corte=17).aprobable,false);
assert.equal(calcular(d=>d.conteos.push(d.conteos[0])).aprobable,false);
assert.equal(calcular(d=>d.conteos[0].bodega='Otra').aprobable,false);
assert.equal(calcular(d=>d.conteos[0].entradas=8).aprobable,false);
assert.equal(calcular(d=>d.movimientos[0].motivo='Venta no relacionada').aprobable,false);
assert.equal(calcular(d=>d.movimientos[0].motivo='Muestra sin importe').aprobable,false);
const cruzado=calcular(d=>{
  d.ventas[0].cantidad=2;
  d.ventas.push({...d.ventas[0],id:8,venta_id:8,documento:'V-08',cantidad:1});
  d.movimientos[0].cantidad=1;
  d.movimientos.push(mov(8,'salida','Venta V-08 · Cliente',2));
});
assert.ok(cruzado.pendientes.some(x=>x.includes('V-08')||x.includes('v-08')));
assert.equal(calcular(d=>{d.compras[0].numero_factura=null;d.compras[0].documento='Compra 10';d.movimientos[1].motivo='Compra a Proveedor';}).aprobable,true);
const sinVinculo=calcular(d=>d.ventas[0].inventario_id=null);
assert.equal(sinVinculo.filas.length,2);assert.equal(sinVinculo.aprobable,false);

const repetido=calcular(d=>{
  d.movimientos.push(mov(1,'entrada','Excel · Existencia inicial',10,{es_apertura:true}));
  d.kardex.push({archivo:'Histórico.xlsx',hoja:'Oct',fila:4,datos:{fecha,sku:'AG-01',clase:'salida',cantidad:3,costo:2.5}});
});
assert.equal(repetido.totales.costoVentas,7.5);
assert.equal(repetido.filas[0].entradas,5);
assert.equal(repetido.filas[0].salidas,3);
assert.equal(repetido.aprobable,true);
assert.ok(repetido.fuentes.some(f=>f.tipo==='Kardex documental' && f.idProducto==='1'));
assert.equal(calcular(d=>d.incidencias_documentos.push({tipo:'Compra',id:9,documento:'P9',motivo:'anulada sin fecha'})).aprobable,false);
const anulada=calcular(d=>{
  d.movimientos.push(mov(15,'salida','Venta V-02 · Cliente',3,{anulacion_conciliada:true}),
    mov(16,'entrada','Anulación de venta V-02',3,{anulacion_conciliada:true}));
  d.conteos[0].entradas+=3; d.conteos[0].salidas+=3;
});
assert.equal(anulada.aprobable,true);
assert.equal(anulada.filas[0].ventas,12);
assert.equal(anulada.fuentes.filter(f=>f.tipo.includes('operación anulada')).length,2);
assert.equal(calcular(d=>d.movimientos.push(mov(16,'entrada','Anulación de venta V-02',3))).aprobable,false);
const legacy=calcular(d=>d.aperturas[0].bodega='Sin bodega en archivo');
assert.equal(legacy.aprobable,true);
const declarados=calcular(d=>Object.assign(d.conteos[0],{ganancia_pct:'-12.123456',margen_ganancia:'-0.32'}));
assert.equal(declarados.filas[0].gananciaPct,-12.123456);
assert.equal(declarados.filas[0].margenGanancia,-0.32);
assert.equal(declarados.fuentes.find(f=>f.tipo==='Conteo final').gananciaPct,-12.123456);
const precisa=calcular(d=>{
  d.aperturas[0]=control('apertura',10,{costo:'1.2345',costo_total:'12.35'});
  d.conteos[0]=control('cierre',12,{inicial:10,entradas:5,salidas:3,costo:'1.2345',costo_total:'14.81'});
  d.ventas[0].costo_unitario='1.2345';
});
assert.equal(precisa.filas[0].costoUnitario,1.2345);
assert.equal(precisa.totales.costoVentas,3.70);
// Precios y retiros históricos proceden del soporte, no del costo de catálogo de hoy.
assert.deepEqual(JSON.stringify(calcular(d=>d.productos[0].costo_unitario=999).totales),JSON.stringify(base.totales));
console.log('OK · Maestro mensual: saldos independientes, cantidades, costos, trazas, ajustes y pendientes.');
