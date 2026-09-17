// Balance con la ganancia escrita a mano, y borrado de facturas anuladas.
// Ejecutar con PLAYWRIGHT_MODULE apuntando a una instalación de playwright.
// PLAYWRIGHT_CHROMIUM permite usar un Chromium propio en vez del canal msedge.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');

function extraer(name) {
  const start=source.search(new RegExp('^(async )?function '+name+'\\(','m'));
  assert(start>=0,'No se encontró '+name);
  const primeraLinea=source.slice(start,source.indexOf('\n',start));
  let abiertas=0;
  for(const ch of primeraLinea) { if(ch==='{') abiertas++; else if(ch==='}') abiertas--; }
  if(abiertas===0 && primeraLinea.includes('{')) return primeraLinea;
  return source.slice(start,source.indexOf('\n}',start)+2);
}
const code=['_tipoServicio','_porcentajeClinica','_balanceManual','_lineasBalance',
  '_resumenBalance','_pctGrupoBalance','calcFacturaTotals','renderFacturaItemsUI',
  'eliminarFactura'].map(extraer).join('\n');

const preambulo=`
  window.__sb=[]; window.__toasts=[];
  let confirmar=true;
  window.__responder=v=>{confirmar=v;};
  const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const fmtC=n=>'C$ '+Number(n||0).toFixed(2);
  const _fmtPct=n=>(Math.round(n*100)/100)+' %';
  const toast=(m,t)=>window.__toasts.push({m,t:t||'info'});
  const setLoading=()=>{};
  const loadAll=async()=>{};
  const renderFinanzas=()=>{};
  const customConfirm=async()=>confirmar;
  const _exigeClinica=()=>!!currentClinicaId;
  const TIPOS_SERVICIO_FACTURA=[
    {id:'consulta',label:'Consulta',icon:'C'},{id:'procedimiento',label:'Procedimiento',icon:'P'},
    {id:'examen',label:'Examen',icon:'E'},{id:'servicio',label:'Servicio',icon:'S'},
    {id:'producto',label:'Producto',icon:'X'}];

  window.__errBorrado=null;   // simula un fallo al borrar las líneas
  const sb={from:tabla=>({delete:()=>{
    const filtros={};
    const api={
      eq:(k,v)=>{filtros[k]=v;return api;},
      then:(res,rej)=>{
        window.__sb.push({tabla,op:'delete',filtros});
        const falla=window.__errBorrado===tabla;
        return Promise.resolve({error:falla?{message:'fallo simulado'}:null}).then(res,rej);
      }
    };
    return api;
  }})};

  let currentClinicaId=7, currentClinica={id:7,balance_modo:'porcentaje'};
  window.__modo=m=>{currentClinica.balance_modo=m;};
  const C={fact:[],factItems:[],reparto:[]};
  window.__datos=(fact,items,reparto)=>{C.fact=fact;C.factItems=items;C.reparto=reparto||[];};
  window.__limpiar=()=>{window.__sb.length=0;window.__toasts.length=0;};
  let facturaItems=[];
  window.__items=xs=>{facturaItems=xs;};

  ${code}
  Object.assign(window,{_lineasBalance,_resumenBalance,_pctGrupoBalance,_balanceManual,
    calcFacturaTotals,renderFacturaItemsUI,eliminarFactura});
`;

const lanzar=()=>process.env.PLAYWRIGHT_CHROMIUM
  ? chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM,headless:true})
  : chromium.launch({channel:'msedge',headless:true});

const FACT=[{id:1,fecha:'2026-09-10',estado:'pagada',numero:'F-1',pacienteNombre:'Ana'}];

