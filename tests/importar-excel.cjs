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
    CREATE TABLE proveedores(id bigserial PRIMARY KEY,clinica_id bigint,nombre text NOT NULL,identificacion text,contacto text,
      telefono text,email text,direccion text,notas text,activo boolean DEFAULT true);
    CREATE TABLE clientes_comerciales(id bigserial PRIMARY KEY,clinica_id bigint,nombre text NOT NULL,identificacion text,contacto text,
      telefono text,email text,direccion text,dias_credito integer NOT NULL DEFAULT 30,notas text,activo boolean DEFAULT true);
    CREATE TABLE ventas(id bigserial PRIMARY KEY,clinica_id bigint,cliente_id bigint REFERENCES clientes_comerciales(id),numero text NOT NULL,
      fecha date,subtotal numeric(14,2),iva_pct numeric(5,2),iva numeric(14,2),total numeric(14,2),condicion text,vencimiento date,
      estado text,notas text,creado_por text,UNIQUE(clinica_id,numero));
    CREATE TABLE venta_items(id bigserial PRIMARY KEY,venta_id bigint REFERENCES ventas(id),clinica_id bigint,descripcion text,
      cantidad numeric(14,3),precio_unitario numeric(14,4),costo_unitario numeric(14,4),subtotal numeric(14,2));
    CREATE TABLE venta_cobros(id bigserial PRIMARY KEY,venta_id bigint REFERENCES ventas(id),clinica_id bigint,fecha date,monto numeric(14,2),
      metodo_pago text,referencia text,creado_por text);
    CREATE TABLE compras(id bigserial PRIMARY KEY,clinica_id bigint,proveedor_id bigint REFERENCES proveedores(id),fecha date,numero_factura text,
      metodo_pago text,subtotal numeric(14,2),iva numeric(14,2),iva_pct numeric(5,2),total numeric(14,2),condicion text,vencimiento date,
      estado text DEFAULT 'registrada',notas text,creado_por text);
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
  // Simula los datos dejados por la migración original y aplica la actualización completa.
  await db.exec("UPDATE importaciones_excel_filas SET datos=datos-'costo_total' WHERE tipo='productos'");
  await db.exec('UPDATE inventario_movimientos SET valor_costo=null,costo_unitario=null,costo_importado=null');
  await db.exec(fs.readFileSync(path.join(raiz,'migracion_importar_excel.sql'),'utf8'));
  const anteriores = (await db.query('SELECT tipo,costo_importado,valor_costo FROM inventario_movimientos ORDER BY id')).rows;
  assert.deepEqual(anteriores.map(x=>[x.tipo,x.costo_importado,x.valor_costo]),[['entrada',true,'46.33'],['salida',true,null]]);
  assert.equal((await importar(db,[producto],true)).resumen.duplicadas,1);
}

