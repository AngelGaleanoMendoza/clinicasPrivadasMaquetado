const ExcelImportacion = (() => {
  const LIMITE = 1000;
  const TIPOS = {
    finanzas:{permiso:'finanzas', titulo:'Ingresos y gastos independientes', campos:[
      ['id_origen','ID de origen',1,'id externo|id|folio|referencia'],
      ['fecha','Fecha',1,'fecha de pago'],
      ['clase','Tipo de movimiento',1,'tipo|movimiento'],
      ['descripcion','Descripción',1,'concepto|detalle'],
      ['monto','Monto en C$',1,'importe|valor'],
      ['categoria','Categoría',0,'rubro'],
      ['metodo','Método de pago',0,'forma de pago|metodo pago'],
      ['referencia','Referencia bancaria o documental',0,'comprobante|referencia']
    ]},
    productos:{permiso:'inventario', titulo:'Productos nuevos y existencias iniciales', campos:[
      ['nombre','Nombre del producto',1,'producto|nombre|articulo'],
      ['categoria','Categoría',0,''],
      ['unidad','Unidad',0,'unidad de medida'],
      ['stock','Stock inicial',0,'stock|existencia|existencias|cantidad inicial'],
      ['fecha','Fecha de apertura',0,'fecha'],
      ['minimo','Stock mínimo',0,'minimo|stock minimo'],
      ['costo','Costo unitario',0,'costo'],
      ['precio','Precio de venta',0,'precio unitario|precio'],
      ['vencimiento','Vencimiento',0,'fecha de vencimiento'],
      ['descripcion','Descripción',0,'observaciones|detalle']
    ]},
    movimientos:{permiso:'inventario', titulo:'Entradas y salidas de inventario', campos:[
      ['id_origen','ID de origen',1,'id externo|id|folio|referencia'],
      ['producto','Nombre exacto del producto',1,'producto|nombre|articulo'],
      ['fecha','Fecha',1,''],
      ['clase','Tipo de movimiento',1,'tipo|movimiento'],
      ['cantidad','Cantidad',1,'unidades'],
      ['motivo','Motivo',0,'concepto|descripcion']
    ]}
  };
  const CLASES = {ingreso:'ingreso',entrada:'entrada',egreso:'egreso',gasto:'egreso',salida:'salida'};
  const FIN_RESERVADAS = ['compras','ventas','factura'];
  const URL_WORKER = new URL('importar-excel-parser.js?v=1', document.currentScript.src);
  const el = id => document.getElementById('excel-' + id);
  let estado;

  function tiposDisponibles() {
    return Object.keys(TIPOS).filter(t => hasPermiso(TIPOS[t].permiso) && (t !== 'movimientos' || !esEmpresaMedica()));
  }

  function activo(e) {
    return !!e && estado === e && e.clinica === currentClinicaId && e.usuario === currentUser?.id;
  }

  function abrir() {
    if (!currentClinicaId || !tiposDisponibles().length) {
      toast('Selecciona un establecimiento con acceso a Finanzas o Inventario.', 'info');
      return;
    }
    estado = {clinica:currentClinicaId, usuario:currentUser?.id, hojas:[], recibos:[], version:0};
    el('archivos').value = '';
    el('hojas').replaceChildren();
    el('establecimiento').textContent = currentClinica?.nombre || 'Establecimiento activo';
    el('plantilla').innerHTML = tiposDisponibles().map(t => `<option value="${t}">${TIPOS[t].titulo}</option>`).join('');
    el('historial').replaceChildren();
    el('historial-toggle').open = false;
    mensaje('');
    invalidar();
    openModalOverlay('modal-importar-excel');
    el('archivos').focus();
  }

  function cerrar() {
    if (estado?.ocupado === 'guardando') return;
    estado = null;
    el('archivos').value = '';
    el('hojas').replaceChildren();
    el('resultados').replaceChildren();
    el('historial').replaceChildren();
    closeModal('modal-importar-excel');
  }

  function mensaje(texto, error = false) {
    el('estado').textContent = texto;
    el('estado').classList.toggle('excel-error', error);
  }

  function controles() {
    const ocupado = !!estado.ocupado;
    el('archivos').disabled = ocupado;
    el('hojas').disabled = ocupado;
    el('revisar').disabled = ocupado || !estado.hojas.some(h => h.tipo);
    el('confirmar').hidden = !estado.plan;
    el('confirmar').disabled = ocupado;
    el('cerrar').disabled = estado.ocupado === 'guardando';
  }

  function invalidar() {
    estado.version++;
    estado.plan = null;
    el('resultados').replaceChildren();
    controles();
  }

  function leerArchivo(archivo) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(URL_WORKER);
      const terminar = (error, hojas) => {
        clearTimeout(timeout);
        worker.terminate();
        if (error) reject(new Error(error));
        else resolve(hojas);
      };
      const timeout = setTimeout(() => terminar('El archivo tardó demasiado en abrirse.'), 20000);
      worker.onmessage = ({data}) => terminar(data.error, data.hojas);
      worker.onerror = () => terminar('No se pudo iniciar el lector de Excel.');
      archivo.arrayBuffer().then(buffer => worker.postMessage({buffer, nombre:archivo.name}, [buffer]),
        () => terminar('No se pudo leer el archivo.'));
    });
  }

  async function cargar() {
    const e = estado;
    if (!activo(e) || e.ocupado) return;
    const archivos = [...el('archivos').files];
    e.hojas = [];
    invalidar();
    dibujarHojas();
    if (archivos.length > 8 || archivos.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) {
      mensaje('Selecciona hasta 8 archivos con un máximo conjunto de 20 MB.', true);
      return;
    }
    recogerEstado(e, 'leyendo', 'Leyendo las hojas…');
    const errores = [];
    for (const archivo of archivos) {
      if (!activo(e)) return;
      try {
        if (archivo.size > 5 * 1024 * 1024) throw new Error('Supera el máximo de 5 MB por archivo.');
        const hojas = await leerArchivo(archivo);
        e.hojas.push(...hojas.map(h => ({...h, archivo:archivo.name, encabezado:h.filas[0]?.numero, tipo:'', mapa:{}})));
      } catch (error) {
        errores.push(archivo.name + ' · ' + error.message);
      }
    }
    if (!activo(e)) return;
    if (errores.length) e.hojas = [];
    e.ocupado = '';
    dibujarHojas();
    mensaje(errores.join('\n') || (archivos.length ? 'Elige el destino de cada hoja que quieras importar.' : ''), !!errores.length);
    controles();
  }

  function recogerEstado(e, ocupado, texto) {
    e.ocupado = ocupado;
    mensaje(texto);
    controles();
  }

  function normal(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function cabecera(hoja) {
    return hoja.filas.find(f => f.numero === hoja.encabezado)?.celdas || [];
  }

  function autocompletar(hoja) {
    hoja.mapa = {};
    if (!hoja.tipo) return;
    const usadas = new Set();
    for (const [id, rotulo, , alias] of TIPOS[hoja.tipo].campos) {
      const coincidencias = [id, rotulo, ...alias.split('|')].map(normal).filter(Boolean);
      const columnas = [];
      cabecera(hoja).forEach((c, i) => {
        if (!c.invalida && !usadas.has(i) && coincidencias.includes(normal(c.valor))) columnas.push(i);
      });
      if (columnas.length === 1) {
        hoja.mapa[id] = columnas[0];
        usadas.add(columnas[0]);
      }
    }
  }

  function letra(i) {
    const resto = String.fromCharCode(65 + (i % 26));
    return i < 26 ? resto : letra(Math.floor(i / 26) - 1) + resto;
  }

  function dibujarHojas() {
    el('hojas').innerHTML = estado.hojas.map((h, i) => {
      const titulo = escAttr(h.archivo) + ' · ' + escAttr(h.nombre) + (h.oculta ? ' (oculta)' : '');
      if (h.error || !h.filas.length) return `<section class="excel-hoja"><strong>${titulo}</strong><p>${escAttr(h.error || 'Hoja vacía')}</p></section>`;
      const opciones = tiposDisponibles().map(t => `<option value="${t}" ${h.tipo === t ? 'selected' : ''}>${TIPOS[t].titulo}</option>`).join('');
      const columnas = cabecera(h);
      return `<section class="excel-hoja" data-hoja="${i}">
        <strong>${titulo}</strong>
        <div class="excel-grid">
          <label>Destino<select data-campo="tipo"><option value="">Omitir hoja</option>${opciones}</select></label>
          ${h.tipo ? `<label>Fila de encabezados<input type="number" min="1" max="2000" value="${h.encabezado}" data-campo="encabezado"></label>` : ''}
        </div>
        ${h.tipo ? `<div class="excel-grid">${TIPOS[h.tipo].campos.map(([id, nombre, requerido]) => `
          <label>${nombre}${requerido ? ' *' : ''}<select data-mapa="${id}">
            <option value="">${requerido ? 'Elige una columna' : 'Sin asignar'}</option>
            ${columnas.map((c,j) => c.invalida ? '' : `<option value="${j}" ${h.mapa[id] === j ? 'selected' : ''}>${letra(j)} · ${escAttr(c.valor)}</option>`).join('')}
          </select></label>`).join('')}</div><p>${h.tipo === 'finanzas'
            ? 'Usa ingreso o egreso. Las compras, ventas y facturas vinculadas se registran en sus módulos.'
            : h.tipo === 'productos'
              ? 'Si hay stock inicial, indica su fecha y costo unitario. Los productos existentes conservan su stock.'
              : 'Usa entrada o salida. Escribe el nombre del producto tal como aparece en el catálogo.'}</p>` : ''}
      </section>`;
    }).join('');
  }

  function cambiar(evento) {
    const control = evento.target;
    const tarjeta = control.closest('[data-hoja]');
    if (!tarjeta || !activo(estado)) return;
    const hoja = estado.hojas[Number(tarjeta.dataset.hoja)];
    if (control.dataset.mapa) {
      if (control.value === '') delete hoja.mapa[control.dataset.mapa];
      else hoja.mapa[control.dataset.mapa] = Number(control.value);
      invalidar();
      mensaje('');
      return;
    }
    if (control.dataset.campo === 'tipo') hoja.tipo = control.value;
    else if (control.dataset.campo === 'encabezado') hoja.encabezado = Number(control.value);
    else return;
    autocompletar(hoja);
    invalidar();
    mensaje('');
    dibujarHojas();
    el('hojas').querySelector(`[data-hoja="${tarjeta.dataset.hoja}"] [data-campo="${control.dataset.campo}"]`)?.focus();
  }

  function texto(celda, formato = false) {
    if (celda?.invalida) throw new Error('Copia la celda como valor. Contiene una fórmula o un error de Excel.');
    if (celda == null) return '';
    if (!['string','number'].includes(typeof celda.valor)) throw new Error('Usa texto o un número.');
    if (formato && typeof celda.valor === 'number' && (!Number.isInteger(celda.valor) || Math.abs(celda.valor) >= 1e15))
      throw new Error('Guarda el identificador como texto en Excel.');
    return String(formato ? celda.texto ?? celda.valor : celda.valor).trim();
  }

  function decimal(celda, precision) {
    const valor = texto(celda);
    if (!valor) return null;
    // Las cifras de Excel se leen como números. Para texto solo se admite un separador decimal.
    const canon = valor.replace(',', '.');
    const patron = new RegExp(`^\\d+(?:\\.\\d{1,${precision}})?$`);
    if (!patron.test(canon) || Number(canon) >= 1e9 ||
        (typeof celda.valor === 'string' && /^\d{1,3},\d{3}$/.test(valor)))
      throw new Error(`Usa un número de hasta ${precision} decimales, sin separadores de miles ni símbolo de moneda.`);
    return Number(canon);
  }

  function fecha(celda, fecha1904) {
    const valor = texto(celda);
    if (!valor) return null;
    let iso = valor;
    if (typeof celda.valor === 'number') {
      if (!Number.isInteger(celda.valor) || celda.valor < (fecha1904 ? 0 : 1) || (!fecha1904 && celda.valor === 60) || celda.valor > 2958465)
        throw new Error('Fecha de Excel inválida. Usa una fecha sin hora.');
      const base = fecha1904 ? Date.UTC(1904,0,1) : Date.UTC(1899,11,celda.valor < 60 ? 31 : 30);
      iso = new Date(base + celda.valor * 86400000).toISOString().slice(0,10);
    } else {
      const latina = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(valor);
      if (latina) iso = [latina[3],latina[2].padStart(2,'0'),latina[1].padStart(2,'0')].join('-');
    }
    const dia = new Date(iso + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(+dia) || dia.toISOString().slice(0,10) !== iso)
      throw new Error('Usa una fecha válida en formato AAAA-MM-DD o DD/MM/AAAA.');
    return iso;
  }

  function categoria(entrada, clase) {
    if (!entrada) return 'general';
    const lista = _categoriasFin(clase);
    const exacta = lista.find(c => c.id === entrada);
    const opciones = lista.filter(c => [c.id,c.label].some(v => normal(v) === normal(entrada)));
    const cat = exacta || (opciones.length === 1 ? opciones[0] : null);
    if (!cat) throw new Error('Elige una categoría existente para este tipo de movimiento.');
    if (FIN_RESERVADAS.includes(cat.id)) throw new Error('Esta categoría corresponde a documentos vinculados.');
    return cat.id;
  }

  function normalizar(hoja, fila) {
    const datos = {};
    for (const [id, rotulo, obligatorio] of TIPOS[hoja.tipo].campos) {
      const celda = fila.celdas[hoja.mapa[id]];
      try {
        let valor;
        if (['fecha','vencimiento'].includes(id)) valor = fecha(celda, hoja.fecha1904);
        else if (['monto','costo','precio','stock','minimo','cantidad'].includes(id)) {
          valor = decimal(celda, ({monto:2,costo:4,precio:2})[id] || 3);
        } else {
          valor = texto(celda, ['id_origen','referencia'].includes(id));
          if (id === 'clase') valor = CLASES[normal(valor)] || '';
          if (id === 'metodo' && valor) valor = normal(valor).replace(' bancario', '').replace(' bancaria', '').replace(/ /g,'_');
          if (hoja.tipo === 'productos' && ['unidad','categoria'].includes(id) && valor)
            valor = ({'material medico':'material','insumo de limpieza':'insumo',mililitro:'ml'})[normal(valor)] || normal(valor);
        }
        if (obligatorio && (valor === null || valor === '')) throw new Error('Falta un valor válido.');
        if (valor !== null && valor !== '') datos[id] = valor;
      } catch (error) {
        throw new Error(rotulo + ' · ' + error.message);
      }
    }
    if (hoja.tipo === 'finanzas') datos.categoria = categoria(datos.categoria,datos.clase);
    return {tipo:hoja.tipo, archivo:hoja.archivo, hoja:hoja.nombre, fila:fila.numero, datos};
  }

  function preparar() {
    const filas = [], errores = [];
    for (const h of estado.hojas.filter(h => h.tipo)) {
      const origen = {archivo:h.archivo, hoja:h.nombre, fila:h.encabezado};
      const obligatorios = TIPOS[h.tipo].campos.filter(([id,,r]) => r && h.mapa[id] == null).map(([,nombre]) => nombre);
      if (obligatorios.length || new Set(Object.values(h.mapa)).size !== Object.values(h.mapa).length) {
        errores.push({...origen, error:obligatorios.length ? 'Asigna ' + obligatorios.join(', ') + '.' : 'Asigna una columna distinta a cada campo.'});
        continue;
      }
      const candidatas = h.filas.filter(f => f.numero > h.encabezado);
      if (!candidatas.length) errores.push({...origen, error:'La hoja no tiene datos después del encabezado.'});
      for (const fila of candidatas) {
        try { filas.push(normalizar(h,fila)); }
        catch (error) { errores.push({...origen, fila:fila.numero, error:error.message}); }
      }
    }
    return {filas, errores};
  }

  function resultados(entradas, resumen = null) {
    const omitidas = estado.hojas.filter(h => !h.tipo).length;
    const montos = resumen ? `<p class="excel-totales">${resumen.nuevas} nuevas · ${resumen.duplicadas} ya registradas · ${resumen.errores} con errores
      ${omitidas ? `<br>Hojas omitidas: ${omitidas}` : ''}${resumen.finanzas
      ? `<br>Ingresos ${fmtC(resumen.ingresos)} · Gastos ${fmtC(resumen.egresos)}` : ''}</p>` : '';
    el('resultados').innerHTML = montos + (entradas.length ? `<div class="excel-tabla" tabindex="0" aria-label="Detalle de filas"><table>
      <thead><tr><th>Archivo y hoja</th><th>Fila</th><th>Registro</th><th>Resultado</th></tr></thead>
      <tbody>${entradas.map(r => `<tr><td>${escAttr(r.archivo)}<br>${escAttr(r.hoja)}</td><td>${escAttr(r.fila)}</td>
        <td>${escAttr(r.detalle || '')}</td><td class="${r.error ? 'excel-error' : ''}">${escAttr(r.error || (r.estado === 'duplicada' ? 'Ya registrada' : r.registro_id ? 'Guardada' : 'Lista para guardar'))}</td></tr>`).join('')}</tbody>
      </table></div>` : '');
  }

  async function solicitar(e, confirmar) {
    if (!activo(e) || e.ocupado) return;
    const version = e.version;
    const plan = confirmar ? e.plan : preparar();
    if (!plan) return;
    if (!confirmar && (plan.errores.length || !plan.filas.length || plan.filas.length > LIMITE)) {
      resultados(plan.errores);
      mensaje(plan.filas.length > LIMITE ? 'Divide la carga en grupos de hasta 1,000 filas.' : 'Corrige los errores de la revisión.', true);
      return;
    }
    recogerEstado(e, confirmar ? 'guardando' : 'validando', confirmar ? 'Guardando la importación…' : 'Validando con el establecimiento…');
    try {
      const {data, error} = await sb.rpc('importar_excel', {
        p_clinica:e.clinica, p_filas:plan.filas, p_confirmar:confirmar,
        p_revision:confirmar ? plan.revision : null
      });
      if (!activo(e) || version !== e.version) return;
      if (error?.code === 'PGRST202' || error?.code === '42883') throw new Error('Falta aplicar la migración de importación de Excel en Supabase.');
      if (error) throw new Error(error.message);
      resultados(data.filas, data.resumen);
      e.plan = !data.resumen.errores && data.resumen.nuevas && (!confirmar || data.cambio)
        ? {...plan, revision:data.revision} : null;
      if (data.resumen.errores) mensaje('Hay filas que requieren corrección. La carga sigue sin guardar.', true);
      else if (data.cambio) mensaje('Cambió el resultado desde la última revisión. Comprueba el detalle actualizado antes de guardar.', true);
      else if (confirmar && data.lote) {
        mensaje('Importación guardada. Comprobante ' + data.lote + '.');
        if (el('historial-toggle').open) await historial();
        else el('historial-toggle').open = true;
        await loadAll();
        if (activo(e)) {
          if (currentView === 'finanzas') renderFinanzas();
          else renderView(currentView);
        }
      } else if (data.resumen.nuevas) mensaje('Comprueba las filas y los importes antes de guardar.');
      else mensaje('Todas las filas ya están registradas. Consulta sus comprobantes en el historial.');
    } catch (error) {
      if (activo(e)) mensaje(error.message || 'No se pudo completar la importación.', true);
    } finally {
      if (activo(e)) { e.ocupado = ''; controles(); }
    }
  }

  function descargar(contenido, nombre, tipo) {
    const url = URL.createObjectURL(new Blob([contenido], {type:tipo}));
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    enlace.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function plantilla() {
    const tipo = el('plantilla').value;
    if (!TIPOS[tipo]) return;
    descargar('\ufeff' + TIPOS[tipo].campos.map(([id]) => id).join(';') + '\r\n', tipo + '.csv', 'text/csv;charset=utf-8');
  }

  async function historial() {
    const e = estado;
    if (!e || !activo(e) || !el('historial-toggle').open) return;
    el('historial').textContent = 'Cargando comprobantes…';
    const {data,error} = await sb.from('importaciones_excel').select('id,creado_en,resumen').eq('clinica_id',e.clinica)
      .order('creado_en',{ascending:false}).limit(25);
    if (!activo(e)) return;
    if (error) {
      el('historial').textContent = 'No se pudo consultar el historial. Verifica que la migración esté aplicada.';
      return;
    }
    e.recibos = data;
    el('historial').innerHTML = data.map((l,i) => `<div class="excel-recibo"><span>${escAttr(new Date(l.creado_en).toLocaleString('es'))} · ${Number(l.resumen.nuevas)} filas</span>
      <button type="button" class="btn btn-secondary btn-sm" onclick="ExcelImportacion.comprobante(${i})">Descargar comprobante</button></div>`).join('')
      || 'Todavía no hay importaciones guardadas.';
  }

  async function comprobante(indice) {
    const e = estado;
    const lote = e?.recibos[indice];
    if (!lote || !activo(e)) return;
    const {data,error} = await consultarPaginas(() => sb.from('importaciones_excel_filas')
      .select('archivo,hoja,fila,tipo,clave,datos,registro_id,movimiento_inicial_id').eq('clinica_id',e.clinica).eq('lote_id',lote.id).order('ordinal'));
    if (!activo(e)) return;
    if (error || data.length !== lote.resumen.nuevas) {
      mensaje('No se pudo descargar el comprobante completo.', true);
      return;
    }
    descargar(JSON.stringify({...lote, filas:data}, null, 2), 'importacion-' + lote.id + '.json', 'application/json');
  }

  return {abrir,cerrar,cargar,cambiar,plantilla,historial,comprobante,
    revisar:() => estado && solicitar(estado,false),
    confirmar:() => estado && solicitar(estado,true)};
})();
