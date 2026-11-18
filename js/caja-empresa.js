const CajaEmpresa = (() => {
  const el = id => document.getElementById('caja-' + id);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  let consulta = 0;
  let datos;

  function periodoFiscal(archivo) {
    const nombre = archivo.split('/').pop();
    const mes = nombre.match(/\b(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)[a-z]*[ -]?(20\d{2}|\d{2})\b/i);
    if (!mes) throw new Error('No se identifica el mes en ' + nombre);
    return mes[2].padStart(4,'20') + '-' + String(meses.indexOf(mes[1].toLowerCase())+1).padStart(2,'0');
  }

  function ingresoDeclarado(hojas) {
    const etiqueta = fila => String(fila.celdas[0]?.valor || '').toLowerCase().trim();
    const hojasBase = hojas.filter(h => h.filas.some(f => etiqueta(f) === 'base imponible para determinar el iva'));
    if (hojasBase.length !== 1) throw new Error('No se identifica una única base de ingresos de IVA.');
    const filas = hojasBase[0].filas;
    const inicio = filas.findIndex(f => etiqueta(f) === 'base imponible para determinar el iva');
    const fin = filas.findIndex((f,i) => i > inicio && etiqueta(f).startsWith('base imponible'));
    if (fin <= inicio+1) throw new Error('La sección de ingresos está incompleta.');
    let suma = 0, cantidad = 0;
    for (const fila of filas.slice(inicio+1,fin)) {
      const celda = fila.celdas[1];
      if (!celda || celda.valor === '') continue;
      if (!/^ingresos?\b/.test(etiqueta(fila)) || celda.invalida || !Number.isFinite(celda.valor))
        throw new Error('Importe de ingresos inválido en la fila ' + fila.numero);
      suma += celda.valor;
      cantidad++;
    }
    if (!cantidad) throw new Error('La declaración carece de importes de ingresos.');
    return Math.round(suma*100);
  }

  function agruparFecha(fecha,tipo) {
    if (tipo === 'mes') return fecha.slice(0,7);
    if (tipo === 'dia') return fecha;
    const lunes = new Date(fecha+'T12:00:00Z');
    lunes.setUTCDate(lunes.getUTCDate()-(lunes.getUTCDay()+6)%7);
    return lunes.toISOString().slice(0,10);
  }

  async function cargar() {
    const turno = ++consulta, clinica = currentClinicaId;
    const vigente = () => turno === consulta && currentClinicaId === clinica && finTab === 'caja';
    const anterior = datos?.clinica === clinica ? el('anio').value : '';
    if (datos?.clinica !== clinica) el('periodo').value = 'mes';
    datos = null;
    el('anio').replaceChildren();
    el('datos').replaceChildren();
    el('estado').textContent = 'Consultando caja y expediente fiscal…';
    const contable = hasPermiso('contabilidad');
    el('libros').hidden = el('expediente').hidden = !contable;
    try {
      const [movimientos,archivos] = await Promise.all([
        consultarPaginas(() => sb.from('finanzas').select('id,fecha,monto').eq('clinica_id',clinica).eq('tipo','ingreso').order('id')),
        contable ? consultarPaginas(() => sb.from('expediente_fiscal_excel').select('id,archivo,digest')
          .eq('clinica_id',clinica).ilike('archivo','%anticipo%ir%').order('id')) : Promise.resolve({data:[]})
      ]);
      if (!vigente()) return;
      if (movimientos.error || archivos.error) throw movimientos.error || archivos.error;
      const fiscal = new Map(), vistos = new Set(), conflictos = new Set();
      const avisos = [];
      for (const doc of archivos.data) {
        const nombre = doc.archivo.split('/').pop();
        if (!/anticipo[ _-]+ir\b/i.test(nombre) || !/\.xlsx?$/i.test(nombre)) continue;
        try {
          const mes = periodoFiscal(nombre), clave = mes+'|'+doc.digest;
          if (vistos.has(clave)) continue;
          const bytes = await ExcelImportacion.originalFiscal(clinica,doc.id);
          if (!vigente()) return;
          const hojas = await ExcelImportacion.leerArchivo(new File([bytes],nombre));
          if (!vigente()) return;
          const monto = ingresoDeclarado(hojas);
          if (fiscal.has(mes) && fiscal.get(mes) !== monto) conflictos.add(mes);
          fiscal.set(mes,monto);
          vistos.add(clave);
        } catch (error) { avisos.push(nombre+' · '+error.message); }
      }
      if (!vigente()) return;
      for (const mes of conflictos) { fiscal.delete(mes); avisos.push('Versiones con ingresos diferentes para '+mes); }
      datos = {clinica,fiscal,movimientos:movimientos.data,avisos,contable};
      const years = new Set([hoy().slice(0,4),...Array.from(fiscal.keys(),m=>m.slice(0,4)),...movimientos.data.map(r=>r.fecha.slice(0,4))]);
      for (const year of Array.from(years).sort().reverse()) el('anio').add(new Option(year,year));
      if (years.has(anterior)) el('anio').value = anterior;
      mostrar();
    } catch (error) {
      if (vigente()) el('estado').textContent = 'No se pudo consultar Caja. '+error.message;
    }
  }

  function mostrar() {
    if (!datos || datos.clinica !== currentClinicaId) return;
    const year = el('anio').value, tipo = el('periodo').value;
    const fiscal = new Map([...datos.fiscal].filter(([mes]) => mes.startsWith(year+'-')));
    const cobros = new Map();
    for (const r of datos.movimientos.filter(r=>r.fecha.startsWith(year+'-'))) {
      const clave = agruparFecha(r.fecha,tipo);
      cobros.set(clave,(cobros.get(clave)||0)+Math.round(Number(r.monto)*100));
    }
    const total = mapa => fmtC([...mapa.values()].reduce((s,v)=>s+v,0)/100);
    const claves = new Set([...cobros.keys(),...(tipo === 'mes' ? fiscal.keys() : [])]);
    const filas = [...claves].sort().map(k => '<tr><td>'+escAttr(tipo === 'semana' ? 'Semana del '+formatFecha(k) : tipo === 'dia' ? formatFecha(k) : k)+'</td><td>'+
      fmtC((cobros.get(k)||0)/100)+'</td>'+(tipo === 'mes' ? '<td>'+(fiscal.has(k) ? fmtC(fiscal.get(k)/100) : '—')+'</td>' : '')+'</tr>').join('');
    el('datos').innerHTML = '<p>Ingresos de caja registrados en '+year+' · <strong>'+total(cobros)+'</strong></p>'+
      (fiscal.size ? '<p>Ingresos brutos declarados · '+fiscal.size+' mes(es) · <strong>'+total(fiscal)+'</strong></p>' : '')+
      (filas ? '<div class="excel-tabla"><table><thead><tr><th>Período</th><th>Ingresos de caja</th>'+(tipo === 'mes' ? '<th>Ingresos declarados</th>' : '')+
        '</tr></thead><tbody>'+filas+'</tbody></table></div>' : '<p>Sin ingresos de caja fechados para este período.</p>');
    const avisos = [...datos.avisos];
    if (tipo !== 'mes' && fiscal.size) avisos.push('El expediente fiscal respalda cifras mensuales. El detalle diario y semanal usa los movimientos de caja fechados.');
    if (datos.contable && !fiscal.size) avisos.push('Sin plantillas de anticipo IR legibles para el año seleccionado.');
    el('estado').textContent = avisos.join(' · ');
  }

  function abrirLibros() {
    if (datos?.clinica === currentClinicaId) LibroDiario.abrir(el('anio').value);
  }
  return {cargar,mostrar,abrirLibros,periodoFiscal,ingresoDeclarado};
})();