async function verificarInventarioValorizado(db) {
  // Mantener el inventario de las otras pruebas, incluyendo sus comprobantes previos.
  await db.exec('BEGIN');
  try {
    const altas = [
      destino('productos',2,{sku:'001-A',nombre:'Reactivo',stock:3,costo_total:10,fecha:'2026-10-01'}),
      destino('productos',3,{nombre:'Pendiente de compra',stock:0}),
      destino('productos',4,{nombre:'Muestra',stock:2,costo:0,fecha:'2026-10-01'})
    ];
    const mov = (fila,datos) => destino('movimientos',fila,{
      producto:'Reactivo',id_origen:'K-' + fila,fecha:'2026-10-02',...datos
    });
    const movimientos = [mov(5,{clase:'entrada',cantidad:2.5,costo:1.2345,sku:'001-a',unidad:'unidad'}),
      mov(6,{clase:'salida',cantidad:1,costo_total:2.87}),mov(7,{clase:'salida',cantidad:1})];
    const filas = [...altas,...movimientos];
    const erroneas = [
      {...altas[0].datos,costo:3,costo_total:10},
      {...altas[0].datos,stock:0,costo_total:1},
      {...altas[0].datos,stock:1000,costo_total:0.01},
      {...altas[0].datos,stock:3,costo_total:10.001},
      {...altas[0].datos,sku:'001-a',nombre:'Otro reactivo'}
    ];
    for (const datos of erroneas) {
      const resultado = await importar(db,[altas[0],destino('productos',9,datos)],true);
      assert.equal(resultado.resumen.errores,1,JSON.stringify(resultado.filas));
      assert.equal(resultado.lote,null);
    }
    const resultado = await importar(db,filas,true);
    assert.equal(resultado.resumen.errores,0,JSON.stringify(resultado.filas));
    const r = resultado.resumen;
    assert.deepEqual([r.valor_inventario_inicial,r.productos_sin_costo,r.valor_entradas,r.valor_salidas,
      r.entradas_sin_costo,r.salidas_sin_costo,r.ingresos,r.egresos],[10,1,3.09,2.87,0,1,0,0]);
    const existente = (await db.query("SELECT * FROM inventario WHERE sku='001-A'")).rows[0];
    assert.deepEqual([existente.nombre,existente.costo_unitario,existente.stock_actual],['Reactivo','2.3793','3.500']);
    const valores = (await db.query('SELECT tipo,costo_unitario,valor_costo,costo_importado FROM inventario_movimientos WHERE inventario_id=$1 ORDER BY id',[existente.id])).rows;
    assert.deepEqual(valores.map(x=>[x.tipo,x.costo_unitario,x.valor_costo,x.costo_importado]),[
      ['entrada','3.3333','10.00',true],['entrada','1.2345','3.09',true],['salida','2.8700','2.87',true],['salida',null,null,true]
    ]);
    const reintento = await importar(db,filas,true);
    assert.equal(reintento.resumen.duplicadas,6);
    assert.equal(reintento.resumen.valor_inventario_inicial,0);
    assert.equal(reintento.resumen.valor_entradas,0);
    assert.match((await importar(db,[destino('productos',8,{nombre:'Otro reactivo',sku:'001-a'})])).filas[0].error,/SKU/);
    assert.match((await importar(db,[mov(9,{sku:'inexistente',clase:'salida',cantidad:1,costo:1})],true)).filas[0].error,/SKU.*no coincide/);
    assert.match((await importar(db,[mov(9,{unidad:'caja',clase:'salida',cantidad:1,costo:1})],true)).filas[0].error,/unidad.*no coincide/);
    const sinCosto = mov(10,{producto:'Pendiente de compra',clase:'entrada',cantidad:15});
    const conCosto = mov(11,{producto:'Pendiente de compra',clase:'entrada',cantidad:1,costo:9.75});
    assert.equal((await importar(db,[sinCosto,conCosto],true)).resumen.entradas_sin_costo,1);
    assert.equal((await db.query("SELECT costo_unitario FROM inventario WHERE nombre='Pendiente de compra'")).rows[0].costo_unitario,null);

    const kardex = mov(8,{producto:'Artículo histórico',sku:'001-H',unidad:'caja de 12',cantidad:2,clase:'salida',costo_total:25.99,documental:true});
    assert.match((await importar(db,[kardex])).filas[0].error,/solo en empresas/);
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000003'");
    const kardexIncompleto = {...kardex,datos:{...kardex.datos,costo_total:null}};
    assert.match((await importar(db,[kardexIncompleto],true,10)).filas[0].error,/falta el costo/);
    const sinMarca = {...kardex,datos:{...kardex.datos,documental:false}};
    assert.match((await importar(db,[sinMarca],true,10)).filas[0].error,/conservar los lotes/);
    const guardado = await importar(db,[kardex],true,10);
    assert.equal(guardado.resumen.valor_salidas,25.99,JSON.stringify(guardado.filas));
    const recibo = (await db.query("SELECT registro_id,datos FROM importaciones_excel_filas WHERE clinica_id=10 AND clave='k-8'")).rows[0];
    assert.deepEqual([recibo.registro_id,recibo.datos.costo,recibo.datos.costo_total,recibo.datos.documental],[null,12.995,25.99,true]);
    assert.equal(recibo.datos.sku,'001-H');
    assert.equal(recibo.datos.unidad,'caja de 12');
    assert.equal((await importar(db,[kardex],true,10)).resumen.duplicadas,1);
    assert.equal((await db.query('SELECT id FROM inventario_movimientos WHERE clinica_id=10')).rows.length,0);
    assert.equal((await db.query('SELECT id FROM inventario WHERE clinica_id=10')).rows.length,0);
    assert.equal((await db.query('SELECT id FROM finanzas WHERE clinica_id=10')).rows.length,0);
    assert.equal((await db.query('SELECT id FROM libro_diario WHERE clinica_id=10')).rows.length,0);
    assert.equal((await importar(db,[altas[0]],true,10)).resumen.productos,1,'Cada empresa tiene su propio catálogo de SKU');
  } finally {
    await db.exec('ROLLBACK');
  }
}

