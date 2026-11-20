const ExcelImportacion = (() => {
  const LIMITE = 1000;
  const COSTOS = [
    ['costo','Costo unitario',0,'costo|costo promedio|costo unitario promedio|costo por unidad|precio de compra|p compra|precio costo|costo de adquisicion unitario|coste unitario'],
    ['costo_total','Valor total al costo',0,'costo total|coste total|valor a costo|valor al costo|valor total al costo|importe al costo|valor de inventario|valor del inventario|existencia valorizada|costo extendido'],
    ['moneda','Moneda del costo',0,'moneda|divisa|currency|codigo de moneda']
  ];
  const NOMBRE_PRODUCTO = 'producto|nombre|articulo|item|insumo|medicamento|nombre del producto|nombre de producto|nombre producto|nombre del articulo|nombre articulo|nombre comercial|descripcion del producto|descripcion de producto|descripcion producto|descripcion del articulo|descripcion de articulo|descripcion articulo|descripcion';
  const SKU = ['sku','SKU o código de producto',0,'sku|codigo|cod|codigo sku|codigo interno|codigo articulo|codigo de articulo|codigo producto|codigo de producto|codigo del producto|codigo del articulo|cod producto|cod articulo|referencia del producto'];
  const UNIDAD = ['unidad','Unidad',0,'unidad de medida|um|u m|presentacion|medida'];
  const COSTOS_KARDEX = ['entrada','salida'].flatMap(clase => [
    ['costo_unitario_' + clase,'Costo unitario de ' + clase,0,
      `costo unitario ${clase}|costo unitario ${clase}s|costo unitario de ${clase}s|costo unitario de las ${clase}s|${clase} costo unitario|${clase}s costo unitario`],
    ['costo_total_' + clase,'Costo total de ' + clase,0,
      `costo total ${clase}|costo total ${clase}s|costo total de ${clase}s|costo total de las ${clase}s|${clase} costo total|${clase}s costo total|valor al costo de ${clase}s`]
  ]);
  const CAMPOS_MONETARIOS_INV = ['costo','costo_total','precio','precio_compra','margen_ganancia', ...COSTOS_KARDEX.map(c => c[0])];
  // Cada destino: [id, rótulo, obligatorio, encabezados con que suele aparecer].
  // «obligatorio» 2 = se exige, pero el sistema puede completarlo (ver faltantes()).
  const TIPOS = {
    diario:{permiso:'contabilidad', titulo:'Asientos del libro diario', pista:'diario|asientos|comprobantes contables', campos:[
      ['documento','Número de asiento',1,'asiento|numero asiento|id asiento|comprobante|partida|no partida'],
      ['fecha','Fecha contable',1,'fecha|fecha asiento'],
      ['cuenta','Código de cuenta',1,'codigo cuenta|codigo contable|codigo|cuenta contable'],
      ['nombre_cuenta','Nombre de cuenta',1,'nombre cuenta|nombre de la cuenta|cuenta|denominacion'],
      ['debe','Debe',1,'debito|debitos|cargo|debe c'],
      ['haber','Haber',1,'credito|creditos|abono|haber c'],
      ['descripcion','Concepto',0,'descripcion|detalle|glosa|observaciones'],
      ['referencia','Referencia documental',0,'referencia|factura|documento origen']
    ]},
    finanzas:{permiso:'finanzas', titulo:'Ingresos y gastos', pista:'caja|finanzas|ingresos|egresos|gastos|libro diario|bancos|banco|flujo', campos:[
      ['id_origen','ID de origen',0,'id externo|id|folio|correlativo|no|n|num'],
      ['fecha','Fecha',1,'fecha de pago|fecha del movimiento|dia|fecha de registro'],
      ['clase','Tipo de movimiento',2,'tipo|movimiento|tipo de movimiento|clase|naturaleza'],
      ['descripcion','Descripción',1,'concepto|detalle|glosa|motivo|observacion|observaciones|descripcion del gasto'],
      ['monto','Monto en C$',2,'importe|valor|total|monto c|monto total'],
      ['monto_ingreso','Columna de ingresos',0,'ingreso|ingresos|entrada|entradas|cobros|credito c'],
      ['monto_egreso','Columna de gastos',0,'egreso|egresos|gasto|gastos|salida|salidas|pagos|debito c'],
      ['categoria','Categoría',0,'rubro|cuenta|clasificacion|categoria del gasto'],
      ['metodo','Método de pago',0,'forma de pago|metodo pago|medio de pago|metodo'],
      ['referencia','Referencia bancaria o documental',0,'comprobante|referencia|recibo|factura|documento|no documento|cheque']
    ]},
    productos:{permiso:'inventario', titulo:'Productos y existencias iniciales', pista:'productos|producto|inventario|catalogo|existencias|articulos|stock|insumos|medicamentos', campos:[
      ['nombre','Nombre del producto',1,NOMBRE_PRODUCTO],
      SKU,
      ['categoria','Categoría',0,'familia|grupo|linea|tipo de producto'],
      UNIDAD,
      ['stock','Stock inicial',0,'stock|existencia|existencias|cantidad|unidades|cantidad inicial|stock actual|disponible|inventario inicial|existencia inicial|existencia actual|existencia final|saldo en unidades|stock disponible|cantidad disponible|unidades disponibles|cantidad en existencia'],
      ['fecha','Fecha de apertura',0,'fecha|fecha de inventario|fecha de corte'],
      ['minimo','Stock mínimo',0,'minimo|stock minimo|existencia minima|punto de reorden'],
      ...COSTOS,
      ['precio','Precio de venta',0,'precio unitario|precio|p venta|pvp|precio venta|precio de venta c'],
      ['vencimiento','Vencimiento',0,'fecha de vencimiento|caducidad|vence|expira'],
      ['descripcion','Descripción',0,'observaciones|detalle|notas|comentarios']
    ]},
    control_inventario:{permiso:'inventario',soloEmpresa:true,titulo:'Control de inventario de bodega',pista:'control de inventario|conteo de bodega',campos:[
      ['nombre','Descripción del artículo',1,NOMBRE_PRODUCTO],SKU,
      ['categoria','Categoría',0,'familia|grupo|linea'],['unidad','Unidad de medida',1,UNIDAD[3]],
      ['inicial','Existencia inicial',1,'inventario inicial|saldo anterior|saldo inicial|unidades iniciales'],
      ['entradas','Entradas',1,'entrada|unidades de entrada|unidades entradas'],
      ['salidas','Salidas',1,'salida|unidades de salida|unidades salidas'],
      ['actual','Existencia actual',1,'existencia final|inventario final|saldo unidades|saldo en unidades|conteo final'],
      ['costo','Costo unitario',0,'costo por unidad|costo promedio'],
      ['costo_total','Valor total del inventario',0,'valor total inventario|valor al costo|costo total'],
      ['precio_compra','Precio de compra',0,'precio compra'],['precio','Precio de venta',0,'precio venta'],
      ['ganancia_pct','Porcentaje de ganancia',0,'ganancia porcentual|porcentaje ganancia'],
      ['margen_ganancia','Margen de ganancia',0,'margen de ganancia por unidad'],
      ['moneda','Moneda del costo',0,'moneda|divisa']
    ]},
    movimientos:{permiso:'inventario', titulo:'Entradas y salidas de inventario', pista:'movimientos de inventario|entradas|salidas|kardex|consumo', campos:[
      ['id_origen','ID de origen',0,'id externo|id|folio|correlativo|no|n'],
      ['producto','Nombre exacto del producto',1,NOMBRE_PRODUCTO],
      SKU,
      UNIDAD,
      ['fecha','Fecha',1,'fecha del movimiento|dia'],
      ['clase','Tipo de movimiento',2,'tipo|movimiento|tipo de movimiento|clase'],
      ['cantidad','Cantidad',2,'unidades|cant|cantidad movida'],
      ['cant_entrada','Unidades de entrada',0,'entrada|entradas|cantidad entrada|cantidad de entrada|unidades entradas|entradas unidades'],
      ['cant_salida','Unidades de salida',0,'salida|salidas|cantidad salida|cantidad de salida|unidades salidas|salidas unidades'],
      ...COSTOS,
      ...COSTOS_KARDEX,
      ['motivo','Motivo',0,'concepto|descripcion|observacion|observaciones']
    ]},
    proveedores:{permiso:'inventario', titulo:'Proveedores', pista:'proveedores|proveedor|distribuidores|suplidores|laboratorios', campos:[
      ['nombre','Nombre o razón social',1,'proveedor|nombre del proveedor|razon social|nombre|distribuidor|laboratorio|empresa'],
      ['identificacion','RUC o cédula',0,'ruc|cedula|nit|no ruc|numero ruc|identificacion fiscal'],
      ['contacto','Persona de contacto',0,'contacto|vendedor|representante|agente|ejecutivo'],
      ['telefono','Teléfono',0,'telefono|tel|celular|movil|telefonos|whatsapp'],
      ['email','Correo',0,'correo|email|e mail|correo electronico|mail'],
      ['direccion','Dirección',0,'direccion|domicilio|ubicacion|ciudad'],
      ['notas','Notas',0,'notas|observaciones|comentarios|condiciones']
    ]},
    clientes:{permiso:'contabilidad', soloEmpresa:true, titulo:'Clientes', pista:'clientes|cliente|cartera de clientes', campos:[
      ['nombre','Nombre o razón social',1,'cliente|nombre del cliente|razon social|nombre|institucion|empresa'],
      ['identificacion','RUC o cédula',0,'ruc|cedula|nit|no ruc|numero ruc|identificacion fiscal'],
      ['contacto','Persona de contacto',0,'contacto|comprador|representante|encargado'],
      ['telefono','Teléfono',0,'telefono|tel|celular|movil|telefonos|whatsapp'],
      ['email','Correo',0,'correo|email|e mail|correo electronico|mail'],
      ['direccion','Dirección',0,'direccion|domicilio|ubicacion|ciudad'],
      ['dias_credito','Días de crédito',0,'dias de credito|plazo|plazo de credito|dias credito|credito dias|dias'],
      ['notas','Notas',0,'notas|observaciones|comentarios']
    ]},
    facturas:{permiso:'contabilidad', soloEmpresa:true, titulo:'Facturas históricas de venta', pista:'facturas|facturas de venta|ventas historicas|detalle de facturas', campos:[
      ['documento','Número de factura',1,'factura|no factura|numero de factura|folio'],
      ['nombre','Cliente',1,'cliente|nombre del cliente|razon social'],
      ['fecha','Fecha de emisión',1,'fecha|fecha de factura|fecha emision'],
      ['descripcion','Descripción de la línea',1,'descripcion|detalle|producto|servicio|concepto'],
      ['cantidad','Cantidad',1,'unidades|cant'],
      ['precio_linea','Precio unitario sin IVA',1,'precio unitario|precio'],
      ['costo_linea','Costo unitario histórico',1,'costo unitario|costo'],
      ['iva_pct','IVA % de la factura',1,'iva pct|porcentaje iva|tasa iva'],
      ['total_factura','Total de la factura',1,'total factura|total documento'],
      ['vencimiento','Vencimiento',0,'fecha de vencimiento|vence'],
      ['fecha_pago','Fecha de cobro completo',0,'fecha de cobro|fecha pago|fecha de pago']
    ]},
    cxc:{permiso:'contabilidad', soloEmpresa:true, titulo:'Saldos pendientes de clientes (por cobrar)', pista:'cuentas por cobrar|por cobrar|cxc|cartera|saldos de clientes|cobrar|antiguedad de saldos', campos:[
      ['nombre','Cliente',1,'cliente|nombre del cliente|razon social'],
      ['documento','N.º de documento',1,'documento|factura|no factura|numero de factura|n factura|no documento|folio'],
      ['fecha','Fecha del documento',1,'fecha|fecha de factura|fecha emision|emision|fecha documento'],
      ['vencimiento','Vencimiento',0,'vencimiento|fecha de vencimiento|vence|fecha vence'],
      ['saldo','Saldo pendiente',1,'saldo|saldo pendiente|pendiente|por cobrar|monto pendiente|debe|deuda|saldo c']
    ]},
    cxp:{permiso:'inventario', titulo:'Saldos pendientes con proveedores (por pagar)', pista:'cuentas por pagar|por pagar|cxp|saldos de proveedores|pagar|deudas|obligaciones', campos:[
      ['nombre','Proveedor',1,'proveedor|nombre del proveedor|razon social'],
      ['documento','N.º de documento',1,'documento|factura|no factura|numero de factura|n factura|no documento|folio'],
      ['fecha','Fecha del documento',1,'fecha|fecha de factura|fecha emision|emision|fecha documento'],
      ['vencimiento','Vencimiento',0,'vencimiento|fecha de vencimiento|vence|fecha vence'],
      ['saldo','Saldo pendiente',1,'saldo|saldo pendiente|pendiente|por pagar|monto pendiente|deuda|saldo c']
    ]}
  };
  // Lo que debe tener una hoja, como mínimo, para reconocerla sin preguntar.
  const NUCLEO = {
    diario:m => ['documento','fecha','cuenta','nombre_cuenta','debe','haber'].every(k => m[k] != null),
    finanzas:m => m.fecha != null && m.descripcion != null && (m.monto != null || m.monto_ingreso != null || m.monto_egreso != null),
    productos:m => m.nombre != null && ['stock','costo','costo_total','precio','unidad','sku'].some(k => m[k] != null),
    control_inventario:m => ['nombre','inicial','entradas','salidas','actual'].every(k => m[k] != null),
    movimientos:m => m.producto != null && m.fecha != null && ['cantidad','cant_entrada','cant_salida'].some(k => m[k] != null),
    proveedores:m => m.nombre != null && ['identificacion','telefono','contacto','email','direccion'].some(k => m[k] != null),
    clientes:m => m.nombre != null && ['identificacion','telefono','contacto','email','direccion','dias_credito'].some(k => m[k] != null),
    facturas:m => ['documento','nombre','fecha','descripcion','cantidad','precio_linea','costo_linea','iva_pct','total_factura'].every(k => m[k] != null),
    cxc:m => ['nombre','documento','fecha','saldo'].every(k => m[k] != null),
    cxp:m => ['nombre','documento','fecha','saldo'].every(k => m[k] != null)
  };
  const CLASES = {
    finanzas:{ingreso:'ingreso',ingresos:'ingreso',entrada:'ingreso',entradas:'ingreso',cobro:'ingreso',i:'ingreso',
      egreso:'egreso',egresos:'egreso',gasto:'egreso',gastos:'egreso',salida:'egreso',salidas:'egreso',pago:'egreso',e:'egreso',g:'egreso'},
    movimientos:{entrada:'entrada',entradas:'entrada',ingreso:'entrada',compra:'entrada',e:'entrada',
      salida:'salida',salidas:'salida',egreso:'salida',consumo:'salida',merma:'salida',venta:'salida',despacho:'salida',s:'salida'}
  };
  const METODOS = {efectivo:'efectivo',contado:'efectivo',cash:'efectivo',caja:'efectivo',
    transferencia:'transferencia','transferencia bancaria':'transferencia',deposito:'transferencia','deposito bancario':'transferencia',banco:'transferencia',
    tarjeta:'tarjeta','tarjeta de credito':'tarjeta','tarjeta de debito':'tarjeta',pos:'tarjeta',
    cheque:'cheque',otro:'otro',otros:'otro'};
  const UNIDADES = {unidad:'unidad',unidades:'unidad',und:'unidad',un:'unidad',u:'unidad',pieza:'unidad',piezas:'unidad',pza:'unidad',
    caja:'caja',cajas:'caja',cj:'caja',blister:'blister',blisteres:'blister',frasco:'frasco',frascos:'frasco',fco:'frasco',ampolla:'ampolla',ampollas:'ampolla',amp:'ampolla',
    tableta:'tableta',tabletas:'tableta',tab:'tableta',comprimido:'tableta',comprimidos:'tableta',rollo:'rollo',rollos:'rollo',
    litro:'litro',litros:'litro',lt:'litro',l:'litro',ml:'ml',mililitro:'ml',mililitros:'ml',par:'par',pares:'par',
    paquete:'paquete',paquetes:'paquete',paq:'paquete',pqt:'paquete'};
  const CATEGORIAS_INV = {medicamento:'medicamento',medicamentos:'medicamento',farmaco:'medicamento',farmacos:'medicamento',
    material:'material','material medico':'material','materiales':'material',equipo:'equipo',equipos:'equipo',
    insumo:'insumo',insumos:'insumo','insumo de limpieza':'insumo',limpieza:'insumo',papeleria:'papeleria',general:'general'};
  const TOTALES = new Set(['total','totales','subtotal','sub total','gran total','total general','suma','sumas']);
  const FIN_RESERVADAS = ['compras','ventas','factura'];
  const URL_WORKER = new URL('importar-excel-parser.js?v=3', document.currentScript.src);
  const el = id => document.getElementById('excel-' + id);
  let estado;

  function tiposDisponibles() {
    return Object.keys(TIPOS).filter(t => hasPermiso(TIPOS[t].permiso) &&
      (!TIPOS[t].soloEmpresa || esEmpresaMedica()));
  }

  function activo(e) {
    return !!e && estado === e && e.clinica === currentClinicaId && e.usuario === currentUser?.id;
  }

  function abrir(origen, mes) {
    if (!currentClinicaId || !tiposDisponibles().length) {
      toast('Selecciona un establecimiento con acceso a Finanzas, Inventario o Contabilidad.', 'info');
      return;
    }
    estado = {clinica:currentClinicaId, usuario:currentUser?.id, hojas:[], recibos:[], respaldos:[], documentos:[], version:0, fechaApertura:hoy(),
      desdeInventario:origen==='inventario' && esEmpresaMedica() && hasPermiso('inventario'),mes};
    el('fecha-apertura').value = estado.fechaApertura;
    reiniciarControl();
    el('carpeta').value = '';
    el('archivos').value = '';
    el('hojas').replaceChildren();
    el('plantilla').innerHTML = tiposDisponibles().map(t => `<option value="${t}">${TIPOS[t].titulo}</option>`).join('');
    el('historial').replaceChildren();
    el('historial-toggle').open = false;
    mensaje('');
    invalidar();
    openModalOverlay('modal-importar-excel');
    el('documentos').textContent = '';
    el('expediente-resumen').textContent = 'Expediente fiscal';
    el('situacion').textContent = '';
    if (hasPermiso('contabilidad')) leerExpediente(estado);
    el('archivos').focus();
  }

  function cerrar() {
    if (estado?.ocupado === 'guardando') return;
    clearTimeout(estado?.revisionPendiente);
    estado = null;
    el('carpeta').value = '';
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
    const simple = soloControl(estado);
    const entradaInventario = simple || (estado.desdeInventario && !estado.hojas.length && !estado.respaldos.length);
    const revisarColumnas = simple && estado.hojas.some(h=>h.tipo && faltantes(h).length);
    el('titulo').textContent = entradaInventario ? 'Cargar inventario' : 'Importar Excel';
    el('archivo-etiqueta').textContent = entradaInventario ? 'Archivo de inventario' : 'Excel y anexos del expediente';
    el('establecimiento').textContent = (currentClinica?.nombre || 'Establecimiento activo')+
      (entradaInventario ? '' : ' · Sube los archivos y el sistema reconoce qué contiene cada hoja.');
    el('carpeta-campo').hidden = el('plantilla-campo').hidden = entradaInventario;
    el('hojas').hidden = simple && !revisarColumnas;
    el('situacion').hidden = entradaInventario;
    el('expediente').hidden = entradaInventario || !hasPermiso('contabilidad');
    el('historial-toggle').hidden = entradaInventario;
    el('fecha-apertura-campo').hidden = !estado.hojas.some(h => h.tipo === 'productos');
    el('fecha-apertura').disabled = ocupado;
    el('control').hidden = !estado.hojas.some(h => h.tipo === 'control_inventario');
    el('control').disabled = ocupado && !(simple && estado.ocupado==='validando');
    el('archivos').disabled = el('carpeta').disabled = ocupado;
    el('archivar').hidden = !estado.respaldos.length || !hasPermiso('contabilidad');
    el('archivar').disabled = ocupado;
    el('hojas').disabled = ocupado;
    el('revisar').disabled = ocupado || !estado.hojas.some(h => h.tipo || h.control);
    el('revisar').hidden = (entradaInventario && !estado.hojas.length) || (simple && !estado.reintentar && !revisarColumnas);
    el('revisar').textContent = simple && estado.reintentar ? 'Volver a revisar' : 'Revisar filas';
    el('confirmar').hidden = !estado.plan;
    el('confirmar').textContent = simple ? 'Confirmar carga' : 'Guardar importación';
    el('confirmar').disabled = ocupado;
    el('cerrar').disabled = estado.ocupado === 'guardando';
  }

  function invalidar() {
    clearTimeout(estado.revisionPendiente);
    estado.reintentar = false;
    estado.version++;
    estado.plan = null;
    el('resultados').replaceChildren();
    controles();
  }

  function cambiarFechaApertura() {
    if (!activo(estado) || estado.ocupado) return;
    estado.fechaApertura = el('fecha-apertura').value;
    invalidar();
    mensaje('Pulsa «Revisar filas» para comprobar la fecha de apertura.');
  }

  function reiniciarControl() {
    for (const campo of ['modo','fecha','bodega']) el('control-'+campo).value = '';
    el('control-ayuda').textContent = '';
    el('corte-resumen').textContent = '';
    el('opciones-control').open = false;
  }

  function soloControl(e) {
    return e.hojas.some(h=>h.tipo==='control_inventario') && !e.respaldos.length &&
      e.hojas.every(h=>h.tipo==='control_inventario' || h.referenciaMaestro || (!h.filas.length && !h.error));
  }

  function mostrarCorte() {
    const modo=el('control-modo').value, fecha=el('control-fecha').value, bodega=el('control-bodega').value.trim();
    el('corte-resumen').textContent = [modo==='apertura'?'Inventario inicial':modo==='cierre'?'Conteo mensual':'',
      fecha && fecha.split('-').reverse().join('/'),bodega && 'Bodega '+bodega].filter(Boolean).join(' · ');
    el('control-ayuda').textContent = modo==='apertura' ? 'Registra las existencias al inicio del período.' :
      modo==='cierre' ? 'Compara el conteo del último día del mes con las existencias del sistema.' : '';
  }

  function cambiarControl() {
    const e=estado;
    if (!activo(e) || (e.ocupado && e.ocupado!=='validando')) return;
    if (e.ocupado==='validando') e.ocupado='';
    invalidar();
    mostrarCorte();
    if (!soloControl(e)) { mensaje('Pulsa «Revisar filas» para comprobar el corte.'); return; }
    if (!el('control-modo').value || !el('control-fecha').value || !el('control-bodega').value.trim()) {
      mensaje('Completa los datos del control para revisar el inventario.'); return;
    }
    mensaje('Revisando el inventario…');
    e.revisionPendiente=setTimeout(()=>{if(activo(e)) solicitar(e,false);},350);
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

  async function sugerirControl(e) {
    recogerEstado(e,'preparando','Preparando la carga…');
    const hojas=e.hojas.filter(h=>h.tipo==='control_inventario');
    const valores=campo=>[...new Set(hojas.map(h=>h.metadataControl?.[campo]).filter(Boolean))];
    try {
      const {data:aperturas,error}=await sb.from('controles_inventario').select('bodega,fecha')
        .eq('clinica_id',e.clinica).eq('modo','apertura').eq('vigente',true);
      if (!activo(e)) return;
      if (error) throw error;
      const bodegas=valores('bodega');
      const fechas=hojas.map(h=>h.metadataControl?.fecha || h.metadataControl?.fechaFilas || h.metadataControl?.fechaActualizacion).filter(Boolean);
      const fechaUnica=[...new Set(fechas)];
      const anteriores=[...new Set(aperturas.map(a=>a.bodega))];
      const bodega=bodegas.length===1 ? bodegas[0] : !bodegas.length && anteriores.length<=1 ? (anteriores[0]||'General') : '';
      const apertura=aperturas.find(a=>normal(a.bodega)===normal(bodega));
      const fechaOrigen=fechaUnica.length===1 ? fechaUnica[0] : '';
      const modo=apertura && apertura.fecha!==fechaOrigen ? 'cierre' : 'apertura';
      const mes=fechaOrigen?.slice(0,7) || e.mes || hoy().slice(0,7);
      const ultimo=new Date(Date.UTC(Number(mes.slice(0,4)),Number(mes.slice(5,7)),0)).toISOString().slice(0,10);
      const fechaPropuesta=modo==='cierre' ? ultimo : mes+'-01';
      const fecha=fechaOrigen && (valores('fecha').length || valores('fechaFilas').length || fechaOrigen===ultimo || (modo==='apertura' && fechaOrigen.endsWith('-01')))
        ? fechaOrigen : fechaUnica.length>1 ? '' : fechaPropuesta;
      el('control-bodega').value=bodega;
      el('control-fecha').value=fecha;
      el('control-modo').value=modo;
      mostrarCorte();
      e.necesitaSugerencia=false;
      if (!bodega || !fecha || hojas.some(h=>faltantes(h).length)) {
        el('opciones-control').open=!bodega || !fecha;
        mensaje(!bodega || !fecha ? 'Revisa la bodega y la fecha del control.' : 'Revisa las columnas que faltan para cargar el inventario.');
        return;
      }
    } catch (error) {
      if (activo(e)) {
        e.necesitaSugerencia=e.reintentar=true;
        const falta=['42P01','PGRST205','42883'].includes(error.code);
        mensaje(falta?'Aplica la migración del informe maestro en Supabase.':'No se pudo consultar la apertura de la bodega. Pulsa «Volver a revisar».',true);
      }
      return;
    } finally {
      if (activo(e)) {e.ocupado='';controles();}
    }
    if (activo(e)) await solicitar(e,false);
  }

  async function cargar(carpeta = false) {
    const e = estado;
    if (!activo(e) || e.ocupado) return;
    const archivos = [...el(carpeta ? 'carpeta' : 'archivos').files].filter(f =>
      !f.name.startsWith('~$') && (!carpeta || /\.(xlsx?|csv|pdf|zip|eml|png|jpe?g)$/i.test(f.name)));
    el(carpeta ? 'archivos' : 'carpeta').value = '';
    e.respaldos = [];
    e.hojas = [];
    e.necesitaSugerencia=false;
    e.copias=0;
    reiniciarControl();
    invalidar();
    dibujarHojas();
    if (archivos.length > 200 || archivos.reduce((n, f) => n + f.size, 0) > 150 * 1024 * 1024) {
      mensaje('Selecciona hasta 200 archivos con un máximo conjunto de 150 MB.', true);
      return;
    }
    recogerEstado(e, 'leyendo', 'Leyendo y reconociendo las hojas…');
    const errores = [];
    const controlesLeidos=[];
    for (const archivo of archivos) {
      if (!activo(e)) return;
      try {
        if (/\.(pdf|zip|eml|png|jpe?g)$/i.test(archivo.name)) {
          if (archivo.size > 20 * 1024 * 1024) throw new Error('El anexo supera 20 MB.');
          e.respaldos.push(archivo);
          continue;
        }
        if (archivo.size > 5 * 1024 * 1024) throw new Error('Supera el máximo de 5 MB por archivo.');
        const hojas = await leerArchivo(archivo);
        const clasificadas = hojas.map(h => detectar({...h, archivo:archivo.name, encabezado:h.filas[0]?.numero, tipo:'', mapa:{}, fijos:{}}));
        if (archivos.length>1 && clasificadas.some(h=>h.tipo==='control_inventario')) {
          const contenido=new Uint8Array(await archivo.arrayBuffer());
          if (controlesLeidos.some(previo=>previo.length===contenido.length && previo.every((v,i)=>v===contenido[i]))) {
            e.copias++; continue;
          }
          controlesLeidos.push(contenido);
        }
        if (clasificadas.some(h => h.fiscal || h.control || h.tipo === 'diario')) e.respaldos.push(archivo);
        e.hojas.push(...clasificadas);
      } catch (error) {
        errores.push(archivo.name + ' · ' + error.message);
      }
    }
    if (!activo(e)) return;
    if (errores.length) { e.hojas = []; e.respaldos = []; }
    e.ocupado = '';
    dibujarHojas();
    controles();
    if (errores.length) { mensaje(errores.join('\n'), true); return; }
    if (!archivos.length) { mensaje(''); return; }
    const reconocidas = e.hojas.filter(h => h.tipo);
    const pendientes = reconocidas.filter(h => faltantes(h).length);
    const deBodega = reconocidas.filter(h => h.tipo === 'control_inventario');
    if (deBodega.length) {
      if (soloControl(e)) {await sugerirControl(e);return;}
      for (const campo of ['fecha','bodega']) {
        const valores = [...new Set(deBodega.map(h => h.metadataControl?.[campo] ||
          (campo==='fecha' && h.metadataControl?.fechaActualizacion)).filter(Boolean))];
        if (valores.length === 1) el('control-'+campo).value = valores[0];
      }
      mensaje('Se reconoció el control de inventario. Elige el uso de la carga y verifica la fecha de corte y la bodega.');
      return;
    }
    if (!reconocidas.length && e.hojas.some(h => h.referenciaMaestro)) {
      mensaje('El informe maestro es un reporte de consulta. Selecciona el control de inventario de la empresa.');
      return;
    }
    if (!reconocidas.length && (e.respaldos.length || e.hojas.some(h => h.control))) {
      mensaje('Migración pendiente. Para conciliar, selecciona el libro diario, la balanza y los auxiliares del mismo período.' +
        (e.respaldos.length ? ' Hay ' + e.respaldos.length + ' archivo(s) para guardar en el expediente.' : ''));
    } else if (!reconocidas.length) {
      mensaje('No se reconoció el contenido de las hojas. Elige el destino de cada una.', true);
    } else if (pendientes.length) {
      mensaje('Se reconocieron ' + reconocidas.length + ' hoja(s). Completa los campos marcados y pulsa «Revisar filas».', true);
    } else {
      // Todo asignado: se revisa sola para que solo quede confirmar.
      await solicitar(e, false, reconocidas.length);
    }
  }

  function recogerEstado(e, ocupado, texto) {
    e.ocupado = ocupado;
    mensaje(texto);
    controles();
  }

  function normal(valor) {
    return String(valor ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function cabecera(hoja) {
    return hoja.filas.find(f => f.numero === hoja.encabezado)?.celdas || [];
  }

  // ── Reconocimiento automático ──
  function aliasDe(tipo, id) {
    const campo = TIPOS[tipo].campos.find(c => c[0] === id);
    return [id, campo[1], ...campo[3].split('|')].map(normal).filter(Boolean);
  }
  // 3 = el encabezado es uno de los nombres conocidos; 2 = los contiene como palabras.
  function coincide(encabezado, opciones) {
    if (!encabezado) return 0;
    if (opciones.includes(encabezado)) return 3;
    return opciones.some(a => a.length >= 4 && (' ' + encabezado + ' ').includes(' ' + a + ' ')) ? 2 : 0;
  }
  // Asigna cada campo a la columna que mejor le corresponde, sin repetir columnas.
  function mapear(tipo, celdas) {
    const candidatos = [];
    const inventario = ['productos','movimientos','control_inventario'].includes(tipo);
    TIPOS[tipo].campos.forEach(([id], orden) => {
      const opciones = aliasDe(tipo, id);
      celdas.forEach((c, i) => {
        if (!c || c.invalida || typeof c.valor !== 'string') return;
        const encabezado = normal(c.valor);
        const monetario = CAMPOS_MONETARIOS_INV.includes(id);
        const etiqueta = inventario && monetario
          ? encabezado.replace(/\s+(?:en )?(c|cs|nio|cordobas|us|usd|eur|gtq|mxn|crc|hnl|dolares)$/, '') : encabezado;
        // Un costo total, un precio de venta y una cantidad física nunca son intercambiables.
        const p = inventario && (tipo === 'control_inventario' || monetario || ['sku','stock','nombre','producto','unidad','moneda','cantidad','cant_entrada','cant_salida','clase'].includes(id))
          ? (opciones.includes(etiqueta) ? 3 : 0) : coincide(encabezado, opciones);
        if (p) candidatos.push({id, i, p, orden, generico:inventario && ['nombre','producto'].includes(id) && etiqueta === 'descripcion'});
      });
    });
    candidatos.sort((a, b) => b.p - a.p || a.orden - b.orden || Number(a.generico) - Number(b.generico) || a.i - b.i);
    const mapa = {}, usadas = new Set();
    let puntos = 0;
    for (const c of candidatos) {
      if (c.id in mapa || usadas.has(c.i)) continue;
      mapa[c.id] = c.i;
      usadas.add(c.i);
      puntos += c.p;
    }
    return {mapa, puntos};
  }
  function pista(tipo, texto) {
    return TIPOS[tipo].pista.split('|').some(p => (' ' + texto + ' ').includes(' ' + normal(p) + ' '));
  }
  // Lo que se deduce del nombre de la hoja: «Gastos» = todo son gastos.
  function fijosPorNombre(tipo, texto, mapa) {
    const fijos = {};
    const tiene = palabra => new RegExp('(^| )' + palabra).test(texto);
    if (tipo === 'finanzas' && mapa.clase == null && mapa.monto_ingreso == null && mapa.monto_egreso == null) {
      if (tiene('gasto') || tiene('egreso') || tiene('pago')) fijos.clase = 'egreso';
      else if (tiene('ingreso') || tiene('cobro')) fijos.clase = 'ingreso';
    }
    if (tipo === 'movimientos' && mapa.clase == null && mapa.cant_entrada == null && mapa.cant_salida == null) {
      const salidas = tiene('salida') || tiene('consumo'), entradas = tiene('entrada');
      if (salidas !== entradas) fijos.clase = salidas ? 'salida' : 'entrada';
      if (salidas && !entradas && tiene('consumo')) fijos.motivo = 'Consumo';
    }
    return fijos;
  }
  function clasificarExpediente(hoja) {
    const filas = hoja.filas.slice(0, 40);
    const campos = filas.map(f => f.celdas.map(c => normal(c?.valor)));
    const fiscal = campos.some(c => c.includes('codigo de retencion') && c.includes('valor retenido') ||
      c.some(v => v?.includes('valor iva trasladado')) && c.includes('ruc')) ||
      campos.some(c => c.includes('base imponible para determinar el iva')) &&
      campos.some(c => c.includes('base imponible para determinar pmd o anticipo'));
    if (fiscal) { hoja.fiscal = true; return true; }

    const claves = {
      cuenta:['codigo de cuenta','codigo cuenta','codigo contable','cuenta contable','codigo','cuenta'],
      nombre:['nombre de cuenta','nombre cuenta','nombre de la cuenta','descripcion de cuenta','cuenta'],
      apertura:['apertura','saldo inicial','saldo anterior'],
      debe:['debe','debitos','movimiento deudor','cargos'], haber:['haber','creditos','movimiento acreedor','abonos'],
      desde:['fecha inicial','desde','inicio del periodo'],corte:['fecha de corte','fecha corte','hasta','fin del periodo'],
      saldo:['saldo final','saldo al cierre','saldo pendiente','saldo','saldo contable']
    };
    const etiqueta = normal(hoja.nombre);
    const nombre = normal(hoja.archivo);
    const origen = /balanza|auxiliar|diario/.test(etiqueta) ? etiqueta : nombre;
    if (/\bauxiliar(?:es)?\b/.test(origen) && /\b(inventario|kardex|existencias|almacen)\b/.test(origen) &&
        campos.some(c => c.some(v => /\b(producto|articulo|sku|stock|existencias)\b/.test(v)))) return false;
    for (const [i, c] of campos.entries()) {
      const mapa = {};
      for (const [id,alias] of Object.entries(claves)) {
        const indice = alias.map(a => c.indexOf(a)).find(j => j >= 0);
        if (indice !== undefined) mapa[id] = indice;
      }
      if (mapa.cuenta === mapa.nombre) delete mapa.nombre;
      const balanza = ['cuenta','apertura','debe','haber','saldo'].every(k => mapa[k] != null);
      const auxiliar = /auxiliar/.test(origen) && mapa.cuenta != null && mapa.saldo != null;
      if (!balanza && !auxiliar) continue;
      hoja.control = auxiliar ? 'auxiliar' : 'balanza';
      hoja.mapa = mapa;
      hoja.encabezado = filas[i].numero;
      return true;
    }
    if (/\b(balanza|auxiliar|auxiliares)\b/.test(etiqueta) ||
        hoja.nombre.match(/^(sheet|hoja)\s*\d+$/i) && /\b(balanza|auxiliar|auxiliares)\b/.test(nombre)) {
      hoja.error = 'Faltan columnas de conciliación. Usa código de cuenta y saldo final para auxiliares. La balanza también requiere saldo inicial, Debe y Haber.';
      return true;
    }
    return false;
  }

  function metadataControl(hoja, encabezado, mapa) {
    const meta = {};
    for (const fila of hoja.filas.filter(f => f.numero < encabezado.numero)) {
      fila.celdas.forEach((celda,i) => {
        if (typeof celda?.valor !== 'string') return;
        const [titulo,...partes] = celda.valor.split(':');
        const etiqueta = normal(titulo);
        const campo = ['area bodega','bodega','almacen'].includes(etiqueta) ? 'bodega' :
          etiqueta === 'fecha de actualizacion' ? 'fechaActualizacion' :
          ['fecha de corte','fecha del inventario'].includes(etiqueta) ? 'fecha' : '';
        if (!campo) return;
        const contigua = fila.celdas.slice(i+1).find(c => c && String(c.valor ?? '').trim() !== '');
        const inline = partes.join(':').trim();
        const valor = inline ? {valor:inline} : contigua;
        if (!valor || /^(fecha|área|area|bodega|almacén)\b/i.test(String(valor.valor))) return;
        if (campo === 'bodega') meta.bodega = texto(valor);
        else try { meta[campo] = fecha(valor,hoja.fecha1904); } catch { /* El usuario elige el corte si la fecha no se puede leer. */ }
      });
    }
    const colFecha = encabezado.celdas.findIndex(c => ['fecha','fecha de inventario','fecha de conteo'].includes(normal(c?.valor)));
    const colObservaciones = encabezado.celdas.findIndex(c => ['ubicacion observaciones','observaciones','ubicacion'].includes(normal(c?.valor)));
    if (colObservaciones >= 0) meta.colObservaciones = colObservaciones;
    if (colFecha >= 0) {
      meta.colFecha = colFecha;
      const articulos = hoja.filas.filter(f => f.numero > encabezado.numero &&
        f.celdas[mapa.nombre]?.valor && f.celdas[mapa.unidad]?.valor);
      try {
        const fechas = new Set(articulos.map(f => fecha(f.celdas[colFecha],hoja.fecha1904)));
        if (fechas.size === 1 && !fechas.has(null)) meta.fechaFilas = [...fechas][0];
      } catch { /* Si la columna mezcla fechas o formatos, deja que se confirme el corte. */ }
    }
    return meta;
  }

  function detectar(hoja) {
    hoja.deteccion = null;
    if (hoja.error || !hoja.filas.length) return hoja;
    const cabeceras = hoja.filas.slice(0,15);
    // El maestro de ejemplo de Daniel agrupa los saldos de artículos de otra empresa.
    const esEjemplo = esEmpresaMedica() && cabeceras.some(f => f.celdas.some(c => normal(c?.valor) === 'maestro de inventario')) &&
      (cabeceras.some(f => f.celdas.some(c => normal(c?.valor) === 'office supply')) || cabeceras.some(f => {
        const nombres = f.celdas.map(c => normal(c?.valor));
        return ['saldo anterior','saldo unidades','utilidad'].every(titulo=>nombres.includes(titulo));
      }));
    if (hoja.esInformeMaestro || esEjemplo) {
      hoja.referenciaMaestro = true;
      hoja.omitida = true;
      return hoja;
    }
    if (clasificarExpediente(hoja)) return hoja;
    const texto = normal(hoja.nombre + ' ' + hoja.archivo.replace(/\.[^.]+$/, ''));
    const porTipo = {};
    let kardex = null;
    let catalogo = null;
    let facturaIncompleta = false;
    let diarioIncompleto = false;
    for (const fila of cabeceras) {
      if (esEmpresaMedica()) {
        const {mapa} = mapear('control_inventario',fila.celdas);
        if (mapa.nombre != null && mapa.inicial != null && mapa.actual != null) {
          hoja.destinoInventario = 'control_inventario';
          if (!hasPermiso('inventario')) { hoja.deteccion = {estado:'sinInventario'}; return hoja; }
          const esBonificacion = titulo => {
            const etiqueta = normal(titulo);
            return !/\b(?:sin|no)\b/.test(etiqueta) && /\b(?:bonificaci(?:on|ones)|bonificad[oa]s?)\b/.test(etiqueta);
          };
          const bonificacion = esBonificacion(hoja.nombre) || cabeceras.some(f => f.numero < fila.numero &&
            f.celdas.some(c => esBonificacion(c?.valor)));
          return Object.assign(hoja,{tipo:'control_inventario',encabezado:fila.numero,mapa,bonificacion,
            metadataControl:metadataControl(hoja,fila,mapa),deteccion:{estado:'reconocida',columnas:Object.keys(mapa).length}});
        }
      }
      const camposDiario = mapear('diario',fila.celdas).mapa;
      if (camposDiario.cuenta != null && camposDiario.debe != null && camposDiario.haber != null &&
          !NUCLEO.diario(camposDiario)) diarioIncompleto = true;
      const camposFactura = mapear('facturas',fila.celdas).mapa;
      if (camposFactura.documento != null && camposFactura.nombre != null && camposFactura.descripcion != null &&
          camposFactura.precio_linea != null && !NUCLEO.facturas(camposFactura)) facturaIncompleta = true;
      const mov = mapear('movimientos',fila.celdas).mapa;
      const prod = mapear('productos',fila.celdas).mapa;
      const identidad = normal(fila.celdas[mov.producto]?.valor);
      const nombreHoja = normal(hoja.nombre);
      const contexto = pista('productos',nombreHoja) && !pista('movimientos',nombreHoja) ? nombreHoja : texto;
      const nombrado = /\b(kardex|movimientos de inventario|movimientos de almacen)\b/.test(contexto);
      const productoExplicito = /\b(producto|articulo|insumo|medicamento|item)\b/.test(identidad);
      const tieneCosto = prod.costo != null || prod.costo_total != null;
      const esCatalogo = (prod.nombre != null || prod.sku != null) && (prod.stock != null || tieneCosto) &&
        (pista('productos',texto) || prod.sku != null || productoExplicito && tieneCosto);
      if (esCatalogo && (!catalogo || Object.keys(prod).length > Object.keys(catalogo.mapa).length))
        catalogo = {tipo:'productos',fila:fila.numero,mapa:prod};
      const cantidadesSeparadas = mov.cant_entrada != null || mov.cant_salida != null;
      const claseEnFilas = mov.clase != null && hoja.filas.slice(0, 40).some(f =>
        f.numero > fila.numero && CLASES.movimientos[normal(f.celdas[mov.clase]?.valor)]);
      const pareceKardex = nombrado && (mov.producto != null || mov.sku != null) && (mov.fecha != null || cantidadesSeparadas) ||
        (productoExplicito || mov.sku != null || nombrado) && (cantidadesSeparadas ||
        mov.cantidad != null && (nombrado || mov.clase != null && (claseEnFilas || mov.fecha != null))) ||
        mov.producto != null && mov.fecha != null && mov.cantidad != null && (claseEnFilas || pista('movimientos',texto));
      if (pareceKardex && (!kardex || Object.keys(mov).length > Object.keys(kardex.mapa).length))
        kardex = {tipo:'movimientos', fila:fila.numero, mapa:mov};
      for (const tipo of tiposDisponibles()) {
        const {mapa, puntos} = mapear(tipo, fila.celdas);
        if (!NUCLEO[tipo](mapa)) continue;
        const total = puntos + (pista(tipo, texto) ? 4 : 0);
        if (!porTipo[tipo] || total > porTipo[tipo].total) porTipo[tipo] = {tipo, total, fila:fila.numero, mapa};
      }
    }
    if (porTipo.diario) {
      const {fila,mapa} = porTipo.diario;
      return Object.assign(hoja,{tipo:'diario',encabezado:fila,mapa,
        deteccion:{estado:'reconocida',columnas:Object.keys(mapa).length}});
    }
    if (diarioIncompleto) {
      hoja.deteccion = tiposDisponibles().includes('diario') ? {estado:'dudosa',opciones:['diario']} : {estado:'ninguna'};
      return hoja;
    }
    if (facturaIncompleta && !porTipo.facturas) {
      hoja.deteccion = {estado:'dudosa', opciones:tiposDisponibles().includes('facturas') ? ['facturas'] : []};
      if (!hoja.deteccion.opciones.length) hoja.deteccion = {estado:'ninguna'};
      return hoja;
    }
    const inventario = kardex || catalogo;
    if (inventario && !porTipo.facturas) {
      const {tipo,fila,mapa} = inventario;
      hoja.destinoInventario = tipo;
      if (!tiposDisponibles().includes(tipo)) {
        hoja.deteccion = {estado:'sinInventario'};
        return hoja;
      }
      return Object.assign(hoja,{tipo,encabezado:fila,mapa,fijos:fijosPorNombre(tipo,texto,mapa),
        deteccion:{estado:'reconocida',columnas:Object.keys(mapa).length}});
    }
    const orden = Object.values(porTipo).sort((a, b) => b.total - a.total);
    if (!orden.length) { hoja.deteccion = {estado:'ninguna'}; return hoja; }
    if (orden[1] && orden[0].total - orden[1].total < 1) {
      hoja.deteccion = {estado:'dudosa', opciones:orden.filter(o => orden[0].total - o.total < 1).map(o => o.tipo)};
      return hoja;
    }
    const mejor = porTipo.facturas || orden[0];
    hoja.tipo = mejor.tipo;
    hoja.encabezado = mejor.fila;
    hoja.mapa = mejor.mapa;
    hoja.fijos = fijosPorNombre(mejor.tipo, texto, mejor.mapa);
    hoja.deteccion = {estado:'reconocida', columnas:Object.keys(mejor.mapa).length};
    return hoja;
  }

  function autocompletar(hoja) {
    hoja.mapa = {};
    hoja.fijos = {};
    if (!hoja.tipo) return;
    hoja.mapa = mapear(hoja.tipo, cabecera(hoja)).mapa;
    hoja.fijos = fijosPorNombre(hoja.tipo, normal(hoja.nombre + ' ' + hoja.archivo.replace(/\.[^.]+$/, '')), hoja.mapa);
  }

  // Campos sin resolver de una hoja (vacío = lista para revisar).
  function faltantes(h) {
    const m = h.mapa, falta = [];
    for (const [id, nombre, obligatorio] of TIPOS[h.tipo].campos)
      if (obligatorio === 1 && m[id] == null) falta.push(nombre);
    if (h.tipo === 'finanzas') {
      const separadas = m.monto_ingreso != null || m.monto_egreso != null;
      if (!separadas && m.monto == null) falta.push('Monto (o columnas de ingresos y gastos)');
      if (!separadas && m.clase == null && !h.fijos.clase) falta.push('Tipo de movimiento (o «todas son…»)');
    }
    if (h.tipo === 'movimientos' && m.cant_entrada == null && m.cant_salida == null) {
      if (m.cantidad == null) falta.push('Cantidad (o unidades de entrada/salida)');
      if (m.clase == null && !h.fijos.clase) falta.push('Tipo de movimiento (o «todas son…»)');
    }
    if (['productos','movimientos','control_inventario'].includes(h.tipo)) {
      if (h.tipo === 'movimientos' && esEmpresaMedica() &&
          !CAMPOS_MONETARIOS_INV.some(k => k !== 'precio' && m[k] != null))
        falta.push('Costo unitario o valor total al costo del movimiento');
      const columnas = cabecera(h);
      if (CAMPOS_MONETARIOS_INV.some(k => otraMoneda(columnas[m[k]]?.valor)))
        falta.push('Importes de inventario en C$');
      if (h.tipo === 'movimientos' && [...CAMPOS_MONETARIOS_INV,'cantidad','cant_entrada','cant_salida'].some(k => {
        const nombre = normal(columnas[m[k]]?.valor);
        return nombre && columnas.filter(c => normal(c?.valor) === nombre).length > 1;
      })) falta.push('Encabezados distintos para las cantidades y los costos de entrada y salida');
    }
    return falta;
  }

  function letra(i) {
    const resto = String.fromCharCode(65 + (i % 26));
    return i < 26 ? resto : letra(Math.floor(i / 26) - 1) + resto;
  }

  function avisoDeteccion(h) {
    const d = h.deteccion;
    if (!d) return '';
    if (d.estado === 'sinInventario') return '<p class="excel-aviso">Se reconoció una hoja de inventario. Hace falta el permiso de Inventario para cargarla.</p>';
    if (h.tipo && d.estado === 'reconocida' && h.tipo === h.tipoDetectado)
      return `<p class="excel-detectado">✓ Reconocida como «${TIPOS[h.tipo].titulo}» · ${d.columnas} columna${d.columnas === 1 ? '' : 's'} asignada${d.columnas === 1 ? '' : 's'}</p>`;
    if (!h.tipo && d.estado === 'dudosa')
      return `<p class="excel-aviso">Puede ser ${d.opciones.map(t => '«' + TIPOS[t].titulo + '»').join(' o ')}. Elige el destino.</p>`;
    if (!h.tipo && d.estado === 'ninguna') return '<p class="excel-aviso">No se reconoció su contenido. Elige el destino u omítela.</p>';
    return '';
  }

  function dibujarHojas() {
    if (soloControl(estado) && !estado.hojas.some(h=>h.tipo && faltantes(h).length)) {
      el('hojas').replaceChildren();
      return;
    }
    el('hojas').innerHTML = estado.hojas.map((h, i) => {
      if (h.tipoDetectado === undefined) h.tipoDetectado = h.tipo;
      const titulo = escAttr(h.archivo) + ' · ' + escAttr(h.nombre) + (h.oculta ? ' (oculta)' : '');
      if (h.referenciaMaestro) return '<section class="excel-hoja"><strong>'+titulo+'</strong><p>Informe de consulta · Excluido de la carga</p></section>';
      if (h.error || !h.filas.length) return `<section class="excel-hoja"><strong>${titulo}</strong><p>${escAttr(h.error || 'Hoja vacía')}</p></section>`;
      if (h.fiscal || h.control) return `<section class="excel-hoja"><strong>${titulo}</strong><p>${h.fiscal ? 'Respaldo fiscal' : h.control === 'balanza' ? 'Balanza de comprobación' : 'Auxiliar contable'} · ${h.fiscal ? 'Disponible para el expediente' : 'Control de conciliación'}</p></section>`;
      const opciones = tiposDisponibles().filter(t => !h.destinoInventario || t === h.destinoInventario)
        .map(t => `<option value="${t}" ${h.tipo === t ? 'selected' : ''}>${TIPOS[t].titulo}</option>`).join('');
      const columnas = cabecera(h);
      const falta = h.tipo ? faltantes(h) : [];
      return `<section class="excel-hoja${h.tipo && !falta.length ? ' excel-hoja-lista' : ''}" data-hoja="${i}">
        <strong>${titulo}</strong>
        ${avisoDeteccion(h)}
        <div class="excel-grid">
          <label>Destino<select data-campo="tipo"><option value="">Destino sin identificar</option>
          <option value="omitir" ${h.omitida ? 'selected' : ''}>Omitir esta hoja</option>${opciones}</select></label>
          ${h.tipo ? `<label>Fila de encabezados<input type="number" min="1" max="2000" value="${h.encabezado}" data-campo="encabezado"></label>` : ''}
        </div>
        ${h.tipo ? `<details class="excel-columnas"${falta.length ? ' open' : ''}><summary>Columnas${falta.length ? ` · <span class="excel-error">falta: ${escAttr(falta.join(', '))}</span>` : ' asignadas'}</summary>
          <div class="excel-grid">${TIPOS[h.tipo].campos.map(([id, nombre, requerido]) => `
          <label>${nombre}${requerido === 1 ? ' *' : ''}<select data-mapa="${id}">
            <option value="">${id === 'id_origen' ? 'Generar automáticamente' : requerido === 1 ? 'Elige una columna' : 'Sin asignar'}</option>
            ${id === 'clase' ? Object.entries(h.tipo === 'finanzas' ? {ingreso:'Todas son ingresos',egreso:'Todas son gastos'} : {entrada:'Todas son entradas',salida:'Todas son salidas'})
              .map(([v, t]) => `<option value="=${v}" ${h.mapa.clase == null && h.fijos.clase === v ? 'selected' : ''}>— ${t} —</option>`).join('') : ''}
            ${columnas.map((c,j) => c?.invalida || c == null ? '' : `<option value="${j}" ${h.mapa[id] === j ? 'selected' : ''}>${letra(j)} · ${escAttr(c.valor)}</option>`).join('')}
          </select></label>`).join('')}</div></details><p class="excel-ayuda">${ayuda(h.tipo)}</p>` : ''}
      </section>`;
    }).join('');
  }

  function ayuda(tipo) {
    return ({
      finanzas:'Una columna de tipo (ingreso o gasto) con el monto, o dos columnas: ingresos y gastos. Las categorías que no existan quedan como «General» con su nombre en la descripción.',
      productos:'El valor de apertura se calcula con las existencias y el costo. También puedes usar el valor total al costo que indica el archivo. Si falta la fecha, se usa la que selecciones para la apertura.',
      control_inventario:'El control conserva las existencias inicial y actual y los movimientos declarados. Una celda vacía en Entradas o Salidas equivale a cero. Las existencias con costo desconocido quedan pendientes de valorar.',
      movimientos:esEmpresaMedica()
        ? 'Cada entrada o salida se conserva como kardex histórico con el costo del archivo. Los saldos físicos por lote se gestionan en Inventario.'
        : 'Usa el nombre del catálogo, una cantidad con tipo o columnas de entrada y salida. Agrega el costo histórico para valorar el movimiento.',
      proveedores:'Los proveedores que ya existen con el mismo nombre se señalan para no duplicarlos.',
      clientes:'Sin días de crédito se usan 30. Los clientes que ya existen con el mismo nombre se señalan.',
      facturas:'Usa una fila por línea y repite el número, cliente, fecha, IVA y total de factura. Incluye la fecha de cobro completo o el vencimiento si está pendiente. El inventario y los ingresos históricos se migran por separado.',
      diario:'Repite el número y la fecha por cada línea. El asiento se registra si su Debe y Haber coinciden al centavo. Para saldos de apertura usa el asiento de apertura del archivo.',
      cxc:'Cada fila es una factura pendiente de un cliente. Queda en Por cobrar y no cuenta como venta del período.',
      cxp:'Cada fila es una factura pendiente con un proveedor. Queda en Por pagar y no mueve el inventario.'
    })[tipo];
  }

  function cambiar(evento) {
    const control = evento.target;
    const tarjeta = control.closest('[data-hoja]');
    if (!tarjeta || !activo(estado)) return;
    const hoja = estado.hojas[Number(tarjeta.dataset.hoja)];
    if (!hoja || hoja.fiscal || hoja.control) return;
    if (control.dataset.mapa) {
      const id = control.dataset.mapa;
      delete hoja.mapa[id];
      if (id === 'clase') delete hoja.fijos.clase;
      if (control.value.startsWith('=')) hoja.fijos[id] = control.value.slice(1);
      else if (control.value !== '') hoja.mapa[id] = Number(control.value);
      invalidar();
      mensaje('');
      dibujarHojas();
      if (soloControl(estado) && !faltantes(hoja).length) {cambiarControl();return;}
      el('hojas').querySelector(`[data-hoja="${tarjeta.dataset.hoja}"] [data-mapa="${id}"]`)?.focus();
      return;
    }
    if (control.dataset.campo === 'tipo') {
      hoja.omitida = control.value === 'omitir';
      hoja.tipo = hoja.omitida ? '' : control.value;
    }
    else if (control.dataset.campo === 'encabezado') hoja.encabezado = Number(control.value);
    else return;
    autocompletar(hoja);
    invalidar();
    mensaje('');
    dibujarHojas();
    el('hojas').querySelector(`[data-hoja="${tarjeta.dataset.hoja}"] [data-campo="${control.dataset.campo}"]`)?.focus();
  }

  // ── Lectura de valores ──
  function texto(celda, formato = false) {
    if (celda?.invalida) throw new Error('La celda contiene un error de Excel (#¡VALOR!, #N/A…).');
    if (celda == null) return '';
    if (!['string','number','boolean'].includes(typeof celda.valor)) throw new Error('Usa texto o un número.');
    if (formato && typeof celda.valor === 'number' && (!Number.isInteger(celda.valor) || Math.abs(celda.valor) >= 1e15))
      throw new Error('Guarda el identificador como texto en Excel.');
    return String(formato ? celda.texto ?? celda.valor : celda.valor).trim();
  }

  function otraMoneda(valor) {
    return /\$|USD|EUR|GTQ|MXN|CRC|HNL|€|£|d[oó]lares/i.test(String(valor ?? '').replace(/C\s*\$/gi,''));
  }

  // Montos tal como vienen en hojas reales: «C$ 1,250.50», «1.250,50», 15.333333 (fórmulas).
  function decimal(celda, precision, negativo = false, exacto = false) {
    const valor = texto(celda);
    if (!valor) return null;
    const formato = String(celda.texto || valor);
    if (/US\$|USD|EUR|GTQ|€|£/i.test(formato))
      throw new Error('El archivo indica otra moneda. Los importes deben venir en córdobas (C$).');
    let numero;
    if (typeof celda.valor === 'number') numero = celda.valor;
    else {
      let t = valor.replace(/^(c\$|nio|cs|\$)\s*/i, '').replace(/\s+/g, '');
      const signo = /^\(.*\)$/.test(t) || t.startsWith('-') ? -1 : 1;
      t = t.replace(/^\(|\)$/g, '').replace(/^-/, '');
      if (/^\d{1,3},\d{3}$/.test(t)) throw new Error('El número ' + valor + ' es ambiguo: escribe el separador decimal (1250.00 o 1.25).');
      if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
      else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) {
        // Una sola marca en una cantidad fraccionable también puede representar miles.
        if (exacto && precision > 2 && /^\d{1,3}\.\d{3}$/.test(t))
          throw new Error('El separador de «' + valor + '» es ambiguo. Usa una celda numérica o escribe la cantidad sin separadores de miles.');
        t = t.replace(/\./g, '').replace(',', '.');
      }
      else t = t.replace(',', '.');
      if (!/^\d+(\.\d+)?$/.test(t)) throw new Error('«' + valor + '» no es un número.');
      numero = signo * Number(t);
    }
    if (!Number.isFinite(numero) || Math.abs(numero) >= 1e9) throw new Error('El número está fuera del rango permitido.');
    if (numero < 0 && !negativo) throw new Error('No se admiten valores negativos.');
    const factor = 10 ** precision;
    if (exacto && Math.abs(numero - Math.round(numero * factor) / factor) > Number.EPSILON * Math.max(1,Math.abs(numero)))
      throw new Error(precision === 2 ? 'El importe tiene más de dos decimales.' : 'El valor admite hasta ' + precision + ' decimales.');
    return Math.round(numero * factor) / factor;
  }

  function fecha(celda, fecha1904) {
    const valor = texto(celda);
    if (!valor) return null;
    let iso = valor;
    if (typeof celda.valor === 'number') {
      const dias = Math.floor(celda.valor);   // una fecha con hora se queda con el día
      if (dias < (fecha1904 ? 0 : 1) || (!fecha1904 && dias === 60) || dias > 2958465)
        throw new Error('Fecha de Excel inválida.');
      const base = fecha1904 ? Date.UTC(1904,0,1) : Date.UTC(1899,11,dias < 60 ? 31 : 30);
      iso = new Date(base + dias * 86400000).toISOString().slice(0,10);
    } else {
      const v = valor.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?\s*m\.?)?$/i, '');
      const latina = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(v);
      const inversa = /^(\d{4})[/.](\d{1,2})[/.](\d{1,2})$/.exec(v);
      if (latina) iso = [latina[3].length === 2 ? '20' + latina[3] : latina[3], latina[2].padStart(2,'0'), latina[1].padStart(2,'0')].join('-');
      else if (inversa) iso = [inversa[1], inversa[2].padStart(2,'0'), inversa[3].padStart(2,'0')].join('-');
      else iso = v.slice(0, 10);
    }
    const dia = new Date(iso + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso) || !Number.isFinite(+dia) || dia.toISOString().slice(0,10) !== iso)
      throw new Error('Usa una fecha válida en formato AAAA-MM-DD o DD/MM/AAAA.');
    return iso;
  }

  function categoriaFinanzas(entrada, clase) {
    if (!entrada) return {id:'general'};
    const lista = _categoriasFin(clase);
    const exacta = lista.find(c => c.id === entrada);
    const opciones = lista.filter(c => [c.id,c.label].some(v => normal(v) === normal(entrada)));
    const cat = exacta || (opciones.length === 1 ? opciones[0] : null);
    // Una categoría que no existe en el sistema no detiene la migración: queda
    // como «General» y su nombre original se conserva en la descripción.
    if (!cat || FIN_RESERVADAS.includes(cat.id)) return {id:'general', nota:entrada};
    return {id:cat.id};
  }

  const DECIMALES = {debe:2, haber:2, monto:2, monto_ingreso:2, monto_egreso:2, costo:4, costo_total:2, precio:2, precio_compra:4, inicial:3, entradas:3, salidas:3, actual:3, stock:3, minimo:3, cantidad:3, cant_entrada:3, cant_salida:3, saldo:2, dias_credito:0,
    precio_linea:4,costo_linea:4,iva_pct:2,total_factura:2,costo_unitario_entrada:4,costo_unitario_salida:4,costo_total_entrada:2,costo_total_salida:2};
  const TEXTO_CON_FORMATO = ['id_origen','referencia','documento','identificacion','telefono','cuenta','sku'];

  function validarCosto(datos, cantidad) {
    if (datos.costo_total == null) return;
    if (cantidad == null) throw new Error('El valor total al costo requiere una cantidad explícita.');
    // Las cantidades tienen tres decimales y los costos unitarios cuatro. Compara centavos exactamente.
    const unidades = BigInt(Math.round(cantidad * 1000));
    const centavos = BigInt(Math.round(datos.costo_total * 100));
    if (datos.costo == null && unidades > 0n) {
      datos.costo = Number((2n * centavos * 100000n + unidades) / (2n * unidades)) / 10000;
      if (datos.costo >= 1e9) throw new Error('El costo unitario calculado supera el límite permitido.');
    }
    const unitario = BigInt(Math.round((datos.costo ?? 0) * 10000));
    if ((unidades * unitario + 50000n) / 100000n !== centavos)
      throw new Error('La cantidad por el costo unitario debe coincidir al centavo con el valor total al costo. Comprueba las cifras del archivo.');
  }

  function normalizar(hoja, fila) {
    const datos = {};
    const inventario = ['productos','movimientos','control_inventario'].includes(hoja.tipo);
    for (const [id, rotulo] of TIPOS[hoja.tipo].campos) {
      if (hoja.mapa[id] == null) continue;
      const celda = fila.celdas[hoja.mapa[id]];
      try {
        let valor;
        if (inventario && CAMPOS_MONETARIOS_INV.includes(id) &&
            (otraMoneda(cabecera(hoja)[hoja.mapa[id]]?.valor) || otraMoneda(celda?.texto) || otraMoneda(celda?.valor)))
          throw new Error('Verifica la moneda. Los valores de inventario deben estar expresados en C$.');
        if (['fecha','vencimiento','fecha_pago'].includes(id)) valor = fecha(celda, hoja.fecha1904);
        else if (['iva_pct','ganancia_pct'].includes(id) && (typeof celda?.valor === 'number' && String(celda.texto).endsWith('%') || typeof celda?.valor === 'string' && celda.valor.trim().endsWith('%')))
          valor = decimal({valor:typeof celda.valor === 'number' ? celda.valor*100 : celda.valor.trim().slice(0,-1)},id==='ganancia_pct'?6:2,id==='ganancia_pct');
        else if (id === 'ganancia_pct' || id === 'margen_ganancia') valor = decimal(celda,id==='ganancia_pct'?6:2,true);
        else if (id in DECIMALES) valor = decimal(celda, DECIMALES[id], hoja.tipo === 'finanzas' && id === 'monto',
          inventario || hoja.tipo === 'diario');
        else valor = texto(celda, TEXTO_CON_FORMATO.includes(id));
        if (valor !== null && valor !== '') datos[id] = valor;
      } catch (error) {
        throw new Error(rotulo + ' · ' + error.message);
      }
    }
    const t = hoja.tipo;
    if (inventario && datos.moneda != null) {
      if (!['c','cs','nio','cordoba','cordobas','cordoba oro','cordobas oro'].includes(normal(datos.moneda)))
        throw new Error('Moneda del costo · la fila debe estar valorizada en córdobas (C$).');
      delete datos.moneda;
    }
    if (t === 'diario') {
      datos.debe ??= 0;
      datos.haber ??= 0;
      if ((datos.debe > 0) === (datos.haber > 0)) throw new Error('Cada línea debe tener un importe en Debe o en Haber.');
    }
    if (t === 'control_inventario') {
      if (hoja.bonificacion) datos.bonificacion = true;
      if (!datos.nombre) throw new Error('Falta la descripción de un artículo con datos de inventario. Completa el nombre en la fila indicada.');
      if (hoja.metadataControl?.colFecha != null) {
        const fechaOrigen = fecha(fila.celdas[hoja.metadataControl.colFecha],hoja.fecha1904);
        if (fechaOrigen) datos.fecha_origen = fechaOrigen;
      }
      if (hoja.metadataControl?.colObservaciones != null) {
        const observaciones = texto(fila.celdas[hoja.metadataControl.colObservaciones]);
        if (observaciones) datos.observaciones = observaciones;
      }
      if (hoja.metadataControl?.fechaActualizacion) datos.fecha_actualizacion = hoja.metadataControl.fechaActualizacion;
      datos.entradas ??= 0;
      datos.salidas ??= 0;
      if (datos.inicial != null && datos.actual != null && Math.round(datos.inicial*1000) + Math.round(datos.entradas*1000) -
          Math.round(datos.salidas*1000) !== Math.round(datos.actual*1000))
        throw new Error('La existencia inicial más entradas menos salidas difiere de la existencia actual.');
      // Las fórmulas de la plantilla dan cero al multiplicar existencias por un costo vacío.
      if (datos.actual > 0 && datos.costo == null && datos.costo_total === 0) delete datos.costo_total;
      validarCosto(datos,datos.actual);
      if (datos.unidad) datos.unidad = UNIDADES[normal(datos.unidad)] || datos.unidad.toLowerCase();
    }
    if (t === 'finanzas' || t === 'movimientos') {
      if (datos.clase != null) {
        const clase = CLASES[t][normal(datos.clase)];
        if (!clase) throw new Error('Tipo de movimiento · «' + datos.clase + '» no es ' + (t === 'finanzas' ? 'ingreso ni gasto.' : 'entrada ni salida.'));
        if (t === 'movimientos' && ['consumo','merma','venta','compra','despacho'].includes(normal(datos.clase)) && !datos.motivo)
          datos.motivo = datos.clase;
        datos.clase = clase;
      } else if (hoja.fijos.clase) datos.clase = hoja.fijos.clase;
    }
    if (t === 'finanzas') {
      const ing = datos.monto_ingreso, egr = datos.monto_egreso;
      delete datos.monto_ingreso; delete datos.monto_egreso;
      if (datos.monto == null && (ing || egr)) {
        if (ing && egr) throw new Error('La fila tiene ingreso y gasto a la vez: sepáralos en dos filas.');
        datos.monto = ing || egr;
        datos.clase = ing ? 'ingreso' : 'egreso';
      }
      if (datos.monto < 0) {
        // Un monto negativo es un gasto cuando la hoja no dice el tipo.
        if (datos.clase && datos.clase !== 'egreso') throw new Error('Monto · un ingreso no puede ser negativo.');
        datos.clase = 'egreso';
        datos.monto = -datos.monto;
      }
      if (!datos.monto) throw new Error('Monto · falta un valor mayor que cero.');
      if (!datos.clase) throw new Error('Tipo de movimiento · indica si es ingreso o gasto.');
      const cat = categoriaFinanzas(datos.categoria, datos.clase);
      datos.categoria = cat.id;
      if (cat.nota) datos.descripcion = (datos.descripcion + ' (' + cat.nota + ')').slice(0, 300);
      if (datos.metodo) datos.metodo = METODOS[normal(datos.metodo)] || 'otro';
    }
    if (t === 'movimientos') {
      if (!datos.motivo && hoja.fijos.motivo) datos.motivo = hoja.fijos.motivo;
      if (datos.cant_entrada > 0 || datos.cant_salida > 0 ||
          datos.cantidad == null && (hoja.mapa.cant_entrada != null || hoja.mapa.cant_salida != null)) {
        const entrada = datos.cant_entrada || 0, salida = datos.cant_salida || 0;
        if ((entrada > 0) === (salida > 0)) throw new Error('Cada fila del kardex debe indicar unidades en entrada o en salida.');
        const clase = entrada ? 'entrada' : 'salida', cantidad = entrada || salida;
        if (datos.clase && datos.clase !== clase || datos.cantidad != null && datos.cantidad !== cantidad)
          throw new Error('La cantidad o el tipo contradice las columnas de entrada y salida.');
        datos.cantidad = cantidad;
        datos.clase = clase;
      }
      delete datos.cant_entrada;
      delete datos.cant_salida;
      if (!datos.clase) throw new Error('Tipo de movimiento · indica si es entrada o salida.');
      if (!(datos.cantidad > 0)) throw new Error('Cantidad · indica las unidades del movimiento.');
      for (const campo of ['costo','costo_total']) {
        const prefijo = campo === 'costo' ? 'costo_unitario_' : 'costo_total_';
        const especifico = datos[prefijo + datos.clase];
        const contrario = datos[prefijo + (datos.clase === 'entrada' ? 'salida' : 'entrada')];
        if (contrario > 0 || especifico != null && datos[campo] != null && datos[campo] !== especifico)
          throw new Error('Los costos declarados en las columnas de entrada y salida contradicen el movimiento.');
        if (especifico != null) datos[campo] = especifico;
        delete datos[prefijo + 'entrada'];
        delete datos[prefijo + 'salida'];
      }
      validarCosto(datos, datos.cantidad);
      if (esEmpresaMedica()) {
        if (datos.costo == null) throw new Error('El kardex histórico requiere el costo unitario o el valor total al costo.');
        datos.documental = true;
      } else if (datos.unidad) {
        const unidad = UNIDADES[normal(datos.unidad)];
        if (!unidad) throw new Error('Unidad de movimiento desconocida: ' + datos.unidad + '. Verifica la presentación del catálogo.');
        datos.unidad = unidad;
      }
    }
    if (datos.sku?.length > 100) throw new Error('El código de producto supera los 100 caracteres.');
    if (t === 'productos') {
      validarCosto(datos, datos.stock);
      if (datos.stock > 0 && datos.costo == null) throw new Error('Para valorar las existencias, indica su costo unitario o su valor total al costo.');
      if (datos.unidad) {
        const unidad = UNIDADES[normal(datos.unidad)];
        if (!unidad && datos.stock > 0) throw new Error('Unidad de apertura desconocida: ' + datos.unidad + '. Verifica la presentación antes de cargar las existencias.');
        if (!unidad) datos.descripcion = [datos.descripcion, 'Unidad original: ' + datos.unidad].filter(Boolean).join(' · ').slice(0, 300);
        datos.unidad = unidad || 'unidad';
      }
      if (datos.categoria) datos.categoria = CATEGORIAS_INV[normal(datos.categoria)] || 'general';
      if (datos.stock > 0 && !datos.fecha) {
        datos.fecha = estado?.fechaApertura ?? hoy();
        if (!datos.fecha) throw new Error('Selecciona la fecha de apertura de las existencias sin fecha en el archivo.');
      }
    }
    for (const [id, rotulo, obligatorio] of TIPOS[t].campos)
      if (obligatorio === 1 && (datos[id] == null || datos[id] === '')) throw new Error(rotulo + ' · Falta un valor válido.');
    return {tipo:t, archivo:hoja.archivo, hoja:hoja.nombre, fila:fila.numero, datos};
  }

  // Huella estable de una fila para reconocerla si se vuelve a importar el mismo archivo.
  function huella(texto) {
    let h = 0x811c9dc5;
    for (let i = 0; i < texto.length; i++) { h ^= texto.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }

  // El pie impreso de la bodega puede repartir el rótulo o su importe en dos filas.
  // Solo admite el rótulo y la celda de valor, nunca una fila con cantidades de artículos.
  function piesDeControl(hoja, filas) {
    const pies = new Set(), totales = [];
    const rotulos = new Set(['valor total del inventario','valor total inventario','total inventario','total general','gran total','total','totales','subtotal','sub total']);
    const monto = hoja.mapa.costo_total;
    const celdas = f => f.celdas.flatMap((c,col) =>
      c && (c.invalida || String(c.valor ?? '').trim()) ? [{...c,col}] : []);
    const rotulo = cs => normal(cs.map(c => c.valor).join(' '));
    for (let i = 0; i < filas.length; i++) {
      const fila = filas[i];
      let partes = celdas(fila);
      if (!partes.length || typeof partes[0].valor !== 'string') continue;
      if (partes.some(c => c.col === hoja.mapa.sku || c.col === hoja.mapa.unidad)) continue;
      const siguiente = filas[i+1];
      let ocupaSiguiente = false;
      const prefijo = rotulo(partes);
      if (siguiente && siguiente.numero === fila.numero+1 && (rotulos.has(prefijo) || prefijo === 'valor total del' || prefijo === 'valor total')) {
        const segunda = celdas(siguiente);
        if (segunda.length && (segunda.length===1 && segunda[0].col===monto ||
          rotulos.has(rotulo([...partes,...segunda.filter(c=>c.col!==monto)])))) {
          partes = partes.concat(segunda);
          ocupaSiguiente = true;
        }
      }
      let etiqueta = rotulo(partes), importe;
      if (!rotulos.has(etiqueta)) {
        importe = partes.at(-1);
        if (monto==null || importe.col!==monto || partes.length<2) continue;
        etiqueta = rotulo(partes.slice(0,-1));
      }
      if (!rotulos.has(etiqueta)) continue;
      pies.add(fila.numero);
      if (ocupaSiguiente) { pies.add(siguiente.numero); i++; }
      if (importe && !['subtotal','sub total'].includes(etiqueta))
        totales.push({numero:ocupaSiguiente?siguiente.numero:fila.numero,importe});
    }
    return {pies,totales};
  }

  // Filas que no son datos: totales al pie y filas sin nada en las columnas asignadas.
  function filaIgnorable(hoja, fila) {
    const columnas = Object.values(hoja.mapa);
    if (columnas.some(i => fila.celdas[i]?.invalida)) return false;
    if (hoja.tipo === 'diario' && hoja.mapa.documento != null && texto(fila.celdas[hoja.mapa.documento])) return false;
    const valores = columnas.map(i => fila.celdas[i]).filter(c => c && !c.invalida && String(c.valor ?? '').trim() !== '');
    if (hoja.tipo === 'control_inventario') {
      // El consecutivo y el porcentaje de ganancia pueden venir prellenados hasta el final.
      const nota = fila.celdas[hoja.metadataControl?.colObservaciones];
      if (nota?.invalida || String(nota?.valor ?? '').trim()) return false;
      return Object.entries(hoja.mapa).every(([campo,i]) => {
        const valor = fila.celdas[i]?.valor;
        return !String(valor ?? '').trim() || campo==='ganancia_pct' ||
          (['actual','margen_ganancia','costo_total'].includes(campo) && valor===0);
      });
    }
    if (!valores.length) return true;
    if (['productos','movimientos'].includes(hoja.tipo)) {
      const nombre = normal(fila.celdas[hoja.mapa[hoja.tipo === 'productos' ? 'nombre' : 'producto']]?.valor);
      if (nombre && !TOTALES.has(nombre)) return false;
    }
    return columnas.some(i => typeof fila.celdas[i]?.valor === 'string' && TOTALES.has(normal(fila.celdas[i].valor)));
  }

  function preparar() {
    const filas = [], vistas = {};
    const errores = estado.hojas.filter(h => h.error || (!h.tipo && !h.control && !h.fiscal && !h.omitida && h.filas.length))
      .map(h => ({archivo:h.archivo,hoja:h.nombre,fila:h.encabezado,
        error:h.error || 'No se identificó el destino de la hoja. Selecciona el destino o indica que se puede omitir.'}));
    const facturas = new Map();
    const asientos = new Map();
    let ignoradas = 0;
    let aperturasSinFecha = 0;
    const hojasControl = estado.hojas.filter(h => h.tipo === 'control_inventario');
    let control = null;
    if (hojasControl.length) {
      const modo = el('control-modo').value, fechaCorte = el('control-fecha').value, bodega = el('control-bodega').value.trim();
      control = {p_modo:modo,p_fecha:fechaCorte,p_bodega:bodega};
      if (!['apertura','cierre'].includes(modo) || !fechaCorte || !bodega)
        errores.push({error:'Completa el uso del control, la fecha de corte y el área o bodega.'});
      else if (modo === 'cierre' && new Date(Date.parse(fechaCorte+'T12:00:00Z')+86400000).getUTCDate() !== 1)
        errores.push({error:'Para el cierre mensual, selecciona el último día del mes.'});
      else if (modo === 'apertura' && !fechaCorte.endsWith('-01') && new Date(Date.parse(fechaCorte+'T12:00:00Z')+86400000).getUTCDate() !== 1)
        errores.push({error:'Usa una apertura documentada al primer día del mes o al cierre del mes anterior.'});
      for (const h of hojasControl) {
        if (h.metadataControl?.bodega && normal(h.metadataControl.bodega) !== normal(bodega) ||
            h.metadataControl?.fecha && h.metadataControl.fecha !== fechaCorte)
          errores.push({archivo:h.archivo,hoja:h.nombre,error:'La fecha o la bodega que declaraste difiere de la cabecera. Revisa el archivo y separa los controles de distintas bodegas o fechas.'});
      }
      if (estado.hojas.some(h => h.tipo && h.tipo !== 'control_inventario' || h.control))
        errores.push({error:'Carga el control de bodega por separado de los documentos de otros destinos.'});
    }
    for (const h of estado.hojas.filter(h => h.tipo)) {
      const origen = {archivo:h.archivo, hoja:h.nombre, fila:h.encabezado};
      const falta = faltantes(h);
      if (falta.length || new Set(Object.values(h.mapa)).size !== Object.values(h.mapa).length) {
        errores.push({...origen, error:falta.length ? 'Asigna ' + falta.join(', ') + '.' : 'Asigna una columna distinta a cada campo.'});
        continue;
      }
      const candidatas = h.filas.filter(f => f.numero > h.encabezado);
      const pieControl = h.tipo==='control_inventario' ? piesDeControl(h,candidatas) : null;
      const lotes = cabecera(h).flatMap((c,i) => /\b(lote|serie|bodega|almacen)\b/.test(normal(c?.valor)) ? [i] : []);
      if (h.tipo === 'productos' && lotes.length && candidatas.some(f => lotes.some(i => String(f.celdas[i]?.valor ?? '').trim()))) {
        errores.push({...origen, error:'El archivo detalla existencias por lote, serie o almacén. La apertura de productos requiere existencias consolidadas por artículo. Conserva el desglose para cargarlo con sus lotes.'});
        continue;
      }
      let datosHoja = 0;
      let sumaCentavos = 0n, costosIncompletos = false;
      for (const fila of candidatas) {
        if (pieControl?.pies.has(fila.numero) || filaIgnorable(h, fila)) { ignoradas++; continue; }
        datosHoja++;
        try {
          const r = normalizar(h, fila);
          if (r.tipo === 'control_inventario') {
            const d = r.datos;
            const unidades = BigInt(Math.round(d.actual*1000)), costo = BigInt(Math.round((d.costo ?? 0)*10000));
            sumaCentavos += (unidades*costo+50000n)/100000n;
          }
          if (r.tipo === 'productos' && r.datos.stock > 0 && !texto(fila.celdas[h.mapa.fecha])) aperturasSinFecha++;
          if (r.tipo === 'productos' && h.mapa.costo_total != null) {
            if (r.datos.costo == null && r.datos.stock !== 0 && r.datos.costo_total == null) costosIncompletos = true;
            else {
              const unidades = BigInt(Math.round((r.datos.stock ?? 0) * 1000));
              const costo = BigInt(Math.round((r.datos.costo ?? 0) * 10000));
              sumaCentavos += (unidades * costo + 50000n) / 100000n;
            }
          }
          if (['finanzas','movimientos'].includes(r.tipo) && !r.datos.id_origen) {
            const identidad = {...r.datos};
            if (r.tipo === 'movimientos' && !r.datos.documental) {
              // La misma fila física conserva la clave que generaba el importador anterior.
              delete identidad.sku;
              delete identidad.unidad;
              delete identidad.costo;
              delete identidad.costo_total;
              if (!texto(fila.celdas[h.mapa.motivo])) delete identidad.motivo;
            }
            const base = r.tipo + '|' + JSON.stringify(identidad);
            vistas[base] = (vistas[base] || 0) + 1;
            if (r.tipo === 'movimientos' && vistas[base] > 1)
              throw new Error('Hay movimientos idénticos sin ID de origen. Indica el identificador de cada movimiento para evitar registrarlos dos veces.');
            r.datos.id_origen = 'auto-' + huella(base) + '-' + vistas[base];
          }
          if (r.tipo === 'diario') {
            const {documento,fecha,...datos} = r.datos;
            const clave = fecha + '|' + documento.toLowerCase();
            const linea = {...datos,origen:{archivo:r.archivo,hoja:r.hoja,fila:r.fila}};
            const asiento = asientos.get(clave);
            if (asiento) {
              if (asiento.hoja !== h)
                throw new Error('El asiento ' + documento + ' aparece en otra hoja de la carga.');
              asiento.registro.datos.lineas.push(linea);
            }
            else {
              r.datos = {documento,fecha,lineas:[linea]};
              asientos.set(clave,{hoja:h,registro:r});
              filas.push(r);
            }
          } else if (r.tipo === 'facturas') {
            const {descripcion,cantidad,precio_linea,costo_linea,...cabecera} = r.datos;
            const clave = cabecera.documento.toLowerCase();
            const existente = facturas.get(clave);
            const linea = {descripcion,cantidad,precio:precio_linea,costo:costo_linea};
            if (existente) {
              if (JSON.stringify(existente.cabecera) !== JSON.stringify(cabecera))
                throw new Error('La cabecera no coincide con las demás líneas de la factura ' + cabecera.documento + '.');
              existente.r.datos.lineas.push(linea);
            } else {
              r.datos = {...cabecera,lineas:[linea]};
              facturas.set(clave,{r,cabecera});
              filas.push(r);
            }
          } else filas.push(r);
        }
        catch (error) { errores.push({...origen, fila:fila.numero, error:error.message}); }
      }
      if (pieControl) {
        for (const pie of pieControl.totales) {
          try {
            const declarado = decimal(pie.importe,2,false,true);
            if (declarado != null && sumaCentavos !== BigInt(Math.round(declarado*100)))
              throw new Error('El valor total del inventario difiere de la suma de los importes conocidos por producto.');
          } catch (error) { errores.push({...origen,fila:pie.numero,error:error.message}); }
        }
      }
      if (h.tipo === 'productos' && h.mapa.costo_total != null) {
        const pie = candidatas.filter(f => f.celdas.some(c => String(c?.valor ?? '').trim())).at(-1);
        if (pie && filaIgnorable(h,pie) && pie.celdas.some(c => ['total','total general','gran total','totales'].includes(normal(c?.valor)))) {
          try {
            const declarado = decimal(pie.celdas[h.mapa.costo_total],2,false,true);
            if (declarado != null && (costosIncompletos || sumaCentavos !== BigInt(Math.round(declarado * 100))))
              throw new Error('El valor total al costo al pie de la hoja no cuadra con el detalle de los productos.');
          } catch (error) { errores.push({...origen,fila:pie.numero,error:error.message}); }
        }
      }
      if (!datosHoja) errores.push({...origen, error:'La hoja no tiene datos después del encabezado.'});
    }
    const controles = estado.hojas.filter(h => h.control);
    if (asientos.size || controles.length || estado.hojas.some(h => h.fiscal) && filas.length) {
      const faltan = [];
      if (!asientos.size) faltan.push('libro diario');
      if (!controles.some(h => h.control === 'balanza')) faltan.push('balanza');
      if (!controles.some(h => h.control === 'auxiliar')) faltan.push('auxiliares');
      if (faltan.length) errores.push({error:'Migración pendiente. Falta adjuntar: ' + faltan.join(', ') + '.'});
    }
    for (const h of controles) {
      let cantidad = 0;
      for (const f of h.filas.filter(f => f.numero > h.encabezado)) {
        const origen = {archivo:h.archivo,hoja:h.nombre,fila:f.numero};
        try {
          const celda = k => f.celdas[h.mapa[k]];
          const cuenta = texto(celda('cuenta'),true);
          if (TOTALES.has(normal(cuenta)) || !cuenta && f.celdas.some(c => TOTALES.has(normal(c?.valor)))) continue;
          if (!cuenta) throw new Error('Falta el código de cuenta.');
          const datos = {cuenta,nombre:texto(celda('nombre'))};
          for (const k of ['desde','corte']) {
            if (h.mapa[k] != null) {
              datos[k] = fecha(celda(k),h.fecha1904);
              if (!datos[k]) throw new Error('Falta la fecha de ' + k + '.');
            }
          }
          for (const k of h.control === 'balanza' ? ['apertura','debe','haber','saldo'] : ['saldo']) {
            datos[k] = decimal(celda(k),2,['apertura','saldo'].includes(k),true);
            if (datos[k] == null && ['debe','haber'].includes(k)) datos[k] = 0;
            if (datos[k] == null) throw new Error('Falta el importe de ' + k + '.');
          }
          if (h.control === 'auxiliar' && (h.mapa.debe != null || h.mapa.haber != null)) {
            if (h.mapa.debe == null || h.mapa.haber == null) throw new Error('El auxiliar de movimientos requiere Debe y Haber.');
            datos.debe = decimal(celda('debe'),2,false,true) ?? 0;
            datos.haber = decimal(celda('haber'),2,false,true) ?? 0;
          }
          filas.push({...origen,tipo:h.control,datos});
          cantidad++;
        } catch (error) { errores.push({...origen,error:error.message}); }
      }
      if (!cantidad) errores.push({archivo:h.archivo,hoja:h.nombre,error:'El control no contiene cuentas válidas.'});
    }
    return {filas, errores, ignoradas, aperturasSinFecha,control};
  }

  function resumenControl(plan,resumen) {
    const grupos=new Map(), formato=v=>fmtC(Number(v)/100);
    for (const fila of plan.filas) {
      const d=fila.datos, clave=JSON.stringify([fila.archivo,fila.hoja]);
      if (!grupos.has(clave)) grupos.set(clave,{hoja:fila.hoja,bonificacion:!!d.bonificacion,filas:[],importe:0n});
      const grupo=grupos.get(clave);
      const centavos=d.costo_total!=null ? BigInt(Math.round(d.costo_total*100)) : d.costo!=null ?
        (BigInt(Math.round(d.actual*1000))*BigInt(Math.round(d.costo*10000))+50000n)/100000n : d.actual===0 ? 0n : null;
      grupo.importe+=centavos??0n;
      grupo.filas.push({fila:fila.fila,nombre:d.nombre,cantidad:d.actual,unidad:d.unidad,centavos});
    }
    const cantidad=plan.filas.length, fichas=resumen.nuevas+resumen.duplicadas, faltan=resumen.productos_sin_costo;
    const lineas=[...grupos.values()].map(g=>{
      const rotulo=g.bonificacion?'Bonificaciones':g.hoja;
      return '<div class="excel-resumen-hoja"><strong>'+escAttr(rotulo)+'</strong><span>'+g.filas.length+
        (g.filas.length===1?' fila':' filas')+' · '+escAttr(formato(g.importe))+'</span></div>';
    }).join('');
    el('resultados').innerHTML='<div class="excel-resumen-control">'+lineas+
      '<p class="excel-totales">Total con costo conocido · '+escAttr(fmtC(resumen.valor_conocido))+'</p>'+
      (cantidad>fichas?'<p>'+cantidad+' filas agrupadas en '+escAttr(fichas)+' fichas de inventario.</p>':'')+
      (faltan?'<p>'+escAttr(faltan)+(faltan===1?' artículo pendiente':' artículos pendientes')+' de valorar.</p>':'')+
      (estado.copias?'<p>Copias idénticas omitidas: '+estado.copias+'.</p>':'')+'</div>'+
      '<details><summary>Ver las '+cantidad+' filas del archivo</summary>'+
      [...grupos.values()].map(g=>'<p>'+escAttr(g.hoja)+'</p><div class="excel-tabla"><table><thead><tr><th>Fila</th><th>Artículo</th><th>Existencia</th><th>Valor</th></tr></thead><tbody>'+
        g.filas.map(f=>'<tr><td>'+escAttr(f.fila)+'</td><td>'+escAttr(f.nombre)+'</td><td>'+escAttr(f.cantidad+' '+f.unidad)+
          '</td><td>'+escAttr(f.centavos===null?'Pendiente':formato(f.centavos))+'</td></tr>').join('')+'</tbody></table></div>').join('')+'</details>';
  }

  function resultados(entradas, resumen = null, plan = null) {
    if (resumen && plan?.control && soloControl(estado) && !resumen.errores) {resumenControl(plan,resumen);return;}
    const omitidas = estado.hojas.filter(h => h.omitida).length;
    const partes = resumen ? [
      resumen.conciliacion && 'Diario, balanza y auxiliares conciliados del ' + resumen.conciliacion.desde + ' al ' + resumen.conciliacion.hasta,
      resumen.productos && resumen.productos + ' producto(s)', resumen.proveedores && resumen.proveedores + ' proveedor(es)',
      resumen.clientes && resumen.clientes + ' cliente(s)', resumen.movimientos && resumen.movimientos + ' movimiento(s)',
      resumen.productos && resumen.valor_inventario_inicial != null && 'Inventario de apertura valorizado: ' + fmtC(resumen.valor_inventario_inicial),
      resumen.productos_sin_costo && resumen.productos_sin_costo + ' producto(s) sin costo informado',
      resumen.valor_conocido != null && 'Valor conocido del control: ' + fmtC(resumen.valor_conocido),
      resumen.movimientos && resumen.valor_entradas != null && 'Entradas valorizadas: ' + fmtC(resumen.valor_entradas) + ' · Salidas valorizadas: ' + fmtC(resumen.valor_salidas),
      resumen.entradas_sin_costo && resumen.entradas_sin_costo + ' entrada(s) sin costo histórico',
      resumen.salidas_sin_costo && resumen.salidas_sin_costo + ' salida(s) sin costo histórico',
      estado.aperturasSinFecha && estado.aperturasSinFecha + ' apertura(s) sin fecha en el archivo. Se asignó ' + estado.fechaApertura,
      resumen.finanzas && `${resumen.finanzas} movimiento(s) de caja · Ingresos ${fmtC(resumen.ingresos)} · Gastos ${fmtC(resumen.egresos)}`,
      resumen.cxc && `${resumen.cxc} saldo(s) por cobrar: ${fmtC(resumen.por_cobrar)}`,
      resumen.cxp && `${resumen.cxp} saldo(s) por pagar: ${fmtC(resumen.por_pagar)}`,
      resumen.facturas && `${resumen.facturas} factura(s) histórica(s)`,
      resumen.asientos && `${resumen.asientos} asiento(s) · Debe ${fmtC(resumen.debe)} · Haber ${fmtC(resumen.haber)}`
    ].filter(Boolean) : [];
    const montos = resumen ? `<p class="excel-totales">${resumen.nuevas} nuevas · ${resumen.duplicadas} ya registradas · ${resumen.errores} con errores
      ${partes.length ? '<br>' + partes.map(escAttr).join('<br>') : ''}
      ${omitidas ? `<br>Hojas omitidas: ${omitidas}` : ''}${estado.ignoradas ? `<br>Filas de totales o vacías que no se importan: ${estado.ignoradas}` : ''}</p>` : '';
    el('resultados').innerHTML = montos + (entradas.length ? `<div class="excel-tabla" tabindex="0" aria-label="Detalle de filas"><table>
      <thead><tr><th>Archivo y hoja</th><th>Fila</th><th>Registro</th><th>Resultado</th></tr></thead>
      <tbody>${entradas.map(r => `<tr><td>${escAttr(r.archivo)}<br>${escAttr(r.hoja)}</td><td>${escAttr(r.fila)}</td>
        <td>${escAttr(r.detalle || '')}</td><td class="${r.error ? 'excel-error' : ''}">${escAttr(r.error || (r.estado === 'duplicada' ? 'Ya registrada' : r.registro_id || r.estado === 'guardada' ? 'Guardada' : 'Lista para guardar'))}</td></tr>`).join('')}</tbody>
      </table></div>` : '');
  }

  async function solicitar(e, confirmar, reconocidas = 0) {
    if (!activo(e) || e.ocupado) return;
    const version = e.version;
    if (!confirmar) { e.plan=null; e.reintentar=false; }
    const plan = confirmar ? e.plan : preparar();
    if (!plan) return;
    if (!confirmar) {
      e.ignoradas = plan.ignoradas;
      e.aperturasSinFecha = plan.aperturasSinFecha;
    }
    const superaLimite = plan.filas.filter(r => !['auxiliar','balanza'].includes(r.tipo)).length > LIMITE;
    if (!confirmar && (plan.errores.length || !plan.filas.length || superaLimite)) {
      resultados(plan.errores);
      const limite = plan.control ? 'El control supera el límite de 1,000 artículos por bodega y corte. Cada control requiere el conteo completo.' :
        'Divide la carga en grupos de hasta 1,000 filas.';
      mensaje(superaLimite ? limite : 'Corrige los errores de la revisión.', true);
      return;
    }
    recogerEstado(e, confirmar ? 'guardando' : 'validando', confirmar ? 'Guardando la importación…' : 'Validando con el establecimiento…');
    try {
      const {data, error} = await sb.rpc(plan.control ? 'importar_control_inventario' : 'importar_excel', {
        ...plan.control,
        p_clinica:e.clinica, p_filas:plan.filas, p_confirmar:confirmar,
        p_revision:confirmar ? plan.revision : null
      });
      if (!activo(e) || version !== e.version) return;
      if (error?.code === 'PGRST202' || error?.code === '42883') throw new Error(plan.control ?
        'Aplica la migración del Informe maestro mensual en Supabase.' : 'Falta aplicar la migración de importación de Excel en Supabase.');
      if (plan.control && error?.code === '42703' && /\b(sku|costo_unitario|valor_costo|costo_importado)\b/i.test(error.message))
        throw new Error('Falta actualizar el inventario en Supabase. Ejecuta migracion_informe_maestro.sql y pulsa «Volver a revisar» con el mismo Excel.');
      if (error && /tipo_check|no tienes permiso para uno de los destinos/i.test(error.message || ''))
        throw new Error('Falta aplicar la versión nueva de migracion_importar_excel.sql en Supabase (proveedores, clientes y saldos).');
      if (plan.control && !confirmar && (error?.message==='Hay artículos repetidos en el control de esa bodega.' ||
          (!error && data?.resumen?.filas_origen==null && plan.filas.some(r=>r.datos.bonificacion || r.datos.observaciones || r.datos.fecha_origen))))
        throw new Error('Actualiza migracion_informe_maestro.sql en Supabase para conservar las bonificaciones y las filas de origen.');
      if (error) throw new Error(error.message);
      const requiereValoracion = plan.filas.some(r => r.tipo === 'productos' && (r.datos.sku != null || r.datos.costo_total != null) ||
        r.tipo === 'movimientos' && (r.datos.documental || r.datos.sku != null || r.datos.unidad != null || r.datos.costo != null || r.datos.costo_total != null));
      if (!confirmar && requiereValoracion && data.resumen?.valor_inventario_inicial == null)
        throw new Error('Actualiza migracion_importar_excel.sql en Supabase para guardar los códigos y los costos del inventario.');
      resultados(data.filas, data.resumen, plan);
      e.plan = !data.resumen.errores && data.resumen.nuevas && (!confirmar || data.cambio)
        ? {...plan, revision:data.revision} : null;
      if (data.resumen.errores) mensaje('Hay filas que requieren corrección. La carga sigue sin guardar.', true);
      else if (data.cambio) mensaje('Cambió el resultado desde la última revisión. Comprueba el detalle actualizado antes de guardar.', true);
      else if (confirmar && data.lote && plan.control) {
        const {p_fecha,p_bodega,p_modo} = plan.control;
        mensaje((p_modo === 'apertura' ? 'Apertura de inventario registrada' : 'Conteo mensual guardado')+' · '+p_bodega+' · '+p_fecha+
          '. Consulta el detalle en Libro contable → Informe maestro.');
        await loadAll();
        if (activo(e)) {
          if (currentView !== 'libro-contable') renderView(currentView);
          document.dispatchEvent(new CustomEvent('inventario-importado',{detail:{clinica:e.clinica,fecha:p_fecha,modo:p_modo}}));
          if (el('historial-toggle').open) await historial();
        }
      } else if (confirmar && data.lote) {
        mensaje('Importación guardada. Comprobante ' + data.lote + '.');
        if (el('historial-toggle').open) await historial();
        else el('historial-toggle').open = true;
        if (data.resumen.conciliacion) await leerExpediente(e);
        await loadAll();
        if (activo(e)) {
          const inventario = plan.filas.some(r=>r.tipo==='productos'||r.tipo==='movimientos');
          if (currentView === 'finanzas') renderFinanzas();
          else if (!inventario || currentView!=='libro-contable') renderView(currentView);
          if (inventario) document.dispatchEvent(new CustomEvent('inventario-importado',{detail:{clinica:e.clinica}}));
        }
      } else if (data.resumen.nuevas) mensaje(plan.control && soloControl(e) ? 'Inventario revisado. Confirma la carga.' :
        (reconocidas ? 'Se reconocieron ' + reconocidas + ' hoja(s) y se revisaron sus filas. ' : '')+'Comprueba el detalle y pulsa «Guardar importación».');
      else mensaje(plan.control ? 'Este control ya está guardado. Consulta sus filas en el Informe maestro.' :
        'Todas las filas ya están registradas. Consulta sus comprobantes en el historial.');
    } catch (error) {
      if (activo(e) && version===e.version) {
        e.reintentar=true;
        mensaje(error.message || 'No se pudo completar la importación.', true);
      }
    } finally {
      if (activo(e) && version===e.version) { e.ocupado = ''; controles(); }
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
    descargar('﻿' + TIPOS[tipo].campos.map(([id]) => id).join(';') + '\r\n', tipo + '.csv', 'text/csv;charset=utf-8');
  }

  async function leerExpediente(e) {
    try {
      const {data,error} = await consultarPaginas(() => sb.from('expediente_fiscal_excel')
        .select('id,archivo,creado_en').eq('clinica_id',e.clinica).order('archivo').order('id'));
      if (!activo(e)) return;
      if (error) throw error;
      e.documentos = data;
      const libros = data.filter(doc => /\.(xlsx?|csv)$/i.test(doc.archivo)).length;
      el('expediente-resumen').textContent = 'Expediente fiscal · ' + libros + ' Excel/CSV · ' + (data.length-libros) + ' anexos';
      el('documentos').innerHTML = data.length ? data.map((doc,i) =>
        `<div class="excel-recibo"><span>${escAttr(doc.archivo)}</span><button class="btn btn-secondary btn-sm" type="button" onclick="ExcelImportacion.descargarOriginal(${i})">Descargar original</button></div>`).join('') :
        'El expediente todavía está vacío.';
      const ultima = await sb.from('importaciones_excel').select('creado_en,resumen').eq('clinica_id',e.clinica)
        .not('resumen->conciliacion','is',null).order('creado_en',{ascending:false}).limit(1);
      if (!activo(e)) return;
      if (ultima.error) throw ultima.error;
      const periodo = ultima.data[0]?.resumen?.conciliacion;
      el('situacion').textContent = periodo ? 'Último diario conciliado del ' + periodo.desde + ' al ' + periodo.hasta + '.' :
        data.length ? 'Migración pendiente. Hay respaldo fiscal. Falta conciliar el libro diario, la balanza y los auxiliares.' : '';
    } catch (error) {
      if (activo(e)) el('situacion').textContent = 'No se pudo consultar el estado del expediente. Verifica migracion_importar_excel.sql en Supabase.';
    }
  }

  async function archivar() {
    const e = estado;
    if (!activo(e) || e.ocupado || !e.respaldos.length || !hasPermiso('contabilidad')) return;
    recogerEstado(e,'guardando','Guardando originales del expediente…');
    try {
      while (e.respaldos.length) {
        const f = e.respaldos[0];
        const contenido = await new Promise((resolve,reject) => {
          const lector = new FileReader();
          lector.onerror = () => reject(new Error('No se pudo leer ' + f.name));
          lector.onload = () => resolve(lector.result.split(',')[1]);
          lector.readAsDataURL(f);
        });
        if (!activo(e)) return;
        const {error} = await sb.rpc('archivar_respaldo_fiscal',{p_clinica:e.clinica,p_archivo:f.webkitRelativePath || f.name,p_base64:contenido});
        if (error) throw new Error(f.name + ' · ' + error.message);
        e.respaldos.shift();
        if (!activo(e)) return;
      }
      mensaje('Originales guardados en el expediente fiscal. La migración contable requiere diario, balanza y auxiliares conciliados.');
    } catch (error) {
      if (activo(e)) mensaje(error.message + ' · Pendientes de guardar: ' + e.respaldos.length,true);
    } finally {
      if (activo(e)) { e.ocupado = ''; controles(); await leerExpediente(e); }
    }
  }

  async function originalFiscal(clinica,id) {
    const {data,error} = await sb.from('expediente_fiscal_excel').select('contenido').eq('clinica_id',clinica).eq('id',id).single();
    if (error) throw error;
    const hex = data.contenido.slice(2);
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i*2,i*2+2),16);
    return bytes;
  }

  async function descargarOriginal(indice) {
    const e = estado;
    const doc = e?.documentos[indice];
    if (!doc || !activo(e)) return;
    try {
      const bytes = await originalFiscal(e.clinica,doc.id);
      if (!activo(e)) return;
      descargar(bytes, doc.archivo.split('/').pop(), 'application/octet-stream');
    } catch (error) { if (activo(e)) mensaje('No se pudo descargar el original. ' + error.message,true); }
  }

  async function historial() {
    const e = estado;
    if (!e || !activo(e) || !el('historial-toggle').open) return;
    el('historial').textContent = 'Cargando comprobantes…';
    const [importados,controles] = await Promise.all([
      sb.from('importaciones_excel').select('id,creado_en,resumen').eq('clinica_id',e.clinica).order('creado_en',{ascending:false}).limit(25),
      esEmpresaMedica() && hasPermiso('inventario')
        ? sb.from('controles_inventario').select('id,creado_en,fecha,bodega,modo,vigente').eq('clinica_id',e.clinica).order('creado_en',{ascending:false}).limit(25)
        : Promise.resolve({data:[]})
    ]);
    if (!activo(e)) return;
    if (importados.error) {
      el('historial').textContent = 'No se pudo consultar el historial. Verifica que la migración esté aplicada.';
      return;
    }
    e.recibos = [...importados.data,...(controles.data||[]).filter(l => ['apertura','cierre'].includes(l.modo))]
      .sort((a,b) => new Date(b.creado_en)-new Date(a.creado_en)).slice(0,25);
    el('historial').innerHTML = e.recibos.map((l,i) => `<div class="excel-recibo"><span>${escAttr(new Date(l.creado_en).toLocaleString('es'))} · ${l.modo ?
      escAttr((l.modo==='apertura'?'Apertura de bodega':'Conteo mensual')+' · '+l.bodega+' · '+l.fecha+(l.vigente?'':' · Sustituido')) :
      Number(l.resumen.nuevas)+' filas'+(l.resumen.conciliacion ? ' · Diario, balanza y auxiliares conciliados' : '')}</span>
      <button type="button" class="btn btn-secondary btn-sm" onclick="ExcelImportacion.comprobante(${i})">Descargar comprobante</button></div>`).join('')
      || 'Todavía no hay importaciones guardadas.';
    if (controles.error && !['PGRST205','42P01'].includes(controles.error.code))
      el('historial').insertAdjacentText('beforeend',' No se pudieron consultar los comprobantes de bodega.');
  }

  async function comprobante(indice) {
    const e = estado;
    const lote = e?.recibos[indice];
    if (!lote || !activo(e)) return;
    if (lote.modo) {
      const {data,error} = await sb.from('controles_inventario').select('id,creado_en,fecha,bodega,modo,vigente,filas')
        .eq('clinica_id',e.clinica).eq('id',lote.id).single();
      if (!activo(e)) return;
      if (error || !Array.isArray(data?.filas)) { mensaje('No se pudo descargar el control de bodega completo.',true); return; }
      descargar(JSON.stringify(data,null,2),'control-inventario-'+lote.fecha+'-'+lote.id+'.json','application/json');
      return;
    }
    const {data,error} = await consultarPaginas(() => sb.from('importaciones_excel_filas')
      .select('archivo,hoja,fila,tipo,clave,datos,registro_id,movimiento_inicial_id').eq('clinica_id',e.clinica).eq('lote_id',lote.id).order('ordinal'));
    if (!activo(e)) return;
    if (error || data.length !== lote.resumen.nuevas) {
      mensaje('No se pudo descargar el comprobante completo.', true);
      return;
    }
    descargar(JSON.stringify({...lote, filas:data}, null, 2), 'importacion-' + lote.id + '.json', 'application/json');
  }

  return {abrir,cerrar,cargar,cambiar,cambiarFechaApertura,cambiarControl,plantilla,historial,comprobante,archivar,descargarOriginal,leerArchivo,originalFiscal,fecha,
    revisar:() => estado && (estado.necesitaSugerencia ? sugerirControl(estado) : solicitar(estado,false)),
    confirmar:() => estado && solicitar(estado,true),
    // Para pruebas: el reconocimiento y la lectura de valores sin interfaz.
    _probar:{detectar, mapear, decimal, fecha, normalizar, faltantes, tiposDisponibles, filaIgnorable, piesDeControl}};
})();
