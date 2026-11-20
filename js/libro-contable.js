const LibroContable = (() => {
  const clases={activo:'Activo',pasivo:'Pasivo',patrimonio:'Patrimonio',ingreso:'Ingreso',costo:'Costo',gasto:'Gasto'};
  const nominales=['ingreso','costo','gasto'];
  const titulos={balanza:'Balanza de comprobación',resultados:'Estado de resultados',balance:'Balance general',diario:'Libro diario'};
  const id=x=>document.getElementById('lc-'+x);
  const html=x=>escAttr(String(x??''));
  const normal=x=>String(x??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
  let estado;
  const vigente=e=>e===estado && e.clinica===currentClinicaId && e.usuario===currentUser?.id && currentView==='libro-contable' && hasPermiso('contabilidad');
  const aviso=texto=>{id('estado').textContent=texto;};
  const centavos=v=>{
    const m=/^(-?)(\d{1,22})(?:\.(\d{1,2}))?$/.exec(String(v??0));
    if(!m) throw new Error('Usa importes con hasta dos decimales.');
    return (m[1]? -1n:1n)*(BigInt(m[2])*100n+BigInt((m[3]||'').padEnd(2,'0')));
  };
  const decimal=n=>(n<0n?'-':'')+((n<0n?-n:n)/100n)+'.'+String((n<0n?-n:n)%100n).padStart(2,'0');
  const dinero=n=>{
    const [entero,fraccion]=decimal(n).split('.');
    return 'C$ '+entero.replace(/\B(?=(\d{3})+(?!\d))/g,',')+'.'+fraccion;
  };
  const opciones=(lista,sel)=>'<option value="">Elegir clase</option>'+lista.map(c=>'<option value="'+c+'"'+(sel===c?' selected':'')+'>'+clases[c]+'</option>').join('');
  const nuevaFila=()=>({cuenta:'',nombre_cuenta:'',clase:'',debe:'',haber:'',importe:''});
  const borrador=apertura=>({solicitud:crypto.randomUUID(),fecha:hoy(),documento:apertura?'APERTURA':'',concepto:apertura?'Saldos al cierre anterior':'',
    desde:'',lineas:[nuevaFila(),nuevaFila()],resultado:[]});

  async function abrir() {
    if(!hasPermiso('contabilidad') || !_exigeClinica()) return;
    const e=estado={clinica:currentClinicaId,usuario:currentUser?.id,tab:'reportes',cuentas:[],asiento:borrador(false),apertura:borrador(true),
      desde:hoy().slice(0,7)+'-01',hasta:hoy(),tipo:'balanza',detalle:false,turno:0};
    id('tabs').querySelector('[data-panel="maestro"]').hidden=!(esEmpresaMedica() && hasPermiso('inventario'));
    id('tabs').onclick=ev=>{
      const boton=ev.target.closest('[data-panel]');
      if(boton && vigente(e) && !e.ocupado) panel(e,boton.dataset.panel);
    };
    id('panel').replaceChildren();
    aviso('Consultando el catálogo…');
    try {
      await catalogo(e);
      if(vigente(e)) panel(e,'reportes');
    } catch(error) { if(vigente(e)) fallo(error); }
  }

  async function catalogo(e) {
    const [cuentas,cierre]=await Promise.all([
      consultarPaginas(()=>sb.from('libro_diario_cuentas').select('codigo,nombre,clase').eq('clinica_id',e.clinica).order('codigo')),
      sb.from('libro_diario').select('id,fecha,documento,resultado_desde,resultado_base').eq('clinica_id',e.clinica).eq('origen','apertura').maybeSingle()
    ]);
    if(cuentas.error||cierre.error) throw cuentas.error||cierre.error;
    e.cuentas=cuentas.data;e.cierre=cierre.data;
  }
  function fallo(error) {
    aviso(['PGRST202','42703','42P01','PGRST204','PGRST205'].includes(error.code)
      ? 'Para habilitar el Libro contable, ejecuta migracion_libro_contable.sql en Supabase.'
      : (error.message||'No se pudo completar la operación.'));
  }
  function panel(e,tab) {
    e.tab=tab; e.turno++; e.informe=null;
    aviso('');
    id('tabs').querySelectorAll('button').forEach(b=>{
      b.classList.toggle('active',b.dataset.panel===tab);
      b.setAttribute('aria-pressed',String(b.dataset.panel===tab));
    });
    if(tab==='reportes') return verReportes(e);
    if(tab==='maestro' && esEmpresaMedica() && hasPermiso('inventario')) {
      const turno=e.turno;
      return InformeMaestro.abrir(id('panel'),e.clinica,()=>vigente(e) && turno===e.turno && hasPermiso('inventario'));
    }
    if(tab==='cuentas') return verCuentas(e);
    verAsiento(e);
  }
  function bloquear(e,valor) {
    e.ocupado=valor;
    document.querySelectorAll('#lc-tabs button,#lc-panel button,#lc-panel input,#lc-panel select').forEach(b=>b.disabled=valor);
  }
  async function guardar(e,accion,terminado) {
    if(!vigente(e)||e.ocupado) return;
    bloquear(e,true);
    aviso('Guardando…');
    try {
      const {error}=await accion();
      if(error) throw error;
      if(!vigente(e)) return;
      await catalogo(e);
      if(vigente(e)) terminado();
    } catch(error) { if(vigente(e)) fallo(error); }
    finally { if(vigente(e)) bloquear(e,false); }
  }
  const listaCuentas=e=>'<datalist id="lc-catalogo">'+e.cuentas.map(c=>'<option value="'+html(c.codigo)+'">'+html(c.nombre)+'</option>').join('')+'</datalist>';
  function verCuentas(e) {
    id('panel').innerHTML='<h2>Catálogo de cuentas</h2><form id="lc-cuenta" class="lc-campos">'+
      '<label>Código<input name="codigo" list="lc-catalogo" maxlength="80" required></label><label>Nombre de cuenta<input name="nombre" maxlength="150" required></label>'+
      '<label>Clase<select name="clase" required>'+opciones(Object.keys(clases))+'</select></label>'+
      '<button class="btn btn-primary">Guardar cuenta</button></form>'+listaCuentas(e)+
      (e.cuentas.length?tablaPantalla('', ['Código','Nombre de cuenta','Clase'],e.cuentas.map(c=>[c.codigo,c.nombre,clases[c.clase]||'Pendiente de clasificar'])):'<p>Agrega la primera cuenta o carga los saldos iniciales desde Excel.</p>');
    const f=id('cuenta');
    f.elements.codigo.oninput=()=>{
      const c=e.cuentas.find(c=>c.codigo===f.elements.codigo.value);
      if(c) { f.elements.nombre.value=c.nombre; f.elements.clase.value=c.clase||''; }
    };
    f.onsubmit=ev=>{
      ev.preventDefault();
      guardar(e,()=>sb.rpc('guardar_cuenta_libro',{p_clinica:e.clinica,p_codigo:f.elements.codigo.value,
        p_nombre:f.elements.nombre.value,p_clase:f.elements.clase.value}),()=>{verCuentas(e);aviso('Cuenta guardada.');});
    };
  }
  function editor(e,key) {
    const base=key==='resultado', filas=e[e.tab][key];
    const campos=base?['cuenta','nombre_cuenta','clase','importe']:['cuenta','nombre_cuenta','clase','debe','haber'];
    const etiquetas={cuenta:'Código',nombre_cuenta:'Nombre de cuenta',clase:'Clase',debe:'Debe',haber:'Haber',importe:'Importe'};
    const grupos=new Map();
    if(e.tab==='apertura') for(const f of filas) if(f.cuenta.includes('-') && !f.clase) {
      const prefijo=f.cuenta.split('-')[0];grupos.set(prefijo,(grupos.get(prefijo)||0)+1);
    }
    const pendientes=[...grupos].filter(([,n])=>n>1);
    const porGrupo=pendientes.length?'<div class="lc-campos" data-grupos="'+key+'"><label>Grupo sin clasificar<select data-grupo>'+
      pendientes.map(([g,n])=>'<option value="'+html(g)+'">'+html(g)+' · '+n+' cuentas</option>').join('')+'</select></label>'+
      '<label>Clase del grupo<select data-clase-grupo>'+opciones(base?nominales:Object.keys(clases))+'</select></label><button type="button" class="btn btn-secondary btn-sm" data-aplicar="'+key+'">Aplicar al grupo</button></div>':'';
    return porGrupo+'<div class="lc-lineas" data-lista="'+key+'">'+filas.map((fila,i)=>
      '<div class="lc-linea" data-fila="'+i+'">'+campos.map(k=>{
        const label=etiquetas[k], valor=html(fila[k]), numerico=['debe','haber','importe'].includes(k);
        const control=k==='clase'?'<select data-k="clase" required>'+opciones(base?nominales:Object.keys(clases),fila[k])+'</select>':
          '<input data-k="'+k+'" value="'+valor+'" '+(k==='cuenta'?'list="lc-catalogo" maxlength="80" required':k==='nombre_cuenta'?'maxlength="150" required':
            'type="number" step="0.01" '+(base?'required':'min="0"'))+(numerico?' placeholder="0.00"':'')+'>';
        return '<label>'+label+control+'</label>';
      }).join('')+'<button type="button" class="btn btn-secondary btn-sm" data-quitar="'+key+'" aria-label="Quitar línea '+(i+1)+'">Quitar</button></div>').join('')+'</div>'+
      '<button type="button" class="btn btn-secondary btn-sm" data-agregar="'+key+'">+ Agregar línea</button>';
  }
  function verAsiento(e) {
    const inicial=e.tab==='apertura', d=e[e.tab];
    const archivo=(key,etiqueta)=>'<label class="lc-archivo">'+etiqueta+'<input type="file" accept=".xlsx,.xls,.csv" data-archivo="'+key+'"></label>';
    const cierre=inicial&&e.cierre;
    if(cierre?.resultado_base?.length) {
      id('panel').innerHTML='<h2>Saldos iniciales registrados</h2><p>'+html(cierre.documento)+' · Balance al '+html(cierre.fecha)+
        '. Estado de resultados del '+html(cierre.resultado_desde)+' al '+html(cierre.fecha)+'.</p><button id="lc-ver-cierre" class="btn btn-secondary">Ver reportes del cierre</button>';
      id('ver-cierre').onclick=()=>{e.desde=cierre.resultado_desde;e.hasta=cierre.fecha;e.tipo='balance';panel(e,'reportes');};
      return;
    }
    id('panel').innerHTML='<h2>'+(inicial?'Saldos iniciales':'Nuevo asiento de diario')+'</h2>'+
      '<p>'+(inicial?'Carga el balance a la fecha del último cierre. Coloca cada saldo deudor en el Debe y cada saldo acreedor en el Haber.':
        'Elige las cuentas que afecta el documento. Este asiento se registra únicamente en el libro contable.')+'</p>'+
      '<form id="lc-asiento"><div class="lc-campos"><label>'+(inicial?'Fecha del último cierre':'Fecha')+'<input type="date" data-meta="fecha" value="'+html(d.fecha)+'" required></label>'+
      '<label>Documento<input data-meta="documento" maxlength="80" value="'+html(d.documento)+'" required></label>'+
      '<label>Concepto<input data-meta="concepto" maxlength="300" value="'+html(d.concepto)+'" required></label></div>'+
      (inicial?'<h3>Balance de apertura</h3>'+archivo('lineas','Leer balance de Excel o CSV'):'')+editor(e,'lineas')+
      '<p id="lc-totales" aria-live="polite"></p>'+
      (inicial?'<details '+(d.resultado.length||d.lineas.some(l=>nominales.includes(l.clase))?'open':'')+'><summary>Estado de resultados del último cierre</summary>'+
        '<p>Si la balanza incluye ingresos, costos y gastos, el sistema toma sus saldos. Si el resultado ya está en patrimonio, agrega aquí el detalle del estado de resultados.</p>'+
        '<label>Inicio del período de resultados<input type="date" data-meta="desde" value="'+html(d.desde)+'"></label>'+
        archivo('resultado','Leer estado de resultados de Excel o CSV')+editor(e,'resultado')+'</details>':'')+
      '<div class="lc-acciones"><button class="btn btn-primary">'+(inicial?'Registrar apertura':'Registrar asiento')+'</button></div></form>'+listaCuentas(e);
    const f=id('asiento');
    if(cierre) {
      d.fecha=cierre.fecha;
      id('panel').querySelector('h2').textContent='Completar el estado de resultados';
      id('panel').querySelector('p').textContent=cierre.documento+' · Balance de apertura registrado al '+cierre.fecha+'.';
      const detalle=f.querySelector('details');
      detalle.open=true;
      f.replaceChildren(detalle,f.querySelector('.lc-acciones'));
      f.querySelector('.lc-acciones button').textContent='Guardar estado de resultados del cierre';
    }
    f.oninput=ev=>{
      const t=ev.target;
      if(t.dataset.meta) d[t.dataset.meta]=t.value;
      if(t.dataset.k) {
        const nodo=t.closest('[data-fila]'), fila=d[nodo.parentElement.dataset.lista][+nodo.dataset.fila];
        fila[t.dataset.k]=t.value;
        if(t.dataset.k==='cuenta') {
          const c=e.cuentas.find(c=>c.codigo===t.value);
          if(c) for(const [k,v] of [['nombre_cuenta',c.nombre],['clase',c.clase||'']]) {
            nodo.querySelector('[data-k="'+k+'"]').value=v;
            fila[k]=nodo.querySelector('[data-k="'+k+'"]').value;
          }
        }
        actualizarTotales(d);
      }
    };
    f.onclick=ev=>{
      const b=ev.target.closest('button');
      if(!b) return;
      if(b.dataset.aplicar) {
        const grupo=b.closest('[data-grupos]'),prefijo=grupo.querySelector('[data-grupo]').value+'-',clase=grupo.querySelector('[data-clase-grupo]').value;
        if(!clase){aviso('Selecciona la clase del grupo.');return;}
        for(const f of d[b.dataset.aplicar]) if(!f.clase && f.cuenta.startsWith(prefijo)) f.clase=clase;
      }
      else if(b.dataset.agregar) d[b.dataset.agregar].push(nuevaFila());
      else if(b.dataset.quitar) d[b.dataset.quitar].splice(+b.closest('[data-fila]').dataset.fila,1);
      else return;
      verAsiento(e);
    };
    f.onchange=ev=>{if(ev.target.dataset.archivo && ev.target.files[0]) cargarArchivo(e,ev.target.dataset.archivo,ev.target.files[0]);};
    f.onsubmit=ev=>{
      ev.preventDefault();
      try {
        if(!cierre && (!d.lineas.length || actualizarTotales(d)!==0n)) throw new Error('Revisa la diferencia entre el Debe y el Haber.');
        const requierePeriodo=inicial && (d.resultado.length||d.lineas.some(l=>nominales.includes(l.clase)));
        if(requierePeriodo && (!d.desde || d.desde>d.fecha)) {
          f.querySelector('details').open=true;
          f.querySelector('[data-meta="desde"]').focus();
          throw new Error('Indica el inicio del período del estado de resultados.');
        }
        const params={p_clinica:e.clinica,p_solicitud:d.solicitud,p_origen:e.tab,p_fecha:d.fecha,p_documento:d.documento,p_concepto:d.concepto,
          p_lineas:d.lineas.map(f=>({...f,debe:f.debe||'0',haber:f.haber||'0'})),p_resultado:d.resultado,p_desde:requierePeriodo?d.desde:null};
        guardar(e,()=>cierre?sb.rpc('registrar_resultado_cierre',{p_clinica:e.clinica,p_apertura:cierre.id,p_desde:d.desde,p_filas:d.resultado}):
          sb.rpc('registrar_asiento_libro',params),()=>{
          e[e.tab]=borrador(inicial); e.desde=d.fecha;e.hasta=d.fecha; e.tipo=inicial?'balanza':'diario'; panel(e,'reportes');
          aviso((cierre?'Estado de resultados inicial guardado':inicial?'Apertura registrada':'Asiento registrado')+' · '+(cierre?.documento||d.documento));
        });
      } catch(error) { fallo(error); }
    };
    actualizarTotales(d);
  }
  function actualizarTotales(d) {
    if(!id('totales')) return null;
    try {
      const suma=k=>d.lineas.reduce((a,l)=>a+centavos(l[k]||'0'),0n), debe=suma('debe'),haber=suma('haber');
      id('totales').textContent='Debe '+dinero(debe)+' · Haber '+dinero(haber)+' · Diferencia '+dinero(debe-haber);
      return debe-haber;
    } catch { id('totales').textContent='Revisa los decimales de las líneas.';return null; }
  }

  // Los archivos de cierre pueden incluir encabezados, subtotales del catálogo y cuentas de detalle.
  function leerCierre(hojas,key,catalogo) {
    const resultado=key==='resultado', filas=[], vistos=new Set(), grupos=new Map();
    let hojasLeidas=0, ceros=0, subtotales=0;
    const aliases={codigo:['codigo','codigo de cuenta','numero','numero de cuenta','cuenta contable'],
      nombre:['nombre','nombre cuenta','nombre de cuenta','nombre de la cuenta','descripcion','cuenta'],
      clase:['clase','tipo de cuenta','clasificacion'],saldo:['saldo final','saldo al cierre','saldo'],
      debe:['saldo deudor','debe','debito'],haber:['saldo acreedor','haber','credito'],importe:['importe','monto','importe del periodo','total acumulado']};
    const tipos={activos:'activo',pasivos:'pasivo',capital:'patrimonio',ingresos:'ingreso',costos:'costo',gastos:'gasto'};
    const tipo=v=>clases[normal(v)]?normal(v):tipos[normal(v)]||'';
    function valor(celda) {
      if(celda?.invalida) throw new Error('Hay una celda con un error de Excel.');
      if(celda?.valor==null || celda.valor==='') return null;
      if(/US\$|USD|EUR|€/.test(String(celda.texto??celda.valor))) throw new Error('Los importes de este libro se registran en córdobas.');
      if(celda.valor===true||celda.valor===false) throw new Error('Se esperaba un importe.');
      if(typeof celda.valor==='number') {
        const v=celda.valor,n=Math.round(v*100);
        if(!Number.isSafeInteger(n)||Math.abs(v-n/100)>Number.EPSILON*Math.max(1,Math.abs(v))) throw new Error('Importe fuera de precisión.');
        return BigInt(n);
      }
      let s=String(celda.valor).trim().replace(/^C\$\s*/i,'');
      if(/^\(.*\)$/.test(s)) s='-'+s.slice(1,-1);
      if(/^-?\d{1,3}(,\d{3})+\.\d{1,2}$/.test(s)) s=s.replace(/,/g,'');
      else if(/^-?\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s=s.replace(/\./g,'').replace(',','.');
      else if(/^-?\d+,\d{1,2}$/.test(s)) s=s.replace(',','.');
      return centavos(s);
    }
    for(const hoja of hojas) {
      if(hoja.oculta) continue;
      const titulo=normal(hoja.nombre);
      if(resultado?/^(?:balance general|balanza de comprobacion)\b/.test(titulo):/^(?:estado de resultados|perdidas y ganancias)\b/.test(titulo)) continue;
      let columnas,indice;
      for(const [i,f] of hoja.filas.entries()) {
        const labels=f.celdas.map(c=>normal(c?.valor));
        const m=Object.fromEntries(Object.entries(aliases).map(([k,vs])=>[k,labels.findIndex(s=>vs.includes(s))]));
        if(!resultado && m.saldo<0 && labels.includes('saldo inicial')) continue;
        if(m.codigo>=0 && m.nombre>=0 && (resultado?m.importe>=0||m.saldo>=0:m.saldo>=0||(m.debe>=0&&m.haber>=0))) { columnas=m;indice=i;break; }
      }
      if(!columnas) continue;
      hojasLeidas++;
      let seccion='';
      const datos=[];
      let declarado=null;
      for(const f of hoja.filas.slice(indice+1)) {
        const c=k=>f.celdas[columnas[k]],codigo=String(c('codigo')?.texto??c('codigo')?.valor??'').trim(),nombre=String(c('nombre')?.valor??'').trim();
        if(resultado && /^(?:utilidad o perdida|utilidad neta|resultado (?:neto|del periodo)|perdida neta)(?: del (?:periodo|ejercicio))?$/.test(normal(codigo||nombre))) {
          declarado=valor(c(columnas.importe>=0?'importe':'saldo'));continue;
        }
        if(!resultado && columnas.saldo>=0 && /^(?:total general|totales|totales de cuentas de detalle)$/.test(normal(codigo||nombre))) {
          declarado=valor(c('saldo'));continue;
        }
        if(!codigo) {
          if(tipo(nombre)) seccion=tipo(nombre);
          else if(nombre && !/^total\b/i.test(nombre) && ['saldo','importe','debe','haber'].some(k=>c(k)?.valor!=null)) throw new Error(hoja.nombre+' · fila '+f.numero+' sin código de cuenta.');
          continue;
        }
        if(/^total\b/i.test(codigo)) continue;
        if(!nombre && tipo(codigo)) {seccion=tipo(codigo);continue;}
        if(!nombre) throw new Error(hoja.nombre+' · fila '+f.numero+' sin nombre de cuenta.');
        const existente=catalogo.find(x=>x.codigo===codigo);
        if(existente && existente.nombre!==nombre) throw new Error('El código '+codigo+' tiene otro nombre en el catálogo.');
        const anterior=catalogo.filter(c=>c.clase && codigo.startsWith(c.codigo+'-')).sort((a,b)=>b.codigo.length-a.codigo.length)[0];
        const clase=tipo(c('clase')?.valor)||existente?.clase||seccion||anterior?.clase||'';
        try {
          let monto;
          if(resultado) {
            monto=valor(c(columnas.importe>=0?'importe':'saldo'));
            // Un saldo contable acreedor es negativo. Un importe de estado de resultados ya tiene signo de presentación.
            if(columnas.importe<0 && clase==='ingreso' && monto!==null) monto=-monto;
            if(columnas.importe<0 && !clase) throw new Error('Indica la clase de la cuenta o usa una columna Importe con signo de presentación.');
          } else if(columnas.saldo>=0) monto=valor(c('saldo'));
          else {
            const d=valor(c('debe')), h=valor(c('haber'));
            if((d!==null && d<0n)||(h!==null && h<0n)) throw new Error('Los saldos en Debe y Haber deben ser positivos.');
            monto=d===null && h===null?null:(d||0n)-(h||0n);
          }
          if(monto===null) throw new Error('Falta el importe.');
          if(vistos.has(codigo)) throw new Error('Código repetido en el archivo.');
          vistos.add(codigo);
          datos.push({codigo,nombre,clase,monto,fila:f.numero});
        } catch(error) {throw new Error(hoja.nombre+' · fila '+f.numero+' · '+error.message);}
      }
      const hojasDetalle=datos.filter(r=>!datos.some(s=>s.codigo.startsWith(r.codigo+'-')));
      if(declarado!==null) {
        if(resultado && hojasDetalle.some(r=>!nominales.includes(r.clase))) throw new Error(hoja.nombre+' · Indica la clase de las cuentas para cotejar la utilidad declarada.');
        const total=hojasDetalle.reduce((s,r)=>s+(resultado && r.clase!=='ingreso'?-r.monto:r.monto),0n);
        if(declarado!==total) throw new Error(hoja.nombre+' · El total declarado difiere de las cuentas de detalle.');
      }
      for(const r of datos) {
        const hijos=hojasDetalle.filter(s=>s.codigo.startsWith(r.codigo+'-'));
        if(hijos.length) {
          if(hijos.reduce((s,h)=>s+h.monto,0n)!==r.monto) throw new Error('El subtotal '+r.codigo+' difiere del detalle. Revisa el archivo.');
          grupos.set(r.codigo,r);subtotales++;continue;
        }
        if(!r.monto && !resultado) {ceros++;continue;}
        filas.push({...nuevaFila(),cuenta:r.codigo,nombre_cuenta:r.nombre,clase:r.clase,hoja:hoja.nombre,fila:r.fila,
          debe:r.monto>0n?decimal(r.monto):'',haber:r.monto<0n?decimal(-r.monto):'',importe:decimal(r.monto)});
      }
    }
    if(hojas.some(h=>h.error)) throw new Error('Revisa las hojas del archivo: '+hojas.filter(h=>h.error).map(h=>h.nombre+' · '+h.error).join(', '));
    if(!hojasLeidas||!filas.length) throw new Error(resultado?'Se necesitan Código, Nombre de cuenta e Importe por cuenta de resultados.':'Se necesitan Código, Nombre de cuenta y Saldo final, o saldos en Debe y Haber.');
    for(const f of filas) {
      const grupo=grupos.get(f.cuenta.split('-')[0]);
      if(grupo) {f.nombre_grupo=grupo.nombre; f.clase||=grupo.clase;}
    }
    return {filas,ceros,subtotales,omitidas:hojas.length-hojasLeidas};
  }
  async function cargarArchivo(e,key,archivo) {
    if(!vigente(e)||e.ocupado) return;
    bloquear(e,true);aviso('Leyendo '+archivo.name+'…');
    try {
      const hojas=await ExcelImportacion.leerArchivo(archivo);
      if(!vigente(e)) return;
      const r=leerCierre(hojas,key,e.cuentas);
      // Conservar el trabajo de otras cargas y las líneas editadas. Una recarga idéntica es inocua.
      const anteriores=e.apertura[key].filter(f=>f.cuenta||f.nombre_cuenta||f.debe||f.haber||f.importe);
      const nuevas=[];
      for(const f of r.filas) {
        const previa=anteriores.find(p=>p.cuenta===f.cuenta);
        if(!previa) nuevas.push({...f,archivo:archivo.name});
        else if(previa.nombre_cuenta!==f.nombre_cuenta || (f.clase&&previa.clase&&previa.clase!==f.clase) ||
          (key==='resultado'?centavos(previa.importe||0)!==centavos(f.importe):centavos(previa.debe||0)-centavos(previa.haber||0)!==centavos(f.debe||0)-centavos(f.haber||0)))
          throw new Error('La cuenta '+f.cuenta+' ya tiene otros valores en la apertura.');
      }
      e.apertura[key]=anteriores.concat(nuevas);
      verAsiento(e);aviso(archivo.name+' · '+nuevas.length+' cuentas agregadas, '+r.subtotales+' subtotales verificados y '+r.ceros+' saldos en cero omitidos.'+
        (r.omitidas?' Hojas sin columnas compatibles: '+r.omitidas+'.':'')+' Revisa las cuentas antes de registrar.');
    } catch(error) {if(vigente(e)) fallo(error);}
    finally {if(vigente(e)) bloquear(e,false);}
  }

  function tablaPantalla(titulo,columnas,filas) {
    return (titulo?'<h3>'+html(titulo)+'</h3>':'')+'<div class="lc-tabla" tabindex="0">'+_tablaReporteZip('',columnas,filas)+'</div>';
  }
  function construir(datos,desde,hasta,detalle=false) {
    if(!datos.cuentas.some(c=>c.usada)) return {};
    const cs=datos.cuentas.map(c=>({...c,inicial:centavos(c.inicial),debe:centavos(c.debe),haber:centavos(c.haber),saldo:centavos(c.saldo)}));
    const cols=['inicial','debe','haber','saldo'];
    const suma=(lista,k)=>lista.reduce((s,c)=>s+c[k],0n);
    const montos=lista=>cols.map(k=>dinero(suma(lista,k)));
    if(suma(cs,'inicial')!==0n || suma(cs,'saldo')!==0n || suma(cs,'debe')!==suma(cs,'haber')) throw new Error('La balanza no cuadra con los asientos.');
    const grupos=new Map();
    for(const c of cs) {
      const raiz=c.codigo.split('-')[0];
      if(!grupos.has(raiz)) grupos.set(raiz,[]);
      grupos.get(raiz).push(c);
    }
    const filas=[];
    for(const [codigo,grupo] of grupos) {
      if(grupo.some(c=>c.codigo!==codigo)) filas.push([codigo,grupo.find(c=>c.codigo===codigo)?.nombre||'Subtotal '+codigo,...montos(grupo)]);
      const niveles=new Map();
      for(const c of grupo) {
        if(grupo.length>1 && c.codigo===codigo && !c.usada) continue;
        const nivel=detalle?c.codigo:c.codigo.split('-').slice(0,3).join('-');
        if(!niveles.has(nivel)) niveles.set(nivel,[]);
        niveles.get(nivel).push(c);
      }
      for(const [nivel,cuentas] of niveles) {
        const nombre=cuentas.find(c=>c.codigo===nivel)?.nombre||'Subtotal '+nivel;
        filas.push([nivel,nombre,...montos(cuentas)]);
      }
    }
    filas.push(['','Totales de cuentas de detalle',...montos(cs)]);
    const informes={balanza:{columnas:['Número','Nombre de cuenta','Saldo inicial','Débito','Crédito','Saldo final'],filas,
      nota:(detalle?'Todas las cuentas':'Hasta el tercer nivel')+' · Del '+desde+' al '+hasta+'. Los saldos acreedores se presentan con signo negativo.'}};
    const faltan=cs.filter(c=>c.usada&&!c.clase);
    if(faltan.length) {
      informes.pendiente='Clasifica estas cuentas en Cuentas para emitir los estados financieros: '+faltan.map(c=>c.codigo+' '+c.nombre).join(', ')+'.';
      return informes;
    }
    const balance=[], resultados=[], ap=datos.apertura;
    const referencia=new Map((ap?.resultado_base||[]).map(r=>[r.cuenta,centavos(r.importe)]));
    const incluyeBase=referencia.size>0 && desde<=ap.resultado_desde;
    const parcial=referencia.size>0 && desde>ap.resultado_desde && desde<=ap.fecha;
    const tramos=referencia.size>0 && desde<=ap.fecha;
    let activo=0n,pasivo=0n,patrimonio=0n,utilidadLibro=0n,utilidad=0n,utilidadBase=0n;
    for(const clase of Object.keys(clases)) {
      const cuentas=cs.filter(c=>c.clase===clase&&(c.usada||referencia.has(c.codigo)));
      if(!cuentas.length) continue;
      const nom=nominales.includes(clase), signo=['pasivo','patrimonio','ingreso'].includes(clase)?-1n:1n;
      let total=0n, base=0n;
      for(const c of cuentas) {
        if(nom) {
          const periodo=signo*(c.debe-c.haber), inicial=referencia.get(c.codigo)||0n;
          total+=periodo;base+=inicial;utilidadLibro-=c.saldo;
          resultados.push([c.codigo,c.nombre,...(tramos?[dinero(inicial),dinero(periodo)]:[]),dinero(periodo+(incluyeBase?inicial:0n))]);
        } else {
          const valor=signo*c.saldo;total+=valor;balance.push([c.codigo,c.nombre,dinero(valor)]);
        }
      }
      if(nom) {
        const factor=clase==='ingreso'?1n:-1n;
        utilidad+=factor*total;utilidadBase+=factor*base;
        resultados.push(['','Total '+clases[clase].toLowerCase(),...(tramos?[dinero(base),dinero(total)]:[]),dinero(total+(incluyeBase?base:0n))]);
      } else {
        balance.push(['','Total '+clases[clase].toLowerCase(),dinero(total)]);
        if(clase==='activo') activo=total;
        if(clase==='pasivo') pasivo=total;
        if(clase==='patrimonio') patrimonio=total;
      }
    }
    if(activo!==pasivo+patrimonio+utilidadLibro) throw new Error('Revisa la clasificación de las cuentas del balance.');
    balance.push(['','Resultado acumulado en cuentas de ingresos, costos y gastos',dinero(utilidadLibro)],['','Total pasivo y patrimonio, incluido el resultado',dinero(pasivo+patrimonio+utilidadLibro)]);
    resultados.push(['','Utilidad o pérdida',...(tramos?[dinero(utilidadBase),dinero(utilidad)]:[]),dinero(utilidad+(incluyeBase?utilidadBase:0n))]);
    informes.balance={columnas:['Número','Nombre de cuenta','Saldo'],filas:balance,nota:'Saldos del libro al '+hasta+'.'};
    if(parcial) informes.pendienteResultado='El resultado de apertura está resumido del '+ap.resultado_desde+' al '+ap.fecha+'. Consulta ese período completo o elige una fecha posterior al cierre.';
    else informes.resultados={columnas:['Número','Nombre de cuenta',...(tramos?['Último cierre','Movimientos posteriores']:[]),'Importe del período'],filas:resultados,
      nota:'Del '+desde+' al '+hasta+'.'+(incluyeBase?' Incluye el estado inicial del '+ap.resultado_desde+' al '+ap.fecha+'.':ap && desde<=ap.fecha?' Movimientos disponibles después del cierre al '+ap.fecha+'.':'')};
    return informes;
  }

  async function datosLibro(clinica,desde,hasta) {
    const {data,error}=await sb.rpc('reporte_libro_contable',{p_clinica:clinica,p_desde:desde,p_hasta:hasta});
    if(error) throw error;
    return data;
  }
  function verReportes(e) {
    id('panel').innerHTML='<h2>Reportes del libro contable</h2><form id="lc-filtros" class="lc-campos">'+
      '<label>Reporte<select name="tipo">'+Object.entries(titulos).map(([v,t])=>'<option value="'+v+'"'+(e.tipo===v?' selected':'')+'>'+t+'</option>').join('')+'</select></label>'+
      '<label id="lc-niveles">Detalle<select name="detalle"><option value="3">Hasta tercer nivel</option><option value="todos"'+(e.detalle?' selected':'')+'>Todas las cuentas</option></select></label>'+
      '<label>Desde<input type="date" name="desde" value="'+html(e.desde)+'" required></label>'+
      '<label>Hasta<input type="date" name="hasta" value="'+html(e.hasta)+'" required></label>'+
      '<button class="btn btn-primary">Consultar</button></form><div id="lc-reporte" aria-live="polite"></div>';
    const f=id('filtros');
    f.onsubmit=ev=>{ev.preventDefault(); consultar(e);};
    f.onchange=()=>{if(f.reportValidity()) consultar(e);};
    consultar(e);
  }
  async function consultar(e) {
    if(!vigente(e)) return;
    const f=id('filtros'),turno=++e.turno;
    e.desde=f.elements.desde.value;e.hasta=f.elements.hasta.value;e.tipo=f.elements.tipo.value;
    e.detalle=f.elements.detalle.value==='todos';id('niveles').hidden=e.tipo!=='balanza';
    e.informe=null;id('reporte').textContent='Consultando…';
    if(!e.desde||!e.hasta||e.desde>e.hasta) {id('reporte').textContent='Revisa el rango de fechas.';return;}
    const actual=()=>vigente(e)&&turno===e.turno;
    try {
      let informe,pendiente;
      if(e.tipo==='diario') {
        const {data,error}=await consultarPaginas(()=>sb.from('libro_diario').select('fecha,documento,origen,lineas').eq('clinica_id',e.clinica)
          .gte('fecha',e.desde).lte('fecha',e.hasta).order('fecha').order('id'));
        if(error) throw error;
        if(data.length) informe={nota:'Del '+e.desde+' al '+e.hasta+'.',columnas:['Fecha','Documento','Concepto','Código','Cuenta','Debe','Haber','Referencia'],
          filas:data.flatMap(a=>a.lineas.map(l=>[a.fecha,a.documento,l.descripcion,l.cuenta,l.nombre_cuenta,dinero(centavos(l.debe)),dinero(centavos(l.haber)),l.referencia||'—']))};
      } else {
        const informes=construir(await datosLibro(e.clinica,e.desde,e.hasta),e.desde,e.hasta,e.detalle);
        informe=informes[e.tipo];pendiente=e.tipo==='resultados'&&informes.pendienteResultado || informes.pendiente;
      }
      if(!actual()) return;
      if(!informe) {id('reporte').textContent=pendiente||'Sin asientos para este corte. Puedes registrar los saldos iniciales o un asiento de diario.';return;}
      e.informe=informe;
      id('reporte').innerHTML='<p>'+html(informe.nota)+'</p>'+tablaPantalla(titulos[e.tipo],informe.columnas,informe.filas)+
        '<div class="lc-acciones"><button id="lc-pdf" class="btn btn-secondary">Descargar PDF</button><button id="lc-csv" class="btn btn-secondary">Descargar CSV</button></div>';
      id('pdf').onclick=()=>{if(actual()) descargarDocumento(()=>pdfAbrir(titulos[e.tipo],_pdfEncabezado(titulos[e.tipo],informe.nota)+_tablaReporteZip('',informe.columnas,informe.filas)));};
      id('csv').onclick=()=>{
        if(!actual()) return;
        const celda=(v,i)=>{
          let s=String(v??'');
          if(['Saldo inicial','Débito','Crédito','Saldo final','Saldo','Último cierre','Movimientos posteriores','Importe del período','Debe','Haber'].includes(informe.columnas[i]) && s.startsWith('C$ '))
            return s.slice(3).replace(/,/g,'');
          if(/^[=+@\-\t\r]/.test(s)) s="'"+s;
          return '"'+s.replace(/"/g,'""')+'"';
        };
        const csv=[informe.columnas,...informe.filas].map(f=>f.map(celda).join(';')).join('\r\n');
        _descargarArchivo(new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8'}),e.tipo+'-'+e.desde+'-'+e.hasta+'.csv');
      };
    } catch(error) {if(actual()) {id('reporte').textContent='';fallo(error);}}
  }
  return {abrir,construir,leerCierre,datosLibro,titulos};
})();
