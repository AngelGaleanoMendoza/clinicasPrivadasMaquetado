// Empresa médica (distribuidora): solo módulos de gestión, rol de empresa y
// un inicio propio. Ejecutar con PLAYWRIGHT_MODULE apuntando a playwright y,
// si hace falta, PLAYWRIGHT_CHROMIUM con un Chromium propio.
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
const bloque=(desde,hasta)=>{const a=source.indexOf(desde);assert(a>=0,desde);const b=source.indexOf(hasta,a);return source.slice(a,b+hasta.length);};
const permisos=bloque('const ALL_PERMISOS','\n};');
const empresa=bloque('const MODULOS_EMPRESA',"clinica?.tipo === 'empresa_medica'; }");

const preambulo=`
  let currentUser={id:'u1',key:'admin_empresa',name:'Ana',permisos:null};
  let currentClinica={id:9,nombre:'Distribuidora Demo',tipo:'empresa_medica'}, currentClinicaId=9, currentView='dashboard';
  let superAdmin=false;
  const isSuperAdmin=()=>superAdmin;
  const isOdontologo=()=>false, esOftalmologia=()=>false, esProfesionalOftalmo=()=>false;
  const renderSelectorClinicaSA=()=>{};
  const esVeterinaria=()=>currentClinica?.tipo==='veterinaria';
  const escAttr=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtC=v=>'C$ '+Number(v||0).toFixed(2);
  const formatFecha=f=>f;
  const hoy=()=>'2026-11-14';
  const _syncEspecialidadUsuario=()=>{};
  let adminClinicas=[{id:9,nombre:'Distribuidora Demo',tipo:'empresa_medica'},{id:3,nombre:'Clínica Norte',tipo:'clinica'}];
  const C={fin:[
      {id:1,tipo:'ingreso',monto:5000,fecha:'2026-11-10',descripcion:'Venta guantes a Clínica Norte'},
      {id:2,tipo:'egreso',monto:1200,fecha:'2026-11-11',descripcion:'Compra a proveedor de jeringas'},
      {id:3,tipo:'ingreso',monto:900,fecha:'2026-10-30',descripcion:'Venta del mes anterior'}],
    inv:[{id:1,nombre:'Guantes de nitrilo talla M, caja de 100 unidades',stock:3,stockMin:10,unidad:'caja',precio:150},
         {id:2,nombre:'Jeringas 5 ml',stock:400,stockMin:50,unidad:'unidad',precio:2}]};
  ${permisos}
  ${empresa}
  ${['permisosEfectivos','hasPermiso','puedeVerBalance','puedeGestionarProcedimientosClinicos','applyRoleMenu','_syncBuscadorGlobal',
     '_permisosDisponiblesUsuario','_ajustarRolesPorClinica','renderPermisosModal','togglePermLabel','onRolChange','fillClinicaSelect',
     'renderDashboardEmpresa','renderNavQuickGrid'].map(extraer).join('\n')}
  window.__set=o=>{ if('sa' in o) superAdmin=o.sa; if('user' in o) currentUser=o.user; if('clinica' in o) currentClinica=o.clinica; };
  Object.assign(window,{hasPermiso,puedeVerBalance,applyRoleMenu,_ajustarRolesPorClinica,fillClinicaSelect,renderPermisosModal,renderDashboardEmpresa,renderNavQuickGrid,esEmpresaMedica});
`;
const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});
// index.html real, sin sus scripts (Supabase, app.js): solo marcado y estilos.
const abrir=async p=>{
  await p.route('**/*',r=>{const u=r.request().url();
    if(u.startsWith('http://app.test/css/')) return r.fulfill({contentType:'text/css',body:css});
    if(u==='http://app.test/') return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
    return r.abort();});
  await p.goto('http://app.test/');
  await p.addScriptTag({content:preambulo});
  await p.evaluate(()=>{
    document.getElementById('app').classList.add('visible');
    document.querySelectorAll('.loading-overlay,#login-screen').forEach(e=>e.style.display='none');
  });
};

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await abrir(page);

    // ── Permisos: en la empresa solo existen sus módulos, también para el Super Admin ──
    const perm=await page.evaluate(()=>{
      const mods=['inventario','finanzas','estadisticas','exportar','pacientes','citas','farmacia','notas'];
      const r={admin:mods.filter(hasPermiso),balance:puedeVerBalance()};
      __set({sa:true,user:{id:'sa',key:'superadmin'}}); r.sa=mods.filter(hasPermiso);
      __set({clinica:{id:3,tipo:'clinica'}}); r.saClinica=mods.filter(hasPermiso).length;
      // Permisos guardados mandan: una lista vacía es «sin permisos», también en la empresa
      __set({sa:false,user:{id:'u2',key:'admin_empresa',permisos:[]},clinica:{id:9,tipo:'empresa_medica'}}); r.vacio=mods.filter(hasPermiso);
      // Aunque alguien guarde «pacientes» a mano, en la empresa no existe
      __set({user:{id:'u3',key:'admin_empresa',permisos:['finanzas','pacientes']}}); r.forzado=mods.filter(hasPermiso);
      __set({user:{id:'u1',key:'admin_empresa',permisos:null},clinica:{id:9,nombre:'Distribuidora Demo',tipo:'empresa_medica'}});
      return r;
    });
    assert.deepEqual(perm.admin,['inventario','finanzas','estadisticas','exportar']);
    assert.equal(perm.balance,true,'El administrador de empresa ve el balance');
    assert.deepEqual(perm.sa,['inventario','finanzas','estadisticas','exportar'],'Ni el Super Admin ve módulos clínicos dentro de una empresa');
    assert.equal(perm.saClinica,8,'En una clínica el Super Admin lo ve todo');
    assert.deepEqual(perm.vacio,[]);
    assert.deepEqual(perm.forzado,['finanzas']);

    // ── Menú y accesos rápidos ──
    const menu=await page.evaluate(()=>{
      applyRoleMenu();
      const ver=id=>{const el=document.getElementById(id);return !!el && el.style.display!=='none';};
      const ids=['menu-pacientes','menu-citas','menu-agendas','menu-medicaciones','menu-notas','menu-expedientes','menu-examenes-digitalizados',
        'menu-farmacia','menu-procedimientos','menu-clinica-section','menu-inventario','menu-finanzas','menu-estadisticas','menu-exportar','menu-admin'];
      const r=Object.fromEntries(ids.map(i=>[i,ver(i)]));
      renderNavQuickGrid('dashboard');
      r.rapidos=[...document.querySelectorAll('#nav-quick-grid .nq-label')].map(e=>e.textContent);
      r.buscador=getComputedStyle(document.querySelector('.topbar-search')).display;
      return r;
    });
    for(const id of ['menu-pacientes','menu-citas','menu-agendas','menu-medicaciones','menu-notas','menu-expedientes','menu-examenes-digitalizados','menu-farmacia','menu-procedimientos','menu-clinica-section','menu-admin'])
      assert.equal(menu[id],false,id+' no debe verse en una empresa médica');
    for(const id of ['menu-inventario','menu-finanzas','menu-estadisticas','menu-exportar']) assert.equal(menu[id],true,id+' debe verse');
    assert.deepEqual(menu.rapidos,['Estadísticas','Inventario','Finanzas','Exportar']);
    assert.equal(menu.buscador,'none','No hay pacientes que buscar');

    // ── Formulario de usuario: los roles dependen de la clínica ──
    const roles=await page.evaluate(()=>{
      fillClinicaSelect(9);
      const sel=document.getElementById('u-rol'); sel.value='medico';
      _ajustarRolesPorClinica();
      const visibles=()=>[...sel.options].filter(o=>!o.hidden && o.value!=='superadmin').map(o=>o.value);
      const marcados=()=>[...document.querySelectorAll('#u-permisos-grid input:checked')].map(i=>i.value);
      const r={empresa:{roles:visibles(),rol:sel.value,modulos:[...document.querySelectorAll('#u-permisos-grid input')].map(i=>i.value),marcados:marcados(),
        ayuda:!document.getElementById('u-roles-ayuda').hidden}};
      document.getElementById('u-clinica').value='3'; _ajustarRolesPorClinica();
      r.clinica={rolEmpresaOculto:sel.querySelector('option[value="admin_empresa"]').hidden,rol:sel.value,modulos:document.querySelectorAll('#u-permisos-grid input').length,
        ayuda:!document.getElementById('u-roles-ayuda').hidden};
      return r;
    });
    assert.deepEqual(roles.empresa.roles,['admin_empresa'],'En una empresa solo se ofrece el rol de empresa');
    assert.equal(roles.empresa.rol,'admin_empresa','Un rol que no aplica se cambia solo');
    assert.deepEqual(roles.empresa.modulos,['inventario','finanzas','estadisticas','exportar']);
    assert.deepEqual(roles.empresa.marcados,['inventario','finanzas','estadisticas','exportar'],'El rol trae sus módulos marcados');
    assert.equal(roles.empresa.ayuda,true);
    assert.deepEqual(roles.clinica,{rolEmpresaOculto:true,rol:'medico',modulos:13,ayuda:false},'En una clínica el rol de empresa no existe');

    // ── Validación al guardar: el código está en guardarUsuario ──
    const guardar=extraer('guardarUsuario');
    assert.match(guardar,/En una empresa médica el rol debe ser «Administrador de empresa»/);
    assert.match(guardar,/es solo para una empresa médica/);
    // Navegación: las vistas clínicas se cortan antes que los permisos
    const nav=extraer('navigate');
    assert(nav.indexOf('esEmpresaMedica() && VISTAS_CLINICAS.includes(view)')<nav.indexOf("if(view==='citas'"),'La empresa se revisa antes que los permisos');
    assert.match(fs.readFileSync(path.join(root,'migracion_empresa_medica.sql'),'utf8'),/p\.rol IN \('medico_admin', 'admin_empresa'\)/);

    // ── Inicio de la empresa: datos del mes y por reponer, en teléfono y escritorio ──
    for(const w of [360,390,1280]) {
      await page.setViewportSize({width:w,height:900});
      const d=await page.evaluate(()=>{
        document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
        document.getElementById('view-dashboard').classList.add('active');
        renderDashboardEmpresa(); renderNavQuickGrid('dashboard');
        const v=document.getElementById('view-dashboard');
        const fuera=[...v.querySelectorAll('*')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.right>innerWidth+1;}).map(e=>e.className||e.tagName).slice(0,4);
        return {kpis:[...v.querySelectorAll('.stat-card h3')].map(e=>e.textContent),reponer:v.querySelectorAll('.tag-orange').length,
          titulo:v.querySelector('.empresa-encabezado h2').textContent,fuera,scroll:document.documentElement.scrollWidth-innerWidth};
      });
      assert.deepEqual(d.kpis,['C$ 5000.00','C$ 1200.00','C$ 3800.00','1'],'Solo cuenta el mes en curso');
      assert.equal(d.reponer,1,'Guantes está por debajo del mínimo');
      assert.equal(d.titulo,'Distribuidora Demo');
      assert.deepEqual(d.fuera,[],`Nada se sale a ${w}px`);
      const dest=path.join(process.env.TEMP||'/tmp',`empresa-${w}.png`);
      await page.screenshot({path:dest,fullPage:true});
      console.log(`Inicio ${w}px: ${dest}`);
    }
    console.log('OK: permisos de empresa, menú, accesos, roles por clínica, validación, navegación, migración e inicio.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