(async()=>{
  const browser=await lanzar();
  try {
    const page=await browser.newPage();
    await page.setContent(`<html><body>
      <div id="fact-items-list"></div>
      <span id="fact-subtotal"></span><span id="fact-total"></span>
      <span id="fact-col-gana" hidden></span>
      <div id="fact-gana-row" hidden></div><span id="fact-gana-total"></span>
    </body></html>`);
    await page.addScriptTag({content:preambulo});

    // ── Lo escrito a mano manda sobre el porcentaje ──
    const manda=await page.evaluate(({fact})=>{
      // La línea tiene porcentaje fijado (50 %) Y un importe escrito (700).
      window.__datos(fact,[{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,
        subtotal:1000,porcentajeClinica:50,montoClinica:700}],[{tipo:'consulta',porcentaje:50}]);
      const l=_lineasBalance('2026-09-01','2026-09-30')[0];
      return {clinica:l.clinica,manual:l.manual,pct:l.pct};
    },{fact:FACT});
    assert.equal(manda.clinica,700,'El importe escrito debe ganarle al porcentaje');
    assert.equal(manda.manual,true);
    assert.equal(manda.pct,null,'No debe mostrar un % que no se usó');

    // ── Sin importe escrito se sigue usando el porcentaje ──
    const porPct=await page.evaluate(({fact})=>{
      window.__datos(fact,[{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,
        subtotal:1000,porcentajeClinica:40,montoClinica:null}],[]);
      const l=_lineasBalance('2026-09-01','2026-09-30')[0];
      return {clinica:l.clinica,manual:l.manual,pct:l.pct};
    },{fact:FACT});
    assert.equal(porPct.clinica,400,'40 % de 1000');
    assert.equal(porPct.manual,false);

    // ── Un importe de cero es un importe, no "sin escribir" ──
    const cero=await page.evaluate(({fact})=>{
      window.__datos(fact,[{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,
        subtotal:1000,porcentajeClinica:50,montoClinica:0}],[{tipo:'consulta',porcentaje:50}]);
      const l=_lineasBalance('2026-09-01','2026-09-30')[0];
      return {clinica:l.clinica,manual:l.manual};
    },{fact:FACT});
    assert.equal(cero.clinica,0,'Escribir 0 debe dejar 0 a la clínica, no caer al 50 %');
    assert.equal(cero.manual,true);

    // ── Línea sin nada: no se reparte y se avisa ──
    const sinNada=await page.evaluate(({fact})=>{
      window.__datos(fact,[{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:500,
        subtotal:500,porcentajeClinica:null,montoClinica:null}],[]);
      const lineas=_lineasBalance('2026-09-01','2026-09-30');
      const r=_resumenBalance(lineas);
      return {clinica:lineas[0].clinica,sinPct:r.sinPct,total:r.total,clinicaTotal:r.clinica};
    },{fact:FACT});
    assert.equal(sinNada.clinica,null);
    assert.equal(sinNada.sinPct,500,'Lo no repartido se contabiliza aparte');
    assert.equal(sinNada.clinicaTotal,0);

    // ── Grupo mezclado: escrito a mano + porcentaje ──
    const mezcla=await page.evaluate(({fact})=>{
      window.__datos(fact,[
        {id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,porcentajeClinica:null,montoClinica:700},
        {id:2,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,subtotal:1000,porcentajeClinica:50,montoClinica:null},
        {id:3,facturaId:1,tipo:'examen',  cantidad:1,precioUnitario:400, subtotal:400, porcentajeClinica:null,montoClinica:100}
      ],[]);
      const r=_resumenBalance(_lineasBalance('2026-09-01','2026-09-30'));
      const consulta=r.grupos.find(g=>g.tipo==='consulta');
      const examen=r.grupos.find(g=>g.tipo==='examen');
      return {total:r.total,clinica:r.clinica,profesionales:r.profesionales,
              pctConsulta:_pctGrupoBalance(consulta),pctExamen:_pctGrupoBalance(examen)};
    },{fact:FACT});
    assert.equal(mezcla.total,2400);
    assert.equal(mezcla.clinica,1300,'700 + 500 + 100');
    assert.equal(mezcla.profesionales,1100,'2400 - 1300');
    assert.equal(mezcla.pctConsulta.mixto,true,'Mezclar a mano y % da un efectivo');
    assert.equal(mezcla.pctExamen.texto,'a mano','Todo a mano se etiqueta como tal');

    // ── El modo solo decide la interfaz, no recalcula lo cobrado ──
    const cambioModo=await page.evaluate(({fact})=>{
      window.__datos(fact,[{id:1,facturaId:1,tipo:'consulta',cantidad:1,precioUnitario:1000,
        subtotal:1000,porcentajeClinica:null,montoClinica:700}],[{tipo:'consulta',porcentaje:20}]);
      window.__modo('porcentaje');
      const enPct=_lineasBalance('2026-09-01','2026-09-30')[0].clinica;
      window.__modo('manual');
      const enManual=_lineasBalance('2026-09-01','2026-09-30')[0].clinica;
      return {enPct,enManual};
    },{fact:FACT});
    assert.equal(cambioModo.enPct,700,'Volver al modo porcentaje no recalcula lo ya cobrado');
    assert.equal(cambioModo.enManual,700);

    // ── La casilla solo sale en modo manual, y suma ──
    const casilla=await page.evaluate(()=>{
      window.__items([{id:1,desc:'Consulta',tipo:'consulta',cant:1,precio:1000,ganancia:700},
                      {id:2,desc:'Examen',  tipo:'examen',  cant:1,precio:400, ganancia:100}]);
      window.__modo('porcentaje');
      renderFacturaItemsUI(); calcFacturaTotals();
      const pct={casillas:document.querySelectorAll('.fact-item-gana').length,
                 fila:document.getElementById('fact-gana-row').hidden};
      window.__modo('manual');
      renderFacturaItemsUI(); calcFacturaTotals();
      const man={casillas:document.querySelectorAll('.fact-item-gana').length,
                 fila:document.getElementById('fact-gana-row').hidden,
                 total:document.getElementById('fact-gana-total').textContent,
                 factura:document.getElementById('fact-total').textContent};
      return {pct,man};
    });
    assert.equal(casilla.pct.casillas,0,'En modo porcentaje no debe aparecer la casilla');
    assert.equal(casilla.pct.fila,true,'Ni el total de la clínica');
    assert.equal(casilla.man.casillas,2,'Una casilla por línea');
    assert.equal(casilla.man.total,'C$ 800.00','700 + 100');
    assert.equal(casilla.man.factura,'C$ 1400.00','El total de la factura no cambia');

    // ── Borrar factura: solo las anuladas ──
    const noAnulada=await page.evaluate(async()=>{
      const r={};
      for(const estado of ['pagada','pendiente']) {
        window.__datos([{id:9,fecha:'2026-09-10',estado,numero:'F-9',pacienteNombre:'Ana'}],[]);
        window.__limpiar();
        await eliminarFactura(9);
        r[estado]={escrituras:window.__sb.length,toast:window.__toasts.at(-1)?.t};
      }
      return r;
    });
    assert.equal(noAnulada.pagada.escrituras,0,'Una pagada sostiene un ingreso: no se borra');
    assert.equal(noAnulada.pagada.toast,'error');
    assert.equal(noAnulada.pendiente.escrituras,0,'Una pendiente todavía se puede cobrar');

    // ── Borrar una anulada: primero las líneas, luego la factura ──
    const borrado=await page.evaluate(async()=>{
      window.__datos([{id:9,fecha:'2026-09-10',estado:'anulada',numero:'F-9',pacienteNombre:'Ana'}],[]);
      window.__limpiar();
      await eliminarFactura(9);
      return {sb:window.__sb,toast:window.__toasts.at(-1)};
    });
    assert.equal(borrado.sb.length,2,'Dos borrados');
    assert.equal(borrado.sb[0].tabla,'factura_items','Las líneas primero, por la clave foránea');
    assert.equal(borrado.sb[0].filtros.factura_id,9);
    assert.equal(borrado.sb[1].tabla,'facturas');
    assert.equal(borrado.sb[1].filtros.id,9);
    assert.equal(borrado.sb[1].filtros.clinica_id,7,'Filtra por la clínica');
    assert.match(borrado.toast.m,/eliminada/);

    // ── Si fallan las líneas, la factura NO se borra ──
    const falla=await page.evaluate(async()=>{
      window.__datos([{id:9,fecha:'2026-09-10',estado:'anulada',numero:'F-9',pacienteNombre:'Ana'}],[]);
      window.__errBorrado='factura_items';
      window.__limpiar();
      await eliminarFactura(9);
      window.__errBorrado=null;
      return {sb:window.__sb,toast:window.__toasts.at(-1)};
    });
    assert.equal(falla.sb.length,1,'No debe borrar la factura si sus líneas quedaron');
    assert.equal(falla.toast.t,'error');

    // ── Si se cancela el diálogo no pasa nada ──
    const cancelado=await page.evaluate(async()=>{
      window.__datos([{id:9,fecha:'2026-09-10',estado:'anulada',numero:'F-9',pacienteNombre:'Ana'}],[]);
      window.__responder(false); window.__limpiar();
      await eliminarFactura(9);
      window.__responder(true);
      return window.__sb.length;
    });
    assert.equal(cancelado,0);

    // ── Cómo se ve la fila con la casilla nueva ──
    const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
    const filas=await page.evaluate(()=>{
      window.__modo('manual');
      window.__items([{id:1,desc:'Consulta general',tipo:'consulta',cant:1,precio:1000,ganancia:700}]);
      renderFacturaItemsUI();
      return document.getElementById('fact-items-list').innerHTML;
    });
    for(const width of [1280,390,360]) {
      await page.setViewportSize({width,height:700});
      await page.setContent(`<style>${css}\n*{animation:none!important;transition:none!important}</style>`
        +`<div style="padding:12px;background:var(--bg)"><div class="card"><div class="fact-items-scroll">`
        +`<div class="fact-items-header"><span style="width:140px;flex-shrink:0">Tipo</span>`
        +`<span style="flex:1;min-width:120px">Descripción</span>`
        +`<span style="width:65px;flex-shrink:0;text-align:center">Cant.</span>`
        +`<span style="width:100px;flex-shrink:0;text-align:right">Precio C$</span>`
        +`<span style="width:110px;flex-shrink:0;text-align:right">Gana clínica</span>`
        +`<span style="width:90px;flex-shrink:0;text-align:right">Subtotal</span>`
        +`<span style="width:32px;flex-shrink:0"></span></div>${filas}</div></div></div>`);
      const m=await page.evaluate(()=>{
        const g=document.querySelector('.fact-item-gana');
        const fila=document.querySelector('.fact-item-row');
        return {
          desborde:document.documentElement.scrollWidth-innerWidth,
          gana:!!g, anchoGana:g?g.getBoundingClientRect().width:0,
          anchoFila:fila?fila.scrollWidth:0
        };
      });
      assert.equal(m.desborde,0,'La página no debe desbordarse a '+width+' px');
      assert.ok(m.gana,'Debe estar la casilla de ganancia');
      assert.ok(m.anchoGana>=100,'La casilla no debe comprimirse a '+width+' px ('+m.anchoGana+')');
      // En móvil la fila crece para dejarle sitio: si :has() no aplicara, se
      // quedaría en los 590px de antes y la casilla saldría recortada.
      if(width<=560) assert.ok(m.anchoFila>=708,
        'La fila debe ensancharse para la casilla a '+width+' px ('+m.anchoFila+')');
      const dest=path.join(process.env.TEMP||'/tmp','lumea-balance-manual-'+width+'.png');
      await page.screenshot({path:dest});
      console.log('Layout '+width+' px: '+dest);
    }

    console.log('OK: manual manda, cero cuenta, mezcla, cambio de modo, casilla, y borrado de anuladas.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
