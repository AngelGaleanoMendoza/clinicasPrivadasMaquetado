const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {randomUUID}=require('node:crypto');
const {crearBase}=require('./importar-excel.cjs');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const ctx=vm.createContext({});
vm.runInContext(fs.readFileSync(require.resolve('../js/libro-contable.js'),'utf8'),ctx);
const libro=vm.runInContext('LibroContable',ctx);
const linea=(cuenta,nombre_cuenta,clase,debe='0',haber='0')=>({cuenta,nombre_cuenta,clase,debe,haber});
const apertura=[linea('1101-01-01','Banco A','activo','100.22'),linea('3101','Capital y resultados al corte','patrimonio','0','100.22')];
const base=[{cuenta:'4101',nombre_cuenta:'Servicios',clase:'ingreso',importe:'50'},{cuenta:'5101',nombre_cuenta:'Costo',clase:'costo',importe:'10'}];
const ejemplo=[linea('1102','Inventario','activo','22'),linea('2101','Cuentas por pagar','pasivo','0','22')];
const hoja=arr=>[{nombre:'Balance',filas:arr.map((linea,i)=>({numero:i+1,celdas:linea.map(valor=>({valor}))}))}];
const leer=arr=>libro.leerCierre(hoja(arr),'lineas',[]);
async function pantalla(db) {
  const browser=await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM?{executablePath:process.env.PLAYWRIGHT_CHROMIUM}:{channel:'msedge'});
  const raiz=path.resolve(__dirname,'..');
  try {
    const p=await browser.newPage({viewport:{width:390,height:850}});
    p.setDefaultTimeout(8000);
    await p.route('**/*',r=>{
      const u=new URL(r.request().url());
      if(u.origin==='http://localhost:38744') return r.fulfill({path:path.join(raiz,u.pathname==='/'?'index.html':u.pathname)});
      if(u.href.includes('@supabase/supabase-js')) return r.fulfill({contentType:'text/javascript',body:'window.supabase={createClient:()=>({auth:{onAuthStateChange(){},getSession:async()=>({data:{session:null}})}})}'});
      return r.abort();
    });
    await p.exposeFunction('consultaPrueba',async(nombre,a)=>{
      switch(nombre){
        case 'reporte_libro_contable':return (await db.query('SELECT reporte_libro_contable($1,$2,$3) d',[9,a.p_desde,a.p_hasta])).rows[0].d;
        case 'registrar_asiento_libro':return (await db.query('SELECT registrar_asiento_libro(9,$1,$2,$3,$4,$5,$6,$7,$8)',[a.p_solicitud,a.p_origen,a.p_fecha,a.p_documento,a.p_concepto,JSON.stringify(a.p_lineas),JSON.stringify(a.p_resultado),a.p_desde])).rows;
        case 'registrar_resultado_cierre':return (await db.query('SELECT registrar_resultado_cierre(9,$1,$2,$3)',[a.p_apertura,a.p_desde,JSON.stringify(a.p_filas)])).rows;
        case 'libro_diario_cuentas':return (await db.query('SELECT codigo,nombre,clase FROM libro_diario_cuentas WHERE clinica_id=9 ORDER BY codigo')).rows;
        case 'apertura':return (await db.query("SELECT id,fecha::text,documento,resultado_base,resultado_desde::text FROM libro_diario WHERE origen='apertura' AND clinica_id=9")).rows[0]||null;
        case 'libro_diario':return (await db.query('SELECT fecha::text,documento,lineas FROM libro_diario WHERE clinica_id=9 AND fecha BETWEEN $1 AND $2',[a.desde,a.hasta])).rows;
        default:throw Error(nombre);
      }
    });
    await p.goto('http://localhost:38744');
    await p.evaluate(async()=>{
      currentClinicaId=9;currentClinica={id:9,tipo:'empresa_medica'};currentUser={id:'u9',key:'admin_empresa'};
      hasPermiso=()=>true;hoy=()=>'2026-11-19';
      sb.rpc=async(n,a)=>({data:await consultaPrueba(n,a)});
      sb.from=t=>({select(){return this;},eq(){return this;},order(){return this;},
        gte(k,v){this.desde=v;return this;},lte(k,v){this.hasta=v;return this;},
        async range(){return {data:await consultaPrueba(t,{desde:this.desde,hasta:this.hasta})};},
        async maybeSingle(){return {data:await consultaPrueba('apertura',{})};}});
      document.getElementById('login-screen').style.display='none';
      document.getElementById('loading-overlay').classList.remove('show','boot');
      document.getElementById('app').classList.add('visible');
      await navigate('libro-contable');
    });
    await p.locator('#lc-filtros').waitFor();
    const tab=n=>p.locator('#lc-tabs [data-panel="'+n+'"]').click();
    await tab('apertura');
    await p.locator('[data-meta="fecha"]').fill('2026-10-31');
    await p.locator('[data-archivo="lineas"]').setInputFiles({name:'cierre.csv',mimeType:'text/csv',buffer:Buffer.from('Código;Nombre cuenta;Clase;Saldo final\r\n1101;Inventario;activo;10.00\r\n2101;Proveedores;pasivo;-10.00')});
    await p.waitForFunction(()=>document.getElementById('lc-estado').textContent.includes('2 cuentas agregadas'));
    await p.getByRole('button',{name:'Registrar apertura',exact:true}).click();
    await p.waitForFunction(()=>document.getElementById('lc-estado').textContent.includes('Apertura registrada'));
    await tab('apertura');
    await p.locator('[data-meta="desde"]').fill('2026-01-01');
    await p.locator('[data-archivo="resultado"]').setInputFiles({name:'resultado.csv',mimeType:'text/csv',buffer:Buffer.from('Código;Nombre cuenta;Clase;Importe\r\n4101;Ventas;ingreso;10.00\r\n5101;Costo de ventas;costo;10.00')});
    await p.waitForFunction(()=>document.getElementById('lc-estado').textContent.includes('2 cuentas agregadas'));
    await p.getByRole('button',{name:'Guardar estado de resultados del cierre'}).click();
    await p.waitForFunction(()=>document.getElementById('lc-estado').textContent.includes('inicial guardado'));
    await tab('asiento');
    await p.locator('[data-meta="documento"]').fill('DIARIO-22');
    await p.locator('[data-meta="concepto"]').fill('Ajuste de inventario');
    await p.locator('[data-k="cuenta"]').nth(0).fill('1101');await p.locator('[data-k="debe"]').nth(0).fill('22');
    await p.locator('[data-k="cuenta"]').nth(1).fill('2101');await p.locator('[data-k="haber"]').nth(1).fill('22');
    for(const width of [360,430,1280]){
      await p.setViewportSize({width,height:850});
      assert.ok(await p.locator('.lc-modulo').evaluate(e=>e.scrollWidth<=e.clientWidth+1));
    }
    await p.getByRole('button',{name:'Registrar asiento',exact:true}).click();
    await p.waitForFunction(()=>document.getElementById('lc-reporte')?.textContent.includes('DIARIO-22'));
    await p.locator('#lc-filtros [name=tipo]').selectOption('balanza');
    await p.locator('#lc-csv').waitFor();
    const csv=p.waitForEvent('download');await p.locator('#lc-csv').click();
    assert.match(fs.readFileSync(await (await csv).path(),'utf8'),/"2101";"Proveedores";-10.00;0.00;22.00;-32.00/);
  } finally {await browser.close();}
}
(async()=>{
  const db=await crearBase();
  try {
    const sql=fs.readFileSync(require.resolve('../migracion_libro_contable.sql'),'utf8');
    await db.exec(sql); await db.exec(sql);
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000003'; SET ROLE authenticated");
    const asiento=async(filas,origen='asiento',fecha='2026-11-01',doc='AJ-01',ref=[],uuid=randomUUID(),clinica=10)=>
      (await db.query('SELECT registrar_asiento_libro($1,$2,$3,$4,$5,$6,$7,$8,$9) id',[clinica,uuid,origen,fecha,doc,'Prueba de cierre',
        JSON.stringify(filas),JSON.stringify(ref),ref.length?'2026-01-01':null])).rows[0].id;
    const informe=async(desde,hasta,clinica=10)=>libro.construir((await db.query('SELECT reporte_libro_contable($1,$2,$3) d',[clinica,desde,hasta])).rows[0].d,desde,hasta);
    await db.exec('BEGIN');
    const preCierre=[linea('1101','Caja','activo','30'),linea('4101','Servicios','ingreso','0','50'),linea('5101','Costo','costo','20')];
    const cargaPrevia=ref=>db.query("SELECT registrar_asiento_libro(10,$1,'apertura','2026-10-31','CORTE','Corte',$2,$3,'2026-01-01')",
      [randomUUID(),JSON.stringify(preCierre),JSON.stringify(ref)]);
    await cargaPrevia([]);
    assert.equal((await informe('2026-01-01','2026-10-31')).resultados.filas.at(-1).at(-1),'C$ 30.00');
    assert.equal((await informe('2026-01-01','2026-10-31')).balance.filas.at(-1).at(-1),'C$ 30.00');
    await db.exec('ROLLBACK');
    await assert.rejects(cargaPrevia(base),/difiere/);
    const solicitud=randomUUID();
    const registro=await asiento(apertura,'apertura','2026-10-31','CIERRE',base,solicitud);
    assert.equal(await asiento(apertura,'apertura','2026-10-31','CIERRE',base,solicitud),registro);
    await assert.rejects(asiento(ejemplo,'apertura','2026-10-31','OTRO'),/corte/);
    await assert.rejects(asiento(ejemplo,'asiento','2026-10-30','ANTES'),/posterior/);
    await assert.rejects(asiento(ejemplo,'asiento','2026-11-01','AJ-01',[],randomUUID(),9),/permiso/);
    await assert.rejects(asiento([ejemplo[0],{...ejemplo[1],haber:'21.99'}]),/descuadrado/);
    await asiento(ejemplo);
    await asiento([linea('1101-01-01','Banco A','activo','7.50'),linea('4101','Servicios','ingreso','0','7.50')],'asiento','2026-11-02','AJ-02');
    const nov=await informe('2026-11-01','2026-11-30');
    assert.deepEqual(Array.from(nov.balanza.filas.find(f=>f[0]==='2101')),['2101','Cuentas por pagar','C$ 0.00','C$ 0.00','C$ 22.00','C$ -22.00']);
    assert.equal(nov.balance.filas.at(-1).at(-1),'C$ 129.72');
    assert.equal(nov.resultados.filas.at(-1).at(-1),'C$ 7.50');
    assert.equal((await informe('2026-01-01','2026-11-30')).resultados.filas.at(-1).at(-1),'C$ 47.50');
    assert.match((await informe('2026-10-01','2026-11-30')).pendienteResultado,/resumido/);
    assert.equal((await informe('2026-10-31','2026-10-31')).balanza.filas.find(f=>f[0]==='3101')[2],'C$ -100.22');
    assert.equal(Object.keys(await informe('2026-01-01','2026-11-30',9)).length,0);
    await db.exec('RESET ROLE');
    for(const tabla of ['compras','finanzas','inventario','inventario_movimientos']) assert.equal((await db.query('SELECT count(*) n FROM '+tabla)).rows[0].n,0);
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000002'; SET ROLE authenticated");
    assert.equal((await db.query('SELECT count(*) n FROM libro_diario')).rows[0].n,0);
    await assert.rejects(asiento(ejemplo),/permiso/);
    const filas=[['Número','Nombre Cuenta','Saldo Inicial','Débito','Crédito','Saldo Final'],['1101','Bancos',0,100,0,100],
      ['1101-01-01','Banco A',0,80,0,80],['1101-01-02','Banco B',0,20,0,20],['2101','Proveedores',0,0,100,-100]];
    const carga=leer(filas);
    assert.equal(carga.filas.length,3);assert.equal(carga.subtotales,1);assert.equal(carga.filas[2].haber,'100.00');
    assert.equal(carga.filas[0].nombre_grupo,'Bancos');
    assert.throws(()=>leer(filas.map((r,i)=>i===1?[...r.slice(0,-1),99]:r)),/subtotal/);
    await db.exec("RESET ROLE; UPDATE profiles SET permisos='[\"contabilidad\"]' WHERE clinica_id=9 AND nombre='Admin'; SET test.uid='c0000000-0000-0000-0000-000000000001'; SET ROLE authenticated");
    await pantalla(db);
    console.log('OK: apertura, resultado inicial, C$22 contra proveedores, reintentos, corte, clasificación, exportables y permisos.');
  } finally {await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
