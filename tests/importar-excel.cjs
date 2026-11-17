// Ejecutar con PLAYWRIGHT_MODULE y PGLITE_MODULE si no están en node_modules.
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const {PGlite} = require(process.env.PGLITE_MODULE || '@electric-sql/pglite');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname,'..');
const XLSX = require(path.join(raiz,'js/vendor/xlsx-0.20.3.full.min.js'));

async function crearBase() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('test.uid',true),'')::uuid $$;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$ SELECT '{}'::jsonb $$;
    CREATE TABLE clinicas(id bigint PRIMARY KEY,tipo text,categorias_finanzas jsonb);
    CREATE TABLE profiles(id uuid PRIMARY KEY,email text,clinica_id bigint,nombre text,rol text,permisos jsonb);
    CREATE FUNCTION get_my_clinica_id() RETURNS bigint LANGUAGE sql STABLE AS
      $$ SELECT clinica_id FROM public.profiles WHERE id=auth.uid() $$;
    CREATE FUNCTION is_superadmin() RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
    CREATE TABLE finanzas(id bigserial PRIMARY KEY,clinica_id bigint,tipo text,categoria text,descripcion text,
      monto numeric(12,2) CHECK (monto > 0),fecha date,metodo_pago text,referencia text,creado_por text);
    CREATE TABLE inventario(id bigserial PRIMARY KEY,clinica_id bigint,nombre text,categoria text,unidad text,
      stock_actual numeric(12,3),stock_minimo numeric(12,3),costo_unitario numeric(14,4),precio_unitario numeric(12,2),
      descripcion text,fecha_vencimiento date);
    CREATE TABLE inventario_movimientos(id bigserial PRIMARY KEY,clinica_id bigint,inventario_id bigint REFERENCES inventario(id),
      tipo text,cantidad numeric(12,3),motivo text,fecha date);
    INSERT INTO clinicas VALUES (9,'clinica',null),(10,'empresa_medica',null);
    INSERT INTO profiles VALUES
      ('c0000000-0000-0000-0000-000000000001','admin@example.com',9,'Admin','medico_admin','["finanzas","inventario"]'),
      ('c0000000-0000-0000-0000-000000000002','restricted@example.com',9,'Recepción','medico_admin','[]'),
      ('c0000000-0000-0000-0000-000000000003','another@example.com',10,'Empresa','admin_empresa',null);
    SET test.uid='c0000000-0000-0000-0000-000000000001';
  `);
  const migracion = fs.readFileSync(path.join(raiz,'migracion_importar_excel.sql'),'utf8');
  await db.exec(migracion);
  await db.exec(migracion);
  return db;
}

const destino = (tipo,fila,datos) => ({tipo,fila,datos,archivo:'lote.xlsx',hoja:'Hoja'});
const producto = destino('productos',2,{nombre:'Gasas',fecha:'2026-11-01',costo:4.52,stock:10.25});
const movimiento = destino('movimientos',3,{producto:'GASAS',fecha:'2026-11-04',id_origen:'S01',clase:'salida',cantidad:3.5});
const ingreso = destino('finanzas',2,{id_origen:'C01',descripcion:'Consulta',fecha:'2026-11-03',clase:'ingreso',monto:98.25});
const egreso = destino('finanzas',3,{id_origen:'G01',descripcion:'Alquiler',fecha:'2026-11-04',clase:'egreso',monto:30.12});

async function importar(db, filas, confirmar = false, clinica = 9, revision = null) {
  return (await db.query('SELECT public.importar_excel($1,$2,$3,$4) AS resultado',[clinica,JSON.stringify(filas),confirmar,revision])).rows[0].resultado;
}

async function verificarBase(db) {
  const filas = [movimiento, ingreso, producto, egreso];
  const previa = await importar(db,filas);
  assert.equal(previa.resumen.nuevas,4);
  assert.equal(previa.resumen.egresos,30.12);
  assert.match(previa.filas[0].detalle,/saldo 6.75/);
  assert.equal((await db.query('SELECT * FROM finanzas')).rows.length,0);
  assert.equal((await importar(db,filas,true,9,'previa-obsoleta')).cambio,true);

  const invalida = {...movimiento, datos:{...movimiento.datos,cantidad:11}};
  assert.equal((await importar(db,[producto,ingreso,invalida],true)).resumen.errores,1);
  assert.equal((await db.query('SELECT * FROM inventario')).rows.length,0);
  await db.exec("ALTER TABLE finanzas ADD CONSTRAINT probar_atomicidad CHECK (descripcion <> 'Falla')");
  await assert.rejects(importar(db,[...filas,destino('finanzas',4,{...egreso.datos,id_origen:'G02',descripcion:'Falla'})],true));
  assert.equal((await db.query('SELECT * FROM importaciones_excel')).rows.length,0);
  assert.equal((await db.query('SELECT * FROM inventario')).rows.length,0);

  const guardada = await importar(db,filas,true,9,previa.revision);
  assert.ok(guardada.lote);
  assert.deepEqual(guardada.resumen,previa.resumen);
  assert.equal((await db.query('SELECT stock_actual FROM inventario')).rows[0].stock_actual,'6.750');
  assert.deepEqual((await db.query('SELECT monto FROM finanzas ORDER BY fecha')).rows.map(r=>r.monto),['98.25','30.12']);
  assert.equal((await db.query('SELECT * FROM inventario_movimientos')).rows.length,2);
  assert.equal((await db.query('SELECT * FROM importaciones_excel_filas')).rows.length,4);
  const repetida = await importar(db,filas,true);
  assert.equal(repetida.resumen.duplicadas,4);
  assert.equal(repetida.lote,null);
  assert.equal(repetida.filas[2].lote,guardada.lote);
  assert.match((await importar(db,[{...ingreso,datos:{...ingreso.datos,monto:100}}])).filas[0].error,/datos diferentes/);
  await assert.rejects(importar(db,filas,false,10),/permisos/);
  await db.exec("SET ROLE authenticated; SET test.uid='c0000000-0000-0000-0000-000000000002'");
  assert.equal((await db.query('SELECT * FROM importaciones_excel')).rows.length,0);
  await assert.rejects(importar(db,[ingreso]),/permisos/);
  await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000001'");
  assert.equal((await db.query('SELECT * FROM importaciones_excel_filas')).rows.length,4);
  await assert.rejects(db.query('DELETE FROM importaciones_excel'),/permission denied/);
  await db.exec('RESET ROLE');
}

async function verificarPantalla(db) {
  const navegador = await chromium.launch(process.env.PLAYWRIGHT_CHROMIUM
    ? {executablePath:process.env.PLAYWRIGHT_CHROMIUM} : {channel:'msedge'});
  try {
    const pagina = await navegador.newPage({viewport:{width:360,height:800}});
    pagina.setDefaultTimeout(7000);
    const html = fs.readFileSync(path.join(raiz,'index.html'),'utf8');
    await pagina.exposeFunction('importarPrueba', ({p_clinica,p_filas,p_confirmar,p_revision}) =>
      importar(db,p_filas,p_confirmar,p_clinica,p_revision).then(data=>({data})));
    await pagina.exposeFunction('recibosPrueba', async id => ({
      data:(await (id ? db.query('SELECT * FROM importaciones_excel_filas WHERE lote_id=$1 ORDER BY ordinal',[id])
        : db.query('SELECT * FROM importaciones_excel ORDER BY creado_en DESC'))).rows
    }));
    await pagina.route('**/*', async ruta => {
      const url = new URL(ruta.request().url());
      if (url.origin !== 'http://app.test') return ruta.abort();
      if (url.pathname === '/') return ruta.fulfill({contentType:'text/html; charset=utf-8',body:html});
      if (url.pathname === '/js/app.js') return ruta.fulfill({contentType:'text/javascript',body:`
        const sb={rpc:(_,args)=>importarPrueba(args),from:()=>({
          id:null,select(){return this;},eq(k,v){if(k==='lote_id') this.id=v;return this;},order(){return this;},
          limit(){return recibosPrueba(null);},range(){return recibosPrueba(this.id);}
        })};
        const consultarPaginas=fn=>fn().range();
        const currentClinicaId=9,currentClinica={nombre:'Clínica de prueba'},currentUser={id:'u1'},currentView='finanzas';
        const toast=()=>{},hasPermiso=()=>true,esEmpresaMedica=()=>false,loadAll=async()=>{},renderFinanzas=()=>{};
        const escAttr=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const fmtC=x=>'C$ '+x;
        const openModalOverlay=id=>document.getElementById(id).classList.add('open');
        const closeModal=id=>document.getElementById(id).classList.remove('open');
      `});
      return ruta.fulfill({path:path.join(raiz,url.pathname)});
    });
    await pagina.goto('http://app.test/');
    await pagina.evaluate(() => {
      document.getElementById('loading-overlay').hidden = true;
      document.getElementById('loading-overlay').style.display = 'none';
      ExcelImportacion.abrir();
    });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([
      ['Registro de caja'],['Folio','Fecha','Tipo','Concepto','Importe'],
      ['UI-01',{t:'n',v:(Date.UTC(2026,10,12)-Date.UTC(1899,11,30))/86400000,z:'yyyy-mm-dd'},'gasto','Limpieza',17.35]
    ]),'Caja');
    XLSX.utils.book_append_sheet(workbook,XLSX.utils.aoa_to_sheet([
      ['Nombre','Stock','Costo unitario','Fecha'],['Batas',8,1.5,'12/11/2026']
    ]),'Catálogo');
    await pagina.locator('#excel-archivos').setInputFiles([
      {name:'carga.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(workbook,{type:'array',bookType:'xlsx'}))},
      {name:'noviembre.csv',mimeType:'text/csv',buffer:Buffer.from('id_origen;producto;fecha;clase;cantidad\r\nUI-02;Batas;2026-11-13;salida;2,5')}
    ]);
    await pagina.locator('[data-hoja="0"] [data-campo="tipo"]').selectOption('finanzas');
    await pagina.locator('[data-hoja="0"] [data-campo="encabezado"]').fill('2');
    await pagina.locator('[data-hoja="0"] [data-campo="encabezado"]').press('Tab');
    await pagina.locator('[data-hoja="1"] [data-campo="tipo"]').selectOption('productos');
    await pagina.locator('[data-hoja="2"] [data-campo="tipo"]').selectOption('movimientos');
    await pagina.locator('#excel-revisar').click();
    await pagina.locator('#excel-confirmar').waitFor().catch(async error => {
      throw new Error(await pagina.locator('#excel-estado').innerText() + '\n' +
        await pagina.locator('#excel-resultados').innerText(),{cause:error});
    });
    assert.match(await pagina.locator('#excel-resultados').innerText(), /3 nuevas[\s\S]*17.35[\s\S]*saldo 5.5/);
    for (const ancho of [360,430,1280]) {
      await pagina.setViewportSize({width:ancho,height:800});
      assert.equal(await pagina.locator('.excel-modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1),true);
      if (process.env.EXCEL_SCREENSHOT_DIR) {
        await pagina.locator('#excel-resultados').scrollIntoViewIfNeeded();
        await pagina.screenshot({path:path.join(process.env.EXCEL_SCREENSHOT_DIR,`excel-${ancho}.png`)});
      }
    }
    await pagina.locator('#excel-confirmar').click();
    await pagina.getByRole('status').filter({hasText:'Importación guardada'}).waitFor();
    assert.equal((await db.query("SELECT stock_actual FROM inventario WHERE nombre='Batas'")).rows[0].stock_actual,'5.500');
    const descarga = pagina.waitForEvent('download');
    await pagina.getByRole('button',{name:'Descargar comprobante'}).first().click();
    const recibo = JSON.parse(fs.readFileSync(await (await descarga).path(),'utf8'));
    assert.equal(recibo.filas.length,3);
    assert.deepEqual(recibo.filas.map(r=>r.archivo),['carga.xlsx','carga.xlsx','noviembre.csv']);
    const viejo = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(viejo,XLSX.utils.aoa_to_sheet([
      ['id_origen','fecha','clase','descripcion','monto'],['XLS-1','2026-11-13','ingreso','Ejemplo',25]
    ]),'Histórico');
    await pagina.locator('#excel-archivos').setInputFiles({
      name:'historico.xls',mimeType:'application/vnd.ms-excel',buffer:Buffer.from(XLSX.write(viejo,{type:'array',bookType:'biff8'}))
    });
    await pagina.locator('[data-hoja="0"] [data-campo="tipo"]').selectOption('finanzas');
    await pagina.locator('#excel-revisar').click();
    await pagina.locator('#excel-confirmar').waitFor();
    assert.match(await pagina.locator('#excel-resultados').innerText(), /Ingresos C\$ 25/);
  } finally {
    await navegador.close();
  }
}

(async () => {
  const db = await crearBase();
  try {
    await verificarBase(db);
    await verificarPantalla(db);
    console.log('Importación de Excel: validación, idempotencia, RLS, transacción y pantalla verificadas.');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
