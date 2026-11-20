/* Informe mensual del establecimiento activo. Las hojas y la pantalla leen el mismo corte. */
const InformeMaestro = (() => {
  const URL_EXCEL = new URL('informe-maestro-xlsx.js?v=20261120', document.currentScript.src);
  const camposMaestro = [
    ['codigo','Código','texto'], ['nombre','Descripción del artículo','texto'], ['categoria','Categoría','texto'], ['unidad','Unidad','texto'],
    ['inicial','Saldo anterior','cantidad'], ['entradas','Entradas','cantidad'], ['salidas','Salidas','cantidad'],
    ['finalCalculado','Saldo calculado','cantidad'], ['finalReportado','Conteo final','cantidad'],
    ['diferenciaUnidades','Diferencia en unidades','cantidad'], ['costoUnitario','Costo unitario','unitario'],
    ['valorFinal','Inventario final al costo','dinero'], ['costoVentas','Costo de ventas','dinero'],
    ['ventas','Ventas sin IVA','dinero'], ['utilidad','Utilidad bruta','dinero'],
    ['precioCompra','Precio de compra','unitario'], ['precioVenta','Precio de venta','unitario'],
    ['gananciaPct','Ganancia declarada (%)','porcentaje'], ['margenGanancia','Margen declarado por bodega','dinero'],
    ['pendientes','Por revisar','texto']
  ];
  const camposConciliacion = [
    ['codigo','Código','texto'], ['nombre','Artículo','texto'], ['valorInicial','Inventario inicial al costo','dinero'],
    ['compras','Compras netas','dinero'], ['valorFinal','Conteo final al costo','dinero'],
    ['costoPeriodico','Costo por fórmula periódica','dinero'], ['costoVentas','Costo de ventas documentado','dinero'],
    ['diferenciaCosto','Periódico menos documentado','dinero'], ['ajusteNeto','Otras salidas menos entradas al costo','dinero'],
    ['diferenciaSinExplicar','Diferencia por explicar','dinero'], ['entradasReportadas','Entradas según bodega','cantidad'],
    ['salidasReportadas','Salidas según bodega','cantidad'], ['valorFinalConocido','Valor final con costo conocido','dinero']
  ];
  const camposFuentes = [
    ['fecha','Fecha','fecha'], ['tipo','Origen','texto'], ['documento','Documento','texto'], ['producto','Artículo','texto'],
    ['cantidad','Cantidad','cantidad'], ['costoUnitario','Costo unitario','unitario'], ['importe','Importe C$','dinero'],
    ['referencia','Referencia','texto'], ['bodega','Bodega','texto'], ['codigo','Código','texto'],
    ['inicial','Existencia inicial declarada','cantidad'], ['entradas','Entradas declaradas','cantidad'],
    ['salidas','Salidas declaradas','cantidad'], ['precioCompra','Precio de compra','unitario'],
    ['precioVenta','Precio de venta','unitario'], ['gananciaPct','Ganancia declarada (%)','porcentaje'],
    ['margenGanancia','Margen declarado','unitario']
  ];
  const camposResumen = [
    ['valorInicial','Inventario inicial al costo'], ['compras','Compras netas'], ['valorFinal','Inventario final al costo'],
    ['valorFinalConocido','Valor final con costo conocido'], ['costoPeriodico','Inicial + compras − final'],
    ['costoVentas','Costo de ventas documentado'], ['ajusteNeto','Otras salidas menos entradas al costo'],
    ['diferenciaSinExplicar','Diferencia por explicar'], ['ventas','Ventas sin IVA'], ['utilidad','Utilidad bruta']
  ];
  const dinero = new Intl.NumberFormat('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2});
  const cantidad = new Intl.NumberFormat('es-NI',{maximumFractionDigits:3});
  const unitario = new Intl.NumberFormat('es-NI',{minimumFractionDigits:2,maximumFractionDigits:4});
  const monedaExacta = v => {
    const m=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(v));
    if(!m) throw new Error('El importe del libro supera la precisión de centavos.');
    return BigInt(m[2]+(m[3]||'').padEnd(2,'0'))*(m[1]?-1n:1n);
  };
  const decimal = centavos => {
    const v=String(centavos<0n?-centavos:centavos).padStart(3,'0');
    return (centavos<0n?'-':'')+v.slice(0,-2)+'.'+v.slice(-2);
  };
  const texto = v => Array.isArray(v) ? v.join(' · ') : v;
  function formato(v,tipo) {
    if(v == null || v === '') return '—';
    if(tipo === 'dinero') return 'C$ '+dinero.format(v);
    if(tipo === 'unitario') return 'C$ '+unitario.format(v);
    if(tipo === 'cantidad') return cantidad.format(v);
    if(tipo === 'porcentaje') return cantidad.format(v)+' %';
    return texto(v);
  }
  function tabla(campos,filas,nombre) {
    if(!filas.length) return '<p>Sin registros para este período.</p>';
    return '<div class="im-tabla" tabindex="0" role="region" aria-label="'+escAttr(nombre)+'"><table><thead><tr>'+
      campos.map(c=>'<th scope="col">'+escAttr(c[1])+'</th>').join('')+'</tr></thead><tbody>'+
      filas.map(r=>'<tr>'+campos.map(([k,,t])=>'<td class="'+(['dinero','unitario','cantidad'].includes(t)?'im-num':'')+'">'+
        escAttr(formato(r[k],t))+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
  }
  function hojasLibro(r) {
    const informes=LibroContable.construir(r.libro,r.desde,r.hasta,true);
    const moneda=v=> v == null ? null : String(v).replace(/^C\$\s*/, '').replace(/,/g,'');
    const diario=(r.diario||[]).flatMap(a=>a.lineas.map(l=>[a.fecha,a.documento,l.descripcion||a.concepto,l.cuenta,
      l.nombre_cuenta,moneda(l.debe),moneda(l.haber),l.referencia]));
    const hojas=[{nombre:'Libro diario',columnas:['Fecha','Documento','Concepto','Código','Cuenta','Debe','Haber','Referencia'],
      tipos:['fecha','texto','texto','texto','texto','dinero','dinero','texto'],filas:diario,nota:diario.length?'':'Sin asientos en el mes.'}];
    for(const [k,nombre] of [['balanza','Balanza de comprobación'],['resultados','Estado de resultados'],['balance','Balance general']]) {
      const inf=informes[k];
      if(!inf) {
        const motivo=(k==='resultados' && informes.pendienteResultado)||informes.pendiente||'Sin asientos para el corte.';
        hojas.push({nombre,columnas:['Estado del reporte'],tipos:['texto'],filas:[[motivo]],nota:motivo});
        continue;
      }
      const tipos=inf.columnas.map((_,i)=>i<2?'texto':'dinero');
      hojas.push({nombre,columnas:inf.columnas,tipos,filas:inf.filas.map(f=>f.map((v,i)=>i<2?v:moneda(v))),nota:inf.nota});
    }
    return hojas;
  }
  function compararLibro(r,cuentaCosto,cuentaInventario) {
    if(!cuentaCosto||!cuentaInventario) return [];
    const registrado=monedaExacta(cuentaCosto.debe)-monedaExacta(cuentaCosto.haber);
    const diferencia=(v,base)=>v==null?null:decimal(monedaExacta(v)-base);
    return [
      {concepto:'Movimiento neto del mes en '+cuentaCosto.codigo,importe:decimal(registrado)},
      {concepto:'Costo documentado pendiente de contabilizar',importe:diferencia(r.totales.costoVentas,registrado)},
      {concepto:'Saldo final en '+cuentaInventario.codigo,importe:cuentaInventario.saldo},
      {concepto:'Inventario contado menos saldo en '+cuentaInventario.codigo,importe:diferencia(r.totales.valorFinal,monedaExacta(cuentaInventario.saldo))}
    ];
  }
  function armarHojas(r,empresa,comparacion=[]) {
    const hoja=(nombre,campos,filas)=>({nombre,columnas:campos.map(c=>c[1]),tipos:campos.map(c=>c[2]),
      claves:campos.map(c=>c[0]),filas:filas.map(f=>campos.map(([k])=>texto(f[k])??null))});
    const articulos=[...r.filas].sort((a,b)=>String(a.categoria||'').localeCompare(b.categoria||'','es')||
      String(a.nombre||'').localeCompare(b.nombre||'','es')||String(a.codigo||'').localeCompare(b.codigo||'','es'));
    const resumen={nombre:'Resumen',columnas:['Concepto','Importe C$','Observación'],tipos:['texto','dinero','texto'],
      nota:'Los importes pendientes quedan en blanco. Consulta el respaldo en Documentos de origen.',
      indicadores:camposResumen.map(([k])=>k),
      filas:camposResumen.map(([k,n])=>[n,r.totales[k],r.totales[k]==null?'Pendiente':''])};
    resumen.filas.push(...r.pendientes.map(p=>['Por revisar',null,p]));
    resumen.filas.push(...comparacion.map(f=>[f.concepto,f.importe,'Comparación con el libro']));
    return {empresa,mes:r.mes,estado:r.aprobado?'Aprobado':'Borrador',hojas:[resumen,
      {...hoja('Maestro de inventario',camposMaestro,articulos),totales:r.totales},
      {...hoja('Conciliación de costo',camposConciliacion,articulos),totales:r.totales},
      ...hojasLibro(r),hoja('Documentos de origen',camposFuentes,r.fuentes)]};
  }
  function excel(datos) {
    return new Promise((resolve,reject)=>{
      const worker=new Worker(URL_EXCEL);
      worker.onmessage=({data})=>{worker.terminate();data.error?reject(new Error(data.error)):resolve(data.archivo);};
      worker.onerror=()=>{worker.terminate();reject(new Error('No se pudo generar el Excel. Vuelve a intentar.'));};
      worker.postMessage(datos);
    });
  }
  function abrir(panel,clinica,vigente) {
    const empresa=currentClinica?.nombre||'Empresa';
    const h=escAttr;
    panel.innerHTML='<h2>Informe maestro mensual</h2><form class="lc-campos" id="im-filtros">'+
      '<label>Mes del informe<input name="mes" type="month" required></label><button class="btn btn-primary">Consultar</button>'+
      '<button type="button" class="btn btn-secondary" id="im-cargar">Cargar inventario</button></form>'+
      '<p role="status" id="im-estado"></p><div id="im-informe"></div>';
    const el=k=>panel.querySelector('#im-'+k);
    const filtro=el('filtros'), mes=filtro.elements.mes, estado=el('estado'), destino=el('informe');
    let codigoCosto='',codigoInventario='';
    let consulta=0;
    mes.value=hoy().slice(0,7);
    filtro.onsubmit=ev=>{ev.preventDefault();consultar();};
    mes.oninput=()=>{consulta++;destino.replaceChildren();estado.textContent='';};
    mes.onchange=()=>{if(mes.checkValidity()) consultar();};
    el('cargar').onclick=()=>{if(vigente()) ExcelImportacion.abrir();};
    // Solo el panel visible recibe el evento tras cerrar el importador.
    filtro.addEventListener('refrescar-maestro',({detail:detalle})=>{
      if(vigente() && detalle.clinica===clinica) {
        if(/^\d{4}-\d{2}-\d{2}$/.test(detalle.fecha||'')) {
          const corte=new Date(detalle.fecha+'T00:00:00Z');
          if(detalle.modo==='apertura') corte.setUTCDate(corte.getUTCDate()+1);
          mes.value=corte.toISOString().slice(0,7);
        }
        consultar();
      }
    });
    async function consultar(mensaje='') {
      const turno=++consulta,periodo=mes.value,actual=()=>vigente() && turno===consulta && mes.value===periodo;
      destino.replaceChildren();
      if(!filtro.reportValidity()) return;
      estado.textContent='Consultando los documentos del mes…';
      try {
        const r=await MaestroInventario.cargar(clinica,periodo);
        if(!actual()) return;
        mostrar(r,actual);
        estado.textContent=mensaje;
      } catch(error) {
        if(actual()) estado.textContent=['PGRST202','42P01','42883'].includes(error.code)?
          'Aplica migracion_informe_maestro.sql en Supabase para habilitar el informe.':error.message||'No se pudo consultar el informe.';
      }
    }
    function mostrar(r,actual) {
      const t=r.totales;
      const mesTerminado=r.hasta<=hoy();
      const kpi=(rotulo,valor)=>'<div><span>'+h(rotulo)+'</span><strong>'+h(formato(valor,'dinero'))+'</strong></div>';
      destino.innerHTML='<div class="im-cabecera"><div><h3>'+h(empresa)+' · '+h(r.mes)+'</h3><span>'+h(r.aprobado?'Cierre aprobado':!mesTerminado?'Mes en curso':r.aprobable?'Listo para aprobar':'Borrador')+'</span></div>'+
        '<div class="lc-acciones"><button id="im-excel" class="btn btn-primary">Exportar Excel</button>'+
        '<button id="im-pdf" class="btn btn-secondary">PDF del resumen</button></div></div>'+
        '<div class="im-cifras">'+kpi('Inventario inicial',t.valorInicial)+kpi('Compras netas',t.compras)+
        kpi('Inventario final contado',t.valorFinal)+kpi('Costo de ventas documentado',t.costoVentas)+'</div>'+
        '<p>Bodegas al cierre: '+h(r.cobertura.bodegasCierre.join(', ')||'Pendiente de conteo')+'</p>'+
        '<h3>Conciliación del costo de ventas</h3>'+
        tabla([['concepto','Concepto','texto'],['importe','Importe','dinero']],camposResumen.slice(3,8).map(([k,concepto])=>({concepto,importe:t[k]})),'Conciliación del costo de ventas')+
        (r.pendientes.length?'<details open><summary>Por revisar ('+r.pendientes.length+')</summary><ul>'+
          r.pendientes.map(p=>'<li>'+h(p)+'</li>').join('')+'</ul></details>':'')+
        '<h3>Maestro de inventario</h3><label class="im-buscar">Buscar por código o artículo<input type="search" id="im-buscar"></label>'+
        '<div id="im-articulos"></div><details id="im-traza"><summary>Documentos de origen ('+r.fuentes.length+')</summary>'+
        '<label class="im-buscar">Artículo<select id="im-producto"></select></label><div id="im-fuentes"></div></details>'+
        '<div id="im-ajuste"></div><div class="lc-acciones" id="im-cierre"></div>';
      const articulos=el('articulos'), filtros=el('producto'),fuentes=el('fuentes'),buscar=el('buscar');
      const cols=camposMaestro.filter(c=>!['precioCompra','precioVenta'].includes(c[0]));
      const pintarArticulos=()=>{
        const buscarTexto=buscar.value.trim().toLocaleLowerCase('es');
        const filas=r.filas.filter(f=>[f.codigo,f.nombre].some(v=>String(v??'').toLocaleLowerCase('es').includes(buscarTexto)));
        articulos.innerHTML=tabla(cols,filas,'Maestro de inventario');
      };
      pintarArticulos();buscar.oninput=pintarArticulos;
      function pintarFuentes() {
        if(!el('traza').open) return;
        fuentes.innerHTML=tabla(camposFuentes,r.fuentes.filter(f=>!filtros.value||String(f.idProducto)===filtros.value),'Documentos de origen');
      }
      filtros.add(new Option('Todos los artículos',''));
      r.filas.forEach(f=>filtros.add(new Option([f.codigo,f.nombre].filter(Boolean).join(' · '),String(f.id))));
      el('traza').ontoggle=pintarFuentes;filtros.onchange=pintarFuentes;
      el('excel').onclick=async ev=>{
        const boton=ev.currentTarget;boton.disabled=true;
        try {
          const cuenta=id=>r.libro.cuentas.find(c=>c.codigo===el(id)?.value);
          const archivo=await excel(armarHojas(r,empresa,compararLibro(r,cuenta('costo'),cuenta('inventario'))));
          if(actual()) _descargarArchivo(new Blob([archivo],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),
            'Informe maestro - '+empresa.replace(/[\\/:*?"<>|]/g,'-')+' - '+r.mes+'.xlsx');
        } catch(error){if(actual()) estado.textContent=error.message;}
        finally{if(actual()) boton.disabled=false;}
      };
      el('pdf').onclick=()=>{
        if(actual()) descargarDocumento(()=>pdfAbrir('Informe maestro mensual',_pdfEncabezado('Informe maestro mensual',empresa+' · '+r.mes)+
          '<p>'+h(r.aprobado?'Cierre aprobado':'Borrador')+'</p>'+_tablaReporteZip('Conciliación',['Concepto','Importe'],camposResumen.map(([k,n])=>[n,formato(t[k],'dinero')]))+
          (r.pendientes.length?_tablaReporteZip('Por revisar',['Observación'],r.pendientes.map(v=>[v])):'')));
      };
      ajuste(r,actual,mesTerminado);
      if(r.aprobado) return;
      const cierre=el('cierre');
      if(r.aprobable && mesTerminado) {
        cierre.innerHTML='<p>Revisa las cuentas y registra cualquier ajuste antes de aprobar. La aprobación conserva el inventario y los reportes del libro tal como están al cierre.</p><button class="btn btn-primary">Aprobar cierre de inventario</button>';
        cierre.querySelector('button').onclick=()=>accion(r,actual,'aprobar_informe_maestro',{},'Cierre de inventario aprobado y guardado.');
      }
    }
    function ajuste(r,actual,mesTerminado) {
      const cuentas=r.libro.cuentas, existentes=clase=>cuentas.filter(c=>c.clase===clase);
      const opciones=clase=>existentes(clase).map(c=>'<option value="'+h(c.codigo)+'">'+h(c.codigo+' · '+c.nombre)+'</option>').join('');
      const zona=el('ajuste');
      zona.innerHTML='<details><summary>Comparar con las cuentas del libro</summary><div class="lc-campos">'+
        '<label>Cuenta de costo de ventas<select id="im-costo"><option value="">Elegir cuenta</option>'+opciones('costo')+'</select></label>'+
        '<label>Cuenta de inventario<select id="im-inventario"><option value="">Elegir cuenta</option>'+opciones('activo')+'</select></label></div>'+
        '<div id="im-comparacion"></div></details>';
      const comparar=()=>{
        codigoCosto=el('costo').value;codigoInventario=el('inventario').value;
        const cc=cuentas.find(c=>c.codigo===codigoCosto),ci=cuentas.find(c=>c.codigo===codigoInventario);
        const comparacion=el('comparacion');comparacion.replaceChildren();
        if(!cc||!ci) return;
        const registrado=monedaExacta(cc.debe)-monedaExacta(cc.haber);
        const objetivo=r.totales.costoVentas;
        const ajuste=objetivo==null?null:monedaExacta(objetivo)-registrado;
        comparacion.innerHTML=tabla([['concepto','Concepto','texto'],['importe','Importe','dinero']],
          compararLibro(r,cc,ci),'Comparación con el libro');
        if(r.aprobado || !mesTerminado || !r.aprobable || !ajuste || r.diario.some(a=>String(a.documento).toUpperCase()==='MAESTRO-'+r.mes)) return;
        const etiqueta='Registrar ajuste de '+formato(decimal(ajuste<0n?-ajuste:ajuste),'dinero');
        comparacion.insertAdjacentHTML('beforeend','<p>Debe '+h(ajuste>0?cc.codigo:ci.codigo)+' · Haber '+h(ajuste>0?ci.codigo:cc.codigo)+
          ' · Documento MAESTRO-'+h(r.mes)+'</p><button id="im-registrar" class="btn btn-secondary">'+h(etiqueta)+'</button>');
        el('registrar').onclick=()=>accion(r,actual,'registrar_ajuste_maestro',{p_cuenta_costo:cc.codigo,p_cuenta_inventario:ci.codigo,p_costo_objetivo:objetivo},'Ajuste registrado en el libro diario.');
      };
      el('costo').value=codigoCosto;el('inventario').value=codigoInventario;
      el('costo').onchange=comparar;el('inventario').onchange=comparar;comparar();
    }
    async function accion(r,actual,rpc,params,mensaje) {
      if(!actual()) return;
      const controles=[...panel.querySelectorAll('button,input,select')];controles.forEach(c=>c.disabled=true);
      try {
        const {error}=await sb.rpc(rpc,{p_clinica:clinica,p_mes:r.mes+'-01',p_revision:r.revision,...params});
        if(error) throw error;
        if(actual()) await consultar(mensaje);
      } catch(error) {
        if(actual()) estado.textContent=error.message||'No se pudo guardar el cierre.';
      } finally {controles.forEach(c=>c.disabled=false);}
    }
    consultar();
  }
  document.addEventListener('inventario-importado',ev=>document.getElementById('im-filtros')?.dispatchEvent(
    new CustomEvent('refrescar-maestro',{detail:ev.detail})));
  return {abrir,armarHojas};
})();
