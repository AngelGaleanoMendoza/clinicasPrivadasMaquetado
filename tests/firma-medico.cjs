// Ejecutar con PLAYWRIGHT_MODULE apuntando a una instalación de playwright.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(root,'js/app.js'),'utf8');
const functions=['_dxMarcarFirma','_dxDetectarFirma','_dxRellenarFirma','_dxCuerpoRelleno','_dxValoresFirmadosNota','_llenarProfesionalExamenVisual','_sugerirMedicoExamenVisual','_medicoExamenVisual','_dxSeleccionAFirma'];
const code=functions.map(name=>{
  const start=source.indexOf('function '+name+'(');
  assert(start>=0,name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}).join('\n');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage();
    await page.setContent('<html><body></body></html>');
    await page.addScriptTag({content:`
      const _etiquetaCodigoMedico=()=> 'Código MINSA';
      const _claveMedico=s=>String(s||'').trim().toLowerCase();
      const escAttr=s=>String(s||'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
      const _medicosConocidosNota=()=>[{nombre:'Dra. Ana Pérez',codigo:'9988',id:null}];
      const toast=()=>{};
      const _dxPrepararPiezas=()=>{};
      const _dxPintarGraficas=()=>{};
      let _machoteEnRevision;
      const _cuerpoRevision=()=>document.querySelector('#revision');
      ${code}`});
    const result=await page.evaluate(()=>{
      const base='<p class="dx-p">Cribado del primer trimestre</p><p class="dx-p">Paciente: María</p><p class="dx-p">___________________</p><p class="dx-p" style="text-align:center">Dra. Karen González Montenegro</p><p class="dx-p" style="text-align:center">Ginecología</p><p class="dx-p" style="text-align:center">Código Minsa 21601</p>';
      const doc={cuerpo:base};
      const values=_dxValoresFirmadosNota({profesionalNombre:'Dra. Ana Pérez',profesionalCodigo:'9988',profesionalEspecialidad:'Obstetricia'});
      const html=_dxCuerpoRelleno(doc,values);
      if(html.includes('Karen')||html.includes('21601')||!html.includes('9988')||!html.includes('Paciente: María')) throw Error('Firma original o contenido incorrecto');
      const sinFirma=_dxCuerpoRelleno({cuerpo:'<p class="dx-p">Hallazgos</p>'},values);
      if(!sinFirma.includes('9988')) throw Error('No agregó firma');
      const cont=document.createElement('div');cont.innerHTML=html;
      _dxRellenarFirma(cont,{nombre:'Dr. Luis Gómez',codigo:'555'});
      if(cont.textContent.includes('9988')||!cont.textContent.includes('555')) throw Error('No actualizó firma');
      document.body.innerHTML='<div id="revision"><p class="dx-p">Firma fija sin patrón</p><p class="dx-p">Registro 123</p></div>';
      const r=document.createRange();r.selectNodeContents(document.querySelector('#revision'));_machoteEnRevision={rango:r};_dxSeleccionAFirma();
      if(document.querySelectorAll('[data-firma-medico]').length!==2) throw Error('Selección manual');
      document.body.innerHTML='<input id="ev-medico-nombre"><input id="ev-medico-codigo"><datalist id="ev-medicos"></datalist>';
      _llenarProfesionalExamenVisual(null);
      if(_medicoExamenVisual(null)!==null) throw Error('Aceptó médico vacío');
      document.querySelector('#ev-medico-nombre').value='Dra. Ana Pérez';_sugerirMedicoExamenVisual();
      if(_medicoExamenVisual(null).codigo!=='9988') throw Error('Sugerencia sin código');
      const final={estado:'finalizada',profesionalNombre:'Dr. Histórico',profesionalCodigo:'111'};
      _llenarProfesionalExamenVisual(final);
      document.querySelector('#ev-medico-codigo').value='222';
      if(_medicoExamenVisual(final).codigo!=='111') throw Error('Cambió médico histórico');
      return {html,sinFirma};
    });
    const css=fs.readFileSync(path.join(root,'css/styles.css'),'utf8');
    for(const width of [1280,390]) {
      await page.setViewportSize({width,height:900});
      await page.setContent(`<style>${css}\n*{animation:none!important;transition:none!important}</style><div class="modal-overlay open"><div class="modal"><h2>Cribado del primer trimestre</h2><div class="form-group nota-firma-panel"><label>Nombre completo</label><input value="Dra. Ana Pérez"><label>Código MINSA</label><input value="9988"></div><div class="dx-hoja" style="margin-top:24px">${result.html}</div></div></div>`);
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Desbordamiento horizontal '+width);
      const dest=path.join(process.env.TEMP||'/tmp','lumea-firma-'+width+'.png');
      await page.screenshot({path:dest});
      console.log('Layout '+width+' px: '+dest);
    }
    console.log('OK: detección, actualización, sin firma, selección manual, sugerencias y médico histórico.');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
