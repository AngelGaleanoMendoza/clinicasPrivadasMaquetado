// ════════════════════ SUPABASE ════════════════════
const SURL = 'https://ckpskotpdkmojgaqxyht.supabase.co';
const SKEY = 'sb_publishable_2W-uJNSJSFLMYn5NJShPKw_sRCynIka';
const sb = supabase.createClient(SURL, SKEY);

// Detectar recovery token lo antes posible
sb.auth.onAuthStateChange((event) => {
  if(event === 'PASSWORD_RECOVERY') {
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('recovery-overlay');
      if(el) el.style.display = 'flex';
    }, { once: true });
    const el = document.getElementById('recovery-overlay');
    if(el) el.style.display = 'flex';
  }
});

// Fallback: detectar hash directamente en la URL
window.addEventListener('DOMContentLoaded', () => {
  const hash = new URLSearchParams(window.location.hash.replace('#',''));
  if(hash.get('type') === 'recovery') {
    const el = document.getElementById('recovery-overlay');
    if(el) el.style.display = 'flex';
  }
}, { once: true });

// ════════════════════ CACHE LOCAL ════════════════════
const C = { p:[], c:[], m:[], n:[], e:[], prof:[], inv:[], mov:[] };
let currentClinicaId = null;
let currentClinica   = null;

// ════════════════════ MAPPERS DB ↔ JS ════════════════════
const fromP = r => ({ id:r.id, nombre:r.nombre, apellidos:r.apellidos, identificacion:r.identificacion, fechaNac:r.fecha_nac, sexo:r.sexo, sangre:r.sangre, telefono:r.telefono, email:r.email, direccion:r.direccion, alergias:r.alergias, estado:r.estado||'activo', emergencia:r.emergencia, observaciones:r.observaciones, fechaRegistro:r.fecha_registro, fotoUrl:r.foto_url||null });
const toP   = x => ({ nombre:x.nombre, apellidos:x.apellidos, identificacion:x.identificacion||null, fecha_nac:x.fechaNac||null, sexo:x.sexo||null, sangre:x.sangre||null, telefono:x.telefono||null, email:x.email||null, direccion:x.direccion||null, alergias:x.alergias||null, estado:x.estado||'activo', emergencia:x.emergencia||null, observaciones:x.observaciones||null, fecha_registro:x.fechaRegistro||hoy(), foto_url:x.fotoUrl||null, clinica_id:currentClinicaId });
const fromE = r => ({ id:r.id, pacienteId:r.paciente_id, peso:r.peso, talla:r.talla, presion:r.presion, temperatura:r.temperatura, enfermedadesCronicas:r.enfermedades_cronicas, cirugias:r.cirugias_previas, antecedentesFamiliares:r.antecedentes_familiares, vacunas:r.vacunas, tabaco:r.habito_tabaco||'no', alcohol:r.habito_alcohol||'no', actividadFisica:r.actividad_fisica||'sedentario', ocupacion:r.ocupacion, estadoCivil:r.estado_civil, observacionesMedicas:r.observaciones_medicas });
const toE   = x => ({ paciente_id:x.pacienteId, peso:x.peso?Number(x.peso):null, talla:x.talla?Number(x.talla):null, presion:x.presion||null, temperatura:x.temperatura?Number(x.temperatura):null, enfermedades_cronicas:x.enfermedadesCronicas||null, cirugias_previas:x.cirugias||null, antecedentes_familiares:x.antecedentesFamiliares||null, vacunas:x.vacunas||null, habito_tabaco:x.tabaco||'no', habito_alcohol:x.alcohol||'no', actividad_fisica:x.actividadFisica||'sedentario', ocupacion:x.ocupacion||null, estado_civil:x.estadoCivil||null, observaciones_medicas:x.observacionesMedicas||null, clinica_id:currentClinicaId });
const fromC = r => ({ id:r.id, pacienteId:r.paciente_id, medicoId:r.medico_id||null, fecha:r.fecha, hora:(r.hora||'').slice(0,5), motivo:r.motivo, tipo:r.tipo, estado:r.estado, notas:r.notas });
const toC   = x => ({ paciente_id:x.pacienteId, medico_id:x.medicoId||null, fecha:x.fecha, hora:x.hora, motivo:x.motivo, tipo:x.tipo||'consulta', estado:x.estado||'pendiente', notas:x.notas||null, clinica_id:currentClinicaId });
const fromM = r => ({ id:r.id, pacienteId:r.paciente_id, nombre:r.nombre, dosis:r.dosis, frecuencia:r.frecuencia, inicio:r.inicio, fin:r.fin, via:r.via, estado:r.estado, indicaciones:r.indicaciones });
const toM   = x => ({ paciente_id:x.pacienteId, nombre:x.nombre, dosis:x.dosis, frecuencia:x.frecuencia, inicio:x.inicio||null, fin:x.fin||null, via:x.via||'oral', estado:x.estado||'activa', indicaciones:x.indicaciones||null, clinica_id:currentClinicaId });
const fromN   = r => ({ id:r.id, pacienteId:r.paciente_id, tipo:r.tipo, fecha:r.fecha, titulo:r.titulo, contenido:r.contenido });
const toN     = x => ({ paciente_id:x.pacienteId, tipo:x.tipo||'evolucion', fecha:x.fecha||hoy(), titulo:x.titulo||null, contenido:x.contenido, clinica_id:currentClinicaId });
const fromInv = r => ({ id:r.id, nombre:r.nombre, categoria:r.categoria||'general', unidad:r.unidad||'unidad', stock:Number(r.stock_actual||0), stockMin:Number(r.stock_minimo||0), precio:r.precio_unitario!=null?Number(r.precio_unitario):null, descripcion:r.descripcion||null });
const toInv   = x => ({ nombre:x.nombre, categoria:x.categoria||'general', unidad:x.unidad||'unidad', stock_actual:Number(x.stock||0), stock_minimo:Number(x.stockMin||0), precio_unitario:x.precio||null, descripcion:x.descripcion||null, clinica_id:currentClinicaId });
const fromMov = r => ({ id:r.id, invId:r.inventario_id, tipo:r.tipo, cantidad:Number(r.cantidad), motivo:r.motivo||null, fecha:r.fecha });

// ════════════════════ LOAD DATA ════════════════════
async function loadAll() {
  if(!currentClinicaId) { setDbStatus(true); setLoading(false); return; }
  setLoading(true);
  try {
    const [rp,rc,rm,rn,re,rpf,ri,rmov] = await Promise.all([
      sb.from('pacientes').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('citas').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('medicaciones').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('notas').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('expediente').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('profiles').select('id,nombre,rol,email,icono,clinica_id').eq('clinica_id', currentClinicaId),
      sb.from('inventario').select('*').eq('clinica_id', currentClinicaId).order('nombre'),
      sb.from('inventario_movimientos').select('*').eq('clinica_id', currentClinicaId).order('fecha', {ascending:false}).limit(500)
    ]);
    if(rp.error) throw rp.error;
    if(rc.error) throw rc.error;
    if(rm.error) throw rm.error;
    if(rn.error) throw rn.error;
    C.p = (rp.data||[]).map(fromP);
    C.c = (rc.data||[]).map(fromC);
    C.m = (rm.data||[]).map(fromM);
    C.n = (rn.data||[]).map(fromN);
    C.e = re.error ? [] : (re.data||[]).map(fromE);
    C.prof = rpf.error ? [] : (rpf.data||[]);
    C.inv = ri.error ? [] : (ri.data||[]).map(fromInv);
    C.mov = rmov.error ? [] : (rmov.data||[]).map(fromMov);
    setDbStatus(true);
  } catch(e) {
    console.error('Supabase:', e);
    setDbStatus(false);
    toast('Error conectando con la base de datos','error');
  }
  setLoading(false);
}

function setLoading(on) {
  document.getElementById('loading-overlay').classList.toggle('show', on);
}
function setDbStatus(ok) {
  document.getElementById('db-dot').className = 'db-dot' + (ok?' connected':'');
  document.getElementById('db-label').textContent = ok ? 'Supabase conectado' : 'Sin conexión';
}

// ════════════════════ AUTH ════════════════════
let currentUser = null;
let selectedEmail = '';

async function verificarLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if(!email || !password) {
    errEl.textContent = 'Ingresa tu email y contraseña';
    errEl.style.display = 'block';
    return;
  }
  setLoading(true);

  // ── PASO 1: login directo en Supabase Auth ──
  const { data: authData } = await sb.auth.signInWithPassword({ email, password });
  if(authData?.user) {
    const profile = await resolverPerfil(authData.user.id, email);
    if(profile) { await entrarConPerfil(profile); return; }
    await sb.auth.signOut();
  }

  // ── PASO 2: usuario no está en Auth → intentar registrarlo (auto-migración) ──
  // Funciona cuando "Confirm email" está desactivado en Supabase
  const { data: signUpData, error: signUpErr } = await sb.auth.signUp({ email, password });
  if(!signUpErr && signUpData?.user) {
    // Si hay sesión activa el usuario quedó confirmado automáticamente
    if(signUpData.session || signUpData.user.confirmed_at || signUpData.user.email_confirmed_at) {
      // Intentar login inmediato post-registro
      const { data: retryAuth } = await sb.auth.signInWithPassword({ email, password });
      if(retryAuth?.user) {
        const profile = await resolverPerfil(retryAuth.user.id, email);
        if(profile) { await entrarConPerfil(profile); return; }
        await sb.auth.signOut();
      }
    } else {
      // Necesita confirmar correo — no podemos continuar automáticamente
      setLoading(false);
      shakeLogin();
      errEl.innerHTML = 'Cuenta pendiente de confirmación de correo.<br><small>Revisa <strong>' + email + '</strong> o pide al administrador que confirme tu cuenta en el panel de Supabase.</small>';
      errEl.style.display = 'block';
      return;
    }
  }

  // ── PASO 3: fallback legacy (profiles con password en texto plano) ──
  const { data: legacy } = await sb.from('profiles').select('*').eq('email', email).eq('password', password).maybeSingle();
  if(legacy) {
    // Auto-registrar en Auth para futuras sesiones
    const { data: migrAuth } = await sb.auth.signInWithPassword({ email, password });
    if(migrAuth?.user) {
      await sb.from('profiles').update({ id: migrAuth.user.id }).eq('email', email);
      legacy.id = migrAuth.user.id;
    }
    await entrarConPerfil(legacy);
    return;
  }

  setLoading(false);
  shakeLogin();
  errEl.textContent = 'Email o contraseña incorrectos';
  errEl.style.display = 'block';
  document.getElementById('login-password').value = '';
}

// Busca perfil por Auth UUID; si no lo encuentra por ID, lo busca por email y sincroniza
async function resolverPerfil(authId, email) {
  const { data: p1 } = await sb.from('profiles').select('*').eq('id', authId).maybeSingle();
  if(p1) return p1;
  const { data: p2 } = await sb.from('profiles').select('*').eq('email', email).maybeSingle();
  if(p2) {
    await sb.from('profiles').update({ id: authId }).eq('email', email);
    return { ...p2, id: authId };
  }
  return null;
}

// ════════════════════ INACTIVIDAD ════════════════════
const INAC_TOTAL = 2 * 60 * 1000;   // 2 minutos
const INAC_AVISO  = 30 * 1000;       // aviso 30s antes

let _inacTimer    = null;
let _inacCuenta   = null;
let _inacActivo   = false;

function _inacReset() {
  if(!_inacActivo) return;
  clearTimeout(_inacTimer);
  clearInterval(_inacCuenta);
  const el = document.getElementById('modal-inactividad');
  if(el) el.classList.remove('open');
  _inacTimer = setTimeout(_inacAviso, INAC_TOTAL - INAC_AVISO);
}

function _inacAviso() {
  const overlay = document.getElementById('modal-inactividad');
  const countEl = document.getElementById('inactividad-count');
  if(!overlay) { autoLogout(); return; }
  overlay.classList.add('open');
  let secs = 30;
  if(countEl) countEl.textContent = secs;
  _inacCuenta = setInterval(() => {
    secs--;
    if(countEl) countEl.textContent = secs;
    if(secs <= 0) { clearInterval(_inacCuenta); autoLogout(); }
  }, 1000);
}

function iniciarInactividad() {
  _inacActivo = true;
  ['click','mousemove','keydown','touchstart','scroll'].forEach(e =>
    document.addEventListener(e, _inacReset, { passive: true }));
  _inacReset();
}

function detenerInactividad() {
  _inacActivo = false;
  clearTimeout(_inacTimer);
  clearInterval(_inacCuenta);
  ['click','mousemove','keydown','touchstart','scroll'].forEach(e =>
    document.removeEventListener(e, _inacReset));
  const el = document.getElementById('modal-inactividad');
  if(el) el.classList.remove('open');
}

function continuarSesion() {
  clearInterval(_inacCuenta);
  const el = document.getElementById('modal-inactividad');
  if(el) el.classList.remove('open');
  _inacReset();
}

function _draftsKey() { return 'lm_pendientes_' + (currentClinicaId || 'gen'); }

function guardarBorradoresSesion() {
  const drafts = [];
  const modalCita = document.getElementById('modal-cita');
  const modalMed  = document.getElementById('modal-medicacion');
  const modalNota = document.getElementById('modal-nota');
  const modalPac  = document.getElementById('modal-paciente');

  if(modalCita?.classList.contains('open')) {
    const motivo = document.getElementById('c-motivo')?.value?.trim();
    const fecha  = document.getElementById('c-fecha')?.value;
    const pid    = document.getElementById('c-paciente')?.value;
    if(motivo || fecha) {
      const p = pid ? C.p.find(x=>x.id==pid) : null;
      drafts.push({ id: Date.now()+1, modulo:'cita', titulo:'Cita pendiente'+(p?` — ${p.nombre} ${p.apellidos}`:''),
        icono:'📅', data:{ pacienteId:pid||null, fecha, hora:document.getElementById('c-hora')?.value,
        motivo, tipo:document.getElementById('c-tipo')?.value, estado:'pendiente',
        notas:document.getElementById('c-notas')?.value }});
    }
  }

  if(modalMed?.classList.contains('open')) {
    const pid   = document.getElementById('m-paciente')?.value;
    const items = (typeof medItems!=='undefined' ? medItems : []).filter(m => m.nombre);
    if(items.length) {
      const p = pid ? C.p.find(x=>x.id==pid) : null;
      drafts.push({ id: Date.now()+2, modulo:'medicacion', titulo:'Medicación pendiente'+(p?` — ${p.nombre} ${p.apellidos}`:''),
        icono:'💊', data:{ pacienteId:pid||null, items,
        inicio:document.getElementById('m-inicio')?.value, fin:document.getElementById('m-fin')?.value,
        estado:document.getElementById('m-estado')?.value }});
    }
  }

  if(modalNota?.classList.contains('open')) {
    const contenido = document.getElementById('n-contenido')?.value?.trim();
    const pid       = document.getElementById('n-paciente')?.value;
    if(contenido) {
      const p = pid ? C.p.find(x=>x.id==pid) : null;
      drafts.push({ id: Date.now()+3, modulo:'nota', titulo:'Nota clínica pendiente'+(p?` — ${p.nombre} ${p.apellidos}`:''),
        icono:'📝', data:{ pacienteId:pid||null, tipo:document.getElementById('n-tipo')?.value,
        tituloNota:document.getElementById('n-titulo')?.value, contenido }});
    }
  }

  if(modalPac?.classList.contains('open')) {
    const nombre    = document.getElementById('p-nombre')?.value?.trim();
    const apellidos = document.getElementById('p-apellidos')?.value?.trim();
    if(nombre) {
      drafts.push({ id: Date.now()+4, modulo:'paciente', titulo:'Registro de paciente pendiente'+(apellidos?` — ${nombre} ${apellidos}`:` — ${nombre}`),
        icono:'👤', data:{ nombre, apellidos, identificacion:document.getElementById('p-id')?.value,
        telefono:document.getElementById('p-telefono')?.value }});
    }
  }

  if(drafts.length) {
    const key  = _draftsKey();
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    const ts   = new Date().toLocaleString('es-ES');
    localStorage.setItem(key, JSON.stringify([...prev, ...drafts.map(d => ({...d, ts, usuario: currentUser?.name }))]));
  }
  return drafts.length;
}

async function autoLogout() {
  detenerInactividad();
  const guardados = guardarBorradoresSesion();
  await sb.auth.signOut();
  currentUser = null; currentClinicaId = null;
  const app = document.getElementById('app');
  app.style.transition = 'opacity .3s';
  app.style.opacity = '0';
  setTimeout(() => {
    app.classList.remove('visible');
    app.style.opacity = '';
    const ls = document.getElementById('login-screen');
    ls.style.cssText = 'display:flex;opacity:0;transform:scale(.95);transition:opacity .4s,transform .4s';
    setTimeout(() => { ls.style.opacity='1'; ls.style.transform='none'; }, 10);
    cargarUsuariosLogin();
    if(guardados) toast(`Sesión cerrada por inactividad · ${guardados} elemento${guardados>1?'s':''} guardado${guardados>1?'s':''} como pendiente${guardados>1?'s':''}`, 'warning');
    else toast('Sesión cerrada por inactividad', 'warning');
  }, 300);
}

