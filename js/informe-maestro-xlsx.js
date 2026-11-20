/* global XLSX, importScripts */
importScripts('vendor/xlsx-0.20.3.full.min.js');

const formatos = {
  dinero:'"C$" #,##0.00;[Red]("C$" #,##0.00);"C$" 0.00',
  unitario:'"C$" #,##0.00##;("C$" #,##0.00##);"C$" 0.00',
  cantidad:'#,##0.###;(#,##0.###);0',
  porcentaje:'0.00####%',
  fecha:'dd/mm/yyyy'
};

function valorExcel(valor,tipo) {
  if(valor===null || valor===undefined || valor==='') return null;
  if(tipo==='fecha' && /^\d{4}-\d{2}-\d{2}$/.test(valor))
    return {t:'n',v:25569+Date.parse(valor+'T00:00:00Z')/86400000,z:formatos.fecha};
  const literal=String(valor);
  if(formatos[tipo] && /^-?\d+(?:\.\d+)?$/.test(literal) &&
      literal.replace(/[-.]/g,'').replace(/^0+/,'').replace(/0+$/,'').length<=15 && Number.isFinite(Number(literal)))
    return {t:'n',v:tipo==='porcentaje'?Number(literal)/100:Number(literal),z:formatos[tipo]};
  // Los códigos y descripciones se escriben como texto literal, incluidas las cadenas que empiezan con '='.
  return {t:'s',v:literal};
}

function escribirLibro({empresa,mes,estado,hojas}) {
  const libro=XLSX.utils.book_new(), util=XLSX.utils;
  const celdasTotales=new Map();
  libro.Props={Title:'Informe maestro mensual · '+empresa+' · '+mes,Subject:'Inventario y libro contable',Author:empresa};
  for(const info of hojas) {
    const maestro=info.nombre==='Maestro de inventario', concilia=info.nombre==='Conciliación de costo';
    const encabezado=maestro?4:3, inicio=encabezado+1;
    const ws=util.aoa_to_sheet([[empresa+' · '+info.nombre],[mes+' · '+estado],[info.nota||'']]);
    ws['!merges']=[];
    const combinar=(fila,desde,hasta)=>{
      if(hasta>desde) ws['!merges'].push({s:{r:fila,c:desde},e:{r:fila,c:hasta}});
    };
    for(let r=0;r<3;r++) combinar(r,0,info.columnas.length-1);
    if(maestro) {
      util.sheet_add_aoa(ws,[['Artículo',null,null,null,'Unidades',null,null,null,null,null,'Valores en córdobas']],{origin:{r:3,c:0}});
      combinar(3,0,3);combinar(3,4,9);combinar(3,10,info.columnas.length-1);
    }
    util.sheet_add_aoa(ws,[info.columnas],{origin:{r:encabezado,c:0}});
    if(info.filas.length+inicio+1>1048576) throw new Error('El período supera el máximo de filas de Excel en '+info.nombre+'.');
    const anchos=info.columnas.map(s=>Math.max(13,s.length+3));
    const columnas=Object.fromEntries((info.claves||[]).map((k,i)=>[k,i]));
    for(const [indice,fila] of info.filas.entries()) {
      const r=inicio+indice, n=r+1;
      const celdas=fila.map((valor,i)=>valorExcel(valor,info.tipos[i]));
      function formula(destino,campos,signos,decimales) {
        const pos=columnas[destino],celda=celdas[pos];
        if(celda?.t!=='n' || !campos.every(k=>celdas[columnas[k]]?.t==='n')) return;
        const refs=campos.map(k=>util.encode_col(columnas[k])+n);
        const expr=refs.map((ref,i)=>(i?signos[i-1]:'')+ref).join('');
        celda.f='IF(COUNT('+refs.join(',')+')='+refs.length+',ROUND('+expr+','+decimales+'),"")';
      }
      if(maestro) {
        formula('finalCalculado',['inicial','entradas','salidas'],['+','-'],3);
        formula('diferenciaUnidades',['finalCalculado','finalReportado'],['-'],3);
        formula('utilidad',['ventas','costoVentas'],['-'],2);
      } else if(concilia) {
        formula('costoPeriodico',['valorInicial','compras','valorFinal'],['+','-'],2);
        formula('diferenciaCosto',['costoPeriodico','costoVentas'],['-'],2);
        formula('diferenciaSinExplicar',['diferenciaCosto','ajusteNeto'],['-'],2);
      }
      celdas.forEach((celda,i)=>{
        if(!celda) return;
        ws[util.encode_cell({r,c:i})]=celda;
        if(celda.t==='s') anchos[i]=Math.min(80,Math.max(anchos[i],String(celda.v).length+2));
      });
    }
    const ultima=inicio+info.filas.length-1;
    const hayTotales=info.filas.length && (maestro||concilia);
    if(hayTotales) {
      ws['A'+(ultima+2)]={t:'s',v:'Total del período'};
      for(const [i,k] of info.claves.entries()) {
        if(info.tipos[i]!=='dinero'||!info.totales||info.totales[k]==null) continue;
        const celda=valorExcel(info.totales[k],'dinero'),col=util.encode_col(i);
        if(celda.t==='n' && info.filas.every((_,j)=>ws[col+(inicio+j+1)]?.t==='n')) {
          const rango=col+(inicio+1)+':'+col+(ultima+1);
          celda.f='IF(COUNT('+rango+')='+info.filas.length+',ROUND(SUM('+rango+'),2),"")';
        }
        ws[col+(ultima+2)]=celda;
        if(celda.t==='n') celdasTotales.set(k,"'"+info.nombre+"'!"+col+(ultima+2));
      }
      anchos[0]=Math.max(anchos[0],19);
    }
    if(info.filas.length)
      ws['!autofilter']={ref:util.encode_range({s:{r:encabezado,c:0},e:{r:ultima,c:info.columnas.length-1}})};
    ws['!ref']=util.encode_range({s:{r:0,c:0},e:{r:ultima+(hayTotales?1:0),c:info.columnas.length-1}});
    ws['!cols']=anchos.map(wch=>({wch}));
    ws['!rows']=[{hpt:24},{hpt:19}];
    ws['!margins']={left:.35,right:.35,top:.5,bottom:.5,header:.2,footer:.2};
    util.book_append_sheet(libro,ws,info.nombre);
  }
  const resumen=hojas.find(h=>h.nombre==='Resumen');
  resumen.indicadores.forEach((k,i)=>{
    const celda=libro.Sheets.Resumen['B'+(i+5)],ref=celdasTotales.get(k);
    if(celda?.t==='n' && ref) celda.f='IF(ISNUMBER('+ref+'),'+ref+',"")';
  });
  return XLSX.write(libro,{bookType:'xlsx',type:'array',compression:true});
}

self.onmessage=({data})=>{
  try {
    const archivo=escribirLibro(data);
    self.postMessage({archivo},[archivo]);
  } catch(error) {self.postMessage({error:error.message||'No se pudo crear el libro Excel.'});}
};
