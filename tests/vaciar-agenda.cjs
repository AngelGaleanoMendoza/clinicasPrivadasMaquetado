// Vaciar la agenda de un profesional: quién puede, qué cancela y cómo se ve.
// Ejecutar con PLAYWRIGHT_MODULE apuntando a una instalación de playwright.
// PLAYWRIGHT_CHROMIUM permite usar un Chromium propio en vez del canal msedge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');

// Las funciones se leen del archivo real para que la prueba falle si cambian.
const functions=['puedeVaciarAgenda','vaciarAgendaDoctor','renderAgendasRight'];
const code=functions.map(name=>{
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}).join('\n');

// Entorno mínimo alrededor de las funciones reales.
const preambulo=`
  window.__sb=[];               // cada update enviado a Supabase
  window.__toasts=[];
  window.__faltaColumna=false;  // simula que motivo_cancelacion no existe
  let confirmar=true;
  window.__responder=v=>{confirmar=v;};

  const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const hoy=()=>'2026-09-17';
  const formatFecha=f=>f;
  const formatHora12=h=>h;
  const rolLabel2=r=>r;
  const ESTADOS_CITA_MUERTA=['cancelada','no_asistio'];
  const _citaActiva=c=>!ESTADOS_CITA_MUERTA.includes(c?.estado);
  const _citaAbierta=c=>c?.estado==='pendiente'||c?.estado==='confirmada';
  const _sujetoCita=c=>({titulo:'Paciente '+c.id});
  const estadoTag=e=>'<span>'+e+'</span>';
  const _tramosDia=()=>[['08:00','12:00']];
  const _slotsDelDia=()=>new Array(8);
  const renderAgendaCalendar=()=>{};
  const renderAgendaDayCitas=()=>{};
  const renderAgendasDoctors=()=>{};
  const toast=(m,t)=>window.__toasts.push({m,t:t||'info'});
  const setLoading=()=>{};
  const updateBadges=()=>{};
  const loadAll=async()=>{};
  const _exigeClinica=()=>!!currentClinicaId;
  const _faltaColumna=(e,c)=>(e?.message||'').toLowerCase().includes(c);
  const customConfirm=async()=>confirmar;

  // Cliente Supabase de mentira: encadena igual y anota lo que recibe.
  const sb={from:tabla=>({update:payload=>{
    const filtros={};
    const api={
      eq:(k,v)=>{filtros[k]=v;return api;},
      in:(k,v)=>{filtros[k+'__in']=v;return api;},
      then:(res,rej)=>{
        window.__sb.push({tabla,payload,filtros});
        const falla=window.__faltaColumna&&'motivo_cancelacion' in payload;
        return Promise.resolve({error:falla?{message:'column citas.motivo_cancelacion does not exist'}:null}).then(res,rej);
      }
    };
    return api;
  }})};

  let currentUser=null, currentClinicaId=7, selAgendasDoc='d1', selAgendasDate='2026-09-17';
  const isSuperAdmin=()=>currentUser?.key==='superadmin';
  window.__comoUsuario=u=>{currentUser=u;};
  window.__clinica=id=>{currentClinicaId=id;};

  const C={prof:[{id:'d1',nombre:'Dra. Ana Pérez',rol:'medico',icono:'👩‍⚕️',email:'ana@x.com'}],c:[]};
  window.__citas=cs=>{C.c=cs.map((c,i)=>({id:i+1,medicoId:'d1',fecha:'2026-09-17',hora:'08:00',motivo:'Control',...c}));};
  window.__limpiar=()=>{window.__sb.length=0;window.__toasts.length=0;};

  ${code}
  Object.assign(window,{puedeVaciarAgenda,vaciarAgendaDoctor,renderAgendasRight});
`;

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await page.setContent('<html><body><div id="agendas-right-panel"></div></body></html>');
    await page.addScriptTag({content:preambulo});

    // ── Quién puede vaciar ──
    const permisos=await page.evaluate(()=>{
      const r={};
      for(const rol of ['superadmin','medico_admin','medico','admin','recepcion','enfermeria']) {
        window.__comoUsuario({key:rol,nombre:'X'});
        r[rol]=puedeVaciarAgenda();
      }
      return r;
    });
    assert.deepEqual(permisos,
      {superadmin:true,medico_admin:true,medico:false,admin:false,recepcion:false,enfermeria:false},
      'Solo médico administrativo y Super Admin pueden vaciar');

    // ── El botón solo se dibuja para quien puede ──
    const botones=await page.evaluate(()=>{
      const r={};
      for(const rol of ['medico_admin','medico']) {
        window.__comoUsuario({key:rol,nombre:'X'});
        window.__citas([{estado:'pendiente'}]);
        renderAgendasRight();
        r[rol]=!!document.querySelector('.agenda-doc-vaciar');
      }
      return r;
    });
    assert.deepEqual(botones,{medico_admin:true,medico:false},'El botón aparece solo con permiso');

    // ── Un médico normal no puede, aunque llame a la función directamente ──
    const sinPermiso=await page.evaluate(async()=>{
      window.__comoUsuario({key:'medico',nombre:'Ana'});
      window.__citas([{estado:'pendiente'}]);
      window.__limpiar();
      await vaciarAgendaDoctor('d1');
      return {escrituras:window.__sb.length,toast:window.__toasts.at(-1)};
    });
    assert.equal(sinPermiso.escrituras,0,'Un médico no debe poder vaciar');
    assert.equal(sinPermiso.toast.t,'error');

    // ── Sin clínica elegida no se escribe nada ──
    const sinClinica=await page.evaluate(async()=>{
      window.__comoUsuario({key:'superadmin',nombre:'Seba'});
      window.__clinica(null);
      window.__limpiar();
      await vaciarAgendaDoctor('d1');
      window.__clinica(7);
      return window.__sb.length;
    });
    assert.equal(sinClinica,0,'Sin clínica no debe escribir');

    // ── Caso principal: solo cancela lo que sigue en pie ──
    const principal=await page.evaluate(async()=>{
      window.__comoUsuario({key:'medico_admin',nombre:'Carlos'});
      window.__citas([
        {estado:'pendiente'},{estado:'confirmada'},
        {estado:'completada'},{estado:'cancelada'},{estado:'no_asistio'},
        {estado:'pendiente',medicoId:'d2'}
      ]);
      window.__limpiar();
      await vaciarAgendaDoctor('d1');
      return {sb:window.__sb,toasts:window.__toasts};
    });
    assert.equal(principal.sb.length,1,'Una sola escritura');
    const esc=principal.sb[0];
    assert.equal(esc.tabla,'citas');
    assert.equal(esc.payload.estado,'cancelada');
    assert.match(esc.payload.motivo_cancelacion,/Carlos/,'El motivo debe decir quién vació');
    assert.equal(esc.filtros.medico_id,'d1','Filtra por el médico');
    assert.equal(esc.filtros.clinica_id,7,'Filtra por la clínica');
    assert.deepEqual(esc.filtros.estado__in,['pendiente','confirmada'],
      'Solo pendiente y confirmada: lo atendido es historial');
    assert.match(principal.toasts.at(-1).m,/2 citas canceladas/,'Cuenta solo las que siguen en pie');

    // ── Sin citas pendientes avisa y no escribe ──
    const vacia=await page.evaluate(async()=>{
      window.__citas([{estado:'completada'}]);
      window.__limpiar();
      await vaciarAgendaDoctor('d1');
      return {escrituras:window.__sb.length,toast:window.__toasts.at(-1)};
    });
    assert.equal(vacia.escrituras,0,'Sin pendientes no escribe');
    assert.match(vacia.toast.m,/no tiene citas pendientes/);

    // ── Si se cancela el diálogo no pasa nada ──
    const cancelado=await page.evaluate(async()=>{
      window.__citas([{estado:'pendiente'}]);
      window.__responder(false);
      window.__limpiar();
      await vaciarAgendaDoctor('d1');
      window.__responder(true);
      return window.__sb.length;
    });
    assert.equal(cancelado,0,'Al cancelar el diálogo no debe escribir');

    // ── Degradación: si falta la columna, cancela igual y avisa ──
    const degradado=await page.evaluate(async()=>{
      window.__citas([{estado:'pendiente'}]);
      window.__faltaColumna=true;
      window.__limpiar();
      await vaciarAgendaDoctor('d1');
      window.__faltaColumna=false;
      return {sb:window.__sb,toasts:window.__toasts};
    });
    assert.equal(degradado.sb.length,2,'Reintenta sin la columna que falta');
    assert.equal('motivo_cancelacion' in degradado.sb[1].payload,false,'El reintento va sin el motivo');
    assert.equal(degradado.sb[1].payload.estado,'cancelada');
    assert.ok(degradado.toasts.some(t=>t.t==='warning'&&/motivo_cancelacion/.test(t.m)),
      'Debe avisar de que falta la columna');

    // ── Cómo se ve, en escritorio y en teléfono ──
    const cabecera=await page.evaluate(()=>{
      window.__comoUsuario({key:'medico_admin',nombre:'Carlos'});
      window.__citas([{estado:'pendiente'},{estado:'completada'}]);
      renderAgendasRight();
      return document.querySelector('.agenda-doc-head').outerHTML;
    });
    const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
    for(const width of [1280,430,390,360]) {
      await page.setViewportSize({width,height:900});
      await page.setContent(`<style>${css}\n*{animation:none!important;transition:none!important}</style>`
        +`<div style="padding:12px;background:var(--bg)"><div class="card">${cabecera}</div></div>`);
      const medida=await page.evaluate(()=>{
        const b=document.querySelector('.agenda-doc-vaciar').getBoundingClientRect();
        return {desborde:document.documentElement.scrollWidth-innerWidth,alto:b.height,ancho:b.width};
      });
      assert.equal(medida.desborde,0,'Desbordamiento horizontal a '+width+' px');
      // En el teléfono el botón ocupa su propio renglón y se toca con el dedo;
      // en escritorio mantiene el alto de cualquier otro btn-sm de la cabecera.
      const minimo=width<=560?40:24;
      assert.ok(medida.alto>=minimo,'Botón demasiado bajo a '+width+' px ('+medida.alto+')');
      const dest=path.join(process.env.TEMP||'/tmp','lumea-vaciar-agenda-'+width+'.png');
      await page.screenshot({path:dest});
      console.log('Layout '+width+' px: '+dest+'  botón '+Math.round(medida.ancho)+'×'+Math.round(medida.alto));
    }

    console.log('OK: permisos, filtros de la escritura, agenda vacía, cancelar, degradación y layout.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
