const _fuentesReportesZip = {
  actividad:['citas'],
  finanzas:['finanzas','facturas'],
  inventario:['inventario','inventario_movimientos','compras','proveedores'],
  contabilidad:['finanzas','facturas','compras','proveedores','inventario','inventario_movimientos'],
  empresa:['ventas','clientes_comerciales','inventario_lotes']
};

function _modulosReportesZip(empresa) {
  return [
    !empresa && hasPermiso('estadisticas') && 'actividad',
    hasPermiso('finanzas') && 'finanzas',
    hasPermiso('inventario') && 'inventario',
    hasPermiso('contabilidad') && 'contabilidad'
  ].filter(Boolean);
}

async function descargarReportesZip(boton) {
  if(boton.disabled || !hasPermiso('exportar') || !_exigeClinica()) return;
  const clinica = currentClinicaId;
  const empresa = esEmpresaMedica();
  const modulos = _modulosReportesZip(empresa);
  if(!modulos.length) { toast('Habilita un módulo con reportes para descargar el ZIP.','info'); return; }
  const corte = hoy();
  const nombre = _nombreArchivoBackup('zip').replace(/^lumea-backup-/,'lumea-reportes-');
  const aviso = document.querySelector('#loading-overlay .load-text-op');
  const avisoPrevio = aviso?.textContent;
  const progreso = mensaje => { if(aviso) aviso.textContent = mensaje; };
  boton.disabled = true;
  progreso('Consultando datos de los reportes…');
  setLoading(true);
  try {
    const grupos = empresa && modulos.includes('contabilidad') ? [...modulos,'empresa'] : modulos;
    const fuentes = new Set(grupos.flatMap(g => _fuentesReportesZip[g]));
    const consultas = BACKUP_TABLAS.filter(d => fuentes.has(d.tabla));
    const resultados = await Promise.all(consultas.map(def => _consultarTablaBackup(def,clinica)));
    if(String(clinica) !== String(currentClinicaId)) throw new Error('Cambió el establecimiento activo.');
    const tablas = Object.fromEntries(resultados.filter(r => !r.advertencia).map(r => [r.tabla,r.filas]));
    const informes = _armarReportesZip(tablas,modulos,corte,empresa);
    const archivos = informes.map(({titulo,secciones}) => {
      const aviso = resultados.some(r => r.advertencia)
        ? '<p>Las fuentes opcionales sin habilitar se indican en cada reporte.</p>' : '';
      const cuerpo = _pdfEncabezado(titulo, `Desde el inicio hasta el ${formatFecha(corte)}`) + aviso + secciones.join('');
      return _armarDocumentoPdf(titulo,cuerpo);
    });

    await _cargarScriptExterno(JSZIP_URL, () => !!globalThis.JSZip);
    const zip = new globalThis.JSZip();
    for(const [indice,archivo] of archivos.entries()) {
      if(String(clinica) !== String(currentClinicaId)) throw new Error('Cambió el establecimiento activo.');
      const informarProgreso = mensaje => progreso(`Reporte ${indice+1} de ${archivos.length} · ${archivo.titulo}. ${mensaje}`);
      const pdf = await _descargarHtmlComoPdf({...archivo,paraZip:true,informarProgreso});
      zip.file(_nombreArchivoPdf(archivo.titulo), await pdf.arrayBuffer());
    }
    progreso('Empaquetando los PDF…');
    const empaquetado = await zip.generateAsync({type:'blob'});
    if(String(clinica) !== String(currentClinicaId)) throw new Error('Cambió el establecimiento activo.');
    _descargarArchivo(empaquetado,nombre);
    toast(`ZIP descargado con ${archivos.length} reportes en PDF.`);
    void _notificarReportesRespaldo({clinica:{id:clinica}},'zip');
  } catch(error) {
    toast('No se pudo generar el ZIP de reportes. '+(error.message || ''),'error');
  } finally {
    boton.disabled = false;
    setLoading(false);
    if(aviso) aviso.textContent = avisoPrevio;
  }
}

function _tablaReporteZip(titulo, columnas, filas) {
  return `<div class="section-title">${escAttr(titulo)}</div>` + (!filas.length ? '<p>Sin registros en el período.</p>' :
    `<table style="table-layout:fixed;overflow-wrap:anywhere"><thead><tr>${columnas.map(c => `<th>${escAttr(c)}</th>`).join('')}</tr></thead>
    <tbody>${filas.map(f => `<tr>${f.map(v => `<td>${escAttr(String(v ?? '—'))}</td>`).join('')}</tr>`).join('')}</tbody></table>`);
}

