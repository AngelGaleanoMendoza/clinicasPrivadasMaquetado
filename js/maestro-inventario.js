// Las unidades provienen del kardex físico; los importes de compra y venta, de las líneas del documento.
// Los conteos firmados son una tercera fuente independiente para contrastar ambos.
const MaestroInventario = (() => {
  function periodo(mes) {
    if (!/^\d{4}-(0[1-9]|1[012])$/.test(mes) || mes < '1000-01')
      throw new Error('Selecciona un mes válido para el informe maestro.');
    const [anio, numero] = mes.split('-').map(Number);
    return {mes, desde:mes+'-01', hasta:mes+'-'+new Date(Date.UTC(anio,numero,0)).getUTCDate()};
  }

  // Cantidades a milésimas, costos unitarios a diezmilésimas e importes a centavos.
  // Un decimal que no cabe en la precisión de Excel se devuelve como texto en lugar de truncarlo.
  function escala(valor, decimales) {
    if (valor === null || valor === undefined || valor === '') return null;
    const partes = /^(-?)(\d+)(?:\.(\d+))?$/.exec(String(valor).trim());
    if (!partes || /[1-9]/.test((partes[3]||'').slice(decimales)))
      throw new Error('La fuente incluye un valor fuera de precisión: '+valor);
    const numero = BigInt(partes[2]+(partes[3]||'').slice(0,decimales).padEnd(decimales,'0'));
    return partes[1] ? -numero : numero;
  }
  function decimal(n, decimales) {
    if (n === null) return null;
    const digitos = (n < 0n ? -n : n).toString().padStart(decimales+1,'0');
    const literal = (n < 0n ? '-' : '')+digitos.slice(0,-decimales)+'.'+digitos.slice(-decimales);
    return digitos.replace(/^0+/,'').length <= 15 ? Number(literal) : literal;
  }
  const redondear = (n, d) => n < 0n ? -redondear(-n,d) : (n+d/2n)/d;
  const costoLinea = (cantidad,unitario) => cantidad === null || unitario === null ? null : redondear(cantidad*unitario,100000n);
  const sumar = (a,b) => a===null || b===null ? null : a+b;
  const restar = (a,b) => a===null || b===null ? null : a-b;
  const normal = s => String(s??'').trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const cmp = (a,b) => a<b ? -1 : a>b ? 1 : 0;
  const grupoBodega = f => normal(f.bodega || 'General');
  const referenciaControl = f => [f.archivo,f.hoja,'fila '+f.fila].filter(Boolean).join(' · ');
  const cantidad = valor => escala(valor,3);
  const moneda = valor => escala(valor,2);
  const unitario = valor => escala(valor,4);
  const totalCampo = (filas,k) => filas.reduce((total,f) => sumar(total,f[k]),0n);
  function costoControl(f) {
    const q = cantidad(f.actual);
    const u = unitario(f.costo);
    const total = moneda(f.costo_total);
    if (q === null) return null;
    if (total !== null && (total !== 0n || q === 0n || u !== null)) return total;
    return q === 0n ? 0n : costoLinea(q,u);
  }
  function precioCoincidente(filas,key,decimales=4) {
    const valores = filas.map(f=>escala(f[key],decimales));
    return valores.length && valores[0] !== null && valores.every(v=>v===valores[0]) ? valores[0] : null;
  }

  function calcular(mes,datos) {
    const {desde,hasta} = periodo(mes);
    const globales = new Set(), productos = new Map(), articulos = new Map(), fuentes = [];
    const bodegas = {apertura:new Map(),cierre:new Map()};
    for (const p of datos.productos) productos.set(String(p.id),p);
    function articulo(id,fallback,clave) {
      const llave = id == null ? clave : String(id);
      if (!articulos.has(llave)) {
        const p = productos.get(llave)||fallback||{};
        articulos.set(llave,{id:llave,codigo:p.sku||'',nombre:p.nombre||p.descripcion||'Artículo sin vínculo',
          categoria:p.categoria||'',unidad:p.unidad||'',apertura:[],cierre:[],pendientes:new Set(),
          entradas:0n,salidas:0n,compras:0n,costoVentas:0n,ventas:0n,ajusteNeto:0n,
          unidadesCompra:0n,unidadesVenta:0n,entradasCompra:0n,salidasVenta:0n});
      }
      const a = articulos.get(llave);
      if (id == null || !productos.has(llave)) a.pendientes.add('Falta la vinculación con el catálogo de inventario.');
      return a;
    }
    function trazar(a,tipo,f,documento,q,importe,referencia='',costo=null) {
      const fuente={id:String(f.id??[f.archivo,f.hoja,f.fila].join('/')),idProducto:a?.id??null,
        fecha:f.fecha??f.datos?.fecha??'',tipo,documento:String(documento??''),producto:a?.nombre||f.descripcion||'',
        cantidad:decimal(q,3),importe:decimal(importe,2),costoUnitario:decimal(costo,4),referencia:String(referencia||'')};
      if (f.bodega) Object.assign(fuente,{bodega:f.bodega,codigo:f.sku||a?.codigo||'',
        inicial:decimal(cantidad(f.inicial),3),entradas:decimal(cantidad(f.entradas),3),salidas:decimal(cantidad(f.salidas),3),
        precioCompra:decimal(unitario(f.precio_compra),4),precioVenta:decimal(unitario(f.precio),4),
        gananciaPct:decimal(escala(f.ganancia_pct,6),6),margenGanancia:decimal(moneda(f.margen_ganancia),2)});
      fuentes.push(fuente);
    }
    for (const [etapa,filas] of [['apertura',datos.aperturas],['cierre',datos.conteos]]) {
      const vistos = new Set();
      for (const f of filas) {
        const a = articulo(f.inventario_id,f,etapa+'-'+referenciaControl(f));
        const ubicacion = grupoBodega(f);
        bodegas[etapa].set(ubicacion,f.bodega||'General');
        const clave = JSON.stringify([a.id,ubicacion]);
        if (vistos.has(clave)) a.pendientes.add('Hay más de un conteo para el mismo artículo, bodega y corte.');
        vistos.add(clave);
        a[etapa].push(f);
        for (const origen of f.origenes || [f]) {
          const parte={...origen,fecha:f.fecha,bodega:f.bodega};
          const referencia=[referenciaControl(parte),parte.bonificacion?'Bonificación':'',parte.observaciones].filter(Boolean).join(' · ');
          trazar(a,etapa==='apertura'?'Saldo inicial':'Conteo final',parte,f.bodega||'General',cantidad(parte.actual),
            costoControl(parte),referencia,unitario(parte.costo));
        }
      }
    }
    if (!datos.aperturas.length) globales.add('Falta la apertura física o el cierre aprobado del mes anterior.');
    if (!datos.conteos.length) globales.add('Falta el conteo independiente del último día del mes.');
    for (const [k,nombre] of bodegas.apertura)
      if (k!=='sin bodega en archivo' && !bodegas.cierre.has(k))
        globales.add('Falta el conteo final de la bodega '+nombre+'.');

    const documentosComerciales=new Map();
    function unidadesDocumento(tipo,a,fecha,referencia,campo,q) {
      const clave=JSON.stringify([tipo,a.id,fecha,normal(referencia)]);
      let doc=documentosComerciales.get(clave);
      if (!doc) {
        doc={a,tipo,fecha,referencia,documentadas:0n,fisicas:0n};
        documentosComerciales.set(clave,doc);
      }
      doc[campo]=sumar(doc[campo],q);
    }
    for (const [tipo,docs] of [['Compra',datos.compras],['Venta',datos.ventas]]) {
      for (const f of docs) {
        if (f.saldo_inicial || f.estado==='anulada' || f.fecha<desde || f.fecha>hasta) continue;
        const a = articulo(f.inventario_id,f,tipo+'-'+f.id);
        const q = cantidad(f.cantidad), u = unitario(f.costo_unitario), costo = costoLinea(q,u);
        const importe = moneda(f.subtotal);
        if (q===null || importe===null || (tipo==='Venta' && u===null))
          a.pendientes.add('Faltan importes o cantidades en una línea de '+tipo.toLowerCase()+'.');
        if (tipo==='Compra') {
          a.compras=sumar(a.compras,importe);
          a.unidadesCompra=sumar(a.unidadesCompra,q);
        } else {
          a.ventas=sumar(a.ventas,importe);
          a.costoVentas=sumar(a.costoVentas,costo);
          a.unidadesVenta=sumar(a.unidadesVenta,q);
        }
        const doc = f.documento || (tipo+' #'+(f.compra_id??f.venta_id));
        const refCompra = 'numero_factura' in f ? f.numero_factura : f.documento;
        unidadesDocumento(tipo,a,f.fecha,tipo==='Compra' ? refCompra || '' : doc,'documentadas',q);
        const ref = ['Línea '+f.id,f.lote ? 'lote '+f.lote : ''].filter(Boolean).join(' · ');
        trazar(a,tipo,f,doc,q,importe,ref,u);
        if (tipo==='Venta') trazar(a,'Costo de venta',f,doc,q,costo,ref,u);
      }
    }

    for (const f of datos.movimientos) {
      if (f.fecha<desde || f.fecha>hasta) continue;
      const a = articulo(f.inventario_id,f,'Movimiento-'+f.id);
      const q = cantidad(f.cantidad), u = unitario(f.costo_unitario);
      const valor = moneda(f.valor_costo)??costoLinea(q,u);
      if (f.es_apertura) {
        trazar(a,'Apertura física ya incluida',f,f.motivo,q,valor,'Movimiento '+f.id,u);
        continue;
      }
      if (q===null || q<=0n || !['entrada','salida'].includes(f.tipo)) {
        a.pendientes.add('Movimiento físico incompleto o no reconocido: '+f.id+'.');
        continue;
      }
      const entrada = f.tipo==='entrada', m = normal(f.motivo);
      if (entrada) a.entradas+=q;
      else a.salidas+=q;
      if (f.anulacion_conciliada) {
        trazar(a,entrada?'Entrada en operación anulada':'Salida en operación anulada',f,f.motivo,q,valor,'Movimiento '+f.id,u);
        continue;
      }
      // Los documentos aportan el costo exacto. Estas filas aportan las unidades UNA vez.
      if (entrada && /^compra a /.test(m)) {
        a.entradasCompra+=q;
        const numero=m.match(/ · fact\. (.+)$/)?.[1];
        unidadesDocumento('Compra',a,f.fecha,numero||'','fisicas',q);
      } else if (!entrada && /^venta /.test(m)) {
        a.salidasVenta+=q;
        const numero=m.slice(6).split(' · ')[0];
        unidadesDocumento('Venta',a,f.fecha,numero,'fisicas',q);
      }
      else if ((!entrada && /^anulacion de compra/.test(m)) || (entrada && /^anulacion de venta/.test(m))) {
        a.pendientes.add('Falta conciliar la anulación del movimiento '+f.id+' con su documento.');
      } else if (/^(mermas?|consumo|uso interno|muestras?|donacion|ajuste|traslado|transferencia)\b/.test(m.replace(/^excel\s*·\s*/,''))) {
        a.ajusteNeto=sumar(a.ajusteNeto,valor===null?null:entrada?-valor:valor);
        if (valor===null) a.pendientes.add('Movimiento fuera de compras o ventas sin costo documentado: '+f.id+'.');
      } else {
        a.ajusteNeto=null;
        a.pendientes.add('Clasifica y respalda el movimiento físico '+f.id+' antes del cierre.');
      }
      trazar(a,entrada?'Entrada física':'Salida física',f,f.motivo,q,valor,'Movimiento '+f.id,u);
    }
    for (const d of documentosComerciales.values())
      if (d.documentadas!==d.fisicas)
        d.a.pendientes.add(`Las unidades de ${d.tipo.toLowerCase()} ${d.referencia || 'sin número'} del ${d.fecha} difieren de su movimiento físico.`);

    // Un artículo omitido de todos los archivos puede conservar existencia. La consulta SQL
    // reconstruye la cantidad al corte y evita usar el stock o los precios del día de consulta.
    for (const p of productos.values()) {
      if ((cantidad(p.saldo_corte)??0n)!==0n || (cantidad(p.saldo_inicio)??0n)!==0n)
        articulo(p.id,p);
    }
    for (const f of datos.incidencias_documentos || []) {
      const aviso = [f.tipo,f.documento || f.id,f.motivo].filter(x=>x!=null).join(' · ');
      globales.add(aviso);
      trazar(null,'Documento por verificar',f,f.documento,null,null,aviso);
    }
    for (const f of datos.kardex || []) {
      const d = f.datos||{};
      const candidatos = [...productos.values()].filter(p=>d.sku ? normal(p.sku)===normal(d.sku) :
        normal(p.nombre)===normal(d.producto || d.nombre));
      const a = candidatos.length===1 ? articulos.get(String(candidatos[0].id)) : null;
      const q = cantidad(d.cantidad), u=unitario(d.costo);
      trazar(a,'Kardex documental', {...f,descripcion:d.producto||d.nombre},d.motivo || d.clase,q,
        moneda(d.costo_total)??costoLinea(q,u),referenciaControl(f),u);
    }

    const aDecimal = (f,k) => decimal(f[k],['inicial','entradas','salidas','finalCalculado','finalReportado',
      'diferenciaUnidades','entradasReportadas','salidasReportadas'].includes(k)?3:
      k==='gananciaPct'?6:['costoUnitario','precioCompra','precioVenta'].includes(k)?4:2);
    const filasInternas = [];
    for (const a of articulos.values()) {
      const p = productos.get(a.id)||{};
      const contar = (filas,key) => filas.length ? filas.reduce((s,f)=>sumar(s,cantidad(f[key])),0n) : null;
      const valorar = filas => filas.length ? filas.reduce((s,f)=>sumar(s,costoControl(f)),0n) : null;
      const saldoConocidoInicio = cantidad(p.saldo_inicio);
      const nuevo = !a.apertura.length && datos.aperturas.length>0 && saldoConocidoInicio===0n && a.entradas>0n;
      const inicial = nuevo ? 0n : contar(a.apertura,'actual'), valorInicial = nuevo ? 0n : valorar(a.apertura);
      const finalReportado = contar(a.cierre,'actual'), valorFinal = valorar(a.cierre);
      const finalCalculado = inicial===null?null:inicial+a.entradas-a.salidas;
      const costoPeriodico = restar(sumar(valorInicial,a.compras),valorFinal);
      const diferenciaCosto = restar(costoPeriodico,a.costoVentas);
      const diferenciaUnidades = restar(finalCalculado,finalReportado);
      const entradasReportadas=contar(a.cierre,'entradas'), salidasReportadas=contar(a.cierre,'salidas');
      const inicialReportado=contar(a.cierre,'inicial');
      if (inicial===null) a.pendientes.add('Falta el saldo inicial del artículo al corte.');
      if (valorInicial===null && inicial!==null) a.pendientes.add('Falta valorar la apertura.');
      if (finalReportado===null) a.pendientes.add('Falta el artículo en el conteo final.');
      if (valorFinal===null && finalReportado!==null) a.pendientes.add('Falta valorar el conteo final.');
      if (diferenciaUnidades!==null && diferenciaUnidades!==0n) a.pendientes.add('Las existencias calculadas difieren del conteo.');
      const comprobacionFisica = cantidad(p.saldo_corte);
      if (finalReportado!==null && comprobacionFisica!==null && comprobacionFisica!==finalReportado)
        a.pendientes.add('El saldo físico del sistema al corte difiere del conteo.');
      if (inicialReportado!==null && inicial!==null && inicialReportado!==inicial)
        a.pendientes.add('La existencia inicial declarada difiere de la apertura.');
      if ((entradasReportadas!==null && entradasReportadas!==a.entradas) || (salidasReportadas!==null && salidasReportadas!==a.salidas))
        a.pendientes.add('Las entradas o salidas declaradas difieren del kardex físico.');
      if (a.unidadesCompra!==a.entradasCompra || a.unidadesVenta!==a.salidasVenta)
        a.pendientes.add('Las unidades de compras o ventas difieren de sus movimientos físicos.');
      const diferenciaSinExplicar=restar(diferenciaCosto,a.ajusteNeto);
      if (diferenciaSinExplicar!==null && diferenciaSinExplicar!==0n)
        a.pendientes.add('Los ajustes documentados no explican la diferencia en el costo de ventas.');
      const costoDeclarado=precioCoincidente(a.cierre,'costo');
      const costoUnitario = costoDeclarado ?? (finalReportado!==null && finalReportado>0n && valorFinal!==null ?
        redondear(valorFinal*100000n,finalReportado) : null);
      filasInternas.push({id:a.id,codigo:a.codigo,nombre:a.nombre,categoria:a.categoria,unidad:a.unidad,
        inicial,entradas:a.entradas,salidas:a.salidas,entradasReportadas,salidasReportadas,finalCalculado,finalReportado,
        diferenciaUnidades,costoUnitario,precioCompra:precioCoincidente(a.cierre,'precio_compra'),precioVenta:precioCoincidente(a.cierre,'precio'),
        gananciaPct:precioCoincidente(a.cierre,'ganancia_pct',6),margenGanancia:precioCoincidente(a.cierre,'margen_ganancia',2),
        valorInicial,compras:a.compras,valorFinal,valorFinalConocido:a.cierre.flatMap(f=>f.origenes||[f]).reduce((s,f)=>s+(costoControl(f)??0n),0n),
        costoPeriodico,costoVentas:a.costoVentas,ventas:a.ventas,utilidad:restar(a.ventas,a.costoVentas),
        diferenciaCosto,ajusteNeto:a.ajusteNeto,diferenciaSinExplicar,
        pendientes:[...a.pendientes].sort(cmp)});
    }

    filasInternas.sort((a,b)=>cmp(normal(a.categoria),normal(b.categoria)) || cmp(normal(a.nombre),normal(b.nombre)) || cmp(a.id,b.id));
    fuentes.sort((a,b)=>cmp(a.fecha,b.fecha)||cmp(a.tipo,b.tipo)||cmp(a.documento,b.documento)||cmp(a.id,b.id)||cmp(a.referencia,b.referencia));
    const filas=filasInternas.map(f=>{
      const fila={};
      for (const [k,v] of Object.entries(f)) fila[k]=typeof v==='bigint' ? aDecimal(f,k) : v;
      return fila;
    });
    const pendientes=[...globales].sort(cmp);
    for (const f of filas) for (const aviso of f.pendientes) pendientes.push(f.nombre+' · '+aviso);
    const totales={};
    for (const k of ['valorInicial','compras','valorFinal','valorFinalConocido','costoPeriodico','costoVentas','ventas','utilidad','diferenciaCosto','ajusteNeto','diferenciaSinExplicar'])
      totales[k]=decimal(!filas.length && !['compras','ventas','costoVentas','utilidad','valorFinalConocido','ajusteNeto'].includes(k)?null:totalCampo(filasInternas,k),2);
    const cobertura={bodegasApertura:[...bodegas.apertura.values()].sort(cmp),bodegasCierre:[...bodegas.cierre.values()].sort(cmp),
      aperturaPreviaAprobada:!!datos.apertura_previa_aprobada};
    return {mes,desde,hasta,revision:datos.revision,aprobado:!!datos.aprobado,aprobado_en:datos.aprobado_en,
      aprobado_por:datos.aprobado_por,aprobable:!!filas.length&&!pendientes.length,cobertura,filas,totales,fuentes,pendientes,libro:datos.libro,diario:datos.diario};
  }
  async function cargar(clinica,mes) {
    const {desde}=periodo(mes);
    const {data,error}=await sb.rpc('datos_informe_maestro',{p_clinica:clinica,p_mes:desde});
    if(error) throw error;
    return calcular(mes,data);
  }
  return {periodo,calcular,cargar};
})();
