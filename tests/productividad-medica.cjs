// Productividad médica por firma: quién es la misma persona, qué cuenta como
// atención, qué queda fuera del ranking, y cómo se ve en escritorio y teléfono.
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
const code=[extraerConst('_normalMedico'),extraerConst('_claveMedico'),extraerConst('_pmSujeto'),
  extraerConst('_PM_ROLES_NO_MEDICOS'),
  ...['_pmCodigo','_pmNombre','_pmActos','_pmAgrupar','_pmNombreClinica','_pmEtiquetaCodigo',
      'puedeVerProductividadMedica','renderProductividadMedica'].map(extraer)].join('\n');

const preambulo=`
  const escAttr=s=>String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const formatFecha=f=>f;
  let superAdmin=true, adminClinicas=[{id:1,nombre:'Divina Providencia'},{id:2,nombre:'San Lucas'}];
  const isSuperAdmin=()=>superAdmin;
  const puedeVerBalance=()=>true;
  const _clinicasDisponiblesSA=async()=>adminClinicas;
  let currentClinica=null;
  let pmPeriodo='mes', pmDesde='', pmHasta='', pmClinica='', pmDatos=null, pmCargando=false;
  window.__datos=d=>{pmDatos=d;};
  ${code}
  Object.assign(window,{_pmCodigo,_pmNombre,_pmActos,_pmAgrupar,renderProductividadMedica});
  window.calcular=(datos,perfilesArr)=>{
    const perfiles=new Map((perfilesArr||[]).map(p=>[String(p.id),p]));
    return _pmAgrupar(_pmActos(datos,perfiles),perfiles);
  };
`;

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

