const LibroDiario = (() => {
  const idModal = 'modal-libro-diario';
  const el = nombre => document.getElementById('libro-diario-'+nombre);
  let consulta = 0;
  let reporte = null;

  // Mantiene precisión de centavos incluso en una balanza con totales grandes.
  function centavos(valor) {
    const [entero,decimales=''] = String(valor ?? '0').split('.');
    return BigInt(entero)*100n + BigInt((decimales+'00').slice(0,2))*(entero.startsWith('-') ? -1n : 1n);
  }

  function moneda(n) {
    const positivo = n < 0n ? -n : n;
    return `C$ ${n < 0n ? '-' : ''}${(positivo/100n).toLocaleString('es-NI')}.${String(positivo%100n).padStart(2,'0')}`;
  }

  async function obtener(clinica,desde,hasta) {
    const balanza = await consultarPaginas(() => sb.rpc('balanza_libro_diario',{
      p_clinica:clinica,p_desde:desde,p_hasta:hasta
    }).order('codigo'));
    if(balanza.error) {
      if(['PGRST202','42P01'].includes(balanza.error.code)) return null;
      throw new Error('La balanza de comprobación no se pudo consultar.');
    }
    const diario = await consultarPaginas(() => sb.from('libro_diario').select('id,fecha,documento,lineas')
      .eq('clinica_id',clinica).gte('fecha',desde).lte('fecha',hasta).order('fecha').order('id'));
    if(diario.error) throw new Error('El libro diario no se pudo consultar.');
    const columnas = ['apertura','debe','haber','saldo'];
    const sumas = columnas.map(c => balanza.data.reduce((s,r) => s + centavos(r[c]),0n));
    const cuentas = balanza.data.map(r => [r.codigo,r.nombre,...columnas.map(c=>moneda(centavos(r[c])))]);
    if(cuentas.length) cuentas.push(['','Totales',...sumas.map(moneda)]);
    const lineas = diario.data.flatMap(a => a.lineas.map(l => [formatFecha(a.fecha),a.documento,l.cuenta,l.nombre_cuenta,
      l.descripcion,l.referencia,moneda(centavos(l.debe)),moneda(centavos(l.haber))]));
    const debeLeido = diario.data.reduce((s,a)=>s+a.lineas.reduce((n,l)=>n+centavos(l.debe),0n),0n);
    const haberLeido = diario.data.reduce((s,a)=>s+a.lineas.reduce((n,l)=>n+centavos(l.haber),0n),0n);
    if(sumas[0] || sumas[3] || sumas[1] !== sumas[2] || sumas[1] !== debeLeido || sumas[2] !== haberLeido)
      throw new Error('El diario y la balanza no coinciden. Vuelve a consultar antes de exportar.');
    return {clinica,desde,hasta,cuentas,lineas};
  }

  function informes(datos) {
    if(!datos?.cuentas.length) return [];
    return [
      {titulo:'Balanza de comprobación',secciones:[_tablaReporteZip('Saldos por cuenta · negativo = acreedor',
        ['Código','Cuenta','Saldo inicial','Debe','Haber','Saldo final'],datos.cuentas)]},
      {titulo:'Libro diario',secciones:[_tablaReporteZip('Asientos del período',
        ['Fecha','Asiento','Código','Cuenta','Detalle','Ref.','Debe','Haber'],datos.lineas)]}
    ];
  }

  async function consultar() {
    const turno = ++consulta;
    const clinica = currentClinicaId;
    const desde = el('desde').value, hasta = el('hasta').value;
    const botones = document.querySelectorAll('#'+idModal+' button[type="submit"]');
    reporte = null;
    el('pdf').hidden = true;
    el('resultados').innerHTML = '';
    if(!desde || !hasta || desde > hasta) {
      el('estado').textContent = 'Elige un rango de fechas válido.';
      return;
    }
    botones.forEach(b => b.disabled = true);
    el('estado').textContent = 'Consultando…';
    try {
      const datos = await obtener(clinica,desde,hasta);
      if(turno !== consulta || clinica !== currentClinicaId) return;
      if(!datos?.cuentas.length) {
        el('estado').textContent = datos ? 'No hay asientos importados hasta esa fecha.' : 'Aplica la migración actualizada de Excel en Supabase.';
        return;
      }
      reporte = datos;
      el('estado').textContent = '';
      el('resultados').innerHTML = informes(datos).map(i => `<h3>${i.titulo}</h3><div class="excel-tabla" tabindex="0" aria-label="${i.titulo}">${i.secciones.join('')}</div>`).join('');
      el('pdf').hidden = false;
    } catch(error) {
      if(turno === consulta) el('estado').textContent = error.message;
    } finally {
      if(turno === consulta) botones.forEach(b => b.disabled = false);
    }
  }

  function abrir() {
    if(!hasPermiso('contabilidad') || !_exigeClinica()) return;
    el('hasta').value = hoy();
    el('desde').value = hoy().slice(0,4)+'-01-01';
    openModalOverlay(idModal);
    void consultar();
  }

  function cerrar() {
    consulta++;
    closeModal(idModal);
    reporte = null;
  }

  function pdf() {
    if(reporte?.clinica !== currentClinicaId) return;
    const periodo = `Del ${formatFecha(reporte.desde)} al ${formatFecha(reporte.hasta)}`;
    return pdfAbrir('Balanza y libro diario',informes(reporte).map(i => _pdfEncabezado(i.titulo,periodo)+i.secciones.join('')).join(''));
  }

  return {abrir,cerrar,consultar,pdf,obtener,informes};
})();