function _armarReportesZip(tablas, modulos, corte, empresa) {
  const informes = [];
  const informe = (titulo,...secciones) => informes.push({titulo,secciones});
  const tabla = _tablaReporteZip;
  const registros = (t,col='fecha') => (tablas[t] || []).filter(r => r[col] && r[col] <= corte)
    .sort((a,b) => a[col].localeCompare(b[col]));
  const nombres = t => new Map((tablas[t] || []).map(r => [r.id,r.nombre]));
  const porNombre = (mapa,id) => mapa.get(id) || '—';
  const fecha = f => f ? formatFecha(f) : '—';
  const suma = (rs, k) => rs.reduce((n,r)=>n+Number(r[k]||0),0);
  const conciliacion = (filas, llave, monto) => {
    const totales = new Map();
    for(const fila of filas) {
      const id = llave(fila);
      totales.set(id,(totales.get(id)||0) + monto(fila));
    }
    return [...totales].sort(([a],[b]) => a.localeCompare(b)).map(([etiqueta,total]) => [etiqueta,fmtC(total)]);
  };
  if(modulos.includes('actividad')) {
    const meses = new Map();
    for(const cita of registros('citas')) {
      const periodo = cita.fecha.slice(0,7);
      const fila = meses.get(periodo) || [periodo,0,0,0];
      fila[1]++;
      if(cita.estado === 'completada') fila[2]++;
      if(cita.estado === 'cancelada') fila[3]++;
      meses.set(periodo,fila);
    }
    informe('Actividad de la clínica',tabla('Citas por mes',['Mes','Total','Completadas','Canceladas'],[...meses.values()]));
  }
  const finanzas = registros('finanzas');
  if(modulos.includes('finanzas')) {
    const ing = suma(finanzas.filter(f => f.tipo === 'ingreso'),'monto');
    const egr = suma(finanzas.filter(f => f.tipo === 'egreso'),'monto');
    informe('Finanzas',
      tabla('Flujo de caja',['Concepto','Monto'],[['Ingresos',fmtC(ing)],['Egresos',fmtC(egr)],['Flujo neto',fmtC(ing-egr)]]),
      tabla('Totales por categoría',['Categoría','Monto'],
        conciliacion(finanzas,f => `${f.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'} · ${_etiquetaCategoria(f.categoria,f.tipo)}`,f => Number(f.monto)||0)),
      tabla('Movimientos financieros',['Fecha','Tipo','Descripción','Referencia','Monto'],finanzas.map(f =>
        [fecha(f.fecha),f.tipo,f.descripcion,f.referencia,fmtC(f.monto)])));
    informe('Documentos de cobro',tabla('Historial de documentos',['Fecha','Número','Estado','Total'],
      registros('facturas').map(f => [fecha(f.fecha),f.numero,f.estado,fmtC(f.total)])));
  }
  const productos = nombres('inventario');
  const proveedores = nombres('proveedores');
  if(modulos.includes('inventario')) {
    informe('Existencias de inventario',tabla('Catálogo al corte',['Producto','Categoría','Unidad','Existencia','Mínimo','Vencimiento'],
      (tablas.inventario || []).map(p => [p.nombre,p.categoria,p.unidad,p.stock_actual,p.stock_minimo,fecha(p.fecha_vencimiento)])));
    informe('Movimientos de inventario',tabla('Entradas y salidas',['Fecha','Producto','Tipo','Cantidad','Motivo'],
      registros('inventario_movimientos').map(m => [fecha(m.fecha),porNombre(productos,m.inventario_id),m.tipo,m.cantidad,m.motivo])));
  }
  const compras = registros('compras').map(r => fromCompra({...r,compra_pagos:(r.compra_pagos || []).filter(p=>p.fecha <= corte)}));
  if(modulos.includes('inventario') || modulos.includes('contabilidad')) {
    informe('Compras y cuentas por pagar',
      tablas.compras ? tabla('Compras',['Fecha','Proveedor','Documento','Estado','Total','Pendiente'],compras.map(c =>
        [fecha(c.fecha),porNombre(proveedores,c.proveedorId),c.numeroFactura,c.estado,fmtC(c.total),fmtC(_saldoCompra(c))]))
        : '<p>El módulo de Compras aún no está habilitado.</p>',
      tabla('Proveedores',['Nombre','Identificación','Estado'],(tablas.proveedores || []).map(p =>
        [p.nombre,p.identificacion,p.activo === false ? 'Inactivo' : 'Activo'])));
  }
  if(modulos.includes('contabilidad')) {
    const ventas = registros('ventas').map(r => fromVenta({...r,venta_cobros:(r.venta_cobros || []).filter(p=>p.fecha <= corte)}));
    const clientes = nombres('clientes_comerciales');
    const vigentes = rs => rs.filter(r=>r.estado !== 'anulada');
    const documentos = vigentes(registros('facturas'));
    informe('Contabilidad',
      tabla('Resumen de documentos y saldos',['Concepto','Monto'],[
        ['Documentos de cobro vigentes',fmtC(suma(documentos,'total'))],
        ['Compras vigentes',tablas.compras ? fmtC(suma(vigentes(compras),'total')) : 'Sin módulo'],
        ['Cuentas por pagar',tablas.compras ? fmtC(compras.reduce((n,c)=>n+_saldoCompra(c),0)) : 'Sin módulo'],
        ...(tablas.ventas ? [
          ['Ventas comerciales vigentes',fmtC(suma(vigentes(ventas),'total'))],
          ['Cuentas comerciales por cobrar',fmtC(ventas.reduce((n,v)=>n+_saldoVenta(v),0))],
          ['IVA en ventas comerciales',fmtC(suma(vigentes(ventas),'iva'))]
        ] : []),
        ['IVA en compras',tablas.compras ? fmtC(suma(vigentes(compras),'iva')) : 'Sin módulo']
      ]));
    if(!empresa || tablas.ventas) {
      const datos = {fin:finanzas.map(fromFin),inv:(tablas.inventario || []).map(fromInv),comp:compras,ventas,
        mov:registros('inventario_movimientos').map(fromMov),lotes:registros('inventario_lotes','fecha_ingreso').map(fromLote)};
      const resultados = _estadoResultados({desde:'',hasta:''},datos,empresa);
      const balance = _balanceGeneral(datos,empresa);
      informe('Estado de resultados',tabla('Resultados del período',['Concepto','Monto'],[
        ...(empresa ? [['Ventas netas',fmtC(resultados.ingresosVentas)]] : []),
        ['Otros ingresos',fmtC(resultados.totOtros)],
        ['Costo de inventario utilizado o vendido',fmtC(resultados.costoVentas)],
        ['Gastos del período',fmtC(resultados.totGastos)],
        ['Resultado neto',fmtC(resultados.neta)]
      ]));
      informe('Balance general',tabla('Balance al corte',['Concepto','Monto'],[
        ['Efectivo',fmtC(balance.efectivo)],['Inventario',fmtC(balance.inventario.total)],
        ['Cuentas por cobrar',fmtC(balance.cxc)],['IVA a favor',fmtC(balance.ivaFavor)],['Activos',fmtC(balance.activos)],
        ['Cuentas por pagar',fmtC(balance.cxp)],['IVA por pagar',fmtC(balance.ivaPorPagar)],['Pasivos',fmtC(balance.pasivos)],
        ['Capital',fmtC(balance.capital)],['Resultados acumulados',fmtC(balance.resultados)],['Patrimonio',fmtC(balance.patrimonio)]
      ]));
    }
    if(tablas.ventas) {
      informe('Ventas y cuentas por cobrar',tabla('Ventas comerciales',
        ['Fecha','Cliente','Documento','Estado','Total','Pendiente'],ventas.map(v =>
          [fecha(v.fecha),porNombre(clientes,v.clienteId),v.numero,v.estado,fmtC(v.total),fmtC(_saldoVenta(v))])));
      const items = vigentes(ventas).flatMap(v => v.items);
      informe('Ganancia por producto',tabla('Utilidad bruta de las ventas vigentes',['Producto','Utilidad'],
        conciliacion(items,i => productos.get(i.invId) || i.descripcion || 'Producto sin nombre',
          i => i.subtotal - i.cantidad*i.costo)));
    }
    if(tablas.inventario_lotes) informe('Existencias por lote',tabla('Inventario al corte',
      ['Ingreso','Producto','Lote','Proveedor','Disponible','Costo unitario'],registros('inventario_lotes','fecha_ingreso').map(l =>
        [fecha(l.fecha_ingreso),porNombre(productos,l.inventario_id),l.lote,porNombre(proveedores,l.proveedor_id),l.cantidad_disponible,fmtC(l.costo_unitario)])));
  }
  return informes;
}