// Nota finalizada mínima
const N=(o)=>({id:o.id||Math.random(),clinica_id:o.cl||1,paciente_id:o.pac,fecha:o.f||'2026-10-10',
  tipo:o.tipo||'evolucion',estado:o.estado,cita_id:o.cita||null,profesional_id:o.pid||null,
  profesional_nombre:o.nom,profesional_codigo:o.cod});

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await page.setContent(`<html><body><div class="pm-controles" id="pm-controles"></div><div id="pm-contenido"></div></body></html>`);
    await page.addScriptTag({content:preambulo});

    // ── Códigos y nombres que significan lo mismo ──
    const norm=await page.evaluate(()=>({
      cod:['21601','MINSA 21601','Cód. 021601','Nº 21601','cod 21601'].map(_pmCodigo),
      nom:['Dr. Juan Pérez','juan perez','Dr Juan  Pérez.','DRA. Ana López'].map(_pmNombre),
    }));
    assert.deepEqual([...new Set(norm.cod)],['21601'],'Todas las grafías del código deben coincidir: '+norm.cod);
    assert.deepEqual(norm.nom,['juan perez','juan perez','juan perez','ana lopez']);

    // ── Una visita con varias notas es UNA atención ──
    const visita=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[
        n({pac:1,nom:'Dr. Juan Pérez',cod:'21601',tipo:'resumen_clinico'}),
        n({pac:1,nom:'Dr. Juan Pérez',cod:'21601',tipo:'evolucion'}),
        n({pac:1,nom:'Dr. Juan Pérez',cod:'21601',tipo:'diagnostico'}),
        n({pac:1,nom:'Dr. Juan Pérez',cod:'21601',f:'2026-10-20'}),   // segunda visita
      ]}).medicos[0];
    },N.toString());
    assert.equal(visita.notas,4);
    assert.equal(visita.atenciones,2,'Tres notas el mismo día son una visita; otro día es otra');
    assert.equal(visita.pacientes,1);

    // ── La misma persona por código, cuenta y nombre ──
    const persona=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({
        notas:[
          n({pac:1,nom:'Dr. Juan Pérez',cod:'MINSA 21601'}),
          n({pac:2,nom:'Juan Perez',cod:'021601'}),                 // otra grafía
          n({pac:3,nom:'Juan Pérez',cod:'21601',pid:'u-juan'}),     // con su cuenta
        ],
        recetas:[ // una receta de 3 medicamentos, firmada por la cuenta
          {id:1,clinica_id:1,paciente_id:4,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u-juan',prescriptor_nombre:'Juan Pérez'},
          {id:2,clinica_id:1,paciente_id:4,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u-juan',prescriptor_nombre:'Juan Pérez'},
          {id:3,clinica_id:1,paciente_id:4,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u-juan',prescriptor_nombre:'Juan Pérez'},
        ],
        citas:[{id:9,clinica_id:1,paciente_id:5,fecha:'2026-10-12',estado:'completada',medico_id:'u-juan'}],
      },[{id:'u-juan',nombre:'Juan Pérez',rol:'medico',especialidad:'Pediatría'}]);
    },N.toString());
    assert.equal(persona.medicos.length,1,'Código, cuenta y nombre son la misma persona');
    const juan=persona.medicos[0];
    assert.equal(juan.atenciones,3);
    assert.equal(juan.recetas,1,'Una receta de tres medicamentos es una receta');
    assert.equal(juan.citas,1);
    assert.equal(juan.pacientes,5);
    assert.equal(juan.conCuenta,true);
    assert.equal(juan.especialidad,'Pediatría');

    // ── Un médico con cuenta que nunca firmó con su usuario se une por nombre ──
    const puente=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({
        notas:[n({pac:1,nom:'Dra. Ana López',cod:'5050'})],
        recetas:[{id:1,clinica_id:1,paciente_id:2,receta_id:'R9',fecha_emision:'2026-10-11',prescriptor_id:'u-ana',prescriptor_nombre:'Ana López'}],
      },[{id:'u-ana',nombre:'Ana López',rol:'medico'}]).medicos;
    },N.toString());
    assert.equal(puente.length,1,'El nombre une la cuenta con el código cuando no hay otro médico con ese nombre');
    assert.deepEqual([puente[0].atenciones,puente[0].recetas],[1,1]);

    // ── Dos homónimos con código distinto NO se juntan ──
    const homonimos=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[
        n({pac:1,nom:'Carlos Ruiz',cod:'111'}),
        n({pac:2,nom:'Carlos Ruiz',cod:'222'}),
        n({pac:3,nom:'Carlos Ruiz',cod:''}),   // ¿cuál de los dos?
      ]});
    },N.toString());
    assert.equal(homonimos.medicos.length,3,'Dos personas y una firma que no se puede atribuir');
    assert.equal(homonimos.medicos.filter(m=>m.dudoso).length,1,'La firma sin código queda marcada como dudosa');
    assert.deepEqual(homonimos.ambiguos,['carlos ruiz']);

    // ── Lo que no entra en el ranking ──
    const fuera=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({
        notas:[
          n({pac:1,nom:'Dr. Juan Pérez',cod:'21601',estado:'borrador'}),   // borrador
          n({pac:2,nom:'',cod:''}),                                          // sin firma
        ],
        procedimientos:[
          {id:1,clinica_id:1,paciente_id:3,fecha:'2026-10-10',estado:'completado',profesional_id:'u-adm',profesional_nombre:'Admin',rol_profesional:'admin'},
          {id:2,clinica_id:1,paciente_id:3,fecha:'2026-10-10',estado:'programado',profesional_id:'u-juan',profesional_nombre:'Juan'},
        ],
        citas:[{id:1,clinica_id:1,paciente_id:4,fecha:'2026-10-10',estado:'completada',medico_id:'u-rec'}],
      },[{id:'u-adm',nombre:'Admin',rol:'admin'},{id:'u-rec',nombre:'Recepción',rol:'recepcion'}]);
    },N.toString());
    assert.equal(fuera.medicos.length,0,'Borradores, firmas vacías, cuentas no médicas y pendientes no entran');
    assert.equal(fuera.sinFirma.nota,1);
    assert.equal(fuera.noMedico.procedimiento,1,'Un procedimiento dado de alta por administración no es de un médico');
    assert.equal(fuera.noMedico.cita,1);

    // ── Examen visual: es atención y se cuenta aparte ──
    const visual=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[n({pac:1,nom:'Lic. Rosa Díaz',cod:'777',tipo:'examen_visual'})]}).medicos[0];
    },N.toString());
    assert.deepEqual([visual.atenciones,visual.examenes,visual.notas],[1,1,0]);

    // ── Ranking por atenciones; el total no cuenta dos veces la misma visita ──
    const ranking=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[
        n({pac:1,nom:'A',cod:'1'}),
        n({pac:2,nom:'B',cod:'2'}), n({pac:3,nom:'B',cod:'2'}),
        n({pac:2,nom:'A',cod:'1'}),                       // A también ve al paciente 2, misma visita
        n({pac:4,nom:'B',cod:'2'}),
      ]});
    },N.toString());
    assert.deepEqual(ranking.medicos.map(m=>m.nombre),['B','A'],'Primero quien más atiende');
    assert.equal(ranking.totales.atenciones,4,'Paciente 2 lo vieron A y B en la misma visita: una atención en el total');
    assert.equal(ranking.totales.pacientes,4);

    // ══ Casos de la revisión adversaria ══

    // Grafías pegadas o con otro prefijo; y rellenos que NO son código
    const codigos=await page.evaluate(()=>({
      iguales:['MINSA21601','Cod21601','Idoneidad 21601','Reg. Prof. 21601'].map(_pmCodigo),
      vacios:['N/A','n/a','S/N','Sin código','no tiene','0','000','x',''].map(_pmCodigo),
    }));
    assert.deepEqual([...new Set(codigos.iguales)],['21601'],'Prefijos pegados al número: '+codigos.iguales);
    assert.deepEqual([...new Set(codigos.vacios)],[''],'Un relleno no es un código: '+codigos.vacios);

    const rellenos=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[n({pac:1,nom:'Ana Ruiz',cod:'N/A'}),n({pac:2,nom:'Luis Mora',cod:'N/A'}),
        n({pac:3,nom:'Eva Paz',cod:'S/N'}),n({pac:4,nom:'Raúl Gil',cod:'0'})]}).medicos.length;
    },N.toString());
    assert.equal(rellenos,4,'Cuatro médicos que escribieron relleno siguen siendo cuatro');

    // El formulario asigna la cuenta por NOMBRE: un homónimo externo la hereda
    const prestada=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({
        notas:[n({pac:1,nom:'Juan Pérez',cod:'111',pid:'u1'}),n({pac:5,nom:'Juan Pérez',cod:'111',pid:'u1'}),
               n({pac:2,nom:'Juan Pérez',cod:'222',pid:'u1'})],
        recetas:[{id:1,clinica_id:1,paciente_id:3,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u1',prescriptor_nombre:'Juan Pérez'}],
      },[{id:'u1',nombre:'Juan Pérez',rol:'medico'}]).medicos.map(m=>({cod:m.codigos.join(),at:m.atenciones,rec:m.recetas,cuenta:m.conCuenta}));
    },N.toString());
    assert.deepEqual(prestada,[{cod:'111',at:2,rec:1,cuenta:true},{cod:'222',at:1,rec:0,cuenta:false}],
      'Dos homónimos con código distinto son dos personas aunque el formulario les diera la misma cuenta');

    // Empate: no se sabe de quién es la cuenta → ningún código se la queda
    const empate=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[n({pac:1,nom:'Juan Pérez',cod:'111',pid:'u1'}),n({pac:2,nom:'Juan Pérez',cod:'222',pid:'u1'})],
        recetas:[{id:1,clinica_id:1,paciente_id:3,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u1',prescriptor_nombre:'Juan Pérez'}]},
        [{id:'u1',nombre:'Juan Pérez',rol:'medico'}]).medicos.map(m=>({cod:m.codigos.join(),at:m.atenciones,rec:m.recetas}));
    },N.toString());
    assert.equal(empate.length,3,'Dos códigos y la cuenta, sin repartir la receta a ciegas');
    assert.equal(empate.find(m=>m.rec===1).cod,'','La receta queda con la cuenta, sin código');

    // Nota con cita y examen visual sin cita, el mismo día: una visita
    const visitaMixta=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[n({pac:1,nom:'Ana Ruiz',cod:'5',cita:55}),n({pac:1,nom:'Ana Ruiz',cod:'5',tipo:'examen_visual'})]});
    },N.toString());
    assert.equal(visitaMixta.medicos[0].atenciones,1,'La misma visita no cuenta dos veces por llevar o no cita_id');
    assert.equal(visitaMixta.totales.atenciones,1);

    // Médico dueño con rol de administración: sí es médico
    const dueno=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({
        notas:[n({pac:1,nom:'Ana Ruiz',cod:'5',pid:'adm'})],
        recetas:[{id:1,clinica_id:1,paciente_id:2,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'adm',prescriptor_nombre:'Ana Ruiz'}],
        citas:[{id:1,clinica_id:1,paciente_id:3,fecha:'2026-10-10',estado:'completada',medico_id:'adm'}],
      },[{id:'adm',nombre:'Ana Ruiz',rol:'admin'}]);
    },N.toString());
    assert.deepEqual([dueno.medicos[0].recetas,dueno.medicos[0].citas,dueno.noMedico.receta],[1,1,0],
      'Una cuenta de administración que firma notas es de un médico');

    // Dos cuentas con el mismo nombre y sin código: dos personas
    const cuentas=await page.evaluate(()=>calcular({
      recetas:[{id:1,clinica_id:1,paciente_id:1,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u1',prescriptor_nombre:'María González'}],
      citas:[{id:1,clinica_id:2,paciente_id:2,fecha:'2026-10-10',estado:'completada',medico_id:'u2'}],
    },[{id:'u1',nombre:'María González',rol:'medico'},{id:'u2',nombre:'Maria Gonzalez',rol:'medico'}]).medicos.length);
    assert.equal(cuentas,2,'Dos cuentas no se juntan nunca por el nombre');

    // "Firma dudosa" solo en lo que no tiene código ni cuenta
    const dudosa=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[n({pac:1,nom:'Juan Pérez',cod:'111',pid:'u1'}),n({pac:2,nom:'Juan Pérez',cod:'222'})],
        recetas:[{id:1,clinica_id:1,paciente_id:3,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u1',prescriptor_nombre:'Juan Pérez'}]},
        [{id:'u1',nombre:'Juan Pérez',rol:'medico'}]);
    },N.toString());
    assert.equal(dudosa.medicos.filter(m=>m.dudoso).length,0,'Una receta con cuenta no es una firma dudosa');
    assert.deepEqual(dudosa.ambiguos,[]);

    // El resultado no depende del orden en que llegan los datos
    const orden=await page.evaluate((N)=>{
      const n=eval(N);
      const notas=[n({id:1,pac:1,nom:'Juan Pérez',cod:'111'}),n({id:2,pac:2,nom:'Juan A. Pérez',cod:'222'}),
                   n({id:3,pac:3,nom:'Carlos Ruiz',cod:''}),n({id:4,pac:4,nom:'Carlos Ruiz',cod:'9'})];
      const recetas=[{id:1,clinica_id:1,paciente_id:5,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'x',prescriptor_nombre:'Juan A. Pérez'}];
      const perfiles=[{id:'x',nombre:'Juan Pérez',rol:'medico'}];
      const firma=r=>JSON.stringify(r.medicos.map(m=>[m.nombre,m.codigos,m.atenciones,m.recetas,m.dudoso]));
      const a=firma(calcular({notas:notas.map(x=>({...x})),recetas:recetas.map(x=>({...x}))},perfiles));
      const b=firma(calcular({notas:notas.slice().reverse().map(x=>({...x})),recetas:recetas.map(x=>({...x}))},perfiles));
      return [a,b];
    },N.toString());
    assert.equal(orden[0],orden[1],'Los mismos datos en otro orden deben dar el mismo ranking');

    // ── Varias clínicas: el mismo médico se une y se listan sus clínicas ──
    const multi=await page.evaluate((N)=>{
      const n=eval(N);
      return calcular({notas:[n({pac:1,cl:1,nom:'Juan',cod:'9'}),n({pac:1,cl:2,nom:'Juan',cod:'9'})]}).medicos;
    },N.toString());
    assert.equal(multi.length,1);
    assert.equal(multi[0].pacientes,2,'El paciente 1 de cada clínica es una persona distinta');
    assert.deepEqual(multi[0].clinicas.sort(),['1','2']);

    // ── Cómo se ve ──
    const datos=await page.evaluate((N)=>{
      const n=eval(N);
      const r=calcular({
        notas:[
          ...Array.from({length:9},(_,i)=>n({pac:i+1,nom:'Dra. María Fernanda González Castillo',cod:'MINSA 21601',cl:1})),
          ...Array.from({length:5},(_,i)=>n({pac:20+i,nom:'Dr. Luis Gómez',cod:'3344',cl:2})),
          n({pac:40,nom:'Luis Gomez',cod:'3344',cl:2}),
          n({pac:30,nom:'Carlos Ruiz',cod:'',cl:1}),
          n({pac:31,nom:'',cod:'',cl:1}),
        ],
        recetas:[{id:1,clinica_id:1,paciente_id:1,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u-m',prescriptor_nombre:'María Fernanda González Castillo'}],
      },[{id:'u-m',nombre:'María Fernanda González Castillo',rol:'medico_admin',especialidad:'Ginecología'}]);
      window.__datos({...r,etiqueta:'octubre de 2026',from:'2026-10-01',to:'2026-10-30',clinica:null,
        avisos:[]});
      return true;
    },N.toString());
    const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
    for(const width of [1280,390,360]) {
      await page.setViewportSize({width,height:900});
      await page.evaluate(async()=>{ await renderProductividadMedica(); });
      const contenido=await page.evaluate(()=>document.body.innerHTML);
      await page.setContent(`<style>${css}\n*{animation:none!important;transition:none!important}</style>`
        +`<div style="padding:12px;background:var(--bg)">${contenido}</div>`);
      const m=await page.evaluate(()=>({desborde:document.documentElement.scrollWidth-innerWidth,
        filas:document.querySelectorAll('.pm-fila').length}));
      assert.equal(m.desborde,0,'Desborde horizontal a '+width+' px');
      assert.equal(m.filas,3);
      const dest=path.join(process.env.TEMP||'/tmp','lumea-productividad-'+width+'.png');
      await page.screenshot({path:dest,fullPage:true});
      console.log('Layout '+width+' px: '+dest);
      await page.setContent(`<html><body><div class="pm-controles" id="pm-controles"></div><div id="pm-contenido"></div></body></html>`);
      await page.addScriptTag({content:preambulo});
      await page.evaluate((N)=>{
        const n=eval(N);
        const r=calcular({
          notas:[
            ...Array.from({length:9},(_,i)=>n({pac:i+1,nom:'Dra. María Fernanda González Castillo',cod:'MINSA 21601',cl:1})),
            ...Array.from({length:5},(_,i)=>n({pac:20+i,nom:'Dr. Luis Gómez',cod:'3344',cl:2})),
            n({pac:40,nom:'Luis Gomez',cod:'3344',cl:2}),
            n({pac:30,nom:'Carlos Ruiz',cod:'',cl:1}),
            n({pac:31,nom:'',cod:'',cl:1}),
          ],
          recetas:[{id:1,clinica_id:1,paciente_id:1,receta_id:'R1',fecha_emision:'2026-10-11',prescriptor_id:'u-m',prescriptor_nombre:'María Fernanda González Castillo'}],
        },[{id:'u-m',nombre:'María Fernanda González Castillo',rol:'medico_admin',especialidad:'Ginecología'}]);
        window.__datos({...r,etiqueta:'octubre de 2026',from:'2026-10-01',to:'2026-10-30',clinica:null,avisos:[]});
      },N.toString());
    }
    console.log('OK: grafías, visitas, identidad, puente por nombre, homónimos, exclusiones, examen visual, ranking, multiclínica y layout.');
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
