const BorradorDiario = (() => {
  const conceptos = {
    ingresos: {cuenta:'Ingresos brutos de la actividad',lado:'haber',rotulo:'Ingresos brutos'},
    debito: {cuenta:'IVA débito fiscal',lado:'haber',rotulo:'IVA débito'},
    credito: {cuenta:'IVA crédito fiscal',lado:'debe',rotulo:'IVA crédito'},
    retenido: {cuenta:'Retenciones IR en la fuente',lado:'haber',rotulo:'Retenciones IR'}
  };
  const campos = {ingresos:'ingresos brutos del mes',credito:'total creditos fiscales del mes',
    retenido:'debito retenciones ir en la fuente'};
  const normal = s => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const dinero = n => fmtC(n/100);

  // Quita los bordes largos del formulario antes del reconocimiento óptico.
  function limpiarRejilla(canvas) {
    const ctx=canvas.getContext('2d'), w=canvas.width, h=canvas.height;
    const imagen=ctx.getImageData(0,0,w,h), pix=imagen.data;
    for (const vertical of [false,true]) {
      const largo=vertical?h:w, ancho=vertical?w:h;
      for (let y=0;y<ancho;y++) {
        let inicio=0;
        for (let x=0;x<=largo;x++) {
          const k=4*(vertical?x*w+y:y*w+x);
          if (x<largo && pix[k]<195 && pix[k+1]<195 && pix[k+2]<195) continue;
          if (x-inicio>w*0.045) {
            for (let j=inicio;j<x;j++) {
              const z=4*(vertical?j*w+y:y*w+j);
              pix[z]=pix[z+1]=pix[z+2]=255;
            }
          }
          inicio=x+1;
        }
      }
    }
    ctx.putImageData(imagen,0,0);
  }

  async function leerFormularioEscaneado(doc) {
    const pagina=await doc.getPage(1), vista=pagina.getViewport({scale:2.5});
    if (vista.width*vista.height>6000000) throw new Error('El PDF requiere una copia con texto legible.');
    const canvas=document.createElement('canvas');
    canvas.width=vista.width;
    canvas.height=vista.height;
    await pagina.render({canvas,viewport:vista}).promise;
    limpiarRejilla(canvas);
    const ruta=new URL('js/vendor/tesseract-6/',document.baseURI).href;
    const {default:ocr}=await import('./vendor/tesseract-6/tesseract.esm.min.js');
    const worker=await ocr.createWorker('eng',1,{workerPath:ruta+'worker.min.js',corePath:ruta+'tesseract-core-lstm.wasm.js',
      langPath:ruta,workerBlobURL:false});
    let texto;
    try {
      await worker.setParameters({tessedit_pageseg_mode:'6'});
      texto=normal((await worker.recognize(canvas)).data.text);
    } finally { await worker.terminate(); }
    const seccion=(inicio,fin)=>{
      const i=texto.indexOf(inicio);
      return i<0 ? '' : texto.slice(i+inicio.length).split(fin)[0];
    };
    const iva=seccion('impuesto al valor agregado','anticipo y/o');
    const ir=seccion('anticipo y/o','retenciones ir en la fuente');
    const fuente=seccion('retenciones ir en la fuente','total a pagar');
    const importe=(bloque,etiqueta)=>{
      const filas=bloque.split('\n').filter(l=>l.includes(etiqueta));
      if (filas.length!==1) return null;
      const m=filas[0].match(/\s(\d{1,3}(?:,\d{3})*\.\d{2}|\d+\.\d{2})[\s|)\]]*$/);
      return m ? Number(m[1].replace(/[,.]/g,'')) : null;
    };
    const valores={};
    // Sólo usar lecturas que se puedan reproducir mediante otros renglones de la misma sección.
    const credito=importe(iva,campos.credito), anterior=importe(iva,'saldo a favor del mes anterior'), ded=importe(iva,'total deducciones');
    const debito=importe(iva,'debito fiscal'), cierre=importe(iva,'saldo a favor [');
    if ([credito,anterior,ded].every(Number.isInteger) && credito+anterior===ded) {
      valores.credito=credito;
      if ([debito,cierre].every(Number.isInteger) && ded-debito===cierre) valores.debito=debito;
    }
    const bruto=importe(ir,campos.ingresos), gravado=importe(iva,'ingresos gravados del mes'), exento=importe(iva,'operaciones exentas');
    if ([bruto,gravado,exento].every(Number.isInteger) && bruto===gravado+exento) valores.ingresos=bruto;
    const retenido=importe(fuente,campos.retenido), trabajo=importe(fuente,'retenciones por renta del trabajo'),
      actividad=importe(fuente,'retenciones de rentas de actividades economicas');
    if ([retenido,trabajo,actividad].every(Number.isInteger) && retenido===trabajo+actividad) valores.retenido=retenido;
    if (!Object.keys(valores).length) throw new Error('El PDF requiere cotejo visual o una copia con texto legible.');
    return {valores,ocr:true,brutoPorCotejar:valores.ingresos==null ? bruto : null};
  }

  async function declaracion(bytes) {
    const pdf = await import('./vendor/pdfjs-5.4.624/pdf.min.mjs');
    pdf.GlobalWorkerOptions.workerSrc = new URL('js/vendor/pdfjs-5.4.624/pdf.worker.min.mjs',document.baseURI).href;
    const lectura = pdf.getDocument({data:bytes,isEvalSupported:false,useSystemFonts:false});
    try {
      const doc = await lectura.promise, valores = {};
      let seccion = '';
      for (let n=1;n<=doc.numPages;n++) {
        const pagina = await doc.getPage(n);
        const items = (await pagina.getTextContent()).items.filter(i=>i.str?.trim());
        const filas = [];
        for (const i of items.sort((a,b)=>b.transform[5]-a.transform[5])) {
          const y = i.transform[5];
          if (!filas.length || Math.abs(filas.at(-1).y-y)>2) filas.push({y,celdas:[]});
          filas.at(-1).celdas.push(i);
        }
        for (const fila of filas) {
          const texto = normal(fila.celdas.sort((a,b)=>a.transform[4]-b.transform[4]).map(c=>c.str).join(' '));
          if (texto.includes('impuesto al valor agregado')) seccion = 'iva';
          if (texto.includes('anticipo y/o') || texto.includes('retenciones ir en la fuente') && !/^\d/.test(texto)) seccion = 'ir';
          const etiqueta = texto.replace(/^\d+\s*\.\s*/,'').replace(/\s+\d+\s+[\d,.]+$/,'');
          const tipo = etiqueta === 'debito fiscal' && seccion === 'iva' ? 'debito' :
            Object.keys(campos).find(k=>campos[k] === etiqueta);
          if (!tipo) continue;
          const monto = texto.match(/\s(\d+(?:,\d{3})*\.\d{2})$/);
          if (!monto || tipo in valores) throw new Error('Renglón fiscal ambiguo en la declaración.');
          valores[tipo] = Number(monto[1].replace(/[,.]/g,''));
        }
      }
      if (!Object.keys(valores).length) return await leerFormularioEscaneado(doc);
      return {valores,ocr:false};
    } finally { await lectura.destroy(); }
  }

  function detalle(hoja,tipo,mes,avisos) {
    if (hoja.error) throw new Error(hoja.error);
    const etiqueta = tipo === 'credito' ? 'valor iva trasladado' : 'valor retenido';
    const encabezado = hoja.filas.find(f=>f.celdas.some(c=>normal(c?.valor).startsWith(etiqueta)));
    if (!encabezado) throw new Error('Falta la columna de '+etiqueta+'.');
    const indice = encabezado.celdas.findIndex(c=>normal(c?.valor).startsWith(etiqueta));
    // En las plantillas DGI la fecha de emisión precede a la base imponible.
    const columnaFecha = encabezado.celdas.findIndex(c=>normal(c?.valor).includes('fecha') || normal(c?.valor)==='invalid date');
    let total=0, cantidad=0;
    for (const fila of hoja.filas.filter(f=>f.numero>encabezado.numero)) {
      const c = fila.celdas[indice];
      if (!c && !fila.celdas[0]?.valor && !fila.celdas[1]?.valor) continue;
      if (c?.invalida || !Number.isFinite(c?.valor)) throw new Error('Importe sin verificar en fila '+fila.numero+'.');
      if (columnaFecha>=0) {
        const celda = fila.celdas[columnaFecha];
        let fecha;
        try { fecha = ExcelImportacion.fecha(celda,hoja.fecha1904); } catch { fecha=null; }
        if (!fecha || fecha.slice(0,7)>mes)
          avisos.push('Fila '+fila.numero+' · '+(fecha ? 'fecha posterior al período: '+fecha : 'falta una fecha válida')+'.');
      }
      total += Math.sign(c.valor)*Math.round((Math.abs(c.valor)+Number.EPSILON)*100);
      cantidad++;
    }
    if (!cantidad) throw new Error('Faltan filas con importes.');
    return total;
  }

  function clase(nombre) {
    if (/d\.\s*m\.\s*i\b/i.test(nombre) && /\.pdf$/i.test(nombre) && !/bit|multa/i.test(nombre)) return 'dmi';
    if (!/\.xlsx?$/i.test(nombre)) return '';
    if (/\banticipo[ _-]+ir\b/i.test(nombre)) return 'ingresos';
    if (/\biva\b/i.test(nombre)) return 'credito';
    if (/\bretenciones\b/i.test(nombre)) return 'retenido';
    return '';
  }

  async function auxiliarInventario(clinica,desde,hasta) {
    if (clinica!==currentClinicaId || !hasPermiso('inventario')) throw new Error('Se requiere acceso al inventario del establecimiento.');
    const {data,error}=await consultarPaginas(()=>sb.from('importaciones_excel_filas')
      .select('tipo,archivo,hoja,fila,datos,importe:datos->>costo_total').eq('clinica_id',clinica).in('tipo',['productos','movimientos'])
      .gte('datos->>fecha',desde).lte('datos->>fecha',hasta).order('lote_id').order('ordinal'));
    if (error) throw error;
    const filas=[];
    for (const recibo of data) {
      const d=recibo.datos, apertura=recibo.tipo==='productos', cantidad=apertura?d.stock:d.cantidad;
      if (!(Number(cantidad)>0)) continue;
      let importe=null;
      if (recibo.importe!=null) importe=decimalEntero(recibo.importe,2);
      else if (d.costo!=null) {
        // Cantidades a milésimas y costo unitario a diezmilésimas. Redondear cada renglón a centavos.
        importe=(decimalEntero(cantidad,3)*decimalEntero(d.costo,4)+50000n)/100000n;
      }
      filas.push({
        fecha:d.fecha, producto:d.nombre||d.producto, sku:d.sku, cantidad, unidad:d.unidad, costo:d.costo,
        clase:apertura?'apertura':d.clase, documental:d.documental===true, motivo:d.motivo,
        importe, fuente:[recibo.archivo,recibo.hoja,'fila '+recibo.fila].join(' · ')
      });
    }
    if (clinica!==currentClinicaId || !hasPermiso('inventario')) throw new Error('Cambió el establecimiento o el permiso de Inventario.');
    return filas.sort((a,b)=>a.fecha.localeCompare(b.fecha));
  }

  function decimalEntero(valor,escala) {
    const [entero,fraccion='']=String(valor).split('.');
    return BigInt(entero+fraccion.padEnd(escala,'0').slice(0,escala));
  }

  async function obtener(clinica,desde,hasta,vigente,progreso=()=>{}) {
    if (!hasPermiso('contabilidad') || clinica !== currentClinicaId) throw new Error('Selecciona el establecimiento con acceso a Contabilidad.');
    const {data,error} = await consultarPaginas(()=>sb.from('expediente_fiscal_excel').select('id,archivo,digest').eq('clinica_id',clinica).order('id'));
    if (error) throw error;
    const meses = new Map(), vistos = new Set(), avisos = [], lineas = [];
    for (const doc of data) {
      if (!vigente()) return;
      const partes = doc.archivo.split('/'), nombre = partes.pop(), tipo = clase(nombre);
      if (!tipo) continue;
      let mes;
      try { mes = CajaEmpresa.periodoFiscal(nombre); }
      catch {
        try { mes = CajaEmpresa.periodoFiscal(partes.at(-1)||''); }
        catch { avisos.push(nombre+' · No se identifica el período.'); continue; }
      }
      if (mes<desde.slice(0,7) || mes>hasta.slice(0,7)) continue;
      if (!meses.has(mes)) meses.set(mes,{});
      const grupo = meses.get(mes);
      const finDeMes = new Date(Date.UTC(+mes.slice(0,4),+mes.slice(5),0)).toISOString().slice(0,10);
      if (mes+'-01'<desde || finDeMes>hasta) {
        grupo.parcial=true;
        continue;
      }
      const clave = [mes,tipo,doc.digest].join('|');
      if (vistos.has(clave)) continue;
      vistos.add(clave);
      progreso(nombre);
      const agregar = (k,monto,fuente,oficial=false) => (grupo[k]??=[]).push({monto,fuente,oficial});
      try {
        const bytes = await ExcelImportacion.originalFiscal(clinica,doc.id);
        if (!vigente()) return;
        if (tipo==='dmi') {
          const {valores,ocr,brutoPorCotejar} = await declaracion(bytes);
          if (Number.isInteger(brutoPorCotejar)) (grupo.brutosPorCotejar??=[]).push({monto:brutoPorCotejar,fuente:nombre});
          for (const [k,monto] of Object.entries(valores)) agregar(k,monto,nombre+(ocr?' (lectura óptica comprobada)':''),true);
          const sinLeer=Object.keys(conceptos).filter(k=>valores[k]==null && !(k==='ingresos' && Number.isInteger(brutoPorCotejar)));
          if (sinLeer.length) avisos.push(nombre+' · Renglones pendientes de cotejo: '+sinLeer.map(k=>conceptos[k].rotulo).join(', ')+'.');
        } else {
          const hojas = await ExcelImportacion.leerArchivo(new File([bytes],nombre));
          if (tipo==='ingresos') agregar(tipo,CajaEmpresa.ingresoDeclarado(hojas),nombre);
          else for (const h of hojas) {
            const incidencias=[],fuente=nombre+' · '+h.nombre;
            try { agregar(tipo,detalle(h,tipo,mes,incidencias),fuente); }
            catch (e) { incidencias.push(e.message); }
            avisos.push(...incidencias.map(a=>fuente+' · '+a));
          }
        }
      } catch(e) { avisos.push(nombre+' · '+e.message); }
    }
    // Un mes completo sin fuentes también constituye un faltante de la consulta.
    for (let mes=desde.slice(0,7); mes<=hasta.slice(0,7);) {
      const [a,m]=mes.split('-').map(Number);
      const ultimo=new Date(Date.UTC(a,m,0)).toISOString().slice(0,10);
      if (!meses.has(mes) && mes+'-01'>=desde && ultimo<=hasta) avisos.push(mes+' · Falta el respaldo fiscal mensual.');
      if (m===12 && a>=9999) break;
      mes=m===12 ? String(a+1).padStart(4,'0')+'-01' : mes.slice(0,5)+String(m+1).padStart(2,'0');
    }
    for (const [mes,grupo] of [...meses].sort(([a],[b])=>a.localeCompare(b))) {
      if (grupo.parcial) { avisos.push(mes+' · Selecciona el mes completo para incluir su declaración.'); continue; }
      for (const lectura of grupo.brutosPorCotejar||[]) {
        const plantillas=(grupo.ingresos||[]).filter(f=>!f.oficial);
        if (plantillas.length && plantillas.every(f=>f.monto===lectura.monto))
          grupo.ingresos.push({...lectura,fuente:lectura.fuente+' (lectura óptica cotejada con Excel)',oficial:true});
        else avisos.push(lectura.fuente+' · Ingreso bruto pendiente de cotejo con la plantilla.');
        avisos.push(lectura.fuente+' · Verificar el desglose entre ingresos gravados y exentos de la lectura óptica.');
      }
      for (const [tipo,concepto] of Object.entries(conceptos)) {
        const fuentes = grupo[tipo]||[], oficiales=fuentes.filter(f=>f.oficial);
        const base=oficiales.length ? oficiales : fuentes;
        const ref=mes+' · '+concepto.rotulo;
        if (!base.length) { avisos.push(ref+' · Falta un importe legible.'); continue; }
        if (new Set(base.map(f=>f.monto)).size!==1) {
          avisos.push(ref+' · Versiones en conflicto. Verificar '+base.map(f=>f.fuente+' ('+dinero(f.monto)+')').join(', ')+'.');
          continue;
        }
        const importe=base[0].monto;
        for (const f of fuentes.filter(f=>f.monto!==importe))
          avisos.push(ref+' · '+f.fuente+' difiere de la DMI en '+dinero(f.monto-importe)+' (Excel menos declaración).');
        const coincidentes=fuentes.filter(f=>f.monto===importe);
        const cotejado=oficiales.length && coincidentes.some(f=>!f.oficial);
        lineas.push({mes,tipo,importe,fuente:coincidentes.map(f=>f.fuente).join(' / '),
          estado:cotejado ? 'Coinciden DMI y plantilla en el importe' : oficiales.length ? 'Según declaración' : 'Plantilla pendiente de cotejo'});
      }
    }
    const libros = [
      ['Diario por asiento y cuenta',/\b(diario|asientos)\b/],
      ['Balanza con saldos de apertura y cierre',/\b(balanza|balance de comprobacion)\b/],
      ['Auxiliares de bancos y caja',/\b(auxiliar|extracto|estado de cuenta).*\b(banc\w*|caja)\b/],
      ['Auxiliar de cuentas por cobrar',/\b(cartera|cuentas por cobrar|cxc)\b/],
      ['Auxiliar de cuentas por pagar',/\b(cuentas por pagar|cxp|auxiliar de proveedores)\b/],
      ['Inventario valorizado',/\b(inventario|kardex)\b/]
    ].map(([titulo,patron])=>{
      const encontrados=data.filter(d=>patron.test(normal(d.archivo.split('/').pop()).replace(/_/g,' ')));
      return [titulo,encontrados.length ? encontrados.map(d=>d.archivo).join(' / ')+' · Verificar corte y contenido' : 'Pendiente de identificar en el expediente'];
    });
    let inventario=null;
    if (vigente() && hasPermiso('inventario')) {
      try { inventario=await auxiliarInventario(clinica,desde,hasta); }
      catch { avisos.push('No se pudieron consultar los comprobantes del inventario. Vuelve a generar el borrador.'); }
      if (!vigente()) return;
      if (!hasPermiso('inventario')) inventario=null;
    }
    return {lineas,avisos,libros,inventario};
  }

  function mostrarInventario(filas,tabla,imprimir=false) {
    if (!filas?.length) return '';
    const moneda=n=>'C$ '+(n/100n).toLocaleString('es-NI')+'.'+String(n%100n).padStart(2,'0');
    const grupos=new Map(), destinos=new Map();
    const acumular=(mapa,clave,importe)=>{
      if (!mapa.has(clave)) mapa.set(clave,{suma:0n,pendientes:0,filas:0});
      const g=mapa.get(clave);
      g.filas++;
      if (importe===null) g.pendientes++;
      else g.suma+=importe;
    };
    const resumen=mapa=>[...mapa].map(([tipo,g])=>[tipo,g.filas,g.filas===g.pendientes?'Pendiente':moneda(g.suma),g.pendientes]);
    const detalle=filas.map(f=>{
      const origen=f.clase==='apertura'?'Apertura':(f.documental?'Kardex histórico':'Movimiento de stock');
      const tipo=f.clase==='apertura'?origen:origen+' · '+(f.clase==='salida'?'Salida':'Entrada');
      acumular(grupos,tipo,f.importe);
      if (f.clase==='salida') acumular(destinos,origen+' · '+_destinoSalidaInventario(f.motivo),f.importe);
      return [f.fecha,tipo,[f.sku,f.producto].filter(Boolean).join(' · '),
        [f.cantidad,f.unidad].filter(Boolean).join(' '),f.costo==null?'—':_fmtCostoUnitario(Number(f.costo)),
        f.importe===null?'Costo pendiente':moneda(f.importe),f.motivo||'—',f.fuente];
    });
    const columnas=['Origen','Filas','Valor con costo documentado','Filas sin costo'];
    const productos=tabla('Detalle de inventario',['Fecha','Origen','Producto','Cantidad','Costo unitario','Valor al costo','Motivo','Archivo, hoja y fila'],detalle);
    return tabla('Inventario importado en el período',columnas,resumen(grupos))+
      (destinos.size?tabla('Salidas según el motivo del documento',['Clasificación propuesta',...columnas.slice(1)],resumen(destinos)):'')+
      '<p>La apertura respalda las existencias al corte. Para reconocer el costo de venta, el consumo o la merma, concilia cada salida con su comprobante y su cuenta. Los movimientos del kardex histórico pueden estar incluidos en la apertura.</p>'+
      (imprimir?productos:'<details><summary>Ver productos y documentos de origen</summary>'+productos+'</details>');
  }

  function mostrar({lineas,avisos,libros,inventario}) {
    const tabla = (titulo,cols,filas)=>'<h3>'+titulo+'</h3><div class="excel-tabla">'+_tablaReporteZip('',cols,filas)+'</div>';
    const saldos=new Map(),totales={debe:0,haber:0};
    const diario=lineas.map(l=>{
      const {cuenta,lado}=conceptos[l.tipo];
      saldos.set(l.tipo,(saldos.get(l.tipo)||0)+l.importe);
      totales[lado]+=l.importe;
      return [l.mes,cuenta,lado==='debe'?dinero(l.importe):'—',lado==='haber'?dinero(l.importe):'—',l.fuente,l.estado];
    });
    const balanza=[...saldos].map(([tipo,n])=>{
      const {cuenta,lado}=conceptos[tipo];
      return [cuenta,lado==='debe'?dinero(n):'—',lado==='haber'?dinero(n):'—',dinero(lado==='debe'?n:-n)];
    });
    balanza.push(['Total documentado',dinero(totales.debe),dinero(totales.haber),dinero(totales.debe-totales.haber)]);
    return (lineas.length ? tabla('Diario provisional por mes',['Mes','Concepto propuesto','Debe','Haber','Origen','Respaldo'],diario)+
      tabla('Balanza provisional de movimientos',['Concepto propuesto','Debe','Haber','Movimiento neto (Debe − Haber)'],balanza)+
      '<p>Diferencia Debe menos Haber: <strong>'+dinero(totales.debe-totales.haber)+'</strong>. Los saldos de apertura y las contrapartidas están pendientes.</p>' :
      '<p>Sin importes fiscales utilizables para el rango seleccionado.</p>')+
      mostrarInventario(inventario,tabla)+
      tabla('Documentos para conciliar',['Documento','Situación del respaldo'],libros.map(([titulo,estado])=>
        titulo==='Inventario valorizado' && inventario?.length ? [titulo,inventario.length+' filas en el auxiliar de inventario importado · Cotejar las fechas con el corte de la balanza'] : [titulo,estado]))+
      '<h3>Pendientes para conciliar</h3><ul>'+[
        ...avisos,
        'Identificar las cuentas y los saldos iniciales con el catálogo contable y la balanza de apertura.',
        'Cruzar las ventas con facturas, cobros bancarios y cartera por cliente para asignar la contrapartida de los ingresos y del IVA.',
        'Cruzar compras, pagos y retenciones con el auxiliar de proveedores, bancos y nómina. Cotejar las existencias con el inventario a costo.',
        'Validar contra el diario y la balanza de origen al mismo corte antes de registrar asientos definitivos.'
      ].map(a=>'<li>'+escAttr(a)+'</li>').join('')+'</ul>';
  }
  return {obtener,mostrar,auxiliarInventario,mostrarInventario};
})();