// Migración de una empresa: proveedores, clientes y saldos pendientes.
async function verificarMigracion(db) {
  await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000003'");
  const prov = destino('proveedores',2,{nombre:'Distribuidora Norte',identificacion:'J0310000001',telefono:'8888 0000'});
  const cli = destino('clientes',2,{nombre:'Clínica Sur',dias_credito:45});
  const cxc = destino('cxc',2,{nombre:'clínica sur',documento:'F-100',fecha:'2026-10-01',saldo:1500.5});
  const cxc2 = destino('cxc',3,{nombre:'Clínica Sur',documento:'F-101',fecha:'2026-10-10',vencimiento:'2026-11-30',saldo:200});
  const cxp = destino('cxp',2,{nombre:'Distribuidora Norte',documento:'P-77',fecha:'2026-10-05',saldo:800});
  const huerfana = destino('cxp',3,{nombre:'Nadie',documento:'X-1',fecha:'2026-10-05',saldo:1});
  const sola = await importar(db,[huerfana],false,10);
  assert.match(sola.filas[0].error,/no existe en el sistema ni en esta carga/,'Un saldo necesita su proveedor');
  const venceAntes = await importar(db,[prov,{...cxp,datos:{...cxp.datos,vencimiento:'2026-09-01'}}],false,10);
  assert.match(venceAntes.filas[1].error,/vencimiento no puede ser antes/);

  const filas = [cxc,cxp,prov,cli,cxc2];
  const previa = await importar(db,filas,false,10);
  assert.equal(previa.resumen.errores,0,JSON.stringify(previa.filas));
  assert.deepEqual([previa.resumen.nuevas,previa.resumen.proveedores,previa.resumen.clientes,previa.resumen.cxc,previa.resumen.cxp],[5,1,1,2,1]);
  assert.equal(Number(previa.resumen.por_cobrar),1700.5);
  assert.equal(Number(previa.resumen.por_pagar),800);
  const guardada = await importar(db,filas,true,10,previa.revision);
  assert.ok(guardada.lote,'Se guardó la migración');
  assert.deepEqual((await db.query("SELECT numero,total::text,vencimiento::text,condicion,saldo_inicial,cliente_id IS NOT NULL AS con_cliente FROM ventas ORDER BY numero")).rows,
    [{numero:'SI-F-100',total:'1500.50',vencimiento:'2026-11-15',condicion:'credito',saldo_inicial:true,con_cliente:true},
     {numero:'SI-F-101',total:'200.00',vencimiento:'2026-11-30',condicion:'credito',saldo_inicial:true,con_cliente:true}],
    'Sin vencimiento, se usan los 45 días de crédito del cliente');
  assert.deepEqual((await db.query("SELECT numero_factura,total::text,vencimiento::text,saldo_inicial,proveedor_id IS NOT NULL AS con_prov FROM compras")).rows,
    [{numero_factura:'P-77',total:'800.00',vencimiento:'2026-11-04',saldo_inicial:true,con_prov:true}]);
  assert.deepEqual((await db.query('SELECT nombre,dias_credito FROM clientes_comerciales')).rows,[{nombre:'Clínica Sur',dias_credito:45}]);
  assert.deepEqual((await db.query('SELECT nombre,identificacion,telefono FROM proveedores')).rows,[{nombre:'Distribuidora Norte',identificacion:'J0310000001',telefono:'8888 0000'}]);
  assert.equal((await importar(db,filas,true,10)).resumen.duplicadas,5,'Volver a importar el mismo archivo no duplica nada');
  const factura = destino('facturas',2,{nombre:'Clínica Sur',documento:'H-01',fecha:'2026-10-01',fecha_pago:'2026-10-03',
    iva_pct:15,total_factura:57.50,lineas:[{descripcion:'Gasas',cantidad:2,precio:25,costo:12}]});
  const mala = {...factura,datos:{...factura.datos,total_factura:58}};
  assert.match((await importar(db,[mala],false,10)).filas[0].error,/no coincide/);
  const repetidaEnApertura = {...factura,datos:{...factura.datos,documento:'F-100'}};
  assert.match((await importar(db,[repetidaEnApertura],false,10)).filas[0].error,/Ya hay una venta o un saldo/);
  assert.equal((await importar(db,[factura],true,10)).resumen.facturas,1);
  assert.equal((await importar(db,[factura],true,10)).resumen.duplicadas,1);
  assert.deepEqual((await db.query("SELECT total::text,iva::text,saldo_inicial FROM ventas WHERE numero='H-01'")).rows,
    [{total:'57.50',iva:'7.50',saldo_inicial:false}]);
  assert.equal((await db.query("SELECT monto::text FROM venta_cobros")).rows[0].monto,'57.50');
  assert.equal((await db.query("SELECT count(*)::int AS n FROM finanzas WHERE clinica_id=10")).rows[0].n,0);
  await db.exec("INSERT INTO proveedores (clinica_id,nombre) VALUES (10,'Laboratorio Manual')");
  assert.match((await importar(db,[destino('proveedores',5,{nombre:' laboratorio manual '})],false,10)).filas[0].error,/Ya existe un proveedor/);
  await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000001'");
  await assert.rejects(importar(db,[cli],false,9),/permiso/,'Sin Contabilidad no se importan clientes');
  assert.match((await importar(db,[destino('proveedores',2,{nombre:'Proveedor de clínica'})],false,9)).filas[0].detalle,/Proveedor · Proveedor de clínica/);
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
    await pagina.exposeFunction('archivarPrueba', async ({p_clinica,p_archivo,p_base64}) => {
      await db.query('SELECT archivar_respaldo_fiscal($1,$2,$3)',[p_clinica,p_archivo,p_base64]);
      return {error:null};
    });
    await pagina.exposeFunction('expedientePrueba', async clinica => ({
      data:(await db.query('SELECT id,archivo FROM expediente_fiscal_excel WHERE clinica_id=$1',[clinica])).rows
    }));
    await pagina.exposeFunction('leerDiarioPrueba', async (clinica,desde,hasta,balanza) => ({
      data:(await db.query(balanza ? 'SELECT * FROM balanza_libro_diario($1,$2,$3)'
        : 'SELECT id,fecha::text,documento,lineas FROM libro_diario WHERE clinica_id=$1 AND fecha BETWEEN $2 AND $3',
        [clinica,desde,hasta])).rows
    }));
    await pagina.route('**/*', async ruta => {
      const url = new URL(ruta.request().url());
      if (url.origin !== 'http://app.test') return ruta.abort();
      if (url.pathname === '/') return ruta.fulfill({contentType:'text/html; charset=utf-8',body:html});
      if (url.pathname === '/js/app.js') return ruta.fulfill({contentType:'text/javascript',body:`
        const sb={rpc:(nombre,args)=>nombre==='archivar_respaldo_fiscal' ? archivarPrueba(args) : nombre==='balanza_libro_diario' ? {order(){return this;},
          range:()=>leerDiarioPrueba(args.p_clinica,args.p_desde,args.p_hasta,true)} : importarPrueba(args),from:tabla=>({
          id:null,select(){return this;},eq(k,v){if(k==='lote_id') this.id=v;return this;},order(){return this;},
          gte(k,v){this.desde=v;return this;},lte(k,v){this.hasta=v;return this;},
          not(){this.conciliacion=true;return this;},limit(){return this.conciliacion ? {data:[]} : recibosPrueba(null);},range(){return tabla==='expediente_fiscal_excel' ? expedientePrueba(currentClinicaId) : tabla==='libro_diario'
            ? leerDiarioPrueba(currentClinicaId,this.desde,this.hasta,false) : recibosPrueba(this.id);}
        })};
        const consultarPaginas=fn=>fn().range();
        let currentClinicaId=9,currentClinica={nombre:'Clínica de prueba'},currentUser={id:'u1'},currentView='finanzas',__empresa=false;
        window.__usar=(id,empresa,nombre)=>{currentClinicaId=id;__empresa=empresa;currentClinica={nombre};};
        const toast=()=>{},hasPermiso=()=>true,esEmpresaMedica=()=>__empresa,loadAll=async()=>{},renderFinanzas=()=>{},renderView=()=>{};
        const hoy=()=>'2026-11-18';
        const _categoriasFin=t=>t==='egreso'?[{id:'alquiler',label:'Alquiler'},{id:'general',label:'General'}]:[{id:'consulta',label:'Consulta'},{id:'general',label:'General'}];
        const escAttr=s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
        const fmtC=x=>'C$ '+x;
        const formatFecha=f=>f, _exigeClinica=()=>true;
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

    // ── Reconocimiento automático y lectura de valores de hojas reales ──
    const det = await pagina.evaluate(() => {
      __usar(10,true,'Empresa de prueba');
      const P = ExcelImportacion._probar;
      const hoja = (nombre, filas) => P.detectar({nombre, archivo:'migracion.xlsx', encabezado:1, tipo:'', mapa:{}, fijos:{},
        filas:filas.map((f,i)=>({numero:i+1, celdas:f.map(v=>v==null?undefined:{valor:v})}))});
      const res = h => ({tipo:h.tipo, encabezado:h.encabezado, mapa:h.mapa, fijos:h.fijos, deteccion:h.deteccion});
      const r = {
        prov:res(hoja('Proveedores',[['Nombre','RUC','Teléfono'],['A','J1','1']])),
        cli:res(hoja('Hoja1',[['Cliente','RUC','Teléfono','Días de crédito'],['A','J1','1',30]])),
        dudosa:res(hoja('Hoja2',[['Nombre','RUC'],['A','J1']])),
        cxc:res(hoja('Cartera',[['Cartera al 31 de octubre'],['Cliente','Factura','Fecha','Vence','Saldo'],['A','F1','2026-10-01','2026-11-01',5]])),
        gastos:res(hoja('Gastos',[['Fecha','Concepto','Monto','Categoría'],['2026-11-01','Luz',5,'Servicios']])),
        libro:res(hoja('Libro',[['Fecha','Concepto','Ingresos','Egresos'],['2026-11-01','Luz','',5]])),
        inv:res(hoja('Inventario',[['Código','Descripción','Unidad','Existencia','Costo','Precio'],['A1','Gasas','caja',3,1,2]])),
        nada:res(hoja('Notas',[['Hola','Mundo'],['a','b']]))
      };
      const valor = (f, ...a) => { try { return f(...a); } catch (e) { return 'error: ' + e.message; } };
      r.decimales = [valor(P.decimal,{valor:'C$ 1,250.50'},2),valor(P.decimal,{valor:'1.250,50'},2),valor(P.decimal,{valor:15.333333},4),
        valor(P.decimal,{valor:'1,250'},2),valor(P.decimal,{valor:'(300)'},2,true),valor(P.decimal,{valor:'-5'},2)];
      r.fechas = [valor(P.fecha,{valor:'13/11/26'}),valor(P.fecha,{valor:46339.75}),valor(P.fecha,{valor:'2026/11/5'}),valor(P.fecha,{valor:'31/02/2026'})];
      const libro = hoja('Libro',[['Fecha','Concepto','Ingresos','Egresos','Categoría'],['2026-11-01','Papelería','',50,'Oficina']]);
      r.libroFila = P.normalizar(libro, libro.filas[1]).datos;
      __usar(9,false,'Clínica de prueba');
      r.clinicaTipos = P.tiposDisponibles();
      return r;
    });
    assert.equal(det.prov.tipo,'proveedores','El nombre de la hoja decide entre proveedores y clientes');
    assert.equal(det.cli.tipo,'clientes');
    assert.equal(det.cli.mapa.dias_credito,3);
    assert.deepEqual([det.dudosa.tipo,det.dudosa.deteccion.estado,det.dudosa.deteccion.opciones.sort()],['','dudosa',['clientes','proveedores']],'Sin pistas, pregunta');
    assert.deepEqual([det.cxc.tipo,det.cxc.encabezado],['cxc',2],'Encuentra la fila de encabezados debajo del título');
    assert.deepEqual(det.cxc.mapa,{nombre:0,documento:1,fecha:2,vencimiento:3,saldo:4});
    assert.deepEqual([det.gastos.tipo,det.gastos.fijos],['finanzas',{clase:'egreso'}],'Una hoja «Gastos» son gastos');
    assert.deepEqual([det.libro.tipo,det.libro.mapa.monto_ingreso,det.libro.mapa.monto_egreso],['finanzas',2,3]);
    assert.deepEqual([det.inv.tipo,det.inv.mapa.nombre,det.inv.mapa.stock],['productos',1,3]);
    assert.equal(det.nada.deteccion.estado,'ninguna');
    assert.deepEqual(det.decimales,[1250.5,1250.5,15.3333,'error: El número 1,250 es ambiguo: escribe el separador decimal (1250.00 o 1.25).',-300,'error: No se admiten valores negativos.']);
    assert.deepEqual(det.fechas,['2026-11-13','2026-11-13','2026-11-05','error: Usa una fecha válida en formato AAAA-MM-DD o DD/MM/AAAA.']);
    assert.deepEqual(det.libroFila,{fecha:'2026-11-01',descripcion:'Papelería (Oficina)',categoria:'general',monto:50,clase:'egreso'});
    assert.deepEqual(det.clinicaTipos,['diario','finanzas','productos','movimientos','proveedores','cxp'],'Diario está disponible al tener Contabilidad, también en clínicas');

    // ── Migración completa de una empresa: se sube el libro y se reconoce solo ──
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000003'");
    await pagina.evaluate(() => { ExcelImportacion.cerrar(); __usar(10,true,'Empresa de prueba'); ExcelImportacion.abrir(); });
    const fiscal = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(fiscal,XLSX.utils.aoa_to_sheet([
      ['RUC','DESCRIPCION DEL PAGO','INGRESOS SIN IMPUESTOS','VALOR IVA TRASLADADO Y/O AUTOTRASLADADO'],
      ['J01','Compra',100,15]]),'IVA');
    const fiscalAntiguo = {...ingreso,archivo:'1. IVA Ene26 MEDICSA V2.xlsx'};
    assert.match((await importar(db,[fiscalAntiguo],true,10)).filas[0].error,/respaldo en el expediente/);
    const original = Buffer.from(XLSX.write(fiscal,{type:'array',bookType:'xlsx'}));
    await pagina.locator('#excel-archivos').setInputFiles({name:'IVA de prueba.xlsx',mimeType:'application/octet-stream',buffer:original});
    await pagina.locator('#excel-archivar').waitFor();
    assert.equal(await pagina.locator('#excel-confirmar').isHidden(),true);
    assert.equal(await pagina.locator('#excel-hojas select').count(),0);
    await pagina.locator('#excel-archivar').click();
    await pagina.waitForFunction(()=>document.querySelector('#excel-situacion').textContent.includes('Migración pendiente'));
    assert.equal((await db.query("SELECT encode(contenido,'hex') bytes FROM expediente_fiscal_excel WHERE clinica_id=10")).rows[0].bytes,original.toString('hex'));
    assert.equal((await db.query('SELECT count(*)::int AS n FROM finanzas WHERE clinica_id=10')).rows[0].n,0);
    await pagina.evaluate(()=>{ExcelImportacion.cerrar(); ExcelImportacion.abrir();});
    await pagina.waitForFunction(()=>document.querySelector('#excel-situacion').textContent.includes('Migración pendiente'));
    const libro = XLSX.utils.book_new();
    const agregar = (nombre, filas) => XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filas), nombre);
    agregar('Proveedores',[['Proveedor','RUC','Teléfono','Contacto'],['Droguería Central','J0311',22221111,'Ana']]);
    agregar('Clientes',[['Cliente','RUC','Días de crédito'],['Hospital Uno','J0399',60]]);
    agregar('Inventario',[['Código','Descripción','Unidad','Existencia','Costo unitario','Precio de venta'],
      ['A1','Guantes M','Cajas',10,'C$ 120.50',{t:'n',v:180.75,f:'E2*1.5'}],['','TOTAL','',10,'','']]);
    agregar('Por cobrar',[['Cartera al 31/10/2026'],['Cliente','Factura','Fecha','Vence','Saldo'],['Hospital Uno','F-900','15/10/2026','14/12/2026','1,500.00']]);
    agregar('Por pagar',[['Proveedor','Factura','Fecha','Saldo'],['Droguería Central','DC-55','2026-10-20',650]]);
    agregar('Gastos',[['Fecha','Concepto','Monto','Categoría'],['2026-11-02','Alquiler local',500,'Alquiler'],['2026-11-03','Papelería',35.5,'Oficina']]);
    agregar('Facturas de venta',[['Número de factura','Cliente','Fecha de emisión','Descripción de la línea','Cantidad','Precio unitario sin IVA',
      'Costo unitario histórico','IVA % de la factura','Total de la factura','Vencimiento'],
      ['H-02','Hospital Uno','2026-10-20','Guantes',2,20,10,'15%',57.5,'2026-11-30'],
      ['H-02','Hospital Uno','2026-10-20','Mascarillas',1,10,5,'15%',57.5,'2026-11-30']]);
    agregar('Libro diario',[['Número de asiento','Fecha contable','Código de cuenta','Nombre de cuenta','Debe','Haber','Concepto'],
      ['AP-01','2026-10-01','001-01','Caja',1000.01,'','Apertura'],
      ['AP-01','2026-10-01','300-01','Capital','',1000.01,'Apertura']]);
    agregar('Balanza',[['Código','Cuenta','Saldo inicial','Debe','Haber','Saldo final'],
      ['001-01','Caja',0,1000.01,0,1000.01],['300-01','Capital',0,0,1000.01,-1000.01]]);
    agregar('Auxiliar caja',[['Código','Referencia','Saldo final'],['001-01','Caja general',1000.01]]);
    await pagina.locator('#excel-archivos').setInputFiles({name:'migracion-empresa.xlsx',
      mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(XLSX.write(libro,{type:'array',bookType:'xlsx'}))});
    await pagina.locator('#excel-confirmar').waitFor().catch(async error => {
      throw new Error(await pagina.locator('#excel-estado').innerText() + '\n' + await pagina.locator('#excel-resultados').innerText(),{cause:error});
    });
    assert.equal(await pagina.locator('.excel-hoja-lista').count(),8,'Las ocho hojas se reconocieron sin tocar nada');
    assert.equal(await pagina.locator('.excel-detectado').count(),8);
    const resumen = await pagina.locator('#excel-resultados .excel-totales').innerText();
    assert.match(resumen,/^9 nuevas/);
    assert.match(resumen,/1 asiento\(s\).*Debe.*Haber/);
    assert.match(resumen,/1 factura\(s\) histórica/);
    assert.match(resumen,/Gastos C\$ 535.5/);
    assert.match(resumen,/por cobrar: C\$ 1500/);
    assert.match(resumen,/por pagar: C\$ 650/);
    assert.match(resumen,/totales o vacías que no se importan: 1/);
    assert.match(await pagina.locator('#excel-estado').innerText(),/Se reconocieron 8 hoja\(s\)/);
    for (const ancho of [360,1280]) {
      await pagina.setViewportSize({width:ancho,height:800});
      await pagina.waitForTimeout(400);   // la ventana se acomoda con una animación al cambiar de ancho
      const ancha = await pagina.locator('.excel-modal').evaluate(n => [...n.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > n.getBoundingClientRect().left + n.clientWidth + 1)
        .map(e => e.tagName + '.' + e.className).slice(0,6));
      assert.deepEqual(ancha,[],`Cabe en ${ancho}px`);
      assert.equal(await pagina.locator('.excel-modal').evaluate(n => n.scrollWidth <= n.clientWidth + 1),true,`Cabe en ${ancho}px`);
      if (process.env.EXCEL_SCREENSHOT_DIR) await pagina.screenshot({path:path.join(process.env.EXCEL_SCREENSHOT_DIR,`excel-migracion-${ancho}.png`),fullPage:true});
    }
    await pagina.locator('#excel-confirmar').click();
    await pagina.getByRole('status').filter({hasText:'Importación guardada'}).waitFor();
    assert.deepEqual((await db.query("SELECT nombre,unidad,stock_actual::text,costo_unitario::text,precio_unitario::text FROM inventario WHERE clinica_id=10")).rows,
      [{nombre:'Guantes M',unidad:'caja',stock_actual:'10.000',costo_unitario:'120.5000',precio_unitario:'180.75'}],'Precio calculado con fórmula, unidad «Cajas» y costo con C$');
    assert.equal((await db.query("SELECT count(*)::int AS n FROM inventario_movimientos m JOIN inventario i ON i.id=m.inventario_id WHERE i.clinica_id=10")).rows[0].n,1);
    assert.deepEqual((await db.query("SELECT telefono FROM proveedores WHERE nombre='Droguería Central'")).rows,[{telefono:'22221111'}]);
    assert.deepEqual((await db.query("SELECT dias_credito FROM clientes_comerciales WHERE nombre='Hospital Uno'")).rows,[{dias_credito:60}]);
    assert.deepEqual((await db.query("SELECT total::text,vencimiento::text FROM ventas WHERE numero='SI-F-900'")).rows,[{total:'1500.00',vencimiento:'2026-12-14'}]);
    assert.deepEqual((await db.query("SELECT i.descripcion,i.subtotal::text FROM venta_items i JOIN ventas v ON v.id=i.venta_id WHERE v.numero='H-02' ORDER BY i.descripcion")).rows,
      [{descripcion:'Guantes',subtotal:'40.00'},{descripcion:'Mascarillas',subtotal:'10.00'}]);
    const asiento = (await db.query("SELECT * FROM libro_diario WHERE documento='AP-01'")).rows[0];
    assert.equal(asiento.debe,'1000.01');
    assert.equal(asiento.haber,'1000.01');
    assert.equal(asiento.lineas[0].cuenta,'001-01');
    assert.equal(asiento.lineas[1].origen.fila,3);
    const balanza = (await db.query("SELECT codigo,apertura,debe,haber,saldo FROM balanza_libro_diario(10,'2026-11-01','2026-11-30')")).rows;
    assert.deepEqual(balanza,[
      {codigo:'001-01',apertura:'1000.01',debe:'0',haber:'0',saldo:'1000.01'},
      {codigo:'300-01',apertura:'-1000.01',debe:'0',haber:'0',saldo:'-1000.01'}
    ]);
    const lineas = [{cuenta:'001-01',nombre_cuenta:'Caja',debe:40.01},{cuenta:'300-01',nombre_cuenta:'Capital',haber:40}];
    const descuadrado = destino('diario',2,{documento:'A-02',fecha:'2026-10-02',lineas});
    assert.match((await importar(db,[descuadrado],true,10)).filas[0].error,/Asiento descuadrado/);
    assert.equal((await db.query("SELECT count(*)::int AS n FROM libro_diario")).rows[0].n,1);
    lineas[1].haber = 40.01;
    lineas[0].nombre_cuenta = 'Otra cuenta';
    assert.match((await importar(db,[descuadrado],false,10)).filas[0].error,/nombres de cuenta diferentes/);
    lineas[0].nombre_cuenta = 'Caja';
    const bal = [
      destino('balanza',2,{cuenta:'001-01',nombre:'Caja',apertura:1000.01,debe:40.01,haber:0,saldo:1040.02}),
      destino('balanza',3,{cuenta:'300-01',nombre:'Capital',apertura:-1000.01,debe:0,haber:40.01,saldo:-1040.02})];
    const aux = destino('auxiliar',2,{cuenta:'001-01',saldo:1040.01});
    await assert.rejects(importar(db,[descuadrado],true,10),/Migración pendiente/);
    await assert.rejects(importar(db,[descuadrado,...bal,aux],true,10),/saldo del auxiliar/);
    aux.datos.saldo = 1040.02;
    assert.equal((await importar(db,[descuadrado,...bal,aux],false,10)).resumen.nuevas,1);
    bal[0].datos.debe = 40;
    await assert.rejects(importar(db,[descuadrado,...bal,aux],true,10),/movimientos del diario/);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM libro_diario')).rows[0].n,1);
    await db.exec("SET ROLE authenticated");
    for (let n=0;n<2;n++) await db.query("SELECT archivar_respaldo_fiscal(10,'IVA.xlsx','UEs=')");
    assert.deepEqual((await db.query("SELECT archivo,encode(contenido,'hex') AS original FROM expediente_fiscal_excel WHERE archivo='IVA.xlsx'")).rows,
      [{archivo:'IVA.xlsx',original:'504b'}]);
    await assert.rejects(db.query("SELECT archivar_respaldo_fiscal(9,'IVA.xlsx','UEs=')"));
    await db.exec("RESET ROLE");
    await pagina.evaluate(() => { ExcelImportacion.cerrar(); ExcelImportacion.abrir(); });
    const inventario = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(inventario,XLSX.utils.aoa_to_sheet([
      ['SKU','Descripción de producto','Stock','Valor total al costo','Moneda','Fecha de corte'],
      [{t:'n',v:12,z:'0000'},'Hisopos',3,20,'NIO'],
      ['0013','Pinzas',3,15,'C$','2026-08-31'],
      [null,'TOTAL GENERAL',6,35]
    ]),'Existencias');
    const nuevoKardex = 'ID;Fecha;Artículo;Unidades de entrada;Unidades de salida;Costo unitario entradas;Costo total salidas;Unidad;SKU\r\n' +
      'H-9;2026-08-12;Hisopos;0;2;;9.60;caja;0012\r\n' +
      'H-8;2026-08-10;Hisopos;3;0;5;;caja;0012';
    await pagina.locator('#excel-archivos').setInputFiles([
      {name:'Existencias.xlsx',mimeType:'application/octet-stream',buffer:Buffer.from(XLSX.write(inventario,{type:'array',bookType:'xlsx'}))},
      {name:'Kardex.csv',mimeType:'text/csv',buffer:Buffer.from(nuevoKardex)}
    ]);
    const botonConfirmar = pagina.locator('#excel-confirmar');
    await botonConfirmar.waitFor();
    assert.match(await pagina.locator('#excel-resultados').innerText(),/Inventario de apertura valorizado: C\$ 35/);
    assert.match(await pagina.locator('#excel-resultados').innerText(),/Salidas valorizadas: C\$ 9.6/);
    assert.match(await pagina.locator('#excel-resultados').innerText(),/Entradas valorizadas: C\$ 15/);
    await pagina.locator('#excel-fecha-apertura').fill('2026-09-30');
    assert.equal(await botonConfirmar.isHidden(),true);
    await pagina.locator('#excel-revisar').click();
    await botonConfirmar.waitFor();
    assert.match(await pagina.locator('#excel-resultados').innerText(),/1 apertura\(s\).*2026-09-30/);
    await botonConfirmar.click();
    await pagina.getByRole('status').filter({hasText:'Importación guardada'}).waitFor();
    const nuevos = await db.query(`SELECT datos->>'sku' sku,datos->>'fecha' fecha,datos->>'costo' costo
      FROM importaciones_excel_filas WHERE archivo='Existencias.xlsx' ORDER BY sku`);
    assert.deepEqual(nuevos.rows.map(r => [r.sku,r.fecha,Number(r.costo)]),[
      ['0012','2026-09-30',6.6667],['0013','2026-08-31',5]]);
    assert.deepEqual((await db.query(`SELECT registro_id,datos->>'documental' documental,datos->>'sku' sku
      FROM importaciones_excel_filas WHERE archivo='Kardex.csv'`)).rows,Array(2).fill({registro_id:null,documental:'true',sku:'0012'}));
    assert.equal(Number((await db.query("SELECT stock_actual FROM inventario WHERE sku='0012'")).rows[0].stock_actual),3);
    for (const [contenido,motivo] of [
      ['Artículo;Stock;Costo unitario;Costo total\r\nGasas;2;10;21',/coincidir al centavo/],
      ['Artículo;Stock;Costo total\r\nGasas;2;20\r\nTotal;2;21',/al pie de la hoja/],
      ['Artículo;Stock;Costo unitario;Moneda\r\nGasas;2;10;USD',/Moneda del costo/],
      ['Artículo;Stock;Costo unitario (USD)\r\nGasas;2;10',/Importes de inventario en C\$/],
      ['Artículo;Fecha;Entradas;Salidas;Costo total entradas;Costo total salidas\r\nGasas;2026-08-10;2;0;10;9',/contradicen el movimiento/]
    ]) {
      await pagina.locator('#excel-archivos').setInputFiles({name:'Inventario-erroneo.csv',mimeType:'text/csv',buffer:Buffer.from(contenido)});
      await pagina.getByText(motivo).first().waitFor({state:'attached'});
      assert.equal(await botonConfirmar.isHidden(),true);
    }
    await pagina.evaluate(() => {ExcelImportacion.cerrar(); LibroDiario.abrir();});
    await pagina.locator('#libro-diario-pdf').waitFor();
    assert.match(await pagina.locator('#libro-diario-resultados').textContent(),/001-01.*Caja.*1,000\.01/s);
    for(const ancho of [360,430,1280]) {
      await pagina.setViewportSize({width:ancho,height:800});
      const ajusta = await pagina.locator('.libro-diario').evaluate(n=>n.scrollWidth <= n.clientWidth + 1);
      assert.equal(ajusta,true,`El modal del diario cabe a ${ancho}px`);
    }
    await db.exec("SET ROLE authenticated; SET test.uid='c0000000-0000-0000-0000-000000000001'");
    assert.equal((await db.query("SELECT * FROM libro_diario")).rows.length,0);
    await db.exec("RESET ROLE; SET test.uid='c0000000-0000-0000-0000-000000000003'");
    assert.deepEqual((await db.query("SELECT total::text FROM compras WHERE numero_factura='DC-55'")).rows,[{total:'650.00'}]);
    assert.deepEqual((await db.query("SELECT categoria,descripcion,monto::text FROM finanzas WHERE clinica_id=10 ORDER BY fecha")).rows,
      [{categoria:'alquiler',descripcion:'Alquiler local',monto:'500.00'},{categoria:'general',descripcion:'Papelería (Oficina)',monto:'35.50'}]);
    await db.exec("SET test.uid='c0000000-0000-0000-0000-000000000001'");
  } finally {
    await navegador.close();
  }
}

module.exports={crearBase};
if(require.main===module) (async () => {
  const db = await crearBase();
  try {
    await verificarBase(db);
    await verificarInventarioValorizado(db);
    await verificarMigracion(db);
    await verificarPantalla(db);
    console.log('OK: Importación de Excel: validación, idempotencia, RLS, transacción, migración de empresa, reconocimiento automático y pantalla verificadas.');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
