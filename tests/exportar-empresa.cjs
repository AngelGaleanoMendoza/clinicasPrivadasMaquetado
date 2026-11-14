// Exportar en empresa: resumen comercial, reportes según permisos y vuelta a
// clínica. Mismo arnés con HTML/CSS reales y funciones extraídas que contabilidad.cjs.
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
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const preambulo=`
  let currentUser={key:'admin_empresa',email:'admin@empresa.test'}, currentClinica={tipo:'empresa_medica',nombre:'Empresa Demo'};
  let contTab='resumen', permisos=['inventario','finanzas','contabilidad','exportar'];
  const esEmpresaMedica=()=>currentClinica?.tipo==='empresa_medica';
  const hasPermiso=p=>permisos.includes(p);
  const isSuperAdmin=()=>false, isOdontologo=()=>false, esOftalmologia=()=>false, esProfesionalOftalmo=()=>false, esVeterinaria=()=>false;
  const renderSelectorClinicaSA=()=>{};
  const closeModal=id=>document.getElementById(id)?.classList.remove('open');
  const hoy=()=>'2026-11-13';
  const _exigeClinica=()=>true; const setLoading=()=>{};
  const _sujetoCita=()=>({titulo:'Paciente Demo'});
  window.__nav=[]; const navigate=v=>__nav.push({vista:v,tab:contTab});
  window.__toasts=[]; const toast=(m,t)=>__toasts.push([m,t]);
  window.__descargas=[]; const _descargarArchivo=(blob,nombre)=>__descargas.push({blob,nombre});
  const _nombreArchivoBackup=e=>'backup.'+e;
  const respaldo={schemaVersion:2,resumen:{pacientes:0,ventas:2},datosClinica:{inventario:[{id:1},{id:2},{id:3}],ventas:[{id:1},{id:2}]},advertencias:[]};
  const _construirBackupClinica=async()=>respaldo;
  const C={p:[{nombre:'Paciente',apellidos:'Demo'}],c:[{fecha:hoy(),hora:'10:00',motivo:'Consulta',estado:'pendiente'}],
    m:[{estado:'activa'}],n:[{}],inv:[{},{},{}],prov:[{},{}],comp:[{}],cliCom:[{},{}],
    ventas:[{estado:'registrada'},{estado:'registrada'},{estado:'anulada'}],fin:[{},{}]};
  window.__config=o=>{if('permisos' in o) permisos=o.permisos;
    if(o.tipo) {currentClinica.tipo=o.tipo;currentUser.key=o.tipo==='empresa_medica'?'admin_empresa':'medico_admin';}
    if(o.vacio) for(const k of Object.keys(C)) C[k]=[];};
  ${['_etiquetaRol','_contextoEstablecimiento','_textoEstablecimiento','actualizarIdentidadEstablecimiento',
    '_syncBuscadorGlobal','puedeVerBalance','puedeAbrirContabilidad','puedeGestionarProcedimientosClinicos','applyRoleMenu',
    '_resumenExportar','renderExportar','_contenidoEmailExportar','abrirReportesExportarEmpresa','exportarPDFClinica','exportarJSON'].map(extraer).join('\n')}
`;
(async()=>{
  const browser=await (process.env.PLAYWRIGHT_CHROMIUM
    ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
    : chromium.launch({channel:'msedge',headless:true}));
  try {
    const page=await browser.newPage();
    await page.route('**/*',r=>{
      const u=r.request().url();
      if(u.startsWith('http://app.test/css/')) return r.fulfill({contentType:'text/css',body:css});
      if(u==='http://app.test/') return r.fulfill({contentType:'text/html; charset=utf-8',body:html});
      return r.abort();
    });
    await page.goto('http://app.test/');
    await page.addScriptTag({content:preambulo});
    await page.evaluate(()=>{
      document.getElementById('app').classList.add('visible');
      document.querySelectorAll('.loading-overlay,#login-screen').forEach(e=>e.style.display='none');
      document.querySelectorAll('.view').forEach(e=>e.classList.remove('active'));
      document.getElementById('view-exportar').classList.add('active');
      document.getElementById('page-title').textContent='Exportar / Enviar';
      document.querySelectorAll('.menu-item').forEach(e=>e.classList.remove('active'));
      document.getElementById('menu-exportar').classList.add('active');
      applyRoleMenu(); renderExportar();
    });
    assert.equal(await page.locator('#titulo-resumen-exportar').textContent(),'📊 Resumen de la empresa');
    assert.deepEqual((await page.locator('.export-resumen-item').allTextContents()).map(t=>t.trim()),[
      '📦3Productos','🤝2Proveedores','🛒1Compras','🏢2Clientes comerciales','🧾2Ventas','💰2Movimientos financieros'
    ]);
    assert.equal(await page.locator('#export-pdf-clinico').isVisible(),false);
    assert.equal(await page.locator('#export-reportes-empresa').isVisible(),true);
    assert.doesNotMatch(await page.locator('#view-exportar').innerText(),/pacientes|citas|medicaciones|notas|expedientes/i);
    const correo=await page.evaluate(()=>_contenidoEmailExportar());
    assert.equal(correo.destinatario,'admin@empresa.test');
    assert.match(correo.cuerpo,/Productos: 3[\s\S]*Ventas: 2/);
    assert.doesNotMatch(correo.cuerpo,/pacientes|citas|medicaciones|notas|expedientes/i);
    await page.locator('#export-reportes-empresa button').click();
    assert.deepEqual(await page.evaluate(()=>__nav.at(-1)),{vista:'contabilidad',tab:'reportes'});
    // Incluso un botón de expedientes obsoleto lleva a reportes en empresa.
    await page.evaluate(()=>exportarPDFClinica());
    assert.deepEqual(await page.evaluate(()=>__nav.at(-1)),{vista:'contabilidad',tab:'reportes'});
    const backup=await page.evaluate(async()=>{await exportarJSON();return {datos:JSON.parse(await __descargas.at(-1).blob.text()),aviso:__toasts.at(-1)[0]};});
    assert.equal(backup.datos.schemaVersion,2);
    assert.equal(backup.datos.datosClinica.inventario.length,3);
    assert.equal(backup.aviso,'Backup descargado: 3 productos · 2 ventas');

    for(const width of [360,390,430,1280]) for(const dark of [false,true]) {
      await page.setViewportSize({width,height:900});
      const fuera=await page.evaluate(dark=>{
        document.body.classList.toggle('dark',dark);window.scrollTo(0,0);
        return [...document.querySelectorAll('#view-exportar *')].filter(e=>{
          const r=e.getBoundingClientRect();return r.width>0&&(r.right>innerWidth+1||r.left<0);
        }).map(e=>e.id||e.className||e.tagName).slice(0,8);
      },dark);
      assert.deepEqual(fuera,[],`Exportar ${width}px ${dark?'oscuro':'claro'} sin desbordes`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      await page.screenshot({path:path.join(process.env.TEMP||'/tmp',`exportar-empresa-${width}-${dark?'oscuro':'claro'}.png`),fullPage:true,animations:'disabled'});
    }

    // Las tarjetas y el acceso a reportes respetan los permisos de cada módulo.
    for(const [permisos,labels] of [
      [['exportar','inventario'],['Productos','Proveedores','Compras']],
      [['exportar','finanzas'],['Movimientos financieros']],
      [['exportar','contabilidad'],['Clientes comerciales','Ventas']],
      [['exportar'],[]]
    ]) {
      await page.evaluate(permisos=>{__config({permisos});renderExportar();},permisos);
      assert.deepEqual(await page.locator('.export-resumen-item .text-light').allTextContents(),labels);
      assert.equal(await page.locator('#export-reportes-empresa').isVisible(),permisos.includes('contabilidad'));
      if(!permisos.includes('contabilidad')) {
        const antes=await page.evaluate(()=>__nav.length);
        await page.evaluate(()=>abrirReportesExportarEmpresa());
        assert.equal(await page.evaluate(()=>__nav.length),antes);
      }
    }

    // Cambiar de contexto devuelve las opciones y el resumen clínicos originales.
    await page.evaluate(()=>{__config({tipo:'clinica',permisos:['exportar','inventario','finanzas']});actualizarIdentidadEstablecimiento();renderExportar();});
    assert.deepEqual(await page.locator('.export-resumen-item .text-light').allTextContents(),['Pacientes','Citas','Medicaciones','Notas']);
    assert.equal(await page.locator('#export-pdf-clinico').isVisible(),true);
    assert.equal(await page.locator('#export-reportes-empresa').isVisible(),false);
    assert.match(await page.locator('#export-json-descripcion').textContent(),/expedientes agrupados por paciente/);
    assert.match(await page.evaluate(()=>_contenidoEmailExportar().cuerpo),/PACIENTES:/);
    await page.evaluate(()=>{__config({tipo:'empresa_medica',permisos:['inventario','finanzas','contabilidad','exportar'],vacio:true});renderExportar();});
    assert.deepEqual(await page.locator('.export-resumen-item strong').allTextContents(),['0','0','0','0','0','0']);
    console.log('OK: resumen comercial sin módulos clínicos, reportes y permisos, correo propio, backup compatible, cambio de contexto, vacío y layout 360–430/1280 claro/oscuro.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
