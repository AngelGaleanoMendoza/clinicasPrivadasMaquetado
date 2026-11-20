// Prueba PostgreSQL aislada. Comparte las dependencias PGLITE_MODULE y PLAYWRIGHT_MODULE del importador.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {crearBase} = require('./importar-excel.cjs');

async function probar() {
  const db = await crearBase();
  const sql = file => fs.readFileSync(path.join(__dirname,'..',file),'utf8');
  const valor = async (query,params=[]) => (await db.query(query,params)).rows[0].r;
  const importar = (modo,fecha,bodega,filas,confirmar=false,revision=null) =>
    valor('SELECT importar_control_inventario(10,$1,$2,$3,$4,$5,$6) r',[fecha,bodega,modo,JSON.stringify(filas),confirmar,revision]);
  const guardar = async (modo,fecha,bodega,filas) => {
    const previa = await importar(modo,fecha,bodega,filas);
    assert.equal(previa.lote,null);
    const resultado = await importar(modo,fecha,bodega,filas,true,previa.revision);
    assert.ok(resultado.lote);
    return resultado;
  };
  const fila = (nombre,sku,inicial,entradas,salidas,costo) => ({
    archivo:'Formato control inventario.xlsx',hoja:'Bodega',fila:sku==='A'?3:4,
    datos:{nombre,sku,unidad:'blíster',categoria:'Insumos',inicial,entradas,salidas,actual:inicial+entradas-salidas,
      costo,costo_total:costo===null?0:(inicial+entradas-salidas)*costo,ganancia_pct:'-2.123456'}
  });
  const informe = (mes='2025-11-01') => valor('SELECT datos_informe_maestro(10,$1) r',[mes]);
  const aprobar = revision => valor("SELECT aprobar_informe_maestro(10,'2025-11-01',$1) r",[revision]);
  const ajustar = (revision,costo) => valor("SELECT registrar_ajuste_maestro(10,'2025-11-01',$1,$2,'5001','1101') r",[revision,costo]);
  try {
    await db.exec(`CREATE TABLE compra_items(id bigserial,compra_id bigint,clinica_id bigint,inventario_id bigint,descripcion text,cantidad numeric,costo_unitario numeric,subtotal numeric);
      CREATE TABLE inventario_lotes(id bigserial,clinica_id bigint,inventario_id bigint,lote text,fecha_ingreso date,cantidad_inicial numeric,cantidad_disponible numeric,costo_unitario numeric);
      ALTER TABLE venta_items ADD COLUMN inventario_id bigint, ADD COLUMN lote text;`);
    await db.exec(sql('migracion_libro_contable.sql'));
    await db.exec(sql('migracion_informe_maestro.sql'));
    await db.exec(sql('migracion_informe_maestro.sql'));
    await db.exec("SET ROLE authenticated; SET test.uid='c0000000-0000-0000-0000-000000000003'");
    await db.exec('BEGIN');
    const partida=(n,unidad,cantidad,costo,bonus=false)=>({
      archivo:'Bodega.xlsx',hoja:bonus?'Bonificaciones':'Existencias',fila:n,
      datos:{nombre:'Gasas',unidad,inicial:cantidad,actual:cantidad,costo,bonificacion:bonus}
    });
    const separadas=[partida(3,'caja',2,17),partida(4,'caja',3,17),partida(3,'unidad',8,null,true)];
    const consolidadas=await guardar('apertura','2025-10-31','Principal',separadas);
    assert.deepEqual(consolidadas.filas.map(f=>[f.hoja,f.fila]),[['Existencias',3],['Existencias',4],['Bonificaciones',3]]);
    assert.equal(consolidadas.resumen.nuevas,2);
    assert.equal(consolidadas.resumen.filas_origen,3);
    assert.equal(consolidadas.resumen.filas_bonificacion,1);
    assert.equal(consolidadas.resumen.productos_sin_costo,1);
    assert.equal(consolidadas.resumen.valor_conocido,85);
    const ref=(await informe()).aperturas;
    assert.deepEqual(ref.find(f=>f.unidad==='caja').origenes.map(f=>f.actual),[2,3]);
    const copia=separadas.map(f=>({...f,archivo:'Bodega (1).xlsx'})).reverse();
    assert.equal((await importar('apertura','2025-10-31','Principal',copia,true)).lote,consolidadas.lote);
    const revalorar=separadas.map(f=>f.hoja==='Bonificaciones'?partida(f.fila,'unidad',8,1,true):f);
    await guardar('apertura','2025-10-31','Principal',revalorar);
    await db.exec('SAVEPOINT distintas');
    await assert.rejects(importar('cierre','2025-11-30','Principal',[separadas[0],{...separadas[1],archivo:'Otro.xlsx'}]),/distinto archivo, código o categoría/);
    await db.exec('ROLLBACK TO SAVEPOINT distintas');
    await assert.rejects(importar('cierre','2025-11-30','Principal',[separadas[0],separadas[0]]),/misma fila/);
    await db.exec('ROLLBACK TO SAVEPOINT distintas');
    const finalPrueba=await guardar('cierre','2025-11-30','Principal',revalorar);
    assert.equal(finalPrueba.resumen.valor_bonificacion,8);
    // Simula un recibo emitido por la migración anterior a la lectura de metadatos por línea.
    await db.exec('RESET ROLE');
    const anterior=JSON.stringify(revalorar.map(f=>{const d={...f.datos};delete d.bonificacion;return d;}));
    await db.query("UPDATE controles_inventario SET firma=(SELECT md5(jsonb_agg(x ORDER BY x::text)::text) FROM jsonb_array_elements($1::jsonb) x) WHERE modo='cierre'",[anterior]);
    await db.exec('SET ROLE authenticated');
    assert.equal((await importar('cierre','2025-11-30','Principal',revalorar,true)).lote,finalPrueba.lote);
    await db.exec('ROLLBACK');
    await db.exec('BEGIN');
    const mixtas=[partida(4,'caja',10,2),partida(5,'caja',3,0,true),partida(6,'caja',4,null),partida(7,'caja',2,7),partida(8,'caja',1,null)];
    mixtas[0].datos.precio=7;mixtas[3].datos.precio=10;
    const mixto=await guardar('apertura','2025-10-31','Norte',mixtas);
    assert.equal(mixto.resumen.nuevas,1);assert.equal(mixto.resumen.valor_conocido,34);
    assert.equal(mixto.resumen.productos_sin_costo,1);
    const parcial=await guardar('cierre','2025-11-30','Norte',mixtas);
    assert.equal(parcial.resumen.valor_conocido,34);
    const fuentes=await informe();
    const motorMixto=require('node:vm').runInNewContext(sql('js/maestro-inventario.js')+';MaestroInventario');
    const reporteMixto=motorMixto.calcular('2025-11',fuentes);
    assert.equal(reporteMixto.aprobable,false);assert.equal(reporteMixto.filas[0].valorFinal,null);
    assert.equal(reporteMixto.filas[0].valorFinalConocido,34);assert.equal(reporteMixto.filas[0].precioVenta,null);
    assert.equal(reporteMixto.fuentes.filter(f=>f.tipo==='Conteo final').length,5);
    await db.exec('RESET ROLE');
    const lotes=async()=>(await db.query('SELECT cantidad_disponible cantidad,costo_unitario costo FROM inventario_lotes ORDER BY id')).rows.map(f=>[Number(f.cantidad),Number(f.costo)]);
    assert.deepEqual(await lotes(),[[10,2],[3,0],[2,7]]);
    assert.equal(await valor('SELECT costo_unitario r FROM inventario'),null);
    await db.exec('SET ROLE authenticated');
    mixtas[2]=partida(6,'caja',4,3);
    const mejora=await guardar('apertura','2025-10-31','Norte',mixtas);
    assert.equal(mejora.resumen.productos_sin_costo,1);assert.equal(mejora.resumen.valor_conocido,46);
    mixtas[4]=partida(8,'caja',1,4);
    const completos=await guardar('apertura','2025-10-31','Norte',mixtas);
    assert.equal(completos.resumen.productos_sin_costo,0);assert.equal(completos.resumen.valor_conocido,50);
    const ya=await importar('apertura','2025-10-31','Norte',mixtas,true);
    assert.equal(ya.lote,completos.lote);
    await db.exec('RESET ROLE');
    assert.deepEqual(await lotes(),[[10,2],[3,0],[2,7],[4,3],[1,4]]);
    assert.equal(Number(await valor('SELECT stock_actual r FROM inventario')),20);
    assert.equal(Number(await valor('SELECT costo_unitario r FROM inventario')),2.5);
    assert.equal(await valor('SELECT count(*)::int r FROM inventario_movimientos'),1);
    await db.exec('ROLLBACK');
    const gasas=fila('Gasas','A',10,0,0,2), sueros=fila('Sueros','B',3,0,0,null);
    await assert.rejects(importar('apertura','2025-10-15','Norte',[gasas]),/primer día/);
    const rechazado=await importar('apertura','2025-10-31','Norte',[gasas,sueros],true,'obsoleta');
    assert.equal(rechazado.cambio,true);
    const apertura=await guardar('apertura','2025-10-31','Norte',[gasas,sueros]);
    assert.equal(apertura.resumen.productos_sin_costo,1);
    assert.equal((await importar('apertura','2025-10-31','Norte',[sueros,gasas],true)).lote,apertura.lote);
    const regrabadas=[sueros,gasas].map(f=>({...f,datos:{...f.datos,fecha_actualizacion:'2025-11-03'}}));
    assert.equal((await importar('apertura','2025-10-31','Norte',regrabadas,true)).lote,apertura.lote);
    const revisado=fila('Sueros','B',3,0,0,1);
    await guardar('apertura','2025-10-31','Norte',[gasas,revisado]);
    await guardar('apertura','2025-10-31','Sur',[fila('Gasas','A',2,0,0,2)]);
    await assert.rejects(guardar('apertura','2025-10-31','Norte',[fila('Gasas','A',11,0,0,2),revisado]),/cantidad/);
    await db.exec('RESET ROLE');
    const productos=(await db.query('SELECT * FROM inventario ORDER BY sku')).rows;
    assert.deepEqual(productos.map(p=>Number(p.stock_actual)),[12,3]);
    assert.equal(Number(productos[1].costo_unitario),1);
    assert.equal(await valor('SELECT count(*)::int r FROM inventario_movimientos'),3);
    assert.equal(await valor('SELECT count(*)::int r FROM inventario_lotes'),3);
    assert.equal(await valor('SELECT sum(cantidad_disponible)::int r FROM inventario_lotes'),15);
    assert.equal(await valor('SELECT count(*)::int r FROM finanzas'),0);
    const id=productos[0].id;
    await db.exec(`INSERT INTO compras (id,clinica_id,fecha,numero_factura) VALUES(1,10,'2025-11-03','F-1');
      INSERT INTO compra_items(compra_id,clinica_id,inventario_id,cantidad,costo_unitario,subtotal) VALUES(1,10,${id},2,2,4);
      INSERT INTO ventas(id,clinica_id,fecha,numero,estado) VALUES(1,10,'2025-11-10','V-1','registrada');
      INSERT INTO venta_items(venta_id,clinica_id,inventario_id,cantidad,costo_unitario,precio_unitario,subtotal) VALUES(1,10,${id},3,2,5,15);
      INSERT INTO inventario_movimientos(clinica_id,inventario_id,fecha,tipo,cantidad,motivo) VALUES
        (10,${id},'2025-11-03','entrada',2,'Compra a Proveedor · Fact. F-1'),(10,${id},'2025-11-10','salida',3,'Venta V-1 · Cliente');
      INSERT INTO ventas(id,clinica_id,fecha,numero,estado) VALUES(2,10,'2025-11-11','V-2','anulada');
      INSERT INTO venta_items(venta_id,clinica_id,inventario_id,cantidad,costo_unitario,precio_unitario,subtotal) VALUES(2,10,${id},2,2,5,10);
      INSERT INTO compras(id,clinica_id,fecha,numero_factura,estado) VALUES(2,10,'2025-11-12','F-2','anulada');
      INSERT INTO compra_items(compra_id,clinica_id,inventario_id,cantidad,costo_unitario,subtotal) VALUES(2,10,${id},1,2,2);
      INSERT INTO inventario_movimientos(clinica_id,inventario_id,fecha,tipo,cantidad,motivo) VALUES
        (10,${id},'2025-11-11','salida',2,'Venta V-2 · Cliente'),(10,${id},'2025-11-12','entrada',2,'Anulación de venta V-2'),
        (10,${id},'2025-11-12','entrada',1,'Compra a Proveedor · Fact. F-2'),(10,${id},'2025-11-12','salida',1,'Anulación de compra a Proveedor · Fact. F-2');
      UPDATE inventario SET stock_actual=stock_actual-1 WHERE id=${id};
      SET ROLE authenticated;`);
    await guardar('cierre','2025-11-30','Norte',[fila('Gasas','A',10,5,6,2),revisado]);
    await assert.rejects(aprobar((await informe()).revision),/bodega/);
    await guardar('cierre','2025-11-30','Sur',[fila('Gasas','A',2,0,0,2)]);
    await db.exec("SELECT guardar_cuenta_libro(10,'5001','Costo vendido','costo'), guardar_cuenta_libro(10,'1101','Inventario','activo')");
    const borrador=await informe();
    assert.equal(borrador.aperturas.length,3);
    assert.equal(borrador.conteos.length,3);
    assert.equal(borrador.ventas.length,1);
    assert.equal(borrador.compras.length,1);
    assert.equal(borrador.incidencias_documentos.length,0);
    assert.equal(borrador.movimientos.filter(m=>m.anulacion_conciliada).length,4);
    // El total mensual sigue cuadrando si se intercambian cantidades entre comprobantes.
    // El servidor también exige la paridad individual de cada documento.
    const permutado=structuredClone(borrador);
    const venta=permutado.ventas[0];
    venta.cantidad=1;
    permutado.ventas.push({...venta,id:99,documento:'V-Otra',cantidad:2});
    const salida=permutado.movimientos.find(m=>m.motivo==='Venta V-1 · Cliente');
    salida.cantidad=2;
    permutado.movimientos.push({...salida,id:99,motivo:'Venta V-Otra · Cliente',cantidad:1});
    await db.exec('RESET ROLE');
    await assert.rejects(valor('SELECT _costo_conciliado_maestro($1) r',[JSON.stringify(permutado)]),/unidades por comprobante/);
    const incompleto=structuredClone(borrador);
    incompleto.conteos[0].costo=null;
    incompleto.conteos[0].costo_total=null;
    await assert.rejects(valor('SELECT _costo_conciliado_maestro($1) r',[JSON.stringify(incompleto)]),/costos/);
    await db.exec('SET ROLE authenticated');
    const motor=require('node:vm').runInNewContext(sql('js/maestro-inventario.js')+';MaestroInventario');
    const maestro=motor.calcular('2025-11',borrador);
    assert.equal(maestro.aprobable,true,maestro.pendientes.join('\n'));
    assert.deepEqual([maestro.totales.costoPeriodico,maestro.totales.costoVentas,maestro.totales.utilidad],[6,6,9]);
    assert.equal(maestro.filas[0].gananciaPct,-2.123456);
    await assert.rejects(ajustar(borrador.revision,9),/costo de ventas/);
    assert.ok(await ajustar(borrador.revision,6));
    await assert.rejects(aprobar(borrador.revision),/cambiaron/);
    const actualizado=await informe();
    await assert.rejects(ajustar(actualizado.revision,6),/Ya existe/);
    const aprobado=await aprobar(actualizado.revision);
    assert.equal(aprobado.aprobado,true);
    assert.deepEqual((await aprobar(actualizado.revision)),aprobado);
    assert.deepEqual((await informe('2025-12-01')).aperturas,aprobado.conteos);
    await assert.rejects(guardar('cierre','2025-11-30','Sur',[fila('Gasas','A',3,0,0,2)]),/aprobado/);
    await db.exec("RESET ROLE; UPDATE inventario SET stock_actual=999; SET ROLE authenticated");
    assert.deepEqual(await informe(),aprobado);
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000001'");
    assert.equal(await valor('SELECT count(*)::int r FROM controles_inventario'),0);
    assert.equal(await valor('SELECT count(*)::int r FROM cierres_maestro'),0);
    await assert.rejects(informe(),/permisos/);
    await assert.rejects(db.exec('DELETE FROM controles_inventario'),/permission denied/);
    console.log('OK · aperturas y costos pendientes, dos bodegas, corte, trazabilidad, ajuste, aprobación y RLS');
  } finally { await db.close(); }
}
probar().catch(e=>{console.error([e.message,e.where,e.detail,e.stack].filter(Boolean).join('\n'));process.exitCode=1;});
