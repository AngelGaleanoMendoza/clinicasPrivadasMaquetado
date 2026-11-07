// Lumi como instructivo contra errores: qué mensaje reconoce, qué ofrece el
// aviso, qué ve cada usuario en el panel, la búsqueda y cómo se ve.
// Ejecutar con PLAYWRIGHT_MODULE apuntando a una instalación de playwright.
// PLAYWRIGHT_CHROMIUM permite usar un Chromium propio en vez del canal msedge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');

function extraer(name) {
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  let abiertas=0;
  for(const ch of primeraLinea) { if(ch==='{') abiertas++; else if(ch==='}') abiertas--; }
  if(abiertas===0 && primeraLinea.includes('{')) return primeraLinea;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
// La sección completa de Lumi, tal como está en app.js.
const ini=source.indexOf('// ════════════════════ LUMI: AYUDA CUANDO ALGO FALLA');
const fin=source.indexOf('// ════════════════════ NAVIGATION',ini);
assert(ini>0&&fin>ini,'No se encontró la sección de Lumi');
const lumi=source.slice(ini,fin);
const topbar=html.slice(html.indexOf('<div class="topbar">'),html.indexOf('<div id="search-dropdown"'));

const preambulo=`
  let currentUser={id:'u1',name:'Ana Ruiz',role:'Recepción',email:'ana@clinica.test'};
  let currentView='finanzas', currentClinicaId=7, currentClinica={nombre:'Clínica Demo'};
  let superAdmin=false;
  const isSuperAdmin=()=>superAdmin;
  const GUIAS_MODULOS={pacientes:{nombre:'Pacientes',pasos:[]}};
  let _guiaModulo={activa:false};
  const _cerrarGuiaModulo=()=>{};
  window.__acciones=[];
  const iniciarGuiaModulo=(m)=>window.__acciones.push('recorrido:'+m);
  const navigate=async v=>{currentView=v;window.__acciones.push('navigate:'+v);};
  const switchAdminTab=t=>window.__acciones.push('tab:'+t);
  const toggleSidebar=()=>window.__acciones.push('sidebar');
  const doLogout=(c)=>window.__acciones.push('logout:'+(c===true));
  let respuestaConfirm=true;
  const customConfirm=async o=>{window.__acciones.push('confirm:'+o.title);return respuestaConfirm;};
  const guardarBorradoresSesion=()=>window.__acciones.push('borradores');
  ${extraer('escAttr')}
  ${extraer('toast')}
  ${lumi}
  window.__set=o=>{ if('confirm' in o) respuestaConfirm=o.confirm; if('sa' in o) superAdmin=o.sa; if('user' in o) currentUser=o.user; if('view' in o) currentView=o.view; if('clinica' in o) currentClinicaId=o.clinica; };
  Object.assign(window,{_lumiBuscarAyuda,_lumiBuscarTexto,_lumiRegistrar,_lumiOlvidar,_lumiAlEntrar,_lumiDato,_lumiAccion,abrirLumi,cerrarLumi,toast,
    LUMI_AYUDAS,LUMI_PROBLEMAS,LUMI_NO_RECONOCIDO,_lumiErroresLista:()=>_lumiErrores,_lumiFrecuentes});
`;
const pagina=`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>
  <div class="main">${topbar}</div>
  <aside id="sidebar"><select id="sa-clinica-select"></select></aside>
  <p id="login-error" style="display:none">Email o contraseña incorrectos</p>
  <button class="login-lumi" type="button">✦ ¿No puedes entrar?</button>
  <div class="toast-container" id="toasts"></div>
</body></html>`;

// Una página con origen real: sessionStorage no existe en about:blank.
const abrir=async(p)=>{
  await p.route('http://lumi.test/**',r=>r.fulfill({contentType:'text/html; charset=utf-8',body:pagina}));
  await p.goto('http://lumi.test/');
  await p.addScriptTag({content:preambulo});
};

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

// Mensajes reales del sistema y de Supabase → ayuda que les toca.
const CASOS=[
  ['new row violates row-level security policy for table "pacientes"','permiso-servidor'],
  ['permission denied for table citas','permiso-servidor'],
  ['Supabase no reconoce esta sesión para la clínica activa. Vuelve a iniciar sesión y verifica la política RLS de procedimientos clínicos.','permiso-servidor'],
  ['duplicate key value violates unique constraint "pacientes_identificacion_key"','duplicado'],
  ['Ya existe un paciente con esa identificación: Ana Ruiz','duplicado'],
  ['insert or update on table "citas" violates foreign key constraint "citas_paciente_id_fkey"','dato-ligado'],
  ['invalid input syntax for type integer: "abc"','dato-invalido'],
  ['null value in column "nombre" of relation "pacientes" violates not-null constraint','dato-invalido'],
  ['value too long for type character varying(20)','dato-invalido'],
  ["Could not find the 'duracion_min' column of 'citas' in the schema cache",'falta-migracion'],
  ['column citas.duracion_min does not exist','falta-migracion'],
  ['relation "public.examenes" does not exist','falta-migracion'],
  ['Falta ejecutar migracion_balance_manual.sql en Supabase para poder cambiar de modo.','falta-migracion'],
  ['Factura creada, pero falta ejecutar migracion_balance_reparto.sql: el balance usará el porcentaje actual','falta-migracion'],
  ['Falta ejecutar el script de veterinaria en Supabase (tabla vacunas_mascota)','falta-migracion'],
  ['Ejecuta este SQL en Supabase → SQL Editor: ALTER TABLE clinicas ADD COLUMN en_produccion BOOLEAN','falta-migracion'],
  ['Factura creada pero error al guardar ítems: algo','factura-error'],
  ['Error al generar factura','factura-error'],
  ['JWT expired','sesion-vencida'],
  ['Tu sesión de Supabase venció. Cierra sesión y vuelve a ingresar antes de guardar.','sesion-vencida'],
  ['TypeError: Failed to fetch','sin-conexion'],
  ['Error conectando con la base de datos','sin-conexion'],
  ['Sin internet: lo que guardes ahora puede no llegar al servidor.','sin-conexion'],
  ['canceling statement due to statement timeout','tardo-demasiado'],
  ['⚠️ La consulta tardó demasiado. Revisa la conexión y pulsa Actualizar.','tardo-demasiado'],
  ['No se pudo generar el PDF: el documento tardó demasiado en cargar. Puedes usar Imprimir → Guardar como PDF.','pdf-fallo'],
  ['No se pudo generar el PDF: no se pudieron cargar las herramientas de PDF, revisa la conexión.','pdf-fallo'],
  ['El navegador bloqueó la ventana de impresión','ventana-bloqueada'],
  ['No se pudo cargar el lector de DOCX. Revisa la conexión e inténtalo de nuevo.','machote-word'],
  ['Finaliza la nota antes de imprimirla','nota-finalizar'],
  ['Solo se admiten archivos PDF, JPG o PNG','archivo-formato'],
  ['El archivo supera los 10 MB','archivo-formato'],
  ['The object exceeded the maximum allowed size','archivo-formato'],
  ['No se pudo subir el archivo: Bucket not found','archivo-subida'],
  ['Solo el Super Admin puede quitar una agenda','sin-permiso'],
  ['No tienes el permiso "Finanzas". Pídeselo al Super Admin desde el panel de Usuarios.','sin-permiso'],
  ['Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','sin-clinica-usuario'],
  ['Elige primero una clínica en el selector de la barra lateral: sin ella el dato se guardaría sin dueño.','sin-clinica-sa'],
  ['Email o contraseña incorrectos. Te quedan 2 intentos.','login-credenciales'],
  ['🔒 Tu cuenta ha sido bloqueada tras 3 intentos fallidos. Contacta al Super Admin para desbloquearla.','login-bloqueado'],
  ['Tu contraseña es correcta, pero no se pudo cargar tu perfil. Ejecuta recuperacion_auth.sql (bloques 1 y 5).','login-perfil'],
  ['El servicio de autenticación del servidor no responde.','login-servicio'],
  ['Usuario sin permisos. Tu usuario solo puede usar el sistema desde la red de la clínica.','red-clinica'],
  ['La función «cambiar-password» no respondió desde este proyecto.','funcion-password'],
  ['No se pudo contactar la función «cambiar-password». Si ya la desplegaste, desactiva «Verify JWT»','funcion-password'],
  ['Stock insuficiente','stock-insuficiente'],
  ['Le quedan 3 cita(s) sin atender. No se cancelan solas: reasígnalas o usa Vaciar agenda antes.','agenda-pendientes'],
  ['Paciente no encontrado','registro-no-encontrado'],
  ['Ingresa tu email y contraseña','campos-obligatorios'],
  ['La contraseña coincide con el perfil antiguo, pero no con Supabase Auth.','login-perfil-antiguo'],
  ['Stock disponible: 3','stock-insuficiente'],
  ['No se pueden agendar citas en fechas pasadas','cita-pasada'],
  ['No se pudo importar: El archivo pertenece a Clínica Norte. Selecciónala antes de importar.','respaldo'],
  ['«Consulta» ya está en la lista','ya-en-lista'],
  ['No se pudo cambiar la contraseña: Tu sesión no es válida','sesion-vencida'],
  ['Sin clínica','sin-clinica-usuario'],
  ['No es una IP válida','red-ip'],
  ["Error inesperado en la página: Cannot read properties of undefined (reading 'id')",'error-inesperado'],
  ['Cita guardada correctamente',null],
];

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await abrir(page);

    // ── Reconocimiento ──
    const res=await page.evaluate(c=>c.map(([m])=>window._lumiBuscarAyuda(m)?.id||null),CASOS);
    CASOS.forEach(([m,esperado],i)=>assert.equal(res[i],esperado,`«${m}» debería ser ${esperado}, salió ${res[i]}`));
    const ids=await page.evaluate(()=>[...LUMI_AYUDAS,...LUMI_PROBLEMAS].map(a=>a.id));
    assert.equal(new Set(ids).size,ids.length,'Cada ayuda tiene un id único');
    const huecos=await page.evaluate(()=>[...LUMI_AYUDAS,...LUMI_PROBLEMAS,LUMI_NO_RECONOCIDO]
      .filter(a=>!a.titulo||!a.causa||!a.pasos?.length||/[<>]/.test(a.titulo+a.causa+a.pasos.join('')+(a.admin||[]).join(''))).map(a=>a.id));
    assert.deepEqual(huecos,[],'Toda ayuda tiene título, causa y pasos, sin HTML');

    // ── El aviso ofrece la solución ──
    const avisos=await page.evaluate(()=>{
      const leer=()=>{const t=document.querySelector('#toasts .toast:last-child');return {boton:!!t.querySelector('.t-lumi'),dura:t.querySelector('.t-bar').style.animationDuration};};
      toast('new row violates row-level security policy for table "citas"','error'); const rls=leer();
      toast('Ingresa tu email y contraseña','error'); const validacion=leer();
      toast('Paciente guardado','success'); const exito=leer();
      toast('Error al guardar: algo que Lumi no conoce','error'); const raro=leer();
      toast('Completa el nombre del producto','warning'); const advertencia=leer();
      return {rls,validacion,exito,raro,advertencia,registros:_lumiErroresLista().map(r=>r.ayuda)};
    });
    assert.deepEqual(avisos.rls,{boton:true,dura:'9000ms'},'Un error conocido ofrece la solución y dura más');
    assert.equal(avisos.validacion.boton,false,'Un dato que falta no necesita a Lumi');
    assert.equal(avisos.exito.boton,false);
    assert.equal(avisos.raro.boton,true,'Un fallo técnico desconocido también ofrece ayuda');
    assert.equal(avisos.advertencia.boton,false);
    assert.deepEqual(avisos.registros,['permiso-servidor','campos-obligatorios','no-reconocido'],'Las advertencias comunes no se anotan');

    // ── El panel: el error que se pulsó, sus pasos y acciones ──
    const panel=await page.evaluate(()=>{
      document.querySelector('#toasts .toast .t-lumi').click();
      const r=document.getElementById('lumi');
      return {visible:!r.hidden,mensaje:r.querySelector('.lumi-mensaje')?.textContent,titulo:r.querySelector('.lumi-caso h4')?.textContent,
        admin:!!r.querySelector('.lumi-admin'),acciones:[...r.querySelectorAll('.lumi-caso .lumi-acciones button')].map(b=>b.textContent),
        frecuentes:r.querySelector('#lumi-lista-titulo').textContent,avisoQueda:[...document.querySelectorAll('#toasts .toast')].some(t=>/row-level security/.test(t.textContent)),items:r.querySelectorAll('#lumi-resultados details').length,
        punto:document.getElementById('lumi-btn').classList.contains('lumi-alerta')};
    });
    assert.equal(panel.visible,true);
    assert.match(panel.mensaje,/row-level security/);
    assert.equal(panel.titulo,'El servidor no deja guardar o ver este dato');
    assert.equal(panel.admin,false,'Los pasos del Super Admin no se le muestran a recepción');
    assert.deepEqual(panel.acciones,['⏻ Cerrar sesión','📋 Copiar detalle para el Super Admin']);
    assert.match(panel.frecuentes,/Problemas frecuentes en/);
    assert(panel.items>=5,'Hay problemas frecuentes que revisar');
    assert.equal(panel.punto,false,'Abrir Lumi apaga el punto de aviso');
    assert.equal(panel.avisoQueda,false,'El aviso que se pulsó se cierra: no tapa el panel');

    // Super Admin: ve sus pasos, el archivo pendiente y puede ir a Usuarios
    const sa=await page.evaluate(async()=>{
      __set({sa:true});
      const r=_lumiRegistrar('Falta ejecutar migracion_balance_manual.sql en Supabase para poder cambiar de modo.','error');
      abrirLumi(null,r.registro.n);
      const el=document.getElementById('lumi');
      return {admin:el.querySelector('.lumi-caso .lumi-admin')?.textContent||'',archivo:el.querySelector('.lumi-caso .lumi-dato code')?.textContent,
        copiar:[...el.querySelectorAll('.lumi-caso .lumi-acciones button')].map(b=>b.textContent)};
    });
    assert.match(sa.admin,/SQL Editor/);
    assert.equal(sa.archivo,'migracion_balance_manual.sql','Lumi nombra el archivo que falta ejecutar');
    assert.deepEqual(sa.copiar,['📋 Copiar detalle','🔄 Recargar la página']);
    const irUsuarios=await page.evaluate(async()=>{
      const r=_lumiRegistrar('🔒 Tu cuenta ha sido bloqueada tras 3 intentos fallidos.','error');
      abrirLumi(null,r.registro.n);
      [...document.querySelectorAll('#lumi .lumi-caso .lumi-acciones button')].find(b=>b.textContent.includes('Usuarios')).click();
      await new Promise(r=>setTimeout(r,20));
      return {acciones:window.__acciones.slice(-2),abierto:!document.getElementById('lumi').hidden};
    });
    assert.deepEqual(irUsuarios,{acciones:['navigate:admin','tab:usuarios'],abierto:false},'«Abrir Usuarios» lleva a Administración › Usuarios');

    // ── Un mensaje con HTML se muestra como texto ──
    const xss=await page.evaluate(()=>{
      __set({sa:false});
      const r=_lumiRegistrar('Error: &lt;img src=x onerror="window.__xss=1"&gt; falló','error');
      abrirLumi(null,r.registro.n);
      return {img:document.querySelectorAll('#lumi img').length,texto:document.querySelector('#lumi .lumi-mensaje').textContent,xss:window.__xss};
    });
    assert.equal(xss.img,0);
    assert.match(xss.texto,/<img src=x/);
    assert.equal(xss.xss,undefined);

    // ── Buscar «en qué te atascaste» ──
    const busca=await page.evaluate(()=>({
      imprime:_lumiBuscarTexto('no imprime').map(a=>a.id),
      entrar:_lumiBuscarTexto('no puedo entrar').map(a=>a.id),
      guarda:_lumiBuscarTexto('no me guarda').length,
      pegado:_lumiBuscarTexto('permission denied for table pacientes').map(a=>a.id)[0],
      nada:_lumiBuscarTexto('xyzzy').length,
      vacio:_lumiBuscarTexto('   ').length,
    }));
    assert.equal(busca.imprime[0],'ventana-bloqueada');
    assert(busca.entrar.slice(0,3).includes('login-credenciales'),'«no puedo entrar» encuentra el acceso: '+busca.entrar);
    assert(busca.guarda>0);
    assert.equal(busca.pegado,'permiso-servidor','Pegar el mensaje de error encuentra su ayuda primero');
    assert.equal(busca.nada,0);
    assert.equal(busca.vacio,0);
    const filtro=await page.evaluate(()=>{
      const q=document.getElementById('lumi-q'); q.value='ventana emergente'; q.dispatchEvent(new Event('input'));
      return {titulo:document.getElementById('lumi-lista-titulo').textContent,primero:document.querySelector('#lumi-resultados summary')?.textContent};
    });
    assert.equal(filtro.titulo,'Lo que encontré');
    assert.match(filtro.primero,/No imprime/);

    // Recepción no ve lo que es solo del Super Admin
    const soloSA=await page.evaluate(()=>({
      recepcion:_lumiBuscarTexto('clinica elegir trabajando').map(a=>a.id).includes('sin-clinica-sa'),
      frecuentes:_lumiFrecuentes('finanzas').map(a=>a.id),
    }));
    assert.equal(soloSA.recepcion,false);
    assert(soloSA.frecuentes.includes('factura-error'),'Finanzas lista sus problemas propios');

    // ── Revisión: casos que antes salían mal ──
    const revision=await page.evaluate(async()=>{
      _lumiOlvidar(); cerrarLumi();
      const r={};
      // Super Admin sin clínica: elegir clínica, no «pide que te la asignen»
      __set({sa:true}); r.saSinClinica=_lumiBuscarAyuda('Sin clínica asignada')?.id; __set({sa:false});
      // Una validación sin ayuda no se anota ni enciende el punto
      toast('El carrito está vacío','error');
      r.validacion={n:_lumiErroresLista().length,punto:document.getElementById('lumi-btn').classList.contains('lumi-alerta')};
      // Un fallo de la página que menciona 'jwt' no es una sesión vencida
      r.inesperado=_lumiRegistrar("Error inesperado en la página: Cannot read properties of undefined (reading 'jwt')",'inesperado')?.ayuda.id;
      r.inesperadoRed=_lumiRegistrar('Error inesperado en la página: TypeError: Failed to fetch','inesperado')?.ayuda.id;
      r.columna=_lumiDato('column citas.duracion_min does not exist');
      // Al cerrar sesión no queda ni el aviso ni el panel con el mensaje
      toast('Ya existe un paciente con esa identificación: Juan Pérez Gómez','error');
      abrirLumi(); cerrarLumi(); _lumiOlvidar();
      r.trasSalir={avisos:document.querySelectorAll('#toasts .toast').length,panel:document.getElementById('lumi-cuerpo').textContent.trim()};
      // Recargar con un formulario abierto pregunta antes
      const modal=document.createElement('div'); modal.className='modal-overlay open'; document.body.appendChild(modal);
      __set({confirm:false}); window.__acciones.length=0;
      await _lumiAccion('recargar'); r.recargar=window.__acciones.slice();
      // Cerrar sesión con formulario abierto guarda los borradores y no pregunta dos veces
      __set({confirm:true}); window.__acciones.length=0;
      _lumiAccion('salir'); await new Promise(x=>setTimeout(x,20)); r.salir=window.__acciones.slice();
      modal.remove();
      // Foco atrapado: el resto de la página queda inerte y vuelve al cerrar
      abrirLumi();
      r.inerte=document.querySelector('.main').inert;
      cerrarLumi();
      r.inerteDespues=document.querySelector('.main').inert;
      r.focoVuelve=document.activeElement?.id;
      // Escape no llega a otros oyentes cuando Lumi está abierto
      let otro=0; const oyente=e=>{if(e.key==='Escape') otro++;}; document.addEventListener('keydown',oyente);
      abrirLumi(); document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',cancelable:true}));
      r.escape={cerrado:document.getElementById('lumi').hidden,otro};
      document.removeEventListener('keydown',oyente);
      // Lo anotado en el acceso o por otro usuario se descarta al entrar
      _lumiOlvidar(); __set({user:null}); _lumiRegistrar('Email o contraseña incorrectos. Te quedan 2 intentos.','error');
      __set({user:{id:'u9',name:'Otra'}}); _lumiRegistrar('JWT expired','error');
      __set({user:{id:'u1',name:'Ana'}}); _lumiAlEntrar();
      r.alEntrar={n:_lumiErroresLista().length,punto:document.getElementById('lumi-btn').classList.contains('lumi-alerta')};
      // El aviso verde de «¿Olvidaste tu contraseña?» no es un error
      __set({user:null}); const el=document.getElementById('login-error');
      el.style.color='#6EE7B7'; el.textContent='Escríbele al administrador a soporte indicando tu correo.'; el.style.display='block';
      await new Promise(x=>setTimeout(x,20));
      r.verde=_lumiErroresLista().length;
      el.style.display='none'; el.style.color='#f87171'; __set({user:{id:'u1',name:'Ana'}});
      return r;
    });
    assert.equal(revision.saSinClinica,'sin-clinica-sa');
    assert.deepEqual(revision.validacion,{n:0,punto:false},'«El carrito está vacío» no es un atasco');
    assert.equal(revision.inesperado,'error-inesperado');
    assert.equal(revision.inesperadoRed,'sin-conexion');
    assert.match(revision.columna,/duracion_min/);
    assert.deepEqual(revision.trasSalir,{avisos:0,panel:''},'Al salir no queda el nombre del paciente en pantalla');
    assert.deepEqual(revision.recargar,['confirm:¿Recargar la página?'],'Con un formulario abierto, recargar pregunta y respeta el «Volver»');
    assert.deepEqual(revision.salir,['confirm:¿Cerrar sesión?','borradores','logout:true']);
    assert.deepEqual([revision.inerte,revision.inerteDespues,revision.focoVuelve],[true,false,'lumi-btn']);
    assert.deepEqual(revision.escape,{cerrado:true,otro:0});
    assert.deepEqual(revision.alEntrar,{n:0,punto:false});
    assert.equal(revision.verde,0);

    // ── Escape cierra; el historial vive en la pestaña y se borra al salir ──
    const vida=await page.evaluate(()=>{
      abrirLumi(); _lumiRegistrar('JWT expired','error');
      document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));
      const cerrado=document.getElementById('lumi').hidden;
      const guardado=JSON.parse(sessionStorage.getItem('lm_lumi_errores')||'[]').length;
      _lumiOlvidar();
      return {cerrado,guardado,despues:sessionStorage.getItem('lm_lumi_errores'),lista:_lumiErroresLista().length};
    });
    assert.equal(vida.cerrado,true);
    assert(vida.guardado>0);
    assert.deepEqual([vida.despues,vida.lista],[null,0],'Al cerrar sesión no queda ningún mensaje');

    // Repetir el mismo error no llena el historial: se cuenta
    const repetido=await page.evaluate(()=>{
      toast('TypeError: Failed to fetch','error'); toast('TypeError: Failed to fetch','error'); toast('TypeError: Failed to fetch','error');
      const l=_lumiErroresLista(); abrirLumi();
      return {n:l.length,veces:l[0].veces,texto:document.querySelector('#lumi .lumi-repite')?.textContent};
    });
    assert.deepEqual(repetido,{n:1,veces:3,texto:'Se repitió 3 veces'});

    // ── Pantalla de acceso y fallos de la página ──
    const acceso=await page.evaluate(async()=>{
      cerrarLumi(); _lumiOlvidar(); __set({user:null});
      const el=document.getElementById('login-error');
      el.textContent='Email o contraseña incorrectos. Te quedan 2 intentos.'; el.style.display='block';
      await new Promise(r=>setTimeout(r,20));
      const r=_lumiErroresLista().at(-1);
      abrirLumi('login');
      const lista=document.getElementById('lumi-lista-titulo').textContent;
      cerrarLumi(); __set({user:{id:'u1',name:'Ana'}});
      return {ayuda:r?.ayuda,pantalla:r?.pantalla,link:document.querySelector('.login-lumi').classList.contains('lumi-alerta'),lista};
    });
    assert.deepEqual(acceso,{ayuda:'login-credenciales',pantalla:'Inicio de sesión',link:false,lista:'Problemas frecuentes al entrar'});
    const fallo=await page.evaluate(async()=>{
      const antes=_lumiErroresLista().length;
      window.dispatchEvent(new ErrorEvent('error',{message:"TypeError: Cannot read properties of undefined (reading 'id')"}));
      window.dispatchEvent(new ErrorEvent('error',{message:'Script error.'}));
      return {ultimo:_lumiErroresLista().at(-1)?.ayuda,n:_lumiErroresLista().length-antes,punto:document.getElementById('lumi-btn').classList.contains('lumi-alerta'),
        avisos:document.querySelectorAll('#toasts .toast').length};
    });
    assert.equal(fallo.ultimo,'error-inesperado');
    assert.equal(fallo.n,1,'«Script error.» de terceros no se anota');
    assert.equal(fallo.punto,true,'Un fallo silencioso enciende el punto de Lumi');

    // ── Los recorridos ya no arrancan solos ──
    assert(!/_programarGuiaModulo\(/.test(source),'La guía no debe arrancar sola al abrir un módulo');
    assert(!/❔ Ver guía/.test(html),'Los botones «Ver guía» pasaron a «✦ Ayuda»');
    assert.equal((html.match(/onclick="abrirLumi\('[a-z-]+'\)"/g)||[]).length,7,'Cada módulo con recorrido abre Lumi (6) y el acceso también (1)');

    // ── Cómo se ve: escritorio, teléfono y modo oscuro ──
    const prueba=async(width,dark)=>{
      const p=await browser.newPage({viewport:{width,height:width<600?800:900}});
      await abrir(p);
      const m=await p.evaluate(async(dark)=>{
        if(dark) document.body.classList.add('dark');
        __set({sa:true,clinica:7});
        toast('No se pudo subir el archivo: new row violates row-level security policy for table "objects" en el bucket Pacientes al guardar el examen de laboratorio','error');
        await new Promise(r=>setTimeout(r,450));   // el aviso entra deslizándose
        const t=document.querySelector('#toasts .toast:last-child').getBoundingClientRect();
        document.querySelector('.t-lumi').click();
        await new Promise(r=>setTimeout(r,300));
        const hoja=document.querySelector('.lumi-hoja').getBoundingClientRect();
        const cuerpo=document.querySelector('.lumi-cuerpo');
        const desbordes=[...document.querySelectorAll('#lumi .lumi-hoja *')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.right>hoja.right+1||r.left<hoja.left-1);}).map(e=>e.className||e.tagName).slice(0,5);
        const btn=document.getElementById('lumi-btn').getBoundingClientRect();
        return {hoja:{l:Math.round(hoja.left),r:Math.round(hoja.right),t:Math.round(hoja.top),b:Math.round(hoja.bottom)},
          ancho:innerWidth,alto:innerHeight,scrollX:cuerpo.scrollWidth-cuerpo.clientWidth,desbordes,
          toast:{l:Math.round(t.left),r:Math.round(t.right)},btn:{r:Math.round(btn.right),w:Math.round(btn.width),visible:btn.width>0},
          pagina:document.documentElement.scrollWidth-innerWidth};
      },dark);
      assert(m.hoja.l>=0&&m.hoja.r<=m.ancho&&m.hoja.b<=m.alto,`El panel cabe en ${width}px: ${JSON.stringify(m.hoja)}`);
      assert.equal(m.scrollX,0,`Sin desplazamiento lateral en ${width}px`);
      assert.deepEqual(m.desbordes,[],`Nada se sale del panel en ${width}px`);
      assert(m.toast.l>=0&&m.toast.r<=m.ancho,`El aviso cabe en ${width}px`);
      assert(m.btn.visible&&m.btn.r<=m.ancho,`El botón de Lumi se ve en la barra a ${width}px`);
      if(width<=600) assert.equal(m.hoja.b,m.alto,'En el teléfono el panel sale desde abajo');
      else assert.equal(m.hoja.r,m.ancho,'En escritorio el panel sale a la derecha');
      if(width===360) {
        await p.evaluate(()=>cerrarLumi());
        await p.screenshot({path:path.join(process.env.TEMP||'/tmp','lumi-barra-360.png'),clip:{x:0,y:0,width:360,height:70}});
        await p.evaluate(()=>document.querySelector('.lumi-btn').click());
        await p.waitForTimeout(300);
      }
      const dest=path.join(process.env.TEMP||'/tmp',`lumi-${width}${dark?'-oscuro':''}.png`);
      await p.screenshot({path:dest});
      console.log(`Layout ${width}px${dark?' oscuro':''}: ${dest}`);
      await p.close();
    };
    for(const [w,d] of [[1280,false],[430,false],[390,true],[360,false]]) await prueba(w,d);

    // La barra superior real, con menú lateral y fecha, no se desborda en tableta
    const real=await browser.newPage();
    await real.route('**/*',r=>{const u=r.request().url();
      if(u.startsWith('http://app.test/css/')) return r.fulfill({contentType:'text/css',body:css});
      if(u==='http://app.test/') return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
      return r.abort();});
    await real.goto('http://app.test/');
    for(const w of [769,820,900,1024,1100,1280]) {
      await real.setViewportSize({width:w,height:800});
      const m=await real.evaluate(()=>{
        document.getElementById('app').classList.add('visible');
        const tb=document.querySelector('.topbar'), b=document.getElementById('lumi-btn'), t=document.getElementById('theme-toggle');
        return {desborde:tb.scrollWidth-tb.clientWidth,btn:b.getBoundingClientRect().right,tema:t.getBoundingClientRect().right,ancho:innerWidth};
      });
      assert(m.desborde<=0&&m.tema<=m.ancho,`La barra cabe en ${w}px: ${JSON.stringify(m)}`);
    }
    await real.close();

    console.log('OK: reconocimiento, aviso con solución, panel por rol, archivo pendiente, texto seguro, búsqueda, historial, acceso, fallos silenciosos, sin recorrido automático y layout.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