function renderPendientesSesion() {
  const key    = _draftsKey();
  const drafts = JSON.parse(localStorage.getItem(key) || '[]');
  const el     = document.getElementById('panel-pendientes-sesion');
  if(!el) return;
  if(!drafts.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div class="card" style="border:2px solid var(--warning);background:linear-gradient(135deg,#FFFBEB,#FEF3C7)">
      <div class="card-header" style="border-bottom:1px solid #FDE68A;padding-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">⏳</span>
          <div>
            <h3 style="color:#92400E;margin:0">Pendientes de finalización</h3>
            <p style="font-size:12px;color:#B45309;margin:0">${drafts.length} elemento${drafts.length>1?'s':''} guardado${drafts.length>1?'s':''} al cerrar la sesión anterior</p>
          </div>
        </div>
        <button class="btn btn-sm" style="background:#FEF3C7;color:#92400E;border:1px solid #FDE68A" onclick="limpiarPendientesSesion()">✕ Descartar todos</button>
      </div>
      <div style="padding-top:12px;display:flex;flex-direction:column;gap:8px">
        ${drafts.map((d,i) => `
          <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #FDE68A;border-radius:10px;padding:12px 14px">
            <span style="font-size:20px;flex-shrink:0">${d.icono||'📋'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;color:#0F172A">${d.titulo}</div>
              <div style="font-size:11px;color:#B45309;margin-top:2px">Guardado: ${d.ts||''} · Por: ${d.usuario||''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-sm btn-primary" onclick="recuperarDraft(${i})">♻️ Recuperar</button>
              <button class="btn btn-sm btn-secondary" onclick="descartarDraft(${i})">✕</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function recuperarDraft(idx) {
  const key    = _draftsKey();
  const drafts = JSON.parse(localStorage.getItem(key) || '[]');
  const d      = drafts[idx];
  if(!d) return;
  if(d.modulo === 'cita') {
    openModalCita();
    setTimeout(() => {
      if(d.data.pacienteId) setPacienteSelect('c-paciente', d.data.pacienteId);
      if(d.data.fecha)   document.getElementById('c-fecha').value   = d.data.fecha;
      if(d.data.hora)    fillHoraSelect(d.data.hora);
      if(d.data.motivo)  document.getElementById('c-motivo').value  = d.data.motivo;
      if(d.data.tipo)    document.getElementById('c-tipo').value    = d.data.tipo;
      if(d.data.notas)   document.getElementById('c-notas').value   = d.data.notas;
    }, 80);
  } else if(d.modulo === 'medicacion') {
    openModalMedicacion();
    setTimeout(() => {
      if(d.data.pacienteId) setPacienteSelect('m-paciente', d.data.pacienteId);
      if(d.data.items) { medItems = d.data.items; renderMedItems(); }
      if(d.data.inicio) document.getElementById('m-inicio').value = d.data.inicio;
      if(d.data.fin)    document.getElementById('m-fin').value    = d.data.fin;
      if(d.data.estado) document.getElementById('m-estado').value = d.data.estado;
    }, 80);
  } else if(d.modulo === 'nota') {
    openModalNota();
    setTimeout(() => {
      if(d.data.pacienteId) setPacienteSelect('n-paciente', d.data.pacienteId);
      if(d.data.tipo)      document.getElementById('n-tipo').value     = d.data.tipo;
      if(d.data.tituloNota)document.getElementById('n-titulo').value   = d.data.tituloNota;
      if(d.data.contenido) document.getElementById('n-contenido').value= d.data.contenido;
    }, 80);
  } else if(d.modulo === 'paciente') {
    openModalPaciente();
    setTimeout(() => {
      if(d.data.nombre)       document.getElementById('p-nombre').value    = d.data.nombre;
      if(d.data.apellidos)    document.getElementById('p-apellidos').value  = d.data.apellidos;
      if(d.data.identificacion) document.getElementById('p-id').value      = d.data.identificacion;
      if(d.data.telefono)     document.getElementById('p-telefono').value   = d.data.telefono;
    }, 80);
  }
  descartarDraft(idx);
}

function descartarDraft(idx) {
  const key    = _draftsKey();
  const drafts = JSON.parse(localStorage.getItem(key) || '[]');
  drafts.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(drafts));
  renderPendientesSesion();
}

function limpiarPendientesSesion() {
  localStorage.removeItem(_draftsKey());
  renderPendientesSesion();
}

async function entrarConPerfil(profile) {
  const rolLabel = {admin:'Administrador',medico:'Médico',recepcion:'Recepcionista',enfermeria:'Enfermería'}[profile.rol]||profile.rol;
  currentClinicaId = profile.clinica_id || null;
  currentUser = {
    id:     profile.id,
    name:   profile.nombre,
    nombre: profile.nombre,
    role:   rolLabel,
    avatar: profile.icono || profile.nombre[0].toUpperCase(),
    email:  profile.email,
    key:    profile.rol
  };
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('sf-name').textContent = currentUser.name;
  document.getElementById('sf-role').textContent = currentUser.role;
  document.getElementById('sf-avatar').textContent = currentUser.avatar;
  toggleAdminMenu();
  setLoading(true);
  const {data:clData} = await sb.from('clinicas').select('*').eq('id',currentClinicaId).single();
  currentClinica = clData || null;
  await loadAll();
  setLoading(false);
  navigate('dashboard');
  toast(`Bienvenido, ${currentUser.name} 👋`, 'info');
  logActivity('login');
  iniciarInactividad();
}

async function checkSession() {}

async function doLogout() {
  const ok = await customConfirm({icon:'👋',title:'¿Cerrar sesión?',msg:`Vas a salir de la sesión de <strong>${currentUser?.nombre||'usuario'}</strong>`,okText:'Cerrar sesión',cancelText:'Quedarse',danger:false});
  if(!ok) return;
  detenerInactividad();
  await sb.auth.signOut();
  currentUser = null; currentClinicaId = null;
  const app = document.getElementById('app');
  app.style.transition = 'opacity .3s';
  app.style.opacity = '0';
  setTimeout(() => {
    app.classList.remove('visible');
    app.style.opacity = '';
    const ls = document.getElementById('login-screen');
    ls.style.cssText = 'display:flex;opacity:0;transform:scale(.95);transition:opacity .4s,transform .4s';
    setTimeout(() => { ls.style.opacity='1'; ls.style.transform='none'; }, 10);
    cargarUsuariosLogin();
  }, 300);
}

function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  document.getElementById('theme-icon').textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('lm_theme', dark ? 'dark' : 'light');
}

function shakeLogin() {
  const card = document.querySelector('.login-card');
  const seq = [8,-8,6,-6,4,-4,0]; let i=0;
  const t = setInterval(() => { card.style.transform=`translateX(${seq[i]}px)`; i++; if(i>=seq.length) clearInterval(t); }, 60);
}

// ════════════════════ UTILS ════════════════════
function hoy() { return new Date().toISOString().split('T')[0]; }
function formatFecha(f) {
  if(!f) return '—';
  const d = new Date(f+'T12:00:00');
  return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
}
function calcEdad(fn) {
  if(!fn) return '—';
  const h=new Date(), n=new Date(fn); let e=h.getFullYear()-n.getFullYear();
  if(h.getMonth()<n.getMonth()||(h.getMonth()===n.getMonth()&&h.getDate()<n.getDate()))e--;
  return e+' años';
}
function ini(a,b){ return ((a||'')[0]||'').toUpperCase()+((b||'')[0]||'').toUpperCase(); }
function colAvatar(id) { const c=['#2563EB','#06B6D4','#10B981','#F59E0B','#8B5CF6','#EF4444','#0891B2','#4F46E5']; return c[id%c.length]; }
function estadoTag(e) {
  const m={activo:'tag-green',inactivo:'tag-gray',pendiente:'tag-orange',confirmada:'tag-cyan',completada:'tag-green',cancelada:'tag-red',activa:'tag-green',finalizada:'tag-gray',suspendida:'tag-red'};
  return `<span class="tag ${m[e]||'tag-gray'}">${e}</span>`;
}
function toast(msg, type='success') {
  const icons = {success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="t-icon">${icons[type]||'ℹ️'}</span><span class="t-msg">${msg}</span><button class="t-close" onclick="this.closest('.toast').remove()">✕</button><div class="t-bar"></div>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

let _confirmResolve = null;
function customConfirm({icon='⚠️', title, msg, okText='Confirmar', cancelText='Cancelar', danger=true}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('mc-icon').textContent   = icon;
    document.getElementById('mc-title').textContent  = title;
    document.getElementById('mc-msg').innerHTML      = msg;
    document.getElementById('mc-cancel').textContent = cancelText;
    const ok = document.getElementById('mc-ok');
    ok.textContent = okText;
    ok.className   = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    document.getElementById('modal-confirm').classList.add('open');
  });
}
function _confirmOk()     { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) { _confirmResolve(true);  _confirmResolve=null; } }
function _confirmCancel() { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) { _confirmResolve(false); _confirmResolve=null; } }

// ════════════════════ NAVIGATION ════════════════════
let currentView='dashboard', editingId=null, currentPatientId=null, selCalDate=hoy(), currentResumenCitaId=null, currentNotaId=null;

async function navigate(view, patientId) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
  const el=document.getElementById('view-'+(view==='paciente-detalle'?'paciente-detalle':view));
  if(el) el.classList.add('active');
  const mi=document.querySelector(`.menu-item[onclick*="'${view}'"]`);
  if(mi) mi.classList.add('active');
  const titles={dashboard:'Dashboard',pacientes:'Pacientes',citas:'Citas',agendas:'Agendas',medicaciones:'Medicaciones',notas:'Notas Clínicas',atendidos:'Atendidos por Día',estadisticas:'Estadísticas',configuracion:'Configuración Clínica',exportar:'Exportar / Enviar','paciente-detalle':'Expediente del Paciente',admin:'Administración',inventario:'Inventario'};
  document.getElementById('page-title').textContent = titles[view]||view;
  currentView=view;
  if(patientId) currentPatientId=patientId;
  if(view==='admin'){
    if(!isSuperAdmin()){navigate('dashboard');return;}
    await loadAdminData();
    switchAdminTab(adminTab||'clinicas');
    if(window.innerWidth<=768) closeSidebar();
    return;
  }
  if(view==='configuracion' && !isSuperAdmin()){navigate('dashboard');return;}
  await loadAll();
  renderView(view);
  if(window.innerWidth<=768) closeSidebar();
}

function renderView(v) {
  switch(v){
    case 'dashboard': renderDashboard(); break;
    case 'pacientes': renderPacientes(); break;
    case 'citas': renderCitas(); break;
    case 'agendas': renderAgendas(); break;
    case 'medicaciones': renderMedicaciones(); break;
    case 'notas': renderNotas(); break;
    case 'atendidos': renderAtendidos(); break;
    case 'estadisticas': renderEstadisticas(); break;
    case 'configuracion': renderConfiguracion(); break;
    case 'exportar': renderExportar(); break;
    case 'inventario': renderInventario(); break;
    case 'paciente-detalle': renderDetalleP(currentPatientId); break;
  }
  updateBadges();
}

function updateBadges() {
  const h=hoy();
  const citasHoy=C.c.filter(x=>x.fecha===h&&x.estado!=='cancelada').length;
  document.getElementById('badge-pacientes').textContent = C.p.length;
  document.getElementById('badge-citas').textContent = citasHoy;
  const bnBadge=document.getElementById('bn-badge-citas');
  if(bnBadge){ bnBadge.textContent=citasHoy; bnBadge.style.display=citasHoy>0?'block':'none'; }
  updateBottomNav(currentView);
}

// ════════════════════ CALENDARIO ════════════════════
function renderCalendar(containerId, interactive) {
  const d=new Date(selCalDate+'T12:00:00'), year=d.getFullYear(), month=d.getMonth();
  const citaCount={};
  C.c.forEach(c=>{ citaCount[c.fecha]=(citaCount[c.fecha]||0)+1; });
  const today2=hoy();
  const first=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate();
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dow=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html=`<div class="cal-nav">
    <div class="cal-nav-btns">
      <button class="btn-ghost" onclick="calNav(-1,'${containerId}',${interactive?1:0})">‹</button>
      <button class="btn-ghost" onclick="calNav(0,'${containerId}',${interactive?1:0})" style="font-size:11px;padding:5px 8px">Hoy</button>
      <button class="btn-ghost" onclick="calNav(1,'${containerId}',${interactive?1:0})">›</button>
    </div>
    <h4>${months[month]} <span style="color:var(--text-light);font-weight:500">${year}</span></h4>
  </div>
  <div class="cal-grid">`;
  dow.forEach((dw,i)=>html+=`<div class="cal-dow${i===0||i===6?' weekend-dow':''}">${dw}</div>`);
  for(let i=0;i<first;i++) html+=`<div class="cal-day empty"></div>`;
  for(let i=1;i<=days;i++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dow2=new Date(ds+'T12:00:00').getDay();
    const isToday=ds===today2, isSelected=ds===selCalDate&&!isToday;
    const cnt=citaCount[ds]||0;
    const isWeekend=dow2===0||dow2===6;
    const cls=['cal-day',isToday?'today':isSelected?'selected':'',cnt?'has-event':'',isWeekend&&!isToday&&!isSelected?'weekend':''].filter(Boolean).join(' ');
    const click=interactive?`onclick="selectCalDay('${ds}','${containerId}')"`:'' ;
    const dots=cnt?`<div class="cal-dots">${Array.from({length:Math.min(cnt,3)},()=>`<div class="cal-dot-pip"></div>`).join('')}</div>`:`<div style="height:5px"></div>`;
    html+=`<div class="${cls}" ${click} title="${cnt?cnt+' cita'+(cnt>1?'s':''):''}"><span>${i}</span>${dots}</div>`;
  }
  html+='</div>';
  const el=document.getElementById(containerId);
  if(el) el.innerHTML=html;
}

function calNav(dir,c,inter){
  const d=new Date(selCalDate+'T12:00:00');
  if(dir===0) selCalDate=hoy();
  else d.setMonth(d.getMonth()+dir), selCalDate=d.toISOString().split('T')[0];
  renderCalendar(c,inter);
  if(inter) renderCalDayCitas(selCalDate);
}

function selectCalDay(date,container){
  selCalDate=date;
  renderCalendar(container,true);
  if(container==='citas-cal') renderCalDayCitas(date);
}

function renderCalDayCitas(date){
  const citas=C.c.filter(c=>c.fecha===date).sort((a,b)=>a.hora.localeCompare(b.hora));
  const el=document.getElementById('cal-day-citas');
  if(!el) return;
  if(!citas.length){ el.innerHTML=`<p class="text-light" style="text-align:center;padding:12px">Sin citas el ${formatFecha(date)}</p>`; return; }
  el.innerHTML=`<p style="font-size:11px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${formatFecha(date)}</p>`+
    citas.map(c=>{ const p=C.p.find(x=>x.id===c.pacienteId); return `<div class="cita-item ${c.estado}">
      <div class="cita-time">${c.hora}</div>
      <div class="cita-info"><div class="cita-paciente">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div><div class="cita-motivo">${c.motivo}</div></div>
      ${estadoTag(c.estado)}</div>`; }).join('');
}

// ════════════════════ DASHBOARD ════════════════════
function renderDashboard(){
  renderPendientesSesion();
  const h=hoy();
  const pendientes=C.c.filter(c=>c.estado==='pendiente');
  document.getElementById('stat-pacientes').textContent=C.p.length;
  document.getElementById('stat-citas-hoy').textContent=C.c.filter(c=>c.fecha===h).length;
  document.getElementById('stat-pendientes').textContent=pendientes.length;
  const tEl=document.getElementById('stat-pendientes-trend');
  if(tEl) tEl.innerHTML=pendientes.length>0?`⚠️ ${pendientes.length} por confirmar`:'✅ Sin pendientes';
  if(tEl) tEl.className='stat-trend '+(pendientes.length>0?'warn':'ok');
  document.getElementById('stat-meds').textContent=C.m.filter(x=>x.estado==='activa').length;

  const citasHoy=C.c.filter(c=>c.fecha===h).sort((a,b)=>a.hora.localeCompare(b.hora));
  document.getElementById('agenda-hoy').innerHTML=citasHoy.length?citasHoy.map(c=>{
    const p=C.p.find(x=>x.id===c.pacienteId);
    const edad=p?calcEdad(p.fechaNac):'';
    return `<div class="dia-item" onclick="navigate('paciente-detalle',${c.pacienteId})">
      <div class="dia-time">${c.hora}</div>
      <div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:36px;height:36px;font-size:12px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div class="dia-info">
        <div class="dia-name">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div class="dia-sub">${c.motivo}${edad?' · '+edad:''}</div>
      </div>
      ${estadoTag(c.estado)}
      ${c.estado!=='completada'&&c.estado!=='cancelada'?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;flex-shrink:0" onclick="event.stopPropagation();marcarCitaCompletada(${c.id})" title="Marcar que acudió">✅</button>`:''}
      </div>`;
  }).join(''):`<div class="empty-state" style="padding:28px 0"><div class="empty-icon" style="font-size:32px">📅</div><p>Sin citas para hoy</p></div>`;

  renderCalendar('dashboard-cal',false);

  switchRecTab('pacientes');
}

let recTab = 'pacientes';
function switchRecTab(tab) {
  recTab = tab;
  ['pacientes','citas','meds','inv'].forEach(t => {
    const el = document.getElementById('tab-rec-'+t);
    if(el) el.classList.toggle('active', t===tab);
  });
  renderRecientes();
}

function renderRecientes() {
  const el = document.getElementById('recientes-content'); if(!el) return;
  const empty = msg => `<div class="empty-state" style="padding:24px 0"><div class="empty-icon" style="font-size:28px">${msg}</div></div>`;

  if(recTab === 'pacientes') {
    const items = [...C.p].reverse().slice(0,10);
    el.innerHTML = items.length ? items.map(p=>`
      <div class="search-result-item" onclick="navigate('paciente-detalle',${p.id})">
        <div class="patient-avatar" style="background:${colAvatar(p.id)};flex-shrink:0">${ini(p.nombre,p.apellidos)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre} ${p.apellidos}</div>
          <div class="text-light">${formatFecha(p.fechaRegistro)} · ${p.telefono||'Sin tel.'}</div>
        </div>
        <span class="tag ${p.estado==='activo'?'tag-green':'tag-gray'}" style="flex-shrink:0">${p.estado}</span>
      </div>`).join('') : empty('👥<br><small>Sin pacientes aún</small>');

  } else if(recTab === 'citas') {
    const items = [...C.c].sort((a,b)=>b.fecha.localeCompare(a.fecha)||(b.id-a.id)).slice(0,10);
    el.innerHTML = items.length ? items.map(c=>{
      const p=C.p.find(x=>x.id===c.pacienteId);
      return `<div class="search-result-item" style="cursor:default">
        <div style="min-width:70px;font-size:12px;font-weight:700;color:var(--primary)">${formatHora12(c.hora)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'—'}</div>
          <div class="text-light">${formatFecha(c.fecha)} · ${c.motivo}</div>
        </div>
        ${estadoTag(c.estado)}
      </div>`;}).join('') : empty('📅<br><small>Sin citas aún</small>');

  } else if(recTab === 'meds') {
    const items = [...C.m].reverse().slice(0,10);
    el.innerHTML = items.length ? items.map(m=>{
      const p=C.p.find(x=>x.id===m.pacienteId);
      return `<div class="search-result-item" style="cursor:default">
        <div style="font-size:22px;flex-shrink:0">💊</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${m.nombre}</div>
          <div class="text-light">${p?p.nombre+' '+p.apellidos:'—'} · ${m.dosis} ${m.frecuencia}</div>
        </div>
        <span class="tag ${m.estado==='activa'?'tag-green':m.estado==='suspendida'?'tag-red':'tag-gray'}" style="flex-shrink:0">${m.estado}</span>
      </div>`;}).join('') : empty('💊<br><small>Sin medicaciones aún</small>');

  } else {
    const items = [...C.mov].slice(0,10);
    el.innerHTML = items.length ? items.map(m=>{
      const p=C.inv.find(x=>x.id===m.invId);
      return `<div class="search-result-item" style="cursor:default">
        <span class="inv-badge-${m.tipo}" style="flex-shrink:0">${m.tipo==='entrada'?'📥':'📤'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre:'—'}</div>
          <div class="text-light">${formatFecha(m.fecha)} · Cant: ${m.cantidad} ${p?p.unidad:''}</div>
        </div>
        <span style="font-size:12px;color:var(--text-light);flex-shrink:0">${m.motivo||''}</span>
      </div>`;}).join('') : empty('📦<br><small>Sin movimientos aún</small>');
  }
}

// ════════════════════ NÚMERO DE EXPEDIENTE ════════════════════
function getExpedienteNum(pid) {
  const codigo = (currentClinica?.codigo || currentClinica?.nombre || 'EXP').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const initials = codigo.slice(0, 4);
  const year = new Date().getFullYear();
  const sorted = [...C.p].sort((a,b) => a.id - b.id);
  const idx = sorted.findIndex(p => p.id === pid);
  const num = idx >= 0 ? idx + 1 : C.p.length + 1;
  return initials + year + '-' + String(num).padStart(3, '0');
}

// ════════════════════ PACIENTES ════════════════════
function renderPacientes(){
  const search=document.getElementById('pacientes-search');
  if(search) search.value='';
  filtroEstado='todos';
  document.querySelectorAll('.filter-chips .chip').forEach((c,i)=>c.classList.toggle('active',i===0));
  const countEl=document.getElementById('pacientes-count');
  if(countEl) countEl.textContent=`${C.p.length} pacientes`;
  renderPacientesList(C.p);
}

function renderPacientesList(lista){
  const tbody=document.getElementById('tabla-pacientes'), empty=document.getElementById('pacientes-empty');
  if(!lista.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  tbody.innerHTML=lista.map(x=>`<tr>
    <td><div class="patient-name-cell">${x.fotoUrl?`<img src="${x.fotoUrl}" style="width:34px;height:34px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--border)" alt="foto">`:`<div class="patient-avatar" style="background:${colAvatar(x.id)}">${ini(x.nombre,x.apellidos)}</div>`}
    <div><div style="font-weight:600">${x.nombre} ${x.apellidos}</div><div class="text-light">${calcEdad(x.fechaNac)}</div></div></div></td>
    <td><code style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700">${getExpedienteNum(x.id)}</code></td>
    <td>${x.identificacion||'—'}</td><td>${formatFecha(x.fechaNac)}</td><td>${x.telefono||'—'}</td>
    <td>${estadoTag(x.estado||'activo')}</td>
    <td><div class="actions-cell">
      <button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;white-space:nowrap" onclick="registrarAcudidoPaciente(${x.id})">✅ Acudió</button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('paciente-detalle',${x.id})">👁️</button>
      <button class="btn btn-secondary btn-sm" onclick="openModalPaciente(${x.id})">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="eliminarPaciente(${x.id})">🗑️</button>
    </div></td></tr>`).join('');
}

function openModalPaciente(id){
  editingId=id||null;
  document.getElementById('modal-paciente-title').textContent=id?'✏️ Editar Paciente':'👤 Nuevo Paciente';
  ['nombre','apellidos','id','fechanac','sexo','sangre','telefono','email','direccion','alergias','estado','emergencia','observaciones'].forEach(f=>{ const e=document.getElementById('p-'+f); if(e) e.value=''; });
  const idTipoEl = document.getElementById('p-id-tipo'); if(idTipoEl) idTipoEl.value = 'Cédula';
  pendingFotoFile=null; currentFotoUrl=null;
  document.getElementById('foto-img-preview').style.display='none';
  document.getElementById('foto-img-preview').src='';
  document.getElementById('foto-placeholder').style.display='block';
  document.getElementById('btn-quitar-foto').style.display='none';
  document.getElementById('p-foto').value='';
  if(id){
    const x=C.p.find(p=>p.id===id);
    if(x){
      document.getElementById('p-nombre').value=x.nombre||'';
      document.getElementById('p-apellidos').value=x.apellidos||'';
      const idStr = x.identificacion||'';
      const idMatch = idStr.match(/^(Cédula|Pasaporte|Licencia de conducir):\s*(.*)$/);
      if(idMatch){ document.getElementById('p-id-tipo').value=idMatch[1]; document.getElementById('p-id').value=idMatch[2]; }
      else { document.getElementById('p-id-tipo').value='Cédula'; document.getElementById('p-id').value=idStr; }
      document.getElementById('p-fechanac').value=x.fechaNac||'';
      document.getElementById('p-sexo').value=x.sexo||'';
      document.getElementById('p-sangre').value=x.sangre||'';
      document.getElementById('p-telefono').value=x.telefono||'';
      document.getElementById('p-email').value=x.email||'';
      document.getElementById('p-direccion').value=x.direccion||'';
      document.getElementById('p-alergias').value=x.alergias||'';
      document.getElementById('p-estado').value=x.estado||'activo';
      document.getElementById('p-emergencia').value=x.emergencia||'';
      document.getElementById('p-observaciones').value=x.observaciones||'';
      if(x.fotoUrl){ currentFotoUrl=x.fotoUrl; document.getElementById('foto-placeholder').style.display='none'; document.getElementById('foto-img-preview').src=x.fotoUrl; document.getElementById('foto-img-preview').style.display='block'; document.getElementById('btn-quitar-foto').style.display='block'; }
    }
  }
  document.getElementById('modal-paciente').classList.add('open');
}

async function guardarPaciente(irExpediente=false, irCita=false){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const nombre=document.getElementById('p-nombre').value.trim();
  const apellidos=document.getElementById('p-apellidos').value.trim();
  if(!nombre||!apellidos){ toast('Nombre y apellidos son obligatorios','error'); return; }
  const idTipo  = document.getElementById('p-id-tipo')?.value || 'Cédula';
  const idValor = document.getElementById('p-id').value.trim();
  const identificacion = idValor ? idTipo + ': ' + idValor : '';
  const obj={nombre,apellidos,identificacion,fechaNac:document.getElementById('p-fechanac').value,sexo:document.getElementById('p-sexo').value,sangre:document.getElementById('p-sangre').value,telefono:document.getElementById('p-telefono').value.trim(),email:document.getElementById('p-email').value.trim(),direccion:document.getElementById('p-direccion').value.trim(),alergias:document.getElementById('p-alergias').value.trim(),estado:document.getElementById('p-estado').value,emergencia:document.getElementById('p-emergencia').value.trim(),observaciones:document.getElementById('p-observaciones').value.trim(),fechaRegistro:hoy(),fotoUrl:currentFotoUrl};
  setLoading(true);
  let err, savedId=editingId;
  if(editingId){ const r=await sb.from('pacientes').update(toP(obj)).eq('id',editingId); err=r.error; }
  else { const r=await sb.from('pacientes').insert([toP(obj)]).select('id').single(); err=r.error; if(!err) savedId=r.data.id; }
  if(err){ setLoading(false); toast('Error: '+err.message,'error'); return; }
  if(pendingFotoFile && savedId){
    try{ const url=await subirFotoPaciente(pendingFotoFile,savedId); await sb.from('pacientes').update({foto_url:url}).eq('id',savedId); pendingFotoFile=null; }
    catch(e){ toast('Paciente guardado, error con la foto: '+e.message,'info'); }
  }
  setLoading(false);
  toast(editingId?'Paciente actualizado':'Paciente registrado ✅');
  if(!editingId) logActivity('paciente');
  const btnCitar = document.getElementById('btn-guardar-y-citar');
  if(btnCitar) btnCitar.style.display = 'none';
  closeModal('modal-paciente');
  await loadAll(); renderPacientes(); updateBadges();
  if((!editingId && (irCita || pendingCitaAfterPaciente)) && savedId) {
    pendingCitaAfterPaciente = false;
    setTimeout(() => { openModalCita(); setPacienteSelect('c-paciente', savedId); }, 300);
    return;
  }
  if(irExpediente && savedId) navigate('paciente-detalle', savedId);
}

async function eliminarPaciente(id){
  const x=C.p.find(p=>p.id===id);
  const ok=await customConfirm({icon:'🗑️',title:'Eliminar paciente',msg:`¿Eliminar a <strong>${x.nombre} ${x.apellidos}</strong>?<br><br>También se eliminarán sus citas, medicaciones y notas.`,okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('pacientes').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Paciente eliminado');
  await loadAll(); renderPacientes(); updateBadges();
}

// ════════════════════ DETALLE PACIENTE ════════════════════
function renderDetalleP(pid){
  const p=C.p.find(x=>x.id===pid);
  if(!p){ navigate('pacientes'); return; }
  const citas=C.c.filter(c=>c.pacienteId===pid);
  const meds=C.m.filter(m=>m.pacienteId===pid);
  const notas=C.n.filter(n=>n.pacienteId===pid);

  document.getElementById('detalle-header').innerHTML=`
    <div class="patient-detail-header">
      ${p.fotoUrl?`<img src="${p.fotoUrl}" class="patient-detail-avatar" style="object-fit:cover;border:3px solid rgba(255,255,255,.4)" alt="foto">`:`<div class="patient-detail-avatar" style="background:${colAvatar(p.id)}">${ini(p.nombre,p.apellidos)}</div>`}
      <div class="patient-detail-info">
        <h2>${p.nombre} ${p.apellidos}</h2>
        <div style="margin-bottom:6px"><code style="background:rgba(255,255,255,.2);color:#fff;padding:2px 10px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:.5px">Exp. ${getExpedienteNum(p.id)}</code></div>
        <div class="meta">
          <span>🎂 ${calcEdad(p.fechaNac)}</span>
          ${p.sexo?`<span>${p.sexo==='M'?'♂ Masculino':p.sexo==='F'?'♀ Femenino':p.sexo}</span>`:''}
          ${p.sangre?`<span>🩸 ${p.sangre}</span>`:''}
          ${p.telefono?`<span>📞 ${p.telefono}</span>`:''}
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff" onclick="registrarAcudidoPaciente(${p.id})">✅ Paciente acudió</button>
        <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="openModalPaciente(${p.id})">✏️ Editar</button>
      </div>
    </div>`;

  document.getElementById('tab-info').innerHTML=`
    <div class="grid-2">
      <div class="card"><h3 style="margin-bottom:14px;font-size:14px">📋 Datos Personales</h3>
        <table style="width:100%">${[['N° Expediente',`<code style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">${getExpedienteNum(p.id)}</code>`],['Identificación',p.identificacion||'—'],['Fecha Nacimiento',formatFecha(p.fechaNac)],['Dirección',p.direccion||'—'],['Emergencia',p.emergencia||'—'],['Registro',formatFecha(p.fechaRegistro)]].map(([k,v])=>`<tr><td class="text-light" style="padding:6px 0;width:140px">${k}</td><td style="padding:6px 0;font-weight:600;font-size:13px">${v}</td></tr>`).join('')}</table>
      </div>
      <div class="card"><h3 style="margin-bottom:14px;font-size:14px">🏥 Datos Clínicos</h3>
        <p class="text-light" style="margin-bottom:8px">Alergias: <strong style="color:var(--text)">${p.alergias||'Ninguna conocida'}</strong></p>
        <p class="text-light" style="margin-bottom:8px">Tipo de Sangre: <strong style="color:var(--text)">${p.sangre||'Desconocido'}</strong></p>
        <p class="text-light">Estado: ${estadoTag(p.estado||'activo')}</p>
        ${p.observaciones?`<div class="mt-16"><p class="text-light" style="margin-bottom:6px">Observaciones:</p><div style="font-size:13px;line-height:1.7;background:var(--bg);padding:10px 12px;border-radius:8px">${p.observaciones}</div></div>`:''}
      </div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card"><div class="card-header"><h3>📅 Citas</h3><button class="btn btn-primary btn-sm" onclick="openModalCitaP(${p.id})">+ Cita</button></div>
        <p class="text-light">Total: <strong>${citas.length}</strong> · Pendientes: <strong>${citas.filter(c=>c.estado==='pendiente').length}</strong></p></div>
      <div class="card"><div class="card-header"><h3>💊 Medicaciones</h3><button class="btn btn-primary btn-sm" onclick="openModalMedP(${p.id})">+ Medicación</button></div>
        <p class="text-light">Total: <strong>${meds.length}</strong> · Activas: <strong>${meds.filter(m=>m.estado==='activa').length}</strong></p></div>
    </div>`;

  document.getElementById('tab-citas-p').innerHTML=`<div class="card">
    <div class="card-header"><h3>📅 Citas</h3><button class="btn btn-primary btn-sm" onclick="openModalCitaP(${p.id})">+ Nueva</button></div>
    ${citas.length?`<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Hora</th><th>Motivo</th><th>Tipo</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${citas.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(c=>`<tr><td>${formatFecha(c.fecha)}</td><td>${c.hora}</td><td>${c.motivo}</td><td><span class="tag tag-cyan">${c.tipo}</span></td><td>${estadoTag(c.estado)}</td><td><div class="actions-cell">${c.estado!=='completada'&&c.estado!=='cancelada'?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;white-space:nowrap" onclick="marcarCitaCompletada(${c.id})">✅ Acudió</button>`:''}<button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})" title="Ver hoja">📄</button><button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button></div></td></tr>`).join('')}</tbody></table></div>`:'<div class="empty-state"><div class="empty-icon">📅</div><p>Sin citas</p></div>'}
  </div>`;

  document.getElementById('tab-meds-p').innerHTML=`<div class="card">
    <div class="card-header"><h3>💊 Medicaciones</h3><div style="display:flex;gap:8px">${meds.length?`<button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirRecetaPaciente(${p.id})">🖨️ Receta</button>`:''}<button class="btn btn-primary btn-sm" onclick="openModalMedP(${p.id})">+ Nueva</button></div></div>
    ${meds.length?meds.map(m=>`<div class="med-item"><span style="font-size:22px">💊</span><div class="med-info" style="flex:1"><h4>${m.nombre}</h4><div class="med-dosis">${m.dosis} — ${m.frecuencia} (${m.via})</div><p>${m.inicio?`Del ${formatFecha(m.inicio)} al ${m.fin?formatFecha(m.fin):'indefinido'}`:''}${m.indicaciones?' · '+m.indicaciones:''}</p></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">${estadoTag(m.estado)}<div class="actions-cell"><button class="btn btn-secondary btn-sm" onclick="openModalMedicacion(${m.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="eliminarMedicacion(${m.id})">🗑️</button></div></div></div>`).join(''):'<div class="empty-state"><div class="empty-icon">💊</div><p>Sin medicaciones</p></div>'}
  </div>`;

  document.getElementById('tab-notas-p').innerHTML=`<div class="card">
    <div class="card-header"><h3>📝 Notas Clínicas</h3><button class="btn btn-primary btn-sm" onclick="openModalNotaP(${p.id})">+ Nueva</button></div>
    ${notas.length?`<div class="timeline">${notas.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(n=>`<div class="timeline-item"><div class="timeline-date">${formatFecha(n.fecha)} · <span class="tag tag-blue" style="font-size:10px">${n.tipo}</span></div><div class="timeline-content">${n.titulo?`<strong style="display:block;margin-bottom:5px">${n.titulo}</strong>`:''}<p style="white-space:pre-wrap;line-height:1.7">${n.contenido}</p><div style="margin-top:8px;display:flex;gap:6px"><button class="btn btn-secondary btn-sm" onclick="verNota(${n.id})">👁️ Ver</button><button class="btn btn-secondary btn-sm" onclick="openModalNota(${n.id})">✏️ Editar</button><button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirNota(${n.id})">🖨️</button><button class="btn btn-danger btn-sm" onclick="eliminarNota(${n.id})">🗑️</button></div></div></div>`).join('')}</div>`:'<div class="empty-state"><div class="empty-icon">📝</div><p>Sin notas</p></div>'}
  </div>`;

  const exp=C.e.find(x=>x.pacienteId===pid)||{};
  const imc=(exp.peso&&exp.talla)?(exp.peso/((exp.talla/100)**2)).toFixed(1):null;
  document.getElementById('tab-expediente').innerHTML=`
  <div class="card">
    <div class="card-header"><h3>📁 Expediente Médico</h3>
      <div style="display:flex;gap:8px">
        ${(currentClinica?.tipo==='optica'||isSuperAdmin())?`<button class="btn btn-secondary btn-sm" onclick="abrirExamenVisual(${pid})">👁️ Examen Visual</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="guardarExpediente(${pid})">💾 Guardar</button>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">⚡ Signos Vitales</div>
      <div class="vitales-grid">
        <div class="vital-card"><div class="v-val">${exp.peso||'—'}</div><div class="v-lbl">Peso kg</div></div>
        <div class="vital-card"><div class="v-val">${exp.talla||'—'}</div><div class="v-lbl">Talla cm</div></div>
        <div class="vital-card"><div class="v-val">${exp.presion||'—'}</div><div class="v-lbl">Presión</div></div>
        <div class="vital-card"><div class="v-val">${exp.temperatura?exp.temperatura+'°':'—'}</div><div class="v-lbl">Temp.</div></div>
        ${imc?`<div class="vital-card"><div class="v-val">${imc}</div><div class="v-lbl">IMC</div></div>`:''}
      </div>
      <div class="form-grid" style="margin-top:12px">
        <div class="form-group"><label>Peso (kg)</label><input type="number" id="exp-peso" value="${exp.peso||''}" placeholder="70.0" step="0.1"></div>
        <div class="form-group"><label>Talla (cm)</label><input type="number" id="exp-talla" value="${exp.talla||''}" placeholder="170"></div>
        <div class="form-group"><label>Presión Arterial</label><input type="text" id="exp-presion" value="${exp.presion||''}" placeholder="120/80 mmHg"></div>
        <div class="form-group"><label>Temperatura (°C)</label><input type="number" id="exp-temperatura" value="${exp.temperatura||''}" placeholder="36.5" step="0.1"></div>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">👤 Datos Socioeconómicos</div>
      <div class="form-grid">
        <div class="form-group"><label>Ocupación</label><input type="text" id="exp-ocupacion" value="${exp.ocupacion||''}" placeholder="Empleado, estudiante..."></div>
        <div class="form-group"><label>Estado Civil</label><select id="exp-estadoCivil">
          <option value="">—</option>
          ${['soltero','casado','divorciado','viudo','union libre'].map(v=>`<option value="${v}" ${exp.estadoCivil===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Hábito: Tabaco</label><select id="exp-tabaco">
          ${[['no','No fuma'],['ex','Ex fumador'],['ocasional','Ocasional'],['diario','Diario']].map(([v,l])=>`<option value="${v}" ${exp.tabaco===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Hábito: Alcohol</label><select id="exp-alcohol">
          ${[['no','No consume'],['ocasional','Ocasional'],['frecuente','Frecuente']].map(([v,l])=>`<option value="${v}" ${exp.alcohol===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-group full"><label>Actividad Física</label><select id="exp-actividadFisica">
          ${[['sedentario','Sedentario'],['leve','Leve (1-2 días/semana)'],['moderada','Moderada (3-4 días)'],['intensa','Intensa (5+ días)']].map(([v,l])=>`<option value="${v}" ${exp.actividadFisica===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">🏥 Antecedentes Clínicos</div>
      <div class="form-grid cols-1">
        <div class="form-group"><label>Enfermedades Crónicas</label><textarea id="exp-enfermedadesCronicas" placeholder="Hipertensión, diabetes tipo 2, asma...">${exp.enfermedadesCronicas||''}</textarea></div>
        <div class="form-group"><label>Cirugías Previas</label><textarea id="exp-cirugias" placeholder="Apendicectomía 2018, cesárea...">${exp.cirugias||''}</textarea></div>
        <div class="form-group"><label>Antecedentes Familiares</label><textarea id="exp-antecedentesFamiliares" placeholder="Padre: HTA, diabetes. Madre: cáncer...">${exp.antecedentesFamiliares||''}</textarea></div>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">💉 Alergias y Vacunas</div>
      <div class="form-grid cols-1">
        <div class="form-group"><label>Alergias conocidas (del perfil del paciente)</label>
          <div style="padding:10px 14px;background:${p.alergias?'#FEF2F2':'var(--bg)'};border:1.5px solid ${p.alergias?'#FECACA':'var(--border)'};border-radius:10px;font-size:13px;color:${p.alergias?'#DC2626':'var(--text-light)'}">
            ${p.alergias?'⚠️ '+p.alergias:'Sin alergias registradas — edita el perfil del paciente para agregar'}
          </div>
        </div>
        <div class="form-group"><label>Esquema de Vacunas</label><textarea id="exp-vacunas" placeholder="COVID-19 ✓, Influenza ✓, Hepatitis B ✓...">${exp.vacunas||''}</textarea></div>
        <div class="form-group"><label>Observaciones Médicas Adicionales</label><textarea id="exp-observacionesMedicas" placeholder="Notas del médico sobre el expediente...">${exp.observacionesMedicas||''}</textarea></div>
      </div>
    </div>
  </div>`;
}

function switchTab(tabId, btn){
  ['tab-info','tab-citas-p','tab-meds-p','tab-notas-p','tab-expediente'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(tabId).style.display='block';
  if(btn) btn.classList.add('active');
}

// ════════════════════ CITAS ════════════════════
function citaBuscarPac(q) {
  const sug = document.getElementById('cita-pac-sug');
  if(!sug) return;
  const q2 = (q||'').toLowerCase().trim();
  const matches = q2.length < 1
    ? C.p.slice(0, 12)
    : C.p.filter(p =>
        (p.nombre+' '+p.apellidos).toLowerCase().includes(q2) ||
        (p.identificacion||'').toLowerCase().includes(q2) ||
        getExpedienteNum(p.id).toLowerCase().includes(q2)
      ).slice(0, 10);
  if(!matches.length) {
    sug.innerHTML =
      '<div style="padding:8px 14px;font-size:12px;color:var(--text-light);border-bottom:1px solid var(--border)">Sin resultados para "'+q+'"</div>'
      + '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;background:var(--primary-light);border-radius:0 0 10px 10px" onmousedown="nuevoPacienteParaCita(\''+q.replace(/'/g,"\\'")+'\')">'
      + '<span style="font-size:20px;flex-shrink:0">➕</span>'
      + '<div><div style="font-size:13px;font-weight:700;color:var(--primary)">Registrar como nuevo paciente</div>'
      + '<div style="font-size:11px;color:var(--primary);opacity:.8">Crea el expediente y abre la cita automáticamente</div></div></div>';
    sug.style.display = 'block';
    return;
  }
  sug.innerHTML = matches.map(p =>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseenter="this.style.background=\'var(--primary-light)\'" onmouseleave="this.style.background=\'\'" onmousedown="abrirCitaDesdeVista('+p.id+',\''+((p.nombre+' '+p.apellidos).replace(/'/g,"\\'"))+'\')">'
    + '<div style="width:32px;height:32px;border-radius:50%;background:'+colAvatar(p.id)+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">'+ini(p.nombre,p.apellidos)+'</div>'
    + '<div style="flex:1;min-width:0">'
    +   '<div style="font-size:13px;font-weight:600;color:var(--text)">'+p.nombre+' '+p.apellidos+'</div>'
    +   '<div style="font-size:11px;color:var(--text-light)"><span style="color:var(--primary);font-weight:600">'+getExpedienteNum(p.id)+'</span>'+(p.identificacion?' · '+p.identificacion:'')+(p.telefono?' · '+p.telefono:'')+'</div>'
    + '</div>'
    + '<span style="font-size:11px;font-weight:700;color:var(--primary);background:var(--primary-light);padding:2px 10px;border-radius:20px;flex-shrink:0;white-space:nowrap">+ Citar</span>'
    + '</div>'
  ).join('');
  sug.style.display = 'block';
}

function abrirCitaDesdeVista(pid, nombre) {
  const input = document.getElementById('cita-pac-buscar');
  if(input) input.value = '';
  const sug = document.getElementById('cita-pac-sug');
  if(sug) sug.style.display = 'none';
  openModalCita();
  setTimeout(() => setPacienteSelect('c-paciente', pid), 50);
}

function filtrarTablaCitas(q) {
  const q2 = (q||'').toLowerCase();
  const rows = document.querySelectorAll('#tabla-citas tr');
  rows.forEach(row => {
    const txt = row.textContent.toLowerCase();
    row.style.display = (!q2 || txt.includes(q2)) ? '' : 'none';
  });
}

function renderCitas(){
  const h=hoy(), citasHoy=C.c.filter(c=>c.fecha===h).sort((a,b)=>a.hora.localeCompare(b.hora));
  document.getElementById('lista-citas-hoy').innerHTML=citasHoy.length?citasHoy.map(c=>{
    const p=C.p.find(x=>x.id===c.pacienteId);
    return `<div class="cita-item ${c.estado}">
      <div class="cita-time">${c.hora}</div>
      <div class="cita-info"><div class="cita-paciente">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div><div class="cita-motivo">${c.motivo}</div></div>
      ${estadoTag(c.estado)}
      <div class="actions-cell" style="margin-left:6px">
        <button class="btn btn-sm" style="background:var(--primary);color:#fff;font-size:16px;font-weight:700;padding:3px 10px;line-height:1" onclick="openModalCitaP(${c.pacienteId})" title="Nueva cita para este paciente">+</button>
        ${c.estado!=='completada'&&c.estado!=='cancelada'?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;white-space:nowrap" onclick="marcarCitaCompletada(${c.id})">✅</button>`:''}
        <button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button>
      </div></div>`;
  }).join(''):`<div class="empty-state" style="padding:20px"><div class="empty-icon" style="font-size:30px">📅</div><p>Sin citas hoy</p></div>`;

  renderCalendar('citas-cal',true);
  renderCalDayCitas(selCalDate);

  const tbody=document.getElementById('tabla-citas'), empty=document.getElementById('citas-empty');
  if(!C.c.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  tbody.innerHTML=[...C.c].sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.hora.localeCompare(b.hora)).map(c=>{
    const p=C.p.find(x=>x.id===c.pacienteId);
    return `<tr><td>${formatFecha(c.fecha)}</td><td>${c.hora}</td>
      <td><div class="patient-name-cell"><div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:28px;height:28px;font-size:10px">${p?ini(p.nombre,p.apellidos):'?'}</div><div>${p?p.nombre+' '+p.apellidos:'Desconocido'}</div></div></td>
      <td>${c.motivo}</td><td><span class="tag tag-cyan">${c.tipo}</span></td><td>${estadoTag(c.estado)}</td>
      <td><div class="actions-cell">
        <button class="btn btn-sm" style="background:var(--primary);color:#fff;font-size:16px;font-weight:700;padding:2px 9px;line-height:1" onclick="openModalCitaP(${c.pacienteId})" title="Nueva cita para este paciente">+</button>
        ${c.estado!=='completada'&&c.estado!=='cancelada'?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;white-space:nowrap" onclick="marcarCitaCompletada(${c.id})">✅ Acudió</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})" title="Ver hoja">📄</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button>
      </div></td></tr>`;
  }).join('');
}

function fillMedicoSelect(selId, selectedId) {
  const medicos = C.prof.filter(p => p.rol==='medico'||p.rol==='admin');
  const sel = document.getElementById(selId);
  sel.innerHTML = '<option value="">Sin asignar</option>' +
    medicos.map(m=>`<option value="${m.id}">${m.icono||'👨‍⚕️'} ${m.nombre}</option>`).join('');
  if (selectedId) sel.value = selectedId;
  else if (currentUser?.key==='medico'||currentUser?.key==='admin') sel.value = currentUser.id;
}

function fillHoraSelect(selectedValue) {
  const sel = document.getElementById('c-hora');
  sel.innerHTML = '<option value="">Seleccionar hora...</option>';
  for(let h = 6; h <= 22; h++) {
    for(let m = 0; m < 60; m += 30) {
      const h24 = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const opt = document.createElement('option');
      opt.value = h24;
      opt.textContent = `${h12}:${String(m).padStart(2,'0')} ${period}`;
      if(h24 === selectedValue) opt.selected = true;
      sel.appendChild(opt);
    }
  }
}

function formatHora12(h24) {
  if(!h24) return '—';
  const parts = h24.split(':');
  const h = parseInt(parts[0]), m = parts[1]||'00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

function openModalCita(id){
  editingId=id||null;
  document.getElementById('modal-cita-title').textContent=id?'✏️ Editar Cita':'📅 Nueva Cita';
  fillSelect('c-paciente');
  fillMedicoSelect('c-medico');
  document.getElementById('c-fecha').value=hoy();
  fillHoraSelect('');
  ['motivo','notas'].forEach(f=>document.getElementById('c-'+f).value='');
  dxElegidos=[]; renderDxElegidos(); ocultarSugerenciasDx();
  document.getElementById('c-estado').value='pendiente';
  document.getElementById('c-tipo').value='consulta';
  if(id){
    const c=C.c.find(x=>x.id===id);
    if(c){
      setPacienteSelect('c-paciente', c.pacienteId);
      document.getElementById('c-fecha').value=c.fecha;
      fillHoraSelect(c.hora);
      document.getElementById('c-motivo').value=c.motivo;
      document.getElementById('c-tipo').value=c.tipo;
      document.getElementById('c-estado').value=c.estado;
      document.getElementById('c-notas').value=c.notas||'';
      if(c.medicoId) document.getElementById('c-medico').value=c.medicoId;
    }
  }
  document.getElementById('modal-cita').classList.add('open');
}
function openModalCitaP(pid){ openModalCita(); setPacienteSelect('c-paciente', pid); }

async function guardarCita(){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const pid=parseInt(document.getElementById('c-paciente').value);
  const fecha=document.getElementById('c-fecha').value;
  const hora=document.getElementById('c-hora').value;
  const motivo=document.getElementById('c-motivo').value.trim();
  if(!pid||!fecha||!hora||!motivo){ toast('Completa los campos obligatorios','error'); return; }
  const medicoId=document.getElementById('c-medico').value||null;
  const obj={pacienteId:pid,medicoId,fecha,hora,motivo,tipo:document.getElementById('c-tipo').value,estado:document.getElementById('c-estado').value,notas:document.getElementById('c-notas').value.trim()};
  setLoading(true);
  let err;
  if(editingId){ const r=await sb.from('citas').update(toC(obj)).eq('id',editingId); err=r.error; }
  else { const r=await sb.from('citas').insert([toC(obj)]); err=r.error; }
  setLoading(false);
  if(err){ toast('Error: '+err.message,'error'); return; }
  toast(editingId?'Cita actualizada':'Cita registrada ✅');
  if(!editingId) logActivity('cita');
  closeModal('modal-cita');
  await loadAll(); renderCitas(); updateBadges();
}

async function eliminarCita(id){
  const ok=await customConfirm({icon:'📅',title:'Eliminar cita',msg:'¿Eliminar esta cita? Esta acción no se puede deshacer.',okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('citas').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Cita eliminada');
  await loadAll(); renderCitas();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
  updateBadges();
}

function registrarAcudidoPaciente(pid){
  const h=hoy();
  const p=C.p.find(x=>x.id===pid);
  const nombre=p?p.nombre+' '+p.apellidos:'El paciente';
  const citasHoy=C.c.filter(c=>c.pacienteId===pid&&c.fecha===h&&c.estado!=='completada'&&c.estado!=='cancelada');
  if(!citasHoy.length){
    toast(`${p?.nombre||'El paciente'} no tiene citas pendientes hoy`,'info');
    return;
  }
  if(citasHoy.length===1){ marcarCitaCompletada(citasHoy[0].id); return; }
  document.getElementById('acudio-picker-title').textContent=`✅ Citas de ${p?.nombre||'Paciente'} hoy`;
  document.getElementById('acudio-picker-lista').innerHTML=citasHoy.map(c=>`
    <div class="cita-item ${c.estado}" style="cursor:pointer;margin-bottom:8px" onclick="closeModal('modal-acudio-picker');marcarCitaCompletada(${c.id})">
      <div class="cita-time">${c.hora}</div>
      <div class="cita-info"><div class="cita-paciente">${c.motivo}</div><div class="cita-motivo">${c.tipo}</div></div>
      ${estadoTag(c.estado)}
      <span style="color:var(--success);font-size:20px;flex-shrink:0">✅</span>
    </div>`).join('');
  document.getElementById('modal-acudio-picker').classList.add('open');
}

async function marcarCitaCompletada(id){
  const c=C.c.find(x=>x.id===id); if(!c) return;
  const p=C.p.find(x=>x.id===c.pacienteId);
  const nombre=p?p.nombre+' '+p.apellidos:'el paciente';
  const ok=await customConfirm({icon:'✅',title:'Confirmar asistencia',msg:`¿Confirmar que <strong>${nombre}</strong> acudió a la cita correctamente?`,okText:'Confirmar asistencia',danger:false});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('citas').update({estado:'completada'}).eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  atendidosFecha=c.fecha;
  toast(`Cita de ${nombre} marcada como completada ✅`,'success');
  await loadAll(); renderView(currentView); updateBadges();
  // Abrir nota de evolución automáticamente
  setTimeout(() => abrirNotaEvolucion(c.pacienteId, c), 400);
}

function abrirNotaEvolucion(pacienteId, cita) {
  editingId = null;
  document.getElementById('modal-nota-title').textContent = '📝 Nota de Evolución';
  fillSelect('n-paciente');
  setPacienteSelect('n-paciente', pacienteId);
  document.getElementById('n-tipo').value = 'evolucion';
  document.getElementById('n-fecha').value = hoy();
  document.getElementById('n-titulo').value = `Consulta ${formatFecha(hoy())}`;
  const motivo = cita?.motivo ? `Motivo de consulta: ${cita.motivo}\n\n` : '';
  document.getElementById('n-contenido').value = motivo;
  document.getElementById('modal-nota').classList.add('open');
  setTimeout(() => document.getElementById('n-contenido').focus(), 150);
}

// ════════════════════ MEDICACIONES ════════════════════
function renderMedicaciones(){
  const tbody=document.getElementById('tabla-medicaciones'), empty=document.getElementById('meds-empty');
  if(!C.m.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  tbody.innerHTML=C.m.map(x=>{ const p=C.p.find(q=>q.id===x.pacienteId); return `<tr>
    <td><div class="patient-name-cell"><div class="patient-avatar" style="background:${colAvatar(x.pacienteId||0)};width:28px;height:28px;font-size:10px">${p?ini(p.nombre,p.apellidos):'?'}</div><div>${p?p.nombre+' '+p.apellidos:'Desconocido'}</div></div></td>
    <td><strong>${x.nombre}</strong></td><td>${x.dosis}</td><td>${x.frecuencia}</td><td>${formatFecha(x.inicio)}</td><td>${x.fin?formatFecha(x.fin):'—'}</td><td>${estadoTag(x.estado)}</td>
    <td><div class="actions-cell"><button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirRecetaPaciente(${x.pacienteId})" title="Imprimir receta del paciente">🖨️</button><button class="btn btn-secondary btn-sm" onclick="openModalMedicacion(${x.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="eliminarMedicacion(${x.id})">🗑️</button></div></td></tr>`; }).join('');
}

const DOSIS_UNIDADES = ['tableta(s)','cápsula(s)','mg','g','mcg','ml','oz','gota(s)','UI','sobre(s)','ampolleta(s)','supositorio(s)','parche(s)','inhalación(es)','aplicación(es)'];

function parseDosisStr(d) {
  if(!d) return {qty:'1', unit:'tableta(s)'};
  const m = d.match(/^([\d.\/]+)\s*(.+)$/);
  if(m) {
    const num = m[1];
    const raw = m[2].toLowerCase().trim();
    if(raw.startsWith('tab')) return {qty:num, unit:'tableta(s)'};
    if(raw.startsWith('cap') || raw.startsWith('cáp')) return {qty:num, unit:'cápsula(s)'};
    if(raw === 'mg' || raw.startsWith('mg/')) return {qty:num, unit:'mg'};
    if(raw === 'g' || raw === 'gr') return {qty:num, unit:'g'};
    if(raw === 'mcg' || raw === 'μg' || raw === 'ug') return {qty:num, unit:'mcg'};
    if(raw === 'ml' || raw.startsWith('ml/')) return {qty:num, unit:'ml'};
    if(raw === 'oz') return {qty:num, unit:'oz'};
    if(raw.startsWith('gota')) return {qty:num, unit:'gota(s)'};
    if(raw === 'ui' || raw === 'u.i.') return {qty:num, unit:'UI'};
    if(raw.startsWith('ampo')) return {qty:num, unit:'ampolleta(s)'};
    if(raw.startsWith('sobre')) return {qty:num, unit:'sobre(s)'};
    if(raw.startsWith('supo')) return {qty:num, unit:'supositorio(s)'};
    if(raw.startsWith('par')) return {qty:num, unit:'parche(s)'};
    if(raw.startsWith('inha')) return {qty:num, unit:'inhalación(es)'};
    const found = DOSIS_UNIDADES.find(u => u.toLowerCase().startsWith(raw.split('(')[0]));
    return {qty:num, unit: found || raw};
  }
  if(/^[\d.]+$/.test(d)) return {qty:d, unit:'tableta(s)'};
  return {qty:'1', unit:'tableta(s)'};
}

let medItems = [];

function openModalMedicacion(id) {
  editingId = id || null;
  document.getElementById('modal-med-title').textContent = id ? '✏️ Editar Medicación' : '💊 Nueva Receta';
  fillSelect('m-paciente');
  document.getElementById('m-estado').value = 'activa';
  document.getElementById('m-inicio').value = hoy();
  document.getElementById('m-fin').value = '';
  if(id) {
    const m = C.m.find(x => x.id === id);
    if(m) {
      setPacienteSelect('m-paciente', m.pacienteId);
      document.getElementById('m-inicio').value = m.inicio || '';
      document.getElementById('m-fin').value = m.fin || '';
      document.getElementById('m-estado').value = m.estado;
      const dp = parseDosisStr(m.dosis);
      medItems = [{nombre:m.nombre, dosisQty:dp.qty, dosisUnit:dp.unit, frecuencia:m.frecuencia, via:m.via||'oral', indicaciones:m.indicaciones||''}];
    }
  } else {
    medItems = [{nombre:'', dosisQty:'1', dosisUnit:'tableta(s)', frecuencia:'Cada 8 horas', via:'oral', indicaciones:''}];
  }
  document.getElementById('btn-add-med-item').style.display = editingId ? 'none' : 'inline-flex';
  renderMedItems();
  document.getElementById('modal-medicacion').classList.add('open');
}
function openModalMedP(pid) { openModalMedicacion(); setPacienteSelect('m-paciente', pid); }

function renderMedItems() {
  const container = document.getElementById('med-items-list');
  if(!container) return;
  const vias = [['oral','Oral'],['inyectable','Inyectable'],['topica','Tópica'],['inhalada','Inhalada'],['sublingual','Sublingual'],['otra','Otra']];
  container.innerHTML = medItems.map((item, i) =>
    '<div style="border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;background:var(--bg)">'
    + (medItems.length > 1 ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.5px">Medicamento ' + (i+1) + '</span><button type="button" onclick="removeMedItem('+i+')" style="background:#FEE2E2;border:none;cursor:pointer;color:#B91C1C;font-size:12px;font-weight:700;padding:3px 9px;border-radius:6px">× Quitar</button></div>' : '')
    + '<div class="form-grid">'
    +   '<div class="form-group full" style="position:relative">'
    +     '<label>Medicamento *</label>'
    +     '<input type="text" id="mi-nombre-'+i+'" value="'+item.nombre+'" placeholder="Buscar medicamento..." autocomplete="off" oninput="medItems['+i+'].nombre=this.value;buscarMedItem(this.value,'+i+')" onblur="setTimeout(()=>hideMedItemSug('+i+'),180)">'
    +     '<div id="mi-sug-'+i+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--card);border:1.5px solid var(--primary);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:400;max-height:200px;overflow-y:auto;margin-top:4px"></div>'
    +   '</div>'
    +   '<div class="form-group"><label>Dosificación *</label><div style="display:flex;gap:8px">'
    +     '<input type="number" id="mi-dosis-qty-'+i+'" value="'+(item.dosisQty||1)+'" min="0.25" step="0.25" style="width:80px;flex-shrink:0" oninput="medItems['+i+'].dosisQty=this.value">'
    +     '<select id="mi-dosis-unit-'+i+'" style="flex:1" onchange="medItems['+i+'].dosisUnit=this.value">'+DOSIS_UNIDADES.map(u=>'<option value="'+u+'"'+((item.dosisUnit||'tableta(s)')===u?' selected':'')+'>'+u+'</option>').join('')+'</select>'
    +   '</div></div>'
    +   '<div class="form-group"><label>Frecuencia *</label><select id="mi-freq-'+i+'" onchange="medItems['+i+'].frecuencia=this.value">'
    +     ['Cada 4 horas','Cada 8 horas','Cada 12 horas','Cada 24 horas','Cada 2 días','Cada 3 días','1 vez al día','Una vez con alimentos','En ayunas','Al almorzar','Al cenar','Antes de dormir'].map(f=>'<option value="'+f+'"'+(item.frecuencia===f?' selected':'')+'>'+f+'</option>').join('')
    +     '</select></div>'
    +   '<div class="form-group"><label>Vía</label><select id="mi-via-'+i+'" onchange="medItems['+i+'].via=this.value">'+vias.map(([v,l])=>'<option value="'+v+'"'+(item.via===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div>'
    +   '<div class="form-group full"><label>Indicaciones</label><input type="text" id="mi-ind-'+i+'" value="'+item.indicaciones+'" placeholder="Tomar con alimentos..." oninput="medItems['+i+'].indicaciones=this.value"></div>'
    + '</div></div>'
  ).join('');
}

function addMedItem() {
  medItems.push({nombre:'', dosisQty:'1', dosisUnit:'tableta(s)', frecuencia:'Cada 8 horas', via:'oral', indicaciones:''});
  renderMedItems();
}

function removeMedItem(i) {
  if(medItems.length <= 1) return;
  medItems.splice(i, 1);
  renderMedItems();
}

function buscarMedItem(q, idx) {
  const box = document.getElementById('mi-sug-'+idx);
  if(!box) return;
  if(!q || q.length < 2) { box.style.display='none'; return; }
  const q2 = q.toLowerCase();
  const matches = MEDICAMENTOS_NI.filter(m => m.n.toLowerCase().includes(q2) || m.p.toLowerCase().includes(q2)).slice(0, 8);
  if(!matches.length) { box.style.display='none'; return; }
  box.innerHTML = matches.map(m =>
    '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseenter="this.style.background=\'var(--primary-light)\'" onmouseleave="this.style.background=\'\'" onmousedown="seleccionarMedItem('+JSON.stringify(m).replace(/"/g,'&quot;')+','+idx+')">'
    + '<div><div style="font-size:13px;font-weight:600;color:var(--text)">'+m.n+'</div><div style="font-size:11px;color:var(--text-light)">'+m.p+' &middot; '+m.d+'</div></div>'
    + '<span class="tag tag-gray" style="font-size:10px;flex-shrink:0;margin-left:10px">'+m.v+'</span>'
    + '</div>'
  ).join('');
  box.style.display = 'block';
}

function hideMedItemSug(idx) {
  const box = document.getElementById('mi-sug-'+idx);
  if(box) box.style.display = 'none';
}

function seleccionarMedItem(m, idx) {
  medItems[idx].nombre = m.n;
  const dp = parseDosisStr(m.d);
  medItems[idx].dosisQty = dp.qty;
  medItems[idx].dosisUnit = dp.unit;
  const viaMap = {oral:'oral',inyectable:'inyectable',topica:'topica',inhalada:'inhalada',sublingual:'sublingual'};
  medItems[idx].via = viaMap[m.v] || 'oral';
  hideMedItemSug(idx);
  renderMedItems();
  setTimeout(() => { const el = document.getElementById('mi-freq-'+idx); if(el) el.focus(); }, 50);
}

async function guardarMedicacion() {
  if(!currentClinicaId) { toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const pid = parseInt(document.getElementById('m-paciente').value);
  if(!pid) { toast('Selecciona un paciente','error'); return; }
  const inicio = document.getElementById('m-inicio').value;
  const fin = document.getElementById('m-fin').value;
  const estado = document.getElementById('m-estado').value;
  const buildDosis = item => ((item.dosisQty||'1') + ' ' + (item.dosisUnit||'tableta(s)')).trim();
  if(editingId) {
    const item = medItems[0];
    if(!item.nombre||!item.dosisQty||!item.frecuencia) { toast('Completa nombre, dosificación y frecuencia','error'); return; }
    const obj = {pacienteId:pid,nombre:item.nombre,dosis:buildDosis(item),frecuencia:item.frecuencia,inicio,fin,via:item.via,estado,indicaciones:item.indicaciones};
    setLoading(true);
    const {error} = await sb.from('medicaciones').update(toM(obj)).eq('id',editingId);
    setLoading(false);
    if(error) { toast('Error: '+error.message,'error'); return; }
    toast('Medicación actualizada');
  } else {
    const valid = medItems.filter(item => item.nombre && item.dosisQty && item.frecuencia);
    if(!valid.length) { toast('Agrega al menos un medicamento con nombre, dosificación y frecuencia','error'); return; }
    const rows = valid.map(item => toM({pacienteId:pid,nombre:item.nombre,dosis:buildDosis(item),frecuencia:item.frecuencia,inicio,fin,via:item.via,estado,indicaciones:item.indicaciones}));
    setLoading(true);
    const {error} = await sb.from('medicaciones').insert(rows);
    setLoading(false);
    if(error) { toast('Error: '+error.message,'error'); return; }
    toast(rows.length > 1 ? rows.length+' medicamentos registrados ✅' : 'Medicación registrada ✅');
    logActivity('medicacion');
  }
  closeModal('modal-medicacion');
  await loadAll(); renderMedicaciones();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

async function eliminarMedicacion(id){
  const ok=await customConfirm({icon:'💊',title:'Eliminar medicación',msg:'¿Eliminar esta medicación? Se perderá el registro permanentemente.',okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('medicaciones').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Medicación eliminada');
  await loadAll(); renderMedicaciones();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

// ════════════════════ NOTAS ════════════════════
function renderNotas(){
  const tbody=document.getElementById('tabla-notas'), empty=document.getElementById('notas-empty');
  if(!C.n.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  tbody.innerHTML=[...C.n].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(n=>{
    const p=C.p.find(x=>x.id===n.pacienteId);
    const prev=n.contenido.length>80?n.contenido.substring(0,80)+'…':n.contenido;
    return `<tr><td>${formatFecha(n.fecha)}</td>
      <td><div class="patient-name-cell"><div class="patient-avatar" style="background:${colAvatar(n.pacienteId||0)};width:28px;height:28px;font-size:10px">${p?ini(p.nombre,p.apellidos):'?'}</div><div>${p?p.nombre+' '+p.apellidos:'Desconocido'}</div></div></td>
      <td><span class="tag tag-blue">${n.tipo}</span></td>
      <td style="max-width:280px">${n.titulo?`<strong>${n.titulo}</strong><br>`:''}${prev}</td>
      <td><div class="actions-cell">
        <button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirNota(${n.id})">🖨️</button>
        <button class="btn btn-secondary btn-sm" onclick="verNota(${n.id})">👁️</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalNota(${n.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarNota(${n.id})">🗑️</button>
      </div></td></tr>`;
  }).join('');
}

function openModalNota(id){
  editingId=id||null;
  document.getElementById('modal-nota-title').textContent=id?'✏️ Editar Nota':'📝 Nueva Nota Clínica';
  fillSelect('n-paciente');
  document.getElementById('n-tipo').value='evolucion'; document.getElementById('n-fecha').value=hoy(); document.getElementById('n-titulo').value=''; document.getElementById('n-contenido').value='';
  if(id){
    const n=C.n.find(x=>x.id===id);
    if(n){ setPacienteSelect('n-paciente',n.pacienteId); document.getElementById('n-tipo').value=n.tipo; document.getElementById('n-fecha').value=n.fecha; document.getElementById('n-titulo').value=n.titulo||''; document.getElementById('n-contenido').value=n.contenido; }
  }
  document.getElementById('modal-nota').classList.add('open');
}
function openModalNotaP(pid){ openModalNota(); setPacienteSelect('n-paciente', pid); }

async function guardarNota(){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const pid=parseInt(document.getElementById('n-paciente').value);
  const contenido=document.getElementById('n-contenido').value.trim();
  if(!pid||!contenido){ toast('Completa los campos obligatorios','error'); return; }
  const obj={pacienteId:pid,tipo:document.getElementById('n-tipo').value,fecha:document.getElementById('n-fecha').value||hoy(),titulo:document.getElementById('n-titulo').value.trim(),contenido};
  setLoading(true);
  let err;
  if(editingId){ const r=await sb.from('notas').update(toN(obj)).eq('id',editingId); err=r.error; }
  else { const r=await sb.from('notas').insert([toN(obj)]); err=r.error; }
  setLoading(false);
  if(err){ toast('Error: '+err.message,'error'); return; }
  toast(editingId?'Nota actualizada':'Nota guardada ✅');
  if(!editingId) logActivity('nota');
  closeModal('modal-nota');
  await loadAll(); renderNotas();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

async function eliminarNota(id){
  const ok=await customConfirm({icon:'📝',title:'Eliminar nota clínica',msg:'¿Eliminar esta nota clínica? Esta acción no se puede deshacer.',okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('notas').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Nota eliminada');
  await loadAll(); renderNotas();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

function verNota(id){
  currentNotaId = id;
  const n=C.n.find(x=>x.id===id), p=C.p.find(x=>x.id===n.pacienteId);
  document.getElementById('ver-nota-title').textContent=`📝 ${n.titulo||'Nota Clínica'}`;
  document.getElementById('ver-nota-content').innerHTML=`
    <div style="margin-bottom:14px"><span class="tag tag-blue">${n.tipo}</span><span style="margin-left:8px;font-size:12px;color:var(--text-light)">${formatFecha(n.fecha)}</span></div>
    ${p?`<p class="text-light" style="margin-bottom:12px">Paciente: <strong style="color:var(--text)">${p.nombre} ${p.apellidos}</strong></p>`:''}
    ${n.titulo?`<h3 style="margin-bottom:12px">${n.titulo}</h3>`:''}
    <div style="white-space:pre-wrap;line-height:1.8;font-size:14px;background:var(--bg);padding:16px;border-radius:10px;border:1px solid var(--border)">${n.contenido}</div>`;
  document.getElementById('modal-ver-nota').classList.add('open');
}

function imprimirNota(id) {
  const n = C.n.find(x => x.id === id); if(!n) return;
  const p = C.p.find(x => x.id === n.pacienteId);
  const cfg = getClinicaConfig();
  const fmtF = f => { if(!f) return '—'; const d=new Date(f+'T12:00:00'); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); };
  const tipoColor = {evolucion:'#1D4ED8',diagnostico:'#7C3AED',tratamiento:'#059669',laboratorio:'#D97706',imagen:'#0891B2',cirugia:'#DC2626',alta:'#065F46',otro:'#475569'}[n.tipo]||'#1D4ED8';

  const ini2 = (a,b) => ((a||'')[0]||'').toUpperCase()+((b||'')[0]||'').toUpperCase();
  const body = '<div class="badge-tipo" style="background:'+tipoColor+'">📝 '+n.tipo.toUpperCase()+'</div>'
    + (n.titulo?'<div style="font-size:20px;font-weight:900;color:#0F172A;margin-bottom:6px">'+n.titulo+'</div>':'')
    + '<div class="patient-box" style="margin-bottom:20px">'
    +   '<div class="patient-av">'+(p?ini2(p.nombre,p.apellidos):'?')+'</div>'
    +   '<div style="flex:1">'
    +     '<div class="patient-name">'+(p?p.nombre+' '+p.apellidos:'Paciente no registrado')+'</div>'
    +     '<div class="patient-meta">'
    +       (p?.identificacion?'<span>&#128266; '+p.identificacion+'</span>':'')
    +       (p?.fechaNac?'<span>&#127874; '+calcEdad(p.fechaNac)+'</span>':'')
    +       (p?.sexo?'<span>'+(p.sexo==='M'?'&#9794; Masculino':p.sexo==='F'?'&#9792; Femenino':p.sexo)+'</span>':'')
    +       (p?.telefono?'<span>&#128222; '+p.telefono+'</span>':'')
    +     '</div>'
    +     (p?.alergias?'<div style="margin-top:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:5px 10px;font-size:11px;color:#DC2626;font-weight:600">&#9888; Alergias: '+p.alergias+'</div>':'')
    +   '</div>'
    + '</div>'
    + '<div class="section-title">&#128203; Datos de la nota</div>'
    + '<table><tbody>'
    +   '<tr><td style="width:130px;font-weight:700;color:#475569">Fecha</td><td>'+fmtF(n.fecha)+'</td><td style="width:130px;font-weight:700;color:#475569">Tipo</td><td><span class="tag tag-blue">'+n.tipo+'</span></td></tr>'
    +   '<tr><td style="font-weight:700;color:#475569">N&deg; Nota</td><td colspan="3">NC-'+n.id+'</td></tr>'
    + '</tbody></table>'
    + '<div class="section-title">&#128203; Contenido de la nota</div>'
    + '<div class="note-box" style="border-left-color:'+tipoColor+'"><div class="note-body">'+n.contenido+'</div></div>'
    + '<div class="sig-wrap"><div class="sig-box"><div style="height:46px"></div><div class="sig-line"></div>'
    +   '<div class="sig-name">'+(currentUser?.name||cfg.nombreDoctor||'M&#233;dico Responsable')+'</div>'
    +   (cfg.especialidad?'<div class="sig-role">'+cfg.especialidad+'</div>':'')
    +   (cfg.registro?'<div class="sig-role">Reg. Med. '+cfg.registro+'</div>':'')
    + '</div></div>';
  pdfAbrir('Nota Clínica — '+(n.titulo||n.tipo), body, cfg);
}

// ════════════════════ RECETA ELECTRÓNICA (IMPRESIÓN) ════════════════════
function imprimirReceta(id) {
  const m = C.m.find(x => x.id === id); if(!m) return;
  imprimirRecetaPaciente(m.pacienteId);
}

function imprimirRecetaPaciente(pid) {
  const p = C.p.find(x => x.id === pid);
  const e = C.e.find(x => x.pacienteId === pid);
  const meds = C.m.filter(m => m.pacienteId === pid).sort((a,b) => {
    const ord = {activa:0,finalizada:1,suspendida:2};
    return (ord[a.estado]||0) - (ord[b.estado]||0);
  });
  if(!meds.length) { toast('Este paciente no tiene medicaciones registradas','info'); return; }
  const cfg = getClinicaConfig();
  const fmtF = f => { if(!f) return '—'; const d=new Date(f+'T12:00:00'); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); };
  const viaLabel = v => ({oral:'Oral',inyectable:'Inyectable',topica:'Tópica',inhalada:'Inhalada',sublingual:'Sublingual',otra:'Otra'})[v||'oral'] || v || 'Oral';
  const pNombre = p ? p.nombre+' '+p.apellidos : 'Paciente no registrado';
  const pIni = p ? ini(p.nombre, p.apellidos) : '?';
  const pEdad = (p && p.fechaNac) ? calcEdad(p.fechaNac) : '';
  const eSexo = p ? (p.sexo==='M' ? '&#9794; Masculino' : p.sexo==='F' ? '&#9792; Femenino' : (p.sexo||'')) : '';

  const body = '<div class="badge-tipo" style="background:#059669">&#128138; RECETA ELECTR&#211;NICA</div>'
    + '<div style="font-size:11px;color:#64748B;font-weight:600;margin-bottom:18px">Fecha de emisi&#243;n: '+fmtF(hoy())+' &middot; N&deg; RX-'+Date.now().toString().slice(-6)+'</div>'
    + '<div class="patient-box">'
    +   '<div class="patient-av">'+pIni+'</div>'
    +   '<div style="flex:1">'
    +     '<div class="patient-name">'+pNombre+'</div>'
    +     '<div class="patient-meta">'
    +       (p && p.identificacion ? '<span>&#128266; '+p.identificacion+'</span>' : '')
    +       (pEdad ? '<span>'+pEdad+'</span>' : '')
    +       (eSexo ? '<span>'+eSexo+'</span>' : '')
    +       (p && p.telefono ? '<span>&#128222; '+p.telefono+'</span>' : '')
    +       (e && e.peso ? '<span>'+e.peso+' kg</span>' : '')
    +     '</div>'
    +     (p && p.alergias ? '<div style="margin-top:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:5px 10px;font-size:11px;color:#DC2626;font-weight:600">&#9888; Alergias: '+p.alergias+'</div>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="section-title">&#128138; Prescripci&#243;n Médica</div>'
    + '<table><thead><tr><th>#</th><th>Medicamento / Indicaciones</th><th>Dosis</th><th>Frecuencia</th><th>V&#237;a</th><th>Duraci&#243;n</th><th>Estado</th></tr></thead><tbody>'
    + meds.map((m, i) =>
        '<tr>'
        + '<td style="font-weight:800;color:#1D4ED8;text-align:center">' + (i+1) + '</td>'
        + '<td><strong>Rx. '+m.nombre+'</strong>'+(m.indicaciones?'<br><span style="font-size:11px;color:#64748B;font-style:italic">'+m.indicaciones+'</span>':'')+'</td>'
        + '<td><strong>'+m.dosis+'</strong></td>'
        + '<td>'+m.frecuencia+'</td>'
        + '<td>'+viaLabel(m.via)+'</td>'
        + '<td style="font-size:11px;white-space:nowrap">'+(m.inicio?fmtF(m.inicio):'—')+(m.fin?'<br>&rarr; '+fmtF(m.fin):'')+'</td>'
        + '<td><span class="tag '+(m.estado==='activa'?'tag-green':m.estado==='finalizada'?'tag-gray':'tag-red')+'">'+m.estado+'</span></td>'
        + '</tr>'
      ).join('')
    + '</tbody></table>'
    + ((p&&p.alergias)||(e&&e.enfermedadesCronicas) ? '<div class="section-title">&#9888; Antecedentes relevantes</div>'
    +   '<table><tbody>'
    +   (p&&p.alergias?'<tr><td style="font-weight:700;color:#B45309;width:150px;white-space:nowrap">Alergias</td><td>'+p.alergias+'</td></tr>':'')
    +   (e&&e.enfermedadesCronicas?'<tr><td style="font-weight:700;color:#B45309;white-space:nowrap">Enf. cr&#243;nicas</td><td>'+e.enfermedadesCronicas+'</td></tr>':'')
    +   '</tbody></table>' : '')
    + '<div class="sig-wrap"><div class="sig-box"><div style="height:46px"></div><div class="sig-line"></div>'
    +   '<div class="sig-name">'+(currentUser&&currentUser.name?currentUser.name:cfg.nombreDoctor||'M&#233;dico Responsable')+'</div>'
    +   (cfg.especialidad?'<div class="sig-role">'+cfg.especialidad+'</div>':'')
    +   (cfg.registro?'<div class="sig-role">Reg. Med. '+cfg.registro+'</div>':'')
    + '</div></div>';

  pdfAbrir('Receta Electrónica — '+pNombre, body, cfg);
}

// ════════════════════ FOTO PACIENTE ════════════════════
let pendingFotoFile = null;
let currentFotoUrl  = null;

function previewFoto(event) {
  const file = event.target.files[0]; if(!file) return;
  pendingFotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('foto-placeholder').style.display = 'none';
    const img = document.getElementById('foto-img-preview');
    img.src = e.target.result; img.style.display = 'block';
    document.getElementById('btn-quitar-foto').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function quitarFoto() {
  pendingFotoFile = null; currentFotoUrl = null;
  document.getElementById('foto-img-preview').style.display = 'none';
  document.getElementById('foto-img-preview').src = '';
  document.getElementById('foto-placeholder').style.display = 'block';
  document.getElementById('btn-quitar-foto').style.display = 'none';
  document.getElementById('p-foto').value = '';
}

async function subirFotoPaciente(file, pacienteId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${pacienteId}.${ext}`;
  const { error } = await sb.storage.from('pacientes').upload(path, file, { upsert: true, contentType: file.type });
  if(error) throw error;
  const { data } = sb.storage.from('pacientes').getPublicUrl(path);
  return data.publicUrl;
}

// ════════════════════ EXPEDIENTE ════════════════════
async function guardarExpediente(pid) {
  const obj = {
    pacienteId: pid,
    peso: document.getElementById('exp-peso').value,
    talla: document.getElementById('exp-talla').value,
    presion: document.getElementById('exp-presion').value,
    temperatura: document.getElementById('exp-temperatura').value,
    enfermedadesCronicas: document.getElementById('exp-enfermedadesCronicas').value.trim(),
    cirugias: document.getElementById('exp-cirugias').value.trim(),
    antecedentesFamiliares: document.getElementById('exp-antecedentesFamiliares').value.trim(),
    vacunas: document.getElementById('exp-vacunas').value.trim(),
    tabaco: document.getElementById('exp-tabaco').value,
    alcohol: document.getElementById('exp-alcohol').value,
    actividadFisica: document.getElementById('exp-actividadFisica').value,
    ocupacion: document.getElementById('exp-ocupacion').value.trim(),
    estadoCivil: document.getElementById('exp-estadoCivil').value,
    observacionesMedicas: document.getElementById('exp-observacionesMedicas').value.trim()
  };
  setLoading(true);
  const existing = C.e.find(x => x.pacienteId === pid);
  let err;
  if(existing) { const r = await sb.from('expediente').update(toE(obj)).eq('id', existing.id); err = r.error; }
  else { const r = await sb.from('expediente').insert([toE(obj)]); err = r.error; }
  setLoading(false);
  if(err) { toast('Error: ' + err.message, 'error'); return; }
  toast('Expediente guardado ✅');
  await loadAll();
  renderDetalleP(pid);
  setTimeout(() => { switchTab('tab-expediente', document.querySelectorAll('.tab')[4]); }, 50);
}

// ════════════════════ CONFIGURACIÓN CLÍNICA ════════════════════
function getClinicaConfig() {
  const key = 'lumeamed_clinica' + (currentClinicaId ? '_' + currentClinicaId : '');
  let local = {};
  try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch { local = {}; }
  const cl = currentClinica || {};
  // Supabase (currentClinica) es la fuente principal; localStorage puede sobrescribir si el usuario lo configuró localmente
  return {
    nombreClinica: local.nombreClinica || cl.nombre || '',
    nombreDoctor:  local.nombreDoctor  || cl.nombre_doctor || '',
    especialidad:  local.especialidad  || cl.especialidad || '',
    registro:      local.registro      || cl.registro || '',
    telefono:      local.telefono      || cl.telefono || '',
    email:         local.email         || '',
    direccion:     local.direccion     || cl.direccion || '',
    notaPie:       local.notaPie       || cl.nota_pie || '',
    logoUrl:       local.logoUrl       || cl.logo_url || '',
  };
}

function renderConfiguracion() {
  const cfg = getClinicaConfig();
  document.getElementById('config-logo-url').value = cfg.logoUrl || '';
  setConfigLogoPreview(cfg.logoUrl || null);
  document.getElementById('config-nombre-clinica').value = cfg.nombreClinica || '';
  document.getElementById('config-nombre-doctor').value = cfg.nombreDoctor || '';
  document.getElementById('config-especialidad').value = cfg.especialidad || '';
  document.getElementById('config-registro').value = cfg.registro || '';
  document.getElementById('config-telefono').value = cfg.telefono || '';
  document.getElementById('config-email').value = cfg.email || '';
  document.getElementById('config-direccion').value = cfg.direccion || '';
  document.getElementById('config-nota-pie').value = cfg.notaPie || '';
  actualizarPreviewConfig(cfg);
}

function setConfigLogoPreview(src) {
  const box = document.getElementById('config-logo-box');
  const btn = document.getElementById('config-logo-remove');
  if(src) {
    box.innerHTML = `<img src="${src}" alt="logo">`;
    if(btn) btn.style.display = 'inline-flex';
  } else {
    box.innerHTML = '🏥';
    if(btn) btn.style.display = 'none';
    document.getElementById('config-logo-url').value = '';
  }
}

function onConfigLogoSelected(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('config-logo-url').value = e.target.result;
    setConfigLogoPreview(e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removeConfigLogo() {
  setConfigLogoPreview(null);
}

function guardarConfigClinica() {
  const cfg = {
    nombreClinica: document.getElementById('config-nombre-clinica').value.trim(),
    nombreDoctor:  document.getElementById('config-nombre-doctor').value.trim(),
    especialidad:  document.getElementById('config-especialidad').value.trim(),
    registro:      document.getElementById('config-registro').value.trim(),
    telefono:      document.getElementById('config-telefono').value.trim(),
    email:         document.getElementById('config-email').value.trim(),
    direccion:     document.getElementById('config-direccion').value.trim(),
    notaPie:       document.getElementById('config-nota-pie').value.trim(),
    logoUrl:       document.getElementById('config-logo-url').value.trim()
  };
  if(!cfg.nombreClinica) { toast('El nombre de la clínica es obligatorio', 'error'); return; }
  const key = 'lumeamed_clinica' + (currentClinicaId ? '_' + currentClinicaId : '');
  localStorage.setItem(key, JSON.stringify(cfg));
  toast('Configuración guardada ✅');
  actualizarPreviewConfig(cfg);
}

function actualizarPreviewConfig(cfg) {
  const el = document.getElementById('config-preview');
  if(!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:12px">
      <div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden;flex-shrink:0">${cfg.logoUrl?`<img src="${cfg.logoUrl}" style="width:100%;height:100%;object-fit:contain">` : '🏥'}</div>
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--primary)">${cfg.nombreClinica||'Lumea Med Clínica'}</div>
        ${cfg.nombreDoctor?`<div style="font-size:12px;font-weight:600">${cfg.nombreDoctor}${cfg.especialidad?' · '+cfg.especialidad:''}</div>`:''}
        ${cfg.direccion?`<div style="font-size:11px;color:var(--text-light)">📍 ${cfg.direccion}</div>`:''}
        ${cfg.telefono?`<div style="font-size:11px;color:var(--text-light)">📞 ${cfg.telefono}</div>`:''}
      </div>
    </div>
    <p style="font-size:11px;color:var(--text-light);text-align:center">Así aparecerá el encabezado en tus notas de consulta</p>`;
}

// ════════════════════ NOTA DE CONSULTA (IMPRESIÓN) ════════════════════
function imprimirNotaConsulta(citaId) {
  const c = C.c.find(x => x.id === citaId); if(!c) return;
  const p = C.p.find(x => x.id === c.pacienteId);
  const e = C.e.find(x => x.pacienteId === c.pacienteId);
  const meds = C.m.filter(m => m.pacienteId === c.pacienteId && m.estado === 'activa');
  const notasDia = C.n.filter(n => n.pacienteId === c.pacienteId && n.fecha === c.fecha);
  const cfg = getClinicaConfig();
  const fmtF = f => { if(!f) return '—'; const d=new Date(f+'T12:00:00'); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); };
  const edadCalc = fn => { if(!fn) return ''; const h=new Date(),n=new Date(fn); let a=h.getFullYear()-n.getFullYear(); if(h.getMonth()<n.getMonth()||(h.getMonth()===n.getMonth()&&h.getDate()<n.getDate()))a--; return a+' años'; };
  const inits = (a,b) => ((a||'')[0]||'').toUpperCase()+((b||'')[0]||'').toUpperCase();
  const imc = (e?.peso && e?.talla) ? (e.peso/((e.talla/100)**2)).toFixed(1) : null;

  const body = '<div class="badge-tipo" style="background:#2563EB">&#128203; NOTA DE CONSULTA M&#201;DICA</div>'
    + '<div class="patient-box">'
    +   '<div class="patient-av">'+(p?.fotoUrl?'<img src="'+p.fotoUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':inits(p?.nombre,p?.apellidos))+'</div>'
    +   '<div style="flex:1">'
    +     '<div class="patient-name">'+(p?p.nombre+' '+p.apellidos:'Paciente no registrado')+'</div>'
    +     '<div class="patient-meta">'
    +       (p?.fechaNac?'<span>&#127874; '+edadCalc(p.fechaNac)+'</span>':'')
    +       (p?.sexo?'<span>'+(p.sexo==='M'?'&#9794; Masculino':p.sexo==='F'?'&#9792; Femenino':p.sexo)+'</span>':'')
    +       (p?.sangre?'<span>&#129778; '+p.sangre+'</span>':'')
    +       (p?.identificacion?'<span>&#128266; '+p.identificacion+'</span>':'')
    +       (p?.telefono?'<span>&#128222; '+p.telefono+'</span>':'')
    +     '</div>'
    +     (p?.alergias?'<div style="margin-top:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:5px 10px;font-size:11px;color:#DC2626;font-weight:600">&#9888; Alergias: '+p.alergias+'</div>':'')
    +   '</div>'
    + '</div>'
    + '<div class="section-title">&#128197; Datos de la consulta</div>'
    + '<table><tbody>'
    +   '<tr><td style="font-weight:700;color:#475569;width:130px">Fecha</td><td><strong>'+fmtF(c.fecha)+'</strong></td><td style="font-weight:700;color:#475569;width:100px">Hora</td><td><strong>'+c.hora+'</strong></td></tr>'
    +   '<tr><td style="font-weight:700;color:#475569">Tipo</td><td style="text-transform:capitalize">'+c.tipo+'</td><td style="font-weight:700;color:#475569">Estado</td><td style="text-transform:capitalize">'+c.estado+'</td></tr>'
    +   '<tr><td style="font-weight:700;color:#475569">N&deg; Folio</td><td colspan="3">GS-'+c.id+'-'+Date.now().toString().slice(-5)+'</td></tr>'
    +   '<tr><td style="font-weight:700;color:#1D4ED8">Motivo</td><td colspan="3" style="font-weight:700;color:#1D4ED8;font-size:14px">'+c.motivo+'</td></tr>'
    +   (c.notas?'<tr><td style="font-weight:700;color:#475569">Observaciones</td><td colspan="3" style="white-space:pre-wrap">'+c.notas+'</td></tr>':'')
    + '</tbody></table>'
    + (e&&(e.peso||e.talla||e.presion||e.temperatura)?
        '<div class="section-title">&#9889; Signos vitales</div>'
        + '<table><thead><tr>'
        +   (e.peso?'<th>Peso</th>':'')+(e.talla?'<th>Talla</th>':'')+(e.presion?'<th>Presi&#243;n Arterial</th>':'')+(e.temperatura?'<th>Temperatura</th>':'')+(imc?'<th>IMC</th>':'')
        + '</tr></thead><tbody><tr>'
        +   (e.peso?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.peso+' kg</td>':'')
        +   (e.talla?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.talla+' cm</td>':'')
        +   (e.presion?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.presion+'</td>':'')
        +   (e.temperatura?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.temperatura+'&deg;C</td>':'')
        +   (imc?'<td style="font-size:16px;font-weight:800;color:#166534">'+imc+'</td>':'')
        + '</tr></tbody></table>'
      : '')
    + '<div class="section-title">&#128203; Diagn&#243;stico / Notas de la consulta</div>'
    + (notasDia.length
        ? notasDia.map(n=>'<div class="note-box"><div class="note-title">'+(n.tipo.toUpperCase())+(n.titulo?' &mdash; '+n.titulo:'')+'</div><div class="note-body">'+n.contenido+'</div></div>').join('')
        : '<p style="font-size:12px;color:#94A3B8;margin-bottom:18px">Sin notas registradas para esta consulta</p>')
    + '<div class="section-title">&#128138; Prescripci&#243;n / Medicaci&#243;n</div>'
    + (meds.length
        ? '<table><thead><tr><th>#</th><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>V&#237;a</th><th>Hasta</th></tr></thead><tbody>'
          + meds.map((m,i)=>'<tr><td style="text-align:center;font-weight:800;color:#1D4ED8">'+(i+1)+'</td><td><strong>Rx. '+m.nombre+'</strong>'+(m.indicaciones?'<br><span style="font-size:11px;color:#64748B;font-style:italic">'+m.indicaciones+'</span>':'')+'</td><td>'+m.dosis+'</td><td>'+m.frecuencia+'</td><td>'+m.via+'</td><td style="font-size:11px">'+(m.fin?fmtF(m.fin):'Indefinido')+'</td></tr>').join('')
          + '</tbody></table>'
        : '<p style="font-size:12px;color:#94A3B8;margin-bottom:18px">Sin medicamentos prescritos en esta consulta</p>')
    + (p?.alergias||e?.enfermedadesCronicas
        ? '<div class="section-title">&#9888; Antecedentes relevantes</div>'
          + '<table><tbody>'
          + (p?.alergias?'<tr><td style="font-weight:700;color:#B45309;width:150px">Alergias</td><td>'+p.alergias+'</td></tr>':'')
          + (e?.enfermedadesCronicas?'<tr><td style="font-weight:700;color:#B45309">Enf. cr&#243;nicas</td><td>'+e.enfermedadesCronicas+'</td></tr>':'')
          + '</tbody></table>'
        : '')
    + '<div class="sig-wrap"><div class="sig-box"><div style="height:46px"></div><div class="sig-line"></div>'
    +   '<div class="sig-name">'+(currentUser?.name||cfg.nombreDoctor||'M&#233;dico Responsable')+'</div>'
    +   (cfg.especialidad?'<div class="sig-role">'+cfg.especialidad+'</div>':'')
    +   (cfg.registro?'<div class="sig-role">Reg. Med. '+cfg.registro+'</div>':'')
    + '</div></div>';

  pdfAbrir('Nota de Consulta — '+(p?p.nombre+' '+p.apellidos:''), body, cfg);
}

// ════════════════════ ATENDIDOS POR DÍA ════════════════════
let atendidosFecha = hoy();

function renderAtendidos(fecha) {
  if(fecha) atendidosFecha = fecha;
  const picker = document.getElementById('atendidos-fecha-picker');
  if(picker) picker.value = atendidosFecha;

  const citas = C.c.filter(c => c.fecha === atendidosFecha).sort((a,b) => a.hora.localeCompare(b.hora));
  const completadas = citas.filter(c => c.estado === 'completada');
  const pendientes  = citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada');
  const canceladas  = citas.filter(c => c.estado === 'cancelada');

  const statsEl = document.getElementById('atendidos-stats');
  if(statsEl) statsEl.innerHTML =
    `<span class="tag tag-green">✅ ${completadas.length} completadas</span>` +
    `<span class="tag tag-orange">⏳ ${pendientes.length} pendientes</span>` +
    (canceladas.length ? `<span class="tag tag-red">❌ ${canceladas.length} canceladas</span>` : '') +
    `<span class="tag tag-gray">📋 ${citas.length} total del día</span>`;

  const lista = document.getElementById('atendidos-lista');
  if(!lista) return;
  if(!citas.length) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Sin citas registradas para esta fecha</p></div>';
    return;
  }
  lista.innerHTML = citas.map(c => {
    const p = C.p.find(x => x.id === c.pacienteId);
    return `<div class="atendido-item ${c.estado}">
      <div class="atendido-time">${c.hora}</div>
      <div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:38px;height:38px;font-size:13px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div class="atendido-info">
        <div class="atendido-name">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div class="atendido-sub">${c.motivo} · <span class="tag tag-cyan" style="font-size:10px;padding:2px 7px">${c.tipo}</span></div>
      </div>
      ${estadoTag(c.estado)}
      <div class="actions-cell">
        <button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;white-space:nowrap" onclick="imprimirNotaConsulta(${c.id})">🖨️ Nota</button>
        <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})">📄 Hoja</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('paciente-detalle',${c.pacienteId})">👁️</button>
      </div>
    </div>`;
  }).join('');
}

function verResumenCita(citaId) {
  currentResumenCitaId = citaId;
  const c = C.c.find(x => x.id === citaId);
  if(!c) return;
  const cfg = getClinicaConfig();
  const p = C.p.find(x => x.id === c.pacienteId);
  const meds = C.m.filter(m => m.pacienteId === c.pacienteId && m.estado === 'activa');
  const notasDia = C.n.filter(n => n.pacienteId === c.pacienteId && n.fecha === c.fecha).sort((a,b) => b.id - a.id);
  const notasOtras = C.n.filter(n => n.pacienteId === c.pacienteId && n.fecha !== c.fecha).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const estadoIcon = {completada:'✅',pendiente:'⏳',confirmada:'🔵',cancelada:'❌'}[c.estado]||'📋';

  document.getElementById('resumen-cita-content').innerHTML = `
    <div class="rc-header">
      <div style="display:flex;align-items:center;gap:12px;flex:1">
        <div style="width:46px;height:46px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;flex-shrink:0">
          ${cfg.logoUrl?`<img src="${cfg.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:10px" alt="logo">`:'🏥'}
        </div>
        <div>
          <div class="rc-logo" style="font-size:15px">${cfg.nombreClinica||'Lumea Med'}</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:2px">${currentUser?.name||cfg.nombreDoctor||''}${cfg.especialidad?' · '+cfg.especialidad:''}</div>
        </div>
      </div>
      <div class="rc-date-gen">Generado: ${new Date().toLocaleString('es-ES')}</div>
    </div>

    <div class="rc-patient">
      <div class="patient-avatar" style="background:${p?colAvatar(p.id):'#475569'};width:62px;height:62px;font-size:22px;flex-shrink:0;border:3px solid rgba(255,255,255,.2)">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div class="rc-patient-info" style="flex:1">
        <h2>${p?p.nombre+' '+p.apellidos:'Paciente no encontrado'}</h2>
        <div class="rc-meta">
          ${p?.fechaNac?`<span>🎂 ${calcEdad(p.fechaNac)}</span>`:''}
          ${p?.sexo?`<span>${p.sexo==='M'?'♂ Masculino':p.sexo==='F'?'♀ Femenino':p.sexo}</span>`:''}
          ${p?.sangre?`<span>🩸 ${p.sangre}</span>`:''}
          ${p?.telefono?`<span>📞 ${p.telefono}</span>`:''}
          ${p?.identificacion?`<span>🪪 ${p.identificacion}</span>`:''}
          ${p?.email?`<span>✉️ ${p.email}</span>`:''}
        </div>
        ${p?.alergias?`<div class="rc-alergias">⚠️ Alergias: <strong>${p.alergias}</strong></div>`:''}
        ${p?.emergencia?`<div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:6px">🆘 Emergencia: ${p.emergencia}</div>`:''}
        ${p?.direccion?`<div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:3px">📍 ${p.direccion}</div>`:''}
      </div>
    </div>

    <div class="rc-section">
      <div class="rc-section-title">📅 Datos de la Consulta</div>
      <div class="rc-fields">
        <div class="rc-field"><span>Fecha</span><strong>${formatFecha(c.fecha)}</strong></div>
        <div class="rc-field"><span>Hora</span><strong>${c.hora}</strong></div>
        <div class="rc-field"><span>Tipo de consulta</span><strong>${c.tipo}</strong></div>
        <div class="rc-field"><span>Estado</span><strong>${estadoIcon} ${c.estado}</strong></div>
        <div class="rc-field full"><span>Motivo de Consulta</span><strong>${c.motivo}</strong></div>
        ${c.notas?`<div class="rc-field full"><span>Observaciones / Indicaciones de la cita</span><strong style="white-space:pre-wrap;font-weight:500">${c.notas}</strong></div>`:''}
      </div>
    </div>

    ${meds.length?`<div class="rc-section">
      <div class="rc-section-title">💊 Medicaciones Activas del Paciente</div>
      ${meds.map(m=>`<div class="rc-med-item">
        <strong>${m.nombre}</strong> · ${m.dosis} · ${m.frecuencia} · vía ${m.via}
        ${m.inicio?`<span style="font-size:11px;color:var(--text-light);margin-left:6px">(desde ${formatFecha(m.inicio)}${m.fin?' hasta '+formatFecha(m.fin):''})</span>`:''}
        ${m.indicaciones?`<div style="font-size:12px;color:var(--text-light);margin-top:4px">📌 ${m.indicaciones}</div>`:''}
      </div>`).join('')}
    </div>`:
    `<div class="rc-section"><div class="rc-section-title">💊 Medicaciones Activas</div><p style="font-size:13px;color:var(--text-light)">Sin medicaciones activas registradas</p></div>`}

    ${notasDia.length?`<div class="rc-section">
      <div class="rc-section-title">📝 Notas Clínicas — Esta Consulta (${formatFecha(c.fecha)})</div>
      ${notasDia.map(n=>`<div class="rc-nota">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <span class="tag tag-blue">${n.tipo}</span>
          ${n.titulo?`<strong style="font-size:13px">${n.titulo}</strong>`:''}
        </div>
        <div style="white-space:pre-wrap;line-height:1.75;font-size:13px;color:var(--text)">${n.contenido}</div>
      </div>`).join('')}
    </div>`:''}

    ${notasOtras.length?`<div class="rc-section">
      <div class="rc-section-title">📋 Historial de Notas Anteriores</div>
      ${notasOtras.slice(0,4).map(n=>`<div class="rc-nota">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <span class="tag tag-blue">${n.tipo}</span>
          <span style="font-size:11px;color:var(--text-light)">${formatFecha(n.fecha)}</span>
          ${n.titulo?`<strong style="font-size:12px">${n.titulo}</strong>`:''}
        </div>
        <div style="white-space:pre-wrap;line-height:1.6;font-size:12px;color:var(--text)">${n.contenido.length>300?n.contenido.substring(0,300)+'…':n.contenido}</div>
      </div>`).join('')}
      ${notasOtras.length>4?`<p style="font-size:12px;color:var(--text-light);text-align:center;margin-top:6px">+${notasOtras.length-4} notas más en el expediente</p>`:''}
    </div>`:''}

    ${!notasDia.length&&!notasOtras.length?`<div class="rc-section"><div class="rc-section-title">📝 Notas Clínicas</div><p style="font-size:13px;color:var(--text-light)">Sin notas clínicas registradas para este paciente</p></div>`:''}

    ${p?.observaciones?`<div class="rc-section">
      <div class="rc-section-title">🗂️ Antecedentes y Observaciones Generales</div>
      <div style="white-space:pre-wrap;line-height:1.75;font-size:13px">${p.observaciones}</div>
    </div>`:''}

    <div style="display:flex;justify-content:flex-end;margin-top:36px;padding:0 4px">
      <div style="text-align:center;min-width:210px">
        <div style="height:44px"></div>
        <div style="border-top:1.5px solid var(--text);margin-bottom:7px"></div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${currentUser?.name||cfg.nombreDoctor||'Médico Responsable'}</div>
        ${cfg.especialidad?`<div style="font-size:12px;color:var(--text-light);margin-top:2px">${cfg.especialidad}</div>`:''}
        ${cfg.registro?`<div style="font-size:11px;color:var(--text-light)">Reg. Med. ${cfg.registro}</div>`:''}
      </div>
    </div>
    <div class="rc-footer" style="margin-top:14px">
      ${cfg.nombreClinica||'Lumea Med'} · ${cfg.notaPie||cfg.direccion||'Sistema de Gestión Clínica'} · ${new Date().toLocaleString('es-ES')}
    </div>`;

  document.getElementById('modal-resumen-cita').classList.add('open');
}

function imprimirResumen() {
  window.print();
}

// ════════════════════ EXPORTAR ════════════════════
function renderExportar(){
  document.getElementById('resumen-exportar').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      ${[['👥','Pacientes',C.p.length],['📅','Citas',C.c.length],['💊','Medicaciones',C.m.length],['📝','Notas',C.n.length]].map(([ic,lb,v])=>`
        <div style="background:var(--bg);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:28px">${ic}</div><div style="font-size:22px;font-weight:800;margin:4px 0">${v}</div><div class="text-light">${lb}</div>
        </div>`).join('')}
    </div>
    <div class="divider"></div>
    <p class="text-light">Datos en: <strong>Supabase Cloud</strong> 🌐</p>
    <p class="text-light" style="margin-top:4px">Lumea Med v3.0 · ${new Date().toLocaleString('es-ES')}</p>`;
}

async function exportarEmail(){
  const h=hoy();
  const asunto=`Lumea Med — Reporte ${new Date().toLocaleDateString('es-ES')}`;
  const body=`REPORTE GALESISTEM\n\nPacientes: ${C.p.length} | Citas: ${C.c.length} | Medicaciones activas: ${C.m.filter(x=>x.estado==='activa').length}\n\nPACIENTES:\n${C.p.map(x=>`• ${x.nombre} ${x.apellidos} | ${x.identificacion||'-'} | ${x.telefono||'-'}`).join('\n')||'Ninguno'}\n\nCITAS HOY:\n${C.c.filter(x=>x.fecha===h).map(x=>{const p=C.p.find(q=>q.id===x.pacienteId);return`• ${x.hora} - ${p?p.nombre+' '+p.apellidos:'N/A'} — ${x.motivo} [${x.estado}]`}).join('\n')||'Ninguna'}\n\nGenerado por Lumea Med v3.0`;
  window.location.href=`mailto:sebasgale65@gmail.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(body)}`;
  toast('Abriendo cliente de correo...','info');
}

async function exportarJSON(){
  const fechaStr = new Date().toLocaleString('es-ES');
  const h = hoy();
  const sep = '─'.repeat(52);

  const lineasP = C.p.map(x =>
    `  • ${x.nombre} ${x.apellidos} | ${x.identificacion||'—'} | ${x.fechaNac||'—'} | ${x.telefono||'—'} | ${x.email||'—'} | ${x.estado||'activo'}`
  ).join('\n') || '  (sin registros)';

  const lineasC = C.c.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${x.fecha} ${x.hora} | ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.motivo} | ${x.tipo} | ${x.estado}`;
  }).join('\n') || '  (sin registros)';

  const lineasM = C.m.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.nombre} | ${x.dosis} | ${x.frecuencia} | vía ${x.via} | ${x.estado}`;
  }).join('\n') || '  (sin registros)';

  const lineasN = C.n.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${x.fecha} | ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.tipo}${x.titulo?' — '+x.titulo:''}`;
  }).join('\n') || '  (sin registros)';

  const citasHoy = C.c.filter(x=>x.fecha===h);
  const lineasHoy = citasHoy.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${x.hora} | ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.motivo} | ${x.estado}`;
  }).join('\n') || '  (ninguna)';

  const cuerpo =
`BACKUP LUMEA MED — ${fechaStr}
${sep}
Clínica ID: ${currentClinicaId} | Usuario: ${currentUser?.name||'—'}
${sep}

RESUMEN
  Pacientes:        ${C.p.length}
  Citas totales:    ${C.c.length}
  Citas hoy:        ${citasHoy.length}
  Medicaciones:     ${C.m.length} (activas: ${C.m.filter(x=>x.estado==='activa').length})
  Notas clínicas:   ${C.n.length}

${sep}
CITAS DE HOY (${h})
${lineasHoy}

${sep}
PACIENTES (${C.p.length})
${lineasP}

${sep}
CITAS (${C.c.length})
${lineasC}

${sep}
MEDICACIONES (${C.m.length})
${lineasM}

${sep}
NOTAS CLÍNICAS (${C.n.length})
${lineasN}

${sep}
Generado automáticamente por Lumea Med v3.0
${fechaStr}`;

  const asunto = `Backup Lumea Med — ${h}`;
  window.location.href = `mailto:sebasgale65@gmail.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  toast('Abriendo cliente de correo con el backup...','info');
}

function importarJSON(e){
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=async ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      const ok=await customConfirm({icon:'📥',title:'Importar backup',msg:'Esto insertará los datos del archivo en Supabase.<br><small style="color:var(--text-light)">No se borran los registros existentes.</small>',okText:'Importar',danger:false});
      if(!ok) return;
      setLoading(true);
      if(d.pacientes?.length) await sb.from('pacientes').upsert(d.pacientes.map(toP));
      if(d.citas?.length) await sb.from('citas').upsert(d.citas.map(toC));
      if(d.medicaciones?.length) await sb.from('medicaciones').upsert(d.medicaciones.map(toM));
      if(d.notas?.length) await sb.from('notas').upsert(d.notas.map(toN));
      setLoading(false);
      toast('Datos importados correctamente ✅');
      await loadAll(); renderView(currentView); updateBadges();
    }catch(err){ setLoading(false); toast('Error al leer el archivo','error'); console.error(err); }
  };
  r.readAsText(file); e.target.value='';
}

// ════════════════════ SIDEBAR MOBILE ════════════════════
function toggleSidebar(){
  const sb=document.getElementById('sidebar'), ov=document.getElementById('sidebar-overlay');
  const open=sb.classList.toggle('open');
  ov.classList.toggle('show',open);
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ════════════════════ BOTTOM NAV ════════════════════
function updateBottomNav(view){
  const map={dashboard:'bn-dashboard',pacientes:'bn-pacientes',citas:'bn-citas',agendas:'bn-agendas',medicaciones:'bn-medicaciones',notas:'bn-notas',atendidos:null,'paciente-detalle':'bn-pacientes',exportar:null};
  document.querySelectorAll('.bn-item').forEach(b=>b.classList.remove('active'));
  const id=map[view]; if(id) { const el=document.getElementById(id); if(el) el.classList.add('active'); }
}

// ════════════════════ FILTRO PACIENTES ════════════════════
let filtroEstado='todos';
function setFiltroEstado(estado, chipEl){
  filtroEstado=estado;
  document.querySelectorAll('.filter-chips .chip').forEach(c=>c.classList.remove('active'));
  if(chipEl) chipEl.classList.add('active');
  filterPacientes(document.getElementById('pacientes-search')?.value||'');
}
function filterPacientes(q){
  const q2=q.toLowerCase().trim();
  let lista=C.p;
  if(filtroEstado!=='todos') lista=lista.filter(x=>(x.estado||'activo')===filtroEstado);
  if(q2) lista=lista.filter(p=>`${p.nombre} ${p.apellidos} ${p.identificacion||''} ${p.telefono||''}`.toLowerCase().includes(q2));
  const countEl=document.getElementById('pacientes-count');
  if(countEl) countEl.textContent=lista.length===C.p.length?`${C.p.length} pacientes`:`${lista.length} de ${C.p.length} pacientes`;
  renderPacientesList(lista);
}

// ════════════════════ SEARCH ════════════════════
function globalSearch(q){
  const dd=document.getElementById('search-dropdown');
  if(!q.trim()){ dd.style.display='none'; return; }
  const r=C.p.filter(p=>`${p.nombre} ${p.apellidos} ${p.identificacion||''} ${p.telefono||''}`.toLowerCase().includes(q.toLowerCase())).slice(0,6);
  dd.innerHTML=r.length?r.map(p=>`<div class="search-result-item" onclick="selectSearchResult(${p.id})"><div class="patient-avatar" style="background:${colAvatar(p.id)};width:30px;height:30px;font-size:11px">${ini(p.nombre,p.apellidos)}</div><div><div style="font-weight:600;font-size:13px">${p.nombre} ${p.apellidos}</div><div class="text-light">${p.identificacion||''} ${p.telefono||''}</div></div></div>`).join(''):'<p style="padding:12px 16px;color:var(--text-light);font-size:13px">Sin resultados</p>';
  dd.style.display='block';
}
function selectSearchResult(id){ document.getElementById('global-search').value=''; document.getElementById('search-dropdown').style.display='none'; navigate('paciente-detalle',id); }

// ════════════════════ HELPERS ════════════════════
function fillSelect(sid) {
  const prefix = sid.split('-')[0];
  const hiddenEl = document.getElementById(sid);
  const txtEl = document.getElementById(prefix+'-pac-txt');
  if(hiddenEl) hiddenEl.value = '';
  if(txtEl) txtEl.value = '';
}

let pendingCitaAfterPaciente = false;

function nuevoPacienteParaCita(nombreHint) {
  pendingCitaAfterPaciente = true;
  closeModal('modal-cita');
  hidePacSug('c');
  openModalPaciente();
  const btnCitar = document.getElementById('btn-guardar-y-citar');
  if(btnCitar) btnCitar.style.display = 'inline-flex';
  if(nombreHint) {
    const parts = nombreHint.trim().split(/\s+/);
    document.getElementById('p-nombre').value = parts[0] || '';
    document.getElementById('p-apellidos').value = parts.slice(1).join(' ') || '';
  }
}

function filterPacSug(q, prefix) {
  const sug = document.getElementById(prefix+'-pac-sug');
  if(!sug) return;
  const q2 = (q||'').toLowerCase().trim();
  const matches = q2.length < 1
    ? C.p.slice(0, 12)
    : C.p.filter(p => (p.nombre+' '+p.apellidos).toLowerCase().includes(q2)
        || (p.identificacion||'').toLowerCase().includes(q2)
        || getExpedienteNum(p.id).toLowerCase().includes(q2)).slice(0, 10);
  if(!matches.length) {
    if(prefix === 'c' && q2.length >= 1) {
      sug.innerHTML =
        '<div style="padding:8px 14px;font-size:12px;color:var(--text-light);border-bottom:1px solid var(--border)">Sin resultados para "'+q+'"</div>'
        + '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;background:var(--primary-light);border-radius:0 0 10px 10px" onmousedown="nuevoPacienteParaCita(\''+q.replace(/'/g,"\\'")+'\')">'
        + '<span style="font-size:20px;flex-shrink:0">➕</span>'
        + '<div><div style="font-size:13px;font-weight:700;color:var(--primary)">Registrar como nuevo paciente</div>'
        + '<div style="font-size:11px;color:var(--primary);opacity:.8">Crea el expediente y abre la cita automáticamente</div></div>'
        + '</div>';
      sug.style.display = 'block';
    } else {
      sug.style.display = 'none';
    }
    return;
  }
  sug.innerHTML = matches.map(p =>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseenter="this.style.background=\'var(--primary-light)\'" onmouseleave="this.style.background=\'\'" onmousedown="selectPac(\''+prefix+'\','+p.id+',\''+((p.nombre+' '+p.apellidos).replace(/'/g,'\\\''))+'\')">'
    + '<div style="width:32px;height:32px;border-radius:50%;background:'+colAvatar(p.id)+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">'+ini(p.nombre,p.apellidos)+'</div>'
    + '<div><div style="font-size:13px;font-weight:600;color:var(--text)">'+p.nombre+' '+p.apellidos+'</div>'
    + '<div style="font-size:11px;color:var(--text-light)"><span style="color:var(--primary);font-weight:600">'+getExpedienteNum(p.id)+'</span>'+(p.identificacion?' · '+p.identificacion:'')+(p.telefono?' · '+p.telefono:'')+'</div></div>'
    + '</div>'
  ).join('');
  sug.style.display = 'block';
}

function selectPac(prefix, pid, nombre) {
  const hiddenEl = document.getElementById(prefix+'-paciente');
  const txtEl = document.getElementById(prefix+'-pac-txt');
  if(hiddenEl) hiddenEl.value = pid;
  if(txtEl) txtEl.value = nombre;
  hidePacSug(prefix);
}

function hidePacSug(prefix) {
  const sug = document.getElementById(prefix+'-pac-sug');
  if(sug) sug.style.display = 'none';
}

function setPacienteSelect(sid, pid) {
  const prefix = sid.split('-')[0];
  const p = C.p.find(x => x.id === pid);
  const hiddenEl = document.getElementById(sid);
  const txtEl = document.getElementById(prefix+'-pac-txt');
  if(hiddenEl) hiddenEl.value = pid || '';
  if(txtEl) txtEl.value = p ? p.nombre+' '+p.apellidos : '';
}
function closeModal(id){ document.getElementById(id).classList.remove('open'); editingId=null; }

document.addEventListener('click',e=>{
  if(!e.target.closest('#global-search')&&!e.target.closest('#search-dropdown')) document.getElementById('search-dropdown').style.display='none';
  if(!e.target.closest('#m-nombre')&&!e.target.closest('#med-sugerencias')) { const b=document.getElementById('med-sugerencias'); if(b) b.style.display='none'; }
});

// ════════════════════ MEDICAMENTOS NICARAGUA ════════════════════
const MEDICAMENTOS_NI = [
  // Analgésicos / Antiinflamatorios
  {n:'Acetaminofén 500mg',p:'Tableta',d:'1 tab cada 6-8h',v:'oral'},
  {n:'Acetaminofén 120mg/5ml',p:'Jarabe',d:'10-15mg/kg cada 6h',v:'oral'},
  {n:'Ibuprofeno 400mg',p:'Tableta',d:'1 tab cada 6-8h con alimentos',v:'oral'},
  {n:'Ibuprofeno 200mg/5ml',p:'Suspensión',d:'5-10mg/kg cada 6-8h',v:'oral'},
  {n:'Diclofenaco 50mg',p:'Tableta',d:'1 tab cada 8h con alimentos',v:'oral'},
  {n:'Diclofenaco 75mg/3ml',p:'Inyectable',d:'1 amp cada 12-24h',v:'inyectable'},
  {n:'Naproxeno 500mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Ketorolaco 10mg',p:'Tableta',d:'1 tab cada 8h (máx 5 días)',v:'oral'},
  {n:'Ketorolaco 30mg/1ml',p:'Inyectable',d:'1 amp cada 6-8h',v:'inyectable'},
  {n:'Aspirina 100mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Aspirina 500mg',p:'Tableta',d:'1-2 tab cada 8h',v:'oral'},
  {n:'Tramadol 50mg',p:'Cápsula',d:'1 cap cada 6-8h',v:'oral'},
  {n:'Tramadol 100mg/2ml',p:'Inyectable',d:'100mg IV/IM cada 8h',v:'inyectable'},
  {n:'Metamizol 500mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Metamizol 1g/2ml',p:'Inyectable',d:'1-2g IV/IM cada 8h',v:'inyectable'},
  // Antibióticos
  {n:'Amoxicilina 500mg',p:'Cápsula',d:'1 cap cada 8h x 7 días',v:'oral'},
  {n:'Amoxicilina 250mg/5ml',p:'Suspensión',d:'40mg/kg/día cada 8h',v:'oral'},
  {n:'Amoxicilina + Ác. Clavulánico 875mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Ampicilina 500mg',p:'Cápsula',d:'1 cap cada 6h',v:'oral'},
  {n:'Ampicilina 1g',p:'Inyectable',d:'1g IV cada 6h',v:'inyectable'},
  {n:'Azitromicina 500mg',p:'Tableta',d:'1 tab diaria x 3 días',v:'oral'},
  {n:'Ciprofloxacino 500mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Clindamicina 300mg',p:'Cápsula',d:'1 cap cada 8h',v:'oral'},
  {n:'Doxiciclina 100mg',p:'Cápsula',d:'1 cap cada 12h',v:'oral'},
  {n:'Eritromicina 500mg',p:'Tableta',d:'1 tab cada 6h x 7 días',v:'oral'},
  {n:'Metronidazol 500mg',p:'Tableta',d:'1 tab cada 8h x 7 días',v:'oral'},
  {n:'Metronidazol 500mg/100ml',p:'Inyectable IV',d:'500mg IV cada 8h',v:'inyectable'},
  {n:'Trimetoprim/Sulfametoxazol 160/800mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Trimetoprim/Sulfametoxazol 40/200mg/5ml',p:'Suspensión',d:'1ml/kg/día en 2 dosis',v:'oral'},
  {n:'Ceftriaxona 1g',p:'Inyectable',d:'1-2g cada 12-24h IV/IM',v:'inyectable'},
  {n:'Cefalexina 500mg',p:'Cápsula',d:'1 cap cada 6-8h x 7 días',v:'oral'},
  {n:'Gentamicina 80mg/2ml',p:'Inyectable',d:'1.5mg/kg cada 8h IM',v:'inyectable'},
  {n:'Claritromicina 500mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Nitrofurantoína 100mg',p:'Cápsula',d:'1 cap cada 6h x 7 días',v:'oral'},
  {n:'Penicilina Benzatínica 1.200.000UI',p:'Inyectable',d:'1 amp IM dosis única',v:'inyectable'},
  // Antihipertensivos
  {n:'Enalapril 10mg',p:'Tableta',d:'1 tab cada 12-24h',v:'oral'},
  {n:'Enalapril 5mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Losartán 50mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Losartán 100mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Amlodipino 5mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Amlodipino 10mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Hidroclorotiazida 25mg',p:'Tableta',d:'1 tab diaria por la mañana',v:'oral'},
  {n:'Atenolol 50mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Nifedipino 10mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Captopril 25mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  {n:'Metoprolol 50mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Furosemida 40mg',p:'Tableta',d:'1 tab diaria por la mañana',v:'oral'},
  {n:'Furosemida 20mg/2ml',p:'Inyectable',d:'20-40mg IV/IM',v:'inyectable'},
  {n:'Espironolactona 25mg',p:'Tableta',d:'1-2 tab diarias',v:'oral'},
  // Diabetes
  {n:'Metformina 500mg',p:'Tableta',d:'1 tab con el desayuno y la cena',v:'oral'},
  {n:'Metformina 850mg',p:'Tableta',d:'1 tab con las comidas',v:'oral'},
  {n:'Glibenclamida 5mg',p:'Tableta',d:'1 tab 30min antes del desayuno',v:'oral'},
  {n:'Glimepirida 2mg',p:'Tableta',d:'1 tab diaria antes del desayuno',v:'oral'},
  {n:'Insulina NPH 100UI/ml',p:'Inyectable',d:'Según indicación médica',v:'inyectable'},
  {n:'Insulina Regular 100UI/ml',p:'Inyectable',d:'Según indicación médica',v:'inyectable'},
  // Gastrointestinal
  {n:'Omeprazol 20mg',p:'Cápsula',d:'1 cap en ayunas x 14-28 días',v:'oral'},
  {n:'Omeprazol 40mg',p:'Cápsula',d:'1 cap en ayunas',v:'oral'},
  {n:'Pantoprazol 40mg',p:'Tableta',d:'1 tab en ayunas',v:'oral'},
  {n:'Ranitidina 150mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Metoclopramida 10mg',p:'Tableta',d:'1 tab 30min antes de comidas',v:'oral'},
  {n:'Metoclopramida 10mg/2ml',p:'Inyectable',d:'10mg IV/IM cada 8h',v:'inyectable'},
  {n:'Domperidona 10mg',p:'Tableta',d:'1 tab 30min antes de comidas',v:'oral'},
  {n:'Loperamida 2mg',p:'Cápsula',d:'2 cap inicial, luego 1 cap tras evacuación',v:'oral'},
  {n:'Sales de Rehidratación Oral',p:'Sobre',d:'1 sobre en 1 litro de agua',v:'oral'},
  {n:'Bismuto subcitrato 240mg',p:'Tableta',d:'1 tab cada 8h lejos de comidas',v:'oral'},
  // Respiratorio
  {n:'Salbutamol 100mcg/dosis',p:'Inhalador',d:'1-2 puffs cada 4-6h',v:'inhalada'},
  {n:'Salbutamol 2mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Beclometasona 250mcg',p:'Inhalador',d:'1-2 puffs cada 12h',v:'inhalada'},
  {n:'Budesonida 200mcg',p:'Inhalador',d:'1-2 puffs cada 12h',v:'inhalada'},
  {n:'Ambroxol 30mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Ambroxol 15mg/5ml',p:'Jarabe',d:'10ml cada 8h',v:'oral'},
  {n:'Dexametasona 4mg/1ml',p:'Inyectable',d:'4-8mg IV/IM según indicación',v:'inyectable'},
  {n:'Prednisona 5mg',p:'Tableta',d:'Según indicación médica',v:'oral'},
  {n:'Prednisona 20mg',p:'Tableta',d:'Según indicación médica',v:'oral'},
  // Antiparasitarios
  {n:'Albendazol 400mg',p:'Tableta',d:'1 tab dosis única (desparasitación)',v:'oral'},
  {n:'Mebendazol 100mg',p:'Tableta',d:'1 tab cada 12h x 3 días',v:'oral'},
  {n:'Ivermectina 6mg',p:'Tableta',d:'200mcg/kg dosis única',v:'oral'},
  {n:'Tinidazol 500mg',p:'Tableta',d:'4 tab dosis única',v:'oral'},
  {n:'Nistatina 100.000UI/ml',p:'Suspensión',d:'1ml 4 veces al día',v:'oral'},
  // Antihistamínicos
  {n:'Loratadina 10mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Cetirizina 10mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Difenhidramina 25mg',p:'Cápsula',d:'1 cap cada 6-8h',v:'oral'},
  {n:'Clorfeniramina 4mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  // Antifúngicos
  {n:'Fluconazol 150mg',p:'Cápsula',d:'1 cap dosis única',v:'oral'},
  {n:'Ketoconazol 200mg',p:'Tableta',d:'1 tab diaria x 2-4 semanas',v:'oral'},
  {n:'Miconazol 2%',p:'Crema',d:'Aplicar 2 veces al día x 2-4 semanas',v:'topica'},
  {n:'Clotrimazol 1%',p:'Crema',d:'Aplicar 2-3 veces al día',v:'topica'},
  // Vitaminas / Suplementos
  {n:'Ácido Fólico 5mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Ácido Fólico 1mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Sulfato Ferroso 300mg',p:'Tableta',d:'1 tab diaria en ayunas',v:'oral'},
  {n:'Vitamina C 500mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Calcio 500mg',p:'Tableta',d:'1-2 tab diarias con comida',v:'oral'},
  {n:'Vitamina B12 1000mcg',p:'Inyectable',d:'1 amp IM semanal',v:'inyectable'},
  {n:'Complejo B',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Zinc 20mg',p:'Tableta',d:'1 tab diaria x 10-14 días',v:'oral'},
  // Cardiovascular
  {n:'Simvastatina 20mg',p:'Tableta',d:'1 tab en la noche',v:'oral'},
  {n:'Atorvastatina 20mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Digoxina 0.25mg',p:'Tableta',d:'Según indicación médica',v:'oral'},
  {n:'Nitroglicerina 0.5mg SL',p:'Tableta sublingual',d:'1 tab SL al inicio del dolor',v:'sublingual'},
  {n:'Warfarina 5mg',p:'Tableta',d:'Según INR y prescripción',v:'oral'},
  // Neurológico
  {n:'Diazepam 5mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  {n:'Diazepam 10mg/2ml',p:'Inyectable',d:'5-10mg IV/IM según crisis',v:'inyectable'},
  {n:'Clonazepam 0.5mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Carbamazepina 200mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  {n:'Ácido Valproico 250mg',p:'Tableta',d:'Según indicación neurológica',v:'oral'},
  {n:'Fluoxetina 20mg',p:'Cápsula',d:'1 cap diaria en la mañana',v:'oral'},
  {n:'Amitriptilina 25mg',p:'Tableta',d:'1 tab en la noche',v:'oral'},
  {n:'Alprazolam 0.25mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  // Tiroides
  {n:'Levotiroxina 50mcg',p:'Tableta',d:'1 tab en ayunas 30min antes del desayuno',v:'oral'},
  {n:'Levotiroxina 100mcg',p:'Tableta',d:'1 tab en ayunas 30min antes del desayuno',v:'oral'},
  // Tópicos
  {n:'Hidrocortisona 1%',p:'Crema',d:'Aplicar 2 veces al día',v:'topica'},
  {n:'Betametasona 0.05%',p:'Crema',d:'Aplicar 1-2 veces al día',v:'topica'},
  {n:'Neomicina + Bacitracina',p:'Ungüento',d:'Aplicar 2-3 veces al día',v:'topica'},
  {n:'Ciprofloxacino 0.3% oftálmico',p:'Gotas',d:'1-2 gotas cada 4-6h',v:'topica'},
  {n:'Gentamicina 0.3% oftálmico',p:'Gotas',d:'1-2 gotas cada 6h',v:'topica'},
  // Antimaláricos
  {n:'Cloroquina 250mg',p:'Tableta',d:'Según protocolo malaria',v:'oral'},
  {n:'Primaquina 15mg',p:'Tableta',d:'Según protocolo malaria',v:'oral'},
  // Urgencias / Hospitalario
  {n:'Adrenalina 1mg/1ml',p:'Inyectable',d:'0.3-0.5mg SC en anafilaxia',v:'inyectable'},
  {n:'Atropina 0.5mg/1ml',p:'Inyectable',d:'0.5-1mg IV/IM',v:'inyectable'},
  {n:'Dexametasona 8mg/2ml',p:'Inyectable',d:'Según indicación médica',v:'inyectable'},
  {n:'Lidocaína 2%',p:'Inyectable',d:'Según procedimiento',v:'inyectable'},
  {n:'Oxitocina 10UI/1ml',p:'Inyectable',d:'Según protocolo obstétrico',v:'inyectable'},
  {n:'Heparina 5000UI/0.2ml',p:'Inyectable',d:'Según protocolo médico',v:'inyectable'},
  {n:'Enoxaparina 40mg/0.4ml',p:'Inyectable SC',d:'40mg SC diaria',v:'inyectable'},
];

let medSugIdx = -1;

function buscarMedicamento(q) {
  const box = document.getElementById('med-sugerencias');
  if(!q || q.length < 2) { box.style.display='none'; medSugIdx=-1; return; }
  const q2 = q.toLowerCase();
  const matches = MEDICAMENTOS_NI.filter(m =>
    m.n.toLowerCase().includes(q2) || m.p.toLowerCase().includes(q2)
  ).slice(0, 8);
  if(!matches.length) { box.style.display='none'; return; }
  box.innerHTML = matches.map((m, i) => `
    <div class="med-sug-item" data-idx="${i}"
      onmousedown="seleccionarMedicamento(${JSON.stringify(m).replace(/"/g,'&quot;')})"
      onmouseenter="medSugIdx=${i};resaltarSug()"
      style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${m.n}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:1px">${m.p} · ${m.d}</div>
      </div>
      <span class="tag tag-gray" style="font-size:10px;flex-shrink:0;margin-left:10px">${m.v}</span>
    </div>`).join('');
  box.querySelector('.med-sug-item:last-child').style.borderBottom = 'none';
  box.style.display = 'block';
  medSugIdx = -1;
  box._matches = matches;
}

function resaltarSug() {
  document.querySelectorAll('.med-sug-item').forEach((el, i) => {
    el.style.background = i === medSugIdx ? 'var(--primary-light)' : '';
  });
}

function navMedSug(e) {
  const box = document.getElementById('med-sugerencias');
  const items = box.querySelectorAll('.med-sug-item');
  if(!items.length) return;
  if(e.key === 'ArrowDown') { e.preventDefault(); medSugIdx = Math.min(medSugIdx+1, items.length-1); resaltarSug(); }
  else if(e.key === 'ArrowUp') { e.preventDefault(); medSugIdx = Math.max(medSugIdx-1, 0); resaltarSug(); }
  else if(e.key === 'Enter' && medSugIdx >= 0) { e.preventDefault(); seleccionarMedicamento(box._matches[medSugIdx]); }
  else if(e.key === 'Escape') { box.style.display='none'; }
}

function seleccionarMedicamento(m) {
  document.getElementById('m-nombre').value = m.n;
  document.getElementById('m-dosis').value = m.d;
  const viaMap = {oral:'oral',inyectable:'inyectable',topica:'topica',inhalada:'inhalada',sublingual:'sublingual'};
  const viaEl = document.getElementById('m-via');
  if(viaMap[m.v]) viaEl.value = viaMap[m.v];
  document.getElementById('med-sugerencias').style.display = 'none';
  medSugIdx = -1;
}

// ════════════════════ INIT ════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  if (localStorage.getItem('lm_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-icon').textContent = '🌙';
  }

  // Restaurar sesión — primero via Supabase Auth, luego legacy sessionStorage
  try {
    const { data: { session } } = await sb.auth.getSession();
    if(session?.user) {
      const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if(profile) { await entrarConPerfil(profile); return; }
      await sb.auth.signOut();
    }
    // Legacy fallback
    const saved = sessionStorage.getItem('lm_user');
    if(saved) await entrarConPerfil(JSON.parse(saved));
  } catch(e) { sessionStorage.removeItem('lm_user'); }
});

async function setNewPassword() {
  const p1 = document.getElementById('rec-pass1').value;
  const p2 = document.getElementById('rec-pass2').value;
  const errEl = document.getElementById('rec-error');
  errEl.style.display = 'none';
  if(!p1 || p1.length < 6) { errEl.textContent = 'Mínimo 6 caracteres'; errEl.style.display = 'block'; return; }
  if(p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; errEl.style.display = 'block'; return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if(error) { errEl.textContent = 'Error: ' + error.message; errEl.style.display = 'block'; return; }
  document.getElementById('recovery-overlay').style.display = 'none';
  toast('Contraseña actualizada ✅ — inicia sesión', 'success');
  window.location.hash = '';
}

async function verificarPin() {
  // deprecated — kept para compatibilidad
  if (false) {
    document.getElementById('login-pin').value = '';
  }
}

async function doLogout() {
  const ok=await customConfirm({icon:'👋',title:'¿Cerrar sesión?',msg:`Vas a salir de la sesión de <strong>${currentUser?.nombre||'usuario'}</strong>`,okText:'Cerrar sesión',cancelText:'Quedarse',danger:false});
  if(!ok) return;
  await sb.auth.signOut();
  sessionStorage.removeItem('lm_user');
  currentUser = null; currentClinicaId = null;
  const app = document.getElementById('app');
  app.style.transition = 'opacity .3s'; app.style.opacity = '0';
  setTimeout(() => {
    app.classList.remove('visible'); app.style.opacity = '';
    const ls = document.getElementById('login-screen');
    ls.style.cssText = 'display:flex;opacity:0;transform:scale(.95);transition:opacity .4s,transform .4s';
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').style.display = 'none';
    setTimeout(() => { ls.style.opacity='1'; ls.style.transform='none'; }, 10);
  }, 300);
}

async function cargarUsuariosLogin() { /* reemplazado por login email+password */ }

// ════════════════════ AGENDAS ════════════════════
let selAgendasDoc = null;
let selAgendasDate = hoy();

const rolLabel2 = r => ({admin:'Administrador',medico:'Médico',recepcion:'Recepcionista',enfermeria:'Enfermería',superadmin:'Super Admin'}[r]||r);

function renderAgendas() {
  selAgendasDate = hoy();
  renderAgendasDoctors();
  if(selAgendasDoc) renderAgendasRight();
}

function renderAgendasDoctors() {
  const el = document.getElementById('agendas-doctors-list');
  if(!el) return;
  const staff = C.prof.length ? C.prof : [];
  if(!staff.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-icon" style="font-size:28px">👥</div><p style="font-size:12px">No hay personal registrado.<br>Agrega desde el panel Admin.</p></div>`;
    return;
  }
  const today = hoy();
  el.innerHTML = staff.map(p => {
    const citasHoy = C.c.filter(c=>c.medicoId==p.id&&c.fecha===today&&c.estado!=='cancelada').length;
    const isSelected = selAgendasDoc == p.id;
    return `<div class="doc-card${isSelected?' selected':''}" onclick="selectDoctorAgenda('${p.id}')">
      <div class="doc-emoji">${p.icono||'👤'}</div>
      <div style="flex:1;min-width:0">
        <div class="doc-name">${p.nombre}</div>
        <div class="doc-role-lbl">${rolLabel2(p.rol)}</div>
      </div>
      ${citasHoy>0?`<span style="background:var(--primary);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">${citasHoy}</span>`:''}
    </div>`;
  }).join('');
}

function selectDoctorAgenda(profileId) {
  selAgendasDoc = profileId;
  selAgendasDate = hoy();
  renderAgendasDoctors();
  renderAgendasRight();
}

function renderAgendasRight() {
  const el = document.getElementById('agendas-right-panel');
  if(!el) return;
  const prof = C.prof.find(p=>p.id==selAgendasDoc);
  if(!prof) return;

  const citasDoc = C.c.filter(c=>c.medicoId==selAgendasDoc);
  const citaCount = {};
  citasDoc.forEach(c=>{ citaCount[c.fecha]=(citaCount[c.fecha]||0)+1; });

  const citasDelDia = citasDoc.filter(c=>c.fecha===selAgendasDate).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
  const pendientesTotales = citasDoc.filter(c=>c.estado==='pendiente'||c.estado==='confirmada').length;
  const atendidosHoy = citasDoc.filter(c=>c.fecha===hoy()&&c.estado==='completada').length;

  el.innerHTML = `
    <!-- Header del doctor -->
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:42px;width:58px;height:58px;display:flex;align-items:center;justify-content:center;background:var(--bg);border-radius:14px;border:1.5px solid var(--border);flex-shrink:0">${prof.icono||'👤'}</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;color:var(--text)">${prof.nombre}</div>
          <div style="font-size:12px;color:var(--text-light);margin-top:2px">${rolLabel2(prof.rol)}${prof.email?' · '+prof.email:''}</div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="text-align:center;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:var(--primary)">${atendidosHoy}</div>
            <div style="font-size:10px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-top:2px">Hoy</div>
          </div>
          <div style="text-align:center;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:var(--warning)">${pendientesTotales}</div>
            <div style="font-size:10px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-top:2px">Pendientes</div>
          </div>
          <div style="text-align:center;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:var(--text)">${citasDoc.length}</div>
            <div style="font-size:10px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-top:2px">Total</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <!-- Calendario -->
      <div class="card">
        <div class="card-header" style="margin-bottom:14px"><h3>🗓️ Calendario</h3></div>
        <div class="cal-wrap" id="agenda-cal-${prof.id}"></div>
        <div class="cal-legend"><div class="cal-legend-dot"></div><span>Tiene citas agendadas</span></div>
      </div>

      <!-- Citas del día seleccionado -->
      <div class="card">
        <div class="card-header" style="margin-bottom:14px">
          <h3>📋 ${formatFecha(selAgendasDate)}</h3>
          <button class="btn btn-primary btn-sm" onclick="nuevaCitaParaDoctor('${prof.id}')">+ Nueva Cita</button>
        </div>
        <div id="agenda-day-${prof.id}"></div>
      </div>
    </div>`;

  // Renderizar calendario de este doctor
  renderAgendaCalendar(`agenda-cal-${prof.id}`, citaCount, prof.id);
  renderAgendaDayCitas(`agenda-day-${prof.id}`, citasDelDia);
}

function renderAgendaCalendar(containerId, citaCount, profId) {
  const d = new Date(selAgendasDate+'T12:00:00'), year=d.getFullYear(), month=d.getMonth();
  const today2 = hoy();
  const first = new Date(year,month,1).getDay(), days = new Date(year,month+1,0).getDate();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dow = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html = `<div class="cal-nav">
    <div class="cal-nav-btns">
      <button class="btn-ghost" onclick="agendaCalNav(-1,'${profId}')">‹</button>
      <button class="btn-ghost" onclick="agendaCalNav(0,'${profId}')" style="font-size:11px;padding:5px 8px">Hoy</button>
      <button class="btn-ghost" onclick="agendaCalNav(1,'${profId}')">›</button>
    </div>
    <h4>${months[month]} <span style="color:var(--text-light);font-weight:500">${year}</span></h4>
  </div><div class="cal-grid">`;
  dow.forEach((dw,i)=>html+=`<div class="cal-dow${i===0||i===6?' weekend-dow':''}">${dw}</div>`);
  for(let i=0;i<first;i++) html+=`<div class="cal-day empty"></div>`;
  for(let i=1;i<=days;i++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dow2=new Date(ds+'T12:00:00').getDay();
    const isToday=ds===today2, isSel=ds===selAgendasDate&&!isToday;
    const cnt=citaCount[ds]||0;
    const isWeekend=dow2===0||dow2===6;
    const cls=['cal-day',isToday?'today':isSel?'selected':'',cnt?'has-event':'',isWeekend&&!isToday&&!isSel?'weekend':''].filter(Boolean).join(' ');
    const dots=cnt?`<div class="cal-dots">${Array.from({length:Math.min(cnt,3)},()=>`<div class="cal-dot-pip"></div>`).join('')}</div>`:`<div style="height:5px"></div>`;
    html+=`<div class="${cls}" onclick="selectAgendaDay('${ds}','${profId}')" title="${cnt?cnt+' cita'+(cnt>1?'s':''):''}"><span>${i}</span>${dots}</div>`;
  }
  html+='</div>';
  const el=document.getElementById(containerId);
  if(el) el.innerHTML=html;
}

function agendaCalNav(dir, profId) {
  const d=new Date(selAgendasDate+'T12:00:00');
  if(dir===0) selAgendasDate=hoy();
  else d.setMonth(d.getMonth()+dir), selAgendasDate=d.toISOString().split('T')[0];
  renderAgendasRight();
}

function selectAgendaDay(date, profId) {
  selAgendasDate = date;
  renderAgendasRight();
}

function renderAgendaDayCitas(containerId, citas) {
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!citas.length) {
    el.innerHTML=`<div class="empty-state" style="padding:24px 12px">
      <div class="empty-icon" style="font-size:28px">📭</div>
      <p style="margin-bottom:8px">Sin citas agendadas</p>
      <div style="font-size:11px;color:var(--text-light)">Horario disponible: 6:00 AM – 10:00 PM</div>
    </div>`;
    return;
  }
  const ocupadas = citas.filter(c=>c.estado!=='cancelada').length;
  el.innerHTML = citas.map(c=>{
    const p=C.p.find(x=>x.id===c.pacienteId);
    return `<div class="agenda-slot ${c.estado}" onclick="verResumenCita(${c.id})">
      <div style="font-size:12px;font-weight:800;color:var(--primary);min-width:68px;white-space:nowrap">${formatHora12(c.hora||'')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'Paciente'}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">${c.motivo}</div>
      </div>
      ${estadoTag(c.estado)}
    </div>`;
  }).join('') +
  `<div style="margin-top:10px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--text-light);display:flex;justify-content:space-between">
    <span>🔴 <strong>${ocupadas}</strong> ocupada${ocupadas!==1?'s':''}</span>
    <span>🟢 <strong>${34-ocupadas}</strong> disponible${34-ocupadas!==1?'s':''}</span>
  </div>`;
}

function nuevaCitaParaDoctor(profId) {
  openModalCita();
  setTimeout(()=>{
    const sel=document.getElementById('c-medico');
    if(sel) sel.value=profId;
    document.getElementById('c-fecha').value=selAgendasDate;
    // Marcar horas ya ocupadas por este médico ese día
    marcarHorasOcupadas(profId, selAgendasDate);
  },80);
}

function marcarHorasOcupadas(profId, fecha) {
  const ocupadas = new Set(
    C.c.filter(c=>c.medicoId==profId&&c.fecha===fecha&&c.estado!=='cancelada').map(c=>c.hora)
  );
  const sel = document.getElementById('c-hora');
  if(!sel) return;
  Array.from(sel.options).forEach(opt=>{
    if(opt.value && ocupadas.has(opt.value)) {
      opt.textContent = opt.textContent.replace(' 🔴','') + ' 🔴';
      opt.style.color = 'var(--danger)';
    }
  });
}

// ════════════════════ INVENTARIO ════════════════════
let invTab = 'productos', invCatFiltro = '', invMovTipo = '', repInvTab = 'dia';
let editingProdId = null;

function renderInventario() {
  const hoy2 = hoy();
  const entHoy  = C.mov.filter(m=>m.tipo==='entrada'&&m.fecha===hoy2).reduce((s,m)=>s+m.cantidad,0);
  const salHoy  = C.mov.filter(m=>m.tipo==='salida' &&m.fecha===hoy2).reduce((s,m)=>s+m.cantidad,0);
  const bajoStock = C.inv.filter(p=>p.stock<=p.stockMin&&p.stockMin>0).length;
  const sinStock  = C.inv.filter(p=>p.stock===0).length;
  const statsEl = document.getElementById('inv-stats-row');
  if(statsEl) statsEl.innerHTML=`
    <div class="stat-card"><div class="stat-icon si-blue">📦</div><div class="stat-info"><h3>${C.inv.length}</h3><p>Productos</p></div></div>
    <div class="stat-card"><div class="stat-icon si-green">📥</div><div class="stat-info"><h3>${entHoy}</h3><p>Unidades entrada hoy</p></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">📤</div><div class="stat-info"><h3>${salHoy}</h3><p>Unidades salida hoy</p></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#FEF2F2,#FEE2E2)">⚠️</div><div class="stat-info"><h3>${bajoStock}</h3><p>Bajo stock / sin stock (${sinStock})</p></div></div>`;
  switchInvTab(invTab);
}

function switchInvTab(tab) {
  invTab = tab;
  ['productos','movimientos','reportes'].forEach(t=>{
    document.getElementById('inv-panel-'+t).style.display = t===tab?'block':'none';
    document.getElementById('tab-inv-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='productos')   renderProductos();
  if(tab==='movimientos') renderMovimientos();
  if(tab==='reportes')    renderReportesInv();
}

function renderProductos(filtro) {
  const search = filtro !== undefined ? filtro : (document.getElementById('inv-search')?.value||'');
  const tbody = document.getElementById('tabla-inventario');
  const empty = document.getElementById('inv-empty');
  let items = C.inv;
  if(invCatFiltro) items = items.filter(p=>p.categoria===invCatFiltro);
  if(search) { const q=search.toLowerCase(); items=items.filter(p=>p.nombre.toLowerCase().includes(q)||(p.descripcion||'').toLowerCase().includes(q)); }
  if(!items.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const catIcon = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  tbody.innerHTML = items.map(p=>{
    const stCls = p.stock===0?'inv-stock-out':p.stockMin>0&&p.stock<=p.stockMin?'inv-stock-low':'inv-stock-ok';
    const stLbl = p.stock===0?'Sin stock':p.stockMin>0&&p.stock<=p.stockMin?'Stock bajo':'OK';
    return `<tr>
      <td><strong>${p.nombre}</strong>${p.descripcion?`<div style="font-size:11px;color:var(--text-light)">${p.descripcion}</div>`:''}</td>
      <td>${catIcon(p.categoria)} ${p.categoria}</td>
      <td>${p.unidad}</td>
      <td><span class="${stCls}">${p.stock}</span></td>
      <td style="color:var(--text-light)">${p.stockMin}</td>
      <td>${p.precio!=null?'C$ '+p.precio.toFixed(2):'—'}</td>
      <td><span class="tag ${p.stock===0?'tag-red':p.stockMin>0&&p.stock<=p.stockMin?'tag-orange':'tag-green'}">${stLbl}</span></td>
      <td><div class="actions-cell">
        <button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff" onclick="openModalEntrada(${p.id})">📥</button>
        <button class="btn btn-sm btn-danger" onclick="openModalSalida(${p.id})">📤</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalProducto(${p.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})">🗑️</button>
      </div></td></tr>`;
  }).join('');
}

function filterInventario(v){ renderProductos(v); }
function setInvCat(cat,el){ invCatFiltro=cat; document.querySelectorAll('#inv-panel-productos .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderProductos(); }
function setMovTipo(tipo,el){ invMovTipo=tipo; document.querySelectorAll('#inv-panel-movimientos .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderMovimientos(); }

function renderMovimientos() {
  const fecha = document.getElementById('inv-mov-fecha')?.value||'';
  const tbody = document.getElementById('tabla-movimientos');
  const empty = document.getElementById('mov-empty');
  let movs = [...C.mov];
  if(fecha) movs = movs.filter(m=>m.fecha===fecha);
  if(invMovTipo) movs = movs.filter(m=>m.tipo===invMovTipo);
  if(!movs.length){ tbody.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  tbody.innerHTML = movs.map(m=>{
    const prod = C.inv.find(p=>p.id===m.invId);
    return `<tr>
      <td>${formatFecha(m.fecha)}</td>
      <td><strong>${prod?prod.nombre:'—'}</strong>${prod?`<span style="font-size:11px;color:var(--text-light);margin-left:6px">${prod.unidad}</span>`:''}</td>
      <td><span class="inv-badge-${m.tipo}">${m.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td>
      <td><strong style="font-size:15px">${m.cantidad}</strong></td>
      <td style="color:var(--text-light);font-size:12px">${m.motivo||'—'}</td>
    </tr>`;
  }).join('');
}

// ── Reportes de inventario ──
function switchRepTab(tab){
  repInvTab=tab;
  ['dia','semana','mes','anual'].forEach(t=>{
    document.getElementById('tab-rep-'+t).classList.toggle('active',t===tab);
  });
  renderReportesInv();
}

function renderReportesInv(){
  const el=document.getElementById('rep-inv-content'); if(!el) return;
  const now=new Date();
  let movsFiltro=[], titulo='', rangoLabel='';

  if(repInvTab==='dia'){
    const fecha=hoy();
    movsFiltro=C.mov.filter(m=>m.fecha===fecha);
    titulo=`Reporte Diario — ${formatFecha(fecha)}`;
  } else if(repInvTab==='semana'){
    const lunes=new Date(now); lunes.setDate(now.getDate()-(now.getDay()||7)+1); lunes.setHours(0,0,0,0);
    const dom=new Date(lunes); dom.setDate(lunes.getDate()+6);
    const s=d=>d.toISOString().split('T')[0];
    movsFiltro=C.mov.filter(m=>m.fecha>=s(lunes)&&m.fecha<=s(dom));
    titulo=`Reporte Semanal — ${formatFecha(s(lunes))} al ${formatFecha(s(dom))}`;
  } else if(repInvTab==='mes'){
    const mes=hoy().slice(0,7);
    movsFiltro=C.mov.filter(m=>m.fecha.startsWith(mes));
    titulo=`Reporte Mensual — ${new Date(now.getFullYear(),now.getMonth(),1).toLocaleDateString('es-ES',{month:'long',year:'numeric'})}`;
  } else {
    const yr=now.getFullYear().toString();
    movsFiltro=C.mov.filter(m=>m.fecha.startsWith(yr));
    titulo=`Reporte Anual — ${yr}`;
  }

  const entradas=movsFiltro.filter(m=>m.tipo==='entrada');
  const salidas =movsFiltro.filter(m=>m.tipo==='salida');
  const totEnt=entradas.reduce((s,m)=>s+m.cantidad,0);
  const totSal=salidas.reduce((s,m)=>s+m.cantidad,0);

  // Top productos con más movimiento
  const freq={};
  movsFiltro.forEach(m=>{ freq[m.invId]=(freq[m.invId]||0)+m.cantidad; });
  const topProds=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,v])=>{
    const p=C.inv.find(x=>x.id==id); return {k:p?p.nombre:'#'+id,v};
  });
  const maxV=topProds.length?Math.max(...topProds.map(x=>x.v),1):1;

  el.innerHTML=`
    <h3 style="font-size:14px;font-weight:700;color:var(--text-light);margin-bottom:14px">${titulo}</h3>
    <div class="stats-grid" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon si-green">📥</div><div class="stat-info"><h3>${totEnt}</h3><p>Total entradas</p></div></div>
      <div class="stat-card"><div class="stat-icon si-orange">📤</div><div class="stat-info"><h3>${totSal}</h3><p>Total salidas</p></div></div>
      <div class="stat-card"><div class="stat-icon si-blue">🔄</div><div class="stat-info"><h3>${movsFiltro.length}</h3><p>Movimientos</p></div></div>
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#FEF2F2,#FEE2E2)">⚠️</div><div class="stat-info"><h3>${C.inv.filter(p=>p.stock<=p.stockMin&&p.stockMin>0).length}</h3><p>Bajo stock ahora</p></div></div>
    </div>
    ${topProds.length?`<div class="card" style="margin-bottom:14px">
      <div class="card-header"><h3>🏆 Productos con más movimiento</h3></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${topProds.map(d=>`<div style="display:flex;align-items:center;gap:10px">
          <div style="min-width:160px;font-size:12px;font-weight:600;color:var(--text-light);text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${d.k}</div>
          <div style="flex:1;background:var(--bg);border-radius:8px;height:26px;overflow:hidden">
            <div style="height:100%;width:${Math.round(d.v/maxV*100)}%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:8px;display:flex;align-items:center;padding-left:8px;min-width:${d.v?'24px':'0'}">
              ${d.v?`<span style="color:#fff;font-size:11px;font-weight:700">${d.v}</span>`:''}
            </div>
          </div>
          <div style="min-width:28px;font-size:13px;font-weight:800;color:var(--text)">${d.v}</div>
        </div>`).join('')}
      </div>
    </div>`:''}
    ${!movsFiltro.length?`<div class="empty-state"><div class="empty-icon">📊</div><p>Sin movimientos en este período</p></div>`:''}`;
}

// ── Modal Producto ──
function openModalProducto(id){
  editingProdId=id||null;
  document.getElementById('modal-producto-title').textContent=id?'✏️ Editar Producto':'📦 Nuevo Producto';
  if(id){
    const p=C.inv.find(x=>x.id===id); if(!p) return;
    document.getElementById('prod-nombre').value=p.nombre;
    document.getElementById('prod-categoria').value=p.categoria;
    document.getElementById('prod-unidad').value=p.unidad;
    document.getElementById('prod-stock').value=p.stock;
    document.getElementById('prod-stock-min').value=p.stockMin;
    document.getElementById('prod-precio').value=p.precio!=null?p.precio:'';
    document.getElementById('prod-descripcion').value=p.descripcion||'';
  } else {
    ['prod-nombre','prod-stock','prod-stock-min','prod-precio','prod-descripcion'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('prod-categoria').value='medicamento';
    document.getElementById('prod-unidad').value='unidad';
  }
  document.getElementById('modal-producto').classList.add('open');
}

async function guardarProducto(){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const nombre=document.getElementById('prod-nombre').value.trim();
  if(!nombre){ toast('El nombre es obligatorio','error'); return; }
  const obj=toInv({
    nombre, categoria:document.getElementById('prod-categoria').value,
    unidad:document.getElementById('prod-unidad').value,
    stock:document.getElementById('prod-stock').value||0,
    stockMin:document.getElementById('prod-stock-min').value||0,
    precio:document.getElementById('prod-precio').value||null,
    descripcion:document.getElementById('prod-descripcion').value||null
  });
  setLoading(true);
  if(editingProdId){
    const{error}=await sb.from('inventario').update(obj).eq('id',editingProdId);
    if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
    toast('Producto actualizado');
  } else {
    const{error}=await sb.from('inventario').insert(obj);
    if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
    toast('Producto agregado ✅');
  }
  closeModal('modal-producto');
  await loadAll(); renderInventario(); setLoading(false);
}

async function eliminarProducto(id){
  const p=C.inv.find(x=>x.id===id);
  const ok=await customConfirm({icon:'📦',title:'Eliminar producto',msg:`¿Eliminar <strong>${p?.nombre}</strong>?<br><br>También se eliminarán todos sus movimientos de inventario.`,okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const{error}=await sb.from('inventario').delete().eq('id',id);
  if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
  toast('Producto eliminado');
  await loadAll(); renderInventario(); setLoading(false);
}

// ── Modales Entrada / Salida ──
function fillProdSelect(selId, selectedId){
  const sel=document.getElementById(selId);
  sel.innerHTML='<option value="">Seleccionar producto...</option>'+
    C.inv.map(p=>`<option value="${p.id}" ${p.id===selectedId?'selected':''}>${p.nombre} (stock: ${p.stock} ${p.unidad})</option>`).join('');
}

function openModalEntrada(prodId){
  fillProdSelect('ent-producto', prodId);
  document.getElementById('ent-cantidad').value='';
  document.getElementById('ent-fecha').value=hoy();
  document.getElementById('ent-motivo').value='';
  document.getElementById('modal-entrada').classList.add('open');
}

function openModalSalida(prodId){
  fillProdSelect('sal-producto', prodId);
  document.getElementById('sal-cantidad').value='';
  document.getElementById('sal-fecha').value=hoy();
  document.getElementById('sal-motivo').value='';
  document.getElementById('modal-salida').classList.add('open');
}

async function guardarMovimiento(tipo){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const prefix=tipo==='entrada'?'ent':'sal';
  const invId=parseInt(document.getElementById(prefix+'-producto').value);
  const cantidad=Number(document.getElementById(prefix+'-cantidad').value);
  const fecha=document.getElementById(prefix+'-fecha').value||hoy();
  const motivo=document.getElementById(prefix+'-motivo').value.trim();
  if(!invId||!cantidad||cantidad<=0){ toast('Selecciona un producto y cantidad válida','error'); return; }
  const prod=C.inv.find(p=>p.id===invId);
  if(tipo==='salida'&&prod&&cantidad>prod.stock){
    const ok=await customConfirm({icon:'⚠️',title:'Stock insuficiente',msg:`Stock actual: <strong>${prod.stock} ${prod.unidad}</strong>.<br>¿Registrar salida de <strong>${cantidad}</strong> de todas formas?`,okText:'Registrar igual',danger:true});
    if(!ok) return;
  }
  setLoading(true);
  const nuevoStock=(prod?.stock||0)+(tipo==='entrada'?cantidad:-cantidad);
  const[{error:e1},{error:e2}]=await Promise.all([
    sb.from('inventario_movimientos').insert({inventario_id:invId,clinica_id:currentClinicaId,tipo,cantidad,motivo:motivo||null,fecha}),
    sb.from('inventario').update({stock_actual:Math.max(0,nuevoStock)}).eq('id',invId)
  ]);
  if(e1||e2){ toast('Error al registrar movimiento','error'); setLoading(false); return; }
  toast(tipo==='entrada'?'Entrada registrada 📥':'Salida registrada 📤');
  closeModal('modal-'+tipo);
  await loadAll(); renderInventario(); setLoading(false);
}

// ════════════════════ CATÁLOGO INVENTARIO ════════════════════
const INV_CATALOG = [
  // Medicamentos
  {n:'Acetaminofén 500mg',cat:'medicamento',u:'tableta'},{n:'Acetaminofén 120mg/5ml jarabe',cat:'medicamento',u:'frasco'},
  {n:'Ibuprofeno 400mg',cat:'medicamento',u:'tableta'},{n:'Ibuprofeno 200mg/5ml suspensión',cat:'medicamento',u:'frasco'},
  {n:'Diclofenac 50mg',cat:'medicamento',u:'tableta'},{n:'Diclofenac 75mg/3ml inyectable',cat:'medicamento',u:'ampolla'},
  {n:'Amoxicilina 500mg',cat:'medicamento',u:'cápsula'},{n:'Amoxicilina 250mg/5ml suspensión',cat:'medicamento',u:'frasco'},
  {n:'Azitromicina 500mg',cat:'medicamento',u:'tableta'},{n:'Ciprofloxacina 500mg',cat:'medicamento',u:'tableta'},
  {n:'Metronidazol 500mg',cat:'medicamento',u:'tableta'},{n:'Metronidazol 500mg/100ml IV',cat:'medicamento',u:'frasco'},
  {n:'Omeprazol 20mg',cat:'medicamento',u:'cápsula'},{n:'Ranitidina 150mg',cat:'medicamento',u:'tableta'},
  {n:'Metoclopramida 10mg',cat:'medicamento',u:'tableta'},{n:'Metoclopramida 10mg/2ml',cat:'medicamento',u:'ampolla'},
  {n:'Enalapril 10mg',cat:'medicamento',u:'tableta'},{n:'Losartán 50mg',cat:'medicamento',u:'tableta'},
  {n:'Amlodipino 5mg',cat:'medicamento',u:'tableta'},{n:'Hidroclorotiazida 25mg',cat:'medicamento',u:'tableta'},
  {n:'Metformina 500mg',cat:'medicamento',u:'tableta'},{n:'Metformina 850mg',cat:'medicamento',u:'tableta'},
  {n:'Glibenclamida 5mg',cat:'medicamento',u:'tableta'},{n:'Insulina NPH 100UI/ml',cat:'medicamento',u:'frasco'},
  {n:'Insulina Regular 100UI/ml',cat:'medicamento',u:'frasco'},{n:'Atorvastatina 20mg',cat:'medicamento',u:'tableta'},
  {n:'Simvastatina 20mg',cat:'medicamento',u:'tableta'},{n:'Furosemida 40mg',cat:'medicamento',u:'tableta'},
  {n:'Furosemida 20mg/2ml',cat:'medicamento',u:'ampolla'},{n:'Salbutamol inhalador 100mcg',cat:'medicamento',u:'unidad'},
  {n:'Salbutamol 2.5mg/2.5ml nebulización',cat:'medicamento',u:'ampolla'},{n:'Dexametasona 4mg/ml',cat:'medicamento',u:'ampolla'},
  {n:'Hidrocortisona 100mg',cat:'medicamento',u:'ampolla'},{n:'Loratadina 10mg',cat:'medicamento',u:'tableta'},
  {n:'Cetirizina 10mg',cat:'medicamento',u:'tableta'},{n:'Clonazepam 0.5mg',cat:'medicamento',u:'tableta'},
  {n:'Diazepam 5mg',cat:'medicamento',u:'tableta'},{n:'Amitriptilina 25mg',cat:'medicamento',u:'tableta'},
  {n:'Ácido fólico 5mg',cat:'medicamento',u:'tableta'},{n:'Hierro sulfato 300mg',cat:'medicamento',u:'tableta'},
  {n:'Vitamina C 500mg',cat:'medicamento',u:'tableta'},{n:'Vitamina B-complejo',cat:'medicamento',u:'tableta'},
  {n:'Calcio + Vitamina D 500mg',cat:'medicamento',u:'tableta'},{n:'Zinc 20mg',cat:'medicamento',u:'tableta'},
  {n:'Suero oral 27.9g',cat:'medicamento',u:'sobre'},{n:'Doxiciclina 100mg',cat:'medicamento',u:'cápsula'},
  {n:'Trimetoprim/Sulfametoxazol 400/80mg',cat:'medicamento',u:'tableta'},{n:'Ketoconazol 200mg',cat:'medicamento',u:'tableta'},
  {n:'Fluconazol 150mg',cat:'medicamento',u:'cápsula'},{n:'Ivermectina 6mg',cat:'medicamento',u:'tableta'},
  {n:'Albendazol 400mg',cat:'medicamento',u:'tableta'},{n:'Clorfenamina 4mg',cat:'medicamento',u:'tableta'},
  // Material médico
  {n:'Jeringa 1ml con aguja 25G',cat:'material',u:'unidad'},{n:'Jeringa 3ml con aguja 23G',cat:'material',u:'unidad'},
  {n:'Jeringa 5ml con aguja 21G',cat:'material',u:'unidad'},{n:'Jeringa 10ml con aguja 21G',cat:'material',u:'unidad'},
  {n:'Jeringa 20ml sin aguja',cat:'material',u:'unidad'},{n:'Aguja 21G x 1.5"',cat:'material',u:'caja'},
  {n:'Guantes látex S',cat:'material',u:'caja'},{n:'Guantes látex M',cat:'material',u:'caja'},
  {n:'Guantes látex L',cat:'material',u:'caja'},{n:'Guantes nitrilo M sin polvo',cat:'material',u:'caja'},
  {n:'Mascarilla quirúrgica 3 capas',cat:'material',u:'caja'},{n:'Mascarilla N95',cat:'material',u:'unidad'},
  {n:'Alcohol isopropílico 70%',cat:'material',u:'litro'},{n:'Alcohol en gel 500ml',cat:'material',u:'frasco'},
  {n:'Agua oxigenada 10V',cat:'material',u:'frasco'},{n:'Yodo povidona 10%',cat:'material',u:'frasco'},
  {n:'Gasas estériles 4x4"',cat:'material',u:'paquete'},{n:'Algodón hidrófilo 500g',cat:'material',u:'rollo'},
  {n:'Venda de gasa 4"',cat:'material',u:'rollo'},{n:'Venda elástica 4"',cat:'material',u:'rollo'},
  {n:'Esparadrapo de tela 1"',cat:'material',u:'rollo'},{n:'Micropore 1"',cat:'material',u:'rollo'},
  {n:'Bajalenguas de madera',cat:'material',u:'paquete'},{n:'Hisopo estéril',cat:'material',u:'paquete'},
  {n:'Catéter IV 18G',cat:'material',u:'unidad'},{n:'Catéter IV 20G',cat:'material',u:'unidad'},
  {n:'Catéter IV 22G',cat:'material',u:'unidad'},{n:'Catéter IV 24G',cat:'material',u:'unidad'},
  {n:'Equipo de venoclisis macrogotero',cat:'material',u:'unidad'},{n:'Equipo de venoclisis microgotero',cat:'material',u:'unidad'},
  {n:'Solución salina 0.9% 500ml',cat:'material',u:'frasco'},{n:'Solución salina 0.9% 1000ml',cat:'material',u:'frasco'},
  {n:'Dextrosa 5% 500ml',cat:'material',u:'frasco'},{n:'Hartmann 500ml',cat:'material',u:'frasco'},
  {n:'Sonda Foley 14Fr',cat:'material',u:'unidad'},{n:'Sonda Foley 16Fr',cat:'material',u:'unidad'},
  {n:'Sonda nasogástrica 14Fr',cat:'material',u:'unidad'},{n:'Guantes estériles 7.0',cat:'material',u:'par'},
  {n:'Guantes estériles 7.5',cat:'material',u:'par'},{n:'Lanceta estéril',cat:'material',u:'caja'},
  {n:'Tira reactiva glucosa',cat:'material',u:'caja'},{n:'Tira reactiva orina',cat:'material',u:'caja'},
  // Equipos
  {n:'Termómetro digital',cat:'equipo',u:'unidad'},{n:'Termómetro infrarrojo',cat:'equipo',u:'unidad'},
  {n:'Tensiómetro manual aneroide',cat:'equipo',u:'unidad'},{n:'Tensiómetro digital',cat:'equipo',u:'unidad'},
  {n:'Estetoscopio',cat:'equipo',u:'unidad'},{n:'Oxímetro de pulso',cat:'equipo',u:'unidad'},
  {n:'Glucómetro',cat:'equipo',u:'unidad'},{n:'Linterna médica',cat:'equipo',u:'unidad'},
  {n:'Martillo de reflejos',cat:'equipo',u:'unidad'},{n:'Otoscopio',cat:'equipo',u:'unidad'},
  {n:'Oftalmoscopio',cat:'equipo',u:'unidad'},{n:'Nebulizador',cat:'equipo',u:'unidad'},
  // Insumos
  {n:'Jabón líquido antibacterial',cat:'insumo',u:'frasco'},{n:'Cloro al 5% desinfectante',cat:'insumo',u:'litro'},
  {n:'Desinfectante de superficies',cat:'insumo',u:'litro'},{n:'Toallas de papel',cat:'insumo',u:'paquete'},
  {n:'Bolsas rojas desechos bioinfecciosos',cat:'insumo',u:'paquete'},{n:'Bolsas negras',cat:'insumo',u:'paquete'},
  {n:'Contenedor desechos cortopunzantes',cat:'insumo',u:'unidad'},
  // Papelería
  {n:'Recetarios médicos',cat:'papeleria',u:'paquete'},{n:'Talonarios incapacidad laboral',cat:'papeleria',u:'paquete'},
  {n:'Formularios de laboratorio',cat:'papeleria',u:'paquete'},{n:'Expedientes clínicos',cat:'papeleria',u:'paquete'},
];

let prodSugIdx = -1;

function buscarProductoInv(q) {
  const box = document.getElementById('prod-sug');
  if(!q || q.length < 2) { box.style.display='none'; prodSugIdx=-1; return; }
  const q2 = q.toLowerCase();
  const matches = INV_CATALOG.filter(p => p.n.toLowerCase().includes(q2)).slice(0,9);
  if(!matches.length) { box.style.display='none'; return; }
  const catIcon = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  box.innerHTML = matches.map((p,i) => `
    <div class="prod-sug-item" data-idx="${i}"
      onmousedown="seleccionarProductoInv(${JSON.stringify(p).replace(/"/g,'&quot;')})"
      onmouseenter="prodSugIdx=${i};resaltarProdSug()"
      style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${catIcon(p.cat)} ${p.n}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:1px">${p.cat} · ${p.u}</div>
      </div>
    </div>`).join('');
  box.querySelector('.prod-sug-item:last-child').style.borderBottom='none';
  box.style.display='block'; prodSugIdx=-1; box._matches=matches;
}

function resaltarProdSug() {
  document.querySelectorAll('.prod-sug-item').forEach((el,i)=>{
    el.style.background = i===prodSugIdx ? 'var(--primary-light)' : '';
  });
}

function navProdSug(e) {
  const box=document.getElementById('prod-sug');
  const items=box.querySelectorAll('.prod-sug-item');
  if(!items.length) return;
  if(e.key==='ArrowDown'){e.preventDefault();prodSugIdx=Math.min(prodSugIdx+1,items.length-1);resaltarProdSug();}
  else if(e.key==='ArrowUp'){e.preventDefault();prodSugIdx=Math.max(prodSugIdx-1,0);resaltarProdSug();}
  else if(e.key==='Enter'&&prodSugIdx>=0){e.preventDefault();seleccionarProductoInv(box._matches[prodSugIdx]);}
  else if(e.key==='Escape'){box.style.display='none';}
}

function seleccionarProductoInv(p) {
  document.getElementById('prod-nombre').value   = p.n;
  document.getElementById('prod-categoria').value = p.cat;
  document.getElementById('prod-unidad').value    = p.u;
  document.getElementById('prod-sug').style.display='none';
  prodSugIdx=-1;
  document.getElementById('prod-stock').focus();
}

// ════════════════════ DIAGNÓSTICOS SUGERIDOS ════════════════════
const DX_MAP = {
  'dolor de cabeza':['Migraña sin aura','Cefalea tensional','Hipertensión arterial','Sinusitis aguda','Cefalea en racimos','Neuralgia del trigémino','Hematoma subdural'],
  'cefalea':['Migraña sin aura','Cefalea tensional','Hipertensión arterial','Sinusitis aguda','Neuralgia del trigémino'],
  'migraña':['Migraña sin aura','Migraña con aura','Cefalea en racimos','Cefalea tensional crónica'],
  'fiebre':['Infección respiratoria aguda','Dengue clásico','Dengue hemorrágico','Influenza','Faringoamigdalitis bacteriana','Malaria','Leptospirosis','Fiebre tifoidea','Chikungunya'],
  'calentura':['Infección respiratoria aguda','Dengue clásico','Influenza','Faringoamigdalitis','Malaria','Leptospirosis'],
  'tos':['Infección respiratoria alta','Bronquitis aguda','Neumonía','Asma bronquial','EPOC exacerbado','Laringotraqueobronquitis','Covid-19','Tuberculosis pulmonar'],
  'gripe':['Influenza','Infección respiratoria viral','Faringoamigdalitis viral','Rinofaringitis aguda'],
  'catarro':['Rinofaringitis aguda','Sinusitis aguda','Infección respiratoria alta','Faringitis viral'],
  'dolor de garganta':['Faringoamigdalitis bacteriana','Faringoamigdalitis viral','Mononucleosis infecciosa','Absceso periamigdalino','Laringitis aguda','Epiglotitis'],
  'garganta':['Faringoamigdalitis bacteriana','Faringoamigdalitis viral','Laringitis aguda','Amigdalitis crónica'],
  'dolor abdominal':['Gastritis aguda','Apendicitis aguda','Colitis','Gastroenteritis','Síndrome de intestino irritable','Úlcera péptica','Colelitiasis','Pancreatitis aguda'],
  'dolor de estomago':['Gastritis aguda','Úlcera péptica','Gastroenteritis','Síndrome de intestino irritable','Dispepsia funcional','Apendicitis aguda'],
  'gastritis':['Gastritis aguda','Gastritis crónica','Úlcera péptica','Gastroduodenitis','Reflujo gastroesofágico'],
  'nauseas':['Gastritis aguda','Gastroenteritis','Hiperemesis gravídica','Intoxicación alimentaria','Migraña','Vértigo','Cetoacidosis diabética'],
  'vomito':['Gastroenteritis infecciosa','Gastritis aguda','Intoxicación alimentaria','Obstrucción intestinal','Apendicitis aguda','Hiperemesis gravídica'],
  'diarrea':['Gastroenteritis infecciosa','Colitis amebiana','Intoxicación alimentaria','Síndrome de intestino irritable','Colitis ulcerativa','Rotavirus','Giardiasis'],
  'dolor de pecho':['Angina de pecho inestable','Infarto agudo al miocardio','Pericarditis aguda','Costocondritis','Reflujo gastroesofágico','Embolia pulmonar','Neumonía','Ansiedad'],
  'palpitaciones':['Arritmia cardíaca','Taquicardia supraventricular','Fibrilación auricular','Anemia','Hipertiroidismo','Ansiedad','Prolapso de válvula mitral'],
  'presion alta':['Hipertensión arterial primaria','Crisis hipertensiva','Hipertensión secundaria','Feocromocitoma','Hiperaldosteronismo'],
  'hipertension':['Hipertensión arterial esencial','Crisis hipertensiva','Hipertensión renovascular','Preeclampsia'],
  'diabetes':['Diabetes mellitus tipo 2','Diabetes mellitus tipo 1','Prediabetes','Hipoglucemia','Cetoacidosis diabética','Síndrome metabólico'],
  'azucar':['Diabetes mellitus tipo 2','Hipoglucemia','Prediabetes','Síndrome metabólico'],
  'dolor de espalda':['Lumbalgia mecánica','Hernia de disco lumbar','Ciática','Contractura muscular lumbar','Espondiloartrosis','Osteoporosis','Pielonefritis'],
  'lumbar':['Lumbalgia mecánica','Hernia de disco lumbar','Ciática','Espondiloartrosis','Pielonefritis aguda'],
  'mareos':['Vértigo posicional paroxístico benigno','Laberintitis','Anemia','Hipotensión ortostática','Enfermedad de Ménière','Hipoglucemia','Hipertensión arterial'],
  'vertigo':['Vértigo posicional paroxístico benigno','Laberintitis vestibular','Enfermedad de Ménière','Neuritis vestibular','ACV cerebeloso'],
  'infeccion urinaria':['Cistitis bacteriana aguda','Pielonefritis aguda','Uretritis','Prostatitis','Vaginitis bacteriana'],
  'ardor al orinar':['Cistitis bacteriana aguda','Uretritis','Vaginitis bacteriana','Prostatitis crónica'],
  'piel':['Dermatitis atópica','Urticaria aguda','Dermatitis de contacto','Psoriasis','Micosis cutánea','Escabiosis','Celulitis infecciosa'],
  'alergia':['Urticaria aguda','Dermatitis atópica','Rinitis alérgica','Conjuntivitis alérgica','Asma alérgica','Reacción anafiláctica'],
  'sarpullido':['Urticaria aguda','Dermatitis de contacto','Varicela','Dengue hemorrágico','Escabiosis','Roséola infantil'],
  'asma':['Asma bronquial','Asma de difícil control','Bronquitis asmática','EPOC','Broncoespasmo'],
  'oido':['Otitis media aguda','Otitis externa','Tapón de cerumen','Otitis media con efusión','Mastoiditis'],
  'ojo':['Conjuntivitis bacteriana','Conjuntivitis viral','Orzuelo','Blefaritis','Uveítis aguda','Glaucoma agudo'],
  'articulaciones':['Artritis reumatoide','Osteoartritis','Gota aguda','Artritis séptica','Lupus eritematoso','Artralgia reactiva'],
  'rodilla':['Osteoartritis de rodilla','Lesión meniscal','Tendinitis rotuliana','Bursitis prerrotuliana','Artritis séptica'],
  'embarazo':['Embarazo normoevolutivo','Hiperemesis gravídica','Amenaza de aborto','Infección urinaria en embarazo','Preeclampsia','Anemia en embarazo'],
  'prenatal':['Control prenatal de bajo riesgo','Preeclampsia','Diabetes gestacional','Anemia gestacional','Restricción crecimiento fetal'],
  'ansiedad':['Trastorno de ansiedad generalizada','Trastorno de pánico','Fobia específica','Trastorno de estrés postraumático','Trastorno adaptativo'],
  'depresion':['Episodio depresivo mayor','Trastorno depresivo persistente','Trastorno bipolar','Trastorno adaptativo con ánimo deprimido'],
  'control':['Control de salud general','Control de hipertensión arterial','Control de diabetes mellitus','Control pediátrico','Control prenatal','Control postoperatorio'],
  'chequeo':['Examen médico general','Control de salud del adulto','Examen preventivo','Perfil lipídico alterado'],
  'dengue':['Dengue clásico','Dengue con signos de alarma','Dengue grave','Chikungunya'],
  'infeccion':['Infección respiratoria alta','Infección urinaria','Infección de tejidos blandos','Sepsis','Gastroenteritis infecciosa'],
  'anemia':['Anemia ferropénica','Anemia por deficiencia de B12','Anemia hemolítica','Anemia aplásica','Talasemia'],
  'tiroides':['Hipotiroidismo','Hipertiroidismo','Tiroiditis de Hashimoto','Bocio simple','Nódulo tiroideo'],
  'colesterol':['Dislipidemia mixta','Hipercolesterolemia','Síndrome metabólico','Hipertrigliceridemia'],
  'gastro':['Gastritis aguda','Gastroenteritis','Colitis','Reflujo gastroesofágico','Úlcera péptica'],
};

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

function buscarDiagnosticos(query) {
  if(!query || query.length < 3) return [];
  const q = norm(query);
  const found = new Set();
  Object.entries(DX_MAP).forEach(([key, dxs]) => {
    if(norm(key).includes(q) || q.includes(norm(key))) dxs.forEach(d => found.add(d));
  });
  // También buscar palabra suelta
  const words = q.split(' ').filter(w => w.length > 3);
  words.forEach(w => {
    Object.entries(DX_MAP).forEach(([key, dxs]) => {
      if(norm(key).includes(w)) dxs.forEach(d => found.add(d));
    });
  });
  return [...found].slice(0, 9);
}

function mostrarSugerenciasDx(query) {
  const el = document.getElementById('dx-suggestions');
  if(!el) return;
  const dxs = buscarDiagnosticos(query);
  if(!dxs.length){ el.style.display='none'; return; }
  el.style.display = 'block';
  el.innerHTML = dxs.map(dx =>
    `<div style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);transition:background .15s;display:flex;align-items:center;gap:8px"
      onmousedown="seleccionarDx('${dx.replace(/'/g,"\\'")}')">
      <span style="font-size:16px">🩺</span>
      <span>${dx}</span>
    </div>`
  ).join('');
}

function ocultarSugerenciasDx() {
  const el = document.getElementById('dx-suggestions');
  if(el) el.style.display = 'none';
}

let dxElegidos = [];
function seleccionarDx(dx) {
  ocultarSugerenciasDx();
  const motivoEl = document.getElementById('c-motivo');
  if(motivoEl) motivoEl.value = dx;
  if(dxElegidos.includes(dx)) return;
  dxElegidos.push(dx);
  renderDxElegidos();
  const notas = document.getElementById('c-notas');
  const sep = notas.value && !notas.value.endsWith('\n') ? '\n' : '';
  notas.value += (notas.value ? sep : '') + 'Dx: ' + dx;
}

function renderDxElegidos() {
  const wrap = document.getElementById('dx-elegidos-wrap');
  const el = document.getElementById('dx-elegidos');
  if(!el || !wrap) return;
  wrap.style.display = dxElegidos.length ? 'block' : 'none';
  el.innerHTML = dxElegidos.map((dx,i) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:600">
      🩺 ${dx}
      <button type="button" onclick="quitarDx(${i})" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:14px;line-height:1;padding:0">×</button>
    </span>`
  ).join('');
}

function quitarDx(i) {
  dxElegidos.splice(i,1);
  renderDxElegidos();
}

// ════════════════════ PDF HELPERS ════════════════════
const PDF_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
@page{size:auto;margin:10mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;color:#111827;background:#fff;font-size:13px;line-height:1.55}
.page{max-width:820px;margin:0 auto;padding:28px 32px 24px}
.pdf-header{display:flex;align-items:flex-start;gap:18px;padding-bottom:18px;border-bottom:3px solid #1D4ED8;margin-bottom:26px}
.pdf-logo{width:68px;height:68px;border-radius:14px;background:linear-gradient(135deg,#2563EB,#06B6D4);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden}
.pdf-logo img{width:100%;height:100%;object-fit:contain;border-radius:14px}
.pdf-clinic-info{flex:1}
.pdf-clinic-info h1{font-size:21px;font-weight:900;color:#1D4ED8;line-height:1.1;margin-bottom:4px}
.pdf-clinic-info p{font-size:11px;color:#64748B;margin-top:1.5px}
.pdf-right{text-align:right;flex-shrink:0}
.pdf-right .pdf-date{font-size:14px;font-weight:800;color:#0F172A}
.pdf-right .pdf-sub{font-size:10px;color:#94A3B8;margin-top:3px}
.section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#1D4ED8;margin:22px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #E2E8F0;display:flex;align-items:center;gap:6px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.kpi{border:1px solid #E2E8F0;border-radius:12px;padding:16px 12px;text-align:center;background:#FAFBFC;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.kpi.blue::before{background:#2563EB}.kpi.green::before{background:#10B981}
.kpi.orange::before{background:#F59E0B}.kpi.red::before{background:#EF4444}
.kpi-val{font-size:28px;font-weight:900;color:#0F172A;line-height:1}
.kpi-lbl{font-size:10px;color:#64748B;margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
table{width:100%;border-collapse:collapse;margin-bottom:18px}
thead tr{background:#1D4ED8}
thead th{padding:9px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff}
thead th:first-child{border-radius:6px 0 0 6px}
thead th:last-child{border-radius:0 6px 6px 0}
tbody tr:nth-child(even){background:#F8FAFC}
td{padding:9px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#1E293B}
.tag{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
.tag-green{background:#F0FDF4;color:#15803D}.tag-orange{background:#FFFBEB;color:#B45309}
.tag-cyan{background:#ECFEFF;color:#0E7490}.tag-red{background:#FEF2F2;color:#B91C1C}
.tag-gray{background:#F1F5F9;color:#475569}.tag-blue{background:#EFF6FF;color:#1D4ED8}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-lbl{min-width:140px;font-size:11px;font-weight:600;color:#475569;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;background:#E2E8F0;border-radius:8px;height:24px;overflow:hidden}
.bar-fill{height:100%;background:linear-gradient(90deg,#1D4ED8,#06B6D4);border-radius:8px;display:flex;align-items:center;padding-left:10px;min-width:0;transition:width .4s}
.bar-fill span{color:#fff;font-size:11px;font-weight:700}
.bar-val{min-width:28px;font-size:13px;font-weight:800;color:#0F172A;text-align:right}
.sig-wrap{display:flex;justify-content:flex-end;margin:40px 0 18px}
.sig-box{text-align:center;min-width:230px}
.sig-line{border-top:1.5px solid #334155;margin-bottom:8px}
.sig-name{font-size:14px;font-weight:800;color:#0F172A}
.sig-role{font-size:11px;color:#64748B;margin-top:3px}
.pdf-footer{margin-top:28px;padding-top:12px;border-top:1.5px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94A3B8}
.badge-tipo{display:inline-flex;align-items:center;gap:6px;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;margin-bottom:16px}
.patient-box{display:flex;gap:14px;align-items:center;background:#F0F7FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px 16px;margin-bottom:20px}
.patient-av{width:52px;height:52px;border-radius:50%;background:#1D4ED8;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;flex-shrink:0}
.patient-name{font-size:17px;font-weight:800;margin-bottom:4px;color:#0F172A}
.patient-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#475569}
.note-box{border-left:4px solid #1D4ED8;border-radius:0 12px 12px 0;background:#F8FAFC;padding:18px 20px;margin-bottom:16px}
.note-title{font-size:16px;font-weight:800;color:#0F172A;margin-bottom:10px}
.note-body{white-space:pre-wrap;font-size:13px;line-height:1.85;color:#1E293B}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{padding:20px 24px}}
`;

function pdfHeader(cfg) {
  return `<div class="pdf-header">
    <div class="pdf-logo">${cfg.logoUrl?`<img src="${cfg.logoUrl}" alt="logo">`:'🏥'}</div>
    <div class="pdf-clinic-info">
      <h1>${cfg.nombreClinica||'Lumea Med'}</h1>
      <p>${currentUser?.name||cfg.nombreDoctor||''}${cfg.especialidad?' · '+cfg.especialidad:''}</p>
      ${cfg.registro?`<p>Reg. Med. ${cfg.registro}</p>`:''}
      ${cfg.direccion?`<p>${cfg.direccion}</p>`:''}
      ${cfg.telefono?`<p>${cfg.telefono}${cfg.email?' · '+cfg.email:''}</p>`:''}
    </div>
    <div class="pdf-right">
      <div class="pdf-date">${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</div>
      <div class="pdf-sub">${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>
  </div>`;
}

function pdfFooter(cfg) {
  return `<div class="pdf-footer">
    <span><strong>${cfg.nombreClinica||'Lumea Med'}</strong> · ${cfg.notaPie||'Sistema de Gestión Clínica'}</span>
    <span>Generado: ${new Date().toLocaleString('es-ES')} · Uso médico interno</span>
  </div>`;
}

function pdfAbrir(titulo, body, cfg) {
  const w = window.open('','_blank','width=900,height=1100');
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>${PDF_CSS}</style></head><body>
    <div class="page">${pdfHeader(cfg)}${body}${pdfFooter(cfg)}</div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  w.document.close();
}

// ════════════════════ ESTADÍSTICAS ════════════════════
let estTab = 'dia';

function switchEstTab(tab) {
  estTab = tab;
  ['dia','semana','mes'].forEach(t => {
    document.getElementById('est-panel-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('tab-est-'+t).classList.toggle('active', t===tab);
  });
  if(tab==='dia') renderEstDia();
  if(tab==='semana') renderEstSemana();
  if(tab==='mes') renderEstMes();
}

function renderEstadisticas() {
  const d = document.getElementById('est-dia-fecha');
  if (!d.value) d.value = hoy();
  const s = document.getElementById('est-semana-fecha');
  if (!s.value) s.value = semanaISO(new Date());
  const m = document.getElementById('est-mes-fecha');
  if (!m.value) m.value = hoy().slice(0,7);
  renderEstDia();
}

function semanaISO(d) {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate() + 3 - (dt.getDay()+6)%7);
  const w = new Date(dt.getFullYear(),0,4);
  const wk = 1+Math.round(((dt-w)/86400000 - 3 + (w.getDay()+6)%7)/7);
  return `${dt.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}

function estCards(total, atendidos, canceladas, pendientes) {
  const pct = total ? Math.round(atendidos/total*100) : 0;
  return `<div class="stats-grid" style="margin-bottom:18px">
    <div class="stat-card"><div class="stat-icon si-blue">📋</div><div class="stat-info"><h3>${total}</h3><p>Total citas</p></div></div>
    <div class="stat-card"><div class="stat-icon si-green">✅</div><div class="stat-info"><h3>${atendidos}</h3><p>Atendidos</p><span class="stat-trend ok">↑ ${pct}%</span></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">⏳</div><div class="stat-info"><h3>${pendientes}</h3><p>Pendientes</p></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#FEF2F2,#FEE2E2)">❌</div><div class="stat-info"><h3>${canceladas}</h3><p>Canceladas</p></div></div>
  </div>`;
}

function estBarras(datos, titulo) {
  if (!datos.length) return '';
  const max = Math.max(...datos.map(d=>d.v), 1);
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-header"><h3>${titulo}</h3></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${datos.map(d=>`
        <div style="display:flex;align-items:center;gap:12px">
          <div style="min-width:110px;font-size:12px;font-weight:600;color:var(--text-light);text-align:right">${d.k}</div>
          <div style="flex:1;background:var(--bg);border-radius:8px;height:28px;overflow:hidden">
            <div style="height:100%;width:${Math.round(d.v/max*100)}%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:8px;display:flex;align-items:center;padding-left:8px;transition:width .5s;min-width:${d.v?'28px':'0'}">
              ${d.v ? `<span style="color:#fff;font-size:11px;font-weight:700">${d.v}</span>` : ''}
            </div>
          </div>
          <div style="min-width:24px;font-size:13px;font-weight:800;color:var(--text)">${d.v}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

function estTabla(citas, titulo) {
  if (!citas.length) return `<div class="card"><div class="card-header"><h3>${titulo}</h3></div><div class="empty-state"><div class="empty-icon">📋</div><p>Sin registros</p></div></div>`;
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-header"><h3>${titulo}</h3></div>
    <div class="table-wrap"><table>
      <thead><tr><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th></tr></thead>
      <tbody>${citas.map(c=>{
        const p=C.p.find(x=>x.id===c.pacienteId);
        return `<tr><td><strong>${c.hora||'—'}</strong></td><td>${p?p.nombre+' '+p.apellidos:'—'}</td><td><span class="tag tag-cyan">${c.tipo}</span></td><td>${estadoTag(c.estado)}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
}

function renderEstDia() {
  const fecha = document.getElementById('est-dia-fecha').value || hoy();
  document.getElementById('est-dia-fecha').value = fecha;
  const citas = C.c.filter(c=>c.fecha===fecha);
  const atendidos = citas.filter(c=>c.estado==='completada');
  const canceladas = citas.filter(c=>c.estado==='cancelada');
  const pendientes = citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  const tipos = ['consulta','control','urgencia','cirugia','examen'].map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  document.getElementById('est-dia-stats').innerHTML =
    estCards(citas.length, atendidos.length, canceladas.length, pendientes.length) +
    (tipos.length ? estBarras(tipos, '📊 Por tipo de cita') : '') +
    estTabla(citas.sort((a,b)=>(a.hora||'').localeCompare(b.hora||'')), `📋 Detalle del ${formatFecha(fecha)}`);
}

function renderEstSemana() {
  const val = document.getElementById('est-semana-fecha').value;
  if (!val) return;
  const [yr, wk] = val.split('-W').map(Number);
  const simple = d => d.toISOString().split('T')[0];
  const lunes = new Date(yr, 0, 1 + (wk-1)*7);
  lunes.setDate(lunes.getDate() - (lunes.getDay()||7) + 1);
  const dias = Array.from({length:7}, (_,i)=>{ const d=new Date(lunes); d.setDate(d.getDate()+i); return simple(d); });
  const diasNom = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const citas = C.c.filter(c=>dias.includes(c.fecha));
  const atendidos = citas.filter(c=>c.estado==='completada');
  const canceladas = citas.filter(c=>c.estado==='cancelada');
  const pendientes = citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  const porDia = dias.map((f,i)=>({k:diasNom[i], v:C.c.filter(c=>c.fecha===f&&c.estado==='completada').length}));
  const tipos = ['consulta','control','urgencia','cirugia','examen'].map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  document.getElementById('est-semana-stats').innerHTML =
    estCards(citas.length, atendidos.length, canceladas.length, pendientes.length) +
    estBarras(porDia, '📅 Atendidos por día') +
    (tipos.length ? estBarras(tipos,'📊 Por tipo') : '') +
    estTabla(citas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||'')), '📋 Detalle de la semana');
}

function renderEstMes() {
  const val = document.getElementById('est-mes-fecha').value;
  if (!val) return;
  const [yr, mo] = val.split('-').map(Number);
  const citas = C.c.filter(c=>c.fecha.startsWith(val));
  const atendidos = citas.filter(c=>c.estado==='completada');
  const canceladas = citas.filter(c=>c.estado==='cancelada');
  const pendientes = citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  // Agrupar por semana del mes
  const semanas = {};
  citas.filter(c=>c.estado==='completada').forEach(c=>{
    const d = new Date(c.fecha+'T12:00:00'), wk = Math.ceil(d.getDate()/7);
    const k = `Sem ${wk}`; semanas[k] = (semanas[k]||0)+1;
  });
  const porSemana = Object.entries(semanas).map(([k,v])=>({k,v}));
  const tipos = ['consulta','control','urgencia','cirugia','examen'].map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  // Top pacientes
  const freq = {};
  citas.forEach(c=>{ freq[c.pacienteId]=(freq[c.pacienteId]||0)+1; });
  const topP = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>{
    const p=C.p.find(x=>x.id==id); return {k:p?p.nombre+' '+p.apellidos:'#'+id, v};
  });
  document.getElementById('est-mes-stats').innerHTML =
    estCards(citas.length, atendidos.length, canceladas.length, pendientes.length) +
    (porSemana.length ? estBarras(porSemana,'📅 Atendidos por semana') : '') +
    (tipos.length ? estBarras(tipos,'📊 Por tipo de cita') : '') +
    (topP.length ? estBarras(topP,'👥 Pacientes frecuentes') : '') +
    estTabla(citas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||'')), '📋 Detalle del mes');
}

// ════════════════════ SUPER ADMIN ════════════════════
const SUPER_ADMIN_EMAIL = 'sebasgale65@gmail.com';
let adminClinicas = [];
let adminUsuarios = [];
let adminActividad = [];
let adminTab = 'clinicas';
let prodPeriodo = 'hoy';
let editingClinicaId = null;
let editingUsuarioId = null;
let currentDetalleClinicaId = null;
let detalleTab = 'info';

function isSuperAdmin() {
  return currentUser && currentUser.email === SUPER_ADMIN_EMAIL;
}

function toggleAdminMenu() {
  const sa = isSuperAdmin();
  const section = document.getElementById('menu-admin-section');
  const item    = document.getElementById('menu-admin');
  const cfg     = document.getElementById('menu-configuracion');
  if(section) section.style.display = sa ? 'block' : 'none';
  if(item)    item.style.display    = sa ? 'flex'  : 'none';
  if(cfg)     cfg.style.display     = sa ? 'flex'  : 'none';
}

async function loadAdminData() {
  setLoading(true);
  const [rc, ru, ra] = await Promise.all([
    sb.from('clinicas').select('*').order('id'),
    sb.from('profiles').select('*').order('nombre'),
    sb.from('actividad_usuarios').select('*').order('created_at', {ascending:false}).limit(2000)
  ]);
  adminClinicas = rc.data || [];
  adminUsuarios = ru.data || [];
  adminActividad = ra.data || [];
  setLoading(false);
}

function switchAdminTab(tab) {
  adminTab = tab;
  ['clinicas','usuarios','productividad'].forEach(t => {
    document.getElementById('admin-panel-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('tab-admin-'+t).classList.toggle('active', t===tab);
  });
  const btn = document.getElementById('btn-admin-add');
  if(btn) btn.style.display = tab==='productividad' ? 'none' : 'inline-flex';
  if(btn && tab!=='productividad') btn.textContent = tab==='clinicas' ? '+ Nueva Clínica' : '+ Nuevo Usuario';
  if(tab==='clinicas') renderAdminClinicas();
  if(tab==='usuarios') renderAdminUsuarios();
  if(tab==='productividad') renderProductividad();
  renderAdminStats();
}

function adminAddNew() {
  if(adminTab==='clinicas') openModalClinica();
  else openModalUsuario();
}

function renderAdminStats() {
  const el = document.getElementById('admin-stats-row');
  if(!el) return;
  const activas = adminClinicas.filter(c=>c.activa).length;
  el.innerHTML = `
    <div class="admin-stat"><div class="admin-stat-icon">🏥</div><div><div class="admin-stat-val">${adminClinicas.length}</div><div class="admin-stat-label">Clínicas totales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">✅</div><div><div class="admin-stat-val">${activas}</div><div class="admin-stat-label">Clínicas activas</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👥</div><div><div class="admin-stat-val">${adminUsuarios.length}</div><div class="admin-stat-label">Usuarios registrados</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👑</div><div><div class="admin-stat-val">1</div><div class="admin-stat-label">Super Admin</div></div></div>`;
}

function renderAdminClinicas() {
  const el = document.getElementById('admin-clinicas-list');
  if(!el) return;
  if(!adminClinicas.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏥</div><p>No hay clínicas registradas.<br>Crea la primera con <strong>+ Nueva Clínica</strong></p></div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>#</th><th>Nombre</th><th>Código</th><th>Estado</th><th>Usuarios</th><th>Acciones</th></tr></thead>
    <tbody>${adminClinicas.map(c => {
      const cnt = adminUsuarios.filter(u=>u.clinica_id===c.id).length;
      const isProd = c.en_produccion === true;
      return `<tr class="${isProd?'prod-row-highlight':''}">
        <td><strong style="color:var(--text-light)">#${c.id}</strong></td>
        <td>
          <strong>${c.nombre}</strong>
          ${isProd?'<span class="tag-purple" style="margin-left:8px">★ Producción</span>':''}
        </td>
        <td><code style="background:var(--bg);padding:2px 8px;border-radius:6px;font-size:11px;color:var(--text-light)">${c.codigo}</code></td>
        <td>${c.activa?'<span class="tag tag-green">Activa</span>':'<span class="tag tag-red">Inactiva</span>'}</td>
        <td><span class="tag tag-blue">${cnt} usuario${cnt!==1?'s':''}</span></td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-primary" data-cid="${c.id}" onclick="verDetalleClinica(Number(this.dataset.cid))">🔍 Ver</button>
          <button class="btn btn-sm btn-secondary" data-cid="${c.id}" onclick="openModalClinicaEdit(Number(this.dataset.cid))">✏️</button>
          <button class="btn btn-sm btn-danger" data-cid="${c.id}" onclick="eliminarClinica(Number(this.dataset.cid))">🗑️</button>
        </td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function renderAdminUsuarios() {
  const el = document.getElementById('admin-usuarios-list');
  if(!el) return;
  const rolLabel = r => ({admin:'Administrador',medico:'Médico',recepcion:'Recepcionista',enfermeria:'Enfermería'}[r]||r);
  const rolTag = r => ({admin:'tag-blue',medico:'tag-cyan',recepcion:'tag-orange',enfermeria:'tag-green'}[r]||'tag-gray');
  if(!adminUsuarios.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>No hay usuarios registrados.<br>Crea el primero con <strong>+ Nuevo Usuario</strong></p></div>`;
    return;
  }
  el.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th><th>Clínica</th><th>Acciones</th></tr></thead>
    <tbody>${adminUsuarios.map(u => {
      const clinica = adminClinicas.find(c=>c.id===u.clinica_id);
      return `<tr>
        <td><div class="patient-name-cell">
          <div class="patient-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent));font-size:18px;width:34px;height:34px">${u.icono||'👤'}</div>
          <strong>${u.nombre}</strong>
        </div></td>
        <td style="font-size:12px;color:var(--text-light)">${u.email||'—'}</td>
        <td><span class="tag ${rolTag(u.rol)}">${rolLabel(u.rol)}</span></td>
        <td>${clinica?clinica.nombre:'<span style="color:var(--text-light);font-size:12px">Sin clínica</span>'}</td>
        <td class="actions-cell">
          <button class="btn btn-sm btn-secondary" data-uid="${u.id}" onclick="openModalUsuarioEditById(this.dataset.uid)">✏️ Editar</button>
          <button class="btn btn-sm btn-danger" data-uid="${u.id}" onclick="eliminarUsuario(this.dataset.uid)">🗑️</button>
        </td></tr>`;
    }).join('')}</tbody></table></div>`;
}

// ── Productividad ──
function setProdPeriodo(p, el) {
  prodPeriodo = p;
  document.querySelectorAll('[id^="prod-chip-"]').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderProductividad();
}

function prodFechaRango() {
  const now = new Date(), h = hoy();
  if(prodPeriodo === 'hoy') return [h, h];
  if(prodPeriodo === 'semana') {
    const lunes = new Date(now); lunes.setDate(now.getDate()-(now.getDay()||7)+1); lunes.setHours(0,0,0,0);
    return [lunes.toISOString().split('T')[0], h];
  }
  return [h.slice(0,7)+'-01', h];
}

function renderProductividad() {
  const [desde, hasta] = prodFechaRango();
  const acts = adminActividad.filter(a => a.fecha >= desde && a.fecha <= hasta);

  // Resumen global
  const logins  = acts.filter(a=>a.accion==='login').length;
  const acciones = acts.filter(a=>a.accion!=='login').length;
  const usuariosActivos = new Set(acts.map(a=>a.user_id)).size;
  const resEl = document.getElementById('prod-resumen-row');
  if(resEl) resEl.innerHTML=`
    <div class="stat-card"><div class="stat-icon si-blue">👤</div><div class="stat-info"><h3>${usuariosActivos}</h3><p>Usuarios activos</p></div></div>
    <div class="stat-card"><div class="stat-icon si-green">🔑</div><div class="stat-info"><h3>${logins}</h3><p>Inicios de sesión</p></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">⚡</div><div class="stat-info"><h3>${acciones}</h3><p>Acciones registradas</p></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#EEF2FF,#E0E7FF)">📊</div><div class="stat-info"><h3>${acts.length}</h3><p>Total eventos</p></div></div>`;

  // Por usuario
  const listEl = document.getElementById('prod-usuarios-list');
  if(!listEl) return;
  const porUsuario = {};
  acts.forEach(a => {
    if(!porUsuario[a.user_id]) porUsuario[a.user_id] = {nombre:a.user_nombre, login:0, cita:0, paciente:0, nota:0, medicacion:0, otros:0};
    const u = porUsuario[a.user_id];
    if(a.accion in u) u[a.accion]++; else u.otros++;
  });
  const usuarios = Object.entries(porUsuario).sort((a,b)=>{
    const ta = Object.values(a[1]).slice(1).reduce((s,v)=>s+v,0);
    const tb = Object.values(b[1]).slice(1).reduce((s,v)=>s+v,0);
    return tb-ta;
  });

  if(!usuarios.length){
    listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><p>Sin actividad registrada en este período</p></div>`;
    renderTimeline(desde);
    return;
  }

  const maxScore = Math.max(...usuarios.map(([,u])=>u.cita+u.paciente+u.nota+u.medicacion+u.otros),1);
  listEl.innerHTML = `<div class="table-wrap"><table>
    <thead><tr><th>Usuario</th><th>Clínica</th><th>Logins</th><th>Citas</th><th>Pacientes</th><th>Notas</th><th>Medicaciones</th><th>Actividad</th></tr></thead>
    <tbody>${usuarios.map(([uid,u])=>{
      const prof = adminUsuarios.find(p=>p.id===uid);
      const clinica = adminClinicas.find(c=>c.id===prof?.clinica_id);
      const score = u.cita+u.paciente+u.nota+u.medicacion+u.otros;
      const pct = Math.round(score/maxScore*100);
      const nivel = score===0?['tag-gray','Inactivo']:score<5?['tag-orange','Bajo']:score<15?['tag-cyan','Activo']:['tag-green','Muy activo'];
      return `<tr>
        <td><div class="patient-name-cell">
          <div class="patient-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent));font-size:16px">${prof?.icono||'👤'}</div>
          <div><strong>${u.nombre}</strong><div style="font-size:11px;color:var(--text-light)">${prof?.email||''}</div></div>
        </div></td>
        <td style="font-size:12px;color:var(--text-light)">${clinica?.nombre||'—'}</td>
        <td><span style="font-weight:700;color:var(--primary)">${u.login}</span></td>
        <td>${u.cita}</td><td>${u.paciente}</td><td>${u.nota}</td><td>${u.medicacion}</td>
        <td style="min-width:140px">
          <div style="display:flex;align-items:center;gap:8px">
            <div style="flex:1;background:var(--bg);border-radius:6px;height:18px;overflow:hidden">
              <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:6px"></div>
            </div>
            <span class="tag ${nivel[0]}" style="flex-shrink:0">${nivel[1]}</span>
          </div>
        </td>
      </tr>`;
    }).join('')}</tbody></table></div>`;

  renderTimeline(desde);
}

function renderTimeline(desde) {
  const el = document.getElementById('prod-timeline'); if(!el) return;
  const diasNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const dias = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-6+i); return d.toISOString().split('T')[0];
  });
  const porDia = dias.map(f=>({
    f, nom:diasNom[new Date(f+'T12:00:00').getDay()],
    login: adminActividad.filter(a=>a.fecha===f&&a.accion==='login').length,
    total: adminActividad.filter(a=>a.fecha===f).length
  }));
  const maxT = Math.max(...porDia.map(d=>d.total),1);
  el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-end;height:120px;padding:0 4px">
    ${porDia.map(d=>`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
        <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;width:100%">
          <div title="${d.total} eventos" style="width:100%;background:linear-gradient(to top,var(--primary),var(--accent));border-radius:6px 6px 0 0;height:${Math.max(d.total?Math.round(d.total/maxT*90):0,0)}%;min-height:${d.total?'4px':'0'};transition:height .4s;position:relative">
            ${d.total?`<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:var(--primary)">${d.total}</div>`:''}
          </div>
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">${d.nom}</div>
        <div style="font-size:9px;color:var(--text-light)">${d.f.slice(5)}</div>
      </div>`).join('')}
  </div>
  <div style="display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--text-light)">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:linear-gradient(135deg,var(--primary),var(--accent));display:inline-block"></span>Total eventos por día</span>
  </div>`;
}

// ── Examen Visual (Óptica) ──
function abrirExamenVisual(pacienteId) {
  document.getElementById('ev-paciente-id').value = pacienteId;
  const campos = ['lm-esf-od','lm-cil-od','lm-eje-od','lm-add-od',
    'lm-esf-oi','lm-cil-oi','lm-eje-oi','lm-add-oi',
    'av-sc-od','av-sc-oi','av-sc-ao','ae-od','ae-oi','ev-cover-obs',
    'ev-moe-obs','ev-ppc','ev-ppa','ev-acomo-obs',
    'rx-esf-od','rx-cil-od','rx-eje-od','rx-add-od',
    'rx-esf-oi','rx-cil-oi','rx-eje-oi','rx-add-oi',
    'pa-dip','pa-dip-od','pa-dip-oi','pa-altura','pa-vertice',
    'pa-pantoscopico','pa-panoramico','pa-horizontal','pa-vertical','pa-diagonal','pa-puente','pa-obs',
    'av-cc-od','av-cc-oi','av-cc-ao','av-cc-obs',
    'ev-rp-obs','ev-bm-obs-od','ev-bm-obs-oi','ev-fo-obs','ev-diagnostico','ev-recomendaciones'];
  campos.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['ev-cover','ev-rp-od','ev-rp-oi','ev-bm-od','ev-bm-oi','ev-fo-od','ev-fo-oi','ev-material'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['tr-blueray','tr-fotocrom','tr-antireflejo','tr-amarillo','tr-polarizado'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.checked=false;
  });
  document.getElementById('ev-correccion').value = 'Ninguna por ahora';
  document.getElementById('modal-examen-visual').classList.add('open');
}

async function guardarExamenVisual() {
  const pid = document.getElementById('ev-paciente-id').value;
  if(!pid){ toast('Error: paciente no encontrado','error'); return; }
  const g = id => (document.getElementById(id)?.value||'').trim();
  const fila = (lbl,val) => val ? `  ${lbl.padEnd(12)}: ${val}` : '';

  const contenido = [
    '╔══════════════════════════════════════╗',
    '║        EXAMEN VISUAL COMPLETO        ║',
    '╚══════════════════════════════════════╝',
    '',
    '▸ LENSOMETRÍA (anteojos actuales)',
    fila('OD Esfera', g('lm-esf-od')), fila('OD Cilindro', g('lm-cil-od')),
    fila('OD Eje', g('lm-eje-od')?g('lm-eje-od')+'°':''), fila('OD Adición', g('lm-add-od')),
    fila('OI Esfera', g('lm-esf-oi')), fila('OI Cilindro', g('lm-cil-oi')),
    fila('OI Eje', g('lm-eje-oi')?g('lm-eje-oi')+'°':''), fila('OI Adición', g('lm-add-oi')),
    '',
    '▸ AGUDEZA VISUAL SIN CORRECCIÓN',
    fila('OD', g('av-sc-od')||'—'), fila('OI', g('av-sc-oi')||'—'), fila('AO', g('av-sc-ao')),
    g('ae-od')||g('ae-oi') ? `  Agujero estenopeico — OD: ${g('ae-od')||'—'}  OI: ${g('ae-oi')||'—'}` : '',
    '',
    '▸ COVER TEST',
    fila('Resultado', g('ev-cover')||'—'),
    fila('Observación', g('ev-cover-obs')),
    '',
    '▸ MOTILIDAD OCULAR EXTRÍNSECA',
    fila('Observaciones', g('ev-moe-obs')||'—'),
    '',
    '▸ EXAMINACIÓN DE ACOMODACIÓN',
    fila('PPC', g('ev-ppc')||'—'), fila('PPA', g('ev-ppa')||'—'),
    fila('Observaciones', g('ev-acomo-obs')),
    '',
    '▸ REFRACCIÓN',
    fila('OD Esfera', g('rx-esf-od')), fila('OD Cilindro', g('rx-cil-od')),
    fila('OD Eje', g('rx-eje-od')?g('rx-eje-od')+'°':''), fila('OD Adición', g('rx-add-od')),
    fila('OI Esfera', g('rx-esf-oi')), fila('OI Cilindro', g('rx-cil-oi')),
    fila('OI Eje', g('rx-eje-oi')?g('rx-eje-oi')+'°':''), fila('OI Adición', g('rx-add-oi')),
    '',
    '▸ PARÁMETROS DE ADAPTACIÓN',
    fila('DIP General', g('pa-dip')?g('pa-dip')+' mm':'—'),
    fila('DIP OD', g('pa-dip-od')?g('pa-dip-od')+' mm':'—'),
    fila('DIP OI', g('pa-dip-oi')?g('pa-dip-oi')+' mm':'—'),
    fila('Altura pupilar', g('pa-altura')?g('pa-altura')+' mm':'—'),
    fila('Dist. al vértice', g('pa-vertice')?g('pa-vertice')+' mm':'—'),
    fila('Áng. pantoscópico', g('pa-pantoscopico')||'—'),
    fila('Áng. panorámico', g('pa-panoramico')||'—'),
    fila('Dist. horizontal', g('pa-horizontal')||'—'),
    fila('Dist. vertical', g('pa-vertical')||'—'),
    fila('Dist. diagonal', g('pa-diagonal')||'—'),
    fila('Puente', g('pa-puente')?g('pa-puente')+' mm':'—'),
    fila('Observaciones', g('pa-obs')),
    '',
    '▸ AGUDEZA VISUAL CON CORRECCIÓN',
    fila('OD', g('av-cc-od')||'—'), fila('OI', g('av-cc-oi')||'—'), fila('AO', g('av-cc-ao')),
    fila('Observaciones', g('av-cc-obs')),
    '',
    '▸ REFLEJOS PUPILARES',
    fila('OD', g('ev-rp-od')||'—'), fila('OI', g('ev-rp-oi')||'—'),
    fila('Observaciones', g('ev-rp-obs')),
    '',
    '▸ BIOMICROSCOPÍA',
    fila('OD', g('ev-bm-od')||'—'), fila('  Obs. OD', g('ev-bm-obs-od')),
    fila('OI', g('ev-bm-oi')||'—'), fila('  Obs. OI', g('ev-bm-obs-oi')),
    '',
    '▸ FONDO DE OJO',
    fila('OD', g('ev-fo-od')||'—'), fila('OI', g('ev-fo-oi')||'—'),
    fila('Observaciones', g('ev-fo-obs')),
    '',
    g('ev-diagnostico') ? `▸ DIAGNÓSTICO\n  ${g('ev-diagnostico')}` : '',
    '',
    `▸ CORRECCIÓN RECOMENDADA\n  ${g('ev-correccion')}`,
    g('ev-material') ? fila('  Material', g('ev-material')) : '',
    (()=>{ const tr=[]; if(document.getElementById('tr-blueray')?.checked) tr.push('Blue Ray'); if(document.getElementById('tr-fotocrom')?.checked) tr.push('Fotocromático'); if(document.getElementById('tr-antireflejo')?.checked) tr.push('Antirreflejo'); if(document.getElementById('tr-amarillo')?.checked) tr.push('Filtro Amarillo'); if(document.getElementById('tr-polarizado')?.checked) tr.push('Polarizado'); return tr.length ? fila('  Tratamientos', tr.join(', ')) : ''; })(),
    g('ev-recomendaciones') ? `\n▸ OBSERVACIONES\n  ${g('ev-recomendaciones')}` : '',
  ].filter(l => l !== '').join('\n');

  setLoading(true);
  const {error} = await sb.from('notas').insert([toN({
    pacienteId: Number(pid), tipo:'examen_visual',
    fecha: hoy(), titulo:`Examen Visual — ${formatFecha(hoy())}`, contenido
  })]);
  setLoading(false);
  if(error){ toast('Error al guardar: '+error.message,'error'); return; }
  toast('Examen visual guardado ✅','success');
  closeModal('modal-examen-visual');
  await loadAll();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
  logActivity('nota');
}

// ── logActivity ──
async function logActivity(accion) {
  if(!currentUser||!currentClinicaId) return;
  sb.from('actividad_usuarios').insert({
    clinica_id: currentClinicaId,
    user_id: currentUser.id || currentUser.email,
    user_nombre: currentUser.name,
    accion,
    fecha: hoy()
  });
}

// ── Modal Clínica ──
function setAdminLogoPreview(src) {
  const box = document.getElementById('cl-logo-preview');
  const btn = document.getElementById('cl-logo-remove');
  if(src) {
    box.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:12px" alt="logo">`;
    if(btn) btn.style.display = 'inline-flex';
  } else {
    box.innerHTML = '🏥';
    if(btn) btn.style.display = 'none';
    document.getElementById('cl-logo-url').value = '';
  }
}

function onAdminLogoSelected(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('cl-logo-url').value = e.target.result;
    setAdminLogoPreview(e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removeAdminLogo() {
  setAdminLogoPreview(null);
}

function openModalClinica() {
  document.getElementById('modal-clinica-title').textContent = '🏥 Nueva Clínica';
  ['cl-nombre','cl-codigo','cl-logo-url','cl-nombre-doctor','cl-especialidad','cl-registro','cl-telefono','cl-direccion','cl-nota-pie'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('cl-tipo').value = 'clinica';
  document.getElementById('cl-activa').value = 'true';
  document.getElementById('cl-max-agendas').value = '10';
  document.getElementById('cl-max-pacientes').value = '500';
  setAdminLogoPreview(null);
  editingClinicaId = null;
  document.getElementById('modal-clinica').classList.add('open');
}

function openModalClinicaEdit(id) {
  const c = adminClinicas.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('modal-clinica-title').textContent = '✏️ Editar Clínica';
  document.getElementById('cl-nombre').value = c.nombre || '';
  document.getElementById('cl-codigo').value = c.codigo || '';
  document.getElementById('cl-tipo').value = c.tipo || 'clinica';
  document.getElementById('cl-activa').value = String(c.activa);
  document.getElementById('cl-max-agendas').value = c.max_agendas ?? 10;
  document.getElementById('cl-max-pacientes').value = c.max_pacientes ?? 500;
  document.getElementById('cl-logo-url').value = c.logo_url || '';
  document.getElementById('cl-nombre-doctor').value = c.nombre_doctor || '';
  document.getElementById('cl-especialidad').value = c.especialidad || '';
  document.getElementById('cl-registro').value = c.registro || '';
  document.getElementById('cl-telefono').value = c.telefono || '';
  document.getElementById('cl-direccion').value = c.direccion || '';
  document.getElementById('cl-nota-pie').value = c.nota_pie || '';
  setAdminLogoPreview(c.logo_url || null);
  editingClinicaId = id;
  document.getElementById('modal-clinica').classList.add('open');
}

async function guardarClinica() {
  const nombre = document.getElementById('cl-nombre').value.trim();
  const codigo = document.getElementById('cl-codigo').value.trim();
  const tipo   = document.getElementById('cl-tipo').value;
  const activa = document.getElementById('cl-activa').value === 'true';
  const max_agendas  = parseInt(document.getElementById('cl-max-agendas').value) || 10;
  const max_pacientes = parseInt(document.getElementById('cl-max-pacientes').value) || 500;
  const logo_url      = document.getElementById('cl-logo-url').value.trim() || null;
  const nombre_doctor = document.getElementById('cl-nombre-doctor').value.trim() || null;
  const especialidad  = document.getElementById('cl-especialidad').value.trim() || null;
  const registro      = document.getElementById('cl-registro').value.trim() || null;
  const telefono      = document.getElementById('cl-telefono').value.trim() || null;
  const direccion     = document.getElementById('cl-direccion').value.trim() || null;
  const nota_pie      = document.getElementById('cl-nota-pie').value.trim() || null;
  if(!nombre||!codigo){ toast('Nombre y código son obligatorios','error'); return; }
  setLoading(true);
  const payload = {nombre,codigo,tipo,activa,max_agendas,max_pacientes,logo_url,nombre_doctor,especialidad,registro,telefono,direccion,nota_pie};
  if(editingClinicaId) {
    const {error} = await sb.from('clinicas').update(payload).eq('id',editingClinicaId);
    if(error){ toast('Error al actualizar: '+error.message,'error'); setLoading(false); return; }
    if(editingClinicaId === currentClinicaId) {
      const {data} = await sb.from('clinicas').select('*').eq('id',currentClinicaId).single();
      if(data) currentClinica = data;
    }
    toast('Clínica actualizada','success');
  } else {
    const {error} = await sb.from('clinicas').insert(payload);
    if(error){ toast('Error al crear: '+error.message,'error'); setLoading(false); return; }
    toast('Clínica creada exitosamente','success');
  }
  closeModal('modal-clinica');
  await loadAdminData();
  renderAdminClinicas();
  renderAdminStats();
  setLoading(false);
}

async function eliminarClinica(id) {
  const c = adminClinicas.find(x=>x.id===id);
  const cnt = adminUsuarios.filter(u=>u.clinica_id===id).length;
  const ok = await customConfirm({
    icon:'🗑️', title:'Eliminar clínica',
    msg: cnt > 0
      ? `La clínica <strong>${c?.nombre}</strong> tiene <strong>${cnt} usuario(s)</strong>.<br><br>Se borrarán <strong>TODOS</strong> sus datos: pacientes, citas, inventario y usuarios.`
      : `¿Eliminar la clínica <strong>${c?.nombre}</strong>?<br><br>Se borrarán <strong>TODOS</strong> sus datos y no se puede deshacer.`,
    okText:'Eliminar clínica', danger:true
  });
  if(!ok) return;
  setLoading(true);
  // Borrar datos relacionados en orden para evitar violaciones de FK
  await sb.from('inventario_movimientos').delete().eq('clinica_id', id);
  await sb.from('inventario').delete().eq('clinica_id', id);
  await sb.from('notas').delete().eq('clinica_id', id);
  await sb.from('medicaciones').delete().eq('clinica_id', id);
  await sb.from('expediente').delete().eq('clinica_id', id);
  await sb.from('citas').delete().eq('clinica_id', id);
  await sb.from('pacientes').delete().eq('clinica_id', id);
  await sb.from('profiles').update({clinica_id: null}).eq('clinica_id', id);
  const {error} = await sb.from('clinicas').delete().eq('id',id);
  if(error){ toast('Error al eliminar: '+error.message,'error'); setLoading(false); return; }
  toast('Clínica eliminada','success');
  await loadAdminData();
  renderAdminClinicas();
  renderAdminStats();
  setLoading(false);
}

// ── Ver Detalle Clínica ──
async function verDetalleClinica(id) {
  const c = adminClinicas.find(x=>x.id===id);
  if(!c) return;
  currentDetalleClinicaId = id;
  detalleTab = 'info';

  // Header
  document.getElementById('detalle-clinica-nombre').textContent = c.nombre;
  document.getElementById('detalle-clinica-codigo').textContent = c.codigo;

  const logoBox = document.getElementById('detalle-clinica-logo-box');
  if(c.logo_url) {
    logoBox.innerHTML = `<img src="${c.logo_url}" alt="Logo">`;
  } else {
    logoBox.innerHTML = `<span style="font-size:30px">🏥</span>`;
  }

  const isProd = c.en_produccion === true;
  document.getElementById('detalle-clinica-prod-badge').style.display = isProd ? 'inline-flex' : 'none';
  const btnProd = document.getElementById('detalle-btn-prod');
  btnProd.textContent = isProd ? '✕ Quitar de Producción' : '★ Marcar en Producción';
  btnProd.className   = isProd ? 'btn btn-danger' : 'btn btn-secondary';
  document.getElementById('detalle-clinica-status-tag').innerHTML = c.activa
    ? '<span class="tag tag-green">Activa</span>'
    : '<span class="tag tag-red">Inactiva</span>';

  // Reset tabs
  ['info','usuarios','actividad'].forEach(t => {
    document.getElementById('detalle-panel-'+t).style.display = t==='info' ? 'block' : 'none';
    document.getElementById('detalle-tab-'+t).classList.toggle('active', t==='info');
  });
  renderDetallePanel('info');

  document.getElementById('modal-clinica-detalle').classList.add('open');

  // Fetch counts async — no loading overlay para no bloquear la UI
  const [rPac, rCit, rCitMes, rInv] = await Promise.all([
    sb.from('pacientes').select('*',{count:'exact',head:true}).eq('clinica_id',id),
    sb.from('citas').select('*',{count:'exact',head:true}).eq('clinica_id',id),
    sb.from('citas').select('*',{count:'exact',head:true}).eq('clinica_id',id).gte('fecha',hoy().slice(0,7)+'-01'),
    sb.from('inventario').select('*',{count:'exact',head:true}).eq('clinica_id',id)
  ]);
  const nPac   = rPac.count  || 0;
  const nCit   = rCit.count  || 0;
  const nCitM  = rCitMes.count || 0;
  const nInv   = rInv.count  || 0;
  const nUsers = adminUsuarios.filter(u=>u.clinica_id===id).length;

  const sEl = document.getElementById('detalle-stats-row');
  if(sEl) sEl.innerHTML = `
    <div class="admin-stat"><div class="admin-stat-icon">👤</div><div><div class="admin-stat-val">${nPac}</div><div class="admin-stat-label">Pacientes</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📅</div><div><div class="admin-stat-val">${nCit}</div><div class="admin-stat-label">Citas totales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📆</div><div><div class="admin-stat-val">${nCitM}</div><div class="admin-stat-label">Citas este mes</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📦</div><div><div class="admin-stat-val">${nInv}</div><div class="admin-stat-label">Productos inv.</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👥</div><div><div class="admin-stat-val">${nUsers}</div><div class="admin-stat-label">Usuarios</div></div></div>`;
}

function switchDetalleTab(tab) {
  detalleTab = tab;
  ['info','usuarios','actividad'].forEach(t => {
    document.getElementById('detalle-panel-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('detalle-tab-'+t).classList.toggle('active', t===tab);
  });
  renderDetallePanel(tab);
}

function renderDetallePanel(tab) {
  const id = currentDetalleClinicaId;
  const c  = adminClinicas.find(x=>x.id===id);
  if(!c) return;

  if(tab === 'info') {
    const f = (lbl,val) => `<div class="form-group"><label style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">${lbl}</label><div class="field-val">${val||'<span style="color:var(--text-light)">—</span>'}</div></div>`;
    document.getElementById('detalle-panel-info').innerHTML = `
      <div class="clinica-detail-grid">
        ${f('Doctor / Responsable', c.nombre_doctor)}
        ${f('Especialidad', c.especialidad)}
        ${f('Registro médico', c.registro)}
        ${f('Teléfono', c.telefono)}
        ${f('Tipo', c.tipo||'clinica')}
        ${f('Máx. agendas / pacientes', `${c.max_agendas??10} / ${c.max_pacientes??500}`)}
        <div class="form-group full"><label style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">Dirección</label><div class="field-val">${c.direccion||'<span style="color:var(--text-light)">—</span>'}</div></div>
        <div class="form-group full"><label style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">Nota de pie (PDFs/facturas)</label><div class="field-val" style="font-size:12px;font-style:italic">${c.nota_pie||'<span style="color:var(--text-light)">—</span>'}</div></div>
      </div>`;
  }

  if(tab === 'usuarios') {
    const usuarios = adminUsuarios.filter(u=>u.clinica_id===id);
    const rolLabel = r => ({admin:'Administrador',medico:'Médico',recepcion:'Recepcionista',enfermeria:'Enfermería'}[r]||r);
    const rolTag   = r => ({admin:'tag-blue',medico:'tag-cyan',recepcion:'tag-orange',enfermeria:'tag-green'}[r]||'tag-gray');
    document.getElementById('detalle-panel-usuarios').innerHTML = usuarios.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th></tr></thead>
          <tbody>${usuarios.map(u=>`<tr>
            <td><div class="patient-name-cell">
              <div class="patient-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent));font-size:18px;width:34px;height:34px">${u.icono||'👤'}</div>
              <strong>${u.nombre}</strong>
            </div></td>
            <td style="font-size:12px;color:var(--text-light)">${u.email||'—'}</td>
            <td><span class="tag ${rolTag(u.rol)}">${rolLabel(u.rol)}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : `<div class="empty-state"><div class="empty-icon">👥</div><p>Sin usuarios asignados a esta clínica</p></div>`;
  }

  if(tab === 'actividad') {
    const usuarios = adminUsuarios.filter(u=>u.clinica_id===id);
    const uids = new Set(usuarios.map(u=>u.id));
    const acts = adminActividad.filter(a=>uids.has(a.user_id));
    const logins    = acts.filter(a=>a.accion==='login').length;
    const pacActs   = acts.filter(a=>a.accion==='paciente').length;
    const citaActs  = acts.filter(a=>a.accion==='cita').length;
    const notaActs  = acts.filter(a=>a.accion==='nota').length;

    const diasNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const dias = Array.from({length:7},(_,i)=>{
      const d = new Date(); d.setDate(d.getDate()-6+i); return d.toISOString().split('T')[0];
    });
    const porDia = dias.map(f=>({
      f, nom:diasNom[new Date(f+'T12:00:00').getDay()],
      total: acts.filter(a=>a.fecha===f).length
    }));
    const maxT = Math.max(...porDia.map(d=>d.total),1);

    document.getElementById('detalle-panel-actividad').innerHTML = `
      <div class="admin-stat-row" style="margin-bottom:18px">
        <div class="admin-stat"><div class="admin-stat-icon">🔑</div><div><div class="admin-stat-val">${logins}</div><div class="admin-stat-label">Logins registrados</div></div></div>
        <div class="admin-stat"><div class="admin-stat-icon">👤</div><div><div class="admin-stat-val">${pacActs}</div><div class="admin-stat-label">Altas de pacientes</div></div></div>
        <div class="admin-stat"><div class="admin-stat-icon">📅</div><div><div class="admin-stat-val">${citaActs}</div><div class="admin-stat-label">Citas agendadas</div></div></div>
        <div class="admin-stat"><div class="admin-stat-icon">📝</div><div><div class="admin-stat-val">${notaActs}</div><div class="admin-stat-label">Notas médicas</div></div></div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">Actividad últimos 7 días</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:110px;padding:0 4px">
        ${porDia.map(d=>`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
            <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;width:100%">
              <div style="width:100%;background:linear-gradient(to top,var(--primary),var(--accent));border-radius:5px 5px 0 0;height:${Math.max(d.total?Math.round(d.total/maxT*85):0,0)}%;min-height:${d.total?'4px':'0'};position:relative">
                ${d.total?`<div style="position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:var(--primary)">${d.total}</div>`:''}
              </div>
            </div>
            <div style="font-size:9px;font-weight:700;color:var(--text-light);text-transform:uppercase">${d.nom}</div>
            <div style="font-size:9px;color:var(--text-light)">${d.f.slice(5)}</div>
          </div>`).join('')}
      </div>
      ${!acts.length?'<div style="text-align:center;color:var(--text-light);font-size:13px;margin-top:16px;padding:20px">Sin actividad registrada para esta clínica</div>':''}`;
  }
}

async function setClinicaProduccion(id) {
  const c = adminClinicas.find(x=>x.id===id);
  if(!c) return;
  const nuevoEstado = !(c.en_produccion === true);
  const ok = await customConfirm({
    icon: nuevoEstado ? '🚀' : '✕',
    title: nuevoEstado ? 'Marcar en producción' : 'Quitar de producción',
    msg: nuevoEstado
      ? `¿Marcar <strong>${c.nombre}</strong> como clínica en producción?<br><small style="color:var(--text-light)">Varias clínicas pueden estar en producción al mismo tiempo.</small>`
      : `¿Quitar <strong>${c.nombre}</strong> del estado de producción?`,
    okText: nuevoEstado ? 'Marcar en producción' : 'Quitar',
    danger: !nuevoEstado
  });
  if(!ok) return;
  setLoading(true);
  const {error} = await sb.from('clinicas').update({en_produccion: nuevoEstado}).eq('id', id);
  if(error) {
    setLoading(false);
    toast('Ejecuta este SQL en Supabase → SQL Editor:\nALTER TABLE clinicas ADD COLUMN IF NOT EXISTS en_produccion BOOLEAN DEFAULT FALSE;', 'error');
    return;
  }
  await loadAdminData();
  renderAdminClinicas();
  // Actualizar modal abierto
  document.getElementById('detalle-clinica-prod-badge').style.display = nuevoEstado ? 'inline-flex' : 'none';
  const btnProd = document.getElementById('detalle-btn-prod');
  btnProd.textContent = nuevoEstado ? '✕ Quitar de Producción' : '★ Marcar en Producción';
  btnProd.className   = nuevoEstado ? 'btn btn-danger' : 'btn btn-secondary';
  toast(nuevoEstado ? `"${c.nombre}" marcada en producción` : `"${c.nombre}" quitada de producción`, 'success');
  setLoading(false);
}

// ── Modal Usuario ──
function fillClinicaSelect(selectedId) {
  document.getElementById('u-clinica').innerHTML =
    '<option value="">Sin clínica</option>' +
    adminClinicas.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.nombre}</option>`).join('');
}

function selectIcon(btn) {
  document.querySelectorAll('#u-icono-grid .icon-opt').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('u-icono').value = btn.dataset.icon;
}

function openModalUsuario() {
  document.getElementById('modal-usuario-title').textContent = '👤 Nuevo Usuario';
  document.getElementById('u-nombre').value = '';
  document.getElementById('u-email').value = '';
  document.getElementById('u-rol').value = 'medico';
  document.getElementById('u-icono').value = '👨‍⚕️';
  document.getElementById('u-password').value = '';
  document.getElementById('u-pass-req').style.display = 'inline';
  document.getElementById('u-pass-hint').style.display = 'none';
  document.querySelectorAll('#u-icono-grid .icon-opt').forEach((b,i)=>b.classList.toggle('selected',i===0));
  fillClinicaSelect(null);
  editingUsuarioId = null;
  document.getElementById('modal-usuario').classList.add('open');
}

function openModalUsuarioEditById(id) {
  const u = adminUsuarios.find(x=>x.id===id);
  if(!u) return;
  document.getElementById('modal-usuario-title').textContent = '✏️ Editar Usuario';
  document.getElementById('u-nombre').value = u.nombre;
  document.getElementById('u-email').value = u.email||'';
  document.getElementById('u-rol').value = u.rol;
  document.getElementById('u-icono').value = u.icono||'👨‍⚕️';
  document.getElementById('u-password').value = '';
  document.getElementById('u-pass-req').style.display = 'none';
  document.getElementById('u-pass-hint').style.display = 'block';
  document.querySelectorAll('#u-icono-grid .icon-opt').forEach(b=>{
    b.classList.toggle('selected', b.dataset.icon===(u.icono||'👨‍⚕️'));
  });
  fillClinicaSelect(u.clinica_id);
  editingUsuarioId = u.id;
  document.getElementById('modal-usuario').classList.add('open');
}

async function guardarUsuario() {
  const nombre = document.getElementById('u-nombre').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const rol = document.getElementById('u-rol').value;
  const icono = document.getElementById('u-icono').value;
  const password = document.getElementById('u-password').value;
  const clinicaVal = document.getElementById('u-clinica').value;
  const clinica_id = clinicaVal ? Number(clinicaVal) : null;
  if(!nombre){ toast('El nombre es obligatorio','error'); return; }
  if(!editingUsuarioId && !password){ toast('La contraseña es obligatoria','error'); return; }
  setLoading(true);
  if(editingUsuarioId) {
    const upd = {nombre,email:email||null,rol,icono,clinica_id};
    if(password) upd.password = password;
    const {error} = await sb.from('profiles').update(upd).eq('id',editingUsuarioId);
    if(error){ toast('Error al actualizar: '+error.message,'error'); setLoading(false); return; }
    toast('Usuario actualizado','success');
  } else {
    // Crear en Supabase Auth y restaurar sesión del super admin
    const { data: { session: adminSess } } = await sb.auth.getSession();
    const { data: newAuth, error: authErr } = await sb.auth.signUp({ email, password });
    if(adminSess) await sb.auth.setSession(adminSess);
    if(authErr){ toast('Error Auth: '+authErr.message,'error'); setLoading(false); return; }
    const newId = newAuth?.user?.id || crypto.randomUUID();
    const {error} = await sb.from('profiles').insert({id:newId,nombre,email:email||null,rol,icono,clinica_id,password});
    if(error){ toast('Error al crear: '+error.message,'error'); setLoading(false); return; }
    toast('Usuario creado exitosamente','success');
  }
  closeModal('modal-usuario');
  await loadAdminData();
  renderAdminUsuarios();
  renderAdminStats();
  setLoading(false);
}

async function eliminarUsuario(id) {
  const u = adminUsuarios.find(x=>x.id===id);
  const ok=await customConfirm({icon:'👤',title:'Eliminar usuario',msg:`¿Eliminar el usuario <strong>${u?.nombre}</strong>?<br><br>Esta acción no se puede deshacer.`,okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error} = await sb.from('profiles').delete().eq('id',id);
  if(error){ toast('Error al eliminar: '+error.message,'error'); setLoading(false); return; }
  toast('Usuario eliminado','success');
  await loadAdminData();
  renderAdminUsuarios();
  renderAdminStats();
  setLoading(false);
}

// ════════════════════ ESTADÍSTICAS ════════════════════
function descargarPDFEstadisticas() {
  const cfg = getClinicaConfig();
  let titulo='', citas=[], periodo='';
  if(estTab==='dia'){
    const fecha=document.getElementById('est-dia-fecha').value||hoy();
    titulo=`Estadísticas Diarias`; periodo=formatFecha(fecha);
    citas=C.c.filter(c=>c.fecha===fecha);
  } else if(estTab==='semana'){
    const val=document.getElementById('est-semana-fecha').value||'';
    const [yr,wk]=val.split('-W').map(Number);
    const lunes=new Date(yr,0,1+(wk-1)*7);
    lunes.setDate(lunes.getDate()-(lunes.getDay()||7)+1);
    const dom=new Date(lunes); dom.setDate(lunes.getDate()+6);
    const s=d=>d.toISOString().split('T')[0];
    const dias=Array.from({length:7},(_,i)=>{const d=new Date(lunes);d.setDate(d.getDate()+i);return s(d);});
    titulo='Estadísticas Semanales'; periodo=`${formatFecha(s(lunes))} al ${formatFecha(s(dom))}`;
    citas=C.c.filter(c=>dias.includes(c.fecha));
  } else {
    const val=document.getElementById('est-mes-fecha').value||hoy().slice(0,7);
    const [yr,mo]=val.split('-');
    periodo=new Date(yr,mo-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
    titulo='Estadísticas Mensuales';
    citas=C.c.filter(c=>c.fecha.startsWith(val));
  }
  const atendidos=citas.filter(c=>c.estado==='completada');
  const canceladas=citas.filter(c=>c.estado==='cancelada');
  const pendientes=citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  const pct=citas.length?Math.round(atendidos.length/citas.length*100):0;
  const tipos=['consulta','control','urgencia','cirugia','examen'];
  const porTipo=tipos.map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  const maxT=porTipo.length?Math.max(...porTipo.map(d=>d.v),1):1;
  const freq={};
  citas.forEach(c=>{freq[c.pacienteId]=(freq[c.pacienteId]||0)+1;});
  const topP=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,v])=>{
    const p=C.p.find(x=>x.id==id); return {k:p?p.nombre+' '+p.apellidos:'#'+id,v};
  });
  const maxP=topP.length?Math.max(...topP.map(d=>d.v),1):1;

  const body=`
    <div style="margin-bottom:20px">
      <div style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:4px">${titulo}</div>
      <div style="font-size:13px;color:#64748B;font-weight:600">Período: ${periodo}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi blue"><div class="kpi-val">${citas.length}</div><div class="kpi-lbl">Total citas</div></div>
      <div class="kpi green"><div class="kpi-val">${atendidos.length}</div><div class="kpi-lbl">Atendidos (${pct}%)</div></div>
      <div class="kpi orange"><div class="kpi-val">${pendientes.length}</div><div class="kpi-lbl">Pendientes</div></div>
      <div class="kpi red"><div class="kpi-val">${canceladas.length}</div><div class="kpi-lbl">Canceladas</div></div>
    </div>
    ${porTipo.length?`<div class="section-title">📊 Distribución por tipo de consulta</div>
    <div style="margin-bottom:20px">${porTipo.map(d=>`<div class="bar-row">
      <div class="bar-lbl" style="text-transform:capitalize">${d.k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.v/maxT*100)}%"><span>${d.v}</span></div></div>
      <div class="bar-val">${d.v}</div>
    </div>`).join('')}</div>`:''}
    ${topP.length?`<div class="section-title">👥 Pacientes más frecuentes</div>
    <div style="margin-bottom:20px">${topP.map(d=>`<div class="bar-row">
      <div class="bar-lbl">${d.k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.v/maxP*100)}%;background:linear-gradient(90deg,#7C3AED,#06B6D4)"><span>${d.v}</span></div></div>
      <div class="bar-val">${d.v}</div>
    </div>`).join('')}</div>`:''}
    ${citas.length?`<div class="section-title">📋 Detalle de citas</div>
    <table><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th></tr></thead>
    <tbody>${citas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||'')).map(c=>{
      const p=C.p.find(x=>x.id===c.pacienteId);
      const stCls={completada:'tag-green',cancelada:'tag-red',pendiente:'tag-orange',confirmada:'tag-cyan'}[c.estado]||'tag-gray';
      return `<tr><td>${formatFecha(c.fecha)}</td><td>${c.hora||'—'}</td><td>${p?p.nombre+' '+p.apellidos:'—'}</td><td><span class="tag tag-blue" style="text-transform:capitalize">${c.tipo}</span></td><td><span class="tag ${stCls}">${c.estado}</span></td></tr>`;
    }).join('')}</tbody></table>`:'<p style="color:#94A3B8;text-align:center;padding:20px">Sin citas en este período</p>'}`;

  pdfAbrir(titulo+' — '+periodo, body, cfg);
}

function descargarPDFInventario() {
  const cfg = getClinicaConfig();
  const now = new Date();
  const mesActual = hoy().slice(0,7);
  const yrActual = now.getFullYear().toString();
  const movMes = C.mov.filter(m=>m.fecha.startsWith(mesActual));
  const movYear = C.mov.filter(m=>m.fecha.startsWith(yrActual));
  const totEntMes = movMes.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.cantidad,0);
  const totSalMes = movMes.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.cantidad,0);
  const totEntYear = movYear.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.cantidad,0);
  const totSalYear = movYear.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.cantidad,0);
  const bajoStock = C.inv.filter(p=>p.stockMin>0&&p.stock<=p.stockMin);
  const sinStock  = C.inv.filter(p=>p.stock===0);
  const catIcon   = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  const nomMes = now.toLocaleDateString('es-ES',{month:'long',year:'numeric'});

  const body=`
    <div style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:4px">Control de Inventario</div>
    <div style="font-size:13px;color:#64748B;font-weight:600;margin-bottom:20px">${cfg.nombreClinica||'Lumea Med'} · Generado: ${new Date().toLocaleString('es-ES')}</div>

    <div class="kpi-grid">
      <div class="kpi blue"><div class="kpi-val">${C.inv.length}</div><div class="kpi-lbl">Total productos</div></div>
      <div class="kpi green"><div class="kpi-val">${totEntMes}</div><div class="kpi-lbl">Entradas este mes</div></div>
      <div class="kpi orange"><div class="kpi-val">${totSalMes}</div><div class="kpi-lbl">Salidas este mes</div></div>
      <div class="kpi red"><div class="kpi-val">${bajoStock.length}</div><div class="kpi-lbl">Bajo stock / sin stock (${sinStock.length})</div></div>
    </div>

    <div class="section-title">📊 Resumen anual ${yrActual}</div>
    <div style="margin-bottom:20px;display:flex;gap:20px">
      <div style="flex:1;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#15803D">${totEntYear}</div>
        <div style="font-size:11px;color:#166534;margin-top:3px;font-weight:600">TOTAL ENTRADAS ${yrActual}</div>
      </div>
      <div style="flex:1;background:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#B91C1C">${totSalYear}</div>
        <div style="font-size:11px;color:#B91C1C;margin-top:3px;font-weight:600">TOTAL SALIDAS ${yrActual}</div>
      </div>
      <div style="flex:1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#1D4ED8">${movYear.length}</div>
        <div style="font-size:11px;color:#1D4ED8;margin-top:3px;font-weight:600">MOVIMIENTOS TOTALES ${yrActual}</div>
      </div>
    </div>

    <div class="section-title">📦 Catálogo de productos — Estado actual</div>
    <table><thead><tr><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock actual</th><th>Mínimo</th><th>Estado</th></tr></thead>
    <tbody>${C.inv.map(p=>{
      const st=p.stock===0?['tag-red','Sin stock']:p.stockMin>0&&p.stock<=p.stockMin?['tag-orange','Bajo stock']:['tag-green','OK'];
      return `<tr><td><strong>${catIcon(p.categoria)} ${p.nombre}</strong>${p.descripcion?`<div style="font-size:10px;color:#94A3B8">${p.descripcion}</div>`:''}</td><td style="text-transform:capitalize">${p.categoria}</td><td>${p.unidad}</td><td><strong>${p.stock}</strong></td><td>${p.stockMin||'—'}</td><td><span class="tag ${st[0]}">${st[1]}</span></td></tr>`;
    }).join('')}</tbody></table>

    ${bajoStock.length?`<div class="section-title" style="color:#B91C1C">⚠️ Alertas de stock</div>
    <table><thead><tr><th>Producto</th><th>Stock actual</th><th>Mínimo</th><th>Faltante</th></tr></thead>
    <tbody>${bajoStock.map(p=>`<tr style="background:#FEF2F2">
      <td><strong>${p.nombre}</strong></td>
      <td style="color:${p.stock===0?'#B91C1C':'#B45309'};font-weight:800">${p.stock}</td>
      <td>${p.stockMin}</td>
      <td style="color:#B91C1C;font-weight:700">${Math.max(0,p.stockMin-p.stock)} ${p.unidad}(s)</td>
    </tr>`).join('')}</tbody></table>`:''}

    <div class="section-title">🔄 Últimos movimientos del mes — ${nomMes}</div>
    ${movMes.length?`<table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th></tr></thead>
    <tbody>${movMes.slice(0,30).map(m=>{
      const p=C.inv.find(x=>x.id===m.invId);
      return `<tr><td>${formatFecha(m.fecha)}</td><td>${p?p.nombre:'—'}</td><td><span class="tag ${m.tipo==='entrada'?'tag-green':'tag-red'}">${m.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td><td><strong>${m.cantidad}</strong></td><td style="color:#64748B">${m.motivo||'—'}</td></tr>`;
    }).join('')}</tbody></table>`:'<p style="color:#94A3B8;text-align:center;padding:16px">Sin movimientos este mes</p>'}`;

  pdfAbrir('Control de Inventario — '+nomMes, body, cfg);
}

// ════════════════════ MIGRACIÓN A SUPABASE AUTH ════════════════════
async function verificarEstadoAuth() {
  const { data: profiles } = await sb.from('profiles').select('id,email,nombre,password');
  if(!profiles) return;
  const conAuth = profiles.filter(p => !p.password || p.password === '');
  const sinAuth = profiles.filter(p => p.password && p.password !== '');
  const badge = document.getElementById('auth-status-badge');
  const prog  = document.getElementById('migracion-progress');
  if(sinAuth.length === 0) {
    if(badge) { badge.textContent = '✅ Migrado'; badge.className = 'tag tag-green'; }
    if(prog) prog.textContent = `Todos los usuarios (${profiles.length}) usan Supabase Auth.`;
  } else {
    if(badge) { badge.textContent = 'Pendiente'; badge.className = 'tag tag-orange'; }
    if(prog) prog.textContent = `${conAuth.length}/${profiles.length} migrados. ${sinAuth.length} pendiente(s).`;
  }
}

async function migrarUsuariosAAuth() {
  const { data: profiles, error } = await sb.from('profiles').select('*');
  if(error || !profiles?.length) { toast('No se pudieron cargar los perfiles','error'); return; }

  const pendientes = profiles.filter(p => p.password && p.email);
  if(!pendientes.length) { toast('Todos los usuarios ya están migrados ✅','success'); return; }

  const ok = await customConfirm({
    icon: '🔐', title: 'Migrar a Supabase Auth',
    msg: `Se van a migrar <strong>${pendientes.length} usuario(s)</strong> al sistema de Auth seguro.<br><br>
          <strong>Antes de continuar:</strong> en Supabase → Authentication → Settings → Email → desactiva <em>"Confirm email"</em>.`,
    okText: 'Migrar ahora', danger: false
  });
  if(!ok) return;

  const log = document.getElementById('migracion-log');
  const prog = document.getElementById('migracion-progress');
  if(log) { log.style.display = 'block'; log.innerHTML = ''; }

  const addLog = (msg, ok=true) => {
    if(log) log.innerHTML += `<div style="color:${ok?'#10B981':'#EF4444'}">${msg}</div>`;
  };

  let migrados = 0, errores = 0;
  const { data: { session: adminSess } } = await sb.auth.getSession();

  for(const p of pendientes) {
    if(prog) prog.textContent = `Migrando ${migrados + errores + 1}/${pendientes.length}...`;
    const { data: newAuth, error: authErr } = await sb.auth.signUp({ email: p.email, password: p.password });
    // Restaurar sesión del super admin inmediatamente
    if(adminSess) await sb.auth.setSession(adminSess);

    if(authErr) {
      if(authErr.message.includes('already registered')) {
        addLog(`⚠️ ${p.email} — ya existe en Auth (OK)`);
        migrados++;
      } else {
        addLog(`❌ ${p.email} — ${authErr.message}`, false);
        errores++;
      }
      continue;
    }

    const newId = newAuth?.user?.id;
    if(newId && newId !== p.id) {
      await sb.from('profiles').update({ id: newId, password: null }).eq('id', p.id);
    } else {
      await sb.from('profiles').update({ password: null }).eq('id', p.id);
    }
    addLog(`✅ ${p.nombre} (${p.email}) — migrado`);
    migrados++;
  }

  if(prog) prog.textContent = `Completado: ${migrados} migrados, ${errores} error(es).`;
  toast(`Migración completada: ${migrados} usuario(s) migrados`, migrados > 0 ? 'success' : 'warning');
  await loadAdminData();
  await verificarEstadoAuth();
}

// ════════════════════ DATE PICKERS ════════════════════
const fpEs = {
  firstDayOfWeek: 1,
  weekdays: {
    shorthand: ['Do','Lu','Ma','Mi','Ju','Vi','Sa'],
    longhand:  ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  },
  months: {
    shorthand: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  }
};

function initDatePickers() {
  if(typeof flatpickr === 'undefined') return;
  document.querySelectorAll('input[type="date"]').forEach(el => {
    if(el._flatpickr) return;
    const isBirthDate = el.id === 'p-fechanac';
    flatpickr(el, {
      locale:        fpEs,
      dateFormat:    'Y-m-d',
      allowInput:    true,
      disableMobile: true,
      maxDate:       isBirthDate ? 'today' : null,
      minDate:       isBirthDate ? '1900-01-01' : null,
      defaultDate:   el.value || null,
      prevArrow:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>',
      nextArrow:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>',
      onReady(_, __, fp) {
        fp.calendarContainer.style.fontFamily = "'Inter', sans-serif";
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', initDatePickers);
