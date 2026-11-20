/* global XLSX, importScripts */
importScripts('vendor/xlsx-0.20.3.full.min.js');

function leerLibroExcel(buffer, nombre) {
  const extension = nombre.split('.').pop().toLowerCase();
  const firma = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 8));
  if (extension === 'xlsx' && !(firma[0] === 80 && firma[1] === 75))
    throw new Error('El contenido no corresponde a un archivo .xlsx.');
  if (extension === 'xls' && !(firma[0] === 208 && firma[1] === 207))
    throw new Error('Guarda este libro como .xlsx o como .xls de Excel 97-2003.');
  if (!['xlsx', 'xls', 'csv'].includes(extension)) throw new Error('Usa .xlsx, .xls o .csv.');

  let origen = buffer;
  if (extension === 'csv') {
    try { origen = new TextDecoder('utf-8', {fatal:true}).decode(buffer); }
    catch { throw new Error('Guarda el CSV con la codificación UTF-8.'); }
    if (!origen.trim() || origen.includes('\0') || origen.trimStart().startsWith('<'))
      throw new Error('El archivo no contiene una tabla CSV válida.');
  }
  const libro = XLSX.read(origen, {
    type: extension === 'csv' ? 'string' : 'array',
    raw:true, cellHTML:false, sheetStubs:true, sheetRows:2002
  });
  if (libro.SheetNames.length > 30) throw new Error('El archivo supera el máximo de 30 hojas.');
  const esInformeMaestro = /^Informe maestro mensual · /.test(libro.Props?.Title || '') &&
    libro.SheetNames.includes('Maestro de inventario') && libro.SheetNames.includes('Conciliación de costo');
  return libro.SheetNames.map((nombreHoja, i) => {
    const hoja = libro.Sheets[nombreHoja];
    const resultado = {nombre:nombreHoja, esInformeMaestro, oculta:!!libro.Workbook?.Sheets?.[i]?.Hidden, filas:[]};
    if (!hoja || !hoja['!ref']) return resultado;
    const rango = XLSX.utils.decode_range(hoja['!fullref'] || hoja['!ref']);
    if (rango.e.r > 1999 || rango.e.c > 79)
      return {...resultado, error:'Usa como máximo las primeras 2,000 filas y 80 columnas por hoja.'};
    const filas = new Map();
    for (const [direccion, celda] of Object.entries(hoja)) {
      if (direccion.startsWith('!') || !celda) continue;
      // Una fórmula de Excel trae guardado su resultado: se usa ese valor (los
      // libros de una empresa suelen tener totales y precios calculados). Un
      // error (#¡VALOR!, #N/A) o una fórmula escrita en un CSV no se aceptan.
      const invalida = celda.t === 'e' || (!!celda.f && celda.v == null) ||
        (extension === 'csv' && typeof celda.v === 'string' && /^\s*=/.test(celda.v));
      if (!invalida && (celda.v == null || String(celda.v).trim() === '')) continue;
      const {r, c} = XLSX.utils.decode_cell(direccion);
      if (!filas.has(r)) filas.set(r, {numero:r + 1, celdas:[]});
      const valor = typeof celda.v === 'string' ? celda.v.slice(0, 501) : celda.v;
      filas.get(r).celdas[c] = {valor, texto:celda.t === 'n' ? celda.w : undefined, invalida};
    }
    resultado.filas = [...filas.values()].sort((a, b) => a.numero - b.numero);
    resultado.fecha1904 = !!libro.Workbook?.WBProps?.date1904;
    return resultado;
  });
}

self.onmessage = ({data}) => {
  try { self.postMessage({hojas:leerLibroExcel(data.buffer, data.nombre)}); }
  catch (error) { self.postMessage({error:error.message || 'No se pudo leer el archivo.'}); }
};
