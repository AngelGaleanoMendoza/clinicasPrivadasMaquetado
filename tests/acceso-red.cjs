// Uso solo desde la red de la clínica: validación de IPs, quién puede conceder el
// acceso desde fuera, y el aviso "Usuario sin permisos" en escritorio y teléfono.
// La lógica que decide de verdad vive en migracion_acceso_red.sql (en la base).
// Ejecutar con PLAYWRIGHT_MODULE apuntando a una instalación de playwright.
// PLAYWRIGHT_CHROMIUM permite usar un Chromium propio en vez del canal msedge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');

function extraer(name) {
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  let abiertas=0;
  for(const ch of primeraLinea) { if(ch==='{') abiertas++; else if(ch==='}') abiertas--; }
  if(abiertas===0 && primeraLinea.includes('{')) return primeraLinea;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
function extraerConst(name) {
  const start=source.search(new RegExp('^const '+name+'\\s*=','m'));
  assert(start>=0,'No se encontró '+name);
  return source.slice(start,source.indexOf('\n',start));
}
const code=[extraerConst('_RE_IPV4'),extraerConst('_RE_IPV6'),
  ...['_leerIps','_consultarAccesoRed','_mostrarSinPermisosRed','_pintarAccesoRemoto','_guardarAccesoRemoto'].map(extraer)].join('\n');

const modalHtml=html.slice(html.indexOf('<div class="modal-overlay" id="modal-sin-permisos-red">'),
  html.indexOf('<!-- MODAL DETALLE CLÍNICA (Super Admin) -->'));
const checkHtml=html.slice(html.indexOf('<div class="form-group full" id="u-acceso-remoto-wrap"'),
  html.indexOf('<div class="form-group full"><label>Contraseña'));

const preambulo=`
  window.__sb=[]; window.__rpc={data:null,error:null};
  window.__faltaColumna=false;
  const _conLimite=p=>p;
  const openModalOverlay=id=>document.getElementById(id).classList.add('open');
  const _faltaColumna=(e,c)=>(e?.message||'').includes(c);
  let superAdmin=true;
  const isSuperAdmin=()=>superAdmin;
  window.__sa=v=>{superAdmin=v;};
  const sb={
    rpc:async()=>window.__rpc,
    from:tabla=>({update:payload=>({eq:async(k,v)=>{
      window.__sb.push({tabla,payload,k,v});
      return {error: window.__faltaColumna ? {message:'column profiles.acceso_remoto does not exist'} : null};
    }})})
  };
  ${code}
  Object.assign(window,{_leerIps,_consultarAccesoRed,_mostrarSinPermisosRed,_pintarAccesoRemoto,_guardarAccesoRemoto});
`;

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await page.setContent(`<html><body>${modalHtml}${checkHtml}</body></html>`);
    await page.addScriptTag({content:preambulo});

    // ── Validación de IPs: una mal escrita dejaría fuera a todo el personal ──
    const ips=await page.evaluate(()=>[
      _leerIps('186.1.2.3\n 186.1.2.3 \n200.10.0.1'),
      _leerIps('186.1.2.300, hola, 2001:db8::1'),
      _leerIps('')
    ]);
    assert.deepEqual(ips[0],{ips:['186.1.2.3','200.10.0.1'],invalidas:[]},'Deduplica y limpia espacios');
    assert.deepEqual(ips[1].invalidas,['186.1.2.300','hola'],'Rechaza octetos fuera de rango y texto');
    assert.deepEqual(ips[1].ips,['2001:db8::1'],'Admite IPv6');
    assert.deepEqual(ips[2],{ips:[],invalidas:[]},'Vacío = sin restricción');

    // ── Si la función no existe o falla, NO se bloquea ──
    const sinMigracion=await page.evaluate(async()=>{
      window.__rpc={data:null,error:{message:'function mi_acceso_red does not exist'}};
      return await _consultarAccesoRed();
    });
    assert.equal(sinMigracion,null,'Un fallo de configuración no debe dejar fuera a la clínica');

    // ── El aviso enseña la red detectada ──
    const aviso=await page.evaluate(()=>{
      _mostrarSinPermisosRed({ip:'8.8.8.8',permitido:false});
      const m=document.getElementById('modal-sin-permisos-red');
      return {abierto:m.classList.contains('open'), ip:document.getElementById('sin-permisos-red-ip').textContent,
              titulo:m.querySelector('h2').textContent};
    });
    assert.equal(aviso.abierto,true);
    assert.equal(aviso.titulo,'Usuario sin permisos');
    assert.match(aviso.ip,/8\.8\.8\.8/);

    // ── La casilla solo la ve el Super Admin ──
    const casilla=await page.evaluate(()=>{
      window.__sa(false); _pintarAccesoRemoto(true);
      const oculto=document.getElementById('u-acceso-remoto-wrap').hidden;
      window.__sa(true); _pintarAccesoRemoto(true);
      return {oculto, visible:!document.getElementById('u-acceso-remoto-wrap').hidden,
              marcado:document.getElementById('u-acceso-remoto').checked};
    });
    assert.equal(casilla.oculto,true,'Un administrador de clínica no la ve');
    assert.equal(casilla.visible,true);
    assert.equal(casilla.marcado,true);

    // ── Guardar: solo el Super Admin, solo si cambió, y avisando si falta la migración ──
    const guardar=await page.evaluate(async()=>{
      const r={};
      window.__sb.length=0; window.__sa(false);
      document.getElementById('u-acceso-remoto').checked=true;
      r.noSA=[await _guardarAccesoRemoto('u1',false), window.__sb.length];
      window.__sb.length=0; window.__sa(true);
      r.sinCambio=[await _guardarAccesoRemoto('u1',true), window.__sb.length];
      window.__sb.length=0;
      r.cambio=[await _guardarAccesoRemoto('u1',false), window.__sb.slice()];
      window.__sb.length=0; window.__faltaColumna=true;
      r.falta=await _guardarAccesoRemoto('u1',false);
      return r;
    });
    assert.deepEqual(guardar.noSA,['',0],'Sin ser Super Admin no escribe nada');
    assert.deepEqual(guardar.sinCambio,['',0],'Si no cambió, no escribe');
    assert.equal(guardar.cambio[1].length,1);
    assert.deepEqual(guardar.cambio[1][0].payload,{acceso_remoto:true},'Solo escribe esa columna');
    assert.match(guardar.falta,/migracion_acceso_red\.sql/,'Nombra la migración que falta');

    // ── Cómo se ve el aviso ──
    const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
    for(const width of [1280,390,360]) {
      await page.setViewportSize({width,height:760});
      await page.setContent(`<style>${css}\n*{animation:none!important;transition:none!important}</style>`
        +modalHtml.replace('class="modal-overlay"','class="modal-overlay open"').replace('<p class="mc-red-ip" id="sin-permisos-red-ip"></p>','<p class="mc-red-ip" id="sin-permisos-red-ip">Red detectada: 186.77.201.14</p>'));
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth),0,'Desborde a '+width);
      const dest=path.join(process.env.TEMP||'/tmp','lumea-sin-permisos-'+width+'.png');
      await page.screenshot({path:dest});
      console.log('Layout '+width+' px: '+dest);
    }
    console.log('OK: IPs, fallo sin bloqueo, aviso, casilla solo Super Admin y guardado.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
