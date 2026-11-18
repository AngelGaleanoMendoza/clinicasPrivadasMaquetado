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
const contexto=vm.createContext({
  currentClinicaId:9,hasPermiso:()=>true,File,fmtC:n=>n.toFixed(2),escAttr:String,
  consultarPaginas:async()=>({data:documentos}),
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
  await assert.rejects(borrador.obtener(10,'2026-01-01','2026-02-28',()=>true),/Contabilidad/);
  assert.equal(await borrador.obtener(9,'2026-01-01','2026-02-28',()=>false),undefined);
  console.log('OK: borrador de lectura, importes en centavos, versiones, períodos y aislamiento por empresa.');
})().catch(e=>{console.error(e);process.exitCode=1;});
