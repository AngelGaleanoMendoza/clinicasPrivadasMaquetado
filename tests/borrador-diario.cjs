const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const documentos = [
  {archivo:'1. Anticipo IR Ene26.xlsx',digest:'a',id:1},
  {archivo:'copia/1. Anticipo IR Ene26.xlsx',digest:'a',id:2},
  {archivo:'2. Anticipo IR Feb26.xlsx',digest:'b',id:3},
  {archivo:'2. Anticipo IR Feb26 V2.xlsx',digest:'c',id:4},
  {archivo:'3. Anticipo IR Mar26.xlsx',digest:'d',id:5}
];
let lecturas=0;
const recibos=[
  {tipo:'productos',datos:{nombre:'Agujas',stock:1.25,unidad:'caja',costo:8.004,fecha:'2026-01-02'}},
  {tipo:'movimientos',datos:{producto:'Agujas',cantidad:2,costo_total:4.5,documental:true,clase:'salida',motivo:'Consumo interno',fecha:'2026-01-10'}},
  {tipo:'movimientos',datos:{producto:'Guantes',cantidad:2,costo_total:0,documental:true,clase:'salida',motivo:'Traslado',fecha:'2026-01-10'}},
  {tipo:'movimientos',datos:{producto:'Alcohol',cantidad:1,clase:'salida',fecha:'2026-01-10'}},
  {tipo:'productos',datos:{nombre:'Sin stock',stock:0,fecha:'2026-02-01'}},
  {tipo:'productos',datos:{nombre:'Fuera del corte',stock:100,costo:10,fecha:'2026-04-01'}}
].map((r,i)=>({...r,importe:r.datos.costo_total?.toString(),clinica_id:9,archivo:'Inventario.xlsx',hoja:'Hoja 1',fila:i+2}));
let permiteInventario=true, consultasInventario=0;
function consultar(tabla) {
  let filas=tabla==='expediente_fiscal_excel'?documentos.map(d=>({...d,clinica_id:9})):recibos;
  if (tabla==='importaciones_excel_filas') consultasInventario++;
  return {
    select(){return this;}, order(){return this;},
    in(c,vs){filas=filas.filter(r=>vs.includes(r[c]));return this;},
    eq(c,v){filas=filas.filter(r=>r[c]===v);return this;},
    gte(c,v){assert.equal(c,'datos->>fecha');filas=filas.filter(r=>r.datos.fecha>=v);return this;},
    lte(c,v){assert.equal(c,'datos->>fecha');filas=filas.filter(r=>r.datos.fecha<=v);return this;},
    get data(){return filas;}
  };
}
const contexto=vm.createContext({
  currentClinicaId:9,hasPermiso:p=>p!=='inventario'||permiteInventario,File,fmtC:n=>n.toFixed(2),escAttr:String,
  sb:{from:consultar},consultarPaginas:async q=>q(),_fmtCostoUnitario:n=>'C$ '+n.toFixed(4),
  ExcelImportacion:{
    originalFiscal:async(clinica,id)=>{assert.equal(clinica,9);lecturas++;return new Uint8Array([id]);},
    leerArchivo:async f=>{
      const n=new Uint8Array(await f.arrayBuffer())[0];
      return [{filas:[
        {celdas:[{valor:'Base imponible para determinar el IVA'}]},
        {celdas:[{valor:'Ingresos gravados del mes'},{valor:n*10}]},
        {celdas:[{valor:'Base imponible para determinar ISC'}]}
      ]}];
    }
  },
  _tablaReporteZip:(t,c,f)=>JSON.stringify(f)
});
for (const archivo of ['caja-empresa','borrador-diario'])
  vm.runInContext(fs.readFileSync(require.resolve('../js/'+archivo+'.js'),'utf8'),contexto);
const app=fs.readFileSync(require.resolve('../js/app.js'),'utf8');
vm.runInContext(app.match(/^function _destinoSalidaInventario\([\s\S]+?^\}/m)[0],contexto);
const borrador=vm.runInContext('BorradorDiario',contexto);

(async()=>{
  const datos=await borrador.obtener(9,'2026-01-01','2026-03-15',()=>true);
  assert.equal(lecturas,3);
  assert.equal(datos.lineas.length,1);
  assert.equal(datos.lineas[0].importe,1000);
  assert.match(datos.avisos.join(' '),/2026-02.*Versiones en conflicto/);
  assert.match(datos.avisos.join(' '),/2026-03.*mes completo/);
  assert.match(borrador.mostrar(datos),/Balanza provisional/);
  assert.match(borrador.mostrar(datos),/-10.00/);
  assert.equal(datos.inventario.length,4);
  assert.equal(datos.inventario[0].importe,1001n);
  const auxiliar=borrador.mostrar(datos);
  assert.match(auxiliar,/Kardex histórico · Consumo.*C\$ 4\.50/);
  assert.match(auxiliar,/Kardex histórico · Traslado.*C\$ 0\.00/);
  assert.match(auxiliar,/Costo pendiente/);
  assert.match(auxiliar,/Inventario.xlsx · Hoja 1 · fila 2/);
  assert.doesNotMatch(auxiliar,/Fuera del corte|Sin stock/);
  permiteInventario=false;
  const anteriores=consultasInventario;
  assert.equal((await borrador.obtener(9,'2026-01-01','2026-01-31',()=>true)).inventario,null);
  assert.equal(consultasInventario,anteriores);
  await assert.rejects(borrador.auxiliarInventario(9,'2026-01-01','2026-02-01'),/acceso/);
  await assert.rejects(borrador.obtener(10,'2026-01-01','2026-02-28',()=>true),/Contabilidad/);
  assert.equal(await borrador.obtener(9,'2026-01-01','2026-02-28',()=>false),undefined);
  console.log('OK: borrador de lectura, importes en centavos, versiones, períodos y aislamiento por empresa.');
})().catch(e=>{console.error(e);process.exitCode=1;});
