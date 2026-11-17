// PLAYWRIGHT_MODULE y PGLITE_MODULE permiten usar dependencias fuera del repo.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {PGlite} = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const raiz = path.resolve(__dirname,'..');
const leer = ruta => fs.readFileSync(path.join(raiz,ruta),'utf8');
const uid = n => `a0000000-0000-0000-0000-00000000000${n}`;
const respaldoId = 'b0000000-0000-0000-0000-000000000001';

async function probarSQL() {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth; GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
        $$ SELECT nullif(current_setting('prueba.uid',true),'')::uuid $$;
      CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
      CREATE TABLE auth.users(id uuid PRIMARY KEY,email text,email_confirmed_at timestamptz,banned_until timestamptz);
      CREATE TABLE public.clinicas(id bigint PRIMARY KEY,nombre text,tipo text);
      CREATE TABLE public.profiles(id uuid PRIMARY KEY,clinica_id bigint,email text,rol text,permisos jsonb,bloqueado boolean DEFAULT false);
      GRANT SELECT,UPDATE,INSERT ON public.profiles TO authenticated;
      CREATE FUNCTION public.get_my_clinica_id() RETURNS bigint LANGUAGE sql STABLE AS
        $$ SELECT clinica_id FROM public.profiles WHERE id=auth.uid() $$;
      CREATE FUNCTION public.is_superadmin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT auth.uid() = '${uid(9)}'::uuid $$;
      CREATE TABLE finanzas(clinica_id bigint,tipo text,monto numeric,fecha date);
      CREATE TABLE pacientes(clinica_id bigint, nombre text);
      CREATE TABLE citas(clinica_id bigint,estado text,fecha date);
      CREATE TABLE inventario(clinica_id bigint,stock_actual numeric,stock_minimo numeric);
      CREATE TABLE inventario_movimientos(clinica_id bigint,tipo text,fecha date);
      CREATE TABLE facturas(clinica_id bigint,estado text,total numeric,fecha date);
      CREATE TABLE compras(clinica_id bigint,estado text,total numeric,fecha date);
      INSERT INTO clinicas VALUES(1,'Clínica A','clinica'),(2,'Clínica B','clinica');
    `);
    const migration = leer('migracion_reportes_respaldo.sql');
    await db.exec(migration);
    await db.exec(migration);
    await db.exec(`
      INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
        ('${uid(1)}','persona1@example.test',now()),
        ('${uid(2)}','persona2@example.test',now()),
        ('${uid(3)}','persona3@example.test',null),
        ('${uid(4)}','persona4@example.test',now()),
        ('${uid(5)}','persona5@example.test',now()),
        ('${uid(6)}','persona6@example.test',now());
      INSERT INTO profiles(id,clinica_id,email,rol,permisos,reportes_respaldo) VALUES
        ('${uid(1)}',1,'persona1@example.test','medico_admin',null,'{"tipos":["actividad","finanzas"],"periodo":"hoy"}'),
        ('${uid(2)}',1,'persona2@example.test','medico_admin','["finanzas","inventario","contabilidad"]','{"tipos":["finanzas","inventario","contabilidad"],"periodo":"historial"}'),
        ('${uid(3)}',1,'persona3@example.test','medico_admin',null,'{"tipos":["actividad"],"periodo":"mes"}'),
        ('${uid(4)}',2,'persona4@example.test','medico_admin',null,'{"tipos":["actividad"],"periodo":"mes"}'),
        ('${uid(5)}',1,'persona5@example.test','medico_admin','[]','{"tipos":["actividad"],"periodo":"mes"}'),
        ('${uid(6)}',1,'correo-diferente@example.test','medico_admin',null,'{"tipos":["actividad"],"periodo":"mes"}');
      INSERT INTO pacientes VALUES (1,'Paciente confidencial'),(2,'Otro paciente');
      INSERT INTO citas VALUES(1,'completada',(now() AT TIME ZONE 'America/Managua')::date);
      INSERT INTO finanzas VALUES
        (1,'ingreso',75.10,(now() AT TIME ZONE 'America/Managua')::date),
        (1,'egreso',5.05,(now() AT TIME ZONE 'America/Managua')::date - 400),
        (1,'ingreso',500,(now() AT TIME ZONE 'America/Managua')::date + 1),
        (2,'ingreso',999,(now() AT TIME ZONE 'America/Managua')::date);
      INSERT INTO inventario VALUES (1,0,4),(1,2,4),(1,7,4),(2,4,4);
      INSERT INTO inventario_movimientos VALUES (1,'entrada',(now() AT TIME ZONE 'America/Managua')::date);
      INSERT INTO facturas VALUES (1,'pagada',120,(now() AT TIME ZONE 'America/Managua')::date),(1,'anulada',15,(now() AT TIME ZONE 'America/Managua')::date);
      INSERT INTO compras VALUES (1,'registrada',30,(now() AT TIME ZONE 'America/Managua')::date);
      SET ROLE authenticated; SET prueba.uid='${uid(1)}';
    `);
    const preparar = async (clinica = 1, id = respaldoId) =>
      (await db.query("SELECT preparar_reportes_respaldo($1,$2,'json') AS n",[id,clinica])).rows[0].n;
    const lote = async id =>
      (await db.query('SELECT lote_reportes_respaldo($1,$2) AS lote',[respaldoId,id])).rows[0].lote;
    assert.equal(await preparar(),2);
    assert.equal(await preparar(),2);
    assert.equal((await db.query('SELECT * FROM pendientes_reportes_respaldo(1)')).rows.length,1);
    assert.equal((await db.query('SELECT * FROM pendientes_reportes_respaldo(2)')).rows.length,0);
    await assert.rejects(preparar(2),/No tienes permiso/);
    await assert.rejects(lote(uid(1)),/permission denied/);
    await assert.rejects(db.query('SELECT * FROM respaldos_reportes_envios'),/permission denied/);
    await assert.rejects(db.query(`UPDATE profiles SET reportes_respaldo='{"tipos":["finanzas"],"periodo":"hoy"}' WHERE id='${uid(1)}'`),/Solo el Super Admin/);
    await db.exec(`UPDATE profiles SET clinica_id=2 WHERE id='${uid(6)}'`);
    assert.deepEqual((await db.query('SELECT reportes_respaldo FROM profiles WHERE id=$1',[uid(6)])).rows[0].reportes_respaldo.tipos,[]);
    await db.exec(`SET prueba.uid='${uid(5)}'`);
    await assert.rejects(preparar(),/No tienes permiso/);
    await db.exec('RESET ROLE; RESET prueba.uid; SET ROLE service_role');
    assert.equal(await lote(uid(2)),null);
    const datos = await lote(uid(1));
    assert.deepEqual(Object.keys(datos.envios[0].reportes),['actividad']);
    assert.equal(datos.envios[0].reportes.actividad['Pacientes en el padrón al corte'],1);
    assert.equal(datos.envios[0].reportes.actividad['Citas completadas del período'],1);
    assert.equal(datos.envios[1].reportes.finanzas['Flujo neto (C$)'],70.05);
    assert.equal(datos.envios[1].reportes.inventario['Productos agotados al corte'],1);
    assert.equal(datos.envios[1].reportes.contabilidad['Total de documentos (C$)'],120);
    assert.equal(datos.envios[1].reportes.contabilidad['Total de compras (C$)'],30);
    assert.doesNotMatch(JSON.stringify(datos.envios),/Paciente confidencial|persona3|persona4|persona5|persona6/);
    await db.exec(`UPDATE respaldos_reportes_envios SET estado='aceptado' WHERE usuario_id='${uid(1)}';
      RESET ROLE; UPDATE profiles SET permisos='[]' WHERE id='${uid(2)}'; SET ROLE service_role`);
    const revisado = await lote(uid(1));
    assert.equal(revisado.aceptados,1);
    assert.equal(revisado.omitidos,1);
    assert.equal(revisado.pendientes,0);
    assert.deepEqual(revisado.envios,[]);
    await db.exec(`RESET ROLE; SET ROLE authenticated; SET prueba.uid='${uid(9)}';
      UPDATE profiles SET reportes_respaldo='{"tipos":["actividad"],"periodo":"semana"}' WHERE id='${uid(1)}'`);
    assert.equal((await db.query('SELECT reportes_respaldo FROM profiles WHERE id=$1',[uid(1)])).rows[0].reportes_respaldo.periodo,'semana');
    const zip = 'b0000000-0000-0000-0000-000000000002';
    assert.equal((await db.query("SELECT preparar_reportes_respaldo($1,1,'zip') AS n",[zip])).rows[0].n,1);
    await db.exec('RESET ROLE');
    assert.equal((await db.query('SELECT formato FROM respaldos_reportes WHERE id=$1',[zip])).rows[0].formato,'zip');
  } finally {
    await db.close();
  }
}

const fuente = leer('js/app.js');
function extraer(nombre) {
  const i = fuente.search(new RegExp(`^(async )?function ${nombre}\\(`,'m'));
  assert.ok(i >= 0,nombre);
  return fuente.slice(i,fuente.indexOf('\n}',i)+2);
}

async function probarPantalla() {
  const navegador = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM
    ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM} : {channel:'msedge'});
  try {
    const pagina = await navegador.newPage({viewport:{width:360,height:800}});
    const html = leer('index.html'), css = leer('css/styles.css');
    const origen = 'http://localhost:38637/';
    await pagina.route('**/*',r => {
      if(r.request().url() === origen) return r.fulfill({contentType:'text/html;charset=utf-8',body:html});
      if(r.request().url().startsWith(origen+'css/')) return r.fulfill({contentType:'text/css',body:css});
      return r.abort();
    });
    await pagina.goto(origen);
    await pagina.addScriptTag({content:`
      const adminClinicas=[{id:1,tipo:'clinica'},{id:2,tipo:'empresa_medica'}];
      let currentClinicaId=1, currentUser={id:'u1'}, exito=false, registrado=null;
      const esEmpresaMedica=c=>c?.tipo==='empresa_medica', isSuperAdmin=()=>true;
      const _exigeClinica=()=>true, hasPermiso=p=>p==='exportar', setLoading=()=>{};
      const escAttr=s=>String(s);
      const avisos=[],descargas=[],llamadas=[];
      const toast=(...args)=>avisos.push(args);
      const _construirBackupClinica=async()=>({clinica:{id:1},advertencias:[],resumen:{pacientes:1},pacientes:['privado']});
      const _nombreArchivoBackup=()=> 'backup.json', _descargarArchivo=blob=>descargas.push(blob);
      const sb={rpc:async(nombre,args)=>{
        llamadas.push([nombre,args]);
        if(nombre==='preparar_reportes_respaldo'){registrado=args.p_id; return {data:1};}
        return {data:registrado&&!exito?[{id:registrado,formato:'json',creado_en:'2026-11-17',pendientes:1}]:[]};
      },functions:{invoke:async(nombre,args)=>{
        llamadas.push([nombre,args]);
        return {data:{configurado:true,pendientes:exito?0:1,aceptados:exito?1:0,omitidos:0}};
      }}};
      const _enviosRespaldoActivos=new Set();
      ${['exportarJSON','_notificarReportesRespaldo','_enviarReportesRespaldo','_mostrarReportesRespaldoPendientes',
        '_pintarReportesRespaldo','_actualizarOpcionesReportesRespaldo','_leerReportesRespaldo','_escribirPerfilConReportes',
        '_faltaColumna'].map(extraer).join('\n')}
      document.querySelectorAll('.loading-overlay,#login-screen').forEach(e=>e.style.display='none');
      document.getElementById('app').classList.add('visible');
      document.getElementById('view-exportar').classList.add('active');
    `});
    await pagina.evaluate(() => {
      document.getElementById('modal-usuario').classList.add('open');
      document.getElementById('u-clinica').innerHTML = '<option value="1">Clínica</option><option value="2">Empresa</option>';
      document.getElementById('u-permisos-grid').innerHTML = '<input type="checkbox" id="perm-finanzas" checked>';
      _pintarReportesRespaldo({tipos:['actividad','finanzas'],periodo:'semana'});
    });
    assert.deepEqual(await pagina.evaluate(() => _leerReportesRespaldo()),{tipos:['finanzas'],periodo:'semana'});
    assert.equal(await pagina.locator('#u-reportes-respaldo [value="actividad"]').isDisabled(),true);
    for (const ancho of [360,430,1280]) {
      await pagina.setViewportSize({width:ancho,height:800});
      assert.equal(await pagina.locator('#u-reportes-respaldo').evaluate(el => el.scrollWidth <= el.clientWidth+1),true);
      if(process.env.REPORTES_SCREENSHOT_DIR) {
        await pagina.locator('#u-reportes-respaldo').scrollIntoViewIfNeeded();
        await pagina.screenshot({path:path.join(process.env.REPORTES_SCREENSHOT_DIR,`reportes-usuario-${ancho}.png`)});
      }
    }
    const perfil = await pagina.evaluate(async() => {
      const escrituras=[];
      const resp=await _escribirPerfilConReportes(async datos => {
        escrituras.push(datos);
        return {error:datos.reportes_respaldo ? {code:'PGRST204',message:"Could not find the 'reportes_respaldo' column"} : null};
      },{nombre:'Ejemplo'},_leerReportesRespaldo());
      return {escrituras, resp};
    });
    assert.equal(perfil.escrituras[0].reportes_respaldo.periodo,'semana');
    assert.deepEqual(perfil.escrituras[1],{nombre:'Ejemplo'});
    assert.match(perfil.resp.avisoReportes,/migracion_reportes_respaldo/);
    await pagina.evaluate(async() => {
      document.getElementById('modal-usuario').classList.remove('open');
      await exportarJSON();
    });
    const llamada = await pagina.evaluate(() => ({llamadas,avisos,total:descargas.length}));
    assert.equal(llamada.total,1);
    assert.equal(llamada.llamadas[0][0],'preparar_reportes_respaldo');
    assert.deepEqual(Object.keys(llamada.llamadas[0][1]).sort(),['p_clinica','p_formato','p_id']);
    assert.deepEqual(llamada.llamadas[1],['enviar-reportes-respaldo',{body:{id:llamada.llamadas[0][1].p_id}}]);
    assert.doesNotMatch(JSON.stringify(llamada.llamadas),/privado/);
    await pagina.evaluate(() => {exito=true;});
    await pagina.getByRole('button',{name:'Reintentar'}).click();
    await pagina.locator('#export-respaldos-pendientes').waitFor({state:'hidden'});
    assert.equal(await pagina.evaluate(() => llamadas.filter(([nombre])=>nombre==='enviar-reportes-respaldo').length),2);
  } finally {
    await navegador.close();
  }
}

async function probarFuncionCorreo() {
  const {stripTypeScriptTypes} = require('node:module');
  const {runInNewContext} = require('node:vm');
  const codigo = leer('supabase/functions/enviar-reportes-respaldo/index.ts').replace(/^import[^\n]+\n/,'');
  let handler, aceptarSegundo = false;
  const peticiones = [];
  const idsAceptados = new Set();
  const envios = [
    {usuario_id:uid(1),correo:'uno@example.test',desde:null,hasta:'2026-11-17',reportes:{finanzas:{'Ingresos (C$)':98.5}}},
    {usuario_id:uid(2),correo:'dos@example.test',desde:'2026-11-01',hasta:'2026-11-17',reportes:{inventario:{'Productos agotados':2}}}
  ];
  const supabase = {
    auth:{getUser:async token => ({data:{user:token==='sesion-valida'?{id:uid(1)}:null}})},
    rpc:async (_,args) => ({
      data:args.p_solicitante === uid(1) && args.p_id === respaldoId ? {
        establecimiento:'A & B',formato:'json',creado_en:'2026-11-17T18:00:00Z',
        aceptados:idsAceptados.size,omitidos:0,pendientes:envios.length-idsAceptados.size,
        envios:args.p_despues ? [] : envios.filter(e=>!idsAceptados.has(e.usuario_id))
      } : null
    }),
    from:() => ({update:() => {
      const filtros = {};
      const builder = {
        eq(k,v){ filtros[k] = v; return builder; },
        then(resolve){ idsAceptados.add(filtros.usuario_id); resolve({error:null}); }
      };
      return builder;
    }})
  };
  runInNewContext(stripTypeScriptTypes(codigo),{
    Deno:{env:{get:n=>n==='RESPALDOS_CORREO_DESDE'?'LumeaMed <reportes@example.test>':'probar'},serve:fn=>{handler=fn;}},
    createClient:()=>supabase,
    Response,AbortSignal,setTimeout,
    fetch:async (url,opciones) => {
      assert.equal(url,'https://api.resend.com/emails');
      const mensaje = JSON.parse(opciones.body);
      peticiones.push({mensaje, clave:opciones.headers['Idempotency-Key']});
      if(mensaje.to[0] === 'dos@example.test' && !aceptarSegundo) {
        return new Response(null,{status:422});
      }
      return Response.json({id:'correo-'+mensaje.to[0]});
    }
  });
  const llamar = token => handler(new Request('https://example.test/',{
    method:'POST',headers:{authorization:'Bearer '+token},body:JSON.stringify({id:respaldoId})
  }));
  assert.equal((await llamar('sesion-invalida')).status,401);
  assert.equal(peticiones.length,0);
  assert.deepEqual(await (await llamar('sesion-valida')).json(),{aceptados:1,omitidos:0,pendientes:1,configurado:true});
  assert.match(peticiones[0].mensaje.html,/A &amp; B[\s\S]*Finanzas/);
  assert.doesNotMatch(peticiones[0].mensaje.html,/Inventario|dos@example.test/);
  aceptarSegundo = true;
  assert.deepEqual(await (await llamar('sesion-valida')).json(),{aceptados:2,omitidos:0,pendientes:0,configurado:true});
  assert.deepEqual(peticiones.map(p=>p.mensaje.to[0]),['uno@example.test','dos@example.test','dos@example.test']);
  assert.equal(peticiones[1].clave,peticiones[2].clave);
}

(async () => {
  await probarSQL();
  await probarPantalla();
  await probarFuncionCorreo();
  console.log('OK: permisos y correos confirmados, reportes por período, reintento, respaldo, función de correo y formulario responsive.');
})().catch(error => { console.error(error); process.exitCode = 1; });
