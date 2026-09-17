// Baja de un profesional que deja la clínica: quién puede, qué conserva y qué
// deja de ofrecerse. Ejecutar con PLAYWRIGHT_MODULE apuntando a playwright.
// PLAYWRIGHT_CHROMIUM permite usar un Chromium propio en vez del canal msedge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');

// Lee una función del archivo real, sea de una línea o de varias.
function extraer(name) {
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  let abiertas=0;
  for(const ch of primeraLinea) { if(ch==='{') abiertas++; else if(ch==='}') abiertas--; }
  if(abiertas===0 && primeraLinea.includes('{')) return primeraLinea;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const code=['_profActivo','puedeDarDeBajaProfesional','_guardarEstadoProfesional',
  'darDeBajaProfesional','reactivarProfesional','renderAgendasDoctors','fillMedicoSelect']
  .map(extraer).join('\n');

const preambulo=`
  window.__sb=[];
  window.__toasts=[];
  window.__faltaColumna=false;   // simula que la migración no se ha corrido
  let confirmar=true, motivoEscrito='';
  window.__responder=(v,m)=>{confirmar=v;motivoEscrito=m||'';};

  const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const hoy=()=>'2026-09-17';
  const formatFecha=f=>f;
  const rolLabel2=r=>r;
  const ESTADOS_CITA_MUERTA=['cancelada','no_asistio'];
  const _citaActiva=c=>!ESTADOS_CITA_MUERTA.includes(c?.estado);
  const _citaAbierta=c=>c?.estado==='pendiente'||c?.estado==='confirmada';
  const toast=(m,t)=>window.__toasts.push({m,t:t||'info'});
  const setLoading=()=>{};
  const loadAll=async()=>{};
  const renderAgendasRight=()=>{};
  const _exigeClinica=()=>!!currentClinicaId;
  const _faltaColumna=(e,c)=>(e?.message||'').toLowerCase().includes(c);
  // Reproduce el input de motivo que el diálogo real inserta en el DOM.
  const customConfirm=async()=>{
    if(!document.getElementById('_baja-motivo')) {
      const i=document.createElement('input'); i.id='_baja-motivo'; document.body.appendChild(i);
    }
    document.getElementById('_baja-motivo').value=motivoEscrito;
    return confirmar;
  };

  const sb={from:tabla=>({update:payload=>{
    const filtros={};
    const api={
      eq:(k,v)=>{filtros[k]=v;return api;},
      then:(res,rej)=>{
        window.__sb.push({tabla,payload,filtros});
        const falla=window.__faltaColumna&&'activo' in payload;
        return Promise.resolve({error:falla?{message:'column profiles.activo does not exist'}:null}).then(res,rej);
      }
    };
    return api;
  }})};

  let currentUser={key:'superadmin',id:'sa',nombre:'Seba'}, currentClinicaId=7;
  let selAgendasDoc='d1', verBajasAgendas=false;
  const isSuperAdmin=()=>currentUser?.key==='superadmin';
  window.__comoUsuario=u=>{currentUser=u;};
  window.__verBajas=v=>{verBajasAgendas=v;};

  const C={prof:[],c:[]};
  window.__prof=ps=>{C.prof=ps;};
  window.__citas=cs=>{C.c=cs.map((c,i)=>({id:i+1,medicoId:'d1',fecha:'2026-09-17',...c}));};
  window.__limpiar=()=>{window.__sb.length=0;window.__toasts.length=0;};

  ${code}
  Object.assign(window,{_profActivo,puedeDarDeBajaProfesional,darDeBajaProfesional,
    reactivarProfesional,renderAgendasDoctors,fillMedicoSelect});
`;

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

const ACTIVO={id:'d1',nombre:'Dra. Ana Pérez',rol:'medico',icono:'👩‍⚕️',email:'ana@x.com'};
const BAJA  ={id:'d2',nombre:'Dr. Luis Gómez',rol:'medico',icono:'👨‍⚕️',activo:false,
              baja_fecha:'2026-09-01T10:00:00Z',baja_motivo:'Renuncia'};

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await page.setContent('<html><body><div id="agendas-doctors-list"></div><select id="c-medico"></select></body></html>');
    await page.addScriptTag({content:preambulo});

    // ── Sin la columna todavía, nadie queda oculto por error ──
    const activos=await page.evaluate(()=>[
      _profActivo({nombre:'sin columna'}),   // la migración no corrió
      _profActivo({activo:true}),
      _profActivo({activo:false})
    ]);
    assert.deepEqual(activos,[true,true,false],'Sin columna todos deben contar como activos');

    // ── Solo el Super Admin ──
    const permisos=await page.evaluate(()=>{
      const r={};
      for(const rol of ['superadmin','medico_admin','admin','medico','recepcion']) {
        window.__comoUsuario({key:rol,id:'x',nombre:'X'});
        r[rol]=puedeDarDeBajaProfesional();
      }
      return r;
    });
    assert.deepEqual(permisos,
      {superadmin:true,medico_admin:false,admin:false,medico:false,recepcion:false},
      'Dar de baja es solo del Super Admin');

    // ── Un médico administrativo no puede, ni llamándola a mano ──
    const sinPermiso=await page.evaluate(async()=>{
      window.__comoUsuario({key:'medico_admin',id:'ma',nombre:'Carlos'});
      window.__prof([{id:'d1',nombre:'Dra. Ana Pérez',rol:'medico'}]);
      window.__limpiar();
      await darDeBajaProfesional('d1');
      return {escrituras:window.__sb.length,toast:window.__toasts.at(-1)};
    });
    assert.equal(sinPermiso.escrituras,0,'Médico administrativo no debe poder dar de baja');
    assert.equal(sinPermiso.toast.t,'error');

    // ── Nadie puede darse de baja a sí mismo ──
    const aSiMismo=await page.evaluate(async()=>{
      window.__comoUsuario({key:'superadmin',id:'d1',nombre:'Seba'});
      window.__prof([{id:'d1',nombre:'Seba',rol:'superadmin'}]);
      window.__limpiar();
      await darDeBajaProfesional('d1');
      return {escrituras:window.__sb.length,toast:window.__toasts.at(-1)};
    });
    assert.equal(aSiMismo.escrituras,0,'No debe poder darse de baja a sí mismo');
    assert.match(aSiMismo.toast.m,/ti mismo/);

    // ── Caso principal: guarda la baja con fecha y motivo ──
    const baja=await page.evaluate(async()=>{
      window.__comoUsuario({key:'superadmin',id:'sa',nombre:'Seba'});
      window.__prof([{id:'d1',nombre:'Dra. Ana Pérez',rol:'medico'}]);
      window.__citas([{estado:'pendiente'},{estado:'completada'}]);
      window.__responder(true,'Fin de contrato');
      window.__limpiar();
      await darDeBajaProfesional('d1');
      return {sb:window.__sb,toasts:window.__toasts};
    });
    assert.equal(baja.sb.length,1,'Una sola escritura');
    assert.equal(baja.sb[0].tabla,'profiles');
    assert.equal(baja.sb[0].filtros.id,'d1');
    assert.equal(baja.sb[0].payload.activo,false);
    assert.equal(baja.sb[0].payload.baja_motivo,'Fin de contrato');
    assert.ok(baja.sb[0].payload.baja_fecha,'Debe guardar la fecha de baja');
    assert.match(baja.toasts.at(-1).m,/dado de baja/);

    // ── Las citas pendientes NO se cancelan solas ──
    assert.equal(baja.sb.filter(e=>e.tabla==='citas').length,0,
      'Dar de baja no debe tocar las citas: alguien tiene que reasignarlas');

    // ── Si falta la migración, lo dice en vez de fingir que funcionó ──
    const sinMigracion=await page.evaluate(async()=>{
      window.__prof([{id:'d1',nombre:'Dra. Ana Pérez',rol:'medico'}]);
      window.__faltaColumna=true;
      window.__limpiar();
      await darDeBajaProfesional('d1');
      window.__faltaColumna=false;
      return window.__toasts.at(-1);
    });
    assert.equal(sinMigracion.t,'error');
    assert.match(sinMigracion.m,/migracion_baja_profesional\.sql/,'Debe nombrar el archivo a ejecutar');

    // ── Reactivar limpia fecha y motivo ──
    const reactivar=await page.evaluate(async()=>{
      window.__prof([{id:'d2',nombre:'Dr. Luis Gómez',rol:'medico',activo:false,baja_motivo:'Renuncia'}]);
      window.__limpiar();
      await reactivarProfesional('d2');
      return window.__sb;
    });
    assert.equal(reactivar.length,1);
    assert.deepEqual(reactivar[0].payload,{activo:true,baja_fecha:null,baja_motivo:null});

    // ── La lista esconde a los dados de baja, con un pie para destaparlos ──
    const lista=await page.evaluate(({a,b})=>{
      window.__comoUsuario({key:'superadmin',id:'sa',nombre:'Seba'});
      window.__prof([a,b]);
      window.__citas([]);
      window.__verBajas(false); renderAgendasDoctors();
      const oculto={tarjetas:document.querySelectorAll('.doc-card').length,
                    pie:document.querySelector('.agendas-bajas-toggle')?.textContent.trim()};
      window.__verBajas(true); renderAgendasDoctors();
      const visible={tarjetas:document.querySelectorAll('.doc-card').length,
                     conBaja:document.querySelectorAll('.doc-card.baja').length};
      // Un rol sin permiso no ve ni el pie ni los dados de baja
      window.__comoUsuario({key:'recepcion',id:'r',nombre:'R'});
      renderAgendasDoctors();
      const recepcion={tarjetas:document.querySelectorAll('.doc-card').length,
                       pie:!!document.querySelector('.agendas-bajas-toggle')};
      return {oculto,visible,recepcion};
    },{a:ACTIVO,b:BAJA});
    assert.equal(lista.oculto.tarjetas,1,'Por defecto solo se ve al activo');
    assert.match(lista.oculto.pie,/Ver 1 dado de baja/);
    assert.equal(lista.visible.tarjetas,2,'Al destapar aparecen los dos');
    assert.equal(lista.visible.conBaja,1,'El dado de baja va marcado');
    assert.equal(lista.recepcion.tarjetas,1,'Recepción nunca ve a los dados de baja');
    assert.equal(lista.recepcion.pie,false,'Recepción no ve el pie para destaparlos');

    // ── El selector de médico no ofrece bajas, pero no pierde la de una cita vieja ──
    const select=await page.evaluate(({a,b})=>{
      window.__prof([a,b]);
      fillMedicoSelect('c-medico');
      const nueva=[...document.querySelectorAll('#c-medico option')].map(o=>o.textContent.trim());
      fillMedicoSelect('c-medico','d2');   // cita vieja atendida por quien ya se fue
      const sel=document.getElementById('c-medico');
      return {nueva,vieja:[...sel.options].map(o=>o.textContent.trim()),valor:sel.value};
    },{a:ACTIVO,b:BAJA});
    assert.equal(select.nueva.length,2,'Cita nueva: solo "Sin asignar" y el activo');
    assert.ok(!select.nueva.some(t=>/Luis/.test(t)),'No debe ofrecerse a quien se fue');
    assert.ok(select.vieja.some(t=>/Luis.*dado de baja/.test(t)),'La cita vieja conserva su médico');
    assert.equal(select.valor,'d2','El médico de la cita vieja no debe perderse');

    // ── Cómo se ve la lista con un dado de baja ──
    const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
    const html=await page.evaluate(({a,b})=>{
      window.__comoUsuario({key:'superadmin',id:'sa',nombre:'Seba'});
      window.__prof([a,b]); window.__citas([]); window.__verBajas(true);
      renderAgendasDoctors();
      return document.getElementById('agendas-doctors-list').innerHTML;
    },{a:ACTIVO,b:BAJA});
    for(const width of [1280,360]) {
      await page.setViewportSize({width,height:640});
      await page.setContent(`<style>${css}\n*{animation:none!important;transition:none!important}</style>`
        +`<div style="padding:12px;background:var(--bg)"><div class="card" style="max-width:270px">${html}</div></div>`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,
        'Desbordamiento horizontal a '+width+' px');
      const dest=path.join(process.env.TEMP||'/tmp','lumea-baja-'+width+'.png');
      await page.screenshot({path:dest});
      console.log('Layout '+width+' px: '+dest);
    }

    console.log('OK: permisos, baja con motivo, sin tocar citas, falta de migración, reactivar, lista y selector.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
