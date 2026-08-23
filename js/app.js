// ════════════════════ SUPABASE ════════════════════
const SURL = 'https://ckpskotpdkmojgaqxyht.supabase.co';
const SKEY = 'sb_publishable_2W-uJNSJSFLMYn5NJShPKw_sRCynIka';
const sb = supabase.createClient(SURL, SKEY, {
  auth: { storage: sessionStorage, persistSession: true }
});

// ════════════════════ PERMISOS ════════════════════
const ALL_PERMISOS = [
  { id:'pacientes',    label:'Pacientes',          icon:'👥' },
  { id:'citas',        label:'Citas',               icon:'📅' },
  { id:'agendas',      label:'Agendas',             icon:'🗓️' },
  { id:'medicaciones', label:'Recetas / Medicac.',  icon:'💊' },
  { id:'notas',        label:'Notas Clínicas',      icon:'📝' },
  { id:'atendidos',    label:'Atendidos por Día',   icon:'📊' },
  { id:'inventario',   label:'Inventario',          icon:'📦' },
  { id:'finanzas',     label:'Finanzas',            icon:'💰' },
  { id:'estadisticas', label:'Estadísticas',        icon:'📈' },
  { id:'exportar',     label:'Exportar / Enviar',   icon:'📤' },
  { id:'farmacia',     label:'Módulo Farmacia',     icon:'🏪' },
];
// Inventario y Finanzas NUNCA se otorgan por rol: el administrador debe marcarlos
// explícitamente al crear o editar el usuario.
const PERMISOS_DEFECTO = {
  medico:       ['pacientes','citas','agendas','medicaciones','notas'],
  medico_admin: ['pacientes','citas','agendas','medicaciones','notas','atendidos','estadisticas','exportar'],
  admin:        ['pacientes','citas','agendas','medicaciones','notas','atendidos','estadisticas','exportar'],
  recepcion:    ['pacientes','citas'],
  enfermeria:   ['pacientes','medicaciones','notas'],
  farmaceutico: ['inventario','finanzas','farmacia'],
  odontologo:   ['pacientes','citas','medicaciones','notas'],
};

// ════════════════════ PROCEDIMIENTOS ODONTOLÓGICOS ════════════════════
const PROCEDIMIENTOS_DENTALES = [
  { cat:'Exámenes clínicos', procs:['Evaluación odontológica general','Odontograma inicial','Odontograma evolutivo','Examen periodontal','Examen de encías','Examen de movilidad dental','Examen de sangrado gingival','Examen de placa bacteriana','Examen de caries','Examen de oclusión o mordida','Examen de ATM','Examen de tejidos blandos','Examen de lengua, labios, paladar y mucosa','Evaluación de dolor dental','Evaluación de sensibilidad dental','Evaluación de halitosis','Evaluación de bruxismo','Evaluación de trauma dental','Evaluación estética de sonrisa','Evaluación para ortodoncia','Evaluación para implantes','Evaluación para prótesis dental','Evaluación prequirúrgica'] },
  { cat:'Exámenes radiográficos', procs:['Radiografía periapical','Radiografía panorámica','Radiografía bitewing','Radiografía oclusal','Cefalometría lateral','Cefalometría posteroanterior','Tomografía dental CBCT','Radiografía de ATM','Serie radiográfica completa','Evaluación radiográfica de terceros molares','Evaluación radiográfica para implantes','Evaluación radiográfica de lesiones óseas','Control radiográfico postoperatorio','Control radiográfico de endodoncia'] },
  { cat:'Registros clínicos', procs:['Fotografías intraorales','Fotografías extraorales','Escaneo intraoral','Registro de mordida','Modelos digitales','Modelos de estudio','Plan de tratamiento digital','Consentimiento informado digital','Evolución clínica por cita','Notas odontológicas','Registro de alergias','Antecedentes odontológicos','Alertas clínicas'] },
  { cat:'Prevención', procs:['Profilaxis dental','Limpieza dental simple','Limpieza dental profunda','Aplicación de flúor','Sellantes dentales','Control de placa bacteriana','Pulido dental','Educación de higiene oral','Control preventivo infantil','Mantenimiento periodontal','Desensibilización dental','Aplicación de barniz de flúor'] },
  { cat:'Restauraciones', procs:['Restauración con resina','Restauración con ionómero de vidrio','Restauración con amalgama','Reconstrucción dental','Restauración temporal','Cambio de restauración','Reparación de fractura dental','Incrustación inlay','Incrustación onlay','Incrustación overlay','Corona provisional','Corona definitiva','Cementación de corona','Recementado de corona','Poste dental','Núcleo dental'] },
  { cat:'Endodoncia', procs:['Endodoncia unirradicular','Endodoncia birradicular','Endodoncia multirradicular','Retratamiento endodóntico','Apertura cameral','Pulpotomía','Pulpectomía','Apicectomía','Drenaje de absceso','Medicación intraconducto','Obturación de conducto','Control postendodoncia','Restauración postendodoncia'] },
  { cat:'Periodoncia', procs:['Raspado y alisado radicular','Curetaje periodontal','Gingivectomía','Gingivoplastia','Cirugía periodontal','Injerto de encía','Injerto óseo','Regeneración tisular guiada','Alargamiento de corona','Tratamiento de recesión gingival','Tratamiento de bolsas periodontales','Mantenimiento periodontal','Ferulización dental','Control de movilidad dental'] },
  { cat:'Cirugía oral', procs:['Extracción simple','Extracción quirúrgica','Extracción de cordales','Extracción de dientes retenidos','Alveoloplastia','Frenectomía','Biopsia oral','Drenaje de absceso oral','Cirugía de quiste oral','Regularización de reborde óseo','Sutura','Retiro de sutura','Control postquirúrgico','Tratamiento de alveolitis'] },
  { cat:'Ortodoncia', procs:['Consulta ortodóntica','Estudio de ortodoncia','Toma de modelos','Análisis cefalométrico','Colocación de brackets metálicos','Colocación de brackets estéticos','Colocación de brackets autoligables','Alineadores invisibles','Activación de ortodoncia','Cambio de ligas','Reposición de bracket','Retiro de brackets','Limpieza postortodoncia','Retenedores fijos','Retenedores removibles','Expansor palatino','Mantenedor de espacio'] },
  { cat:'Prótesis dental', procs:['Corona dental','Puente fijo','Prótesis parcial removible','Prótesis total','Prótesis flexible','Prótesis inmediata','Prótesis sobre implantes','Reparación de prótesis','Ajuste de prótesis','Rebase de prótesis','Toma de impresión','Prueba de estructura','Prueba estética','Instalación de prótesis','Control de prótesis'] },
  { cat:'Implantología', procs:['Evaluación para implante','Planificación quirúrgica de implante','Colocación de implante dental','Colocación de pilar de cicatrización','Corona sobre implante','Prótesis sobre implante','Injerto óseo para implante','Elevación de seno maxilar','Regeneración ósea guiada','Mantenimiento de implante','Tratamiento de periimplantitis','Control radiográfico de implante'] },
  { cat:'Estética dental', procs:['Blanqueamiento dental','Blanqueamiento en clínica','Blanqueamiento ambulatorio','Carillas de resina','Carillas de porcelana','Diseño de sonrisa','Contorneado dental','Cierre de diastemas','Microabrasión dental','Gingivoplastia estética','Restauración estética anterior','Cambio de color dental'] },
  { cat:'Odontopediatría', procs:['Consulta odontopediátrica','Profilaxis infantil','Aplicación de flúor infantil','Sellantes infantiles','Restauración en diente temporal','Pulpotomía pediátrica','Pulpectomía pediátrica','Corona pediátrica','Extracción infantil','Mantenedor de espacio','Control de erupción dental','Manejo de caries temprana','Educación a padres','Evaluación de hábitos orales','Tratamiento por succión digital'] },
  { cat:'Urgencias odontológicas', procs:['Dolor dental agudo','Absceso dental','Fractura dental','Avulsión dental','Luxación dental','Sangrado postextracción','Inflamación facial','Alveolitis','Corona desprendida','Prótesis fracturada','Bracket desprendido','Dolor postoperatorio','Infección dental'] },
  { cat:'Medicina oral', procs:['Evaluación de lesiones orales','Diagnóstico de aftas','Diagnóstico de candidiasis oral','Diagnóstico de herpes oral','Evaluación de manchas blancas','Evaluación de manchas rojas','Evaluación de úlceras','Evaluación de lesiones premalignas','Biopsia oral','Control de xerostomía','Tratamiento de halitosis','Control de lesiones por prótesis','Evaluación de cáncer oral'] },
  { cat:'ATM y bruxismo', procs:['Evaluación de ATM','Diagnóstico de bruxismo','Férula de descarga','Protector nocturno','Ajuste oclusal','Terapia oclusal','Control de dolor mandibular','Control de chasquidos articulares','Evaluación muscular facial','Control de desgaste dental','Protector deportivo'] },
];

// Lámina clásica: azul = tratamiento realizado, rojo = patología presente
const ODO_INK = { azul:'#1d4ed8', rojo:'#dc2626' };
const ESTADOS_DIENTE = [
  { key:'sano',         code:'',      label:'Sano',                              ink:null,   color:'#ffffff', border:'#9ca3af', text:'#374151' },
  { key:'obturado',     code:'Do',    label:'Diente obturado',                   ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'caries',       code:'C',     label:'Cariado',                           ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'ausente',      code:'=',     label:'Ausente',                           ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'extraccion',   code:'E',     label:'Exodoncia',                         ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'caries_pen',   code:'CP',    label:'Caries penetrante',                 ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'retenido',     code:'R',     label:'Retenido',                          ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'puente',       code:'PP',    label:'Pieza de puente',                   ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'corona',       code:'Co',    label:'Corona',                            ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'protesis',     code:'PR',    label:'Prótesis removible',                ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'incrustacion', code:'Inc',   label:'Inlay onlay (incrustación)',        ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'enf_perio',    code:'EP',    label:'Enfermedad periodontal',            ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'fractura',     code:'F',     label:'Fractura dentaria',                 ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'malposicion',  code:'MPD',   label:'Mal posición dentaria',             ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'perno',        code:'PM',    label:'Perno muñón',                       ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'trat_cto',     code:'TC',    label:'Tratamiento de cto.',               ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'fluorosis',    code:'Fl',    label:'Fluorosis',                         ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'implante',     code:'Imp',   label:'Implante dental',                   ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'mancha_blanca',code:'MB',    label:'Mancha blanca',                     ink:'rojo', color:'#ef4444', border:'#b91c1c', text:'#fff' },
  { key:'sellador',     code:'Se',    label:'Sellador',                          ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'surco',        code:'SP/SR', label:'Surco profundo o remineralizado',   ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
  { key:'hipoplasia',   code:'Hp',    label:'Hipoplasia de esmalte',             ink:'azul', color:'#2563eb', border:'#1d4ed8', text:'#fff' },
];
// Claves antiguas guardadas en BD → claves actuales
const LEGACY_ESTADO_DIENTE = { sellante:'sellador', tratamiento:'trat_cto' };
const DIENTES_SUP_R = [18,17,16,15,14,13,12,11];
const DIENTES_SUP_L = [21,22,23,24,25,26,27,28];
const DIENTES_INF_R = [48,47,46,45,44,43,42,41];
const DIENTES_INF_L = [31,32,33,34,35,36,37,38];
const TODOS_DIENTES = [...DIENTES_SUP_R,...DIENTES_SUP_L,...DIENTES_INF_L,...DIENTES_INF_R];

// Detectar recovery token lo antes posible
sb.auth.onAuthStateChange((event) => {
  if(event === 'PASSWORD_RECOVERY') {
    document.addEventListener('DOMContentLoaded', () => {
      const el = document.getElementById('recovery-overlay');
      if(el) el.style.display = 'flex';
    }, { once: true });
    const el = document.getElementById('recovery-overlay');
    if(el) el.style.display = 'flex';
  }
});

// Fallback: detectar hash directamente en la URL
window.addEventListener('DOMContentLoaded', () => {
  const hash = new URLSearchParams(window.location.hash.replace('#',''));
  if(hash.get('type') === 'recovery') {
    const el = document.getElementById('recovery-overlay');
    if(el) el.style.display = 'flex';
  }
}, { once: true });

// ════════════════════ CACHE LOCAL ════════════════════
const C = { p:[], c:[], m:[], n:[], e:[], prof:[], inv:[], mov:[], fin:[], fact:[], factItems:[], proc:[], hd:[], odo:[], perio:[] };
let currentClinicaId = null;
let currentClinica   = null;

// ════════════════════ MAPPERS DB ↔ JS ════════════════════
const fromP = r => ({ id:r.id, nombre:r.nombre, apellidos:r.apellidos, identificacion:r.identificacion, fechaNac:r.fecha_nac, sexo:r.sexo, sangre:r.sangre, telefono:r.telefono, email:r.email, direccion:r.direccion, alergias:r.alergias, estado:r.estado||'activo', emergencia:r.emergencia, observaciones:r.observaciones, fechaRegistro:r.fecha_registro, fotoUrl:r.foto_url||null, expediente:r.expediente||null });
const toP   = x => ({ nombre:x.nombre, apellidos:x.apellidos, identificacion:x.identificacion||null, fecha_nac:x.fechaNac||null, sexo:x.sexo||null, sangre:x.sangre||null, telefono:x.telefono||null, email:x.email||null, direccion:x.direccion||null, alergias:x.alergias||null, estado:x.estado||'activo', emergencia:x.emergencia||null, observaciones:x.observaciones||null, fecha_registro:x.fechaRegistro||hoy(), foto_url:x.fotoUrl||null, clinica_id:currentClinicaId });
const fromE = r => ({ id:r.id, pacienteId:r.paciente_id, peso:r.peso, talla:r.talla, presion:r.presion, temperatura:r.temperatura, enfermedadesCronicas:r.enfermedades_cronicas, cirugias:r.cirugias_previas, antecedentesFamiliares:r.antecedentes_familiares, vacunas:r.vacunas, tabaco:r.habito_tabaco||'no', alcohol:r.habito_alcohol||'no', actividadFisica:r.actividad_fisica||'sedentario', ocupacion:r.ocupacion, estadoCivil:r.estado_civil, observacionesMedicas:r.observaciones_medicas });
const toE   = x => ({ paciente_id:x.pacienteId, peso:x.peso?Number(x.peso):null, talla:x.talla?Number(x.talla):null, presion:x.presion||null, temperatura:x.temperatura?Number(x.temperatura):null, enfermedades_cronicas:x.enfermedadesCronicas||null, cirugias_previas:x.cirugias||null, antecedentes_familiares:x.antecedentesFamiliares||null, vacunas:x.vacunas||null, habito_tabaco:x.tabaco||'no', habito_alcohol:x.alcohol||'no', actividad_fisica:x.actividadFisica||'sedentario', ocupacion:x.ocupacion||null, estado_civil:x.estadoCivil||null, observaciones_medicas:x.observacionesMedicas||null, clinica_id:currentClinicaId });
const fromC = r => ({ id:r.id, pacienteId:r.paciente_id, medicoId:r.medico_id||null, fecha:r.fecha, hora:(r.hora||'').slice(0,5), motivo:r.motivo, tipo:r.tipo, estado:r.estado, notas:r.notas });
const toC   = x => ({ paciente_id:x.pacienteId, medico_id:x.medicoId||null, fecha:x.fecha, hora:x.hora, motivo:x.motivo, tipo:x.tipo||'consulta', estado:x.estado||'pendiente', notas:x.notas||null, clinica_id:currentClinicaId });
const fromM = r => ({ id:r.id, pacienteId:r.paciente_id, nombre:r.nombre, dosis:r.dosis, frecuencia:r.frecuencia, inicio:r.inicio, fin:r.fin, via:r.via, estado:r.estado, indicaciones:r.indicaciones });
const toM   = x => ({ paciente_id:x.pacienteId, nombre:x.nombre, dosis:x.dosis, frecuencia:x.frecuencia, inicio:x.inicio||null, fin:x.fin||null, via:x.via||'oral', estado:x.estado||'activa', indicaciones:x.indicaciones||null, clinica_id:currentClinicaId });
const fromN   = r => ({ id:r.id, pacienteId:r.paciente_id, tipo:r.tipo, fecha:r.fecha, titulo:r.titulo, contenido:r.contenido, signos:r.signos||null });
const toN     = x => ({ paciente_id:x.pacienteId, tipo:x.tipo||'evolucion', fecha:x.fecha||hoy(), titulo:x.titulo||null, contenido:x.contenido, signos:x.signos||null, clinica_id:currentClinicaId });
const fromInv = r => ({ id:r.id, nombre:r.nombre, categoria:r.categoria||'general', unidad:r.unidad||'unidad', stock:Number(r.stock_actual||0), stockMin:Number(r.stock_minimo||0), precio:r.precio_unitario!=null?Number(r.precio_unitario):null, descripcion:r.descripcion||null, codigoMinsa:r.codigo_minsa||null, fechaVenc:r.fecha_vencimiento||null, alertaMeses:r.alerta_meses_antes!=null?Number(r.alerta_meses_antes):1 });
const toInv   = x => ({ nombre:x.nombre, categoria:x.categoria||'general', unidad:x.unidad||'unidad', stock_actual:Number(x.stock||0), stock_minimo:Number(x.stockMin||0), precio_unitario:x.precio||null, descripcion:x.descripcion||null, clinica_id:currentClinicaId, codigo_minsa:x.codigoMinsa||null, fecha_vencimiento:x.fechaVenc||null, alerta_meses_antes:Number(x.alertaMeses||1) });
const fromMov     = r => ({ id:r.id, invId:r.inventario_id, tipo:r.tipo, cantidad:Number(r.cantidad), motivo:r.motivo||null, fecha:r.fecha, referencia:r.referencia||null, notas:r.notas||null });
const fromFin     = r => ({ id:r.id, tipo:r.tipo, categoria:r.categoria||'general', descripcion:r.descripcion, monto:Number(r.monto), fecha:r.fecha, metodoPago:r.metodo_pago||'efectivo', referencia:r.referencia||null, citaId:r.cita_id||null, pacienteId:r.paciente_id||null, invMovId:r.inventario_mov_id||null, creadoPor:r.creado_por||null });
const fromProc = r => ({ id:r.id, pacienteId:r.paciente_id, procedimiento:r.procedimiento, categoria:r.categoria, estado:r.estado||'pendiente', fecha:r.fecha, notas:r.notas||null, presupuesto:r.presupuesto!=null?Number(r.presupuesto):null, diente:r.diente||null });
const toProc   = x => ({ paciente_id:x.pacienteId, procedimiento:x.procedimiento, categoria:x.categoria, estado:x.estado||'pendiente', fecha:x.fecha||hoy(), notas:x.notas||null, presupuesto:x.presupuesto||null, diente:x.diente||null, clinica_id:currentClinicaId });
const fromHD   = r => ({ id:r.id, pacienteId:r.paciente_id, motivoConsulta:r.motivo_consulta||'', antecedentesMedicos:r.antecedentes_medicos||'', medicamentosActuales:r.medicamentos_actuales||'', alergiasMedicamentos:r.alergias_medicamentos||'', enfermedadesSistemicas:r.enfermedades_sistemicas||'', ultimaVisitaDental:r.ultima_visita_dental||'', tratamientosPrevios:r.tratamientos_previos||'', habitosOrales:r.habitos_orales||'', higieneOral:r.higiene_oral||'', examenExtraoral:r.examen_extraoral||'', examenTejidosBlandos:r.examen_tejidos_blandos||'', examenOclusion:r.examen_oclusion||'', examenAtm:r.examen_atm||'', diagnosticoPrincipal:r.diagnostico_principal||'', observaciones:r.observaciones||'' });
const toHD     = (x,pid) => ({ paciente_id:pid, motivo_consulta:x.motivoConsulta||null, antecedentes_medicos:x.antecedentesMedicos||null, medicamentos_actuales:x.medicamentosActuales||null, alergias_medicamentos:x.alergiasMedicamentos||null, enfermedades_sistemicas:x.enfermedadesSistemicas||null, ultima_visita_dental:x.ultimaVisitaDental||null, tratamientos_previos:x.tratamientosPrevios||null, habitos_orales:x.habitosOrales||null, higiene_oral:x.higieneOral||null, examen_extraoral:x.examenExtraoral||null, examen_tejidos_blandos:x.examenTejidosBlandos||null, examen_oclusion:x.examenOclusion||null, examen_atm:x.examenAtm||null, diagnostico_principal:x.diagnosticoPrincipal||null, observaciones:x.observaciones||null, clinica_id:currentClinicaId });
const fromOdo  = r => ({ id:r.id, pacienteId:r.paciente_id, dientes:r.dientes||{}, observaciones:r.observaciones||'' });
const fromPerio= r => ({ id:r.id, pacienteId:r.paciente_id, datos:r.datos||{}, observaciones:r.observaciones||'' });

const fromFact    = r => ({ id:r.id, numero:r.numero, pacienteId:r.paciente_id, pacienteNombre:r.paciente_nombre||'Consumidor Final', fecha:r.fecha, estado:r.estado||'pendiente', subtotal:Number(r.subtotal||0), impuestoPct:Number(r.impuesto_pct||0), impuesto:Number(r.impuesto||0), total:Number(r.total||0), notas:r.notas||null, citaId:r.cita_id||null });
const fromFactItem= r => ({ id:r.id, facturaId:r.factura_id, descripcion:r.descripcion, tipo:r.tipo||'servicio', cantidad:Number(r.cantidad||1), precioUnitario:Number(r.precio_unitario||0), subtotal:Number(r.subtotal||0), inventarioId:r.inventario_id||null });

// ════════════════════ LOAD DATA ════════════════════
async function loadAll() {
  if(!currentClinicaId) { setDbStatus(true); setLoading(false); return; }
  setLoading(true);
  try {
    const [rp,rc,rm,rn,re,rpf,ri,rmov,rfin,rfact] = await Promise.all([
      sb.from('pacientes').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('citas').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('medicaciones').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('notas').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('expediente').select('*').eq('clinica_id', currentClinicaId).order('id'),
      sb.from('profiles').select('id,nombre,rol,email,icono,clinica_id').eq('clinica_id', currentClinicaId),
      sb.from('inventario').select('*').eq('clinica_id', currentClinicaId).order('nombre'),
      sb.from('inventario_movimientos').select('*').eq('clinica_id', currentClinicaId).order('fecha', {ascending:false}).limit(500),
      sb.from('finanzas').select('*').eq('clinica_id', currentClinicaId).order('fecha', {ascending:false}).limit(1000),
      sb.from('facturas').select('*, factura_items(*)').eq('clinica_id', currentClinicaId).order('fecha', {ascending:false}).limit(500)
    ]);
    if(rp.error) throw rp.error;
    if(rc.error) throw rc.error;
    if(rm.error) throw rm.error;
    if(rn.error) throw rn.error;
    C.p = (rp.data||[]).map(fromP);
    C.c = (rc.data||[]).map(fromC);
    C.m = (rm.data||[]).map(fromM);
    C.n = (rn.data||[]).map(fromN);
    C.e = re.error ? [] : (re.data||[]).map(fromE);
    C.prof = rpf.error ? [] : (rpf.data||[]);
    C.inv = ri.error ? [] : (ri.data||[]).map(fromInv);
    C.mov = rmov.error ? [] : (rmov.data||[]).map(fromMov);
    C.fin = rfin.error ? [] : (rfin.data||[]).map(fromFin);
    const rawFact = rfact.error ? [] : (rfact.data||[]);
    C.fact = rawFact.map(r => fromFact(r));
    C.factItems = rawFact.flatMap(r => (r.factura_items||[]).map(fromFactItem));
    // Tablas odontológicas (carga separada: tablas opcionales)
    if(isOdontologo() || isSuperAdmin()) {
      const [rproc, rhd, rodo, rperio] = await Promise.all([
        sb.from('procedimientos_odontologicos').select('*').eq('clinica_id', currentClinicaId).order('fecha', {ascending:false}),
        sb.from('historial_dental').select('*').eq('clinica_id', currentClinicaId),
        sb.from('odontograma').select('*').eq('clinica_id', currentClinicaId),
        sb.from('periodontograma').select('*').eq('clinica_id', currentClinicaId),
      ]);
      C.proc  = rproc.error  ? [] : (rproc.data||[]).map(fromProc);
      C.hd    = rhd.error    ? [] : (rhd.data||[]).map(fromHD);
      C.odo   = rodo.error   ? [] : (rodo.data||[]).map(fromOdo);
      C.perio = rperio.error ? [] : (rperio.data||[]).map(fromPerio);
    } else {
      C.proc = []; C.hd = []; C.odo = []; C.perio = [];
    }
    setDbStatus(true);
    // Notify once per session about expiring/expired products
    if(!_vencAlertShown) {
      _vencAlertShown = true;
      const venc = (C.inv||[]).filter(p => p.fechaVenc && _invVencStatus(p) !== 'ok' && _invVencStatus(p) !== null);
      if(venc.length) {
        const exp = venc.filter(p=>_invVencStatus(p)==='vencido').length;
        const prox = venc.filter(p=>_invVencStatus(p)==='alerta').length;
        const msg = [exp?`${exp} producto${exp!==1?'s':''} vencido${exp!==1?'s':''}`:'', prox?`${prox} próximo${prox!==1?'s':''} a vencer`:''].filter(Boolean).join(' · ');
        setTimeout(()=>toast(`⚠️ Inventario: ${msg}`, 'warning'), 800);
      }
    }
  } catch(e) {
    console.error('Supabase:', e);
    setDbStatus(false);
    toast('Error conectando con la base de datos','error');
  }
  setLoading(false);
}

function setLoading(on) {
  const el = document.getElementById('loading-overlay');
  el.classList.toggle('show', on);
  // El modo boot (pantalla de marca) solo dura hasta que termina la primera carga;
  // después las operaciones internas usan el spinner ligero
  if(!on) el.classList.remove('boot');
}
function setDbStatus(ok) {
  document.getElementById('db-dot').className = 'db-dot' + (ok?' connected':'');
  document.getElementById('db-label').textContent = ok ? 'Supabase conectado' : 'Sin conexión';
}

// ════════════════════ AUTH ════════════════════
let currentUser = null;
let selectedEmail = '';
let _authEmail = ''; // email capturado en login o desde Supabase Auth

async function verificarLogin() {
  const email = document.getElementById('login-email').value.trim();
  _authEmail = email.toLowerCase();
  const password = document.getElementById('login-password').value;
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  if(!email || !password) {
    errEl.textContent = 'Ingresa tu email y contraseña';
    errEl.style.display = 'block';
    return;
  }
  // Al entrar a la app se muestra la pantalla de marca completa
  document.getElementById('loading-overlay').classList.add('boot');
  setLoading(true);

  // ── PASO 0: verificar si la cuenta está bloqueada (el Super Admin nunca se bloquea) ──
  const esSuperAdminEmail = email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const { data: profilePre } = await sb.from('profiles').select('id,bloqueado,intentos_fallidos').eq('email', email.toLowerCase()).maybeSingle();
  if(profilePre?.bloqueado && !esSuperAdminEmail) {
    setLoading(false);
    shakeLogin();
    errEl.innerHTML = '🔒 Tu cuenta está <strong>bloqueada</strong> por demasiados intentos fallidos.<br><small>Contacta al Super Admin para que la desbloquee.</small>';
    errEl.style.display = 'block';
    document.getElementById('login-password').value = '';
    return;
  }

  // ── PASO 1: login directo en Supabase Auth ──
  const { data: authData } = await sb.auth.signInWithPassword({ email, password });
  if(authData?.user) {
    const profile = await resolverPerfil(authData.user.id, email);
    if(profile) { await entrarConPerfil(profile); return; }
    await sb.auth.signOut();
  }

  // ── PASO 2: usuario no está en Auth → intentar registrarlo (auto-migración) ──
  // Funciona cuando "Confirm email" está desactivado en Supabase
  const { data: signUpData, error: signUpErr } = await sb.auth.signUp({ email, password });
  if(!signUpErr && signUpData?.user) {
    // Si hay sesión activa el usuario quedó confirmado automáticamente
    if(signUpData.session || signUpData.user.confirmed_at || signUpData.user.email_confirmed_at) {
      // Intentar login inmediato post-registro
      const { data: retryAuth } = await sb.auth.signInWithPassword({ email, password });
      if(retryAuth?.user) {
        const profile = await resolverPerfil(retryAuth.user.id, email);
        if(profile) { await entrarConPerfil(profile); return; }
        await sb.auth.signOut();
      }
    } else {
      // Necesita confirmar correo — no podemos continuar automáticamente
      setLoading(false);
      shakeLogin();
      errEl.innerHTML = 'Cuenta pendiente de confirmación de correo.<br><small>Revisa <strong>' + email + '</strong> o pide al administrador que confirme tu cuenta en el panel de Supabase.</small>';
      errEl.style.display = 'block';
      return;
    }
  }

  // ── PASO 3: fallback legacy (profiles con password en texto plano) ──
  const { data: legacy } = await sb.from('profiles').select('*').eq('email', email).eq('password', password).maybeSingle();
  if(legacy) {
    // Auto-registrar en Auth para futuras sesiones
    const { data: migrAuth } = await sb.auth.signInWithPassword({ email, password });
    if(migrAuth?.user) {
      await sb.from('profiles').update({ id: migrAuth.user.id }).eq('email', email);
      legacy.id = migrAuth.user.id;
    }
    await entrarConPerfil(legacy);
    return;
  }

  // ── Fallo definitivo: incrementar contador de intentos ──
  setLoading(false);
  shakeLogin();
  const { data: profFail } = await sb.from('profiles').select('id,intentos_fallidos').eq('email', email.toLowerCase()).maybeSingle();
  if(profFail && esSuperAdminEmail) {
    // El Super Admin nunca queda bloqueado: solo se le informa el error, sin contar intentos
    errEl.textContent = 'Email o contraseña incorrectos';
  } else if(profFail) {
    const nuevosIntentos = (profFail.intentos_fallidos || 0) + 1;
    const ahorraBloqueado = nuevosIntentos >= 3;
    await sb.from('profiles').update({ intentos_fallidos: nuevosIntentos, bloqueado: ahorraBloqueado }).eq('id', profFail.id);
    if(ahorraBloqueado) {
      errEl.innerHTML = '🔒 Tu cuenta ha sido <strong>bloqueada</strong> tras 3 intentos fallidos.<br><small>Contacta al Super Admin para desbloquearla.</small>';
    } else {
      const restantes = 3 - nuevosIntentos;
      errEl.textContent = `Email o contraseña incorrectos. Te quedan ${restantes} intento${restantes !== 1 ? 's' : ''}.`;
    }
  } else {
    errEl.textContent = 'Email o contraseña incorrectos';
  }
  errEl.style.display = 'block';
  document.getElementById('login-password').value = '';
}

// Busca perfil por Auth UUID; si no lo encuentra por ID, lo busca por email y sincroniza
async function resolverPerfil(authId, email) {
  const { data: p1 } = await sb.from('profiles').select('*').eq('id', authId).maybeSingle();
  if(p1) return p1;
  const { data: p2 } = await sb.from('profiles').select('*').eq('email', email).maybeSingle();
  if(p2) {
    await sb.from('profiles').update({ id: authId }).eq('email', email);
    return { ...p2, id: authId };
  }
  return null;
}

// ════════════════════ INACTIVIDAD ════════════════════
const INAC_TOTAL = 2 * 60 * 1000;   // 2 minutos
const INAC_AVISO  = 30 * 1000;       // aviso 30s antes

let _inacTimer    = null;
let _inacCuenta   = null;
let _inacActivo   = false;

function _inacReset() {
  if(!_inacActivo) return;
  clearTimeout(_inacTimer);
  clearInterval(_inacCuenta);
  const el = document.getElementById('modal-inactividad');
  if(el) el.classList.remove('open');
  _inacTimer = setTimeout(_inacAviso, INAC_TOTAL - INAC_AVISO);
}

function _inacAviso() {
  const overlay = document.getElementById('modal-inactividad');
  const countEl = document.getElementById('inactividad-count');
  if(!overlay) { autoLogout(); return; }
  overlay.classList.add('open');
  let secs = 30;
  if(countEl) countEl.textContent = secs;
  _inacCuenta = setInterval(() => {
    secs--;
    if(countEl) countEl.textContent = secs;
    if(secs <= 0) { clearInterval(_inacCuenta); autoLogout(); }
  }, 1000);
}

function iniciarInactividad() {
  _inacActivo = true;
  ['click','mousemove','keydown','touchstart','scroll'].forEach(e =>
    document.addEventListener(e, _inacReset, { passive: true }));
  _inacReset();
}

function detenerInactividad() {
  _inacActivo = false;
  clearTimeout(_inacTimer);
  clearInterval(_inacCuenta);
  ['click','mousemove','keydown','touchstart','scroll'].forEach(e =>
    document.removeEventListener(e, _inacReset));
  const el = document.getElementById('modal-inactividad');
  if(el) el.classList.remove('open');
}

function continuarSesion() {
  clearInterval(_inacCuenta);
  const el = document.getElementById('modal-inactividad');
  if(el) el.classList.remove('open');
  _inacReset();
}

function _draftsKey() { return 'lm_pendientes_' + (currentClinicaId || 'gen'); }

function guardarBorradoresSesion() {
  const drafts = [];
  const modalCita = document.getElementById('modal-cita');
  const modalMed  = document.getElementById('modal-medicacion');
  const modalNota = document.getElementById('modal-nota');
  const modalPac  = document.getElementById('modal-paciente');

  if(modalCita?.classList.contains('open')) {
    const motivo = document.getElementById('c-motivo')?.value?.trim();
    const fecha  = document.getElementById('c-fecha')?.value;
    const pid    = document.getElementById('c-paciente')?.value;
    if(motivo || fecha) {
      const p = pid ? C.p.find(x=>x.id==pid) : null;
      drafts.push({ id: Date.now()+1, modulo:'cita', titulo:'Cita pendiente'+(p?` — ${p.nombre} ${p.apellidos}`:''),
        icono:'📅', data:{ pacienteId:pid||null, fecha, hora:document.getElementById('c-hora')?.value,
        motivo, tipo:document.getElementById('c-tipo')?.value, estado:'pendiente',
        notas:document.getElementById('c-notas')?.value }});
    }
  }

  if(modalMed?.classList.contains('open')) {
    const pid   = document.getElementById('m-paciente')?.value;
    const items = (typeof medItems!=='undefined' ? medItems : []).filter(m => m.nombre);
    if(items.length) {
      const p = pid ? C.p.find(x=>x.id==pid) : null;
      drafts.push({ id: Date.now()+2, modulo:'medicacion', titulo:'Medicación pendiente'+(p?` — ${p.nombre} ${p.apellidos}`:''),
        icono:'💊', data:{ pacienteId:pid||null, items,
        inicio:document.getElementById('m-inicio')?.value, fin:document.getElementById('m-fin')?.value,
        estado:document.getElementById('m-estado')?.value }});
    }
  }

  if(modalNota?.classList.contains('open')) {
    const contenido = document.getElementById('n-contenido')?.value?.trim();
    const pid       = document.getElementById('n-paciente')?.value;
    if(contenido) {
      const p = pid ? C.p.find(x=>x.id==pid) : null;
      drafts.push({ id: Date.now()+3, modulo:'nota', titulo:'Nota clínica pendiente'+(p?` — ${p.nombre} ${p.apellidos}`:''),
        icono:'📝', data:{ pacienteId:pid||null, tipo:document.getElementById('n-tipo')?.value,
        tituloNota:document.getElementById('n-titulo')?.value, contenido }});
    }
  }

  if(modalPac?.classList.contains('open')) {
    const nombre    = document.getElementById('p-nombre')?.value?.trim();
    const apellidos = document.getElementById('p-apellidos')?.value?.trim();
    if(nombre) {
      drafts.push({ id: Date.now()+4, modulo:'paciente', titulo:'Registro de paciente pendiente'+(apellidos?` — ${nombre} ${apellidos}`:` — ${nombre}`),
        icono:'👤', data:{ nombre, apellidos, identificacion:document.getElementById('p-id')?.value,
        telefono:document.getElementById('p-telefono')?.value }});
    }
  }

  if(drafts.length) {
    const key  = _draftsKey();
    const prev = JSON.parse(localStorage.getItem(key) || '[]');
    const ts   = new Date().toLocaleString('es-ES');
    localStorage.setItem(key, JSON.stringify([...prev, ...drafts.map(d => ({...d, ts, usuario: currentUser?.name }))]));
  }
  return drafts.length;
}

async function autoLogout() {
  detenerInactividad();
  const guardados = guardarBorradoresSesion();
  await sb.auth.signOut();
  currentUser = null; currentClinicaId = null;
  const app = document.getElementById('app');
  app.style.transition = 'opacity .3s';
  app.style.opacity = '0';
  setTimeout(() => {
    app.classList.remove('visible');
    app.style.opacity = '';
    const ls = document.getElementById('login-screen');
    ls.style.cssText = 'display:flex;opacity:0;transform:scale(.95);transition:opacity .4s,transform .4s';
    setTimeout(() => { ls.style.opacity='1'; ls.style.transform='none'; }, 10);
    cargarUsuariosLogin();
    if(guardados) toast(`Sesión cerrada por inactividad · ${guardados} elemento${guardados>1?'s':''} guardado${guardados>1?'s':''} como pendiente${guardados>1?'s':''}`, 'warning');
    else toast('Sesión cerrada por inactividad', 'warning');
  }, 300);
}

function renderPendientesSesion() {
  const key    = _draftsKey();
  const drafts = JSON.parse(localStorage.getItem(key) || '[]');
  const el     = document.getElementById('panel-pendientes-sesion');
  if(!el) return;
  if(!drafts.length) { el.style.display = 'none'; return; }
  el.style.display = 'block';
  el.innerHTML = `
    <div class="card" style="border:2px solid var(--warning);background:linear-gradient(135deg,#FFFBEB,#FEF3C7)">
      <div class="card-header" style="border-bottom:1px solid #FDE68A;padding-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:22px">⏳</span>
          <div>
            <h3 style="color:#92400E;margin:0">Pendientes de finalización</h3>
            <p style="font-size:12px;color:#B45309;margin:0">${drafts.length} elemento${drafts.length>1?'s':''} guardado${drafts.length>1?'s':''} al cerrar la sesión anterior</p>
          </div>
        </div>
        <button class="btn btn-sm" style="background:#FEF3C7;color:#92400E;border:1px solid #FDE68A" onclick="limpiarPendientesSesion()">✕ Descartar todos</button>
      </div>
      <div style="padding-top:12px;display:flex;flex-direction:column;gap:8px">
        ${drafts.map((d,i) => `
          <div style="display:flex;align-items:center;gap:12px;background:#fff;border:1px solid #FDE68A;border-radius:10px;padding:12px 14px">
            <span style="font-size:20px;flex-shrink:0">${d.icono||'📋'}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:13px;color:#0F172A">${d.titulo}</div>
              <div style="font-size:11px;color:#B45309;margin-top:2px">Guardado: ${d.ts||''} · Por: ${d.usuario||''}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-sm btn-primary" onclick="recuperarDraft(${i})">♻️ Recuperar</button>
              <button class="btn btn-sm btn-secondary" onclick="descartarDraft(${i})">✕</button>
            </div>
          </div>`).join('')}
      </div>
    </div>`;
}

function recuperarDraft(idx) {
  const key    = _draftsKey();
  const drafts = JSON.parse(localStorage.getItem(key) || '[]');
  const d      = drafts[idx];
  if(!d) return;
  if(d.modulo === 'cita') {
    openModalCita();
    setTimeout(() => {
      if(d.data.pacienteId) setPacienteSelect('c-paciente', d.data.pacienteId);
      if(d.data.fecha && d.data.fecha >= hoy()) document.getElementById('c-fecha').value = d.data.fecha;
      if(d.data.hora)    fillHoraSelect(d.data.hora);
      if(d.data.motivo)  document.getElementById('c-motivo').value  = d.data.motivo;
      if(d.data.tipo)    document.getElementById('c-tipo').value    = d.data.tipo;
      if(d.data.notas)   document.getElementById('c-notas').value   = d.data.notas;
    }, 80);
  } else if(d.modulo === 'medicacion') {
    openModalMedicacion();
    setTimeout(() => {
      if(d.data.pacienteId) setPacienteSelect('m-paciente', d.data.pacienteId);
      if(d.data.items) { medItems = d.data.items; renderMedItems(); }
      if(d.data.inicio) document.getElementById('m-inicio').value = d.data.inicio;
      if(d.data.fin)    document.getElementById('m-fin').value    = d.data.fin;
      if(d.data.estado) document.getElementById('m-estado').value = d.data.estado;
    }, 80);
  } else if(d.modulo === 'nota') {
    openModalNota();
    setTimeout(() => {
      if(d.data.pacienteId) setPacienteSelect('n-paciente', d.data.pacienteId);
      if(d.data.tipo)      document.getElementById('n-tipo').value     = d.data.tipo;
      if(d.data.tituloNota)document.getElementById('n-titulo').value   = d.data.tituloNota;
      if(d.data.contenido) document.getElementById('n-contenido').value= d.data.contenido;
    }, 80);
  } else if(d.modulo === 'paciente') {
    openModalPaciente();
    setTimeout(() => {
      if(d.data.nombre)       document.getElementById('p-nombre').value    = d.data.nombre;
      if(d.data.apellidos)    document.getElementById('p-apellidos').value  = d.data.apellidos;
      if(d.data.identificacion) document.getElementById('p-id').value      = d.data.identificacion;
      if(d.data.telefono)     document.getElementById('p-telefono').value   = d.data.telefono;
    }, 80);
  }
  descartarDraft(idx);
}

function descartarDraft(idx) {
  const key    = _draftsKey();
  const drafts = JSON.parse(localStorage.getItem(key) || '[]');
  drafts.splice(idx, 1);
  localStorage.setItem(key, JSON.stringify(drafts));
  renderPendientesSesion();
}

function limpiarPendientesSesion() {
  localStorage.removeItem(_draftsKey());
  renderPendientesSesion();
}

async function entrarConPerfil(profile) {
  const rolLabel = {admin:'Administración',medico:'Médico',medico_admin:'Médico Adm.',recepcion:'Recepcionista',enfermeria:'Enfermería',superadmin:'Super Admin',farmaceutico:'Farmacéutico',odontologo:'Odontólogo'}[profile.rol]||profile.rol;
  currentClinicaId = profile.clinica_id || null;
  // Obtener email desde todas las fuentes disponibles
  let emailFinal = (profile.email || '').trim().toLowerCase() || null;
  if(!emailFinal) {
    try {
      const { data: { user: authUser } } = await sb.auth.getUser();
      emailFinal = authUser?.email?.trim().toLowerCase() || null;
    } catch(e) {}
  }
  if(!emailFinal && _authEmail) emailFinal = _authEmail; // fallback: email del formulario
  if(emailFinal) _authEmail = emailFinal; // sincronizar siempre
  currentUser = {
    id:       profile.id,
    name:     profile.nombre,
    nombre:   profile.nombre,
    role:     rolLabel,
    avatar:   profile.icono || profile.nombre[0].toUpperCase(),
    email:    emailFinal,
    key:      profile.rol,
    especialidad: profile.especialidad || null,
    firmaUrl: profile.firma_url || null,
    // null = nunca se configuraron (usuario antiguo) → se usa el defecto por rol.
    // [] o lista = configurados por el administrador → se respetan tal cual.
    permisos: Array.isArray(profile.permisos) ? profile.permisos : null
  };
  // Resetear bloqueo en login exitoso (fire-and-forget)
  if(profile.id) sb.from('profiles').update({ intentos_fallidos: 0, bloqueado: false }).eq('id', profile.id);

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').classList.add('visible');
  document.getElementById('sf-name').textContent = currentUser.name;
  document.getElementById('sf-role').textContent = currentUser.role;
  document.getElementById('sf-avatar').textContent = currentUser.avatar;
  applyRoleMenu();
  setLoading(true);
  const {data:clData} = await sb.from('clinicas').select('*').eq('id',currentClinicaId).single();
  currentClinica = clData || null;
  await loadAll();
  setLoading(false);
  const lastView = localStorage.getItem('lm_last_view');
  const esFarmaClinica = currentClinica?.tipo === 'farmacia';
  const defaultView = (currentUser?.key === 'farmaceutico' || esFarmaClinica) ? 'farmacia' : 'dashboard';
  const targetView = lastView && lastView !== 'paciente-detalle' ? lastView : defaultView;
  navigate(targetView);
  toast(`Bienvenido, ${currentUser.name} 👋`, 'info');
  logActivity('login');
  iniciarInactividad();
}

async function checkSession() {}

async function doLogout() {
  const ok = await customConfirm({icon:'👋',title:'¿Cerrar sesión?',msg:`Vas a salir de la sesión de <strong>${currentUser?.nombre||'usuario'}</strong>`,okText:'Cerrar sesión',cancelText:'Quedarse',danger:false});
  if(!ok) return;
  detenerInactividad();
  await sb.auth.signOut();
  currentUser = null; currentClinicaId = null;
  const app = document.getElementById('app');
  app.style.transition = 'opacity .3s';
  app.style.opacity = '0';
  setTimeout(() => {
    app.classList.remove('visible');
    app.style.opacity = '';
    const ls = document.getElementById('login-screen');
    ls.style.cssText = 'display:flex;opacity:0;transform:scale(.95);transition:opacity .4s,transform .4s';
    setTimeout(() => { ls.style.opacity='1'; ls.style.transform='none'; }, 10);
    cargarUsuariosLogin();
  }, 300);
}

function toggleTheme() {
  const dark = document.body.classList.toggle('dark');
  document.getElementById('theme-icon').textContent = dark ? '🌙' : '☀️';
  localStorage.setItem('lm_theme', dark ? 'dark' : 'light');
}

function shakeLogin() {
  const card = document.querySelector('.login-card');
  const seq = [8,-8,6,-6,4,-4,0]; let i=0;
  const t = setInterval(() => { card.style.transform=`translateX(${seq[i]}px)`; i++; if(i>=seq.length) clearInterval(t); }, 60);
}

// ════════════════════ UTILS ════════════════════
function hoy() { return new Date().toISOString().split('T')[0]; }
function escAttr(s) { return String(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function formatFecha(f) {
  if(!f) return '—';
  const d = new Date(f+'T12:00:00');
  return d.toLocaleDateString('es-ES',{day:'2-digit',month:'short',year:'numeric'});
}
function calcEdad(fn) {
  if(!fn) return '—';
  const h=new Date(), n=new Date(fn); let e=h.getFullYear()-n.getFullYear();
  if(h.getMonth()<n.getMonth()||(h.getMonth()===n.getMonth()&&h.getDate()<n.getDate()))e--;
  return e+' años';
}
function _getEdadNum(fn) {
  if(!fn) return null;
  const h=new Date(), n=new Date(fn); let e=h.getFullYear()-n.getFullYear();
  if(h.getMonth()<n.getMonth()||(h.getMonth()===n.getMonth()&&h.getDate()<n.getDate()))e--;
  return e;
}
function ini(a,b){ return ((a||'')[0]||'').toUpperCase()+((b||'')[0]||'').toUpperCase(); }
function colAvatar(id) { const c=['#2563EB','#06B6D4','#10B981','#F59E0B','#8B5CF6','#EF4444','#0891B2','#4F46E5']; return c[id%c.length]; }
function estadoTag(e) {
  const m={activo:'tag-green',inactivo:'tag-gray',pendiente:'tag-orange',confirmada:'tag-cyan',completada:'tag-green',cancelada:'tag-red',activa:'tag-green',finalizada:'tag-gray',suspendida:'tag-red'};
  return `<span class="tag ${m[e]||'tag-gray'}">${e}</span>`;
}
function toast(msg, type='success') {
  const icons = {success:'✅',error:'❌',info:'ℹ️',warning:'⚠️'};
  const c = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.innerHTML = `<span class="t-icon">${icons[type]||'ℹ️'}</span><span class="t-msg">${msg}</span><button class="t-close" onclick="this.closest('.toast').remove()">✕</button><div class="t-bar"></div>`;
  c.appendChild(t);
  setTimeout(() => t.remove(), 3800);
}

let _confirmResolve = null;
function customConfirm({icon='⚠️', title, msg, okText='Confirmar', cancelText='Cancelar', danger=true}) {
  return new Promise(resolve => {
    _confirmResolve = resolve;
    document.getElementById('mc-icon').textContent   = icon;
    document.getElementById('mc-title').textContent  = title;
    document.getElementById('mc-msg').innerHTML      = msg;
    document.getElementById('mc-cancel').textContent = cancelText;
    const ok = document.getElementById('mc-ok');
    ok.textContent = okText;
    ok.className   = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
    document.getElementById('modal-confirm').classList.add('open');
  });
}
function _confirmOk()     { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) { _confirmResolve(true);  _confirmResolve=null; } }
function _confirmCancel() { document.getElementById('modal-confirm').classList.remove('open'); if(_confirmResolve) { _confirmResolve(false); _confirmResolve=null; } }

// ════════════════════ NAVIGATION ════════════════════
let currentView='dashboard', editingId=null, editingCitaId=null, editingMedId=null, editingNotaId=null, currentPatientId=null, selCalDate=hoy(), currentResumenCitaId=null, currentNotaId=null;

async function navigate(view, patientId) {
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.menu-item').forEach(m=>m.classList.remove('active'));
  const el=document.getElementById('view-'+(view==='paciente-detalle'?'paciente-detalle':view));
  if(el) el.classList.add('active');
  const mi=document.querySelector(`.menu-item[onclick*="'${view}'"]`);
  if(mi) mi.classList.add('active');
  const titles={dashboard:'Dashboard',expedientes:'Expedientes Clínicos',pacientes:'Pacientes',citas:'Citas',agendas:'Agendas',medicaciones:'Medicaciones',notas:'Notas Clínicas',atendidos:'Atendidos por Día',estadisticas:'Estadísticas',configuracion:'Configuración Clínica',exportar:'Exportar / Enviar','paciente-detalle':'Expediente del Paciente',admin:'Administración',inventario:'Inventario',finanzas:'Finanzas',procedimientos:'Procedimientos Odontológicos'};
  document.getElementById('page-title').textContent = titles[view]||view;
  currentView=view;
  if(patientId) currentPatientId=patientId;
  // Guardar vista actual para restaurarla al recargar
  if(currentUser) localStorage.setItem('lm_last_view', view);
  const sa   = isSuperAdmin();
  const role = currentUser?.key;
  const esFarmacia = currentClinica?.tipo === 'farmacia';
  const farmaAccess = sa || role === 'farmaceutico' || esFarmacia;
  // Guards por permiso
  if(view==='finanzas'     && !hasPermiso('finanzas'))     { navigate('dashboard'); return; }
  if(view==='inventario'   && !hasPermiso('inventario'))   { navigate('dashboard'); return; }
  if(view==='estadisticas' && !hasPermiso('estadisticas')) { navigate('dashboard'); return; }
  if(view==='exportar'     && !hasPermiso('exportar'))     { navigate('dashboard'); return; }
  if(view==='configuracion' && !sa)                        { navigate('dashboard'); return; }
  if(view==='admin'        && !sa)                         { navigate('dashboard'); return; }
  if(view==='farmacia'     && !farmaAccess)                { navigate('dashboard'); return; }
  if(view==='citas'        && !hasPermiso('citas'))        { navigate('dashboard'); return; }
  if(view==='agendas'      && !hasPermiso('agendas'))      { navigate('dashboard'); return; }
  if(view==='medicaciones' && !hasPermiso('medicaciones')) { navigate('dashboard'); return; }
  if(view==='notas'        && !hasPermiso('notas'))        { navigate('dashboard'); return; }
  if(view==='atendidos'    && !hasPermiso('atendidos'))    { navigate('dashboard'); return; }
  if(view==='pacientes' && (role==='farmaceutico' || esFarmacia)) { navigate('farmacia'); return; }
  if(view==='expedientes' && (role==='farmaceutico' || esFarmacia)) { navigate('farmacia'); return; }
  if(view==='procedimientos' && !isOdontologo() && !isSuperAdmin()) { navigate('dashboard'); return; }
  // Rutas especiales sin loadAll
  if(view==='finanzas'){
    renderFinanzas(); if(window.innerWidth<=768) closeSidebar(); return;
  }
  if(view==='admin'){
    await loadAdminData();
    switchAdminTab(adminTab||'clinicas');
    if(window.innerWidth<=768) closeSidebar();
    return;
  }
  await loadAll();
  renderView(view);
  if(window.innerWidth<=768) closeSidebar();
}

function renderView(v) {
  switch(v){
    case 'dashboard': renderDashboard(); break;
    case 'expedientes': renderExpedientes(); break;
    case 'pacientes': renderPacientes(); break;
    case 'citas': renderCitas(); break;
    case 'agendas': renderAgendas(); break;
    case 'medicaciones': renderMedicaciones(); break;
    case 'notas': renderNotas(); break;
    case 'atendidos': renderAtendidos(); break;
    case 'estadisticas': renderEstadisticas(); break;
    case 'configuracion': renderConfiguracion(); break;
    case 'exportar': renderExportar(); break;
    case 'inventario': renderInventario(); break;
    case 'farmacia': renderFarmacia(); break;
    case 'paciente-detalle': renderDetalleP(currentPatientId); break;
    case 'procedimientos': renderProcedimientosView(); break;
  }
  updateBadges();
}

function updateBadges() {
  const h=hoy();
  const citasHoy=C.c.filter(x=>x.fecha===h&&x.estado!=='cancelada').length;
  document.getElementById('badge-pacientes').textContent = C.p.length;
  document.getElementById('badge-citas').textContent = citasHoy;
  const bnBadge=document.getElementById('bn-badge-citas');
  if(bnBadge){ bnBadge.textContent=citasHoy; bnBadge.style.display=citasHoy>0?'block':'none'; }
  updateBottomNav(currentView);
}

// ════════════════════ CALENDARIO ════════════════════
function renderCalendar(containerId, interactive) {
  const d=new Date(selCalDate+'T12:00:00'), year=d.getFullYear(), month=d.getMonth();
  const citaCount={};
  C.c.forEach(c=>{ citaCount[c.fecha]=(citaCount[c.fecha]||0)+1; });
  const today2=hoy();
  const first=new Date(year,month,1).getDay(), days=new Date(year,month+1,0).getDate();
  const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dow=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html=`<div class="cal-nav">
    <div class="cal-nav-btns">
      <button class="btn-ghost" onclick="calNav(-1,'${containerId}',${interactive?1:0})">‹</button>
      <button class="btn-ghost" onclick="calNav(0,'${containerId}',${interactive?1:0})" style="font-size:11px;padding:5px 8px">Hoy</button>
      <button class="btn-ghost" onclick="calNav(1,'${containerId}',${interactive?1:0})">›</button>
    </div>
    <h4>${months[month]} <span style="color:var(--text-light);font-weight:500">${year}</span></h4>
  </div>
  <div class="cal-grid">`;
  dow.forEach((dw,i)=>html+=`<div class="cal-dow${i===0||i===6?' weekend-dow':''}">${dw}</div>`);
  for(let i=0;i<first;i++) html+=`<div class="cal-day empty"></div>`;
  for(let i=1;i<=days;i++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dow2=new Date(ds+'T12:00:00').getDay();
    const isToday=ds===today2, isSelected=ds===selCalDate&&!isToday;
    const cnt=citaCount[ds]||0;
    const isWeekend=dow2===0||dow2===6;
    const cls=['cal-day',isToday?'today':isSelected?'selected':'',cnt?'has-event':'',isWeekend&&!isToday&&!isSelected?'weekend':''].filter(Boolean).join(' ');
    const click=interactive?`onclick="selectCalDay('${ds}','${containerId}')"`:'' ;
    const dots=cnt?`<div class="cal-dots">${Array.from({length:Math.min(cnt,3)},()=>`<div class="cal-dot-pip"></div>`).join('')}</div>`:`<div style="height:5px"></div>`;
    html+=`<div class="${cls}" ${click} title="${cnt?cnt+' cita'+(cnt>1?'s':''):''}"><span>${i}</span>${dots}</div>`;
  }
  html+='</div>';
  const el=document.getElementById(containerId);
  if(el) el.innerHTML=html;
}

function calNav(dir,c,inter){
  const d=new Date(selCalDate+'T12:00:00');
  if(dir===0) selCalDate=hoy();
  else d.setMonth(d.getMonth()+dir), selCalDate=d.toISOString().split('T')[0];
  renderCalendar(c,inter);
  if(inter) renderCalDayCitas(selCalDate);
}

function selectCalDay(date,container){
  selCalDate=date;
  renderCalendar(container,true);
  if(container==='citas-cal') renderCalDayCitas(date);
}

function renderCalDayCitas(date){
  const citas=C.c.filter(c=>c.fecha===date).sort((a,b)=>a.hora.localeCompare(b.hora));
  const el=document.getElementById('cal-day-citas');
  if(!el) return;
  if(!citas.length){ el.innerHTML=`<p class="text-light" style="text-align:center;padding:12px">Sin citas el ${formatFecha(date)}</p>`; return; }
  el.innerHTML=`<p style="font-size:11px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">${formatFecha(date)}</p>`+
    citas.map(c=>{
      const p=C.p.find(x=>x.id===c.pacienteId);
      const esCompletada=c.estado==='completada';
      const esCancelada=c.estado==='cancelada';
      return `<div class="cita-item ${c.estado}" style="gap:10px;flex-wrap:wrap">
      <div class="cita-time">${c.hora}</div>
      <div style="flex:1;min-width:0">
        <div class="cita-paciente">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div class="cita-motivo">${c.motivo}${c.tipo?` · <span class="tag tag-cyan" style="font-size:10px">${c.tipo}</span>`:''}</div>
      </div>
      ${esCompletada ? '<span class="acudio-badge">✅ Atendido</span>' : estadoTag(c.estado)}
      <div class="actions-cell" style="gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:var(--primary);color:#fff;font-size:15px;font-weight:800;padding:4px 10px;line-height:1" onclick="openModalCitaP(${c.pacienteId})" title="Nueva cita">+</button>
        ${!esCompletada&&!esCancelada?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;font-size:11px;font-weight:700;white-space:nowrap" onclick="marcarCitaCompletada(${c.id})">✅ Atendido</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})" title="Ver hoja">📄</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button>
      </div>
    </div>`; }).join('');
}

// ════════════════════ ACCESOS RÁPIDOS MOBILE ════════════════════
function renderNavQuickGrid(cv) {
  const el = document.getElementById('nav-quick-grid');
  if(!el) return;
  const sa = isSuperAdmin();
  const all = [
    { view:'pacientes',    icon:'👥', label:'Pacientes',    show: hasPermiso('pacientes') },
    { view:'citas',        icon:'📅', label:'Citas',        show: hasPermiso('citas') },
    { view:'agendas',      icon:'🗓️', label:'Agendas',      show: hasPermiso('agendas') },
    { view:'medicaciones', icon:'💊', label:'Recetas',      show: hasPermiso('medicaciones') },
    { view:'notas',        icon:'📝', label:'Notas',        show: hasPermiso('notas') },
    { view:'atendidos',    icon:'📊', label:'Atendidos',    show: hasPermiso('atendidos') },
    { view:'estadisticas', icon:'📈', label:'Estadísticas', show: hasPermiso('estadisticas') },
    { view:'inventario',   icon:'📦', label:'Inventario',   show: hasPermiso('inventario') },
    { view:'finanzas',     icon:'💰', label:'Finanzas',     show: hasPermiso('finanzas') },
    { view:'exportar',     icon:'📤', label:'Exportar',     show: hasPermiso('exportar') },
    { view:'configuracion',icon:'⚙️', label:'Config.',      show: sa },
  ].filter(x=>x.show);
  el.innerHTML = all.map(x =>
    `<div class="nav-quick-item${cv===x.view?' nq-active':''}" onclick="navigate('${x.view}')">
      <span class="nq-icon">${x.icon}</span>
      <span class="nq-label">${x.label}</span>
    </div>`
  ).join('');
}

// ════════════════════ DASHBOARD ════════════════════
function renderDashboard(){
  renderPendientesSesion();
  renderNavQuickGrid(currentView);
  const modoFarmacia = currentUser?.key === 'farmaceutico' || currentClinica?.tipo === 'farmacia';
  if(modoFarmacia) { renderDashboardFarmacia(); return; }
  if(isSuperAdmin()) { renderDashboardSA(); return; }
  renderDashboardClinica();
}

function renderDashboardSA() {
  const h = hoy();
  const fmtC = v => '$' + Number(v||0).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2});
  const citasHoy      = C.c.filter(c=>c.fecha===h).sort((a,b)=>a.hora.localeCompare(b.hora));
  const pendientes    = C.c.filter(c=>c.estado==='pendiente');
  const completadasH  = citasHoy.filter(c=>c.estado==='completada').length;
  const medsActivas   = C.m.filter(m=>m.estado==='activa').length;
  const ingresosH     = C.fin.filter(f=>f.fecha===h&&f.tipo==='ingreso').reduce((s,f)=>s+Number(f.monto||0),0);
  const egresosH      = C.fin.filter(f=>f.fecha===h&&f.tipo==='egreso').reduce((s,f)=>s+Number(f.monto||0),0);
  const sinStock      = C.inv.filter(p=>p.stock<=0).length;
  const medicos       = C.prof.filter(p=>['medico','medico_admin','admin','recepcion','enfermeria'].includes(p.rol));

  const view = document.getElementById('view-dashboard');
  view.innerHTML = `
  <div id="panel-pendientes-sesion" style="display:none;margin-bottom:10px"></div>
  <div class="sa-dash">

    <!-- KPIs -->
    <div class="sa-kpi-row">
      <div class="sa-kpi" onclick="navigate('pacientes')">
        <span class="sa-kpi-icon">👥</span>
        <div><div class="sa-kpi-val">${C.p.length}</div><div class="sa-kpi-lbl">Pacientes</div></div>
      </div>
      <div class="sa-kpi" onclick="navigate('citas')">
        <span class="sa-kpi-icon">📅</span>
        <div><div class="sa-kpi-val">${citasHoy.length}</div><div class="sa-kpi-lbl">Citas hoy</div>
        <div class="sa-kpi-trend ${completadasH>0?'up':'warn'}">${completadasH} atendidas · ${pendientes.length} pendientes</div></div>
      </div>
      <div class="sa-kpi" onclick="navigate('medicaciones')">
        <span class="sa-kpi-icon">💊</span>
        <div><div class="sa-kpi-val">${medsActivas}</div><div class="sa-kpi-lbl">Meds activas</div></div>
      </div>
      <div class="sa-kpi" onclick="navigate('finanzas')">
        <span class="sa-kpi-icon">💰</span>
        <div><div class="sa-kpi-val" style="font-size:14px">${fmtC(ingresosH)}</div><div class="sa-kpi-lbl">Ingresos hoy</div>
        <div class="sa-kpi-trend ${egresosH>0?'down':'ok'}">${egresosH>0?'−'+fmtC(egresosH)+' gastos':'Sin gastos'}</div></div>
      </div>
      <div class="sa-kpi" onclick="navigate('inventario')">
        <span class="sa-kpi-icon">📦</span>
        <div><div class="sa-kpi-val">${C.inv.length}</div><div class="sa-kpi-lbl">Inventario</div>
        ${sinStock>0?`<div class="sa-kpi-trend down">⚠️ ${sinStock} sin stock</div>`:'<div class="sa-kpi-trend up">✅ OK</div>'}</div>
      </div>
      <div class="sa-kpi" onclick="navigate('notas')">
        <span class="sa-kpi-icon">📝</span>
        <div><div class="sa-kpi-val">${C.n.length}</div><div class="sa-kpi-lbl">Notas clínicas</div></div>
      </div>
    </div>

    <!-- 3 columnas -->
    <div class="sa-cols">

      <!-- COL 1: Agenda del día -->
      <div class="sa-col">
        <div class="sa-panel flex-1">
          <div class="sa-panel-hdr">
            <h4>📅 Agenda de hoy</h4>
            <button class="btn btn-primary btn-sm" onclick="openModalCita()">+ Cita</button>
          </div>
          <div class="sa-panel-body">
            ${citasHoy.length ? citasHoy.map(c=>{
              const p=C.p.find(x=>x.id===c.pacienteId);
              return `<div class="sa-agenda-item" onclick="navigate('paciente-detalle',${c.pacienteId})">
                <div class="sa-agenda-time">${c.hora}</div>
                <div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:30px;height:30px;font-size:11px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
                <div style="flex:1;min-width:0">
                  <div class="sa-agenda-name">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
                  <div class="sa-agenda-sub">${c.motivo} · <span style="color:${c.estado==='completada'?'#15803D':c.estado==='cancelada'?'#e53e3e':'#d69e2e'}">${c.estado}</span></div>
                </div>
                ${c.estado!=='completada'&&c.estado!=='cancelada'?`<button class="btn btn-sm" style="background:var(--success);color:#fff;padding:3px 8px;font-size:11px;flex-shrink:0" onclick="event.stopPropagation();marcarCitaCompletada(${c.id})">✅</button>`:''}
              </div>`;
            }).join('') : `<div class="empty-state" style="padding:32px 0"><div class="empty-icon">📅</div><p>Sin citas hoy</p></div>`}
          </div>
        </div>
      </div>

      <!-- COL 2: Personal + Finanzas -->
      <div class="sa-col">
        <div class="sa-panel flex-half">
          <div class="sa-panel-hdr">
            <h4>👤 Personal hoy</h4>
          </div>
          <div class="sa-panel-body">
            ${medicos.length ? medicos.map(u=>{
              const atend = citasHoy.filter(c=>c.medicoId===u.id&&c.estado==='completada').length;
              const pend  = citasHoy.filter(c=>c.medicoId===u.id&&(c.estado==='pendiente'||c.estado==='confirmada')).length;
              const total = citasHoy.filter(c=>c.medicoId===u.id).length;
              const pct   = total ? Math.round(atend/total*100) : 0;
              const rLabel= {admin:'Admin',medico:'Médico',recepcion:'Recepción',enfermeria:'Enfermería'}[u.rol]||u.rol;
              return `<div class="sa-staff-card">
                <div class="patient-avatar" style="background:${colAvatar(u.id)};width:32px;height:32px;font-size:12px;flex-shrink:0">${ini(u.nombre,'')}</div>
                <div style="flex:1;min-width:0">
                  <div class="sa-staff-name">${u.nombre}</div>
                  <div class="sa-staff-sub">${rLabel} · ${atend} atend. · ${pend} pend.</div>
                  <div class="sa-bar"><div class="sa-bar-fill" style="width:${pct}%"></div></div>
                </div>
                <span style="font-size:11px;font-weight:800;color:var(--primary);flex-shrink:0">${pct}%</span>
              </div>`;
            }).join('') : `<div class="empty-state" style="padding:20px 0"><p style="font-size:12px">Sin personal registrado</p></div>`}
          </div>
        </div>
        <div class="sa-panel flex-half">
          <div class="sa-panel-hdr">
            <h4>💰 Finanzas hoy</h4>
            <button class="btn btn-secondary btn-sm" onclick="navigate('finanzas')">Ver todo</button>
          </div>
          <div class="sa-panel-body">
            <div class="sa-fin-row"><span class="sa-fin-lbl">💵 Ingresos</span><span class="sa-fin-val" style="color:#15803D">${fmtC(ingresosH)}</span></div>
            <div class="sa-fin-row"><span class="sa-fin-lbl">📤 Gastos</span><span class="sa-fin-val" style="color:#e53e3e">${fmtC(egresosH)}</span></div>
            <div class="sa-fin-row" style="background:var(--primary-light)"><span class="sa-fin-lbl" style="color:var(--primary)">📊 Balance</span><span class="sa-fin-val" style="color:var(--primary)">${fmtC(ingresosH-egresosH)}</span></div>
            ${C.inv.filter(p=>p.stock<=0||p.stock<=p.stockMin).slice(0,3).map(p=>`
            <div class="sa-fin-row" style="background:#FEF2F2">
              <span class="sa-fin-lbl" style="color:#e53e3e">⚠️ ${p.nombre.slice(0,18)}</span>
              <span class="sa-fin-val" style="color:#e53e3e">${p.stock<=0?'Sin stock':'Bajo'}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>

      <!-- COL 3: Accesos rápidos + Actividad reciente -->
      <div class="sa-col">
        <div class="sa-panel" style="flex-shrink:0">
          <div class="sa-panel-hdr"><h4>⚡ Accesos rápidos</h4></div>
          <div class="sa-quick-grid">
            ${[
              {icon:'👥',lbl:'Pacientes',v:'pacientes'},
              {icon:'📅',lbl:'Citas',v:'citas'},
              {icon:'💊',lbl:'Recetas',v:'medicaciones'},
              {icon:'📝',lbl:'Notas',v:'notas'},
              {icon:'📦',lbl:'Inventario',v:'inventario'},
              {icon:'💰',lbl:'Finanzas',v:'finanzas'},
              {icon:'📈',lbl:'Estadísticas',v:'estadisticas'},
              {icon:'📤',lbl:'Exportar',v:'exportar'},
              {icon:'👑',lbl:'Admin',v:'admin'},
            ].map(x=>`<div class="sa-quick-btn" onclick="navigate('${x.v}')"><span>${x.icon}</span><span>${x.lbl}</span></div>`).join('')}
          </div>
        </div>
        <div class="sa-panel flex-1">
          <div class="sa-panel-hdr"><h4>🕐 Actividad reciente</h4></div>
          <div class="sa-panel-body">
            ${[...C.p].reverse().slice(0,8).map(p=>`
            <div class="sa-rec-item" onclick="navigate('paciente-detalle',${p.id})">
              <div class="patient-avatar" style="background:${colAvatar(p.id)};width:28px;height:28px;font-size:10px;flex-shrink:0">${ini(p.nombre,p.apellidos)}</div>
              <div style="flex:1;min-width:0">
                <div class="sa-rec-name">${p.nombre} ${p.apellidos}</div>
                <div class="sa-rec-sub">${formatFecha(p.fechaRegistro)}</div>
              </div>
              <span class="tag ${p.estado==='activo'?'tag-green':'tag-gray'}" style="font-size:10px;flex-shrink:0">${p.estado}</span>
            </div>`).join('')}
          </div>
        </div>
      </div>

    </div>
  </div>`;
  renderPendientesSesion();
}

function renderDashboardClinica(){
  const h=hoy();
  const pendientes=C.c.filter(c=>c.estado==='pendiente');
  document.getElementById('stat-pacientes').textContent=C.p.length;
  document.getElementById('stat-citas-hoy').textContent=C.c.filter(c=>c.fecha===h).length;
  document.getElementById('stat-pendientes').textContent=pendientes.length;
  const tEl=document.getElementById('stat-pendientes-trend');
  if(tEl) tEl.innerHTML=pendientes.length>0?`⚠️ ${pendientes.length} por confirmar`:'✅ Sin pendientes';
  if(tEl) tEl.className='stat-trend '+(pendientes.length>0?'warn':'ok');
  document.getElementById('stat-meds').textContent=C.m.filter(x=>x.estado==='activa').length;

  const citasHoy=C.c.filter(c=>c.fecha===h).sort((a,b)=>a.hora.localeCompare(b.hora));
  document.getElementById('agenda-hoy').innerHTML=citasHoy.length?citasHoy.map(c=>{
    const p=C.p.find(x=>x.id===c.pacienteId);
    const edad=p?calcEdad(p.fechaNac):'';
    return `<div class="dia-item" onclick="navigate('paciente-detalle',${c.pacienteId})">
      <div class="dia-time">${c.hora}</div>
      <div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:36px;height:36px;font-size:12px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div class="dia-info">
        <div class="dia-name">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div class="dia-sub">${c.motivo}${edad?' · '+edad:''}</div>
      </div>
      ${estadoTag(c.estado)}
      ${c.estado!=='completada'&&c.estado!=='cancelada'?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;flex-shrink:0" onclick="event.stopPropagation();marcarCitaCompletada(${c.id})" title="Marcar que acudió">✅</button>`:''}
      </div>`;
  }).join(''):`<div class="empty-state" style="padding:28px 0"><div class="empty-icon" style="font-size:32px">📅</div><p>Sin citas para hoy</p></div>`;

  renderCalendar('dashboard-cal',false);
  switchRecTab('pacientes');

  // Stats por usuario (médicos y admin)
  renderDashboardPorUsuario();
}

function renderDashboardPorUsuario() {
  const h = hoy();
  const el = document.getElementById('dash-por-usuario');
  if(!el) return;
  if(currentUser?.key === 'medico') { el.style.display='none'; return; }
  const medicos = C.prof.filter(p => ['medico','medico_admin','admin','enfermeria','recepcion'].includes(p.rol));
  if(!medicos.length) { el.style.display='none'; return; }
  el.style.display='';
  const citasHoy = C.c.filter(c => c.fecha === h);
  el.innerHTML = `
    <div class="card" style="margin-top:18px">
      <div class="card-header"><h3>👤 Actividad del Personal — Hoy</h3></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;padding-top:4px">
        ${medicos.map(u => {
          const atendidas = citasHoy.filter(c => c.medicoId === u.id && c.estado === 'completada').length;
          const pendientes = citasHoy.filter(c => c.medicoId === u.id && (c.estado === 'pendiente'||c.estado==='confirmada')).length;
          const total = citasHoy.filter(c => c.medicoId === u.id).length;
          const rolLabel = {admin:'Administración',medico:'Médico',medico_admin:'Médico Adm.',recepcion:'Recepcionista',enfermeria:'Enfermería',farmaceutico:'Farmacéutico'}[u.rol]||u.rol;
          const pct = total ? Math.round(atendidas/total*100) : 0;
          return `<div style="background:var(--bg);border-radius:12px;padding:14px;border:1.5px solid var(--border)">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div class="patient-avatar" style="background:${colAvatar(u.id)};width:38px;height:38px;font-size:13px;flex-shrink:0">${ini(u.nombre,'')}</div>
              <div style="min-width:0">
                <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.nombre}</div>
                <div style="font-size:11px;color:var(--text-light)">${rolLabel}</div>
              </div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px">
              <span style="color:var(--text-light)">Atendidos</span>
              <span style="font-weight:700;color:#15803D">${atendidas}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:8px">
              <span style="color:var(--text-light)">Pendientes</span>
              <span style="font-weight:700;color:#d69e2e">${pendientes}</span>
            </div>
            <div style="height:5px;background:var(--border);border-radius:3px">
              <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:3px;transition:width .4s"></div>
            </div>
            <div style="font-size:10px;color:var(--text-light);text-align:right;margin-top:3px">${pct}% completado · ${total} total</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderDashboardFarmacia() {
  const h = hoy();
  const ingresosHoy  = C.fin.filter(x => x.fecha === h && x.tipo === 'ingreso');
  const egresosHoy   = C.fin.filter(x => x.fecha === h && x.tipo === 'egreso');
  const comprasHoy   = C.mov.filter(x => x.fecha === h && x.tipo === 'entrada');
  const ventasHoy    = C.fin.filter(x => x.fecha === h && x.categoria === 'farmacia' && x.tipo === 'ingreso');
  const totalIng     = ingresosHoy.reduce((s,x)  => s + Number(x.monto||0), 0);
  const totalEgr     = egresosHoy.reduce((s,x)   => s + Number(x.monto||0), 0);
  const despachos    = C.mov.filter(x => x.fecha === h && (x.motivo==='venta_farmacia'||x.motivo==='receta')).length;

  const view = document.getElementById('view-dashboard');
  view.innerHTML = `
    <div id="panel-pendientes-sesion-farma" style="margin-bottom:18px"></div>
    <div class="stats-grid" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon si-green">💰</div><div class="stat-info"><h3>${fmtC(totalIng)}</h3><p>Ingresos de Hoy</p></div></div>
      <div class="stat-card"><div class="stat-icon si-red">📤</div><div class="stat-info"><h3 style="color:var(--danger)">${fmtC(totalEgr)}</h3><p>Gastos de Hoy</p></div></div>
      <div class="stat-card"><div class="stat-icon si-blue">🛒</div><div class="stat-info"><h3>${despachos}</h3><p>Despachos de Hoy</p></div></div>
      <div class="stat-card"><div class="stat-icon si-cyan">📥</div><div class="stat-info"><h3>${comprasHoy.length}</h3><p>Compras / Entradas</p></div></div>
    </div>

    <div class="grid-2" style="margin-bottom:18px">
      <!-- Últimos productos vendidos -->
      <div class="card">
        <div class="card-header"><h3>🛒 Últimas Ventas del Día</h3><button class="btn btn-primary btn-sm" onclick="navigate('farmacia')">Ver Farmacia</button></div>
        ${ventasHoy.length ? `<div>${[...ventasHoy].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,8).map(v=>`
          <div class="search-result-item" style="cursor:default">
            <div style="font-size:20px;flex-shrink:0">💊</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${(v.descripcion||'').replace('Venta farmacia: ','')}</div>
              <div class="text-light">${v.metodoPago||'—'} · ${formatFecha(v.fecha)}</div>
            </div>
            <span style="font-weight:700;color:#15803D;flex-shrink:0">${fmtC(v.monto)}</span>
          </div>`).join('')}</div>`
        : `<div class="empty-state" style="padding:28px 0"><div class="empty-icon" style="font-size:28px">🛒</div><p>Sin ventas hoy</p></div>`}
      </div>

      <!-- Compras / entradas de stock del día -->
      <div class="card">
        <div class="card-header"><h3>📥 Compras / Entradas de Stock Hoy</h3><button class="btn btn-secondary btn-sm" onclick="navigate('inventario')">Ver Inventario</button></div>
        ${comprasHoy.length ? `<div>${comprasHoy.slice(0,8).map(m=>{
          const prod = C.inv.find(p=>p.id===m.invId);
          return `<div class="search-result-item" style="cursor:default">
            <span class="tag tag-green" style="flex-shrink:0;font-size:13px">📥 +${m.cantidad}</span>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px">${prod?.nombre||'—'}</div>
              <div class="text-light">${prod?.unidad||''} · ${m.motivo||'entrada'}</div>
            </div>
            <span style="font-size:11px;color:var(--text-light);flex-shrink:0">Stock: ${prod?.stock||0}</span>
          </div>`;}).join('')}</div>`
        : `<div class="empty-state" style="padding:28px 0"><div class="empty-icon" style="font-size:28px">📦</div><p>Sin compras registradas hoy</p></div>`}
      </div>
    </div>

    <div class="grid-2">
      <!-- Transacciones del día -->
      <div class="card">
        <div class="card-header"><h3>🔄 Todas las Transacciones de Hoy</h3></div>
        ${ingresosHoy.length||egresosHoy.length ? `<div>${[...ingresosHoy,...egresosHoy].sort((a,b)=>a.tipo.localeCompare(b.tipo)).slice(0,10).map(v=>`
          <div class="search-result-item" style="cursor:default">
            <div style="font-size:18px;flex-shrink:0">${v.tipo==='ingreso'?'💰':'📤'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.descripcion||v.categoria}</div>
              <div class="text-light">${v.metodoPago||'—'} · ${v.categoria}</div>
            </div>
            <span style="font-weight:700;color:${v.tipo==='ingreso'?'#15803D':'#e53e3e'};flex-shrink:0">${v.tipo==='ingreso'?'+':'−'}${fmtC(v.monto)}</span>
          </div>`).join('')}</div>`
        : `<div class="empty-state" style="padding:28px 0"><div class="empty-icon" style="font-size:28px">💳</div><p>Sin transacciones hoy</p></div>`}
      </div>

      <!-- Alertas de stock -->
      <div class="card">
        <div class="card-header"><h3>⚠️ Alertas de Inventario</h3><button class="btn btn-secondary btn-sm" onclick="navigate('farmacia');setTimeout(()=>switchFarmaTab('alertas'),200)">Ver alertas</button></div>
        ${(()=>{
          const sinStock = C.inv.filter(x=>x.stock<=0);
          const bajStock = C.inv.filter(x=>x.stock>0&&x.stockMin>0&&x.stock<=x.stockMin);
          const todos = [...sinStock,...bajStock];
          if(!todos.length) return `<div class="empty-state" style="padding:28px 0"><div class="empty-icon" style="font-size:28px">✅</div><p>Todo el stock en orden</p></div>`;
          return `<div>${todos.slice(0,8).map(p=>`
            <div class="search-result-item" style="cursor:default">
              <span class="tag ${p.stock<=0?'tag-red':'tag-orange'}" style="flex-shrink:0">${p.stock<=0?'Sin stock':'Stock bajo'}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px">${p.nombre}</div>
                <div class="text-light">${p.unidad} · Mín: ${p.stockMin}</div>
              </div>
              <span style="font-weight:700;flex-shrink:0;color:${p.stock<=0?'#e53e3e':'#d69e2e'}">${p.stock}</span>
            </div>`).join('')}</div>`;
        })()}
      </div>
    </div>`;
}

let recTab = 'pacientes';
function switchRecTab(tab) {
  recTab = tab;
  ['pacientes','citas','meds','inv'].forEach(t => {
    const el = document.getElementById('tab-rec-'+t);
    if(el) el.classList.toggle('active', t===tab);
  });
  renderRecientes();
}

function renderRecientes() {
  const el = document.getElementById('recientes-content'); if(!el) return;
  const empty = msg => `<div class="empty-state" style="padding:24px 0"><div class="empty-icon" style="font-size:28px">${msg}</div></div>`;

  if(recTab === 'pacientes') {
    const items = [...C.p].reverse().slice(0,10);
    el.innerHTML = items.length ? items.map(p=>`
      <div class="search-result-item" onclick="navigate('paciente-detalle',${p.id})">
        <div class="patient-avatar" style="background:${colAvatar(p.id)};flex-shrink:0">${ini(p.nombre,p.apellidos)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.nombre} ${p.apellidos}</div>
          <div class="text-light">${formatFecha(p.fechaRegistro)} · ${p.telefono||'Sin tel.'}</div>
        </div>
        <span class="tag ${p.estado==='activo'?'tag-green':'tag-gray'}" style="flex-shrink:0">${p.estado}</span>
      </div>`).join('') : empty('👥<br><small>Sin pacientes aún</small>');

  } else if(recTab === 'citas') {
    const items = [...C.c].sort((a,b)=>b.fecha.localeCompare(a.fecha)||(b.id-a.id)).slice(0,10);
    el.innerHTML = items.length ? items.map(c=>{
      const p=C.p.find(x=>x.id===c.pacienteId);
      return `<div class="search-result-item" style="cursor:default">
        <div style="min-width:70px;font-size:12px;font-weight:700;color:var(--primary)">${formatHora12(c.hora)}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'—'}</div>
          <div class="text-light">${formatFecha(c.fecha)} · ${c.motivo}</div>
        </div>
        ${estadoTag(c.estado)}
      </div>`;}).join('') : empty('📅<br><small>Sin citas aún</small>');

  } else if(recTab === 'meds') {
    const items = [...C.m].reverse().slice(0,10);
    el.innerHTML = items.length ? items.map(m=>{
      const p=C.p.find(x=>x.id===m.pacienteId);
      return `<div class="search-result-item" style="cursor:default">
        <div style="font-size:22px;flex-shrink:0">💊</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px">${m.nombre}</div>
          <div class="text-light">${p?p.nombre+' '+p.apellidos:'—'} · ${m.dosis} ${m.frecuencia}</div>
        </div>
        <span class="tag ${m.estado==='activa'?'tag-green':m.estado==='suspendida'?'tag-red':'tag-gray'}" style="flex-shrink:0">${m.estado}</span>
      </div>`;}).join('') : empty('💊<br><small>Sin medicaciones aún</small>');

  } else {
    const items = [...C.mov].slice(0,10);
    el.innerHTML = items.length ? items.map(m=>{
      const p=C.inv.find(x=>x.id===m.invId);
      return `<div class="search-result-item" style="cursor:default">
        <span class="inv-badge-${m.tipo}" style="flex-shrink:0">${m.tipo==='entrada'?'📥':'📤'}</span>
        <div style="flex:1;min-width:0">
          <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre:'—'}</div>
          <div class="text-light">${formatFecha(m.fecha)} · Cant: ${m.cantidad} ${p?p.unidad:''}</div>
        </div>
        <span style="font-size:12px;color:var(--text-light);flex-shrink:0">${m.motivo||''}</span>
      </div>`;}).join('') : empty('📦<br><small>Sin movimientos aún</small>');
  }
}

// ════════════════════ NÚMERO DE EXPEDIENTE ════════════════════
function getExpedienteNum(pid) {
  const codigo = (currentClinica?.codigo || currentClinica?.nombre || 'EXP').toUpperCase().replace(/[^A-Z0-9]/g,'');
  const initials = codigo.slice(0, 4);
  const year = new Date().getFullYear();
  const sorted = [...C.p].sort((a,b) => a.id - b.id);
  const idx = sorted.findIndex(p => p.id === pid);
  const num = idx >= 0 ? idx + 1 : C.p.length + 1;
  return initials + year + '-' + String(num).padStart(3, '0');
}

// ════════════════════ PACIENTES ════════════════════
function renderPacientes(){
  const search=document.getElementById('pacientes-search');
  if(search) search.value='';
  filtroEstado='todos';
  document.querySelectorAll('.filter-chips .chip').forEach((c,i)=>c.classList.toggle('active',i===0));
  const countEl=document.getElementById('pacientes-count');
  if(countEl) countEl.textContent=`${C.p.length} pacientes`;
  renderPacientesList(C.p);
}

function renderPacientesList(lista){
  const el=document.getElementById('tabla-pacientes'), empty=document.getElementById('pacientes-empty');
  if(!el) return;
  if(!lista.length){ el.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  el.innerHTML=lista.map(x=>`<div class="pac-row" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
    ${x.fotoUrl?`<img src="${x.fotoUrl}" style="width:38px;height:38px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid var(--border)" alt="foto">`:`<div class="patient-avatar" style="background:${colAvatar(x.id)};width:38px;height:38px;flex-shrink:0">${ini(x.nombre,x.apellidos)}</div>`}
    <div style="flex:1;min-width:0">
      <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.nombre} ${x.apellidos}</div>
      <div style="font-size:11px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
        <code style="background:var(--primary-light);color:var(--primary);padding:1px 6px;border-radius:5px;font-size:10px;font-weight:700">${getExpedienteNum(x.id)}</code>
        · ${calcEdad(x.fechaNac)}${x.telefono?` · ${x.telefono}`:''}
      </div>
    </div>
    <span style="flex-shrink:0">${estadoTag(x.estado||'activo')}</span>
    <div class="actions-cell" style="gap:5px;flex-wrap:wrap;flex-shrink:0">
      <button class="btn btn-sm btn-acudio" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff" onclick="registrarAcudidoPaciente(${x.id})">✅ <span class="acudio-text">Acudió</span></button>
      <button class="btn btn-secondary btn-sm" onclick="navigate('paciente-detalle',${x.id})">👁️</button>
      <button class="btn btn-secondary btn-sm" onclick="openModalPaciente(${x.id})">✏️</button>
      <button class="btn btn-danger btn-sm" onclick="eliminarPaciente(${x.id})">🗑️</button>
    </div>
  </div>`).join('');
}

function openModalPaciente(id){
  editingId=id||null;
  document.getElementById('modal-paciente-title').textContent=id?'✏️ Editar Paciente':'👤 Nuevo Paciente';
  ['nombre','apellidos','id','sexo','sangre','telefono','email','direccion','alergias','estado','emergencia','observaciones'].forEach(f=>{ const e=document.getElementById('p-'+f); if(e) e.value=''; });
  const idTipoEl = document.getElementById('p-id-tipo'); if(idTipoEl) idTipoEl.value = 'Cédula';
  _setFechaNacInput('');
  // Mostrar búsqueda y ajustar label solo al crear nuevo
  const buscarWrap = document.getElementById('pac-buscar-id-wrap');
  const buscarInput = document.getElementById('pac-buscar-id-input');
  const buscarRes = document.getElementById('pac-buscar-id-resultados');
  if(buscarWrap) buscarWrap.style.display = id ? 'none' : '';
  if(buscarInput) buscarInput.value = '';
  if(buscarRes) buscarRes.innerHTML = '';
  // Identificación: campo opcional para todos los tipos de clínica
  const idLabel = document.getElementById('p-id-label');
  if(idLabel) idLabel.textContent = 'Número de Identificación';
  pendingFotoFile=null; currentFotoUrl=null;
  document.getElementById('foto-img-preview').style.display='none';
  document.getElementById('foto-img-preview').src='';
  document.getElementById('foto-placeholder').style.display='block';
  document.getElementById('btn-quitar-foto').style.display='none';
  document.getElementById('p-foto').value='';
  if(id){
    const x=C.p.find(p=>p.id===id);
    if(x){
      document.getElementById('p-nombre').value=x.nombre||'';
      document.getElementById('p-apellidos').value=x.apellidos||'';
      const idStr = x.identificacion||'';
      const idMatch = idStr.match(/^(Cédula|Pasaporte|Licencia de conducir):\s*(.*)$/);
      if(idMatch){ document.getElementById('p-id-tipo').value=idMatch[1]; document.getElementById('p-id').value=idMatch[2]; }
      else { document.getElementById('p-id-tipo').value='Cédula'; document.getElementById('p-id').value=idStr; }
      _setFechaNacInput(x.fechaNac || '');
      document.getElementById('p-sexo').value=x.sexo||'';
      document.getElementById('p-sangre').value=x.sangre||'';
      document.getElementById('p-telefono').value=x.telefono||'';
      document.getElementById('p-email').value=x.email||'';
      document.getElementById('p-direccion').value=x.direccion||'';
      document.getElementById('p-alergias').value=x.alergias||'';
      document.getElementById('p-estado').value=x.estado||'activo';
      document.getElementById('p-emergencia').value=x.emergencia||'';
      document.getElementById('p-observaciones').value=x.observaciones||'';
      if(x.fotoUrl){ currentFotoUrl=x.fotoUrl; document.getElementById('foto-placeholder').style.display='none'; document.getElementById('foto-img-preview').src=x.fotoUrl; document.getElementById('foto-img-preview').style.display='block'; document.getElementById('btn-quitar-foto').style.display='block'; }
    }
  }
  openModalOverlay('modal-paciente');
  setTimeout(initDatePickers, 50);
}

// Escribe la fecha de nacimiento en el input y mantiene sincronizado flatpickr,
// que ignora los cambios hechos directamente sobre .value una vez inicializado.
function _setFechaNacInput(val) {
  const el = document.getElementById('p-fechanac');
  if(!el) return;
  el.value = val || '';
  if(el._flatpickr) {
    if(val) el._flatpickr.setDate(val, false);
    else    el._flatpickr.clear();
  }
  actualizarEdadCalculada();
}

// Muestra bajo el campo la edad que corresponde a la fecha elegida
function actualizarEdadCalculada() {
  const out = document.getElementById('p-edad-calc');
  if(!out) return;
  const val = document.getElementById('p-fechanac')?.value;
  if(!val) { out.textContent = ''; return; }
  const edad = _getEdadNum(val);
  if(edad === null || edad < 0) { out.textContent = ''; return; }
  out.textContent = edad === 0 ? '🎂 Menos de 1 año' : `🎂 ${edad} año${edad === 1 ? '' : 's'}`;
}

async function guardarPaciente(irExpediente=false, irCita=false){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  if(!_lockSubmit('paciente', null)) return;
  const nombre=document.getElementById('p-nombre').value.trim();
  const apellidos=document.getElementById('p-apellidos').value.trim();
  if(!nombre||!apellidos){ _unlockSubmit('paciente', null); toast('Nombre y apellidos son obligatorios','error'); return; }
  // Fecha de nacimiento opcional: se guarda tal cual y la edad se calcula
  // siempre a partir de ella, así se mantiene correcta con el paso de los años.
  const fechaNacVal = document.getElementById('p-fechanac')?.value || null;
  if(fechaNacVal && fechaNacVal > hoy()){
    _unlockSubmit('paciente', null);
    toast('La fecha de nacimiento no puede ser futura','error');
    return;
  }
  const idTipo  = document.getElementById('p-id-tipo')?.value || 'Cédula';
  const idValor = document.getElementById('p-id').value.trim();
  if(!editingId && idValor) {
    const labelBusqueda = idTipo + ': ' + idValor;
    const duplicado = C.p.find(p => p.identificacion && p.identificacion.toLowerCase() === labelBusqueda.toLowerCase());
    if(duplicado){ _unlockSubmit('paciente',null); toast(`Ya existe un paciente con esa identificación: ${duplicado.nombre} ${duplicado.apellidos}`,'error'); return; }
  }
  const identificacion = idValor ? idTipo + ': ' + idValor : '';
  const obj={nombre,apellidos,identificacion,fechaNac:fechaNacVal,sexo:document.getElementById('p-sexo').value,sangre:document.getElementById('p-sangre').value,telefono:document.getElementById('p-telefono').value.trim(),email:document.getElementById('p-email').value.trim(),direccion:document.getElementById('p-direccion').value.trim(),alergias:document.getElementById('p-alergias').value.trim(),estado:document.getElementById('p-estado').value,emergencia:document.getElementById('p-emergencia').value.trim(),observaciones:document.getElementById('p-observaciones').value.trim(),fechaRegistro:hoy(),fotoUrl:currentFotoUrl};
  setLoading(true);
  let err, savedId=editingId;
  if(editingId){ const r=await sb.from('pacientes').update(toP(obj)).eq('id',editingId); err=r.error; }
  else { const r=await sb.from('pacientes').insert([toP(obj)]).select('id').single(); err=r.error; if(!err) savedId=r.data.id; }
  if(err){ setLoading(false); _unlockSubmit('paciente',null); toast('Error: '+err.message,'error'); return; }
  if(!editingId && savedId) {
    const initials = (currentClinica?.codigo||currentClinica?.nombre||'EXP').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
    const year = new Date().getFullYear();
    const seq = C.p.filter(p=>p.expediente).length + 1;
    const numExp = `${initials}-${String(seq).padStart(3,'0')}`;
    await sb.from('pacientes').update({expediente:numExp}).eq('id',savedId);
    await sb.from('expediente').upsert([{ paciente_id:savedId, clinica_id:currentClinicaId }], {onConflict:'paciente_id,clinica_id', ignoreDuplicates:true });
  }
  if(pendingFotoFile && savedId){
    try{ const url=await subirFotoPaciente(pendingFotoFile,savedId); await sb.from('pacientes').update({foto_url:url}).eq('id',savedId); pendingFotoFile=null; }
    catch(e){ toast('Paciente guardado, error con la foto: '+e.message,'info'); }
  }
  setLoading(false);
  _unlockSubmit('paciente', null);
  toast(editingId?'Paciente actualizado':'Paciente registrado ✅');
  if(!editingId) logActivity('paciente');
  const btnCitar = document.getElementById('btn-guardar-y-citar');
  if(btnCitar) btnCitar.style.display = 'none';
  closeModal('modal-paciente');
  await loadAll(); renderPacientes(); updateBadges();
  if((!editingId && (irCita || pendingCitaAfterPaciente)) && savedId) {
    pendingCitaAfterPaciente = false;
    setTimeout(() => { openModalCita(); setPacienteSelect('c-paciente', savedId); }, 300);
    return;
  }
  if(irExpediente && savedId) navigate('paciente-detalle', savedId);
}

async function eliminarPaciente(id){
  const x=C.p.find(p=>p.id===id);
  const ok=await customConfirm({icon:'🗑️',title:'Eliminar paciente',msg:`¿Eliminar a <strong>${x.nombre} ${x.apellidos}</strong>?<br><br>También se eliminarán sus citas, medicaciones y notas.`,okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('pacientes').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Paciente eliminado');
  await loadAll(); renderPacientes(); updateBadges();
}

// ════════════════════ DETALLE PACIENTE ════════════════════
function renderDetalleP(pid){
  const p=C.p.find(x=>x.id===pid);
  if(!p){ navigate('pacientes'); return; }
  const citas=C.c.filter(c=>c.pacienteId===pid);
  const meds=C.m.filter(m=>m.pacienteId===pid);
  const notas=C.n.filter(n=>n.pacienteId===pid);

  document.getElementById('detalle-header').innerHTML=`
    <div class="patient-detail-header">
      ${p.fotoUrl?`<img src="${p.fotoUrl}" class="patient-detail-avatar" style="object-fit:cover;border:3px solid rgba(255,255,255,.4)" alt="foto">`:`<div class="patient-detail-avatar" style="background:${colAvatar(p.id)}">${ini(p.nombre,p.apellidos)}</div>`}
      <div class="patient-detail-info">
        <h2>${p.nombre} ${p.apellidos}</h2>
        <div style="margin-bottom:6px"><code style="background:rgba(255,255,255,.2);color:#fff;padding:2px 10px;border-radius:6px;font-size:12px;font-weight:700;letter-spacing:.5px">Exp. ${getExpedienteNum(p.id)}</code></div>
        <div class="meta">
          <span>🎂 ${calcEdad(p.fechaNac)}</span>
          ${p.sexo?`<span>${p.sexo==='M'?'♂ Masculino':p.sexo==='F'?'♀ Femenino':p.sexo}</span>`:''}
          ${p.sangre?`<span>🩸 ${p.sangre}</span>`:''}
          ${p.telefono?`<span>📞 ${p.telefono}</span>`:''}
        </div>
      </div>
      <div style="margin-left:auto;display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="imprimirExpedienteCompleto(${p.id})">🖨️ Imprimir</button>
        <button class="btn" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff" onclick="registrarAcudidoPaciente(${p.id})">✅ Paciente acudió</button>
        <button class="btn" style="background:rgba(255,255,255,.15);color:#fff" onclick="openModalPaciente(${p.id})">✏️ Editar</button>
      </div>
    </div>`;

  document.getElementById('tab-info').innerHTML=`
    <div class="grid-2">
      <div class="card"><h3 style="margin-bottom:14px;font-size:14px">📋 Datos Personales</h3>
        <table style="width:100%">${[['N° Expediente',`<code style="background:var(--primary-light);color:var(--primary);padding:2px 8px;border-radius:6px;font-size:12px;font-weight:700">${getExpedienteNum(p.id)}</code>`],['Identificación',p.identificacion||'—'],['Fecha Nacimiento',p.fechaNac?`${formatFecha(p.fechaNac)} <span class="tag tag-cyan" style="font-size:10px;margin-left:4px">${calcEdad(p.fechaNac)}</span>`:'—'],['Dirección',p.direccion||'—'],['Emergencia',p.emergencia||'—'],['Registro',formatFecha(p.fechaRegistro)]].map(([k,v])=>`<tr><td class="text-light" style="padding:6px 0;width:140px">${k}</td><td style="padding:6px 0;font-weight:600;font-size:13px">${v}</td></tr>`).join('')}</table>
      </div>
      <div class="card"><h3 style="margin-bottom:14px;font-size:14px">🏥 Datos Clínicos</h3>
        <p class="text-light" style="margin-bottom:8px">Alergias: <strong style="color:var(--text)">${p.alergias||'Ninguna conocida'}</strong></p>
        <p class="text-light" style="margin-bottom:8px">Tipo de Sangre: <strong style="color:var(--text)">${p.sangre||'Desconocido'}</strong></p>
        <p class="text-light">Estado: ${estadoTag(p.estado||'activo')}</p>
        ${p.observaciones?`<div class="mt-16"><p class="text-light" style="margin-bottom:6px">Observaciones:</p><div style="font-size:13px;line-height:1.7;background:var(--bg);padding:10px 12px;border-radius:8px">${p.observaciones}</div></div>`:''}
      </div>
    </div>
    <div class="grid-2" style="margin-top:16px">
      <div class="card"><div class="card-header"><h3>📅 Citas</h3><button class="btn btn-primary btn-sm" onclick="openModalCitaP(${p.id})">+ Cita</button></div>
        <p class="text-light">Total: <strong>${citas.length}</strong> · Pendientes: <strong>${citas.filter(c=>c.estado==='pendiente').length}</strong></p></div>
      <div class="card"><div class="card-header"><h3>💊 Medicaciones</h3><button class="btn btn-primary btn-sm" onclick="openModalMedP(${p.id})">+ Medicación</button></div>
        <p class="text-light">Total: <strong>${meds.length}</strong> · Activas: <strong>${meds.filter(m=>m.estado==='activa').length}</strong></p></div>
    </div>`;

  document.getElementById('tab-citas-p').innerHTML=`<div class="card">
    <div class="card-header"><h3>📅 Citas</h3><button class="btn btn-primary btn-sm" onclick="openModalCitaP(${p.id})">+ Nueva</button></div>
    ${citas.length?`<div>${citas.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(c=>{
      const esComp=c.estado==='completada', esCanc=c.estado==='cancelada';
      const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
      const [,mm,dd]=c.fecha.split('-');
      return `<div class="cita-item ${c.estado}" style="gap:10px;flex-wrap:wrap">
        <div style="width:38px;flex-shrink:0;text-align:center;background:var(--primary-light);border-radius:8px;padding:5px 2px">
          <div style="font-size:13px;font-weight:800;color:var(--primary);line-height:1">${dd}</div>
          <div style="font-size:10px;color:var(--primary);text-transform:uppercase;font-weight:600">${MESES[parseInt(mm)-1]}</div>
        </div>
        <div style="flex:1;min-width:0">
          <div class="cita-paciente">${c.hora} · ${c.motivo}</div>
          ${c.tipo?`<div class="cita-motivo"><span class="tag tag-cyan" style="font-size:10px">${c.tipo}</span></div>`:''}
        </div>
        ${esComp?'<span class="acudio-badge">✅ Atendido</span>':estadoTag(c.estado)}
        <div class="actions-cell" style="gap:6px;flex-wrap:wrap">
          ${!esComp&&!esCanc?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;font-size:11px;font-weight:700;white-space:nowrap" onclick="marcarCitaCompletada(${c.id})">✅ Atendido</button>`:''}
          <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})" title="Ver hoja">📄</button>
          <button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button>
        </div>
      </div>`;
    }).join('')}</div>`:'<div class="empty-state"><div class="empty-icon">📅</div><p>Sin citas</p></div>'}
  </div>`;

  document.getElementById('tab-meds-p').innerHTML=`<div class="card">
    <div class="card-header"><h3>💊 Medicaciones</h3><div style="display:flex;gap:8px">${meds.length?`<button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirRecetaPaciente(${p.id})">🖨️ Receta</button>`:''}<button class="btn btn-primary btn-sm" onclick="openModalMedP(${p.id})">+ Nueva</button></div></div>
    ${meds.length?meds.map(m=>`<div class="med-item"><span style="font-size:22px">💊</span><div class="med-info" style="flex:1"><h4>${m.nombre}</h4><div class="med-dosis">${m.dosis} — ${m.frecuencia} (${m.via})</div><p>${m.inicio?`Del ${formatFecha(m.inicio)} al ${m.fin?formatFecha(m.fin):'indefinido'}`:''}${m.indicaciones?' · '+m.indicaciones:''}</p></div><div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">${estadoTag(m.estado)}<div class="actions-cell"><button class="btn btn-secondary btn-sm" onclick="openModalMedicacion(${m.id})">✏️</button><button class="btn btn-danger btn-sm" onclick="eliminarMedicacion(${m.id})">🗑️</button></div></div></div>`).join(''):'<div class="empty-state"><div class="empty-icon">💊</div><p>Sin medicaciones</p></div>'}
  </div>`;

  document.getElementById('tab-notas-p').innerHTML=`<div class="card">
    <div class="card-header"><h3>📝 Notas Clínicas</h3><button class="btn btn-primary btn-sm" onclick="openModalNotaP(${p.id})">+ Nueva</button></div>
    ${notas.length?`<div class="timeline">${notas.sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(n=>`<div class="timeline-item"><div class="timeline-date">${formatFecha(n.fecha)} · <span class="tag tag-blue" style="font-size:10px">${NOTA_TIPO_ICON[n.tipo]||'📝'} ${notaTipoLabel(n.tipo)}</span></div><div class="timeline-content">${n.titulo?`<strong style="display:block;margin-bottom:5px">${n.titulo}</strong>`:''}${_signosChipsHTML(n.signos)}${n.contenido?`<p style="white-space:pre-wrap;line-height:1.7">${n.contenido}</p>`:''}<div style="margin-top:8px;display:flex;gap:6px"><button class="btn btn-secondary btn-sm" onclick="verNota(${n.id})">👁️ Ver</button><button class="btn btn-secondary btn-sm" onclick="openModalNota(${n.id})">✏️ Editar</button><button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirNota(${n.id})">🖨️</button><button class="btn btn-danger btn-sm" onclick="eliminarNota(${n.id})">🗑️</button></div></div></div>`).join('')}</div>`:'<div class="empty-state"><div class="empty-icon">📝</div><p>Sin notas</p></div>'}
  </div>`;

  // Pestañas odontológicas — solo visibles para odontólogo / superadmin
  const esOdonto = isOdontologo() || isSuperAdmin();
  ['tab-btn-historial-dental','tab-btn-odontograma','tab-btn-periodontograma','tab-btn-procedimientos-p']
    .forEach(id => { const el=document.getElementById(id); if(el) el.style.display = esOdonto ? '' : 'none'; });
  if(esOdonto) {
    renderHistorialDental(pid);
    renderOdontograma(pid);
    renderPeriodontograma(pid);
    renderProcedimientosTab(pid);
  }

  const exp=C.e.find(x=>x.pacienteId===pid)||{};
  const imc=(exp.peso&&exp.talla)?(exp.peso/((exp.talla/100)**2)).toFixed(1):null;
  document.getElementById('tab-expediente').innerHTML=`
  <div class="card">
    <div class="card-header"><h3>📁 Expediente Médico</h3>
      <div style="display:flex;gap:8px">
        ${(currentClinica?.tipo==='optica'||isSuperAdmin())?`<button class="btn btn-secondary btn-sm" onclick="abrirExamenVisual(${pid})">👁️ Examen Visual</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="guardarExpediente(${pid})">💾 Guardar</button>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">⚡ Signos Vitales</div>
      <div class="vitales-grid">
        <div class="vital-card"><div class="v-val">${exp.peso||'—'}</div><div class="v-lbl">Peso kg</div></div>
        <div class="vital-card"><div class="v-val">${exp.talla||'—'}</div><div class="v-lbl">Talla cm</div></div>
        <div class="vital-card"><div class="v-val">${exp.presion||'—'}</div><div class="v-lbl">Presión</div></div>
        <div class="vital-card"><div class="v-val">${exp.temperatura?exp.temperatura+'°':'—'}</div><div class="v-lbl">Temp.</div></div>
        ${imc?`<div class="vital-card"><div class="v-val">${imc}</div><div class="v-lbl">IMC</div></div>`:''}
      </div>
      <div class="form-grid" style="margin-top:12px">
        <div class="form-group"><label>Peso (kg)</label><input type="number" id="exp-peso" value="${exp.peso||''}" placeholder="70.0" step="0.1"></div>
        <div class="form-group"><label>Talla (cm)</label><input type="number" id="exp-talla" value="${exp.talla||''}" placeholder="170"></div>
        <div class="form-group"><label>Presión Arterial</label><input type="text" id="exp-presion" value="${exp.presion||''}" placeholder="120/80 mmHg"></div>
        <div class="form-group"><label>Temperatura (°C)</label><input type="number" id="exp-temperatura" value="${exp.temperatura||''}" placeholder="36.5" step="0.1"></div>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">👤 Datos Socioeconómicos</div>
      <div class="form-grid">
        <div class="form-group"><label>Ocupación</label><input type="text" id="exp-ocupacion" value="${exp.ocupacion||''}" placeholder="Empleado, estudiante..."></div>
        <div class="form-group"><label>Estado Civil</label><select id="exp-estadoCivil">
          <option value="">—</option>
          ${['soltero','casado','divorciado','viudo','union libre'].map(v=>`<option value="${v}" ${exp.estadoCivil===v?'selected':''}>${v}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Hábito: Tabaco</label><select id="exp-tabaco">
          ${[['no','No fuma'],['ex','Ex fumador'],['ocasional','Ocasional'],['diario','Diario']].map(([v,l])=>`<option value="${v}" ${exp.tabaco===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-group"><label>Hábito: Alcohol</label><select id="exp-alcohol">
          ${[['no','No consume'],['ocasional','Ocasional'],['frecuente','Frecuente']].map(([v,l])=>`<option value="${v}" ${exp.alcohol===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
        <div class="form-group full"><label>Actividad Física</label><select id="exp-actividadFisica">
          ${[['sedentario','Sedentario'],['leve','Leve (1-2 días/semana)'],['moderada','Moderada (3-4 días)'],['intensa','Intensa (5+ días)']].map(([v,l])=>`<option value="${v}" ${exp.actividadFisica===v?'selected':''}>${l}</option>`).join('')}
        </select></div>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">🏥 Antecedentes Clínicos</div>
      <div class="form-grid cols-1">
        <div class="form-group"><label>Enfermedades Crónicas</label><textarea id="exp-enfermedadesCronicas" placeholder="Hipertensión, diabetes tipo 2, asma...">${exp.enfermedadesCronicas||''}</textarea></div>
        <div class="form-group"><label>Cirugías Previas</label><textarea id="exp-cirugias" placeholder="Apendicectomía 2018, cesárea...">${exp.cirugias||''}</textarea></div>
        <div class="form-group"><label>Antecedentes Familiares</label><textarea id="exp-antecedentesFamiliares" placeholder="Padre: HTA, diabetes. Madre: cáncer...">${exp.antecedentesFamiliares||''}</textarea></div>
      </div>
    </div>

    <div class="exp-section">
      <div class="exp-section-title">💉 Alergias y Vacunas</div>
      <div class="form-grid cols-1">
        <div class="form-group"><label>Alergias conocidas (del perfil del paciente)</label>
          <div style="padding:10px 14px;background:${p.alergias?'#FEF2F2':'var(--bg)'};border:1.5px solid ${p.alergias?'#FECACA':'var(--border)'};border-radius:10px;font-size:13px;color:${p.alergias?'#DC2626':'var(--text-light)'}">
            ${p.alergias?'⚠️ '+p.alergias:'Sin alergias registradas — edita el perfil del paciente para agregar'}
          </div>
        </div>
        <div class="form-group"><label>Esquema de Vacunas</label><textarea id="exp-vacunas" placeholder="COVID-19 ✓, Influenza ✓, Hepatitis B ✓...">${exp.vacunas||''}</textarea></div>
        <div class="form-group"><label>Observaciones Médicas Adicionales</label><textarea id="exp-observacionesMedicas" placeholder="Notas del médico sobre el expediente...">${exp.observacionesMedicas||''}</textarea></div>
      </div>
    </div>
  </div>`;
}

function imprimirExpedienteCompleto(pid) {
  const p    = C.p.find(x=>x.id===pid);
  if(!p) return;
  const exp  = C.e.find(x=>x.pacienteId===pid) || {};
  const citas = C.c.filter(x=>x.pacienteId===pid).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const meds  = C.m.filter(x=>x.pacienteId===pid);
  const notas = C.n.filter(x=>x.pacienteId===pid);
  const examenes = notas.filter(n=>n.tipo==='examen_visual').sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const otrasNotas = notas.filter(n=>n.tipo!=='examen_visual').sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const cl   = currentClinica;
  const imc  = (exp.peso&&exp.talla) ? (exp.peso/((exp.talla/100)**2)).toFixed(1) : null;
  const edad = _getEdadNum(p.fechaNac);

  const sec = (icon, title, color) =>
    `<div style="background:${color};color:#fff;padding:10px 18px;border-radius:8px;margin:22px 0 14px;font-size:14px;font-weight:700;letter-spacing:.02em">${icon} ${title}</div>`;

  const row = (label, val, full=false) => (!val && val!==0) ? '' :
    `<tr>
      <td style="padding:5px 10px;color:#64748b;width:${full?'0':'180px'};font-size:12px;border-bottom:1px solid #f1f5f9;white-space:nowrap">${label}</td>
      <td style="padding:5px 10px;font-size:13px;font-weight:600;border-bottom:1px solid #f1f5f9${full?';width:100%':''}">${val}</td>
    </tr>`;

  const tbl = (rows) => rows.trim()
    ? `<table style="width:100%;border-collapse:collapse">${rows}</table>` : '';

  // ── CABECERA ──
  const cabecera = `
    <div style="text-align:center;margin-bottom:22px;padding-bottom:14px;border-bottom:2px solid #0f172a">
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 2px">${cl?.nombre||'Clínica'}</h1>
      <p style="color:#64748b;font-size:12px;margin:0">${cl?.direccion||''} ${cl?.telefono?'· Tel: '+cl.telefono:''}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px">EXPEDIENTE CLÍNICO · Generado ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</p>
    </div>`;

  // ── DATOS DEL PACIENTE ──
  const secPaciente = sec('👤','Datos del Paciente','#1e40af') + tbl(
    row('N° Expediente',`<strong>${p.expediente||getExpedienteNum(p.id)}</strong>`) +
    row('Nombre completo',`<strong>${p.nombre} ${p.apellidos}</strong>`) +
    row('Identificación', p.identificacion) +
    row('Fecha de nacimiento', p.fechaNac ? formatFecha(p.fechaNac)+(edad?' ('+edad+' años)':'') : null) +
    row('Sexo', p.sexo==='M'?'Masculino':p.sexo==='F'?'Femenino':p.sexo) +
    row('Tipo de sangre', p.tipoSangre||p.sangre) +
    row('Teléfono', p.telefono) +
    row('Email', p.email) +
    row('Dirección', p.direccion) +
    row('Contacto de emergencia', p.emergencia||p.contactoEmergencia) +
    row('Alergias', p.alergias ? '⚠️ '+p.alergias : 'Ninguna conocida')
  ) + (p.observaciones ? `<div style="margin-top:8px;padding:10px 12px;background:#eff6ff;border-left:3px solid #1e40af;border-radius:4px;font-size:12px">${p.observaciones}</div>` : '');

  // ── SIGNOS VITALES + ANTECEDENTES ──
  const secExp = sec('🩺','Expediente Médico','#0f766e') +
    (exp.peso||exp.talla||exp.presion||exp.temperatura ? `
    <div style="display:flex;gap:12px;margin-bottom:14px;flex-wrap:wrap">
      ${exp.peso?`<div style="flex:1;min-width:80px;text-align:center;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px"><div style="font-size:20px;font-weight:800;color:#0f172a">${exp.peso}</div><div style="font-size:10px;color:#64748b">kg · Peso</div></div>`:''}
      ${exp.talla?`<div style="flex:1;min-width:80px;text-align:center;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px"><div style="font-size:20px;font-weight:800;color:#0f172a">${exp.talla}</div><div style="font-size:10px;color:#64748b">cm · Talla</div></div>`:''}
      ${exp.presion?`<div style="flex:1;min-width:80px;text-align:center;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px"><div style="font-size:20px;font-weight:800;color:#0f172a">${exp.presion}</div><div style="font-size:10px;color:#64748b">Presión</div></div>`:''}
      ${exp.temperatura?`<div style="flex:1;min-width:80px;text-align:center;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px"><div style="font-size:20px;font-weight:800;color:#0f172a">${exp.temperatura}°</div><div style="font-size:10px;color:#64748b">Temperatura</div></div>`:''}
      ${imc?`<div style="flex:1;min-width:80px;text-align:center;padding:10px;border:1.5px solid #e2e8f0;border-radius:8px"><div style="font-size:20px;font-weight:800;color:#0f172a">${imc}</div><div style="font-size:10px;color:#64748b">IMC</div></div>`:''}
    </div>` : '') +
    tbl(
      row('Ocupación', exp.ocupacion) +
      row('Estado civil', exp.estadoCivil) +
      row('Tabaco', exp.tabaco) +
      row('Alcohol', exp.alcohol) +
      row('Actividad física', exp.actividadFisica) +
      row('Enfermedades crónicas', exp.enfermedadesCronicas) +
      row('Cirugías previas', exp.cirugias) +
      row('Antecedentes familiares', exp.antecedentesFamiliares) +
      row('Vacunas', exp.vacunas) +
      row('Observaciones médicas', exp.observacionesMedicas||exp.observaciones)
    );

  // ── CITAS ──
  const secCitas = citas.length ? sec('📅','Historial de Citas','#7c3aed') +
    `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Fecha</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Hora</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Motivo</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Tipo</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Estado</th>
      </tr></thead>
      <tbody>${citas.map(c=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:7px 10px">${formatFecha(c.fecha)}</td>
        <td style="padding:7px 10px">${c.hora||'—'}</td>
        <td style="padding:7px 10px">${c.motivo||'—'}</td>
        <td style="padding:7px 10px">${c.tipo||'consulta'}</td>
        <td style="padding:7px 10px">${c.estado||'—'}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  // ── MEDICACIONES ──
  const secMeds = meds.length ? sec('💊','Medicaciones','#b45309') +
    `<table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Medicamento</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Dosis</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Frecuencia</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Vía</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Estado</th>
      </tr></thead>
      <tbody>${meds.map(m=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:7px 10px;font-weight:600">${m.nombre}</td>
        <td style="padding:7px 10px">${m.dosis||'—'}</td>
        <td style="padding:7px 10px">${m.frecuencia||'—'}</td>
        <td style="padding:7px 10px">${m.via||'—'}</td>
        <td style="padding:7px 10px">${m.estado||'—'}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  // ── NOTAS CLÍNICAS ──
  const secNotas = otrasNotas.length ? sec('📝','Notas Clínicas','#0369a1') +
    otrasNotas.map(n=>`
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;margin-bottom:10px;break-inside:avoid">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;align-items:baseline">
          <strong style="font-size:13px">${n.titulo||'—'}</strong>
          <span style="font-size:11px;color:#64748b">${formatFecha(n.fecha)} · ${n.tipo||'nota'}</span>
        </div>
        <p style="font-size:12px;color:#374151;margin:0;white-space:pre-wrap;line-height:1.7">${n.contenido||''}</p>
      </div>`).join('') : '';

  // ── EXAMEN VISUAL ──
  const secExamen = examenes.length ? sec('👁️','Exámenes Visuales','#6d28d9') +
    examenes.map(ev => {
      // Parsear el contenido de texto a bloques visuales
      const lines = (ev.contenido||'').split('\n');
      const bloques = {};
      let bloque = '';
      lines.forEach(l => {
        const l2 = l.trim();
        if(l2.startsWith('▸')) { bloque = l2.replace('▸','').trim().split('\n')[0]; bloques[bloque]=[]; }
        else if(bloque && l2 && !l2.startsWith('╔') && !l2.startsWith('╚') && !l2.startsWith('║')) {
          bloques[bloque] = bloques[bloque]||[];
          bloques[bloque].push(l2);
        }
      });
      const blk = (titulo) => bloques[titulo] ? `
        <div style="margin-bottom:10px">
          <div style="font-weight:700;font-size:11px;color:#6d28d9;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;border-bottom:1px solid #ede9fe;padding-bottom:3px">${titulo}</div>
          <div style="font-size:12px;color:#374151;line-height:1.8;white-space:pre-wrap">${bloques[titulo].join('\n')}</div>
        </div>` : '';
      return `
        <div style="border:1px solid #ede9fe;border-radius:10px;padding:16px;margin-bottom:14px;background:#faf5ff;break-inside:avoid">
          <div style="font-weight:700;font-size:13px;color:#6d28d9;margin-bottom:12px;padding-bottom:8px;border-bottom:1.5px solid #ede9fe">
            👁️ ${ev.titulo||'Examen Visual'} — ${formatFecha(ev.fecha)}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 20px">
            ${blk('LENSOMETRÍA (anteojos actuales)')}
            ${blk('AGUDEZA VISUAL SIN CORRECCIÓN')}
            ${blk('COVER TEST')}
            ${blk('MOTILIDAD OCULAR EXTRÍNSECA')}
            ${blk('EXAMINACIÓN DE ACOMODACIÓN')}
            ${blk('REFRACCIÓN')}
            ${blk('PARÁMETROS DE ADAPTACIÓN')}
            ${blk('AGUDEZA VISUAL CON CORRECCIÓN')}
            ${blk('REFLEJOS PUPILARES')}
            ${blk('BIOMICROSCOPÍA')}
            ${blk('FONDO DE OJO')}
          </div>
          ${bloques['DIAGNÓSTICO']?`<div style="margin-top:10px;padding:10px;background:#fff;border-radius:6px;border:1px solid #ede9fe"><strong style="font-size:12px;color:#6d28d9">DIAGNÓSTICO</strong><p style="margin:4px 0 0;font-size:13px">${bloques['DIAGNÓSTICO'].join(' ')}</p></div>`:''}
          ${bloques['CORRECCIÓN RECOMENDADA']?`<div style="margin-top:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #ede9fe"><strong style="font-size:12px;color:#6d28d9">CORRECCIÓN RECOMENDADA</strong><p style="margin:4px 0 0;font-size:13px">${bloques['CORRECCIÓN RECOMENDADA'].join(' ')}</p></div>`:''}
          ${bloques['OBSERVACIONES']?`<div style="margin-top:8px;padding:10px;background:#fff;border-radius:6px;border:1px solid #ede9fe"><strong style="font-size:12px;color:#6d28d9">OBSERVACIONES</strong><p style="margin:4px 0 0;font-size:13px">${bloques['OBSERVACIONES'].join(' ')}</p></div>`:''}
        </div>`;
    }).join('') : '';

  const pie = `
    <div style="text-align:center;margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">
      Lumea Med — Sistema de Gestión Clínica | lumeamed.net · ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}
    </div>`;

  const body = cabecera + secPaciente + secExp + secExamen + secCitas + secMeds + secNotas + pie;
  pdfAbrir(`Expediente — ${p.nombre} ${p.apellidos}`, body, {orientation:'portrait'});
}

function switchTab(tabId, btn){
  if(tabId==='tab-examenes' && currentPatientId) renderExamenes(currentPatientId);
  ['tab-info','tab-citas-p','tab-meds-p','tab-notas-p','tab-expediente','tab-examenes','tab-historial-dental','tab-odontograma','tab-periodontograma','tab-procedimientos-p'].forEach(id=>{ const e=document.getElementById(id); if(e) e.style.display='none'; });
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById(tabId).style.display='block';
  if(btn) btn.classList.add('active');
}

// ════════════════════ CITAS ════════════════════
function citaBuscarPac(q) {
  const sug = document.getElementById('cita-pac-sug');
  if(!sug) return;
  const q2 = (q||'').toLowerCase().trim();
  const matches = q2.length < 1
    ? C.p.slice(0, 12)
    : C.p.filter(p =>
        (p.nombre+' '+p.apellidos).toLowerCase().includes(q2) ||
        (p.identificacion||'').toLowerCase().includes(q2) ||
        getExpedienteNum(p.id).toLowerCase().includes(q2)
      ).slice(0, 10);
  if(!matches.length) {
    sug.innerHTML =
      '<div style="padding:8px 14px;font-size:12px;color:var(--text-light);border-bottom:1px solid var(--border)">Sin resultados para "'+q+'"</div>'
      + '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;background:var(--primary-light);border-radius:0 0 10px 10px" onmousedown="nuevoPacienteParaCita(\''+q.replace(/'/g,"\\'")+'\')">'
      + '<span style="font-size:20px;flex-shrink:0">➕</span>'
      + '<div><div style="font-size:13px;font-weight:700;color:var(--primary)">Registrar como nuevo paciente</div>'
      + '<div style="font-size:11px;color:var(--primary);opacity:.8">Crea el expediente y abre la cita automáticamente</div></div></div>';
    sug.style.display = 'block';
    return;
  }
  sug.innerHTML = matches.map(p =>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseenter="this.style.background=\'var(--primary-light)\'" onmouseleave="this.style.background=\'\'" onmousedown="abrirCitaDesdeVista('+p.id+',\''+((p.nombre+' '+p.apellidos).replace(/'/g,"\\'"))+'\')">'
    + '<div style="width:32px;height:32px;border-radius:50%;background:'+colAvatar(p.id)+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">'+ini(p.nombre,p.apellidos)+'</div>'
    + '<div style="flex:1;min-width:0">'
    +   '<div style="font-size:13px;font-weight:600;color:var(--text)">'+p.nombre+' '+p.apellidos+'</div>'
    +   '<div style="font-size:11px;color:var(--text-light)"><span style="color:var(--primary);font-weight:600">'+getExpedienteNum(p.id)+'</span>'+(p.identificacion?' · '+p.identificacion:'')+(p.telefono?' · '+p.telefono:'')+'</div>'
    + '</div>'
    + '<span style="font-size:11px;font-weight:700;color:var(--primary);background:var(--primary-light);padding:2px 10px;border-radius:20px;flex-shrink:0;white-space:nowrap">+ Citar</span>'
    + '</div>'
  ).join('');
  sug.style.display = 'block';
}

function abrirCitaDesdeVista(pid, nombre) {
  const input = document.getElementById('cita-pac-buscar');
  if(input) input.value = '';
  const sug = document.getElementById('cita-pac-sug');
  if(sug) sug.style.display = 'none';
  openModalCita();
  setTimeout(() => setPacienteSelect('c-paciente', pid), 50);
}

function filtrarTablaCitas(q) {
  const q2 = (q||'').toLowerCase();
  document.querySelectorAll('.cita-historial-item').forEach(el => {
    el.style.display = (!q2 || (el.dataset.search||'').includes(q2)) ? '' : 'none';
  });
}

// ── CITAS TABS ──
let citasTab = 'calendario';
let citasTabFecha = '';

function switchCitasTab(tab) {
  citasTab = tab;
  ['fecha','calendario'].forEach(t => {
    const el = document.getElementById('ctab-'+t);
    if(el) el.classList.toggle('active', t===tab);
  });
  const pickerRow = document.getElementById('citas-fecha-picker-row');
  const tabLista  = document.getElementById('citas-tab-lista');
  const tabCal    = document.getElementById('citas-tab-calendario');
  if(pickerRow) pickerRow.style.display = tab==='fecha' ? 'flex' : 'none';
  if(tabLista)  tabLista.style.display  = tab==='calendario' ? 'none' : 'block';
  if(tabCal)    tabCal.style.display    = tab==='calendario' ? 'block' : 'none';

  if(tab==='fecha'){ if(citasTabFecha) renderCitasParaFecha(citasTabFecha); }
  else if(tab==='calendario'){ renderCalendar('citas-cal',true); renderCalDayCitas(selCalDate); }
}

function renderCitasParaFecha(fecha) {
  const citas = C.c.filter(c=>c.fecha===fecha).sort((a,b)=>a.hora.localeCompare(b.hora));
  const listaEl = document.getElementById('lista-citas-tab');
  const emptyEl = document.getElementById('citas-tab-empty');
  const emptyMsg = document.getElementById('citas-tab-empty-msg');
  if(!listaEl) return;
  if(!citas.length) {
    listaEl.innerHTML = '';
    if(emptyEl) { emptyEl.style.display='block'; if(emptyMsg) emptyMsg.textContent=`Sin citas para ${formatFecha(fecha)}`; }
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  listaEl.innerHTML = citas.map(c => {
    const p = C.p.find(x=>x.id===c.pacienteId);
    const esCompletada = c.estado==='completada';
    const esCancelada  = c.estado==='cancelada';
    return `<div class="cita-item ${c.estado}" style="gap:10px;flex-wrap:wrap">
      <div class="cita-time">${c.hora}</div>
      <div style="flex:1;min-width:0">
        <div class="cita-paciente">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div class="cita-motivo">${c.motivo}${c.tipo?` · <span class="tag tag-cyan" style="font-size:10px">${c.tipo}</span>`:''}</div>
      </div>
      ${esCompletada ? '<span class="acudio-badge">✅ Atendido</span>' : estadoTag(c.estado)}
      <div class="actions-cell" style="gap:6px;flex-wrap:wrap">
        <button class="btn btn-sm" style="background:var(--primary);color:#fff;font-size:15px;font-weight:800;padding:4px 10px;line-height:1" onclick="openModalCitaP(${c.pacienteId})" title="Nueva cita">+</button>
        ${!esCompletada&&!esCancelada?`<button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff;font-size:11px;font-weight:700;white-space:nowrap" onclick="marcarCitaCompletada(${c.id})">✅ Atendido</button>`:''}
        <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})" title="Ver hoja">📄</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function renderCitasFechaPersonalizada(fecha) {
  citasTabFecha = fecha;
  const cnt = document.getElementById('citas-fecha-count');
  if(cnt) cnt.textContent = '';
  renderCitasParaFecha(fecha);
  const n = C.c.filter(c=>c.fecha===fecha).length;
  if(cnt) cnt.textContent = n ? `${n} cita${n>1?'s':''}` : 'Sin citas';
}

function renderCitas(){
  // Renderizar tab activo (Calendario por defecto)
  switchCitasTab(citasTab);

  // Historial completo — flex rows (mismo patrón que Pacientes)
  const listaH = document.getElementById('historial-citas-lista');
  const empty  = document.getElementById('citas-empty');
  if(!C.c.length){ if(listaH) listaH.innerHTML=''; if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  if(listaH) listaH.innerHTML = [...C.c].sort((a,b)=>b.fecha.localeCompare(a.fecha)||a.hora.localeCompare(b.hora)).map(c=>{
    const p = C.p.find(x=>x.id===c.pacienteId);
    const esComp = c.estado==='completada';
    const [,mm,dd] = c.fecha.split('-');
    const search = ((p?p.nombre+' '+p.apellidos:'')+' '+c.motivo+' '+c.fecha).toLowerCase();
    return `<div class="cita-historial-item" data-search="${search}" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
      <div style="width:36px;flex-shrink:0;text-align:center;background:var(--primary-light);border-radius:8px;padding:5px 2px">
        <div style="font-size:13px;font-weight:800;color:var(--primary);line-height:1">${dd}</div>
        <div style="font-size:10px;color:var(--primary);text-transform:uppercase;font-weight:600">${MESES[parseInt(mm)-1]}</div>
      </div>
      <div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:32px;height:32px;font-size:11px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div style="font-size:11px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.motivo||'—'}</div>
      </div>
      ${esComp?'<span class="acudio-badge" style="flex-shrink:0">✅</span>':`<span style="flex-shrink:0">${estadoTag(c.estado)}</span>`}
      <div class="actions-cell" style="flex-shrink:0;gap:3px;flex-wrap:nowrap">
        <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})" title="Ver hoja">📄</button>
        <button class="btn btn-secondary btn-sm" onclick="openModalCita(${c.id})">✏️</button>
        <button class="btn btn-danger btn-sm" onclick="eliminarCita(${c.id})">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function fillMedicoSelect(selId, selectedId) {
  const medicos = C.prof.filter(p => ['medico','medico_admin','dr','dra','admin'].includes(p.rol));
  const sel = document.getElementById(selId);
  sel.innerHTML = '<option value="">Sin asignar</option>' +
    medicos.map(m=>`<option value="${m.id}">${m.icono||'👨‍⚕️'} ${m.nombre}</option>`).join('');
  if (selectedId) sel.value = selectedId;
  else if (['medico','medico_admin','admin'].includes(currentUser?.key)) sel.value = currentUser.id;
}

function _getMinHoraHoy() {
  const now = new Date();
  let h = now.getHours(), m = now.getMinutes();
  if(m === 0) { /* exact hour */ }
  else if(m <= 30) { m = 30; }
  else { m = 0; h += 1; }
  if(h > 22) return null;
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function fillHoraSelect(selectedValue, minHora = null) {
  const sel = document.getElementById('c-hora');
  sel.innerHTML = '<option value="">Seleccionar hora...</option>';
  for(let h = 6; h <= 22; h++) {
    for(let m = 0; m < 60; m += 30) {
      const h24 = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      const isPast = minHora && h24 < minHora;
      const period = h < 12 ? 'AM' : 'PM';
      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
      const opt = document.createElement('option');
      opt.value = h24;
      opt.textContent = `${h12}:${String(m).padStart(2,'0')} ${period}${isPast?' ⛔':''}`;
      if(h24 === selectedValue && !isPast) opt.selected = true;
      if(isPast) opt.disabled = true;
      sel.appendChild(opt);
    }
  }
}

function formatHora12(h24) {
  if(!h24) return '—';
  const parts = h24.split(':');
  const h = parseInt(parts[0]), m = parts[1]||'00';
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${period}`;
}

function openModalCita(id){
  const isMedico = currentUser?.key === 'medico';
  editingCitaId=id||null;
  document.getElementById('modal-cita-title').textContent=id?'✏️ Editar Cita':'📅 Nueva Cita';
  fillSelect('c-paciente');
  fillMedicoSelect('c-medico');
  const fechaEl = document.getElementById('c-fecha');
  fechaEl.value = hoy();
  fechaEl.min   = hoy();
  if(fechaEl._flatpickr) { fechaEl._flatpickr.set('minDate', 'today'); fechaEl._flatpickr.setDate(hoy(), false); }
  fillHoraSelect('', _getMinHoraHoy());
  ['motivo','notas'].forEach(f=>document.getElementById('c-'+f).value='');
  dxElegidos=[]; renderDxElegidos(); ocultarSugerenciasDx();
  document.getElementById('c-estado').value='pendiente';

  const esOptica = currentClinica?.tipo === 'optica';
  const motivoWrap = document.getElementById('c-motivo-wrap');
  if(motivoWrap) motivoWrap.style.display = esOptica ? 'none' : '';
  document.getElementById('c-tipo').value = esOptica ? 'examen_visual' : isOdontologo() ? 'odontologia' : 'consulta';
  const motivoInput = document.getElementById('c-motivo');
  if(motivoInput && isOdontologo()) motivoInput.placeholder = 'Escribe el procedimiento dental (ej: limpieza, conducto...)';
  const motivoLabel = motivoWrap?.querySelector('label');
  if(motivoLabel && isOdontologo()) motivoLabel.textContent = 'Procedimiento / Motivo *';

  // Restricción: médico solo puede crear citas en su propio nombre
  const medicoSel = document.getElementById('c-medico');
  if(isMedico && !isSuperAdmin()) {
    medicoSel.value = currentUser.id;
    medicoSel.disabled = true;
    medicoSel.style.opacity = '0.6';
  } else {
    medicoSel.disabled = false;
    medicoSel.style.opacity = '';
  }

  if(id){
    const c=C.c.find(x=>x.id===id);
    if(c){
      // Medico solo puede editar sus propias citas
      if(isMedico && !isSuperAdmin() && c.medicoId && c.medicoId !== currentUser.id) {
        toast('Solo puedes editar citas asignadas a ti','error');
        return;
      }
      if(fechaEl._flatpickr) fechaEl._flatpickr.set('minDate', null);
      setPacienteSelect('c-paciente', c.pacienteId);
      fechaEl.value=c.fecha;
      if(fechaEl._flatpickr) fechaEl._flatpickr.setDate(c.fecha, false);
      fillHoraSelect(c.hora, null);
      document.getElementById('c-motivo').value=c.motivo;
      document.getElementById('c-tipo').value=c.tipo;
      document.getElementById('c-estado').value=c.estado;
      document.getElementById('c-notas').value=c.notas||'';
      if(c.medicoId) medicoSel.value=c.medicoId;
    }
  }
  openModalOverlay('modal-cita');
}
function openModalCitaP(pid){ openModalCita(); setPacienteSelect('c-paciente', pid); }

async function guardarCita(){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const pid=parseInt(document.getElementById('c-paciente').value);
  const fecha=document.getElementById('c-fecha').value;
  const hora=document.getElementById('c-hora').value;
  const motivo=document.getElementById('c-motivo').value.trim();
  const esOptica = currentClinica?.tipo === 'optica';
  if(!pid||!fecha||!hora||(!motivo&&!esOptica)){ toast('Completa los campos obligatorios','error'); return; }
  if(!editingCitaId && fecha < hoy()){ toast('No se pueden agendar citas en fechas pasadas','error'); return; }
  if(!editingCitaId && fecha === hoy()) {
    const minH = _getMinHoraHoy();
    if(minH && hora < minH){ toast('No se puede agendar en un horario ya pasado','error'); return; }
  }
  const isMedico = currentUser?.key === 'medico';
  const medicoId = (isMedico && !isSuperAdmin()) ? currentUser.id : (document.getElementById('c-medico').value||null);
  const obj={pacienteId:pid,medicoId,fecha,hora,motivo,tipo:document.getElementById('c-tipo').value,estado:document.getElementById('c-estado').value,notas:document.getElementById('c-notas').value.trim()};
  setLoading(true);
  let err;
  if(editingCitaId){ const r=await sb.from('citas').update(toC(obj)).eq('id',editingCitaId); err=r.error; }
  else { const r=await sb.from('citas').insert([toC(obj)]); err=r.error; }
  setLoading(false);
  if(err){ toast('Error: '+err.message,'error'); return; }
  toast(editingCitaId?'Cita actualizada':'Cita registrada ✅');
  if(!editingCitaId) logActivity('cita');
  closeModal('modal-cita');
  await loadAll();
  renderView(currentView);
  updateBadges();
}

async function eliminarCita(id){
  const ok=await customConfirm({icon:'📅',title:'Eliminar cita',msg:'¿Eliminar esta cita? Esta acción no se puede deshacer.',okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('citas').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Cita eliminada');
  await loadAll(); renderCitas();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
  updateBadges();
}

function registrarAcudidoPaciente(pid){
  const h=hoy();
  const p=C.p.find(x=>x.id===pid);
  const nombre=p?p.nombre+' '+p.apellidos:'El paciente';
  const citasHoy=C.c.filter(c=>c.pacienteId===pid&&c.fecha===h&&c.estado!=='completada'&&c.estado!=='cancelada');
  if(!citasHoy.length){
    toast(`${p?.nombre||'El paciente'} no tiene citas pendientes hoy`,'info');
    return;
  }
  if(citasHoy.length===1){ marcarCitaCompletada(citasHoy[0].id); return; }
  document.getElementById('acudio-picker-title').textContent=`✅ Citas de ${p?.nombre||'Paciente'} hoy`;
  document.getElementById('acudio-picker-lista').innerHTML=citasHoy.map(c=>`
    <div class="cita-item ${c.estado}" style="cursor:pointer;margin-bottom:8px" onclick="closeModal('modal-acudio-picker');marcarCitaCompletada(${c.id})">
      <div class="cita-time">${c.hora}</div>
      <div class="cita-info"><div class="cita-paciente">${c.motivo}</div><div class="cita-motivo">${c.tipo}</div></div>
      ${estadoTag(c.estado)}
      <span style="color:var(--success);font-size:20px;flex-shrink:0">✅</span>
    </div>`).join('');
  document.getElementById('modal-acudio-picker').classList.add('open');
}

async function marcarCitaCompletada(id){
  const c=C.c.find(x=>x.id===id); if(!c) return;
  const p=C.p.find(x=>x.id===c.pacienteId);
  const nombre=p?p.nombre+' '+p.apellidos:'el paciente';
  const ok=await customConfirm({icon:'✅',title:'Confirmar asistencia',msg:`¿Confirmar que <strong>${nombre}</strong> acudió a la cita correctamente?`,okText:'Confirmar asistencia',danger:false});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('citas').update({estado:'completada'}).eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  atendidosFecha=c.fecha;
  toast(`Cita de ${nombre} marcada como completada ✅`,'success');
  await loadAll(); renderView(currentView); updateBadges();
  // Abrir nota de evolución automáticamente
  setTimeout(() => abrirNotaEvolucion(c.pacienteId, c), 400);
}

function abrirNotaEvolucion(pacienteId, cita) {
  editingNotaId = null;
  document.getElementById('modal-nota-title').textContent = '📝 Nota de Evolución';
  fillSelect('n-paciente');
  setPacienteSelect('n-paciente', pacienteId);
  document.getElementById('n-tipo').value = 'evolucion';
  document.getElementById('n-fecha').value = hoy();
  document.getElementById('n-titulo').value = `Consulta ${formatFecha(hoy())}`;
  const motivo = cita?.motivo ? `Motivo de consulta: ${cita.motivo}\n\n` : '';
  document.getElementById('n-contenido').value = motivo;
  openModalOverlay('modal-nota');
  setTimeout(() => document.getElementById('n-contenido').focus(), 150);
}

// ════════════════════ MEDICACIONES ════════════════════
function renderMedicaciones(){
  const el=document.getElementById('tabla-medicaciones'), empty=document.getElementById('meds-empty');
  if(!C.m.length){ el.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  el.innerHTML=[...C.m].sort((a,b)=>(b.inicio||'').localeCompare(a.inicio||'')).map(x=>{
    const p=C.p.find(q=>q.id===x.pacienteId);
    const [,mm,dd]=(x.inicio||hoy()).split('-');
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
      <div style="width:36px;flex-shrink:0;text-align:center;background:var(--primary-light);border-radius:8px;padding:5px 2px">
        <div style="font-size:13px;font-weight:800;color:var(--primary);line-height:1">${dd}</div>
        <div style="font-size:10px;color:var(--primary);text-transform:uppercase;font-weight:600">${MESES[parseInt(mm)-1]}</div>
      </div>
      <div class="patient-avatar" style="background:${colAvatar(x.pacienteId||0)};width:32px;height:32px;font-size:11px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${x.nombre}</div>
        <div style="font-size:11px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'Desconocido'} · ${x.frecuencia}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        ${estadoTag(x.estado)}
        <div class="actions-cell" style="gap:3px;flex-wrap:nowrap">
          <button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirRecetaPaciente(${x.pacienteId})" title="Imprimir receta">🖨️</button>
          <button class="btn btn-secondary btn-sm" onclick="openModalMedicacion(${x.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarMedicacion(${x.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

const DOSIS_UNIDADES = ['tableta(s)','cápsula(s)','mg','g','mcg','ml','oz','gota(s)','UI','sobre(s)','ampolleta(s)','supositorio(s)','parche(s)','inhalación(es)','aplicación(es)'];

function parseDosisStr(d) {
  if(!d) return {qty:'1', unit:'tableta(s)'};
  const m = d.match(/^([\d.\/]+)\s*(.+)$/);
  if(m) {
    const num = m[1];
    const raw = m[2].toLowerCase().trim();
    if(raw.startsWith('tab')) return {qty:num, unit:'tableta(s)'};
    if(raw.startsWith('cap') || raw.startsWith('cáp')) return {qty:num, unit:'cápsula(s)'};
    if(raw === 'mg' || raw.startsWith('mg/')) return {qty:num, unit:'mg'};
    if(raw === 'g' || raw === 'gr') return {qty:num, unit:'g'};
    if(raw === 'mcg' || raw === 'μg' || raw === 'ug') return {qty:num, unit:'mcg'};
    if(raw === 'ml' || raw.startsWith('ml/')) return {qty:num, unit:'ml'};
    if(raw === 'oz') return {qty:num, unit:'oz'};
    if(raw.startsWith('gota')) return {qty:num, unit:'gota(s)'};
    if(raw === 'ui' || raw === 'u.i.') return {qty:num, unit:'UI'};
    if(raw.startsWith('ampo')) return {qty:num, unit:'ampolleta(s)'};
    if(raw.startsWith('sobre')) return {qty:num, unit:'sobre(s)'};
    if(raw.startsWith('supo')) return {qty:num, unit:'supositorio(s)'};
    if(raw.startsWith('par')) return {qty:num, unit:'parche(s)'};
    if(raw.startsWith('inha')) return {qty:num, unit:'inhalación(es)'};
    const found = DOSIS_UNIDADES.find(u => u.toLowerCase().startsWith(raw.split('(')[0]));
    return {qty:num, unit: found || raw};
  }
  if(/^[\d.]+$/.test(d)) return {qty:d, unit:'tableta(s)'};
  return {qty:'1', unit:'tableta(s)'};
}

let medItems = [];

function openModalMedicacion(id) {
  editingMedId = id || null;
  document.getElementById('modal-med-title').textContent = id ? '✏️ Editar Medicación' : '💊 Nueva Receta';
  fillSelect('m-paciente');
  document.getElementById('m-estado').value = 'activa';
  document.getElementById('m-inicio').value = hoy();
  document.getElementById('m-fin').value = '';
  if(id) {
    const m = C.m.find(x => x.id === id);
    if(m) {
      setPacienteSelect('m-paciente', m.pacienteId);
      document.getElementById('m-inicio').value = m.inicio || '';
      document.getElementById('m-fin').value = m.fin || '';
      document.getElementById('m-estado').value = m.estado;
      const dp = parseDosisStr(m.dosis);
      medItems = [{nombre:m.nombre, dosisQty:dp.qty, dosisUnit:dp.unit, frecuencia:m.frecuencia, via:m.via||'oral', indicaciones:m.indicaciones||''}];
    }
  } else {
    medItems = [{nombre:'', dosisQty:'1', dosisUnit:'tableta(s)', frecuencia:'Cada 8 horas', via:'oral', indicaciones:''}];
  }
  document.getElementById('btn-add-med-item').style.display = editingMedId ? 'none' : 'inline-flex';
  renderMedItems();
  openModalOverlay('modal-medicacion');
}
function openModalMedP(pid) { openModalMedicacion(); setPacienteSelect('m-paciente', pid); }

function renderMedItems() {
  const container = document.getElementById('med-items-list');
  if(!container) return;
  const vias = [['oral','Oral'],['inyectable','Inyectable'],['topica','Tópica'],['inhalada','Inhalada'],['sublingual','Sublingual'],['otra','Otra']];
  container.innerHTML = medItems.map((item, i) =>
    '<div style="border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px;background:var(--bg)">'
    + (medItems.length > 1 ? '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><span style="font-size:12px;font-weight:700;color:var(--primary);text-transform:uppercase;letter-spacing:.5px">Medicamento ' + (i+1) + '</span><button type="button" onclick="removeMedItem('+i+')" style="background:#FEE2E2;border:none;cursor:pointer;color:#B91C1C;font-size:12px;font-weight:700;padding:3px 9px;border-radius:6px">× Quitar</button></div>' : '')
    + '<div class="form-grid">'
    +   '<div class="form-group full" style="position:relative">'
    +     '<label>Medicamento *</label>'
    +     '<input type="text" id="mi-nombre-'+i+'" value="'+escAttr(item.nombre)+'" placeholder="Buscar medicamento..." autocomplete="off" oninput="medItems['+i+'].nombre=this.value;buscarMedItem(this.value,'+i+')" onblur="setTimeout(()=>hideMedItemSug('+i+'),180)">'
    +     '<div id="mi-sug-'+i+'" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--card);border:1.5px solid var(--primary);border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.15);z-index:400;max-height:200px;overflow-y:auto;margin-top:4px"></div>'
    +   '</div>'
    +   '<div class="form-group"><label>Dosificación *</label><div style="display:flex;gap:8px">'
    +     '<input type="number" id="mi-dosis-qty-'+i+'" value="'+(item.dosisQty||1)+'" min="0.25" step="0.25" style="width:80px;flex-shrink:0" oninput="medItems['+i+'].dosisQty=this.value">'
    +     '<select id="mi-dosis-unit-'+i+'" style="flex:1" onchange="medItems['+i+'].dosisUnit=this.value">'+DOSIS_UNIDADES.map(u=>'<option value="'+u+'"'+((item.dosisUnit||'tableta(s)')===u?' selected':'')+'>'+u+'</option>').join('')+'</select>'
    +   '</div></div>'
    +   '<div class="form-group"><label>Frecuencia *</label><select id="mi-freq-'+i+'" onchange="medItems['+i+'].frecuencia=this.value">'
    +     ['Cada 4 horas','Cada 8 horas','Cada 12 horas','Cada 24 horas','Cada 2 días','Cada 3 días','1 vez al día','Una vez con alimentos','En ayunas','Al almorzar','Al cenar','Antes de dormir'].map(f=>'<option value="'+f+'"'+(item.frecuencia===f?' selected':'')+'>'+f+'</option>').join('')
    +     '</select></div>'
    +   '<div class="form-group"><label>Vía</label><select id="mi-via-'+i+'" onchange="medItems['+i+'].via=this.value">'+vias.map(([v,l])=>'<option value="'+v+'"'+(item.via===v?' selected':'')+'>'+l+'</option>').join('')+'</select></div>'
    +   '<div class="form-group full"><label>Indicaciones</label><input type="text" id="mi-ind-'+i+'" value="'+escAttr(item.indicaciones)+'" placeholder="Tomar con alimentos..." oninput="medItems['+i+'].indicaciones=this.value"></div>'
    + '</div></div>'
  ).join('');
}

function addMedItem() {
  medItems.push({nombre:'', dosisQty:'1', dosisUnit:'tableta(s)', frecuencia:'Cada 8 horas', via:'oral', indicaciones:''});
  renderMedItems();
}

function removeMedItem(i) {
  if(medItems.length <= 1) return;
  medItems.splice(i, 1);
  renderMedItems();
}

function buscarMedItem(q, idx) {
  const box = document.getElementById('mi-sug-'+idx);
  if(!box) return;
  if(!q || q.length < 2) { box.style.display='none'; return; }
  const q2 = q.toLowerCase();
  const base = MEDICAMENTOS_NI.filter(m => m.n.toLowerCase().includes(q2) || m.p.toLowerCase().includes(q2)).slice(0, 6);
  const matches = _mergeConMinsa(base, q2);
  if(!matches.length) { box.style.display='none'; return; }
  box.innerHTML = matches.map(m => {
    const codBadge = m.cod ? `<span style="font-family:monospace;font-size:10px;background:var(--bg);padding:0 3px;border-radius:3px;border:1px solid var(--border);margin-right:4px">${m.cod}</span>` : '';
    const sub = codBadge + m.p + (m.d ? ' · ' + m.d : '');
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseenter="this.style.background=\'var(--primary-light)\'" onmouseleave="this.style.background=\'\'" onmousedown="seleccionarMedItem('+JSON.stringify(m).replace(/"/g,'&quot;')+','+idx+')">'
      + '<div><div style="font-size:13px;font-weight:600;color:var(--text)">'+m.n+'</div><div style="font-size:11px;color:var(--text-light);margin-top:1px">'+sub+'</div></div>'
      + '<span class="tag tag-gray" style="font-size:10px;flex-shrink:0;margin-left:10px">'+m.v+'</span>'
      + '</div>';
  }).join('');
  box.style.display = 'block';
}

function hideMedItemSug(idx) {
  const box = document.getElementById('mi-sug-'+idx);
  if(box) box.style.display = 'none';
}

function seleccionarMedItem(m, idx) {
  medItems[idx].nombre = m.n;
  const dp = parseDosisStr(m.d);
  medItems[idx].dosisQty = dp.qty;
  medItems[idx].dosisUnit = dp.unit;
  const viaMap = {oral:'oral',inyectable:'inyectable',topica:'topica',inhalada:'inhalada',sublingual:'sublingual'};
  medItems[idx].via = viaMap[m.v] || 'oral';
  hideMedItemSug(idx);
  renderMedItems();
  setTimeout(() => { const el = document.getElementById('mi-freq-'+idx); if(el) el.focus(); }, 50);
}

async function guardarMedicacion() {
  if(!currentClinicaId) { toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const pid = parseInt(document.getElementById('m-paciente').value);
  if(!pid) { toast('Selecciona un paciente','error'); return; }
  const inicio = document.getElementById('m-inicio').value;
  const fin = document.getElementById('m-fin').value;
  const estado = document.getElementById('m-estado').value;
  const buildDosis = item => ((item.dosisQty||'1') + ' ' + (item.dosisUnit||'tableta(s)')).trim();
  if(editingMedId) {
    const item = medItems[0];
    if(!item.nombre||!item.dosisQty||!item.frecuencia) { toast('Completa nombre, dosificación y frecuencia','error'); return; }
    const obj = {pacienteId:pid,nombre:item.nombre,dosis:buildDosis(item),frecuencia:item.frecuencia,inicio,fin,via:item.via,estado,indicaciones:item.indicaciones};
    setLoading(true);
    const {error} = await sb.from('medicaciones').update(toM(obj)).eq('id',editingMedId);
    setLoading(false);
    if(error) { toast('Error: '+error.message,'error'); return; }
    toast('Medicación actualizada');
    logActivity('medicacion');
  } else {
    const valid = medItems.filter(item => item.nombre && item.dosisQty && item.frecuencia);
    if(!valid.length) { toast('Agrega al menos un medicamento con nombre, dosificación y frecuencia','error'); return; }
    const rows = valid.map(item => toM({pacienteId:pid,nombre:item.nombre,dosis:buildDosis(item),frecuencia:item.frecuencia,inicio,fin,via:item.via,estado,indicaciones:item.indicaciones}));
    setLoading(true);
    const {error} = await sb.from('medicaciones').insert(rows);
    setLoading(false);
    if(error) { toast('Error: '+error.message,'error'); return; }
    toast(rows.length > 1 ? rows.length+' medicamentos registrados ✅' : 'Medicación registrada ✅');
    logActivity('medicacion');
  }
  closeModal('modal-medicacion');
  await loadAll(); renderMedicaciones();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

async function eliminarMedicacion(id){
  const ok=await customConfirm({icon:'💊',title:'Eliminar medicación',msg:'¿Eliminar esta medicación? Se perderá el registro permanentemente.',okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('medicaciones').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Medicación eliminada');
  await loadAll(); renderMedicaciones();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

// ════════════════════ NOTAS ════════════════════
const NOTA_TIPO_ICON = {
  evolucion:'📋', resumen_clinico:'🩺', diagnostico:'🔬', tratamiento:'💊', laboratorio:'🧪',
  imagen:'🩻', cirugia:'🔪', alta:'🏠', examen_visual:'👁️',
  odontologia:'🦷', receta:'📄', interconsulta:'🔄', otro:'📌'
};
// Etiqueta legible del tipo de nota (resumen_clinico -> Resumen clínico)
const NOTA_TIPO_LABEL = {
  evolucion:'Evolución', resumen_clinico:'Resumen clínico', diagnostico:'Diagnóstico',
  tratamiento:'Tratamiento', laboratorio:'Laboratorio', imagen:'Imagen / Radiología',
  cirugia:'Cirugía', alta:'Alta médica', examen_visual:'Examen visual',
  odontologia:'Odontología', receta:'Receta', interconsulta:'Interconsulta', otro:'Otro'
};
const notaTipoLabel = t => NOTA_TIPO_LABEL[t] || (t||'').replace(/_/g,' ');

// Resumen de una línea de los signos vitales, para listados
function _signosResumen(signos) {
  if(!signos) return '';
  return SIGNOS_VITALES
    .filter(sv => signos[sv.k] != null && String(signos[sv.k]).trim() !== '')
    .map(sv => `${sv.lbl} ${signos[sv.k]}${sv.uni && sv.uni !== 'mmHg' ? ' '+sv.uni : ''}`)
    .join(' · ');
}

function renderNotas(){
  // Badge de clínica
  const badgeEl = document.getElementById('notas-clinic-badge-container');
  if(badgeEl && currentClinica) {
    badgeEl.innerHTML = `<span class="notas-clinic-badge">🏥 ${currentClinica.nombre}</span>`;
  }

  const el=document.getElementById('tabla-notas'), empty=document.getElementById('notas-empty');
  if(!C.n.length){ el.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  el.innerHTML=[...C.n].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(n=>{
    const p=C.p.find(x=>x.id===n.pacienteId);
    const base=(n.contenido||'').trim() || _signosResumen(n.signos);
    const prev=base.length>60?base.substring(0,60)+'…':base;
    const tipoIcon = NOTA_TIPO_ICON[n.tipo] || '📝';
    const [,mm,dd]=(n.fecha||hoy()).split('-');
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-bottom:1px solid var(--border)">
      <div style="width:36px;flex-shrink:0;text-align:center;background:var(--primary-light);border-radius:8px;padding:5px 2px">
        <div style="font-size:13px;font-weight:800;color:var(--primary);line-height:1">${dd}</div>
        <div style="font-size:10px;color:var(--primary);text-transform:uppercase;font-weight:600">${MESES[parseInt(mm)-1]}</div>
      </div>
      <div class="patient-avatar" style="background:${colAvatar(n.pacienteId||0)};width:32px;height:32px;font-size:11px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div style="font-size:11px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${n.titulo||prev}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
        <span class="tag tag-blue" style="font-size:10px">${tipoIcon} ${n.tipo}</span>
        <div class="actions-cell" style="gap:3px;flex-wrap:nowrap">
          <button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff" onclick="imprimirNota(${n.id})">🖨️</button>
          <button class="btn btn-secondary btn-sm" onclick="verNota(${n.id})">👁️</button>
          <button class="btn btn-secondary btn-sm" onclick="openModalNota(${n.id})">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarNota(${n.id})">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

// ── Signos vitales del Resumen Clínico (todos opcionales) ──
const SIGNOS_VITALES = [
  { k:'pa',      id:'n-sv-pa',      lbl:'Presión',      uni:'mmHg'  },
  { k:'fc',      id:'n-sv-fc',      lbl:'Frec. card.',  uni:'lpm'   },
  { k:'fr',      id:'n-sv-fr',      lbl:'Frec. resp.',  uni:'rpm'   },
  { k:'temp',    id:'n-sv-temp',    lbl:'Temp.',        uni:'°C'    },
  { k:'spo2',    id:'n-sv-spo2',    lbl:'Sat. O₂',      uni:'%'     },
  { k:'glucosa', id:'n-sv-glucosa', lbl:'Glucosa',      uni:'mg/dL' },
  { k:'peso',    id:'n-sv-peso',    lbl:'Peso',         uni:'kg'    },
  { k:'talla',   id:'n-sv-talla',   lbl:'Talla',        uni:'cm'    },
];

// Muestra el panel solo en el Resumen Clínico; ahí el texto deja de ser obligatorio
function onTipoNotaChange() {
  const esResumen = document.getElementById('n-tipo')?.value === 'resumen_clinico';
  const wrap = document.getElementById('n-signos-wrap');
  if(wrap) wrap.style.display = esResumen ? '' : 'none';
  const req = document.getElementById('n-contenido-req');
  if(req) req.style.display = esResumen ? 'none' : '';
}

function _limpiarSignosNota() {
  SIGNOS_VITALES.forEach(sv => { const e = document.getElementById(sv.id); if(e) e.value = ''; });
  calcIMCNota();
}

function _cargarSignosNota(signos) {
  SIGNOS_VITALES.forEach(sv => {
    const e = document.getElementById(sv.id);
    if(e) e.value = (signos && signos[sv.k] != null) ? signos[sv.k] : '';
  });
  calcIMCNota();
}

// Devuelve solo los signos rellenados, o null si no se midió ninguno
function _leerSignosNota() {
  const out = {};
  SIGNOS_VITALES.forEach(sv => {
    const v = (document.getElementById(sv.id)?.value || '').trim();
    if(v !== '') out[sv.k] = v;
  });
  return Object.keys(out).length ? out : null;
}

function calcIMCNota() {
  const out = document.getElementById('n-sv-imc');
  if(!out) return;
  const peso  = parseFloat(document.getElementById('n-sv-peso')?.value);
  const talla = parseFloat(document.getElementById('n-sv-talla')?.value);
  if(!peso || !talla) { out.textContent = ''; return; }
  const imc = peso / ((talla/100) ** 2);
  if(!isFinite(imc) || imc <= 0) { out.textContent = ''; return; }
  const cat = imc < 18.5 ? 'bajo peso' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad';
  out.textContent = `IMC ${imc.toFixed(1)} · ${cat}`;
}

// Tarjetas de signos vitales para ver la nota en pantalla
function _signosChipsHTML(signos) {
  if(!signos) return '';
  const chips = SIGNOS_VITALES
    .filter(sv => signos[sv.k] != null && String(signos[sv.k]).trim() !== '')
    .map(sv => `<div class="sv-chip"><div class="sv-chip-val">${signos[sv.k]}</div><div class="sv-chip-lbl">${sv.lbl}${sv.uni?' · '+sv.uni:''}</div></div>`);
  if(!chips.length) return '';
  const imc = _imcDeSignos(signos);
  if(imc) chips.push(`<div class="sv-chip"><div class="sv-chip-val">${imc.valor}</div><div class="sv-chip-lbl">IMC · ${imc.cat}</div></div>`);
  return `<div class="sv-chips">${chips.join('')}</div>`;
}

function _imcDeSignos(signos) {
  const peso = parseFloat(signos?.peso), talla = parseFloat(signos?.talla);
  if(!peso || !talla) return null;
  const imc = peso / ((talla/100) ** 2);
  if(!isFinite(imc) || imc <= 0) return null;
  return { valor: imc.toFixed(1), cat: imc < 18.5 ? 'bajo peso' : imc < 25 ? 'normal' : imc < 30 ? 'sobrepeso' : 'obesidad' };
}

// Versión con estilos embebidos para los PDF, que no cargan styles.css
function _signosPrintHTML(signos) {
  if(!signos) return '';
  const items = SIGNOS_VITALES
    .filter(sv => signos[sv.k] != null && String(signos[sv.k]).trim() !== '')
    .map(sv => ({ val: signos[sv.k], lbl: sv.lbl + (sv.uni ? ' · ' + sv.uni : '') }));
  if(!items.length) return '';
  const imc = _imcDeSignos(signos);
  if(imc) items.push({ val: imc.valor, lbl: 'IMC · ' + imc.cat });
  return '<div class="section-title">&#129658; Signos vitales</div>'
    + '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px">'
    + items.map(i => '<div style="flex:0 0 auto;min-width:84px;text-align:center;padding:9px 12px;border:1.5px solid #e2e8f0;border-radius:8px">'
        + '<div style="font-size:17px;font-weight:800;color:#0f172a">'+i.val+'</div>'
        + '<div style="font-size:10px;color:#64748b;margin-top:2px">'+i.lbl+'</div></div>').join('')
    + '</div>';
}

function openModalNota(id){
  editingNotaId=id||null;
  document.getElementById('modal-nota-title').textContent=id?'✏️ Editar Nota':'📝 Nueva Nota Clínica';
  fillSelect('n-paciente');
  document.getElementById('n-tipo').value='evolucion'; document.getElementById('n-fecha').value=hoy(); document.getElementById('n-titulo').value=''; document.getElementById('n-contenido').value='';
  _limpiarSignosNota();
  if(id){
    const n=C.n.find(x=>x.id===id);
    if(n){ setPacienteSelect('n-paciente',n.pacienteId); document.getElementById('n-tipo').value=n.tipo; document.getElementById('n-fecha').value=n.fecha; document.getElementById('n-titulo').value=n.titulo||''; document.getElementById('n-contenido').value=n.contenido; _cargarSignosNota(n.signos); }
  }
  onTipoNotaChange();
  openModalOverlay('modal-nota');
}
function openModalNotaP(pid){ openModalNota(); setPacienteSelect('n-paciente', pid); }

async function guardarNota(){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const pid=parseInt(document.getElementById('n-paciente').value);
  const contenido=document.getElementById('n-contenido').value.trim();
  const tipo=document.getElementById('n-tipo').value;
  const esResumen=tipo==='resumen_clinico';
  // Los signos solo se guardan en el Resumen Clínico, y solo los que se midieron
  const signos=esResumen?_leerSignosNota():null;
  if(!pid){ toast('Selecciona un paciente','error'); return; }
  // En el Resumen Clínico basta con registrar signos vitales; en el resto el texto es obligatorio
  if(!contenido && !(esResumen && signos)){
    toast(esResumen?'Registra al menos un signo vital o escribe la nota':'Completa los campos obligatorios','error');
    return;
  }
  const obj={pacienteId:pid,tipo,fecha:document.getElementById('n-fecha').value||hoy(),titulo:document.getElementById('n-titulo').value.trim(),contenido,signos};
  setLoading(true);
  let err;
  if(editingNotaId){ const r=await sb.from('notas').update(toN(obj)).eq('id',editingNotaId); err=r.error; }
  else { const r=await sb.from('notas').insert([toN(obj)]); err=r.error; }
  setLoading(false);
  if(err){ toast('Error: '+err.message,'error'); return; }
  toast(editingNotaId?'Nota actualizada':'Nota guardada ✅');
  if(!editingNotaId) logActivity('nota');
  closeModal('modal-nota');
  await loadAll(); renderNotas();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

async function eliminarNota(id){
  const ok=await customConfirm({icon:'📝',title:'Eliminar nota clínica',msg:'¿Eliminar esta nota clínica? Esta acción no se puede deshacer.',okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error}=await sb.from('notas').delete().eq('id',id);
  setLoading(false);
  if(error){ toast('Error: '+error.message,'error'); return; }
  toast('Nota eliminada');
  await loadAll(); renderNotas();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
}

function verNota(id){
  currentNotaId = id;
  const n=C.n.find(x=>x.id===id), p=C.p.find(x=>x.id===n.pacienteId);
  document.getElementById('ver-nota-title').textContent=`📝 ${n.titulo||'Nota Clínica'}`;
  document.getElementById('ver-nota-content').innerHTML=`
    <div style="margin-bottom:14px"><span class="tag tag-blue">${n.tipo}</span><span style="margin-left:8px;font-size:12px;color:var(--text-light)">${formatFecha(n.fecha)}</span></div>
    ${p?`<p class="text-light" style="margin-bottom:12px">Paciente: <strong style="color:var(--text)">${p.nombre} ${p.apellidos}</strong></p>`:''}
    ${n.titulo?`<h3 style="margin-bottom:12px">${n.titulo}</h3>`:''}
    ${_signosChipsHTML(n.signos)}
    ${n.contenido?`<div style="white-space:pre-wrap;line-height:1.8;font-size:14px;background:var(--bg);padding:16px;border-radius:10px;border:1px solid var(--border)">${n.contenido}</div>`:''}`;
  document.getElementById('modal-ver-nota').classList.add('open');
}

function imprimirNota(id) {
  const n = C.n.find(x => x.id === id); if(!n) return;
  const p = C.p.find(x => x.id === n.pacienteId);
  const cfg = getClinicaConfig();
  const fmtF = f => { if(!f) return '—'; const d=new Date(f+'T12:00:00'); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); };
  const tipoColor = {evolucion:'#1D4ED8',resumen_clinico:'#0E7490',diagnostico:'#7C3AED',tratamiento:'#059669',laboratorio:'#D97706',imagen:'#0891B2',cirugia:'#DC2626',alta:'#065F46',otro:'#475569'}[n.tipo]||'#1D4ED8';

  const ini2 = (a,b) => ((a||'')[0]||'').toUpperCase()+((b||'')[0]||'').toUpperCase();
  const tipoTxt = (n.tipo||'').replace(/_/g,' ').toUpperCase();
  const body = '<div class="badge-tipo" style="background:'+tipoColor+'">📝 '+tipoTxt+'</div>'
    + (n.titulo?'<div style="font-size:20px;font-weight:900;color:#0F172A;margin-bottom:6px">'+n.titulo+'</div>':'')
    + '<div class="patient-box" style="margin-bottom:20px">'
    +   '<div class="patient-av">'+(p?ini2(p.nombre,p.apellidos):'?')+'</div>'
    +   '<div style="flex:1">'
    +     '<div class="patient-name">'+(p?p.nombre+' '+p.apellidos:'Paciente no registrado')+'</div>'
    +     '<div class="patient-meta">'
    +       (p?.identificacion?'<span>&#128266; '+p.identificacion+'</span>':'')
    +       (p?.fechaNac?'<span>&#127874; '+calcEdad(p.fechaNac)+'</span>':'')
    +       (p?.sexo?'<span>'+(p.sexo==='M'?'&#9794; Masculino':p.sexo==='F'?'&#9792; Femenino':p.sexo)+'</span>':'')
    +       (p?.telefono?'<span>&#128222; '+p.telefono+'</span>':'')
    +     '</div>'
    +     (p?.alergias?'<div style="margin-top:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:5px 10px;font-size:11px;color:#DC2626;font-weight:600">&#9888; Alergias: '+p.alergias+'</div>':'')
    +   '</div>'
    + '</div>'
    + '<div class="section-title">&#128203; Datos de la nota</div>'
    + '<table><tbody>'
    +   '<tr><td style="width:130px;font-weight:700;color:#475569">Fecha</td><td>'+fmtF(n.fecha)+'</td><td style="width:130px;font-weight:700;color:#475569">Tipo</td><td><span class="tag tag-blue">'+n.tipo+'</span></td></tr>'
    +   '<tr><td style="font-weight:700;color:#475569">N&deg; Nota</td><td colspan="3">NC-'+n.id+'</td></tr>'
    + '</tbody></table>'
    + _signosPrintHTML(n.signos)
    + (n.contenido ? '<div class="section-title">&#128203; Contenido de la nota</div>'
        + '<div class="note-box" style="border-left-color:'+tipoColor+'"><div class="note-body">'+n.contenido+'</div></div>' : '')
    + '<div class="sig-wrap"><div class="sig-box">'+_firmaImgHTML(46)+'<div class="sig-line"></div>'
    +   '<div class="sig-name">'+(currentUser?.name||cfg.nombreDoctor||'M&#233;dico Responsable')+'</div>'
    +   (especialidadFirma(cfg)?'<div class="sig-role">'+especialidadFirma(cfg)+'</div>':'')
    +   (cfg.registro?'<div class="sig-role">Reg. Med. '+cfg.registro+'</div>':'')
    + '</div></div>';
  pdfAbrir('Nota Clínica — '+(n.titulo||n.tipo), body, cfg);
}

// ════════════════════ RECETA ELECTRÓNICA (IMPRESIÓN) ════════════════════
function imprimirReceta(id) {
  const m = C.m.find(x => x.id === id); if(!m) return;
  imprimirRecetaPaciente(m.pacienteId);
}

function imprimirRecetaPaciente(pid) {
  const p = C.p.find(x => x.id === pid);
  const e = C.e.find(x => x.pacienteId === pid);
  const meds = C.m.filter(m => m.pacienteId === pid && m.estado === 'activa')
    .sort((a,b) => (a.nombre||'').localeCompare(b.nombre||''));
  if(!meds.length) { toast('Este paciente no tiene medicaciones activas','info'); return; }
  const cfg = getClinicaConfig();
  const fmtF = f => { if(!f) return '—'; const d=new Date(f+'T12:00:00'); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); };
  const viaLabel = v => ({oral:'Oral',inyectable:'Inyectable',topica:'Tópica',inhalada:'Inhalada',sublingual:'Sublingual',otra:'Otra'})[v||'oral'] || v || 'Oral';
  const pNombre = p ? p.nombre+' '+p.apellidos : 'Paciente no registrado';
  const pIni = p ? ini(p.nombre, p.apellidos) : '?';
  const pEdad = (p && p.fechaNac) ? calcEdad(p.fechaNac) : '';
  const eSexo = p ? (p.sexo==='M' ? '&#9794; Masculino' : p.sexo==='F' ? '&#9792; Femenino' : (p.sexo||'')) : '';

  const body = '<div class="badge-tipo" style="background:#059669">&#128138; RECETA ELECTR&#211;NICA</div>'
    + '<div style="font-size:11px;color:#64748B;font-weight:600;margin-bottom:18px">Fecha de emisi&#243;n: '+fmtF(hoy())+' &middot; N&deg; RX-'+Date.now().toString().slice(-6)+'</div>'
    + '<div class="patient-box">'
    +   '<div class="patient-av">'+pIni+'</div>'
    +   '<div style="flex:1">'
    +     '<div class="patient-name">'+pNombre+'</div>'
    +     '<div class="patient-meta">'
    +       (p && p.identificacion ? '<span>&#128266; '+p.identificacion+'</span>' : '')
    +       (pEdad ? '<span>'+pEdad+'</span>' : '')
    +       (eSexo ? '<span>'+eSexo+'</span>' : '')
    +       (p && p.telefono ? '<span>&#128222; '+p.telefono+'</span>' : '')
    +       (e && e.peso ? '<span>'+e.peso+' kg</span>' : '')
    +     '</div>'
    +     (p && p.alergias ? '<div style="margin-top:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:5px 10px;font-size:11px;color:#DC2626;font-weight:600">&#9888; Alergias: '+p.alergias+'</div>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="section-title">&#128138; Prescripci&#243;n Médica</div>'
    + '<table><thead><tr><th>#</th><th>Medicamento / Indicaciones</th><th>Dosis</th><th>Frecuencia</th><th>V&#237;a</th><th>Duraci&#243;n</th><th>Estado</th></tr></thead><tbody>'
    + meds.map((m, i) =>
        '<tr>'
        + '<td style="font-weight:800;color:#1D4ED8;text-align:center">' + (i+1) + '</td>'
        + '<td><strong>Rx. '+m.nombre+'</strong>'+(m.indicaciones?'<br><span style="font-size:11px;color:#64748B;font-style:italic">'+m.indicaciones+'</span>':'')+'</td>'
        + '<td><strong>'+m.dosis+'</strong></td>'
        + '<td>'+m.frecuencia+'</td>'
        + '<td>'+viaLabel(m.via)+'</td>'
        + '<td style="font-size:11px;white-space:nowrap">'+(m.inicio?fmtF(m.inicio):'—')+(m.fin?'<br>&rarr; '+fmtF(m.fin):'')+'</td>'
        + '<td><span class="tag '+(m.estado==='activa'?'tag-green':m.estado==='finalizada'?'tag-gray':'tag-red')+'">'+m.estado+'</span></td>'
        + '</tr>'
      ).join('')
    + '</tbody></table>'
    + ((p&&p.alergias)||(e&&e.enfermedadesCronicas) ? '<div class="section-title">&#9888; Antecedentes relevantes</div>'
    +   '<table><tbody>'
    +   (p&&p.alergias?'<tr><td style="font-weight:700;color:#B45309;width:150px;white-space:nowrap">Alergias</td><td>'+p.alergias+'</td></tr>':'')
    +   (e&&e.enfermedadesCronicas?'<tr><td style="font-weight:700;color:#B45309;white-space:nowrap">Enf. cr&#243;nicas</td><td>'+e.enfermedadesCronicas+'</td></tr>':'')
    +   '</tbody></table>' : '')
    + '<div class="rx-proxima">'
    +   '<span>Pr&#243;xima cita: <span class="rx-linea"></span></span>'
    +   (cfg.registro?'<span>C&#243;digo '+cfg.registro+'</span>':'<span></span>')
    + '</div>'
    + '<div class="sig-wrap"><div class="sig-box">'+_firmaImgHTML(46)+'<div class="sig-line"></div>'
    +   '<div class="sig-name">'+(currentUser&&currentUser.name?currentUser.name:cfg.nombreDoctor||'M&#233;dico Responsable')+'</div>'
    +   especialidadFirma(cfg).split(/\r?\n/).filter(Boolean).map(l=>'<div class="sig-role">'+l+'</div>').join('')
    + '</div></div>'
    + _padecimientosHTML(cfg);

  pdfAbrir('Receta Electrónica — '+pNombre, body, cfg);
}

// ════════════════════ EXÁMENES DIGITALIZADOS ════════════════════
const EXAMEN_TIPOS = {
  laboratorio:        { lbl:'Laboratorio',        icon:'🧪' },
  ultrasonido:        { lbl:'Ultrasonido',        icon:'🌊' },
  radiografia:        { lbl:'Radiografía',        icon:'🩻' },
  tomografia:         { lbl:'Tomografía',         icon:'🧠' },
  resonancia:         { lbl:'Resonancia',         icon:'🧲' },
  electrocardiograma: { lbl:'Electrocardiograma', icon:'💓' },
  biopsia:            { lbl:'Biopsia / Patología',icon:'🔬' },
  otro:               { lbl:'Otro',               icon:'📄' },
};
const EXAMEN_MAX_BYTES = 10 * 1024 * 1024;

let _examenes        = [];     // exámenes del paciente abierto
let _examenPacId     = null;
let _examenArchivo   = null;   // archivo elegido, se sube al guardar
let _examenFiltro    = '';

// Subir y borrar exámenes queda reservado al personal médico
function puedeGestionarExamenes() {
  return isSuperAdmin() || ['medico','medico_admin','odontologo'].includes(currentUser?.key);
}

const fromExamen = r => ({
  id:r.id, pacienteId:r.paciente_id, tipo:r.tipo||'otro', titulo:r.titulo||'',
  notas:r.notas||'', fecha:r.fecha, url:r.archivo_url, mime:r.archivo_tipo||'',
  nombre:r.archivo_nombre||'', tamano:Number(r.tamano||0), subidoPor:r.subido_por||''
});

function _esImagenExamen(mime) { return (mime||'').startsWith('image/'); }
function _pesoLegible(b) {
  if(!b) return '';
  return b < 1024*1024 ? Math.round(b/1024)+' KB' : (b/(1024*1024)).toFixed(1)+' MB';
}

async function renderExamenes(pid) {
  const el = document.getElementById('tab-examenes');
  if(!el) return;
  _examenPacId = pid;
  el.innerHTML = '<div class="card"><p class="text-light" style="text-align:center;padding:26px">Cargando exámenes…</p></div>';

  const { data, error } = await sb.from('examenes')
    .select('*').eq('paciente_id', pid).eq('clinica_id', currentClinicaId)
    .order('fecha', { ascending:false }).order('id', { ascending:false });

  if(error) {
    const falta = /relation .*examenes.* does not exist|could not find the table/i.test(error.message||'');
    el.innerHTML = `<div class="card"><div class="empty-state" style="padding:34px">
      <div class="empty-icon">${falta?'🗄️':'⚠️'}</div>
      <p>${falta
        ? 'Falta crear la tabla <strong>examenes</strong> en Supabase.<br><span style="font-size:12px">Ejecuta el script que te pasaron y recarga.</span>'
        : 'No se pudieron cargar los exámenes:<br><span style="font-size:12px">'+error.message+'</span>'}</p>
    </div></div>`;
    return;
  }
  _examenes = (data||[]).map(fromExamen);
  _pintarExamenes();
}

function _pintarExamenes() {
  const el = document.getElementById('tab-examenes');
  if(!el) return;
  const puede = puedeGestionarExamenes();
  const q = _examenFiltro.toLowerCase();
  const lista = _examenes.filter(x => !q
    || x.titulo.toLowerCase().includes(q)
    || x.notas.toLowerCase().includes(q)
    || (EXAMEN_TIPOS[x.tipo]?.lbl||'').toLowerCase().includes(q));

  const chips = ['', ...Object.keys(EXAMEN_TIPOS)]
    .filter(t => !t || _examenes.some(x => x.tipo === t))
    .map(t => `<span class="chip${_examenFiltro===(EXAMEN_TIPOS[t]?.lbl||'')&&t?' active':(!t&&!_examenFiltro?' active':'')}"
      onclick="filtrarExamenes('${t?EXAMEN_TIPOS[t].lbl:''}')">${t?EXAMEN_TIPOS[t].icon+' '+EXAMEN_TIPOS[t].lbl:'Todos'}</span>`).join('');

  el.innerHTML = `<div class="card">
    <div class="card-header">
      <h3>🔬 Exámenes digitalizados ${_examenes.length?`<span class="tag tag-blue" style="font-size:11px">${_examenes.length}</span>`:''}</h3>
      ${puede?`<button class="btn btn-primary btn-sm" onclick="openModalExamen(${_examenPacId})">+ Subir examen</button>`:''}
    </div>
    ${_examenes.length?`<div class="search-bar" style="margin-bottom:12px">
      <input class="search-bar-input" type="text" placeholder="Buscar por título, tipo u observaciones..."
        value="${_examenFiltro}" oninput="filtrarExamenes(this.value)">
    </div>
    <div class="filter-chips" style="margin-bottom:14px">${chips}</div>`:''}
    ${lista.length ? `<div class="ex-grid">${lista.map(_examenCardHTML).join('')}</div>`
      : `<div class="empty-state" style="padding:36px">
          <div class="empty-icon">🔬</div>
          <p>${_examenes.length ? 'Ningún examen coincide con la búsqueda'
            : puede ? 'Sin exámenes cargados.<br>Usa <strong>+ Subir examen</strong> para agregar un PDF o una foto.'
                    : 'Este paciente aún no tiene exámenes cargados.'}</p>
        </div>`}
    ${!puede&&_examenes.length?'<p style="font-size:11px;color:var(--text-light);text-align:center;margin-top:12px">Solo el personal médico puede subir o eliminar exámenes.</p>':''}
  </div>`;
}

function _examenCardHTML(x) {
  const t = EXAMEN_TIPOS[x.tipo] || EXAMEN_TIPOS.otro;
  const esImg = _esImagenExamen(x.mime);
  const puede = puedeGestionarExamenes();
  return `<div class="ex-card">
    <div class="ex-thumb" onclick="abrirExamen(${x.id})" title="Abrir examen">
      ${esImg ? `<img src="${x.url}" alt="${x.titulo}" loading="lazy">` : '<span class="ex-pdf">📕</span>'}
      <span class="ex-badge">${t.icon} ${t.lbl}</span>
    </div>
    <div class="ex-body">
      <div class="ex-titulo">${x.titulo||'Sin título'}</div>
      <div class="ex-meta">${formatFecha(x.fecha)}${x.tamano?' · '+_pesoLegible(x.tamano):''}</div>
      ${x.notas?`<div class="ex-notas">${x.notas}</div>`:''}
      ${x.subidoPor?`<div class="ex-meta" style="margin-top:3px">Subido por ${x.subidoPor}</div>`:''}
      <div class="ex-acciones">
        <button class="btn btn-secondary btn-sm" onclick="abrirExamen(${x.id})">👁️ Ver</button>
        ${puede?`<button class="btn btn-danger btn-sm" onclick="eliminarExamen(${x.id})">🗑️</button>`:''}
      </div>
    </div>
  </div>`;
}

function filtrarExamenes(v) { _examenFiltro = v || ''; _pintarExamenes(); }

function abrirExamen(id) {
  const x = _examenes.find(e => e.id === id);
  if(x?.url) window.open(x.url, '_blank');
}

function openModalExamen(pid) {
  if(!puedeGestionarExamenes()) { toast('Solo el personal médico puede subir exámenes','error'); return; }
  _examenPacId = pid || _examenPacId;
  _examenArchivo = null;
  document.getElementById('ex-tipo').value = 'laboratorio';
  document.getElementById('ex-fecha').value = hoy();
  document.getElementById('ex-titulo').value = '';
  document.getElementById('ex-notas').value = '';
  document.getElementById('ex-archivo').value = '';
  document.getElementById('ex-drop-vacio').style.display = '';
  document.getElementById('ex-drop-lleno').style.display = 'none';
  openModalOverlay('modal-examen');
  setTimeout(initDatePickers, 50);
}

function onExamenArchivo(input) {
  const f = input.files && input.files[0];
  if(!f) return;
  const ok = f.type === 'application/pdf' || /^image\/(png|jpeg|webp)$/.test(f.type);
  if(!ok) { toast('Solo se admiten PDF o imágenes PNG, JPG y WEBP','error'); input.value=''; return; }
  if(f.size > EXAMEN_MAX_BYTES) { toast('El archivo supera los 10 MB','error'); input.value=''; return; }
  _examenArchivo = f;
  document.getElementById('ex-drop-vacio').style.display = 'none';
  document.getElementById('ex-drop-lleno').style.display = '';
  document.getElementById('ex-nombre').textContent = f.name;
  document.getElementById('ex-peso').textContent = _pesoLegible(f.size);
  const img = document.getElementById('ex-thumb'), pdf = document.getElementById('ex-pdf-icon');
  if(f.type === 'application/pdf') { img.style.display='none'; pdf.style.display=''; }
  else {
    pdf.style.display='none';
    const r = new FileReader();
    r.onload = e => { img.src = e.target.result; img.style.display=''; };
    r.readAsDataURL(f);
  }
  // Sugerir un título a partir del nombre del archivo si aún está vacío
  const tit = document.getElementById('ex-titulo');
  if(tit && !tit.value.trim()) tit.value = f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
}

async function subirArchivoExamen(file, pacienteId) {
  const ext = (file.name.split('.').pop() || 'dat').toLowerCase();
  const path = `examenes/${pacienteId}/${Date.now()}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert:false, contentType:file.type });
  if(error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { url:data.publicUrl, path };
}

async function guardarExamen() {
  if(!puedeGestionarExamenes()) { toast('Solo el personal médico puede subir exámenes','error'); return; }
  if(!currentClinicaId) { toast('Sin clínica asignada','error'); return; }
  const titulo = document.getElementById('ex-titulo').value.trim();
  if(!titulo) { toast('Ponle un título al examen','error'); return; }
  if(!_examenArchivo) { toast('Elige el archivo del examen','error'); return; }
  const btn = document.querySelector('[onclick="guardarExamen()"]');
  if(!_lockSubmit('examen', btn)) return;
  setLoading(true);

  let subido;
  try { subido = await subirArchivoExamen(_examenArchivo, _examenPacId); }
  catch(e) {
    setLoading(false); _unlockSubmit('examen', btn);
    toast('No se pudo subir el archivo: '+(e.message||e),'error');
    return;
  }

  const { error } = await sb.from('examenes').insert({
    paciente_id:_examenPacId, clinica_id:currentClinicaId,
    tipo:document.getElementById('ex-tipo').value,
    titulo, notas:document.getElementById('ex-notas').value.trim() || null,
    fecha:document.getElementById('ex-fecha').value || hoy(),
    archivo_url:subido.url, archivo_tipo:_examenArchivo.type,
    archivo_nombre:_examenArchivo.name, tamano:_examenArchivo.size,
    subido_por:currentUser?.name || null
  });
  setLoading(false); _unlockSubmit('examen', btn);
  if(error) { toast('Error al guardar: '+error.message,'error'); return; }
  toast('Examen guardado 🔬');
  closeModal('modal-examen');
  renderExamenes(_examenPacId);
}

async function eliminarExamen(id) {
  if(!puedeGestionarExamenes()) { toast('Solo el personal médico puede eliminar exámenes','error'); return; }
  const x = _examenes.find(e => e.id === id);
  const ok = await customConfirm({
    icon:'🗑️', title:'Eliminar examen',
    msg:`¿Eliminar <strong>${x?.titulo||'este examen'}</strong> del expediente?<br><br>El archivo también se borra y no se puede recuperar.`,
    okText:'Eliminar', danger:true
  });
  if(!ok) return;
  setLoading(true);
  const { error } = await sb.from('examenes').delete().eq('id', id);
  if(error) { setLoading(false); toast('Error al eliminar: '+error.message,'error'); return; }
  // Borrar también el archivo; si falla, el registro ya se eliminó igual
  try {
    const m = (x?.url||'').match(/\/Pacientes\/(examenes\/.+)$/);
    if(m) await sb.storage.from(STORAGE_BUCKET).remove([decodeURIComponent(m[1].split('?')[0])]);
  } catch(e) {}
  setLoading(false);
  toast('Examen eliminado');
  renderExamenes(_examenPacId);
}

// ════════════════════ FOTO PACIENTE ════════════════════
let pendingFotoFile = null;
let currentFotoUrl  = null;

function previewFoto(event) {
  const file = event.target.files[0]; if(!file) return;
  pendingFotoFile = file;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('foto-placeholder').style.display = 'none';
    const img = document.getElementById('foto-img-preview');
    img.src = e.target.result; img.style.display = 'block';
    document.getElementById('btn-quitar-foto').style.display = 'block';
  };
  reader.readAsDataURL(file);
}

function quitarFoto() {
  pendingFotoFile = null; currentFotoUrl = null;
  document.getElementById('foto-img-preview').style.display = 'none';
  document.getElementById('foto-img-preview').src = '';
  document.getElementById('foto-placeholder').style.display = 'block';
  document.getElementById('btn-quitar-foto').style.display = 'none';
  document.getElementById('p-foto').value = '';
}

// El nombre del bucket distingue mayúsculas: debe coincidir exactamente con Supabase
const STORAGE_BUCKET = 'Pacientes';

async function subirFotoPaciente(file, pacienteId) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${pacienteId}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if(error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Firma manuscrita del usuario, guardada en una carpeta aparte del mismo bucket
async function subirFirmaUsuario(file, usuarioId) {
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `firmas/${usuarioId}.${ext}`;
  const { error } = await sb.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: true, contentType: file.type });
  if(error) throw error;
  const { data } = sb.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  // El parámetro evita que el navegador siga mostrando la firma anterior en caché
  return data.publicUrl + '?v=' + Date.now();
}

// ════════════════════ EXPEDIENTE ════════════════════
async function guardarExpediente(pid) {
  const obj = {
    pacienteId: pid,
    peso: document.getElementById('exp-peso').value,
    talla: document.getElementById('exp-talla').value,
    presion: document.getElementById('exp-presion').value,
    temperatura: document.getElementById('exp-temperatura').value,
    enfermedadesCronicas: document.getElementById('exp-enfermedadesCronicas').value.trim(),
    cirugias: document.getElementById('exp-cirugias').value.trim(),
    antecedentesFamiliares: document.getElementById('exp-antecedentesFamiliares').value.trim(),
    vacunas: document.getElementById('exp-vacunas').value.trim(),
    tabaco: document.getElementById('exp-tabaco').value,
    alcohol: document.getElementById('exp-alcohol').value,
    actividadFisica: document.getElementById('exp-actividadFisica').value,
    ocupacion: document.getElementById('exp-ocupacion').value.trim(),
    estadoCivil: document.getElementById('exp-estadoCivil').value,
    observacionesMedicas: document.getElementById('exp-observacionesMedicas').value.trim()
  };
  setLoading(true);
  const existing = C.e.find(x => x.pacienteId === pid);
  let err;
  if(existing) { const r = await sb.from('expediente').update(toE(obj)).eq('id', existing.id); err = r.error; }
  else { const r = await sb.from('expediente').insert([toE(obj)]); err = r.error; }
  setLoading(false);
  if(err) { toast('Error: ' + err.message, 'error'); return; }
  toast('Expediente guardado ✅');
  await loadAll();
  renderDetalleP(pid);
  setTimeout(() => { switchTab('tab-expediente', document.querySelectorAll('.tab')[4]); }, 50);
}

// ════════════════════ CONFIGURACIÓN CLÍNICA ════════════════════
// Especialidad que se imprime junto al nombre de quien firma: la propia del
// usuario en sesión y, si no tiene ninguna asignada, la configurada en la clínica.
// Lista de padecimientos impresa al pie del recetario, como en el talonario físico.
// Es solo texto para marcar a mano: no se guarda nada por paciente.
function _padecimientosHTML(cfg) {
  const items = (cfg?.padecimientos || '')
    .split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if(!items.length) return '';
  return '<div style="margin-top:22px;padding-top:12px;border-top:1.5px solid #e2e8f0">'
    + '<div style="font-size:10px;font-weight:800;color:#64748b;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Padecimientos</div>'
    + '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:5px 16px">'
    + items.map(t => '<div style="font-size:11px;color:#334155;display:flex;align-items:center;gap:6px">'
        + '<span style="display:inline-block;width:8px;height:8px;border:1.3px solid #94a3b8;border-radius:50%;flex-shrink:0"></span>'
        + t + '</div>').join('')
    + '</div></div>';
}

function especialidadFirma(cfg) {
  return (currentUser?.especialidad || '').trim() || (cfg?.especialidad || '');
}

function getClinicaConfig() {
  const key = 'lumeamed_clinica' + (currentClinicaId ? '_' + currentClinicaId : '');
  let local = {};
  try { local = JSON.parse(localStorage.getItem(key) || '{}'); } catch { local = {}; }
  const cl = currentClinica || {};
  // Supabase (currentClinica) es la fuente principal; localStorage puede sobrescribir si el usuario lo configuró localmente
  return {
    nombreClinica: local.nombreClinica || cl.nombre || '',
    nombreDoctor:  local.nombreDoctor  || cl.nombre_doctor || '',
    especialidad:  local.especialidad  || cl.especialidad || '',
    registro:      local.registro      || cl.registro || '',
    telefono:      local.telefono      || cl.telefono || '',
    email:         local.email         || '',
    direccion:     local.direccion     || cl.direccion || '',
    notaPie:       local.notaPie       || cl.nota_pie || '',
    padecimientos: local.padecimientos || cl.padecimientos || '',
    institucion:   local.institucion   || cl.institucion || '',
    logoUrl:       local.logoUrl       || cl.logo_url || '',
  };
}

function renderConfiguracion() {
  const cfg = getClinicaConfig();
  document.getElementById('config-logo-url').value = cfg.logoUrl || '';
  setConfigLogoPreview(cfg.logoUrl || null);
  document.getElementById('config-nombre-clinica').value = cfg.nombreClinica || '';
  document.getElementById('config-nombre-doctor').value = cfg.nombreDoctor || '';
  document.getElementById('config-especialidad').value = cfg.especialidad || '';
  document.getElementById('config-registro').value = cfg.registro || '';
  document.getElementById('config-telefono').value = cfg.telefono || '';
  document.getElementById('config-email').value = cfg.email || '';
  document.getElementById('config-direccion').value = cfg.direccion || '';
  document.getElementById('config-nota-pie').value = cfg.notaPie || '';
  const padEl = document.getElementById('config-padecimientos');
  if(padEl) padEl.value = cfg.padecimientos || '';
  const instEl = document.getElementById('config-institucion');
  if(instEl) instEl.value = cfg.institucion || '';
  actualizarPreviewConfig(cfg);
}

function setConfigLogoPreview(src) {
  const box = document.getElementById('config-logo-box');
  const btn = document.getElementById('config-logo-remove');
  if(src) {
    box.innerHTML = `<img src="${src}" alt="logo">`;
    if(btn) btn.style.display = 'inline-flex';
  } else {
    box.innerHTML = '🏥';
    if(btn) btn.style.display = 'none';
    document.getElementById('config-logo-url').value = '';
  }
}

function onConfigLogoSelected(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('config-logo-url').value = e.target.result;
    setConfigLogoPreview(e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removeConfigLogo() {
  setConfigLogoPreview(null);
}

function guardarConfigClinica() {
  const cfg = {
    nombreClinica: document.getElementById('config-nombre-clinica').value.trim(),
    nombreDoctor:  document.getElementById('config-nombre-doctor').value.trim(),
    especialidad:  document.getElementById('config-especialidad').value.trim(),
    registro:      document.getElementById('config-registro').value.trim(),
    telefono:      document.getElementById('config-telefono').value.trim(),
    email:         document.getElementById('config-email').value.trim(),
    direccion:     document.getElementById('config-direccion').value.trim(),
    notaPie:       document.getElementById('config-nota-pie').value.trim(),
    padecimientos: document.getElementById('config-padecimientos')?.value.trim() || '',
    institucion:   document.getElementById('config-institucion')?.value.trim() || '',
    logoUrl:       document.getElementById('config-logo-url').value.trim()
  };
  if(!cfg.nombreClinica) { toast('El nombre de la clínica es obligatorio', 'error'); return; }
  const key = 'lumeamed_clinica' + (currentClinicaId ? '_' + currentClinicaId : '');
  localStorage.setItem(key, JSON.stringify(cfg));
  toast('Configuración guardada ✅');
  actualizarPreviewConfig(cfg);
}

function actualizarPreviewConfig(cfg) {
  const el = document.getElementById('config-preview');
  if(!el) return;
  el.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:12px;border-bottom:2px solid var(--primary);padding-bottom:12px;margin-bottom:12px">
      <div style="width:52px;height:52px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:22px;overflow:hidden;flex-shrink:0">${cfg.logoUrl?`<img src="${cfg.logoUrl}" style="width:100%;height:100%;object-fit:contain">` : '🏥'}</div>
      <div>
        <div style="font-size:16px;font-weight:800;color:var(--primary)">${cfg.nombreClinica||'Lumea Med Clínica'}</div>
        ${cfg.nombreDoctor?`<div style="font-size:12px;font-weight:600">${cfg.nombreDoctor}${cfg.especialidad?' · '+cfg.especialidad:''}</div>`:''}
        ${cfg.direccion?`<div style="font-size:11px;color:var(--text-light)">📍 ${cfg.direccion}</div>`:''}
        ${cfg.telefono?`<div style="font-size:11px;color:var(--text-light)">📞 ${cfg.telefono}</div>`:''}
      </div>
    </div>
    <p style="font-size:11px;color:var(--text-light);text-align:center">Así aparecerá el encabezado en tus notas de consulta</p>`;
}

// ════════════════════ NOTA DE CONSULTA (IMPRESIÓN) ════════════════════
function imprimirNotaConsulta(citaId) {
  const c = C.c.find(x => x.id === citaId); if(!c) return;
  const p = C.p.find(x => x.id === c.pacienteId);
  const e = C.e.find(x => x.pacienteId === c.pacienteId);
  const meds = C.m.filter(m => m.pacienteId === c.pacienteId && m.estado === 'activa');
  const notasDia = C.n.filter(n => n.pacienteId === c.pacienteId && n.fecha === c.fecha);
  const cfg = getClinicaConfig();
  const fmtF = f => { if(!f) return '—'; const d=new Date(f+'T12:00:00'); return d.toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'}); };
  const edadCalc = fn => { if(!fn) return ''; const h=new Date(),n=new Date(fn); let a=h.getFullYear()-n.getFullYear(); if(h.getMonth()<n.getMonth()||(h.getMonth()===n.getMonth()&&h.getDate()<n.getDate()))a--; return a+' años'; };
  const inits = (a,b) => ((a||'')[0]||'').toUpperCase()+((b||'')[0]||'').toUpperCase();
  const imc = (e?.peso && e?.talla) ? (e.peso/((e.talla/100)**2)).toFixed(1) : null;

  const body = '<div class="badge-tipo" style="background:#2563EB">&#128203; NOTA DE CONSULTA M&#201;DICA</div>'
    + '<div class="patient-box">'
    +   '<div class="patient-av">'+(p?.fotoUrl?'<img src="'+p.fotoUrl+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%">':inits(p?.nombre,p?.apellidos))+'</div>'
    +   '<div style="flex:1">'
    +     '<div class="patient-name">'+(p?p.nombre+' '+p.apellidos:'Paciente no registrado')+'</div>'
    +     '<div class="patient-meta">'
    +       (p?.fechaNac?'<span>&#127874; '+edadCalc(p.fechaNac)+'</span>':'')
    +       (p?.sexo?'<span>'+(p.sexo==='M'?'&#9794; Masculino':p.sexo==='F'?'&#9792; Femenino':p.sexo)+'</span>':'')
    +       (p?.sangre?'<span>&#129778; '+p.sangre+'</span>':'')
    +       (p?.identificacion?'<span>&#128266; '+p.identificacion+'</span>':'')
    +       (p?.telefono?'<span>&#128222; '+p.telefono+'</span>':'')
    +     '</div>'
    +     (p?.alergias?'<div style="margin-top:6px;background:#FEF2F2;border:1px solid #FECACA;border-radius:6px;padding:5px 10px;font-size:11px;color:#DC2626;font-weight:600">&#9888; Alergias: '+p.alergias+'</div>':'')
    +   '</div>'
    + '</div>'
    + '<div class="section-title">&#128197; Datos de la consulta</div>'
    + '<table><tbody>'
    +   '<tr><td style="font-weight:700;color:#475569;width:130px">Fecha</td><td><strong>'+fmtF(c.fecha)+'</strong></td><td style="font-weight:700;color:#475569;width:100px">Hora</td><td><strong>'+c.hora+'</strong></td></tr>'
    +   '<tr><td style="font-weight:700;color:#475569">Tipo</td><td style="text-transform:capitalize">'+c.tipo+'</td><td style="font-weight:700;color:#475569">Estado</td><td style="text-transform:capitalize">'+c.estado+'</td></tr>'
    +   '<tr><td style="font-weight:700;color:#475569">N&deg; Folio</td><td colspan="3">GS-'+c.id+'-'+Date.now().toString().slice(-5)+'</td></tr>'
    +   '<tr><td style="font-weight:700;color:#1D4ED8">Motivo</td><td colspan="3" style="font-weight:700;color:#1D4ED8;font-size:14px">'+c.motivo+'</td></tr>'
    +   (c.notas?'<tr><td style="font-weight:700;color:#475569">Observaciones</td><td colspan="3" style="white-space:pre-wrap">'+c.notas+'</td></tr>':'')
    + '</tbody></table>'
    + (e&&(e.peso||e.talla||e.presion||e.temperatura)?
        '<div class="section-title">&#9889; Signos vitales</div>'
        + '<table><thead><tr>'
        +   (e.peso?'<th>Peso</th>':'')+(e.talla?'<th>Talla</th>':'')+(e.presion?'<th>Presi&#243;n Arterial</th>':'')+(e.temperatura?'<th>Temperatura</th>':'')+(imc?'<th>IMC</th>':'')
        + '</tr></thead><tbody><tr>'
        +   (e.peso?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.peso+' kg</td>':'')
        +   (e.talla?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.talla+' cm</td>':'')
        +   (e.presion?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.presion+'</td>':'')
        +   (e.temperatura?'<td style="font-size:16px;font-weight:800;color:#166534">'+e.temperatura+'&deg;C</td>':'')
        +   (imc?'<td style="font-size:16px;font-weight:800;color:#166534">'+imc+'</td>':'')
        + '</tr></tbody></table>'
      : '')
    + '<div class="section-title">&#128203; Diagn&#243;stico / Notas de la consulta</div>'
    + (notasDia.length
        ? notasDia.map(n=>'<div class="note-box"><div class="note-title">'+(n.tipo.toUpperCase())+(n.titulo?' &mdash; '+n.titulo:'')+'</div><div class="note-body">'+n.contenido+'</div></div>').join('')
        : '<p style="font-size:12px;color:#94A3B8;margin-bottom:18px">Sin notas registradas para esta consulta</p>')
    + '<div class="section-title">&#128138; Prescripci&#243;n / Medicaci&#243;n</div>'
    + (meds.length
        ? '<table><thead><tr><th>#</th><th>Medicamento</th><th>Dosis</th><th>Frecuencia</th><th>V&#237;a</th><th>Hasta</th></tr></thead><tbody>'
          + meds.map((m,i)=>'<tr><td style="text-align:center;font-weight:800;color:#1D4ED8">'+(i+1)+'</td><td><strong>Rx. '+m.nombre+'</strong>'+(m.indicaciones?'<br><span style="font-size:11px;color:#64748B;font-style:italic">'+m.indicaciones+'</span>':'')+'</td><td>'+m.dosis+'</td><td>'+m.frecuencia+'</td><td>'+m.via+'</td><td style="font-size:11px">'+(m.fin?fmtF(m.fin):'Indefinido')+'</td></tr>').join('')
          + '</tbody></table>'
        : '<p style="font-size:12px;color:#94A3B8;margin-bottom:18px">Sin medicamentos prescritos en esta consulta</p>')
    + (p?.alergias||e?.enfermedadesCronicas
        ? '<div class="section-title">&#9888; Antecedentes relevantes</div>'
          + '<table><tbody>'
          + (p?.alergias?'<tr><td style="font-weight:700;color:#B45309;width:150px">Alergias</td><td>'+p.alergias+'</td></tr>':'')
          + (e?.enfermedadesCronicas?'<tr><td style="font-weight:700;color:#B45309">Enf. cr&#243;nicas</td><td>'+e.enfermedadesCronicas+'</td></tr>':'')
          + '</tbody></table>'
        : '')
    + '<div class="sig-wrap"><div class="sig-box">'+_firmaImgHTML(46)+'<div class="sig-line"></div>'
    +   '<div class="sig-name">'+(currentUser?.name||cfg.nombreDoctor||'M&#233;dico Responsable')+'</div>'
    +   (especialidadFirma(cfg)?'<div class="sig-role">'+especialidadFirma(cfg)+'</div>':'')
    +   (cfg.registro?'<div class="sig-role">Reg. Med. '+cfg.registro+'</div>':'')
    + '</div></div>';

  pdfAbrir('Nota de Consulta — '+(p?p.nombre+' '+p.apellidos:''), body, cfg);
}

// ════════════════════ ATENDIDOS POR DÍA ════════════════════
let atendidosFecha = hoy();

function renderAtendidos(fecha) {
  if(fecha) atendidosFecha = fecha;
  const picker = document.getElementById('atendidos-fecha-picker');
  if(picker) picker.value = atendidosFecha;

  const citas = C.c.filter(c => c.fecha === atendidosFecha).sort((a,b) => a.hora.localeCompare(b.hora));
  const completadas = citas.filter(c => c.estado === 'completada');
  const pendientes  = citas.filter(c => c.estado === 'pendiente' || c.estado === 'confirmada');
  const canceladas  = citas.filter(c => c.estado === 'cancelada');

  const statsEl = document.getElementById('atendidos-stats');
  if(statsEl) statsEl.innerHTML =
    `<span class="tag tag-green">✅ ${completadas.length} completadas</span>` +
    `<span class="tag tag-orange">⏳ ${pendientes.length} pendientes</span>` +
    (canceladas.length ? `<span class="tag tag-red">❌ ${canceladas.length} canceladas</span>` : '') +
    `<span class="tag tag-gray">📋 ${citas.length} total del día</span>`;

  const lista = document.getElementById('atendidos-lista');
  if(!lista) return;
  if(!citas.length) {
    lista.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Sin citas registradas para esta fecha</p></div>';
    return;
  }
  lista.innerHTML = citas.map(c => {
    const p = C.p.find(x => x.id === c.pacienteId);
    return `<div class="atendido-item ${c.estado}">
      <div class="atendido-time">${c.hora}</div>
      <div class="patient-avatar" style="background:${colAvatar(c.pacienteId||0)};width:38px;height:38px;font-size:13px;flex-shrink:0">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div class="atendido-info">
        <div class="atendido-name">${p?p.nombre+' '+p.apellidos:'Desconocido'}</div>
        <div class="atendido-sub">${c.motivo} · <span class="tag tag-cyan" style="font-size:10px;padding:2px 7px">${c.tipo}</span></div>
      </div>
      ${estadoTag(c.estado)}
      <div class="actions-cell">
        <button class="btn btn-sm" style="background:linear-gradient(135deg,#7C3AED,#6D28D9);color:#fff;white-space:nowrap" onclick="imprimirNotaConsulta(${c.id})">🖨️ Nota</button>
        <button class="btn btn-primary btn-sm" onclick="verResumenCita(${c.id})">📄 Hoja</button>
        <button class="btn btn-secondary btn-sm" onclick="navigate('paciente-detalle',${c.pacienteId})">👁️</button>
      </div>
    </div>`;
  }).join('');
}

function verResumenCita(citaId) {
  currentResumenCitaId = citaId;
  const c = C.c.find(x => x.id === citaId);
  if(!c) return;
  const cfg = getClinicaConfig();
  const p = C.p.find(x => x.id === c.pacienteId);
  const meds = C.m.filter(m => m.pacienteId === c.pacienteId && m.estado === 'activa');
  const notasDia = C.n.filter(n => n.pacienteId === c.pacienteId && n.fecha === c.fecha).sort((a,b) => b.id - a.id);
  const notasOtras = C.n.filter(n => n.pacienteId === c.pacienteId && n.fecha !== c.fecha).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const estadoIcon = {completada:'✅',pendiente:'⏳',confirmada:'🔵',cancelada:'❌'}[c.estado]||'📋';

  document.getElementById('resumen-cita-content').innerHTML = `
    <div class="rc-header">
      <div style="display:flex;align-items:center;gap:12px;flex:1">
        <div style="width:46px;height:46px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--accent));display:flex;align-items:center;justify-content:center;font-size:20px;overflow:hidden;flex-shrink:0">
          ${cfg.logoUrl?`<img src="${cfg.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:10px" alt="logo">`:'🏥'}
        </div>
        <div>
          <div class="rc-logo" style="font-size:15px">${cfg.nombreClinica||'Lumea Med'}</div>
          <div style="font-size:11px;color:var(--text-light);margin-top:2px">${currentUser?.name||cfg.nombreDoctor||''}${especialidadFirma(cfg)?' · '+especialidadFirma(cfg):''}</div>
        </div>
      </div>
      <div class="rc-date-gen">Generado: ${new Date().toLocaleString('es-ES')}</div>
    </div>

    <div class="rc-patient">
      <div class="patient-avatar" style="background:${p?colAvatar(p.id):'#475569'};width:62px;height:62px;font-size:22px;flex-shrink:0;border:3px solid rgba(255,255,255,.2)">${p?ini(p.nombre,p.apellidos):'?'}</div>
      <div class="rc-patient-info" style="flex:1">
        <h2>${p?p.nombre+' '+p.apellidos:'Paciente no encontrado'}</h2>
        <div class="rc-meta">
          ${p?.fechaNac?`<span>🎂 ${calcEdad(p.fechaNac)}</span>`:''}
          ${p?.sexo?`<span>${p.sexo==='M'?'♂ Masculino':p.sexo==='F'?'♀ Femenino':p.sexo}</span>`:''}
          ${p?.sangre?`<span>🩸 ${p.sangre}</span>`:''}
          ${p?.telefono?`<span>📞 ${p.telefono}</span>`:''}
          ${p?.identificacion?`<span>🪪 ${p.identificacion}</span>`:''}
          ${p?.email?`<span>✉️ ${p.email}</span>`:''}
        </div>
        ${p?.alergias?`<div class="rc-alergias">⚠️ Alergias: <strong>${p.alergias}</strong></div>`:''}
        ${p?.emergencia?`<div style="font-size:12px;color:rgba(255,255,255,.65);margin-top:6px">🆘 Emergencia: ${p.emergencia}</div>`:''}
        ${p?.direccion?`<div style="font-size:12px;color:rgba(255,255,255,.55);margin-top:3px">📍 ${p.direccion}</div>`:''}
      </div>
    </div>

    <div class="rc-section">
      <div class="rc-section-title">📅 Datos de la Consulta</div>
      <div class="rc-fields">
        <div class="rc-field"><span>Fecha</span><strong>${formatFecha(c.fecha)}</strong></div>
        <div class="rc-field"><span>Hora</span><strong>${c.hora}</strong></div>
        <div class="rc-field"><span>Tipo de consulta</span><strong>${c.tipo}</strong></div>
        <div class="rc-field"><span>Estado</span><strong>${estadoIcon} ${c.estado}</strong></div>
        ${(currentClinica?.tipo !== 'optica' && c.motivo) ? `<div class="rc-field full"><span>Motivo de Consulta</span><strong>${c.motivo}</strong></div>` : ''}
        ${c.notas?`<div class="rc-field full"><span>Observaciones / Indicaciones de la cita</span><strong style="white-space:pre-wrap;font-weight:500">${c.notas}</strong></div>`:''}
      </div>
    </div>

    ${meds.length?`<div class="rc-section">
      <div class="rc-section-title">💊 Medicaciones Activas del Paciente</div>
      ${meds.map(m=>`<div class="rc-med-item">
        <strong>${m.nombre}</strong> · ${m.dosis} · ${m.frecuencia} · vía ${m.via}
        ${m.inicio?`<span style="font-size:11px;color:var(--text-light);margin-left:6px">(desde ${formatFecha(m.inicio)}${m.fin?' hasta '+formatFecha(m.fin):''})</span>`:''}
        ${m.indicaciones?`<div style="font-size:12px;color:var(--text-light);margin-top:4px">📌 ${m.indicaciones}</div>`:''}
      </div>`).join('')}
    </div>`:
    `<div class="rc-section"><div class="rc-section-title">💊 Medicaciones Activas</div><p style="font-size:13px;color:var(--text-light)">Sin medicaciones activas registradas</p></div>`}

    ${notasDia.length?`<div class="rc-section">
      <div class="rc-section-title">📝 Notas Clínicas — Esta Consulta (${formatFecha(c.fecha)})</div>
      ${notasDia.map(n=>`<div class="rc-nota">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap">
          <span class="tag tag-blue">${n.tipo}</span>
          ${n.titulo?`<strong style="font-size:13px">${n.titulo}</strong>`:''}
        </div>
        <div style="white-space:pre-wrap;line-height:1.75;font-size:13px;color:var(--text)">${n.contenido}</div>
      </div>`).join('')}
    </div>`:''}

    ${notasOtras.length?`<div class="rc-section">
      <div class="rc-section-title">📋 Historial de Notas Anteriores</div>
      ${notasOtras.slice(0,4).map(n=>`<div class="rc-nota">
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:6px;flex-wrap:wrap">
          <span class="tag tag-blue">${n.tipo}</span>
          <span style="font-size:11px;color:var(--text-light)">${formatFecha(n.fecha)}</span>
          ${n.titulo?`<strong style="font-size:12px">${n.titulo}</strong>`:''}
        </div>
        <div style="white-space:pre-wrap;line-height:1.6;font-size:12px;color:var(--text)">${n.contenido.length>300?n.contenido.substring(0,300)+'…':n.contenido}</div>
      </div>`).join('')}
      ${notasOtras.length>4?`<p style="font-size:12px;color:var(--text-light);text-align:center;margin-top:6px">+${notasOtras.length-4} notas más en el expediente</p>`:''}
    </div>`:''}

    ${!notasDia.length&&!notasOtras.length?`<div class="rc-section"><div class="rc-section-title">📝 Notas Clínicas</div><p style="font-size:13px;color:var(--text-light)">Sin notas clínicas registradas para este paciente</p></div>`:''}

    ${p?.observaciones?`<div class="rc-section">
      <div class="rc-section-title">🗂️ Antecedentes y Observaciones Generales</div>
      <div style="white-space:pre-wrap;line-height:1.75;font-size:13px">${p.observaciones}</div>
    </div>`:''}

    <div style="display:flex;justify-content:flex-end;margin-top:36px;padding:0 4px">
      <div style="text-align:center;min-width:210px">
        ${_firmaImgHTML(44)}
        <div style="border-top:1.5px solid var(--text);margin-bottom:7px"></div>
        <div style="font-size:14px;font-weight:700;color:var(--text)">${currentUser?.name||cfg.nombreDoctor||'Médico Responsable'}</div>
        ${especialidadFirma(cfg)?`<div style="font-size:12px;color:var(--text-light);margin-top:2px">${especialidadFirma(cfg)}</div>`:''}
        ${cfg.registro?`<div style="font-size:11px;color:var(--text-light)">Reg. Med. ${cfg.registro}</div>`:''}
      </div>
    </div>
    <div class="rc-footer" style="margin-top:14px">
      ${cfg.nombreClinica||'Lumea Med'} · ${cfg.notaPie||cfg.direccion||'Sistema de Gestión Clínica'} · ${new Date().toLocaleString('es-ES')}
    </div>`;

  document.getElementById('modal-resumen-cita').classList.add('open');
}

function imprimirResumen() {
  window.print();
}

// ════════════════════ EXPORTAR ════════════════════
function renderExportar(){
  document.getElementById('resumen-exportar').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      ${[['👥','Pacientes',C.p.length],['📅','Citas',C.c.length],['💊','Medicaciones',C.m.length],['📝','Notas',C.n.length]].map(([ic,lb,v])=>`
        <div style="background:var(--bg);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--border)">
          <div style="font-size:28px">${ic}</div><div style="font-size:22px;font-weight:800;margin:4px 0">${v}</div><div class="text-light">${lb}</div>
        </div>`).join('')}
    </div>
    <div class="divider"></div>
    <p class="text-light">Datos en: <strong>Supabase Cloud</strong> 🌐</p>
    <p class="text-light" style="margin-top:4px">Lumea Med v5.1 · ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</p>`;
}

async function exportarEmail(){
  const h=hoy();
  const asunto=`Lumea Med — Reporte ${new Date().toLocaleDateString('es-ES')}`;
  const body=`REPORTE GALESISTEM\n\nPacientes: ${C.p.length} | Citas: ${C.c.length} | Medicaciones activas: ${C.m.filter(x=>x.estado==='activa').length}\n\nPACIENTES:\n${C.p.map(x=>`• ${x.nombre} ${x.apellidos} | ${x.identificacion||'-'} | ${x.telefono||'-'}`).join('\n')||'Ninguno'}\n\nCITAS HOY:\n${C.c.filter(x=>x.fecha===h).map(x=>{const p=C.p.find(q=>q.id===x.pacienteId);return`• ${x.hora} - ${p?p.nombre+' '+p.apellidos:'N/A'} — ${x.motivo} [${x.estado}]`}).join('\n')||'Ninguna'}\n\nGenerado por Lumea Med v5.1`;
  window.location.href=`mailto:sebasgale65@gmail.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(body)}`;
  toast('Abriendo cliente de correo...','info');
}

async function exportarJSON(){
  const fechaStr = new Date().toLocaleString('es-ES');
  const h = hoy();
  const sep = '─'.repeat(52);

  const lineasP = C.p.map(x =>
    `  • ${x.nombre} ${x.apellidos} | ${x.identificacion||'—'} | ${x.fechaNac||'—'} | ${x.telefono||'—'} | ${x.email||'—'} | ${x.estado||'activo'}`
  ).join('\n') || '  (sin registros)';

  const lineasC = C.c.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${x.fecha} ${x.hora} | ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.motivo} | ${x.tipo} | ${x.estado}`;
  }).join('\n') || '  (sin registros)';

  const lineasM = C.m.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.nombre} | ${x.dosis} | ${x.frecuencia} | vía ${x.via} | ${x.estado}`;
  }).join('\n') || '  (sin registros)';

  const lineasN = C.n.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${x.fecha} | ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.tipo}${x.titulo?' — '+x.titulo:''}`;
  }).join('\n') || '  (sin registros)';

  const citasHoy = C.c.filter(x=>x.fecha===h);
  const lineasHoy = citasHoy.map(x => {
    const p = C.p.find(q=>q.id===x.pacienteId);
    return `  • ${x.hora} | ${p?p.nombre+' '+p.apellidos:'N/A'} | ${x.motivo} | ${x.estado}`;
  }).join('\n') || '  (ninguna)';

  const cuerpo =
`BACKUP LUMEA MED — ${fechaStr}
${sep}
Clínica ID: ${currentClinicaId} | Usuario: ${currentUser?.name||'—'}
${sep}

RESUMEN
  Pacientes:        ${C.p.length}
  Citas totales:    ${C.c.length}
  Citas hoy:        ${citasHoy.length}
  Medicaciones:     ${C.m.length} (activas: ${C.m.filter(x=>x.estado==='activa').length})
  Notas clínicas:   ${C.n.length}

${sep}
CITAS DE HOY (${h})
${lineasHoy}

${sep}
PACIENTES (${C.p.length})
${lineasP}

${sep}
CITAS (${C.c.length})
${lineasC}

${sep}
MEDICACIONES (${C.m.length})
${lineasM}

${sep}
NOTAS CLÍNICAS (${C.n.length})
${lineasN}

${sep}
Generado automáticamente por Lumea Med v5.1
${fechaStr}`;

  const asunto = `Backup Lumea Med — ${h}`;
  window.location.href = `mailto:sebasgale65@gmail.com?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
  toast('Abriendo cliente de correo con el backup...','info');
}

function importarJSON(e){
  const file=e.target.files[0]; if(!file) return;
  const r=new FileReader();
  r.onload=async ev=>{
    try{
      const d=JSON.parse(ev.target.result);
      const ok=await customConfirm({icon:'📥',title:'Importar backup',msg:'Esto insertará los datos del archivo en Supabase.<br><small style="color:var(--text-light)">No se borran los registros existentes.</small>',okText:'Importar',danger:false});
      if(!ok) return;
      setLoading(true);
      if(d.pacientes?.length) await sb.from('pacientes').upsert(d.pacientes.map(toP));
      if(d.citas?.length) await sb.from('citas').upsert(d.citas.map(toC));
      if(d.medicaciones?.length) await sb.from('medicaciones').upsert(d.medicaciones.map(toM));
      if(d.notas?.length) await sb.from('notas').upsert(d.notas.map(toN));
      setLoading(false);
      toast('Datos importados correctamente ✅');
      await loadAll(); renderView(currentView); updateBadges();
    }catch(err){ setLoading(false); toast('Error al leer el archivo','error'); console.error(err); }
  };
  r.readAsText(file); e.target.value='';
}

// ════════════════════ SIDEBAR MOBILE ════════════════════
function toggleSidebar(){
  const sb=document.getElementById('sidebar'), ov=document.getElementById('sidebar-overlay');
  const open=sb.classList.toggle('open');
  ov.classList.toggle('show',open);
}
function closeSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.remove('show');
}

// ════════════════════ BOTTOM NAV (legacy) ════════════════════
function updateBottomNav(view){
  renderNavQuickGrid(view);
}

// Cerrar modal al hacer click fuera del contenido
document.addEventListener('click', e => {
  if(e.target.classList.contains('modal-overlay') && e.target.classList.contains('open')) {
    const modalId = e.target.id;
    if(modalId && !['modal-confirm'].includes(modalId)) closeModal(modalId);
  }
}, { capture: false });

// ════════════════════ FILTRO PACIENTES ════════════════════
let filtroEstado='todos';
function setFiltroEstado(estado, chipEl){
  filtroEstado=estado;
  document.querySelectorAll('.filter-chips .chip').forEach(c=>c.classList.remove('active'));
  if(chipEl) chipEl.classList.add('active');
  filterPacientes(document.getElementById('pacientes-search')?.value||'');
}
function filterPacientes(q){
  const q2=q.toLowerCase().trim();
  let lista=C.p;
  if(filtroEstado!=='todos') lista=lista.filter(x=>(x.estado||'activo')===filtroEstado);
  if(q2) lista=lista.filter(p=>`${p.nombre} ${p.apellidos} ${p.identificacion||''} ${p.telefono||''}`.toLowerCase().includes(q2));
  const countEl=document.getElementById('pacientes-count');
  if(countEl) countEl.textContent=lista.length===C.p.length?`${C.p.length} pacientes`:`${lista.length} de ${C.p.length} pacientes`;
  renderPacientesList(lista);
}

function buscarPacienteEnModal(q) {
  const el = document.getElementById('pac-buscar-id-resultados');
  if(!el) return;
  const query = q.trim().toLowerCase();
  if(query.length < 2) { el.innerHTML = ''; return; }
  const matches = C.p.filter(p => p.identificacion?.toLowerCase().includes(query));
  if(!matches.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--text-light);padding:4px 0">No se encontraron pacientes con esa identificación.</div>';
    return;
  }
  el.innerHTML = matches.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card);border-radius:8px;margin-bottom:6px;border:1.5px solid var(--primary)">
      <div>
        <div style="font-weight:700;font-size:13px">${p.nombre} ${p.apellidos}</div>
        <div style="font-size:11px;color:var(--text-light)">${p.identificacion||''} · ${calcEdad(p.fechaNac)}</div>
      </div>
      <button onclick="closeModal('modal-paciente');navigate('paciente-detalle',${p.id})" class="btn btn-secondary btn-sm">Ver expediente</button>
    </div>`).join('');
}

// ════════════════════ SEARCH ════════════════════
function globalSearch(q){
  const dd=document.getElementById('search-dropdown');
  if(!q.trim()){ dd.style.display='none'; return; }
  const r=C.p.filter(p=>`${p.nombre} ${p.apellidos} ${p.identificacion||''} ${p.telefono||''}`.toLowerCase().includes(q.toLowerCase())).slice(0,6);
  dd.innerHTML=r.length?r.map(p=>`<div class="search-result-item" onclick="selectSearchResult(${p.id})"><div class="patient-avatar" style="background:${colAvatar(p.id)};width:30px;height:30px;font-size:11px">${ini(p.nombre,p.apellidos)}</div><div><div style="font-weight:600;font-size:13px">${p.nombre} ${p.apellidos}</div><div class="text-light">${p.identificacion||''} ${p.telefono||''}</div></div></div>`).join(''):'<p style="padding:12px 16px;color:var(--text-light);font-size:13px">Sin resultados</p>';
  dd.style.display='block';
}
function selectSearchResult(id){ document.getElementById('global-search').value=''; document.getElementById('search-dropdown').style.display='none'; navigate('paciente-detalle',id); }

// ════════════════════ HELPERS ════════════════════
function fillSelect(sid) {
  const prefix = sid.split('-')[0];
  const hiddenEl = document.getElementById(sid);
  const txtEl = document.getElementById(prefix+'-pac-txt');
  if(hiddenEl) hiddenEl.value = '';
  if(txtEl) txtEl.value = '';
}

let pendingCitaAfterPaciente = false;

function nuevoPacienteParaCita(nombreHint) {
  pendingCitaAfterPaciente = true;
  closeModal('modal-cita');
  hidePacSug('c');
  openModalPaciente();
  const btnCitar = document.getElementById('btn-guardar-y-citar');
  if(btnCitar) btnCitar.style.display = 'inline-flex';
  if(nombreHint) {
    const parts = nombreHint.trim().split(/\s+/);
    document.getElementById('p-nombre').value = parts[0] || '';
    document.getElementById('p-apellidos').value = parts.slice(1).join(' ') || '';
  }
}

function filterPacSug(q, prefix) {
  const sug = document.getElementById(prefix+'-pac-sug');
  if(!sug) return;
  const q2 = (q||'').toLowerCase().trim();
  const matches = q2.length < 1
    ? C.p.slice(0, 12)
    : C.p.filter(p => (p.nombre+' '+p.apellidos).toLowerCase().includes(q2)
        || (p.identificacion||'').toLowerCase().includes(q2)
        || getExpedienteNum(p.id).toLowerCase().includes(q2)).slice(0, 10);
  if(!matches.length) {
    if(prefix === 'c' && q2.length >= 1) {
      sug.innerHTML =
        '<div style="padding:8px 14px;font-size:12px;color:var(--text-light);border-bottom:1px solid var(--border)">Sin resultados para "'+q+'"</div>'
        + '<div style="display:flex;align-items:center;gap:10px;padding:11px 14px;cursor:pointer;background:var(--primary-light);border-radius:0 0 10px 10px" onmousedown="nuevoPacienteParaCita(\''+q.replace(/'/g,"\\'")+'\')">'
        + '<span style="font-size:20px;flex-shrink:0">➕</span>'
        + '<div><div style="font-size:13px;font-weight:700;color:var(--primary)">Registrar como nuevo paciente</div>'
        + '<div style="font-size:11px;color:var(--primary);opacity:.8">Crea el expediente y abre la cita automáticamente</div></div>'
        + '</div>';
      sug.style.display = 'block';
    } else {
      sug.style.display = 'none';
    }
    return;
  }
  sug.innerHTML = matches.map(p =>
    '<div style="display:flex;align-items:center;gap:10px;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s" onmouseenter="this.style.background=\'var(--primary-light)\'" onmouseleave="this.style.background=\'\'" onmousedown="selectPac(\''+prefix+'\','+p.id+',\''+((p.nombre+' '+p.apellidos).replace(/'/g,'\\\''))+'\')">'
    + '<div style="width:32px;height:32px;border-radius:50%;background:'+colAvatar(p.id)+';display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:700;flex-shrink:0">'+ini(p.nombre,p.apellidos)+'</div>'
    + '<div><div style="font-size:13px;font-weight:600;color:var(--text)">'+p.nombre+' '+p.apellidos+'</div>'
    + '<div style="font-size:11px;color:var(--text-light)"><span style="color:var(--primary);font-weight:600">'+getExpedienteNum(p.id)+'</span>'+(p.identificacion?' · '+p.identificacion:'')+(p.telefono?' · '+p.telefono:'')+'</div></div>'
    + '</div>'
  ).join('');
  sug.style.display = 'block';
}

function selectPac(prefix, pid, nombre) {
  const hiddenEl = document.getElementById(prefix+'-paciente');
  const txtEl = document.getElementById(prefix+'-pac-txt');
  if(hiddenEl) hiddenEl.value = pid;
  if(txtEl) txtEl.value = nombre;
  hidePacSug(prefix);
}

function hidePacSug(prefix) {
  const sug = document.getElementById(prefix+'-pac-sug');
  if(sug) sug.style.display = 'none';
}

function setPacienteSelect(sid, pid) {
  const prefix = sid.split('-')[0];
  const p = C.p.find(x => x.id === pid);
  const hiddenEl = document.getElementById(sid);
  const txtEl = document.getElementById(prefix+'-pac-txt');
  if(hiddenEl) hiddenEl.value = pid || '';
  if(txtEl) txtEl.value = p ? p.nombre+' '+p.apellidos : '';
}
function openModalOverlay(id){ document.getElementById(id).classList.add('open'); document.body.classList.add('modal-open'); }
function closeModal(id){
  document.getElementById(id).classList.remove('open');
  if(id==='modal-cita') editingCitaId=null;
  else if(id==='modal-medicacion') editingMedId=null;
  else if(id==='modal-nota') editingNotaId=null;
  else if(id==='modal-procedimiento') editingProcId=null;
  else if(id==='modal-odontograma') _odoCurrentPid=null;
  else editingId=null;
  // solo quitar scroll-lock si no queda otro modal abierto
  if(!document.querySelector('.modal-overlay.open')) document.body.classList.remove('modal-open');
}

document.addEventListener('click',e=>{
  if(!e.target.closest('#global-search')&&!e.target.closest('#search-dropdown')) document.getElementById('search-dropdown').style.display='none';
  if(!e.target.closest('#m-nombre')&&!e.target.closest('#med-sugerencias')) { const b=document.getElementById('med-sugerencias'); if(b) b.style.display='none'; }
});

// ════════════════════ MEDICAMENTOS NICARAGUA ════════════════════
const MEDICAMENTOS_NI = [
  // Analgésicos / Antiinflamatorios
  {n:'Acetaminofén 500mg',p:'Tableta',d:'1 tab cada 6-8h',v:'oral'},
  {n:'Acetaminofén 120mg/5ml',p:'Jarabe',d:'10-15mg/kg cada 6h',v:'oral'},
  {n:'Ibuprofeno 400mg',p:'Tableta',d:'1 tab cada 6-8h con alimentos',v:'oral'},
  {n:'Ibuprofeno 200mg/5ml',p:'Suspensión',d:'5-10mg/kg cada 6-8h',v:'oral'},
  {n:'Diclofenaco 50mg',p:'Tableta',d:'1 tab cada 8h con alimentos',v:'oral'},
  {n:'Diclofenaco 75mg/3ml',p:'Inyectable',d:'1 amp cada 12-24h',v:'inyectable'},
  {n:'Naproxeno 500mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Ketorolaco 10mg',p:'Tableta',d:'1 tab cada 8h (máx 5 días)',v:'oral'},
  {n:'Ketorolaco 30mg/1ml',p:'Inyectable',d:'1 amp cada 6-8h',v:'inyectable'},
  {n:'Aspirina 100mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Aspirina 500mg',p:'Tableta',d:'1-2 tab cada 8h',v:'oral'},
  {n:'Tramadol 50mg',p:'Cápsula',d:'1 cap cada 6-8h',v:'oral'},
  {n:'Tramadol 100mg/2ml',p:'Inyectable',d:'100mg IV/IM cada 8h',v:'inyectable'},
  {n:'Metamizol 500mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Metamizol 1g/2ml',p:'Inyectable',d:'1-2g IV/IM cada 8h',v:'inyectable'},
  // Antibióticos
  {n:'Amoxicilina 500mg',p:'Cápsula',d:'1 cap cada 8h x 7 días',v:'oral'},
  {n:'Amoxicilina 250mg/5ml',p:'Suspensión',d:'40mg/kg/día cada 8h',v:'oral'},
  {n:'Amoxicilina + Ác. Clavulánico 875mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Ampicilina 500mg',p:'Cápsula',d:'1 cap cada 6h',v:'oral'},
  {n:'Ampicilina 1g',p:'Inyectable',d:'1g IV cada 6h',v:'inyectable'},
  {n:'Azitromicina 500mg',p:'Tableta',d:'1 tab diaria x 3 días',v:'oral'},
  {n:'Ciprofloxacino 500mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Clindamicina 300mg',p:'Cápsula',d:'1 cap cada 8h',v:'oral'},
  {n:'Doxiciclina 100mg',p:'Cápsula',d:'1 cap cada 12h',v:'oral'},
  {n:'Eritromicina 500mg',p:'Tableta',d:'1 tab cada 6h x 7 días',v:'oral'},
  {n:'Metronidazol 500mg',p:'Tableta',d:'1 tab cada 8h x 7 días',v:'oral'},
  {n:'Metronidazol 500mg/100ml',p:'Inyectable IV',d:'500mg IV cada 8h',v:'inyectable'},
  {n:'Trimetoprim/Sulfametoxazol 160/800mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Trimetoprim/Sulfametoxazol 40/200mg/5ml',p:'Suspensión',d:'1ml/kg/día en 2 dosis',v:'oral'},
  {n:'Ceftriaxona 1g',p:'Inyectable',d:'1-2g cada 12-24h IV/IM',v:'inyectable'},
  {n:'Cefalexina 500mg',p:'Cápsula',d:'1 cap cada 6-8h x 7 días',v:'oral'},
  {n:'Gentamicina 80mg/2ml',p:'Inyectable',d:'1.5mg/kg cada 8h IM',v:'inyectable'},
  {n:'Claritromicina 500mg',p:'Tableta',d:'1 tab cada 12h x 7 días',v:'oral'},
  {n:'Nitrofurantoína 100mg',p:'Cápsula',d:'1 cap cada 6h x 7 días',v:'oral'},
  {n:'Penicilina Benzatínica 1.200.000UI',p:'Inyectable',d:'1 amp IM dosis única',v:'inyectable'},
  // Antihipertensivos
  {n:'Enalapril 10mg',p:'Tableta',d:'1 tab cada 12-24h',v:'oral'},
  {n:'Enalapril 5mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Losartán 50mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Losartán 100mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Amlodipino 5mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Amlodipino 10mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Hidroclorotiazida 25mg',p:'Tableta',d:'1 tab diaria por la mañana',v:'oral'},
  {n:'Atenolol 50mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Nifedipino 10mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Captopril 25mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  {n:'Metoprolol 50mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Furosemida 40mg',p:'Tableta',d:'1 tab diaria por la mañana',v:'oral'},
  {n:'Furosemida 20mg/2ml',p:'Inyectable',d:'20-40mg IV/IM',v:'inyectable'},
  {n:'Espironolactona 25mg',p:'Tableta',d:'1-2 tab diarias',v:'oral'},
  // Diabetes
  {n:'Metformina 500mg',p:'Tableta',d:'1 tab con el desayuno y la cena',v:'oral'},
  {n:'Metformina 850mg',p:'Tableta',d:'1 tab con las comidas',v:'oral'},
  {n:'Glibenclamida 5mg',p:'Tableta',d:'1 tab 30min antes del desayuno',v:'oral'},
  {n:'Glimepirida 2mg',p:'Tableta',d:'1 tab diaria antes del desayuno',v:'oral'},
  {n:'Insulina NPH 100UI/ml',p:'Inyectable',d:'Según indicación médica',v:'inyectable'},
  {n:'Insulina Regular 100UI/ml',p:'Inyectable',d:'Según indicación médica',v:'inyectable'},
  // Gastrointestinal
  {n:'Omeprazol 20mg',p:'Cápsula',d:'1 cap en ayunas x 14-28 días',v:'oral'},
  {n:'Omeprazol 40mg',p:'Cápsula',d:'1 cap en ayunas',v:'oral'},
  {n:'Pantoprazol 40mg',p:'Tableta',d:'1 tab en ayunas',v:'oral'},
  {n:'Ranitidina 150mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Metoclopramida 10mg',p:'Tableta',d:'1 tab 30min antes de comidas',v:'oral'},
  {n:'Metoclopramida 10mg/2ml',p:'Inyectable',d:'10mg IV/IM cada 8h',v:'inyectable'},
  {n:'Domperidona 10mg',p:'Tableta',d:'1 tab 30min antes de comidas',v:'oral'},
  {n:'Loperamida 2mg',p:'Cápsula',d:'2 cap inicial, luego 1 cap tras evacuación',v:'oral'},
  {n:'Sales de Rehidratación Oral',p:'Sobre',d:'1 sobre en 1 litro de agua',v:'oral'},
  {n:'Bismuto subcitrato 240mg',p:'Tableta',d:'1 tab cada 8h lejos de comidas',v:'oral'},
  // Respiratorio
  {n:'Salbutamol 100mcg/dosis',p:'Inhalador',d:'1-2 puffs cada 4-6h',v:'inhalada'},
  {n:'Salbutamol 2mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Beclometasona 250mcg',p:'Inhalador',d:'1-2 puffs cada 12h',v:'inhalada'},
  {n:'Budesonida 200mcg',p:'Inhalador',d:'1-2 puffs cada 12h',v:'inhalada'},
  {n:'Ambroxol 30mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  {n:'Ambroxol 15mg/5ml',p:'Jarabe',d:'10ml cada 8h',v:'oral'},
  {n:'Dexametasona 4mg/1ml',p:'Inyectable',d:'4-8mg IV/IM según indicación',v:'inyectable'},
  {n:'Prednisona 5mg',p:'Tableta',d:'Según indicación médica',v:'oral'},
  {n:'Prednisona 20mg',p:'Tableta',d:'Según indicación médica',v:'oral'},
  // Antiparasitarios
  {n:'Albendazol 400mg',p:'Tableta',d:'1 tab dosis única (desparasitación)',v:'oral'},
  {n:'Mebendazol 100mg',p:'Tableta',d:'1 tab cada 12h x 3 días',v:'oral'},
  {n:'Ivermectina 6mg',p:'Tableta',d:'200mcg/kg dosis única',v:'oral'},
  {n:'Tinidazol 500mg',p:'Tableta',d:'4 tab dosis única',v:'oral'},
  {n:'Nistatina 100.000UI/ml',p:'Suspensión',d:'1ml 4 veces al día',v:'oral'},
  // Antihistamínicos
  {n:'Loratadina 10mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Cetirizina 10mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Difenhidramina 25mg',p:'Cápsula',d:'1 cap cada 6-8h',v:'oral'},
  {n:'Clorfeniramina 4mg',p:'Tableta',d:'1 tab cada 8h',v:'oral'},
  // Antifúngicos
  {n:'Fluconazol 150mg',p:'Cápsula',d:'1 cap dosis única',v:'oral'},
  {n:'Ketoconazol 200mg',p:'Tableta',d:'1 tab diaria x 2-4 semanas',v:'oral'},
  {n:'Miconazol 2%',p:'Crema',d:'Aplicar 2 veces al día x 2-4 semanas',v:'topica'},
  {n:'Clotrimazol 1%',p:'Crema',d:'Aplicar 2-3 veces al día',v:'topica'},
  // Vitaminas / Suplementos
  {n:'Ácido Fólico 5mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Ácido Fólico 1mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Sulfato Ferroso 300mg',p:'Tableta',d:'1 tab diaria en ayunas',v:'oral'},
  {n:'Vitamina C 500mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Calcio 500mg',p:'Tableta',d:'1-2 tab diarias con comida',v:'oral'},
  {n:'Vitamina B12 1000mcg',p:'Inyectable',d:'1 amp IM semanal',v:'inyectable'},
  {n:'Complejo B',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Zinc 20mg',p:'Tableta',d:'1 tab diaria x 10-14 días',v:'oral'},
  // Cardiovascular
  {n:'Simvastatina 20mg',p:'Tableta',d:'1 tab en la noche',v:'oral'},
  {n:'Atorvastatina 20mg',p:'Tableta',d:'1 tab diaria',v:'oral'},
  {n:'Digoxina 0.25mg',p:'Tableta',d:'Según indicación médica',v:'oral'},
  {n:'Nitroglicerina 0.5mg SL',p:'Tableta sublingual',d:'1 tab SL al inicio del dolor',v:'sublingual'},
  {n:'Warfarina 5mg',p:'Tableta',d:'Según INR y prescripción',v:'oral'},
  // Neurológico
  {n:'Diazepam 5mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  {n:'Diazepam 10mg/2ml',p:'Inyectable',d:'5-10mg IV/IM según crisis',v:'inyectable'},
  {n:'Clonazepam 0.5mg',p:'Tableta',d:'1 tab cada 12h',v:'oral'},
  {n:'Carbamazepina 200mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  {n:'Ácido Valproico 250mg',p:'Tableta',d:'Según indicación neurológica',v:'oral'},
  {n:'Fluoxetina 20mg',p:'Cápsula',d:'1 cap diaria en la mañana',v:'oral'},
  {n:'Amitriptilina 25mg',p:'Tableta',d:'1 tab en la noche',v:'oral'},
  {n:'Alprazolam 0.25mg',p:'Tableta',d:'1 tab cada 8-12h',v:'oral'},
  // Tiroides
  {n:'Levotiroxina 50mcg',p:'Tableta',d:'1 tab en ayunas 30min antes del desayuno',v:'oral'},
  {n:'Levotiroxina 100mcg',p:'Tableta',d:'1 tab en ayunas 30min antes del desayuno',v:'oral'},
  // Tópicos
  {n:'Hidrocortisona 1%',p:'Crema',d:'Aplicar 2 veces al día',v:'topica'},
  {n:'Betametasona 0.05%',p:'Crema',d:'Aplicar 1-2 veces al día',v:'topica'},
  {n:'Neomicina + Bacitracina',p:'Ungüento',d:'Aplicar 2-3 veces al día',v:'topica'},
  {n:'Ciprofloxacino 0.3% oftálmico',p:'Gotas',d:'1-2 gotas cada 4-6h',v:'topica'},
  {n:'Gentamicina 0.3% oftálmico',p:'Gotas',d:'1-2 gotas cada 6h',v:'topica'},
  // Antimaláricos
  {n:'Cloroquina 250mg',p:'Tableta',d:'Según protocolo malaria',v:'oral'},
  {n:'Primaquina 15mg',p:'Tableta',d:'Según protocolo malaria',v:'oral'},
  // Urgencias / Hospitalario
  {n:'Adrenalina 1mg/1ml',p:'Inyectable',d:'0.3-0.5mg SC en anafilaxia',v:'inyectable'},
  {n:'Atropina 0.5mg/1ml',p:'Inyectable',d:'0.5-1mg IV/IM',v:'inyectable'},
  {n:'Dexametasona 8mg/2ml',p:'Inyectable',d:'Según indicación médica',v:'inyectable'},
  {n:'Lidocaína 2%',p:'Inyectable',d:'Según procedimiento',v:'inyectable'},
  {n:'Oxitocina 10UI/1ml',p:'Inyectable',d:'Según protocolo obstétrico',v:'inyectable'},
  {n:'Heparina 5000UI/0.2ml',p:'Inyectable',d:'Según protocolo médico',v:'inyectable'},
  {n:'Enoxaparina 40mg/0.4ml',p:'Inyectable SC',d:'40mg SC diaria',v:'inyectable'},
];

let medSugIdx = -1;

function _minsaToMed(p) {
  return { n:p.n, p:p.sub||p.grupo||'MINSA', d:'', v:'oral', cod:p.cod };
}
function _mergeConMinsa(base, q2) {
  const seenNames = new Set(base.map(m=>m.n.toLowerCase()));
  const fromMinsa = MINSA_CATALOG
    .filter(p => (p.n.toLowerCase().includes(q2) || p.cod.includes(q2)) && !seenNames.has(p.n.toLowerCase()))
    .slice(0, 5)
    .map(_minsaToMed);
  return [...base, ...fromMinsa].slice(0, 10);
}
function buscarMedicamento(q) {
  const box = document.getElementById('med-sugerencias');
  if(!q || q.length < 2) { box.style.display='none'; medSugIdx=-1; return; }
  const q2 = q.toLowerCase();
  const base = MEDICAMENTOS_NI.filter(m => m.n.toLowerCase().includes(q2) || m.p.toLowerCase().includes(q2)).slice(0, 6);
  const matches = _mergeConMinsa(base, q2);
  if(!matches.length) { box.style.display='none'; return; }
  box.innerHTML = matches.map((m, i) => `
    <div class="med-sug-item" data-idx="${i}"
      onmousedown="seleccionarMedicamento(${JSON.stringify(m).replace(/"/g,'&quot;')})"
      onmouseenter="medSugIdx=${i};resaltarSug()"
      style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${m.n}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:1px">${m.cod?`<span style="font-family:monospace;background:var(--bg);padding:0 3px;border-radius:3px;border:1px solid var(--border)">${m.cod}</span> · `:''}<span style="text-transform:capitalize">${m.p}</span>${m.d?' · '+m.d:''}</div>
      </div>
      <span class="tag tag-gray" style="font-size:10px;flex-shrink:0;margin-left:10px">${m.v}</span>
    </div>`).join('');
  box.querySelector('.med-sug-item:last-child').style.borderBottom = 'none';
  box.style.display = 'block';
  medSugIdx = -1;
  box._matches = matches;
}

function resaltarSug() {
  document.querySelectorAll('.med-sug-item').forEach((el, i) => {
    el.style.background = i === medSugIdx ? 'var(--primary-light)' : '';
  });
}

function navMedSug(e) {
  const box = document.getElementById('med-sugerencias');
  const items = box.querySelectorAll('.med-sug-item');
  if(!items.length) return;
  if(e.key === 'ArrowDown') { e.preventDefault(); medSugIdx = Math.min(medSugIdx+1, items.length-1); resaltarSug(); }
  else if(e.key === 'ArrowUp') { e.preventDefault(); medSugIdx = Math.max(medSugIdx-1, 0); resaltarSug(); }
  else if(e.key === 'Enter' && medSugIdx >= 0) { e.preventDefault(); seleccionarMedicamento(box._matches[medSugIdx]); }
  else if(e.key === 'Escape') { box.style.display='none'; }
}

function seleccionarMedicamento(m) {
  document.getElementById('m-nombre').value = m.n;
  document.getElementById('m-dosis').value = m.d;
  const viaMap = {oral:'oral',inyectable:'inyectable',topica:'topica',inhalada:'inhalada',sublingual:'sublingual'};
  const viaEl = document.getElementById('m-via');
  if(viaMap[m.v]) viaEl.value = viaMap[m.v];
  document.getElementById('med-sugerencias').style.display = 'none';
  medSugIdx = -1;
}

// ════════════════════ INIT ════════════════════
document.addEventListener('DOMContentLoaded', async () => {
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
  if (localStorage.getItem('lm_theme') === 'dark') {
    document.body.classList.add('dark');
    document.getElementById('theme-icon').textContent = '🌙';
  }

  // Ocultar login mientras verificamos sesión — evita flash de pantalla de login al recargar
  const ls = document.getElementById('login-screen');
  const lo = document.getElementById('loading-overlay');
  if(ls) ls.style.display = 'none';
  if(lo) lo.classList.add('show');

  try {
    const { data: { session } } = await sb.auth.getSession();
    if(session?.user) {
      // Guardar email del auth para isSuperAdmin()
      if(session.user.email) _authEmail = session.user.email.trim().toLowerCase();
      const { data: profile } = await sb.from('profiles').select('*').eq('id', session.user.id).single();
      if(profile) {
        if(!profile.email && session.user.email) profile.email = session.user.email;
        await entrarConPerfil(profile); return;
      }
      await sb.auth.signOut();
    }
    // Legacy fallback
    const saved = sessionStorage.getItem('lm_user');
    if(saved) { await entrarConPerfil(JSON.parse(saved)); return; }
  } catch(e) { sessionStorage.removeItem('lm_user'); }

  // Sin sesión — mostrar login
  if(lo) lo.classList.remove('show');
  if(ls) {
    ls.style.cssText = 'display:flex;opacity:0;transition:opacity .35s';
    setTimeout(() => { ls.style.opacity = '1'; }, 20);
  }
});

async function setNewPassword() {
  const p1 = document.getElementById('rec-pass1').value;
  const p2 = document.getElementById('rec-pass2').value;
  const errEl = document.getElementById('rec-error');
  errEl.style.display = 'none';
  if(!p1 || p1.length < 6) { errEl.textContent = 'Mínimo 6 caracteres'; errEl.style.display = 'block'; return; }
  if(p1 !== p2) { errEl.textContent = 'Las contraseñas no coinciden'; errEl.style.display = 'block'; return; }
  const { error } = await sb.auth.updateUser({ password: p1 });
  if(error) { errEl.textContent = 'Error: ' + error.message; errEl.style.display = 'block'; return; }
  // Cerrar sesión y redirigir al login
  await sb.auth.signOut();
  sessionStorage.removeItem('lm_user');
  window.location.hash = '';
  document.getElementById('recovery-overlay').style.display = 'none';
  toast('Contraseña actualizada ✅ — inicia sesión con tu nueva clave', 'success');
  setTimeout(() => window.location.reload(), 1800);
}

async function verificarPin() {
  // deprecated — kept para compatibilidad
  if (false) {
    document.getElementById('login-pin').value = '';
  }
}

async function cargarUsuariosLogin() { /* reemplazado por login email+password */ }

// ════════════════════ AGENDAS ════════════════════
let selAgendasDoc = null;
let selAgendasDate = hoy();

const rolLabel2 = r => ({admin:'Administración',medico:'Médico',medico_admin:'Médico Adm.',dr:'Dr.',dra:'Dra.',recepcion:'Recepcionista',enfermeria:'Enfermería',superadmin:'Super Admin',farmaceutico:'Farmacéutico'}[r]||r);

function renderAgendas() {
  selAgendasDate = hoy();
  renderAgendasDoctors();
  if(selAgendasDoc) renderAgendasRight();
}

function renderAgendasDoctors() {
  const el = document.getElementById('agendas-doctors-list');
  if(!el) return;
  const staff = C.prof.length ? C.prof : [];
  if(!staff.length) {
    el.innerHTML = `<div class="empty-state" style="padding:20px"><div class="empty-icon" style="font-size:28px">👥</div><p style="font-size:12px">No hay personal registrado.<br>Agrega desde el panel Admin.</p></div>`;
    return;
  }
  const today = hoy();
  el.innerHTML = staff.map(p => {
    const citasHoy = C.c.filter(c=>c.medicoId==p.id&&c.fecha===today&&c.estado!=='cancelada').length;
    const isSelected = selAgendasDoc == p.id;
    return `<div class="doc-card${isSelected?' selected':''}" onclick="selectDoctorAgenda('${p.id}')">
      <div class="doc-emoji">${p.icono||'👤'}</div>
      <div style="flex:1;min-width:0">
        <div class="doc-name">${p.nombre}</div>
        <div class="doc-role-lbl">${rolLabel2(p.rol)}</div>
      </div>
      ${citasHoy>0?`<span style="background:var(--primary);color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:10px">${citasHoy}</span>`:''}
    </div>`;
  }).join('');
}

function selectDoctorAgenda(profileId) {
  selAgendasDoc = profileId;
  selAgendasDate = hoy();
  renderAgendasDoctors();
  renderAgendasRight();
}

function renderAgendasRight() {
  const el = document.getElementById('agendas-right-panel');
  if(!el) return;
  const prof = C.prof.find(p=>p.id==selAgendasDoc);
  if(!prof) return;

  const citasDoc = C.c.filter(c=>c.medicoId==selAgendasDoc);
  const citaCount = {};
  citasDoc.forEach(c=>{ citaCount[c.fecha]=(citaCount[c.fecha]||0)+1; });

  const citasDelDia = citasDoc.filter(c=>c.fecha===selAgendasDate).sort((a,b)=>(a.hora||'').localeCompare(b.hora||''));
  const pendientesTotales = citasDoc.filter(c=>c.estado==='pendiente'||c.estado==='confirmada').length;
  const atendidosHoy = citasDoc.filter(c=>c.fecha===hoy()&&c.estado==='completada').length;

  el.innerHTML = `
    <!-- Header del doctor -->
    <div class="card" style="margin-bottom:14px">
      <div style="display:flex;align-items:center;gap:14px">
        <div style="font-size:42px;width:58px;height:58px;display:flex;align-items:center;justify-content:center;background:var(--bg);border-radius:14px;border:1.5px solid var(--border);flex-shrink:0">${prof.icono||'👤'}</div>
        <div style="flex:1">
          <div style="font-size:18px;font-weight:800;color:var(--text)">${prof.nombre}</div>
          <div style="font-size:12px;color:var(--text-light);margin-top:2px">${rolLabel2(prof.rol)}${prof.email?' · '+prof.email:''}</div>
        </div>
        <div style="display:flex;gap:10px">
          <div style="text-align:center;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:var(--primary)">${atendidosHoy}</div>
            <div style="font-size:10px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-top:2px">Hoy</div>
          </div>
          <div style="text-align:center;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:var(--warning)">${pendientesTotales}</div>
            <div style="font-size:10px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-top:2px">Pendientes</div>
          </div>
          <div style="text-align:center;background:var(--bg);border-radius:10px;padding:10px 14px;border:1px solid var(--border)">
            <div style="font-size:20px;font-weight:800;color:var(--text)">${citasDoc.length}</div>
            <div style="font-size:10px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-top:2px">Total</div>
          </div>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
      <!-- Calendario -->
      <div class="card">
        <div class="card-header" style="margin-bottom:14px"><h3>🗓️ Calendario</h3></div>
        <div class="cal-wrap" id="agenda-cal-${prof.id}"></div>
        <div class="cal-legend"><div class="cal-legend-dot"></div><span>Tiene citas agendadas</span></div>
      </div>

      <!-- Citas del día seleccionado -->
      <div class="card">
        <div class="card-header" style="margin-bottom:14px">
          <h3>📋 ${formatFecha(selAgendasDate)}</h3>
          ${(isSuperAdmin() || currentUser?.key !== 'medico' || currentUser?.id == prof.id)
            ? `<button class="btn btn-primary btn-sm" onclick="nuevaCitaParaDoctor('${prof.id}')">+ Nueva Cita</button>`
            : ''}
        </div>
        <div id="agenda-day-${prof.id}"></div>
      </div>
    </div>`;

  // Renderizar calendario de este doctor
  renderAgendaCalendar(`agenda-cal-${prof.id}`, citaCount, prof.id);
  renderAgendaDayCitas(`agenda-day-${prof.id}`, citasDelDia);
}

function renderAgendaCalendar(containerId, citaCount, profId) {
  const d = new Date(selAgendasDate+'T12:00:00'), year=d.getFullYear(), month=d.getMonth();
  const today2 = hoy();
  const first = new Date(year,month,1).getDay(), days = new Date(year,month+1,0).getDate();
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const dow = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  let html = `<div class="cal-nav">
    <div class="cal-nav-btns">
      <button class="btn-ghost" onclick="agendaCalNav(-1,'${profId}')">‹</button>
      <button class="btn-ghost" onclick="agendaCalNav(0,'${profId}')" style="font-size:11px;padding:5px 8px">Hoy</button>
      <button class="btn-ghost" onclick="agendaCalNav(1,'${profId}')">›</button>
    </div>
    <h4>${months[month]} <span style="color:var(--text-light);font-weight:500">${year}</span></h4>
  </div><div class="cal-grid">`;
  dow.forEach((dw,i)=>html+=`<div class="cal-dow${i===0||i===6?' weekend-dow':''}">${dw}</div>`);
  for(let i=0;i<first;i++) html+=`<div class="cal-day empty"></div>`;
  for(let i=1;i<=days;i++){
    const ds=`${year}-${String(month+1).padStart(2,'0')}-${String(i).padStart(2,'0')}`;
    const dow2=new Date(ds+'T12:00:00').getDay();
    const isToday=ds===today2, isSel=ds===selAgendasDate&&!isToday;
    const cnt=citaCount[ds]||0;
    const isWeekend=dow2===0||dow2===6;
    const cls=['cal-day',isToday?'today':isSel?'selected':'',cnt?'has-event':'',isWeekend&&!isToday&&!isSel?'weekend':''].filter(Boolean).join(' ');
    const dots=cnt?`<div class="cal-dots">${Array.from({length:Math.min(cnt,3)},()=>`<div class="cal-dot-pip"></div>`).join('')}</div>`:`<div style="height:5px"></div>`;
    html+=`<div class="${cls}" onclick="selectAgendaDay('${ds}','${profId}')" title="${cnt?cnt+' cita'+(cnt>1?'s':''):''}"><span>${i}</span>${dots}</div>`;
  }
  html+='</div>';
  const el=document.getElementById(containerId);
  if(el) el.innerHTML=html;
}

function agendaCalNav(dir, profId) {
  const d=new Date(selAgendasDate+'T12:00:00');
  if(dir===0) selAgendasDate=hoy();
  else d.setMonth(d.getMonth()+dir), selAgendasDate=d.toISOString().split('T')[0];
  renderAgendasRight();
}

function selectAgendaDay(date, profId) {
  selAgendasDate = date;
  renderAgendasRight();
}

function renderAgendaDayCitas(containerId, citas) {
  const el = document.getElementById(containerId);
  if(!el) return;
  if(!citas.length) {
    el.innerHTML=`<div class="empty-state" style="padding:24px 12px">
      <div class="empty-icon" style="font-size:28px">📭</div>
      <p style="margin-bottom:8px">Sin citas agendadas</p>
      <div style="font-size:11px;color:var(--text-light)">Horario disponible: 6:00 AM – 10:00 PM</div>
    </div>`;
    return;
  }
  const ocupadas = citas.filter(c=>c.estado!=='cancelada').length;
  el.innerHTML = citas.map(c=>{
    const p=C.p.find(x=>x.id===c.pacienteId);
    return `<div class="agenda-slot ${c.estado}" onclick="verResumenCita(${c.id})">
      <div style="font-size:12px;font-weight:800;color:var(--primary);min-width:68px;white-space:nowrap">${formatHora12(c.hora||'')}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'Paciente'}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">${c.motivo}</div>
      </div>
      ${estadoTag(c.estado)}
    </div>`;
  }).join('') +
  `<div style="margin-top:10px;padding:8px 10px;background:var(--bg);border-radius:8px;font-size:11px;color:var(--text-light);display:flex;justify-content:space-between">
    <span>🔴 <strong>${ocupadas}</strong> ocupada${ocupadas!==1?'s':''}</span>
    <span>🟢 <strong>${34-ocupadas}</strong> disponible${34-ocupadas!==1?'s':''}</span>
  </div>`;
}

function nuevaCitaParaDoctor(profId) {
  openModalCita();
  setTimeout(()=>{
    const sel=document.getElementById('c-medico');
    if(sel) sel.value=profId;
    const safeDate = selAgendasDate >= hoy() ? selAgendasDate : hoy();
    const fechaEl = document.getElementById('c-fecha');
    fechaEl.value = safeDate;
    fechaEl.min   = hoy();
    // Marcar horas ya ocupadas por este médico ese día
    marcarHorasOcupadas(profId, safeDate);
  },80);
}

function marcarHorasOcupadas(profId, fecha) {
  const ocupadas = new Set(
    C.c.filter(c=>c.medicoId==profId&&c.fecha===fecha&&c.estado!=='cancelada').map(c=>c.hora)
  );
  const sel = document.getElementById('c-hora');
  if(!sel) return;
  Array.from(sel.options).forEach(opt=>{
    if(opt.value && ocupadas.has(opt.value)) {
      opt.textContent = opt.textContent.replace(' 🔴','') + ' 🔴';
      opt.style.color = 'var(--danger)';
    }
  });
}

// ════════════════════ INVENTARIO ════════════════════
let invTab = 'productos', invCatFiltro = '', invMovTipo = '', repInvTab = 'dia';
let editingProdId = null;

function renderInventario() {
  const hoy2 = hoy();
  const entHoy  = C.mov.filter(m=>m.tipo==='entrada'&&m.fecha===hoy2).reduce((s,m)=>s+m.cantidad,0);
  const salHoy  = C.mov.filter(m=>m.tipo==='salida' &&m.fecha===hoy2).reduce((s,m)=>s+m.cantidad,0);
  const bajoStock = C.inv.filter(p=>p.stock<=p.stockMin&&p.stockMin>0).length;
  const sinStock  = C.inv.filter(p=>p.stock===0).length;
  const statsEl = document.getElementById('inv-stats-row');
  if(statsEl) statsEl.innerHTML=`
    <div class="stat-card"><div class="stat-icon si-blue">📦</div><div class="stat-info"><h3>${C.inv.length}</h3><p>Productos</p></div></div>
    <div class="stat-card"><div class="stat-icon si-green">📥</div><div class="stat-info"><h3>${entHoy}</h3><p>Unidades entrada hoy</p></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">📤</div><div class="stat-info"><h3>${salHoy}</h3><p>Unidades salida hoy</p></div></div>
    <div class="stat-card"><div class="stat-icon si-red">⚠️</div><div class="stat-info"><h3>${bajoStock}</h3><p>Bajo stock / sin stock (${sinStock})</p></div></div>`;
  const btnBorrar = document.getElementById('btn-borrar-inventario');
  if(btnBorrar) btnBorrar.style.display = isSuperAdmin() ? '' : 'none';
  switchInvTab(invTab);
}

function switchInvTab(tab) {
  invTab = tab;
  ['productos','movimientos','reportes'].forEach(t=>{
    document.getElementById('inv-panel-'+t).style.display = t===tab?'block':'none';
    document.getElementById('tab-inv-'+t).classList.toggle('active',t===tab);
  });
  if(tab==='productos')   renderProductos();
  if(tab==='movimientos') renderMovimientos();
  if(tab==='reportes')    renderReportesInv();
}

function renderProductos(filtro) {
  const search = filtro !== undefined ? filtro : (document.getElementById('inv-search')?.value||'');
  const el = document.getElementById('tabla-inventario');
  const empty = document.getElementById('inv-empty');
  let items = C.inv;
  if(invCatFiltro) items = items.filter(p=>p.categoria===invCatFiltro);
  if(search) { const q=search.toLowerCase(); items=items.filter(p=>p.nombre.toLowerCase().includes(q)||(p.descripcion||'').toLowerCase().includes(q)||(p.codigoMinsa||'').includes(q)); }
  if(!items.length){ el.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const catIcon = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  el.innerHTML = items.map(p=>{
    const stCls = p.stock===0?'tag-red':p.stockMin>0&&p.stock<=p.stockMin?'tag-orange':'tag-green';
    const stLbl = p.stock===0?'Sin stock':p.stockMin>0&&p.stock<=p.stockMin?'Stock bajo':'OK';
    const vs = _invVencStatus(p);
    const vencBadge = p.fechaVenc ? (
      vs==='vencido' ? `<span class="tag tag-red inv-venc-tag">💀 Vencido ${formatFecha(p.fechaVenc)}</span>` :
      vs==='alerta'  ? `<span class="tag tag-orange inv-venc-tag">🔔 Vence ${formatFecha(p.fechaVenc)}</span>` :
      `<span class="tag tag-green inv-venc-tag">✅ Vence ${formatFecha(p.fechaVenc)}</span>`
    ) : '';
    return `<div class="inv-item${vs==='vencido'?' inv-item-vencido':vs==='alerta'?' inv-item-alerta':''}">
      <div class="inv-item-icon">${catIcon(p.categoria)}</div>
      <div class="inv-item-info">
        <div class="inv-item-name">${p.nombre}${p.codigoMinsa?` <span class="inv-item-minsa">${p.codigoMinsa}</span>`:''}</div>
        <div class="inv-item-sub">${p.unidad}${p.precio!=null?' · C$ '+p.precio.toFixed(2):''}${p.descripcion?' · '+p.descripcion:''}</div>
        ${vencBadge}
      </div>
      <div class="inv-item-right">
        <span class="tag ${stCls}">${stLbl} · <strong>${p.stock}</strong></span>
        <div class="inv-item-actions">
          <button class="btn btn-sm" style="background:linear-gradient(135deg,var(--success),#059669);color:#fff" onclick="openModalEntrada(${p.id})" title="Entrada">📥</button>
          <button class="btn btn-sm btn-danger" onclick="openModalSalida(${p.id})" title="Salida">📤</button>
          <button class="btn btn-secondary btn-sm" onclick="abrirKardex(${p.id})" title="Kardex">📋</button>
          <button class="btn btn-secondary btn-sm" onclick="openModalProducto(${p.id})" title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm" onclick="eliminarProducto(${p.id})" title="Eliminar">🗑️</button>
        </div>
      </div>
    </div>`;
  }).join('');
}

function abrirKardex(prodId) {
  const prod = C.inv.find(p=>p.id===prodId);
  if(!prod) return;
  document.getElementById('kardex-title').textContent = `📋 Kardex — ${prod.nombre}`;
  const stColor = prod.stock===0?'var(--danger)':prod.stockMin>0&&prod.stock<=prod.stockMin?'var(--warning)':'var(--success)';
  document.getElementById('kardex-product-info').innerHTML = `
    <div style="background:var(--bg);border-radius:10px;padding:14px;display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-bottom:14px">
      <div><div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-bottom:4px">Stock actual</div><div style="font-size:22px;font-weight:800;color:${stColor}">${prod.stock} <span style="font-size:14px;font-weight:500">${prod.unidad}</span></div></div>
      <div><div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-bottom:4px">Stock mínimo</div><div style="font-size:20px;font-weight:700">${prod.stockMin}</div></div>
      <div><div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-bottom:4px">Precio unitario</div><div style="font-size:18px;font-weight:700">${prod.precio!=null?'C$ '+prod.precio.toFixed(2):'—'}</div></div>
      <div><div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-bottom:4px">Categoría</div><div style="font-size:14px;font-weight:600">${prod.categoria}</div></div>
      ${prod.codigoMinsa?`<div><div style="font-size:11px;color:var(--text-light);font-weight:600;text-transform:uppercase;margin-bottom:4px">Código MINSA</div><div style="font-family:monospace;font-size:13px;font-weight:700;color:var(--primary)">${prod.codigoMinsa}</div></div>`:''}
    </div>`;
  const movs = C.mov.filter(m=>m.invId===prodId).sort((a,b)=>a.fecha.localeCompare(b.fecha));
  let balance = 0;
  const rows = movs.map(m => { balance += m.tipo==='entrada'?m.cantidad:-m.cantidad; return {...m, saldo:balance}; }).reverse();
  const tbody = document.getElementById('kardex-tbody');
  if(!rows.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:28px;color:var(--text-light)">Sin movimientos registrados</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(r => `<tr>
      <td>${formatFecha(r.fecha)}</td>
      <td><span class="inv-badge-${r.tipo}">${r.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td>
      <td style="font-weight:700;font-size:15px;color:${r.tipo==='entrada'?'var(--success)':'var(--danger)'}">${r.tipo==='entrada'?'+':'−'}${r.cantidad}</td>
      <td style="font-size:12px;color:var(--text-light)">${r.motivo||'—'}</td>
      <td style="font-weight:700">${r.saldo} <span style="font-size:11px;color:var(--text-light)">${prod.unidad}</span></td>
    </tr>`).join('');
  }
  document.getElementById('modal-kardex').classList.add('open');
}

function filterInventario(v){ renderProductos(v); }
function setInvCat(cat,el){ invCatFiltro=cat; document.querySelectorAll('#inv-panel-productos .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderProductos(); }
function setMovTipo(tipo,el){ invMovTipo=tipo; document.querySelectorAll('#inv-panel-movimientos .chip').forEach(c=>c.classList.remove('active')); el.classList.add('active'); renderMovimientos(); }

function renderMovimientos() {
  const fecha = document.getElementById('inv-mov-fecha')?.value||'';
  const el = document.getElementById('tabla-movimientos');
  const empty = document.getElementById('mov-empty');
  let movs = [...C.mov];
  if(fecha) movs = movs.filter(m=>m.fecha===fecha);
  if(invMovTipo) movs = movs.filter(m=>m.tipo===invMovTipo);
  movs.sort((a,b)=>b.fecha.localeCompare(a.fecha)||b.id-a.id);
  if(!movs.length){ el.innerHTML=''; empty.style.display='block'; return; }
  empty.style.display='none';
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  el.innerHTML = movs.map(m=>{
    const prod = C.inv.find(p=>p.id===m.invId);
    const [,mm,dd]=(m.fecha||hoy()).split('-');
    const esEntrada = m.tipo==='entrada';
    return `<div class="mov-item">
      <div class="mov-pill ${m.tipo}">
        <div class="mov-pill-day">${dd}</div>
        <div class="mov-pill-month">${MESES[parseInt(mm)-1]}</div>
      </div>
      <div class="inv-item-info">
        <div class="inv-item-name">${prod?prod.nombre:'—'}</div>
        <div class="inv-item-sub">${m.motivo||'Sin motivo'}${prod?' · '+prod.unidad:''}</div>
      </div>
      <div class="mov-item-right">
        <span class="inv-badge-${m.tipo}">${esEntrada?'📥 Entrada':'📤 Salida'}</span>
        <span class="mov-qty ${m.tipo}">${esEntrada?'+':'−'}${m.cantidad}</span>
      </div>
    </div>`;
  }).join('');
}

// ── Reportes de inventario ──
function switchRepTab(tab){
  repInvTab=tab;
  ['dia','semana','mes','anual'].forEach(t=>{
    document.getElementById('tab-rep-'+t).classList.toggle('active',t===tab);
  });
  renderReportesInv();
}

function renderReportesInv(){
  const el=document.getElementById('rep-inv-content'); if(!el) return;
  const now=new Date();
  let movsFiltro=[], titulo='', rangoLabel='';

  if(repInvTab==='dia'){
    const fecha=hoy();
    movsFiltro=C.mov.filter(m=>m.fecha===fecha);
    titulo=`Reporte Diario — ${formatFecha(fecha)}`;
  } else if(repInvTab==='semana'){
    const lunes=new Date(now); lunes.setDate(now.getDate()-(now.getDay()||7)+1); lunes.setHours(0,0,0,0);
    const dom=new Date(lunes); dom.setDate(lunes.getDate()+6);
    const s=d=>d.toISOString().split('T')[0];
    movsFiltro=C.mov.filter(m=>m.fecha>=s(lunes)&&m.fecha<=s(dom));
    titulo=`Reporte Semanal — ${formatFecha(s(lunes))} al ${formatFecha(s(dom))}`;
  } else if(repInvTab==='mes'){
    const mes=hoy().slice(0,7);
    movsFiltro=C.mov.filter(m=>m.fecha.startsWith(mes));
    titulo=`Reporte Mensual — ${new Date(now.getFullYear(),now.getMonth(),1).toLocaleDateString('es-ES',{month:'long',year:'numeric'})}`;
  } else {
    const yr=now.getFullYear().toString();
    movsFiltro=C.mov.filter(m=>m.fecha.startsWith(yr));
    titulo=`Reporte Anual — ${yr}`;
  }

  const entradas=movsFiltro.filter(m=>m.tipo==='entrada');
  const salidas =movsFiltro.filter(m=>m.tipo==='salida');
  const totEnt=entradas.reduce((s,m)=>s+m.cantidad,0);
  const totSal=salidas.reduce((s,m)=>s+m.cantidad,0);

  // Top productos con más movimiento
  const freq={};
  movsFiltro.forEach(m=>{ freq[m.invId]=(freq[m.invId]||0)+m.cantidad; });
  const topProds=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,v])=>{
    const p=C.inv.find(x=>x.id==id); return {k:p?p.nombre:'#'+id,v};
  });
  const maxV=topProds.length?Math.max(...topProds.map(x=>x.v),1):1;

  el.innerHTML=`
    <h3 style="font-size:14px;font-weight:700;color:var(--text-light);margin-bottom:14px">${titulo}</h3>
    <div class="stats-grid" style="margin-bottom:18px">
      <div class="stat-card"><div class="stat-icon si-green">📥</div><div class="stat-info"><h3>${totEnt}</h3><p>Total entradas</p></div></div>
      <div class="stat-card"><div class="stat-icon si-orange">📤</div><div class="stat-info"><h3>${totSal}</h3><p>Total salidas</p></div></div>
      <div class="stat-card"><div class="stat-icon si-blue">🔄</div><div class="stat-info"><h3>${movsFiltro.length}</h3><p>Movimientos</p></div></div>
      <div class="stat-card"><div class="stat-icon si-red">⚠️</div><div class="stat-info"><h3>${C.inv.filter(p=>p.stock<=p.stockMin&&p.stockMin>0).length}</h3><p>Bajo stock ahora</p></div></div>
    </div>
    ${topProds.length?`<div class="card" style="margin-bottom:14px">
      <div class="card-header"><h3>🏆 Productos con más movimiento</h3></div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${topProds.map(d=>`<div class="rep-bar-row">
          <div class="rep-bar-label">${d.k}</div>
          <div class="rep-bar-track">
            <div class="rep-bar-fill" style="width:${Math.round(d.v/maxV*100)}%;min-width:${d.v?'24px':'0'}">
              ${d.v?`<span>${d.v}</span>`:''}
            </div>
          </div>
          <div class="rep-bar-val">${d.v}</div>
        </div>`).join('')}
      </div>
    </div>`:''}
    ${!movsFiltro.length?`<div class="empty-state"><div class="empty-icon">📊</div><p>Sin movimientos en este período</p></div>`:''}`;
}

// Returns 'vencido' | 'alerta' | 'ok' | null (null = no expiration set)
function _invVencStatus(p) {
  if(!p.fechaVenc) return null;
  const h = hoy();
  if(p.fechaVenc <= h) return 'vencido';
  const d = new Date(p.fechaVenc);
  d.setMonth(d.getMonth() - (p.alertaMeses||1));
  if(h >= d.toISOString().split('T')[0]) return 'alerta';
  return 'ok';
}

function _onProdVencChange() {
  const v = document.getElementById('prod-vencimiento')?.value;
  const w = document.getElementById('prod-alerta-wrap');
  if(w) w.style.display = v ? '' : 'none';
  const prev = document.getElementById('prod-alerta-preview');
  if(!prev || !v) return;
  const meses = Number(document.getElementById('prod-alerta-meses')?.value || 1);
  const d = new Date(v); d.setMonth(d.getMonth() - meses);
  const alertStr = d.toISOString().split('T')[0];
  const [y,mo,day] = alertStr.split('-');
  const mesesLabel = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  prev.textContent = `Se alertará a partir del ${parseInt(day)} de ${mesesLabel[parseInt(mo)-1]} de ${y}`;
}

// ── Modal Producto ──
function openModalProducto(id){
  editingProdId=id||null;
  document.getElementById('modal-producto-title').textContent=id?'✏️ Editar Producto':'📦 Nuevo Producto';
  const stockWrap = document.getElementById('prod-stock-wrap');
  if(id){
    const p=C.inv.find(x=>x.id===id); if(!p) return;
    document.getElementById('prod-nombre').value=p.nombre;
    document.getElementById('prod-categoria').value=p.categoria;
    document.getElementById('prod-unidad').value=p.unidad;
    document.getElementById('prod-stock-min').value=p.stockMin;
    document.getElementById('prod-precio').value=p.precio!=null?p.precio:'';
    document.getElementById('prod-descripcion').value=p.descripcion||'';
    document.getElementById('prod-vencimiento').value=p.fechaVenc||'';
    document.getElementById('prod-alerta-meses').value=p.alertaMeses||1;
    _onProdVencChange();
    // Ocultar stock al editar — el stock solo cambia mediante movimientos de entrada/salida
    if(stockWrap) stockWrap.style.display='none';
  } else {
    ['prod-nombre','prod-stock','prod-stock-min','prod-precio','prod-descripcion'].forEach(f=>document.getElementById(f).value='');
    document.getElementById('prod-categoria').value='medicamento';
    document.getElementById('prod-unidad').value='unidad';
    document.getElementById('prod-vencimiento').value='';
    document.getElementById('prod-alerta-meses').value=1;
    const alertWrap = document.getElementById('prod-alerta-wrap');
    if(alertWrap) alertWrap.style.display='none';
    if(stockWrap) stockWrap.style.display='';
  }
  document.getElementById('modal-producto').classList.add('open');
}

async function guardarProducto(){
  if(!currentClinicaId){ toast('Tu cuenta no tiene una clínica asignada. Contacta al Super Admin.','error'); return; }
  const nombre=document.getElementById('prod-nombre').value.trim();
  if(!nombre){ toast('El nombre es obligatorio','error'); return; }
  setLoading(true);
  if(editingProdId){
    // Al editar: no tocar stock_actual (solo se mueve con movimientos) ni borrar codigoMinsa
    const existing = C.inv.find(p=>p.id===editingProdId);
    const upd = {
      nombre,
      categoria: document.getElementById('prod-categoria').value,
      unidad: document.getElementById('prod-unidad').value,
      stock_minimo: Number(document.getElementById('prod-stock-min').value||0),
      precio_unitario: document.getElementById('prod-precio').value||null,
      descripcion: document.getElementById('prod-descripcion').value||null,
      codigo_minsa: existing?.codigoMinsa||null,
      fecha_vencimiento: document.getElementById('prod-vencimiento').value||null,
      alerta_meses_antes: Number(document.getElementById('prod-alerta-meses').value||1)
    };
    const{error}=await sb.from('inventario').update(upd).eq('id',editingProdId);
    if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
    toast('Producto actualizado');
  } else {
    const obj=toInv({
      nombre, categoria:document.getElementById('prod-categoria').value,
      unidad:document.getElementById('prod-unidad').value,
      stock:document.getElementById('prod-stock').value||0,
      stockMin:document.getElementById('prod-stock-min').value||0,
      precio:document.getElementById('prod-precio').value||null,
      descripcion:document.getElementById('prod-descripcion').value||null,
      codigoMinsa:null,
      fechaVenc:document.getElementById('prod-vencimiento').value||null,
      alertaMeses:Number(document.getElementById('prod-alerta-meses').value||1)
    });
    const{error}=await sb.from('inventario').insert(obj);
    if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
    toast('Producto agregado ✅');
  }
  closeModal('modal-producto');
  await loadAll(); renderInventario(); setLoading(false);
}

async function eliminarProducto(id){
  const p=C.inv.find(x=>x.id===id);
  const ok=await customConfirm({icon:'📦',title:'Eliminar producto',msg:`¿Eliminar <strong>${p?.nombre}</strong>?<br><br>También se eliminarán todos sus movimientos de inventario.`,okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const{error}=await sb.from('inventario').delete().eq('id',id);
  if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
  toast('Producto eliminado');
  await loadAll(); renderInventario(); setLoading(false);
}

async function eliminarTodoInventario() {
  if(!isSuperAdmin()) return;
  const total = C.inv.length;
  if(!total) { toast('El inventario ya está vacío','info'); return; }
  const ok = await customConfirm({
    icon: '🗑️',
    title: 'Borrar todo el inventario',
    msg: `¿Estás seguro? Se eliminarán <strong>${total} producto${total!==1?'s':''}</strong> y todos sus movimientos de esta clínica.<br><br>Esta acción <strong>no se puede deshacer</strong>.`,
    okText: 'Sí, borrar todo',
    cancelText: 'Cancelar'
  });
  if(!ok) return;
  setLoading(true);
  const { error: errMov } = await sb.from('inventario_movimientos').delete().eq('clinica_id', currentClinicaId);
  if(errMov) { toast('Error al borrar movimientos: '+errMov.message,'error'); setLoading(false); return; }
  const { error: errInv } = await sb.from('inventario').delete().eq('clinica_id', currentClinicaId);
  if(errInv) { toast('Error al borrar inventario: '+errInv.message,'error'); setLoading(false); return; }
  await loadAll(); renderInventario(); setLoading(false);
  toast(`Inventario borrado — ${total} producto${total!==1?'s':''} eliminado${total!==1?'s':''}`, 'success');
}

// ── Modales Entrada / Salida ──
function fillProdSelect(selId, selectedId){
  const sel=document.getElementById(selId);
  sel.innerHTML='<option value="">Seleccionar producto...</option>'+
    C.inv.map(p=>`<option value="${p.id}" ${p.id===selectedId?'selected':''}>${p.nombre} (stock: ${p.stock} ${p.unidad})</option>`).join('');
}

function openModalCompra() {
  if(!currentClinicaId){ toast('No tienes clínica asignada','error'); return; }
  _movItems = {};
  _movTipo = 'entrada';
  document.getElementById('mov-fecha').value = hoy();
  document.getElementById('mov-motivo').value = '';
  document.getElementById('mov-search').value = '';
  document.getElementById('mov-masivo-title').textContent = '🛒 Compra Grupal';
  document.getElementById('mov-tabs-row').style.display = 'none';
  document.getElementById('mov-motivo').placeholder = 'Ej: Farmacéutica López, MINSA, proveedor...';
  document.getElementById('mov-confirm-btn').textContent = '🛒 Confirmar Compra';
  document.getElementById('mov-confirm-btn').style.background = 'linear-gradient(135deg,var(--success),#059669)';
  filtrarInventarioMov('');
  document.getElementById('modal-mov-masivo').classList.add('open');
}

// ── Modal Movimiento Masivo (Entrada / Salida) ──
let _movTipo = 'entrada';
let _movItems = {}; // { invId: cantidad }

function openModalEntrada(prodId) { abrirModalMov('entrada', prodId); }
function openModalSalida(prodId)  { abrirModalMov('salida',  prodId); }

function abrirModalMov(tipo, prodId) {
  _movTipo = tipo;
  _movItems = {};
  if(prodId) _movItems[prodId] = 1;
  document.getElementById('mov-fecha').value = hoy();
  document.getElementById('mov-motivo').value = '';
  document.getElementById('mov-motivo').placeholder = 'Ej: Compra, donación, uso en consulta...';
  document.getElementById('mov-search').value = '';
  document.getElementById('mov-tabs-row').style.display = 'flex';
  switchMovTab(tipo);
  filtrarInventarioMov('');
  document.getElementById('modal-mov-masivo').classList.add('open');
}

function switchMovTab(tipo) {
  _movTipo = tipo;
  const esEntrada = tipo === 'entrada';
  document.getElementById('mov-masivo-title').textContent = esEntrada ? '📥 Registrar Entrada' : '📤 Registrar Salida';
  document.getElementById('mov-tab-entrada').className = 'btn btn-sm ' + (esEntrada ? 'btn-primary' : 'btn-secondary');
  document.getElementById('mov-tab-salida').className  = 'btn btn-sm ' + (!esEntrada ? 'btn-danger' : 'btn-secondary');
  document.getElementById('mov-confirm-btn').textContent = esEntrada ? '📥 Confirmar Entrada' : '📤 Confirmar Salida';
  document.getElementById('mov-confirm-btn').style.background = esEntrada
    ? 'linear-gradient(135deg,var(--success),#059669)'
    : 'linear-gradient(135deg,#EF4444,#B91C1C)';
  filtrarInventarioMov(document.getElementById('mov-search').value);
}

function filtrarInventarioMov(q) {
  const q2 = (q||'').toLowerCase();
  const catIcon = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  let items = C.inv;
  if(q2) items = items.filter(p=>p.nombre.toLowerCase().includes(q2)||(p.descripcion||'').toLowerCase().includes(q2));
  const grid = document.getElementById('mov-inv-grid');
  if(!items.length){
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light);font-size:14px">Sin productos en inventario</div>`;
    _actualizarConteoMov(); return;
  }
  grid.innerHTML = items.map(p => {
    const sel = !!_movItems[p.id];
    const qty = _movItems[p.id] || '';
    const stockCls = p.stock===0?'color:#EF4444':p.stockMin>0&&p.stock<=p.stockMin?'color:#F59E0B':'color:var(--success)';
    return `<label id="mov-lbl-${p.id}" style="display:flex;align-items:flex-start;gap:8px;padding:9px 11px;background:var(--bg);border:1.5px solid ${sel?'var(--primary)':'var(--border)'};border-radius:9px;cursor:pointer;font-size:12px;transition:border .12s;user-select:none">
      <input type="checkbox" ${sel?'checked':''} onchange="toggleMovItem(${p.id},this.checked)" style="margin-top:3px;flex-shrink:0">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--text);line-height:1.3">${catIcon(p.categoria)} ${p.nombre}</div>
        <div style="font-size:11px;margin-top:2px;${stockCls}">Stock: ${p.stock} ${p.unidad}</div>
        <input type="number" id="mov-qty-${p.id}" value="${qty}" min="1" placeholder="Cantidad" onclick="event.stopPropagation()"
          oninput="_movItems[${p.id}]=Number(this.value)||0;_actualizarConteoMov()"
          style="margin-top:6px;width:100%;padding:5px 8px;border:1px solid var(--border);border-radius:7px;font-size:12px;background:var(--card);color:var(--text);display:${sel?'block':'none'}">
      </div>
    </label>`;
  }).join('');
  _actualizarConteoMov();
}

function toggleMovItem(invId, checked) {
  if(checked) { _movItems[invId] = 1; }
  else { delete _movItems[invId]; }
  const lbl = document.getElementById('mov-lbl-'+invId);
  if(lbl){
    lbl.style.borderColor = checked ? 'var(--primary)' : 'var(--border)';
    const qtyEl = document.getElementById('mov-qty-'+invId);
    if(qtyEl) { qtyEl.style.display = checked ? 'block' : 'none'; if(checked) qtyEl.focus(); }
  }
  _actualizarConteoMov();
}

function seleccionarVisiblesMov() {
  const q = document.getElementById('mov-search').value;
  const q2 = (q||'').toLowerCase();
  let items = C.inv;
  if(q2) items = items.filter(p=>p.nombre.toLowerCase().includes(q2)||(p.descripcion||'').toLowerCase().includes(q2));
  // En modo salida no seleccionar productos sin stock
  if(_movTipo === 'salida') items = items.filter(p=>p.stock > 0);
  items.forEach(p=>{ if(!_movItems[p.id]) _movItems[p.id]=1; });
  filtrarInventarioMov(q);
}

function _actualizarConteoMov() {
  const n = Object.values(_movItems).filter(qty=>qty>0).length;
  const el = document.getElementById('mov-count');
  if(el) el.textContent = `${n} producto${n!==1?'s':''} seleccionado${n!==1?'s':''}`;
}

async function confirmarMovMasivo() {
  if(!currentClinicaId){ toast('No tienes clínica asignada','error'); return; }
  const entries = Object.entries(_movItems).filter(([,qty])=>qty>0);
  if(!entries.length){ toast('Selecciona al menos un producto con cantidad','error'); return; }
  const fecha = document.getElementById('mov-fecha').value || hoy();
  const motivo = document.getElementById('mov-motivo').value.trim() || null;
  const tipo = _movTipo;
  setLoading(true);

  for(const [id, qty] of entries) {
    const prod = C.inv.find(p=>p.id===Number(id));
    if(!prod) continue;
    if(tipo==='salida' && qty > prod.stock){
      const ok = await customConfirm({icon:'⚠️',title:'Stock insuficiente',
        msg:`<strong>${prod.nombre}</strong>: stock ${prod.stock} ${prod.unidad}, salida ${qty}.<br>¿Registrar de todas formas?`,
        okText:'Registrar igual',danger:true});
      if(!ok) continue;
    }
    const nuevoStock = (prod.stock||0) + (tipo==='entrada' ? qty : -qty);
    await Promise.all([
      sb.from('inventario_movimientos').insert({inventario_id:Number(id),clinica_id:currentClinicaId,tipo,cantidad:qty,motivo,fecha}),
      sb.from('inventario').update({stock_actual:Math.max(0,nuevoStock)}).eq('id',Number(id))
    ]);
    if(tipo==='salida' && prod.precio && prod.precio > 0){
      await sb.from('finanzas').insert({
        clinica_id:currentClinicaId,tipo:'ingreso',categoria:'medicamento',
        descripcion:`Despacho: ${prod.nombre} × ${qty} ${prod.unidad}`,
        monto:qty*prod.precio,fecha,metodo_pago:'efectivo',creado_por:currentUser?.name
      });
    }
  }
  toast(tipo==='entrada'?`📥 ${entries.length} entrada${entries.length!==1?'s':''} registrada${entries.length!==1?'s':''}`:`📤 ${entries.length} salida${entries.length!==1?'s':''} registrada${entries.length!==1?'s':''}`);
  closeModal('modal-mov-masivo');
  await loadAll(); renderInventario(); setLoading(false);
}

// ════════════════════ CATÁLOGO INVENTARIO ════════════════════
const INV_CATALOG = [
  // Medicamentos
  {n:'Acetaminofén 500mg',cat:'medicamento',u:'tableta'},{n:'Acetaminofén 120mg/5ml jarabe',cat:'medicamento',u:'frasco'},
  {n:'Ibuprofeno 400mg',cat:'medicamento',u:'tableta'},{n:'Ibuprofeno 200mg/5ml suspensión',cat:'medicamento',u:'frasco'},
  {n:'Diclofenac 50mg',cat:'medicamento',u:'tableta'},{n:'Diclofenac 75mg/3ml inyectable',cat:'medicamento',u:'ampolla'},
  {n:'Amoxicilina 500mg',cat:'medicamento',u:'cápsula'},{n:'Amoxicilina 250mg/5ml suspensión',cat:'medicamento',u:'frasco'},
  {n:'Azitromicina 500mg',cat:'medicamento',u:'tableta'},{n:'Ciprofloxacina 500mg',cat:'medicamento',u:'tableta'},
  {n:'Metronidazol 500mg',cat:'medicamento',u:'tableta'},{n:'Metronidazol 500mg/100ml IV',cat:'medicamento',u:'frasco'},
  {n:'Omeprazol 20mg',cat:'medicamento',u:'cápsula'},{n:'Ranitidina 150mg',cat:'medicamento',u:'tableta'},
  {n:'Metoclopramida 10mg',cat:'medicamento',u:'tableta'},{n:'Metoclopramida 10mg/2ml',cat:'medicamento',u:'ampolla'},
  {n:'Enalapril 10mg',cat:'medicamento',u:'tableta'},{n:'Losartán 50mg',cat:'medicamento',u:'tableta'},
  {n:'Amlodipino 5mg',cat:'medicamento',u:'tableta'},{n:'Hidroclorotiazida 25mg',cat:'medicamento',u:'tableta'},
  {n:'Metformina 500mg',cat:'medicamento',u:'tableta'},{n:'Metformina 850mg',cat:'medicamento',u:'tableta'},
  {n:'Glibenclamida 5mg',cat:'medicamento',u:'tableta'},{n:'Insulina NPH 100UI/ml',cat:'medicamento',u:'frasco'},
  {n:'Insulina Regular 100UI/ml',cat:'medicamento',u:'frasco'},{n:'Atorvastatina 20mg',cat:'medicamento',u:'tableta'},
  {n:'Simvastatina 20mg',cat:'medicamento',u:'tableta'},{n:'Furosemida 40mg',cat:'medicamento',u:'tableta'},
  {n:'Furosemida 20mg/2ml',cat:'medicamento',u:'ampolla'},{n:'Salbutamol inhalador 100mcg',cat:'medicamento',u:'unidad'},
  {n:'Salbutamol 2.5mg/2.5ml nebulización',cat:'medicamento',u:'ampolla'},{n:'Dexametasona 4mg/ml',cat:'medicamento',u:'ampolla'},
  {n:'Hidrocortisona 100mg',cat:'medicamento',u:'ampolla'},{n:'Loratadina 10mg',cat:'medicamento',u:'tableta'},
  {n:'Cetirizina 10mg',cat:'medicamento',u:'tableta'},{n:'Clonazepam 0.5mg',cat:'medicamento',u:'tableta'},
  {n:'Diazepam 5mg',cat:'medicamento',u:'tableta'},{n:'Amitriptilina 25mg',cat:'medicamento',u:'tableta'},
  {n:'Ácido fólico 5mg',cat:'medicamento',u:'tableta'},{n:'Hierro sulfato 300mg',cat:'medicamento',u:'tableta'},
  {n:'Vitamina C 500mg',cat:'medicamento',u:'tableta'},{n:'Vitamina B-complejo',cat:'medicamento',u:'tableta'},
  {n:'Calcio + Vitamina D 500mg',cat:'medicamento',u:'tableta'},{n:'Zinc 20mg',cat:'medicamento',u:'tableta'},
  {n:'Suero oral 27.9g',cat:'medicamento',u:'sobre'},{n:'Doxiciclina 100mg',cat:'medicamento',u:'cápsula'},
  {n:'Trimetoprim/Sulfametoxazol 400/80mg',cat:'medicamento',u:'tableta'},{n:'Ketoconazol 200mg',cat:'medicamento',u:'tableta'},
  {n:'Fluconazol 150mg',cat:'medicamento',u:'cápsula'},{n:'Ivermectina 6mg',cat:'medicamento',u:'tableta'},
  {n:'Albendazol 400mg',cat:'medicamento',u:'tableta'},{n:'Clorfenamina 4mg',cat:'medicamento',u:'tableta'},
  // Material médico
  {n:'Jeringa 1ml con aguja 25G',cat:'material',u:'unidad'},{n:'Jeringa 3ml con aguja 23G',cat:'material',u:'unidad'},
  {n:'Jeringa 5ml con aguja 21G',cat:'material',u:'unidad'},{n:'Jeringa 10ml con aguja 21G',cat:'material',u:'unidad'},
  {n:'Jeringa 20ml sin aguja',cat:'material',u:'unidad'},{n:'Aguja 21G x 1.5"',cat:'material',u:'caja'},
  {n:'Guantes látex S',cat:'material',u:'caja'},{n:'Guantes látex M',cat:'material',u:'caja'},
  {n:'Guantes látex L',cat:'material',u:'caja'},{n:'Guantes nitrilo M sin polvo',cat:'material',u:'caja'},
  {n:'Mascarilla quirúrgica 3 capas',cat:'material',u:'caja'},{n:'Mascarilla N95',cat:'material',u:'unidad'},
  {n:'Alcohol isopropílico 70%',cat:'material',u:'litro'},{n:'Alcohol en gel 500ml',cat:'material',u:'frasco'},
  {n:'Agua oxigenada 10V',cat:'material',u:'frasco'},{n:'Yodo povidona 10%',cat:'material',u:'frasco'},
  {n:'Gasas estériles 4x4"',cat:'material',u:'paquete'},{n:'Algodón hidrófilo 500g',cat:'material',u:'rollo'},
  {n:'Venda de gasa 4"',cat:'material',u:'rollo'},{n:'Venda elástica 4"',cat:'material',u:'rollo'},
  {n:'Esparadrapo de tela 1"',cat:'material',u:'rollo'},{n:'Micropore 1"',cat:'material',u:'rollo'},
  {n:'Bajalenguas de madera',cat:'material',u:'paquete'},{n:'Hisopo estéril',cat:'material',u:'paquete'},
  {n:'Catéter IV 18G',cat:'material',u:'unidad'},{n:'Catéter IV 20G',cat:'material',u:'unidad'},
  {n:'Catéter IV 22G',cat:'material',u:'unidad'},{n:'Catéter IV 24G',cat:'material',u:'unidad'},
  {n:'Equipo de venoclisis macrogotero',cat:'material',u:'unidad'},{n:'Equipo de venoclisis microgotero',cat:'material',u:'unidad'},
  {n:'Solución salina 0.9% 500ml',cat:'material',u:'frasco'},{n:'Solución salina 0.9% 1000ml',cat:'material',u:'frasco'},
  {n:'Dextrosa 5% 500ml',cat:'material',u:'frasco'},{n:'Hartmann 500ml',cat:'material',u:'frasco'},
  {n:'Sonda Foley 14Fr',cat:'material',u:'unidad'},{n:'Sonda Foley 16Fr',cat:'material',u:'unidad'},
  {n:'Sonda nasogástrica 14Fr',cat:'material',u:'unidad'},{n:'Guantes estériles 7.0',cat:'material',u:'par'},
  {n:'Guantes estériles 7.5',cat:'material',u:'par'},{n:'Lanceta estéril',cat:'material',u:'caja'},
  {n:'Tira reactiva glucosa',cat:'material',u:'caja'},{n:'Tira reactiva orina',cat:'material',u:'caja'},
  // Equipos
  {n:'Termómetro digital',cat:'equipo',u:'unidad'},{n:'Termómetro infrarrojo',cat:'equipo',u:'unidad'},
  {n:'Tensiómetro manual aneroide',cat:'equipo',u:'unidad'},{n:'Tensiómetro digital',cat:'equipo',u:'unidad'},
  {n:'Estetoscopio',cat:'equipo',u:'unidad'},{n:'Oxímetro de pulso',cat:'equipo',u:'unidad'},
  {n:'Glucómetro',cat:'equipo',u:'unidad'},{n:'Linterna médica',cat:'equipo',u:'unidad'},
  {n:'Martillo de reflejos',cat:'equipo',u:'unidad'},{n:'Otoscopio',cat:'equipo',u:'unidad'},
  {n:'Oftalmoscopio',cat:'equipo',u:'unidad'},{n:'Nebulizador',cat:'equipo',u:'unidad'},
  // Insumos
  {n:'Jabón líquido antibacterial',cat:'insumo',u:'frasco'},{n:'Cloro al 5% desinfectante',cat:'insumo',u:'litro'},
  {n:'Desinfectante de superficies',cat:'insumo',u:'litro'},{n:'Toallas de papel',cat:'insumo',u:'paquete'},
  {n:'Bolsas rojas desechos bioinfecciosos',cat:'insumo',u:'paquete'},{n:'Bolsas negras',cat:'insumo',u:'paquete'},
  {n:'Contenedor desechos cortopunzantes',cat:'insumo',u:'unidad'},
  // Papelería
  {n:'Recetarios médicos',cat:'papeleria',u:'paquete'},{n:'Talonarios incapacidad laboral',cat:'papeleria',u:'paquete'},
  {n:'Formularios de laboratorio',cat:'papeleria',u:'paquete'},{n:'Expedientes clínicos',cat:'papeleria',u:'paquete'},
];

// ── Catálogo MINSA Nicaragua — Listado de Medicamentos Esenciales ──
const MINSA_CATALOG = (function(){
  const M='medicamento',U='unidad';
  return [
    // ANTIMICROBIANOS
    {cod:'01010106',n:'Linezolid RESERVA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010134',n:'Linezolid RESERVA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010234',n:'Tigeciclina RESERVA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010302',n:'Minociclina RESERVA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010716',n:'Voriconazol VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010717',n:'Voriconazol VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010720',n:'Amfotericina B VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010723',n:'Fluconazol ACCESO',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010724',n:'Fluconazol ACCESO',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010725',n:'Caspofungina VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010729',n:'Itraconazol VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010740',n:'Fluconazol ACCESO',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010787',n:'Anidulafungina VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010810',n:'Cloroquina',sub:'Antipalúdicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010820',n:'Primaquina',sub:'Antipalúdicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010830',n:'Primaquina',sub:'Antipalúdicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010835',n:'Mefloquina clorhidrato',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010840',n:'Artemetero + Lumefantrina',sub:'Antipalúdicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010861',n:'Quinina diclorhidrato',sub:'Antipalúdicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010865',n:'Quinina sulfato',sub:'Antipalúdicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01010900',n:'Meglumina antimoniato',sub:'Antileishmaniásicos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011000',n:'Espiramicina VIGILANCIA',sub:'Antitoxoplasmosis',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011100',n:'Vancomicina VIGILANCIA',sub:'Glicopéptidos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011210',n:'Ciprofloxacina VIGILANCIA',sub:'Quinolonas',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011220',n:'Ciprofloxacina VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011244',n:'Levofloxacina VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011246',n:'Levofloxacina VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011250',n:'Moxifloxacina VIGILANCIA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011290',n:'Aciclovir',sub:'Antivirales',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011309',n:'Lamivudina (3TC)',sub:'Antirretrovirales',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011310',n:'Aciclovir',sub:'Antivirales',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011313',n:'Ritonavir (RTV)',sub:'Antirretrovirales',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011331',n:'Zidovudina (AZT)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011334',n:'Lopinavir + Ritonavir (LPV/r)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011357',n:'Darunavir (DRV)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011358',n:'Etravirina (ETV)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011363',n:'Raltegravir (RAL)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011370',n:'Oseltamivir VIGILANCIA',sub:'Antivirales',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011372',n:'Oseltamivir VIGILANCIA',sub:'Antivirales',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011373',n:'Dolutegravir (DTG)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011376',n:'Dolutegravir (DTG)',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01011383',n:'Tenofovir alafenamida + Emtricitabina',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    // GASTROENTEROLOGÍA
    {cod:'01020130',n:'Ranitidina',sub:'Antiácidos y antisecretorios',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020140',n:'Ranitidina',sub:'Antiácidos y antisecretorios',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020160',n:'Omeprazol',sub:'Antiácidos y antisecretorios',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020170',n:'Omeprazol',sub:'Antiácidos y antisecretorios',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020202',n:'Loperamida',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01020300',n:'Enema fosfato y bifosfato',sub:'Antidiarreico y laxante',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020302',n:'Polietilenglicol',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01020312',n:'Picosulfato sódico',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01020360',n:'Aceite mineral',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01020400',n:'Dimenhidrinato',sub:'Antieméticos',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020405',n:'Dimenhidrinato',sub:'Antieméticos',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020410',n:'Metoclopramida',sub:'Antieméticos',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020411',n:'Metoclopramida',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01020420',n:'Ondansetrón',sub:'Antieméticos',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020423',n:'Ondansetrón',sub:'Antieméticos',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020425',n:'Ondansetrón',sub:'Antieméticos',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01020500',n:'Tinidazol ACCESO',sub:'Antiamebianos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020510',n:'Metronidazol ACCESO',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020511',n:'Metronidazol ACCESO',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020513',n:'Metronidazol ACCESO',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020540',n:'Benznidazol',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020541',n:'Nifurtimox',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020605',n:'Praziquantel',sub:'Antihelmínticos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020620',n:'Albendazol',sub:'Antihelmínticos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020630',n:'Albendazol',sub:'Antihelmínticos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020646',n:'Mebendazol',sub:'Antihelmínticos',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01020700',n:'Lactulosa',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01020710',n:'Sulfato de bario',sub:'Medios de contraste',grupo:'RADIOLOGÍA',cat:M,u:U},
    // NEUMOLOGÍA
    {cod:'01030101',n:'Budesonida',sub:'Corticosteroides inhalados',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030102',n:'Salbutamol sulfato',sub:'Broncodilatadores',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030108',n:'Salbutamol sulfato',sub:'Broncodilatadores',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030110',n:'Aminofilina',sub:'Derivados de las xantinas',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030125',n:'Teofilina',sub:'Derivados de las xantinas',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030145',n:'Cafeína',sub:'Derivados de las xantinas',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030150',n:'Teofilina',sub:'Derivados de las xantinas',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030200',n:'Codeína',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01030216',n:'Codeína',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01030300',n:'Isoniacida (INH)',sub:'Antituberculosos',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030301',n:'Isoniacida (INH)',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030325',n:'Rifampicina + Isoniacida',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030330',n:'Etambutol',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030331',n:'Cicloserina VIGILANCIA TB-MDR',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030340',n:'Pirazinamida',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030342',n:'Etionamida VIGILANCIA TB-MDR',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030375',n:'Rifampicina + Isoniacida',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030376',n:'Bedaquilina VIGILANCIA TB-MDR',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030377',n:'Delamanid VIGILANCIA TB-MDR',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030379',n:'Etambutol',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030400',n:'Beclometasona',sub:'Corticosteroides inhalados',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030405',n:'Beclometasona',sub:'Corticosteroides inhalados',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030408',n:'Beclometasona',sub:'Corticoide',grupo:'OTORRINOLARINGOLOGÍA',cat:M,u:U},
    {cod:'01030421',n:'Formoterol fumarato dihidrato',sub:'Broncodilatadores',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030500',n:'Ipratropium bromuro',sub:'Antimuscarínico',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030505',n:'Ipratropium bromuro',sub:'Antimuscarínico',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01030628',n:'Baricitinib',sub:'Modificadores de la enfermedad reumática',grupo:'ANALGÉSICOS',cat:M,u:U},
    // CARDIOVASCULAR
    {cod:'01040100',n:'Digoxina',sub:'Glucósido cardiotónicos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040110',n:'Digoxina',sub:'Glucósido cardiotónicos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040130',n:'Carvedilol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040135',n:'Carvedilol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040200',n:'Amiodarona',sub:'Antiarrítmicos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040205',n:'Amiodarona',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040210',n:'Verapamilo',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040215',n:'Verapamilo',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040220',n:'Adenosina',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040301',n:'Efedrina',sub:'Aminas simpaticomiméticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040310',n:'Fenilefrina',sub:'Aminas simpaticomiméticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040320',n:'Dobutamina',sub:'Aminas simpaticomiméticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040330',n:'Dopamina',sub:'Aminas simpaticomiméticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040340',n:'Epinefrina (Adrenalina)',sub:'Aminas simpaticomiméticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040348',n:'Norepinefrina',sub:'Aminas simpaticomiméticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040410',n:'Isosorbide',sub:'Antianginosos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040420',n:'Nitroglicerina',sub:'Antianginosos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040435',n:'Amlodipina',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040436',n:'Amlodipina besilato',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040500',n:'Ácido Acetil Salicílico',sub:'Antitrombóticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040503',n:'Clopidogrel',sub:'Antitrombóticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040511',n:'Estreptoquinasa',sub:'Antitrombóticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040522',n:'Enoxaparina',sub:'Antitrombóticos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040600',n:'Atenolol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040606',n:'Losartán',sub:'Antihipertensivos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040610',n:'Enalapril',sub:'Antihipertensivos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040615',n:'Captopril',sub:'Antihipertensivos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040620',n:'Metildopa',sub:'Antihipertensivos',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040630',n:'Hidralazina',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040634',n:'Metoprolol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040635',n:'Hidralazina',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040640',n:'Nitroprusiato de sodio',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040650',n:'Labetalol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040651',n:'Labetalol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040665',n:'Doxazocina',sub:'Antimuscarínicos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01040676',n:'Nifedipina',sub:'',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040679',n:'Nifedipina',sub:'Inhibidores de la contractilidad uterina',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01040688',n:'Bisoprolol',sub:'Betabloqueadores',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040700',n:'Gemfibrozil',sub:'Hipolipemiantes',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040711',n:'Simvastatina',sub:'Hipolipemiantes',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040717',n:'Rosuvastatina',sub:'Hipolipemiantes',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01040833',n:'Colistina RESERVA',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    // HEMATOLOGÍA
    {cod:'01050100',n:'Ácido Fólico',sub:'Antianémicos',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050110',n:'Sulfato Ferroso + Ácido Fólico',sub:'Antianémicos',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050120',n:'Sulfato Ferroso',sub:'Antianémicos',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050133',n:'Eritropoyetina recombinante',sub:'Factores eritropoyéticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01050200',n:'Heparina sódica',sub:'Anticoagulantes',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050210',n:'Warfarina',sub:'Anticoagulantes',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050305',n:'Fitomenadiona (Vitamina K1)',sub:'Hemostáticos',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050309',n:'Protamina',sub:'Hemostáticos',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050314',n:'Ácido tranexámico',sub:'Hemostáticos',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01050322',n:'Factor IX concentrado (HEMOFILIA)',sub:'Factores coagulación',grupo:'HEMATOLOGÍA',cat:M,u:U},
    // SOLUCIONES ELECTROLÍTICAS
    {cod:'01060100',n:'Dextrosa',sub:'Electrolitos parenterales',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060106',n:'Dextrosa',sub:'Electrolitos parenterales',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060108',n:'Dextrosa',sub:'Electrolitos parenterales',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060215',n:'Albúmina humana',sub:'Proteínas y aminoácidos',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060300',n:'Agua destilada',sub:'Solvente de medicamentos',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060421',n:'Lípidos IV',sub:'Proteínas y aminoácidos',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060423',n:'Aminoácidos IV',sub:'Proteínas y aminoácidos',grupo:'SOLUCIONES',cat:M,u:'frasco'},
    {cod:'01060500',n:'Cloruro de potasio',sub:'Electrolitos',grupo:'SOLUCIONES',cat:M,u:U},
    {cod:'01060533',n:'Bicarbonato sódico',sub:'',grupo:'SOLUCIONES',cat:M,u:U},
    {cod:'01060560',n:'Calcio carbonato',sub:'Hipocalcemia',grupo:'SOLUCIONES',cat:M,u:U},
    {cod:'01060580',n:'Calcitriol',sub:'Hipocalcemia',grupo:'SOLUCIONES',cat:M,u:U},
    // NEFROLOGÍA Y UROLOGÍA
    {cod:'01070105',n:'Furosemida',sub:'Diuréticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070110',n:'Furosemida',sub:'Diuréticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070120',n:'Hidroclorotiazida',sub:'Diuréticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070131',n:'Hidroclorotiazida + Amilorida',sub:'Diuréticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070140',n:'Manitol',sub:'Diuréticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070151',n:'Espironolactona',sub:'Diuréticos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070215',n:'Alopurinol',sub:'Modificadores reumáticos',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01070400',n:'Sodio poliestireno sulfonato',sub:'Resinas catiónicas',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070410',n:'Colchicina',sub:'Modificadores reumáticos',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01070415',n:'Silimarina',sub:'Antídotos',grupo:'ANTÍDOTOS',cat:M,u:U},
    {cod:'01070500',n:'Oxibutinina',sub:'Antimuscarínicos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070506',n:'Doxazocina',sub:'Antimuscarínicos',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070600',n:'Bicarbonato sódico (hemodiálisis)',sub:'Hemodiálisis',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070605',n:'Bicarbonato sódico (hemodiálisis)',sub:'Hemodiálisis',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070610',n:'Concentrado ácido (hemodiálisis)',sub:'Hemodiálisis',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    {cod:'01070614',n:'Sildenafil NEONATO',sub:'Antihipertensivos pulmonares',grupo:'CARDIOVASCULAR',cat:M,u:U},
    {cod:'01070615',n:'Concentrado ácido',sub:'',grupo:'NEFROLOGÍA Y UROLOGÍA',cat:M,u:U},
    // NEUROLOGÍA
    {cod:'01080109',n:'Levetiracetam',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080110',n:'Valproato',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080112',n:'Levetiracetam',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080120',n:'Carbamacepina',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080126',n:'Gabapentina',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080131',n:'Ácido Valproico',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080135',n:'Clonazepam',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080150',n:'Fenitoína (Difenilhidantoína)',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080155',n:'Fenitoína (Difenilhidantoína)',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080160',n:'Fenobarbital',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080165',n:'Fenobarbital',sub:'Antiepilépticos orales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080200',n:'Sulfato de magnesio',sub:'Antiepilépticos parenterales',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080202',n:'Fenobarbital',sub:'',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080210',n:'Diazepam',sub:'',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080220',n:'Fenitoína (Difenilhidantoína)',sub:'',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080300',n:'Levodopa + Carbidopa',sub:'Antiparkinsonianos',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080310',n:'Trihexifenidilo',sub:'Antiparkinsonianos',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080320',n:'Biperideno',sub:'Antiparkinsonianos',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080400',n:'Neostigmina',sub:'Antagonistas',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01080520',n:'Propranolol',sub:'Migraña',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080610',n:'Nimodipino',sub:'Vasodilatador cerebral',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080615',n:'Nimodipino',sub:'Vasodilatador cerebral',grupo:'NEUROLOGÍA',cat:M,u:U},
    {cod:'01080710',n:'Melatonina',sub:'Hipnóticos y ansiolíticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    // PSIQUIATRÍA
    {cod:'01090110',n:'Diazepam',sub:'Hipnóticos y ansiolíticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090120',n:'Lorazepam',sub:'Hipnóticos y ansiolíticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090210',n:'Clorpromazina',sub:'Neurolépticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090215',n:'Clorpromazina',sub:'Neurolépticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090220',n:'Tioridazina',sub:'Neurolépticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090230',n:'Flufenazina decanoato',sub:'Neurolépticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090238',n:'Risperidona',sub:'Neurolépticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090300',n:'Haloperidol',sub:'',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090305',n:'Haloperidol',sub:'',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090310',n:'Haloperidol',sub:'',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090320',n:'Litio',sub:'Estabilizador del ánimo',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090400',n:'Amitriptilina',sub:'Antidepresivos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090420',n:'Fluoxetina',sub:'Antidepresivos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090435',n:'Imipramina',sub:'Antidepresivos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    {cod:'01090703',n:'Lorazepam',sub:'Hipnóticos y ansiolíticos',grupo:'PSIQUIATRÍA',cat:M,u:U},
    // OBSTETRICIA Y GINECOLOGÍA
    {cod:'01100100',n:'Oxitocina',sub:'Oxitóxicos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100101',n:'Oxitocina',sub:'Oxitóxicos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100110',n:'Ergometrina (ergobasina)',sub:'Oxitóxicos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100200',n:'Clotrimazol (vaginal)',sub:'Antifúngicos candidiasis',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100311',n:'Etonogestrel',sub:'Progestágenos implante',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100410',n:'Medroxiprogesterona',sub:'Progestágenos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100425',n:'Levonorgestrel',sub:'Hormonales mixtos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100510',n:'Levonorgestrel + Etinilestradiol',sub:'Hormonales mixtos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100541',n:'Progesterona micronizada',sub:'Progestágenos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100545',n:'Noretisterona + Estradiol',sub:'Hormonales mixtos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100589',n:'Estrógenos Conjugados',sub:'Hormonales mixtos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01100705',n:'Inmunoglobulina humana',sub:'Derivados del plasma',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01100815',n:'Misoprostol',sub:'Oxitóxicos',grupo:'OBSTETRICIA',cat:M,u:U},
    {cod:'01102110',n:'Clomifeno citrato',sub:'Inductores ovulación',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    // OTORRINOLARINGOLOGÍA
    {cod:'01110100',n:'Cloruro de sodio nasal',sub:'Descongestionantes',grupo:'OTORRINOLARINGOLOGÍA',cat:M,u:U},
    {cod:'01110200',n:'Dexametasona ótica',sub:'Corticoide',grupo:'OTORRINOLARINGOLOGÍA',cat:M,u:U},
    {cod:'01110210',n:'Clotrimazol ótico',sub:'Antimicótico',grupo:'OTORRINOLARINGOLOGÍA',cat:M,u:U},
    {cod:'01110215',n:'Ciprofloxacina clorhidrato ótica',sub:'Antimicrobiano',grupo:'OTORRINOLARINGOLOGÍA',cat:M,u:U},
    // OFTALMOLOGÍA
    {cod:'01120105',n:'Tetraciclina oftálmica',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120110',n:'Gentamicina oftálmica',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120120',n:'Tobramicina + Dexametasona',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120122',n:'Tobramicina + Dexametasona',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120130',n:'Tobramicina oftálmica',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120150',n:'Ciprofloxacina oftálmica',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120155',n:'Moxifloxacina oftálmica',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120170',n:'Cloranfenicol oftálmico',sub:'Antimicrobianos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120200',n:'Atropina oftálmica',sub:'Midriáticos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120210',n:'Tropicamida',sub:'Midriáticos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120215',n:'Tropicamida + Fenilefrina',sub:'Midriáticos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120300',n:'Dorzolamida',sub:'Antiglaucomatosos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120305',n:'Dorzolamida + Timolol',sub:'Antiglaucomatosos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120310',n:'Pilocarpina',sub:'Antiglaucomatosos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120320',n:'Timolol oftálmico',sub:'Antiglaucomatosos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120330',n:'Acetazolamida',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120340',n:'Latanoprost',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120345',n:'Brimonidina tartrato',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120410',n:'Tetracaína oftálmica',sub:'Anestésico local',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120497',n:'Aceite de Silicón oftálmico',sub:'Auxiliares quirúrgicos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120498',n:'Perfluoro-n-octano (C3F8)',sub:'Auxiliares quirúrgicos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120505',n:'Fluoresceína',sub:'Auxiliares diagnóstico',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120510',n:'Fluoresceína sódica',sub:'Auxiliares diagnóstico',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120520',n:'Azul de tripano',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120542',n:'Hialuronato de sodio',sub:'Lubricantes oftálmicos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120543',n:'Hialuronato de sodio',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120550',n:'Solución salina balanceada oftálmica',sub:'Auxiliares quirúrgicos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120600',n:'Aciclovir oftálmico',sub:'Antiviral',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120700',n:'Diclofenac oftálmico',sub:'AINEs',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120710',n:'Dexametasona oftálmica',sub:'AINEs',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120720',n:'Prednisolona acetato oftálmico',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120730',n:'Fluormetalona',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120736',n:'Ácido Poliacrílico',sub:'Lubricantes oftálmicos',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120800',n:'Ketotifeno oftálmico',sub:'Antialérgico',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120901',n:'Cloruro de Sodio oftálmico',sub:'Adyuvantes',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120903',n:'Hipromelosa',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01120905',n:'Hipromelosa oftálmica',sub:'Lubricantes',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01121000',n:'Nafazolina',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01121120',n:'Bevacizumab',sub:'Anti-VEGF',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01121122',n:'Hexafluoruro de azufre (Gas SF6)',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01121125',n:'Carbachol',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    // DERMATOLOGÍA
    {cod:'01130100',n:'Clotrimazol tópico',sub:'Antifúngicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130110',n:'Ketoconazol tópico',sub:'Antifúngicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130130',n:'Mupirocina',sub:'Antibióticos tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130140',n:'Terbinafina clorhidrato',sub:'Antifúngicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130145',n:'Eritromicina tópica',sub:'Antibióticos tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130155',n:'Metronidazol tópico',sub:'Antibióticos tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130160',n:'Aciclovir tópico',sub:'Antivirales tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130175',n:'Clindamicina fosfato tópica',sub:'Antibióticos tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130190',n:'Bifonazol',sub:'Antifúngicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130199',n:'Permetrina',sub:'Antiparasitarios',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130201',n:'Permetrina',sub:'Antiparasitarios',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130230',n:'Ivermectina tópica',sub:'Antiparasitarios',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130300',n:'Alquitrán de hulla',sub:'Antiseborreicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130310',n:'Cobre + Zinc',sub:'Antiseborreicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130320',n:'Piritionato de Zinc',sub:'Antiseborreicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130327',n:'Clostebol + Neomicina',sub:'Antibióticos tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130340',n:'Azufre + Ácido salicílico',sub:'Antiseborreicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130420',n:'Metoxaleno',sub:'Repigmentantes',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130460',n:'Ketanserina tópica',sub:'Antiulcerosos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130500',n:'Ácido Salicílico + Vaselina',sub:'Queratolítico',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130505',n:'Ácido Salicílico + Vaselina',sub:'Queratolítico',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130605',n:'Podofilina en alcohol',sub:'Queratolítico',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130616',n:'Ácido Tricloroacético',sub:'Queratolítico',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130700',n:'Hidrocortisona tópica',sub:'Corticoesteroides tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130718',n:'Mometasona Furoato',sub:'Corticoesteroides tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130719',n:'Mometasona Furoato',sub:'Corticoesteroides tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130728',n:'Clobetasol',sub:'Corticoesteroides tópicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130730',n:'Polypodium Leucotomos',sub:'Repigmentantes',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130735',n:'Peróxido de hidrógeno',sub:'Desinfectantes',grupo:'ANTIMICROBIANOS',cat:M,u:U},
    {cod:'01130750',n:'Tacrolimus tópico',sub:'Inmunomodulador',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130800',n:'Clofazimina VIGILANCIA TB-MDR',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01130802',n:'Clofazimina VIGILANCIA TB-MDR',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01130815',n:'Dapsona',sub:'Antileprosos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130825',n:'Rifampicina',sub:'',grupo:'NEUMOLOGÍA',cat:M,u:U},
    {cod:'01130850',n:'Talidomida',sub:'',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130855',n:'Talidomida',sub:'',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130900',n:'Ketotifeno fumarato',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130905',n:'Ketotifeno',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130920',n:'Difenhidramina',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130925',n:'Difenhidramina',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130930',n:'Loratadina',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130935',n:'Loratadina',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01130960',n:'Clorfeniramina',sub:'Antihistamínicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131000',n:'Isotretinoína',sub:'Antiacné',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131001',n:'Isotretinoína',sub:'Antiacné',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131024',n:'Tretinoína (Ácido Retinoico)',sub:'Antiacné',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131025',n:'Tretinoína (Ácido Retinoico)',sub:'Antiacné',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131105',n:'Benzofenona 3 + Benzofenona 4',sub:'Protectores solares',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131208',n:'Urea tópica',sub:'Queratolítico',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131270',n:'Pasta al agua',sub:'Antiseborreicos',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'01131272',n:'Linimento oleocalcáreo',sub:'Humectantes',grupo:'DERMATOLOGÍA',cat:M,u:U},
    // ONCOLOGÍA
    {cod:'01140100',n:'Azatioprina',sub:'Inmunosupresor',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140110',n:'Ciclosporina',sub:'Inmunomoduladores',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140112',n:'Ciclosporina',sub:'Inmunomoduladores',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140115',n:'Ciclosporina oftálmica',sub:'Inmunomoduladores',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01140122',n:'Micofenolato de mofetilo',sub:'Inmunomoduladores',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140123',n:'Micofenolato de mofetilo',sub:'Inmunomoduladores',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140130',n:'Temozolamida Glioblastoma',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140131',n:'Temozolamida Glioblastoma',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140138',n:'Factor VIII concentrado (HEMOFILIA)',sub:'Factores coagulación',grupo:'HEMATOLOGÍA',cat:M,u:U},
    {cod:'01140146',n:'Tacrolimus sistémico',sub:'Inmunomoduladores',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140200',n:'Asparaginasa',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140205',n:'Citarabina (citocina arabinosa)',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140207',n:'Citarabina (citocina arabinosa)',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140208',n:'Gemcitabina',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140225',n:'Hidroxiurea',sub:'Citotóxicos',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140230',n:'Ifosfamida',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140235',n:'Ciclofosfamida',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140236',n:'Ciclofosfamida',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140238',n:'Ciclofosfamida',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140240',n:'Cisplatino',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140242',n:'Cisplatino',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140244',n:'Dacarbazina (DTIC)',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140246',n:'Mitoxantrona',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140247',n:'Fludarabina fosfato',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140250',n:'Etopósido',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140254',n:'Metotrexato',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140290',n:'Daunorrubicina',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140292',n:'Irinotecán',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140293',n:'Carboplatino',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140294',n:'Carboplatino',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140298',n:'Oxaliplatino',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140431',n:'Factor estimulador de colonias (G-CSF)',sub:'Inmunomoduladores',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140501',n:'Capecitabina',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140602',n:'Paclitaxel',sub:'',grupo:'ONCOLOGÍA',cat:M,u:U},
    {cod:'01140612',n:'Yodo131 (I131)',sub:'Radioisótopos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01140613',n:'Molibdeno-Tecnecio 99 (Mo-Tc99)',sub:'Radioisótopos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01140615',n:'Macroagregado de albúmina',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    // NUTRICIÓN
    {cod:'01150105',n:'Piridoxina (Vitamina B6)',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150110',n:'Tiamina (Vitamina B1)',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150116',n:'Vitamina C',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150117',n:'Oligoelementos',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150118',n:'Multivitamínico (MVI)',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150120',n:'Retinol (Vitamina A)',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150122',n:'Retinol (Vitamina A)',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150123',n:'Retinol (Vitamina A)',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150143',n:'Zinc',sub:'Antidiarreico',grupo:'GASTROENTEROLOGÍA',cat:M,u:U},
    {cod:'01150144',n:'Gluconato de zinc',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01150145',n:'Multivitaminas y Minerales Prenatales',sub:'Vitaminas y minerales',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01151100',n:'Leche Maternizada I semestre',sub:'Sucedáneos leche materna',grupo:'NUTRICIÓN',cat:M,u:U},
    {cod:'01151105',n:'Leche Maternizada II semestre',sub:'Sucedáneos leche materna',grupo:'NUTRICIÓN',cat:M,u:U},
    // ANALGÉSICOS
    {cod:'01160101',n:'Morfina',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160102',n:'Morfina Clorhidrato',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160108',n:'Morfina',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160109',n:'Morfina Clorhidrato',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160126',n:'Morfina sulfato',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160130',n:'Tramadol clorhidrato',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160200',n:'Dipirona (metamizol)',sub:'Analgésicos antipiréticos',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160210',n:'Paracetamol (Acetaminofén)',sub:'Analgésicos antipiréticos',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160212',n:'Paracetamol (Acetaminofén)',sub:'',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160216',n:'Paracetamol (Acetaminofén)',sub:'',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160218',n:'Paracetamol (Acetaminofén)',sub:'',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160330',n:'Ibuprofeno',sub:'Analgésicos antiinflamatorios',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160340',n:'Diclofenac sódico',sub:'Analgésicos antiinflamatorios',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160350',n:'Diclofenac sódico',sub:'Analgésicos antiinflamatorios',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160362',n:'Ketorolaco',sub:'Analgésicos antiinflamatorios',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160384',n:'Tramadol clorhidrato',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160430',n:'Hidroxicloroquina',sub:'Modificadores reumáticos',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01160453',n:'Tocilizumab',sub:'Modificadores reumáticos',grupo:'ANALGÉSICOS',cat:M,u:U},
    // ENDOCRINOLOGÍA
    {cod:'01170100',n:'Dexametasona',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170110',n:'Hidrocortisona succinato sódico',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170120',n:'Prednisona',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170124',n:'Triamcinolona',sub:'',grupo:'OFTALMOLOGÍA',cat:M,u:U},
    {cod:'01170125',n:'Prednisona',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170126',n:'Triamcinolona',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170130',n:'Metilprednisolona acetato',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170131',n:'Prednisolona',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170135',n:'Metilprednisolona succinato sódico',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170180',n:'Dexametasona',sub:'Corticosteroides',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170200',n:'Insulina humana NPH',sub:'Insulinas',grupo:'ENDOCRINOLOGÍA',cat:M,u:'frasco'},
    {cod:'01170205',n:'Insulina humana rápida',sub:'',grupo:'ENDOCRINOLOGÍA',cat:M,u:'frasco'},
    {cod:'01170300',n:'Glibenclamida (Gliburida)',sub:'Hipoglicemiantes orales',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170310',n:'Metformina',sub:'Hipoglicemiantes orales',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170400',n:'Levotiroxina',sub:'Hormonas tiroideas',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170401',n:'Levotiroxina',sub:'Hormonas tiroideas',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170500',n:'Tiamazol (Metimazol)',sub:'Inhibidores tiroideos',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170520',n:'Solución Lugol',sub:'Inhibidores tiroideos',grupo:'ENDOCRINOLOGÍA',cat:M,u:U},
    {cod:'01170600',n:'Calcio gluconato',sub:'Hipocalcemia',grupo:'SOLUCIONES',cat:M,u:U},
    // PRODUCTOS BIOLÓGICOS — VACUNAS
    {cod:'01180110',n:'Vacuna BCG',sub:'Vacunas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180120',n:'Vacuna antirrábica canina',sub:'Vacunas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180125',n:'Vacuna antirrábica humana',sub:'Vacunas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180130',n:'Vacuna antipolio (OPV)',sub:'Vacunas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180145',n:'Vacuna antihepatitis B',sub:'Vacunas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180165',n:'Vacuna anti-Rotavirus (pentavalente)',sub:'Vacunas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180170',n:'Vacuna antiinfluenza pediátrica',sub:'',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180175',n:'Vacuna antiinfluenza adultos',sub:'',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180190',n:'Vacuna antineumococo 23 valente',sub:'',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180208',n:'Vacuna dT',sub:'Toxoides',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180215',n:'Vacuna DPT',sub:'Toxoides',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180220',n:'DPT + Haemophilus influenzae B',sub:'Toxoides',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180400',n:'Inmunoglobulina antitetánica humana',sub:'Inmunoglobulinas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180425',n:'Inmunoglobulina antirrábica humana',sub:'Inmunoglobulinas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180430',n:'Inmunoglobulina antirrábica humana',sub:'Inmunoglobulinas',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180500',n:'Tuberculina (PPD)',sub:'Diagnóstico',grupo:'BIOLÓGICOS',cat:M,u:U},
    {cod:'01180503',n:'Tuberculina (PPD)',sub:'Diagnóstico',grupo:'BIOLÓGICOS',cat:M,u:U},
    // ANESTESIOLOGÍA
    {cod:'01190110',n:'Atropina',sub:'Anticolinérgico',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190202',n:'Midazolam',sub:'Inductores anestésicos',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190210',n:'Tiopental',sub:'Inductores anestésicos',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190215',n:'Flumazenil',sub:'Antagonistas',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190300',n:'Propofol',sub:'Inductores anestésicos',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190310',n:'Ketamina',sub:'Inductores anestésicos',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190314',n:'Benzocaína',sub:'Paliativos',grupo:'PALIATIVOS',cat:M,u:U},
    {cod:'01190330',n:'Sevoflurano',sub:'Inductores anestésicos',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190331',n:'Isoflurano',sub:'Inductores anestésicos',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190341',n:'Lidocaína con Epinefrina',sub:'Anestésicos locales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190400',n:'Lidocaína (sin preservante)',sub:'Anestésicos locales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190402',n:'Lidocaína al 10%',sub:'Anestésicos locales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190405',n:'Lidocaína (con preservante)',sub:'Anestésicos locales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190409',n:'Mepivacaína',sub:'Anestésicos locales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190425',n:'Lidocaína (sin preservante)',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190430',n:'Lidocaína con Epinefrina',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190435',n:'Mepivacaína con Epinefrina',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190445',n:'Bupivacaína con Epinefrina',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190460',n:'Bupivacaína clorhidrato',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190510',n:'Pancuronio',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190520',n:'Vecuronio',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190530',n:'Cisatracurio besilato',sub:'',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190600',n:'Droperidol',sub:'Neuroleptoanestesia',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'01190610',n:'Fentanilo',sub:'Analgésicos opioides',grupo:'ANALGÉSICOS',cat:M,u:U},
    {cod:'01190700',n:'Naloxona',sub:'Antagonistas',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    // RADIOLOGÍA Y MEDICINA NUCLEAR
    {cod:'01200103',n:'Neurobac (ECD)',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200104',n:'Pirofosfato de sodio',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200106',n:'Ciprofloxacina marcada con tecnecio',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200107',n:'Metoxy-isobutil-isonitrilo MIBI',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200109',n:'Metilendifosfonico MDP',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200111',n:'Ácido Dimercapto succínico (DMSA)',sub:'Radiofármacos',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200115',n:'Enema Baritado',sub:'Medios de contraste',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200120',n:'Enema sulfato de bario',sub:'Medios de contraste',grupo:'RADIOLOGÍA',cat:M,u:U},
    {cod:'01200135',n:'Sales de Meglumina',sub:'Medios de contraste',grupo:'RADIOLOGÍA',cat:M,u:U},
    // ANTÍDOTOS
    {cod:'01210105',n:'N-Acetilcisteína',sub:'Antídotos',grupo:'ANTÍDOTOS',cat:M,u:U},
    {cod:'01210111',n:'Carbón activado',sub:'Antídotos',grupo:'ANTÍDOTOS',cat:M,u:U},
    {cod:'01210120',n:'Pralidoxima',sub:'Antídotos',grupo:'ANTÍDOTOS',cat:M,u:U},
    {cod:'01210160',n:'Suero antiofídico polivalente',sub:'Antídotos',grupo:'ANTÍDOTOS',cat:M,u:U},
    {cod:'01210170',n:'Suero anticoral',sub:'Antídotos',grupo:'ANTÍDOTOS',cat:M,u:U},
    // MISCELÁNEOS
    {cod:'01350188',n:'Troxerutina',sub:'Agente estabilizador capilar',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'04011600',n:'Vaselina simple',sub:'Humectantes',grupo:'DERMATOLOGÍA',cat:M,u:U},
    {cod:'04080000',n:'Compuesto cuaternario amonio',sub:'Desinfectantes',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    {cod:'04080010',n:'Clorhexidina gluconato',sub:'Antisépticos',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    {cod:'04080030',n:'Glutaraldehído',sub:'Desinfectantes',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    {cod:'04080075',n:'Orto-ftaldehído',sub:'Desinfectantes',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    {cod:'04080090',n:'Alcohol etílico + Glicerina',sub:'',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    {cod:'04080111',n:'Compuesto cuaternario amonio',sub:'Desinfectantes',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    {cod:'04080523',n:'Hipoclorito de sodio',sub:'Desinfectantes',grupo:'ANTIMICROBIANOS',cat:M,u:'frasco'},
    // GASES MEDICINALES
    {cod:'05000104',n:'Óxido Nitroso Medicinal T-80',sub:'Gases medicinales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'13500002',n:'Óxido Nitroso Medicinal T-220',sub:'Gases medicinales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'15201125',n:'Oxígeno Medicinal T-220',sub:'Gases medicinales',grupo:'ANESTESIOLOGÍA',cat:M,u:U},
    {cod:'80104101',n:'Ácido Salicílico + Vaselina (queratolítico)',sub:'Queratolítico',grupo:'DERMATOLOGÍA',cat:M,u:U},
  ];
})();

let _minsaSelected = new Set();

function abrirSelectorMINSA() {
  if(!currentClinicaId){ toast('No tienes clínica asignada','error'); return; }
  _minsaSelected.clear();
  document.getElementById('minsa-search').value = '';
  filtrarCatalogoMINSA('');
  document.getElementById('modal-minsa-selector').classList.add('open');
}

function filtrarCatalogoMINSA(q) {
  const existingCodes = new Set(C.inv.filter(p=>p.codigoMinsa).map(p=>p.codigoMinsa));
  const q2 = (q||'').toLowerCase();
  let items = MINSA_CATALOG;
  if(q2) items = items.filter(p=>p.n.toLowerCase().includes(q2)||p.cod.includes(q2)||(p.grupo||'').toLowerCase().includes(q2)||(p.sub||'').toLowerCase().includes(q2));
  const grid = document.getElementById('minsa-catalog-grid');
  if(!items.length){
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:32px;color:var(--text-light);font-size:14px">Sin resultados</div>`;
    _actualizarConteoMINSA(); return;
  }
  grid.innerHTML = items.map(p => {
    const ya = existingCodes.has(p.cod);
    const on = !ya && _minsaSelected.has(p.cod);
    const borderColor = ya ? 'var(--success)' : on ? 'var(--primary)' : 'var(--border)';
    return `<label id="minsa-lbl-${p.cod.replace(/[^a-z0-9]/gi,'_')}" style="display:flex;align-items:flex-start;gap:8px;padding:9px 11px;background:var(--bg);border:1.5px solid ${borderColor};border-radius:9px;cursor:${ya?'default':'pointer'};font-size:12px;transition:border .12s;user-select:none;opacity:${ya?'.6':'1'}">
      <input type="checkbox" ${ya||on?'checked':''} ${ya?'disabled':''} ${ya?'':` onchange="toggleMinsaItem('${p.cod}',this.checked)"`} style="margin-top:3px;flex-shrink:0">
      <div style="min-width:0">
        <div style="font-weight:700;font-size:13px;color:var(--text);line-height:1.3">${p.n}${ya?'<span style="font-size:10px;color:var(--success);margin-left:6px;font-weight:600">✓ en inventario</span>':''}</div>
        <div style="color:var(--text-light);margin-top:2px;font-size:11px">${[p.grupo,p.sub].filter(Boolean).join(' · ')||'Sin grupo'} · <span style="color:var(--text)">${p.u||'unidad'}</span></div>
        <div style="font-family:monospace;font-size:11px;color:var(--primary);margin-top:2px">${p.cod}</div>
      </div>
    </label>`;
  }).join('');
  _actualizarConteoMINSA();
}

function toggleMinsaItem(cod, checked) {
  const ya = C.inv.some(p=>p.codigoMinsa===cod);
  if(ya) return;
  if(checked) _minsaSelected.add(cod);
  else _minsaSelected.delete(cod);
  const key = cod.replace(/[^a-z0-9]/gi,'_');
  const lbl = document.getElementById('minsa-lbl-'+key);
  if(lbl) lbl.style.borderColor = checked ? 'var(--primary)' : 'var(--border)';
  _actualizarConteoMINSA();
}

function _actualizarConteoMINSA() {
  const el = document.getElementById('minsa-selected-count');
  if(el) el.textContent = `${_minsaSelected.size} medicamento${_minsaSelected.size!==1?'s':''} seleccionado${_minsaSelected.size!==1?'s':''}`;
}

function seleccionarTodoMINSA() {
  const existingCodes = new Set(C.inv.filter(p=>p.codigoMinsa).map(p=>p.codigoMinsa));
  const q = document.getElementById('minsa-search').value;
  const q2 = (q||'').toLowerCase();
  let items = MINSA_CATALOG.filter(p=>!existingCodes.has(p.cod));
  if(q2) items = items.filter(p=>p.n.toLowerCase().includes(q2)||p.cod.includes(q2)||(p.grupo||'').toLowerCase().includes(q2)||(p.sub||'').toLowerCase().includes(q2));
  items.forEach(p=>_minsaSelected.add(p.cod));
  filtrarCatalogoMINSA(q);
}

async function confirmarImportMINSA() {
  if(!_minsaSelected.size){ toast('Selecciona al menos un medicamento','error'); return; }
  const toInsert = MINSA_CATALOG.filter(p=>_minsaSelected.has(p.cod)).map(p=>({
    clinica_id:currentClinicaId, nombre:p.n, categoria:'medicamento', unidad:p.u||'unidad',
    stock_actual:0, stock_minimo:0, precio_unitario:null,
    descripcion:[p.sub, p.grupo].filter(Boolean).join(' · ')||null,
    codigo_minsa:p.cod
  }));
  setLoading(true);
  let inserted=0, errors=0;
  for(let i=0; i<toInsert.length; i+=50){
    const {error} = await sb.from('inventario').insert(toInsert.slice(i,i+50));
    if(error){ errors+=Math.min(50,toInsert.length-i); }
    else inserted+=Math.min(50,toInsert.length-i);
  }
  closeModal('modal-minsa-selector');
  await loadAll(); renderInventario(); setLoading(false);
  toast(`✅ ${inserted} medicamentos agregados${errors?` (${errors} con error)`:''}`, inserted>0?'success':'error');
}

async function importarCatalogoMINSA() { abrirSelectorMINSA(); }

let prodSugIdx = -1;

function buscarProductoInv(q) {
  const box = document.getElementById('prod-sug');
  if(!q || q.length < 2) { box.style.display='none'; prodSugIdx=-1; return; }
  const q2 = q.toLowerCase();
  const catIcon = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  const gen = INV_CATALOG.filter(p => p.n.toLowerCase().includes(q2)).slice(0,5);
  const seenNames = new Set(gen.map(p=>p.n.toLowerCase()));
  const minsa = MINSA_CATALOG.filter(p =>
    (p.n.toLowerCase().includes(q2) || p.cod.includes(q2)) && !seenNames.has(p.n.toLowerCase())
  ).slice(0,5);
  const matches = [...gen, ...minsa].slice(0,9);
  if(!matches.length) { box.style.display='none'; return; }
  box.innerHTML = matches.map((p,i) => `
    <div class="prod-sug-item" data-idx="${i}"
      onmousedown="seleccionarProductoInv(${JSON.stringify(p).replace(/"/g,'&quot;')})"
      onmouseenter="prodSugIdx=${i};resaltarProdSug()"
      style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .1s">
      <div>
        <div style="font-size:13px;font-weight:600;color:var(--text)">${catIcon(p.cat)} ${p.n}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">${p.cod?`<span style="font-family:monospace;background:var(--bg);padding:0 3px;border-radius:3px;border:1px solid var(--border)">${p.cod}</span> · `:''}<span style="text-transform:capitalize">${p.cat}</span> · ${p.u}</div>
      </div>
    </div>`).join('');
  box.querySelector('.prod-sug-item:last-child').style.borderBottom='none';
  box.style.display='block'; prodSugIdx=-1; box._matches=matches;
}

function resaltarProdSug() {
  document.querySelectorAll('.prod-sug-item').forEach((el,i)=>{
    el.style.background = i===prodSugIdx ? 'var(--primary-light)' : '';
  });
}

function navProdSug(e) {
  const box=document.getElementById('prod-sug');
  const items=box.querySelectorAll('.prod-sug-item');
  if(!items.length) return;
  if(e.key==='ArrowDown'){e.preventDefault();prodSugIdx=Math.min(prodSugIdx+1,items.length-1);resaltarProdSug();}
  else if(e.key==='ArrowUp'){e.preventDefault();prodSugIdx=Math.max(prodSugIdx-1,0);resaltarProdSug();}
  else if(e.key==='Enter'&&prodSugIdx>=0){e.preventDefault();seleccionarProductoInv(box._matches[prodSugIdx]);}
  else if(e.key==='Escape'){box.style.display='none';}
}

function seleccionarProductoInv(p) {
  document.getElementById('prod-nombre').value    = p.n;
  document.getElementById('prod-categoria').value = p.cat;
  document.getElementById('prod-unidad').value    = p.u;
  document.getElementById('prod-sug').style.display='none';
  prodSugIdx=-1;
  document.getElementById('prod-stock').focus();
}

// ════════════════════ DIAGNÓSTICOS SUGERIDOS ════════════════════
const DX_MAP = {
  'dolor de cabeza':['Migraña sin aura','Cefalea tensional','Hipertensión arterial','Sinusitis aguda','Cefalea en racimos','Neuralgia del trigémino','Hematoma subdural'],
  'cefalea':['Migraña sin aura','Cefalea tensional','Hipertensión arterial','Sinusitis aguda','Neuralgia del trigémino'],
  'migraña':['Migraña sin aura','Migraña con aura','Cefalea en racimos','Cefalea tensional crónica'],
  'fiebre':['Infección respiratoria aguda','Dengue clásico','Dengue hemorrágico','Influenza','Faringoamigdalitis bacteriana','Malaria','Leptospirosis','Fiebre tifoidea','Chikungunya'],
  'calentura':['Infección respiratoria aguda','Dengue clásico','Influenza','Faringoamigdalitis','Malaria','Leptospirosis'],
  'tos':['Infección respiratoria alta','Bronquitis aguda','Neumonía','Asma bronquial','EPOC exacerbado','Laringotraqueobronquitis','Covid-19','Tuberculosis pulmonar'],
  'gripe':['Influenza','Infección respiratoria viral','Faringoamigdalitis viral','Rinofaringitis aguda'],
  'catarro':['Rinofaringitis aguda','Sinusitis aguda','Infección respiratoria alta','Faringitis viral'],
  'dolor de garganta':['Faringoamigdalitis bacteriana','Faringoamigdalitis viral','Mononucleosis infecciosa','Absceso periamigdalino','Laringitis aguda','Epiglotitis'],
  'garganta':['Faringoamigdalitis bacteriana','Faringoamigdalitis viral','Laringitis aguda','Amigdalitis crónica'],
  'dolor abdominal':['Gastritis aguda','Apendicitis aguda','Colitis','Gastroenteritis','Síndrome de intestino irritable','Úlcera péptica','Colelitiasis','Pancreatitis aguda'],
  'dolor de estomago':['Gastritis aguda','Úlcera péptica','Gastroenteritis','Síndrome de intestino irritable','Dispepsia funcional','Apendicitis aguda'],
  'gastritis':['Gastritis aguda','Gastritis crónica','Úlcera péptica','Gastroduodenitis','Reflujo gastroesofágico'],
  'nauseas':['Gastritis aguda','Gastroenteritis','Hiperemesis gravídica','Intoxicación alimentaria','Migraña','Vértigo','Cetoacidosis diabética'],
  'vomito':['Gastroenteritis infecciosa','Gastritis aguda','Intoxicación alimentaria','Obstrucción intestinal','Apendicitis aguda','Hiperemesis gravídica'],
  'diarrea':['Gastroenteritis infecciosa','Colitis amebiana','Intoxicación alimentaria','Síndrome de intestino irritable','Colitis ulcerativa','Rotavirus','Giardiasis'],
  'dolor de pecho':['Angina de pecho inestable','Infarto agudo al miocardio','Pericarditis aguda','Costocondritis','Reflujo gastroesofágico','Embolia pulmonar','Neumonía','Ansiedad'],
  'palpitaciones':['Arritmia cardíaca','Taquicardia supraventricular','Fibrilación auricular','Anemia','Hipertiroidismo','Ansiedad','Prolapso de válvula mitral'],
  'presion alta':['Hipertensión arterial primaria','Crisis hipertensiva','Hipertensión secundaria','Feocromocitoma','Hiperaldosteronismo'],
  'hipertension':['Hipertensión arterial esencial','Crisis hipertensiva','Hipertensión renovascular','Preeclampsia'],
  'diabetes':['Diabetes mellitus tipo 2','Diabetes mellitus tipo 1','Prediabetes','Hipoglucemia','Cetoacidosis diabética','Síndrome metabólico'],
  'azucar':['Diabetes mellitus tipo 2','Hipoglucemia','Prediabetes','Síndrome metabólico'],
  'dolor de espalda':['Lumbalgia mecánica','Hernia de disco lumbar','Ciática','Contractura muscular lumbar','Espondiloartrosis','Osteoporosis','Pielonefritis'],
  'lumbar':['Lumbalgia mecánica','Hernia de disco lumbar','Ciática','Espondiloartrosis','Pielonefritis aguda'],
  'mareos':['Vértigo posicional paroxístico benigno','Laberintitis','Anemia','Hipotensión ortostática','Enfermedad de Ménière','Hipoglucemia','Hipertensión arterial'],
  'vertigo':['Vértigo posicional paroxístico benigno','Laberintitis vestibular','Enfermedad de Ménière','Neuritis vestibular','ACV cerebeloso'],
  'infeccion urinaria':['Cistitis bacteriana aguda','Pielonefritis aguda','Uretritis','Prostatitis','Vaginitis bacteriana'],
  'ardor al orinar':['Cistitis bacteriana aguda','Uretritis','Vaginitis bacteriana','Prostatitis crónica'],
  'piel':['Dermatitis atópica','Urticaria aguda','Dermatitis de contacto','Psoriasis','Micosis cutánea','Escabiosis','Celulitis infecciosa'],
  'alergia':['Urticaria aguda','Dermatitis atópica','Rinitis alérgica','Conjuntivitis alérgica','Asma alérgica','Reacción anafiláctica'],
  'sarpullido':['Urticaria aguda','Dermatitis de contacto','Varicela','Dengue hemorrágico','Escabiosis','Roséola infantil'],
  'asma':['Asma bronquial','Asma de difícil control','Bronquitis asmática','EPOC','Broncoespasmo'],
  'oido':['Otitis media aguda','Otitis externa','Tapón de cerumen','Otitis media con efusión','Mastoiditis'],
  'ojo':['Conjuntivitis bacteriana','Conjuntivitis viral','Orzuelo','Blefaritis','Uveítis aguda','Glaucoma agudo'],
  'articulaciones':['Artritis reumatoide','Osteoartritis','Gota aguda','Artritis séptica','Lupus eritematoso','Artralgia reactiva'],
  'rodilla':['Osteoartritis de rodilla','Lesión meniscal','Tendinitis rotuliana','Bursitis prerrotuliana','Artritis séptica'],
  'embarazo':['Embarazo normoevolutivo','Hiperemesis gravídica','Amenaza de aborto','Infección urinaria en embarazo','Preeclampsia','Anemia en embarazo'],
  'prenatal':['Control prenatal de bajo riesgo','Preeclampsia','Diabetes gestacional','Anemia gestacional','Restricción crecimiento fetal'],
  'ansiedad':['Trastorno de ansiedad generalizada','Trastorno de pánico','Fobia específica','Trastorno de estrés postraumático','Trastorno adaptativo'],
  'depresion':['Episodio depresivo mayor','Trastorno depresivo persistente','Trastorno bipolar','Trastorno adaptativo con ánimo deprimido'],
  'control':['Control de salud general','Control de hipertensión arterial','Control de diabetes mellitus','Control pediátrico','Control prenatal','Control postoperatorio'],
  'chequeo':['Examen médico general','Control de salud del adulto','Examen preventivo','Perfil lipídico alterado'],
  'dengue':['Dengue clásico','Dengue con signos de alarma','Dengue grave','Chikungunya'],
  'infeccion':['Infección respiratoria alta','Infección urinaria','Infección de tejidos blandos','Sepsis','Gastroenteritis infecciosa'],
  'anemia':['Anemia ferropénica','Anemia por deficiencia de B12','Anemia hemolítica','Anemia aplásica','Talasemia'],
  'tiroides':['Hipotiroidismo','Hipertiroidismo','Tiroiditis de Hashimoto','Bocio simple','Nódulo tiroideo'],
  'colesterol':['Dislipidemia mixta','Hipercolesterolemia','Síndrome metabólico','Hipertrigliceridemia'],
  'gastro':['Gastritis aguda','Gastroenteritis','Colitis','Reflujo gastroesofágico','Úlcera péptica'],
};

const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');

function buscarDiagnosticos(query) {
  if(!query || query.length < 3) return [];
  const q = norm(query);
  const found = new Set();
  Object.entries(DX_MAP).forEach(([key, dxs]) => {
    if(norm(key).includes(q) || q.includes(norm(key))) dxs.forEach(d => found.add(d));
  });
  // También buscar palabra suelta
  const words = q.split(' ').filter(w => w.length > 3);
  words.forEach(w => {
    Object.entries(DX_MAP).forEach(([key, dxs]) => {
      if(norm(key).includes(w)) dxs.forEach(d => found.add(d));
    });
  });
  return [...found].slice(0, 9);
}

function buscarProcedimientosDentales(q) {
  if(!q || q.length < 2) return [];
  const lq = q.toLowerCase();
  const results = [];
  for(const cat of PROCEDIMIENTOS_DENTALES) {
    for(const proc of cat.procs) {
      if(proc.toLowerCase().includes(lq)) results.push({ label: proc, cat: cat.cat });
      if(results.length >= 10) return results;
    }
  }
  return results;
}

function mostrarSugerenciasDx(query) {
  const el = document.getElementById('dx-suggestions');
  if(!el) return;
  if(isOdontologo()) {
    const procs = buscarProcedimientosDentales(query);
    if(!procs.length){ el.style.display='none'; return; }
    el.style.display = 'block';
    el.innerHTML = procs.map(p =>
      `<div onmousedown="seleccionarDx('${p.label.replace(/'/g,"\\'")}')" style="padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;flex-direction:column;gap:2px" onmouseover="this.style.background='var(--primary-light)'" onmouseout="this.style.background=''">
        <span style="font-weight:600;font-size:13px">🦷 ${p.label}</span>
        <span style="font-size:11px;color:var(--text-light)">${p.cat}</span>
      </div>`
    ).join('');
    return;
  }
  const dxs = buscarDiagnosticos(query);
  if(!dxs.length){ el.style.display='none'; return; }
  el.style.display = 'block';
  el.innerHTML = dxs.map(dx =>
    `<div style="padding:10px 14px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);transition:background .15s;display:flex;align-items:center;gap:8px"
      onmousedown="seleccionarDx('${dx.replace(/'/g,"\\'")}')">
      <span style="font-size:16px">🩺</span>
      <span>${dx}</span>
    </div>`
  ).join('');
}

function ocultarSugerenciasDx() {
  const el = document.getElementById('dx-suggestions');
  if(el) el.style.display = 'none';
}

let dxElegidos = [];
function seleccionarDx(dx) {
  ocultarSugerenciasDx();
  const motivoEl = document.getElementById('c-motivo');
  if(motivoEl) motivoEl.value = dx;
  if(dxElegidos.includes(dx)) return;
  dxElegidos.push(dx);
  renderDxElegidos();
  const notas = document.getElementById('c-notas');
  const sep = notas.value && !notas.value.endsWith('\n') ? '\n' : '';
  notas.value += (notas.value ? sep : '') + 'Dx: ' + dx;
}

function renderDxElegidos() {
  const wrap = document.getElementById('dx-elegidos-wrap');
  const el = document.getElementById('dx-elegidos');
  if(!el || !wrap) return;
  wrap.style.display = dxElegidos.length ? 'block' : 'none';
  el.innerHTML = dxElegidos.map((dx,i) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary);border-radius:20px;padding:4px 10px;font-size:12px;font-weight:600">
      🩺 ${dx}
      <button type="button" onclick="quitarDx(${i})" style="background:none;border:none;cursor:pointer;color:var(--primary);font-size:14px;line-height:1;padding:0">×</button>
    </span>`
  ).join('');
}

function quitarDx(i) {
  dxElegidos.splice(i,1);
  renderDxElegidos();
}

// ════════════════════ ODONTOLOGÍA — HISTORIA CLÍNICA DENTAL ════════════════════
function renderHistorialDental(pid) {
  const el = document.getElementById('tab-historial-dental');
  if(!el) return;
  const hd = C.hd.find(x => x.pacienteId === pid) || {};
  const f = (id, val='') => `<textarea id="hd-${id}" style="width:100%;min-height:60px;border:1.5px solid var(--border);border-radius:8px;padding:8px;font-size:13px;background:var(--card);color:var(--text);resize:vertical">${val}</textarea>`;
  const fi = (id, val='', type='text') => `<input type="${type}" id="hd-${id}" value="${escAttr(val)}" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px;font-size:13px;background:var(--card);color:var(--text)">`;
  el.innerHTML = `<div class="card">
    <div class="card-header"><h3>🦷 Historia Clínica Dental</h3>
      <button class="btn btn-primary btn-sm" onclick="guardarHistorialDental(${pid})">💾 Guardar</button>
    </div>
    <div class="exp-section">
      <div class="exp-section-title">📋 Motivo de Consulta y Antecedentes</div>
      <div class="form-grid">
        <div class="form-group full"><label>Motivo de consulta</label>${f('motivoConsulta', hd.motivoConsulta)}</div>
        <div class="form-group"><label>Última visita dental</label>${fi('ultimaVisitaDental', hd.ultimaVisitaDental, 'date')}</div>
        <div class="form-group"><label>Higiene oral</label>
          <select id="hd-higieneOral" style="width:100%;border:1.5px solid var(--border);border-radius:8px;padding:8px;font-size:13px;background:var(--card);color:var(--text)">
            ${['','Buena','Regular','Deficiente'].map(v=>`<option value="${v}" ${hd.higieneOral===v?'selected':''}>${v||'—'}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Hábitos orales</label>${f('habitosOrales', hd.habitosOrales)}</div>
        <div class="form-group"><label>Antecedentes médicos generales</label>${f('antecedentesMedicos', hd.antecedentesMedicos)}</div>
        <div class="form-group"><label>Enfermedades sistémicas</label>${f('enfermedadesSistemicas', hd.enfermedadesSistemicas)}</div>
        <div class="form-group"><label>Medicamentos actuales</label>${f('medicamentosActuales', hd.medicamentosActuales)}</div>
        <div class="form-group"><label>Alergias a medicamentos</label>${f('alergiasMedicamentos', hd.alergiasMedicamentos)}</div>
        <div class="form-group full"><label>Tratamientos odontológicos previos</label>${f('tratamientosPrevios', hd.tratamientosPrevios)}</div>
      </div>
    </div>
    <div class="exp-section">
      <div class="exp-section-title">🔍 Examen Clínico</div>
      <div class="form-grid">
        <div class="form-group"><label>Examen extraoral</label>${f('examenExtraoral', hd.examenExtraoral)}</div>
        <div class="form-group"><label>Examen de tejidos blandos</label>${f('examenTejidosBlandos', hd.examenTejidosBlandos)}</div>
        <div class="form-group"><label>Examen de oclusión / mordida</label>${f('examenOclusion', hd.examenOclusion)}</div>
        <div class="form-group"><label>Examen de ATM</label>${f('examenAtm', hd.examenAtm)}</div>
      </div>
    </div>
    <div class="exp-section">
      <div class="exp-section-title">🩺 Diagnóstico</div>
      <div class="form-grid">
        <div class="form-group full"><label>Diagnóstico principal</label>${f('diagnosticoPrincipal', hd.diagnosticoPrincipal)}</div>
        <div class="form-group full"><label>Observaciones clínicas</label>${f('observaciones', hd.observaciones)}</div>
      </div>
    </div>
  </div>`;
}

async function guardarHistorialDental(pid) {
  if(!currentClinicaId) { toast('Sin clínica','error'); return; }
  const get = id => document.getElementById('hd-'+id)?.value?.trim()||'';
  const data = { motivoConsulta:get('motivoConsulta'), antecedentesMedicos:get('antecedentesMedicos'), medicamentosActuales:get('medicamentosActuales'), alergiasMedicamentos:get('alergiasMedicamentos'), enfermedadesSistemicas:get('enfermedadesSistemicas'), ultimaVisitaDental:get('ultimaVisitaDental'), tratamientosPrevios:get('tratamientosPrevios'), habitosOrales:get('habitosOrales'), higieneOral:get('higieneOral'), examenExtraoral:get('examenExtraoral'), examenTejidosBlandos:get('examenTejidosBlandos'), examenOclusion:get('examenOclusion'), examenAtm:get('examenAtm'), diagnosticoPrincipal:get('diagnosticoPrincipal'), observaciones:get('observaciones') };
  const existing = C.hd.find(x => x.pacienteId === pid);
  setLoading(true);
  let err;
  if(existing) {
    const r = await sb.from('historial_dental').update(toHD(data,pid)).eq('id', existing.id);
    err = r.error;
  } else {
    const r = await sb.from('historial_dental').insert([toHD(data,pid)]);
    err = r.error;
  }
  setLoading(false);
  if(err) { toast('Error: '+err.message,'error'); return; }
  toast('Historia clínica guardada ✅');
  await loadAll();
  renderHistorialDental(pid);
}

// ════════════════════ ODONTOLOGÍA — ODONTOGRAMA ════════════════════
let _odoData = { dientes:{}, observaciones:'' };
let _odoEstadoActivo = 'sano';
let _odoCurrentPid = null;
let _vencAlertShown = false;

// Coordenadas FDI — orientación estándar: incisivos ARRIBA, molares abajo-laterales
// Q1: 18→11 (izq exterior→centro), Q2: 21→28 (centro→der exterior)
// Q4: 48→41 (izq exterior→centro), Q3: 31→38 (centro→der exterior)
const ODO_POSITIONS = {
  Q1: [
    {num:18,x:55, y:232,rot:72, w:28,h:24},{num:17,x:73, y:193,rot:62, w:26,h:24},
    {num:16,x:100,y:158,rot:50, w:26,h:24},{num:15,x:133,y:128,rot:35, w:22,h:22},
    {num:14,x:170,y:106,rot:21, w:22,h:22},{num:13,x:212,y:91, rot:10, w:18,h:23},
    {num:12,x:255,y:82, rot:3,  w:15,h:21},{num:11,x:296,y:79, rot:0,  w:17,h:21}
  ],
  Q2: [
    {num:21,x:316,y:79, rot:0,  w:17,h:21},{num:22,x:357,y:82, rot:-3, w:15,h:21},
    {num:23,x:400,y:91, rot:-10,w:18,h:23},{num:24,x:442,y:106,rot:-21,w:22,h:22},
    {num:25,x:479,y:128,rot:-35,w:22,h:22},{num:26,x:512,y:158,rot:-50,w:26,h:24},
    {num:27,x:539,y:193,rot:-62,w:26,h:24},{num:28,x:557,y:232,rot:-72,w:28,h:24}
  ],
  Q3: [
    {num:31,x:316,y:420,rot:0,  w:17,h:21},{num:32,x:357,y:417,rot:3,  w:15,h:21},
    {num:33,x:400,y:408,rot:10, w:18,h:23},{num:34,x:442,y:393,rot:21, w:22,h:22},
    {num:35,x:479,y:371,rot:35, w:22,h:22},{num:36,x:512,y:341,rot:50, w:26,h:24},
    {num:37,x:539,y:306,rot:62, w:26,h:24},{num:38,x:557,y:267,rot:72, w:28,h:24}
  ],
  Q4: [
    {num:48,x:55, y:267,rot:-72,w:28,h:24},{num:47,x:73, y:306,rot:-62,w:26,h:24},
    {num:46,x:100,y:341,rot:-50,w:26,h:24},{num:45,x:133,y:371,rot:-35,w:22,h:22},
    {num:44,x:170,y:393,rot:-21,w:22,h:22},{num:43,x:212,y:408,rot:-10,w:18,h:23},
    {num:42,x:255,y:417,rot:-3, w:15,h:21},{num:41,x:296,y:420,rot:0,  w:17,h:21}
  ]
};

// Color del número según tipo dental (incisivo/canino/premolar/molar)
function getNumColor(num) {
  const t = num % 10;
  if (t === 1 || t === 2) return '#f59e0b';
  if (t === 3) return '#22c55e';
  if (t === 4 || t === 5) return '#94a3b8';
  return '#60a5fa';
}

function _getDienteIcon(estado) {
  if(estado==='extraccion') return '✕';
  if(estado==='implante')   return '▪';
  if(estado==='corona')     return '◆';
  if(estado==='puente')     return '━';
  return '';
}

let _odoSuperficieActiva = 'all';

function renderOdontograma(pid) {
  const elTab = document.getElementById('tab-odontograma');
  if(!elTab) return;
  const existing = C.odo.find(x => x.pacienteId === pid) || { dientes:{}, observaciones:'' };
  const dientes = _migrateOdoData(existing.dientes);
  const counts = {};
  Object.values(dientes).forEach(tooth => {
    ['v','l','m','d','o'].forEach(s => {
      const est = tooth[s] || 'sano';
      if(est !== 'sano') counts[est] = (counts[est]||0)+1;
    });
  });
  const badges = ESTADOS_DIENTE.filter(e => e.key !== 'sano' && counts[e.key])
    .map(e => `<span style="padding:3px 10px;border-radius:12px;background:${e.color};border:1.5px solid ${e.border};font-size:11px;font-weight:700;color:${e.text}">${e.code?e.code+' · ':''}${e.label}: ${counts[e.key]}</span>`)
    .join('');
  elTab.innerHTML = `<div class="card">
    <div class="card-header">
      <h3>🦷 Odontograma</h3>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="imprimirOdontograma(${pid})">🖨️ Imprimir</button>
        <button class="btn btn-primary btn-sm" onclick="abrirModalOdontograma(${pid})">✏️ Editar</button>
      </div>
    </div>
    <div class="odo-scroll">${_buildLaminaHTML(dientes, false)}</div>
    ${badges?`<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:10px">${badges}</div>`:''}
    ${_odoReferenciasHTML()}
    ${existing.observaciones?`<div style="margin-top:10px;font-size:12px;color:var(--text-light)"><strong>Observaciones:</strong> ${existing.observaciones}</div>`:''}
  </div>`;
  _centerOdoScroll(elTab);
}

function _migrateOdoData(raw) {
  const mk = v => LEGACY_ESTADO_DIENTE[v] || v || 'sano';
  const result = {};
  Object.entries(raw || {}).forEach(([k, val]) => {
    if(!val) return;
    if(val.estado !== undefined && val.v === undefined) {
      result[k] = { v:mk(val.estado), l:'sano', m:'sano', d:'sano', o:'sano' };
    } else {
      result[k] = { v:mk(val.v), l:mk(val.l), m:mk(val.m), d:mk(val.d), o:mk(val.o) };
    }
  });
  return result;
}

function abrirModalOdontograma(pid) {
  _odoCurrentPid = pid;
  const titleEl = document.getElementById('modal-odo-title');
  if(titleEl) titleEl.textContent = '🦷 Odontograma';

  const existing = C.odo.find(x => x.pacienteId === pid) || { dientes:{}, observaciones:'' };
  _odoData = JSON.parse(JSON.stringify({
    dientes: _migrateOdoData(existing.dientes),
    observaciones: existing.observaciones || ''
  }));
  _odoEstadoActivo = 'sano';
  _odoSuperficieActiva = 'all';

  const bar = document.getElementById('odo-estados-bar');
  if(bar) bar.innerHTML = ESTADOS_DIENTE.map(e => {
    const ink = ODO_INK[e.ink] || '#6b7280';
    return `<button id="odo-btn-${e.key}" class="odo-chip" onclick="setEstadoActivo('${e.key}')"
      style="border-color:${e.key==='sano'?'#9ca3af':ink};color:${e.key==='sano'?'#374151':ink};
             ${e.key==='sano'?'box-shadow:0 0 0 3px var(--primary)':''}">
      ${e.key==='sano'?'🧽 Sano / Borrar':`${e.code} · ${e.label}`}
    </button>`;
  }).join('');

  const obsEl = document.getElementById('odo-obs');
  if(obsEl) obsEl.value = _odoData.observaciones || '';
  renderArcoOdontograma();
  openModalOverlay('modal-odontograma');
}

function renderToothSketch(num, isUpper) {
  const t = num % 10;
  const sp = {
    1:[10,8,1,13,false], 2:[8,7,1,12,false], 3:[7,10,1,15,true],
    4:[10,9,2,11,false],  5:[10,9,2,10,false],
    6:[15,10,3,10,false], 7:[14,10,3,9,false], 8:[13,9,2,8,false]
  };
  const [cw, ch, rn, rl, isCanine] = sp[t] || sp[6];
  const svgW = cw + 8, svgH = ch + rl + 4;
  const cx = svgW / 2;
  const crownY  = isUpper ? (svgH - ch - 2) : 2;
  const rootStY = isUpper ? crownY : (crownY + ch);
  const rootEdY = isUpper ? (rootStY - rl) : (rootStY + rl);
  const occlY   = isUpper ? (crownY + ch) : crownY;
  const cDir    = isUpper ? 1 : -1;

  let crown = '';
  if(isCanine) {
    crown = `<path d="M ${cx-cw/2},${crownY+ch} L ${cx},${crownY} L ${cx+cw/2},${crownY+ch} Z" fill="none" stroke="#94a3b8" stroke-width="1.2" stroke-linejoin="round"/>`;
  } else {
    crown = `<rect x="${cx-cw/2}" y="${crownY}" width="${cw}" height="${ch}" rx="2.5" fill="none" stroke="#94a3b8" stroke-width="1.2"/>`;
    if(t >= 6) {
      const s = cw/3;
      crown += [`M ${cx-cw/2},${occlY} Q ${cx-cw/2+s*0.5},${occlY+cDir*4} ${cx-cw/2+s},${occlY}`,
                `M ${cx-cw/2+s},${occlY} Q ${cx-cw/2+s*1.5},${occlY+cDir*4} ${cx-cw/2+s*2},${occlY}`,
                `M ${cx-cw/2+s*2},${occlY} Q ${cx-cw/2+s*2.5},${occlY+cDir*4} ${cx+cw/2},${occlY}`]
        .map(d => `<path d="${d}" fill="none" stroke="#94a3b8" stroke-width="0.8"/>`).join('');
    } else if(t === 4 || t === 5) {
      crown += `<path d="M ${cx-2.5},${occlY} Q ${cx},${occlY+cDir*4} ${cx+2.5},${occlY}" fill="none" stroke="#94a3b8" stroke-width="0.8"/>`;
    }
  }

  let roots = '';
  if(rn === 1) {
    const rw = cw*0.18;
    roots = `<line x1="${cx-rw}" y1="${rootStY}" x2="${cx-rw/1.5}" y2="${rootEdY}" stroke="#94a3b8" stroke-width="1.1"/>
             <line x1="${cx+rw}" y1="${rootStY}" x2="${cx+rw/1.5}" y2="${rootEdY}" stroke="#94a3b8" stroke-width="1.1"/>`;
  } else if(rn === 2) {
    const o = cw*0.22;
    roots = `<line x1="${cx-o}" y1="${rootStY}" x2="${cx-o-1}" y2="${rootEdY}" stroke="#94a3b8" stroke-width="1.1"/>
             <line x1="${cx+o}" y1="${rootStY}" x2="${cx+o+1}" y2="${rootEdY}" stroke="#94a3b8" stroke-width="1.1"/>`;
  } else {
    const o = cw*0.3;
    roots = `<line x1="${cx-o}" y1="${rootStY}" x2="${cx-o-2}" y2="${rootEdY}" stroke="#94a3b8" stroke-width="1.1"/>
             <line x1="${cx}" y1="${rootStY}" x2="${cx}" y2="${rootEdY+cDir*3}" stroke="#94a3b8" stroke-width="1.1"/>
             <line x1="${cx+o}" y1="${rootStY}" x2="${cx+o+2}" y2="${rootEdY}" stroke="#94a3b8" stroke-width="1.1"/>`;
  }
  return `<svg width="${svgW}" height="${svgH}" viewBox="0 0 ${svgW} ${svgH}" style="display:block">${crown}${roots}</svg>`;
}

function _renderCirculo(num, dientes, interactive) {
  const tooth = dientes[num] || {};
  const gs = s => { const k=tooth[s]||(tooth.estado&&s==='v'?tooth.estado:'sano'); return ESTADOS_DIENTE.find(x=>x.key===k)||ESTADOS_DIENTE[0]; };
  const R=13, IR=5.8, D=+(R*0.7071).toFixed(2);
  const ev=gs('v'), el=gs('l'), em=gs('m'), ed=gs('d'), eo=gs('o');
  const on = s => interactive ? ` onclick="clickSuperficie(${num},'${s}')"` : '';
  return `<svg viewBox="-14 -14 28 28" class="odo-svg" style="display:block;${interactive?'cursor:pointer;':''}overflow:visible">
    <path d="M 0,0 L -${D},-${D} A ${R},${R} 0 0,1 ${D},-${D} Z" data-surf="v" fill="${ev.color}" stroke="${ev.border}" stroke-width="0.6"${on('v')}/>
    <path d="M 0,0 L ${D},-${D} A ${R},${R} 0 0,1 ${D},${D} Z"  data-surf="d" fill="${ed.color}" stroke="${ed.border}" stroke-width="0.6"${on('d')}/>
    <path d="M 0,0 L ${D},${D} A ${R},${R} 0 0,1 -${D},${D} Z"  data-surf="l" fill="${el.color}" stroke="${el.border}" stroke-width="0.6"${on('l')}/>
    <path d="M 0,0 L -${D},${D} A ${R},${R} 0 0,1 -${D},-${D} Z" data-surf="m" fill="${em.color}" stroke="${em.border}" stroke-width="0.6"${on('m')}/>
    <ellipse rx="${IR}" ry="${IR-1.2}" data-surf="o" fill="${eo.color}" stroke="${eo.border}" stroke-width="0.6"${on('o')}/>
    <circle r="${R}" fill="none" stroke="#374151" stroke-width="1.2"/>
  </svg>`;
}

// Códigos (Do, C, CP…) presentes en un diente, coloreados con su tinta
function _odoToothCodes(num, dientes) {
  const t = dientes[num] || {};
  const ks = [...new Set(['v','l','m','d','o'].map(s=>t[s]).filter(k=>k && k!=='sano'))];
  return ks.map(k => { const e=ESTADOS_DIENTE.find(x=>x.key===k); return e&&e.code ? `<span style="color:${ODO_INK[e.ink]||'#374151'}">${e.code}</span>` : ''; }).filter(Boolean).join(' ');
}

// Lámina clásica: 18-28 / 55-65 / 85-75 / 48-38 (números abajo en la última fila)
function _buildLaminaHTML(dientes, interactive) {
  const cell = (num, numAbajo) => `<div class="odo-cell">
    ${numAbajo?'':`<span class="odo-num">${num}</span>`}
    <div ${interactive?`id="odo-circle-${num}" `:''}style="line-height:0">${_renderCirculo(num, dientes, interactive)}</div>
    <span class="odo-codes"${interactive?` id="odo-codes-${num}"`:''}>${_odoToothCodes(num, dientes)}</span>
    ${numAbajo?`<span class="odo-num">${num}</span>`:''}
  </div>`;
  const row = (der, izq, numAbajo) => `<div class="odo-row">
    <div class="odo-half">${der.map(n=>cell(n,numAbajo)).join('')}</div>
    <span class="odo-mid"></span>
    <div class="odo-half">${izq.map(n=>cell(n,numAbajo)).join('')}</div>
  </div>`;
  return `<div class="odo-lamina">
    ${row([18,17,16,15,14,13,12,11],[21,22,23,24,25,26,27,28],false)}
    ${row([55,54,53,52,51],[61,62,63,64,65],false)}
    ${row([85,84,83,82,81],[71,72,73,74,75],false)}
    ${row([48,47,46,45,44,43,42,41],[31,32,33,34,35,36,37,38],true)}
  </div>`;
}

function _odoReferenciasHTML() {
  return `<div style="margin-top:14px">
    <div style="font-size:12px;font-weight:800;margin-bottom:6px;color:var(--text)">Referencias:</div>
    <div class="odo-refs">${ESTADOS_DIENTE.filter(e=>e.code).map(e =>
      `<span class="odo-ref-item"><b style="color:${ODO_INK[e.ink]}">${e.code}:</b> en ${e.ink} <b>${e.label}</b></span>`).join('')}
    </div></div>`;
}

// Estilos embebidos para la impresión (la ventana de PDF no carga styles.css)
const ODO_PRINT_CSS = `<style>
.odo-lamina{display:flex;flex-direction:column;gap:10px;align-items:center;padding:6px 0}
.odo-row{display:flex;align-items:flex-end;gap:3px;justify-content:center}
.odo-half{display:flex;gap:3px}
.odo-mid{width:14px;border-top:2px dashed #9ca3af;align-self:center;display:inline-block}
.odo-cell{display:flex;flex-direction:column;align-items:center;gap:2px;width:30px}
.odo-svg{width:26px;height:26px}
.odo-num{font-size:9px;font-weight:800;color:#111;line-height:1}
.odo-codes{font-size:8px;font-weight:800;line-height:1.1;min-height:8px;text-align:center}
.odo-refs{display:grid;grid-template-columns:repeat(3,1fr);gap:3px 14px}
.odo-ref-item{font-size:9.5px;color:#111}
</style>`;

function renderArcoOdontograma() {
  const container = document.getElementById('odo-arco-container');
  if(!container) return;
  const SURFS=[{k:'all',l:'Todas'},{k:'v',l:'Vest.'},{k:'o',l:'Ocl.'},{k:'l',l:'Ling.'},{k:'m',l:'Mes.'},{k:'d',l:'Dist.'}];
  const surfBar = SURFS.map(s=>`<button id="odo-surf-${s.k}" class="odo-surf-btn" onclick="setSuperficieActiva('${s.k}')"
    style="background:${s.k==='all'?'var(--primary)':'var(--card)'};color:${s.k==='all'?'#fff':'var(--text)'}">${s.l}</button>`).join('');

  container.innerHTML = `
  <div style="margin-bottom:8px">
    <span style="font-size:11px;color:var(--text-light);margin-right:6px;font-weight:600">Superficie:</span>
    <span style="display:inline-flex;flex-wrap:wrap;gap:4px">${surfBar}</span>
  </div>
  <div class="odo-hint">↔ Desliza horizontalmente · elige un estado y toca la pieza</div>
  <div class="odo-scroll">${_buildLaminaHTML(_odoData.dientes, true)}</div>
  ${_odoReferenciasHTML()}`;
  _centerOdoScroll(container);
}

// Centra la lámina horizontalmente (los dientes frontales quedan a la vista primero)
function _centerOdoScroll(root) {
  const sc = root && root.querySelector('.odo-scroll');
  if(!sc) return;
  requestAnimationFrame(() => { sc.scrollLeft = Math.max(0, (sc.scrollWidth - sc.clientWidth) / 2); });
}

function setEstadoActivo(key) {
  _odoEstadoActivo = key;
  ESTADOS_DIENTE.forEach(e => {
    const btn = document.getElementById('odo-btn-'+e.key);
    if(btn) btn.style.boxShadow = e.key===key ? '0 0 0 3px var(--primary)' : '';
  });
}

function setSuperficieActiva(key) {
  _odoSuperficieActiva = key;
  ['all','v','o','l','m','d'].forEach(k => {
    const btn = document.getElementById('odo-surf-'+k);
    if(!btn) return;
    btn.style.background = k===key ? 'var(--primary)' : 'var(--card)';
    btn.style.color = k===key ? '#fff' : 'var(--text)';
  });
}

function clickSuperficie(num, clickedSurf) {
  if(!_odoData.dientes) _odoData.dientes = {};
  if(!_odoData.dientes[num]) _odoData.dientes[num] = {};
  const s = _odoSuperficieActiva === 'all' ? clickedSurf : _odoSuperficieActiva;
  _odoData.dientes[num][s] = _odoEstadoActivo;
  const circleEl = document.getElementById('odo-circle-'+num);
  if(!circleEl) return;
  const e = ESTADOS_DIENTE.find(x => x.key===_odoEstadoActivo) || ESTADOS_DIENTE[0];
  const sec = circleEl.querySelector(`[data-surf="${s}"]`);
  if(sec) { sec.setAttribute('fill', e.color); sec.setAttribute('stroke', e.border); }
  const codesEl = document.getElementById('odo-codes-'+num);
  if(codesEl) codesEl.innerHTML = _odoToothCodes(num, _odoData.dientes);
}

function clickDiente(num) { clickSuperficie(num, 'o'); }

async function guardarOdontograma() {
  const pid = _odoCurrentPid;
  if(!pid || !currentClinicaId) { toast('Sin clínica','error'); return; }
  _odoData.observaciones = document.getElementById('odo-obs')?.value||'';
  const existing = C.odo.find(x => x.pacienteId === pid);
  const obj = { paciente_id:pid, clinica_id:currentClinicaId, dientes:_odoData.dientes||{}, observaciones:_odoData.observaciones||null };
  setLoading(true);
  let err;
  if(existing) { const r=await sb.from('odontograma').update(obj).eq('id',existing.id); err=r.error; }
  else          { const r=await sb.from('odontograma').insert([obj]);                   err=r.error; }
  setLoading(false);
  if(err) { toast('Error: '+err.message,'error'); return; }
  toast('Odontograma guardado ✅');
  closeModal('modal-odontograma');
  await loadAll();
  renderOdontograma(pid);
}

// ════════════════════ ODONTOLOGÍA — PERIODONTOGRAMA ════════════════════
const PERIO_DIENTES_SUP = [17,16,15,14,13,12,11,21,22,23,24,25,26,27];
const PERIO_DIENTES_INF = [47,46,45,44,43,42,41,31,32,33,34,35,36,37];

function renderPeriodontograma(pid) {
  const el = document.getElementById('tab-periodontograma');
  if(!el) return;
  const existing = C.perio.find(x => x.pacienteId === pid) || { datos:{}, observaciones:'' };
  const d = existing.datos || {};

  const thStyle = 'padding:4px 2px;font-size:10px;font-weight:700;text-align:center;min-width:32px;color:var(--text-light)';
  const tdStyle = 'padding:2px;text-align:center';
  const inp = (diente, campo) => `<input type="number" min="0" max="12" step="1" id="perio-${diente}-${campo}" value="${d[diente] ? (d[diente][campo] ?? '') : ''}" style="width:30px;text-align:center;border:1px solid var(--border);border-radius:4px;padding:2px 0;font-size:11px;background:var(--card);color:var(--text)">`;
  const chk = (diente, campo) => `<input type="checkbox" id="perio-${diente}-${campo}" ${d[diente] && d[diente][campo] ? 'checked' : ''} style="accent-color:var(--primary)">`;

  const buildTable = (dientes, label) => `
    <div style="margin-bottom:20px">
      <div style="font-size:11px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">${label}</div>
      <div style="overflow-x:auto">
        <table style="border-collapse:collapse;font-size:11px">
          <thead><tr>
            <th style="${thStyle};text-align:left;min-width:90px">Medición</th>
            ${dientes.map(n=>`<th style="${thStyle}">${n}</th>`).join('')}
          </tr></thead>
          <tbody>
            <tr><td style="${tdStyle};font-weight:600;font-size:11px;white-space:nowrap">PB Vestibular (mm)</td>${dientes.map(n=>`<td style="${tdStyle}">${inp(n,'pbv')}</td>`).join('')}</tr>
            <tr style="background:var(--bg)"><td style="${tdStyle};font-weight:600;font-size:11px">PB Lingual (mm)</td>${dientes.map(n=>`<td style="${tdStyle}">${inp(n,'pbl')}</td>`).join('')}</tr>
            <tr><td style="${tdStyle};font-weight:600;font-size:11px">Recesión (mm)</td>${dientes.map(n=>`<td style="${tdStyle}">${inp(n,'rec')}</td>`).join('')}</tr>
            <tr style="background:var(--bg)"><td style="${tdStyle};font-weight:600;font-size:11px">Sangrado</td>${dientes.map(n=>`<td style="${tdStyle}">${chk(n,'sang')}</td>`).join('')}</tr>
            <tr><td style="${tdStyle};font-weight:600;font-size:11px">Movilidad (0-3)</td>${dientes.map(n=>`<td style="${tdStyle}">${inp(n,'mov')}</td>`).join('')}</tr>
            <tr style="background:var(--bg)"><td style="${tdStyle};font-weight:600;font-size:11px">Furcación (0-3)</td>${dientes.map(n=>`<td style="${tdStyle}">${inp(n,'fur')}</td>`).join('')}</tr>
          </tbody>
        </table>
      </div>
    </div>`;

  el.innerHTML = `<div class="card">
    <div class="card-header"><h3>📏 Periodontograma</h3>
      <div style="display:flex;gap:8px">
        <button class="btn btn-secondary btn-sm" onclick="imprimirPeriodontograma(${pid})">🖨️ Imprimir</button>
        <button class="btn btn-primary btn-sm" onclick="guardarPeriodontograma(${pid})">💾 Guardar</button>
      </div>
    </div>
    <div style="font-size:12px;color:var(--text-light);margin-bottom:14px">PB = Profundidad de bolsa. Sangrado al sondaje. Movilidad y furcación: 0–3.</div>
    ${buildTable(PERIO_DIENTES_SUP,'Superiores')}
    ${buildTable(PERIO_DIENTES_INF,'Inferiores')}
    <div style="margin-top:12px">
      <label style="font-size:13px;font-weight:600;display:block;margin-bottom:6px">Observaciones</label>
      <textarea id="perio-obs" style="width:100%;min-height:70px;border:1.5px solid var(--border);border-radius:8px;padding:8px;font-size:13px;background:var(--card);color:var(--text);resize:vertical">${existing.observaciones||''}</textarea>
    </div>
  </div>`;
}

async function guardarPeriodontograma(pid) {
  if(!currentClinicaId) { toast('Sin clínica','error'); return; }
  const allDientes = [...PERIO_DIENTES_SUP,...PERIO_DIENTES_INF];
  const datos = {};
  allDientes.forEach(n => {
    datos[n] = {
      pbv:  Number(document.getElementById(`perio-${n}-pbv`)?.value)||0,
      pbl:  Number(document.getElementById(`perio-${n}-pbl`)?.value)||0,
      rec:  Number(document.getElementById(`perio-${n}-rec`)?.value)||0,
      sang: document.getElementById(`perio-${n}-sang`)?.checked||false,
      mov:  Number(document.getElementById(`perio-${n}-mov`)?.value)||0,
      fur:  Number(document.getElementById(`perio-${n}-fur`)?.value)||0,
    };
  });
  const obs = document.getElementById('perio-obs')?.value||'';
  const existing = C.perio.find(x => x.pacienteId === pid);
  const obj = { paciente_id:pid, clinica_id:currentClinicaId, datos, observaciones:obs||null };
  setLoading(true);
  let err;
  if(existing) { const r=await sb.from('periodontograma').update(obj).eq('id',existing.id); err=r.error; }
  else          { const r=await sb.from('periodontograma').insert([obj]);                    err=r.error; }
  setLoading(false);
  if(err) { toast('Error: '+err.message,'error'); return; }
  toast('Periodontograma guardado ✅');
  await loadAll();
  renderPeriodontograma(pid);
}

// ════════════════════ ODONTOLOGÍA — IMPRESIÓN ════════════════════
function imprimirOdontograma(pid) {
  const p = C.p.find(x => x.id === pid);
  const rec = C.odo.find(x => x.pacienteId === pid) || { dientes:{}, observaciones:'' };
  const dientes = _migrateOdoData(rec.dientes);
  const cfg = currentClinica || {};

  const refs = ESTADOS_DIENTE.filter(e=>e.code).map(e =>
    `<span class="odo-ref-item"><b style="color:${ODO_INK[e.ink]}">${e.code}:</b> en ${e.ink} <b>${e.label}</b></span>`).join('');

  const body = `${ODO_PRINT_CSS}
    <div class="section-title">🦷 Odontograma</div>
    <table style="width:100%;margin-bottom:10px"><tr>
      <td><strong>Paciente:</strong> ${p ? p.nombre+' '+p.apellidos : '—'}</td>
      <td style="text-align:right;color:#6b7280;font-size:11px">Fecha: ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</td>
    </tr></table>
    <div style="margin-bottom:14px">${_buildLaminaHTML(dientes, false)}</div>
    <div style="margin-bottom:${rec.observaciones?'12px':'0'}">
      <strong style="font-size:11px">Referencias:</strong>
      <div class="odo-refs" style="margin-top:5px">${refs}</div>
    </div>
    ${rec.observaciones ? `<div><strong style="font-size:11px">Observaciones:</strong><p style="font-size:12px;margin:4px 0 0;white-space:pre-wrap">${rec.observaciones}</p></div>` : ''}`;

  pdfAbrir(`Odontograma — ${p ? p.nombre+' '+p.apellidos : 'Paciente'}`, body, cfg);
}

function imprimirPeriodontograma(pid) {
  const p   = C.p.find(x => x.id === pid);
  const rec = C.perio.find(x => x.pacienteId === pid) || { datos:{}, observaciones:'' };
  const d   = rec.datos || {};
  const cfg = currentClinica || {};

  const th = 'padding:5px 3px;font-size:10px;font-weight:700;text-align:center;border:1px solid #e5e7eb;background:#f3f4f6';
  const td = 'padding:4px 2px;text-align:center;border:1px solid #e5e7eb;font-size:11px';
  const rows = [
    ['PB Vestibular (mm)', n => d[n]?.pbv ?? 0],
    ['PB Lingual (mm)',    n => d[n]?.pbl ?? 0],
    ['Recesión (mm)',      n => d[n]?.rec ?? 0],
    ['Sangrado',           n => d[n]?.sang ? '<span style="color:#ef4444;font-weight:700">●</span>' : '○'],
    ['Movilidad (0–3)',    n => d[n]?.mov ?? 0],
    ['Furcación (0–3)',    n => d[n]?.fur ?? 0],
  ];

  const buildTable = (dientes, label) => `
    <div style="margin-bottom:20px">
      <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;color:#374151">${label}</div>
      <table style="border-collapse:collapse;width:100%">
        <thead><tr>
          <th style="${th};text-align:left;min-width:110px">Medición</th>
          ${dientes.map(n=>`<th style="${th}">${n}</th>`).join('')}
        </tr></thead>
        <tbody>${rows.map(([label,fn],i) => `
          <tr style="${i%2?'background:#f9fafb':''}">
            <td style="${td};font-weight:600;text-align:left">${label}</td>
            ${dientes.map(n=>`<td style="${td}">${fn(n)}</td>`).join('')}
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  const body = `
    <div class="section-title">📏 Periodontograma</div>
    <table style="width:100%;margin-bottom:8px"><tr>
      <td><strong>Paciente:</strong> ${p ? p.nombre+' '+p.apellidos : '—'}</td>
      <td style="text-align:right;color:#6b7280;font-size:12px">Fecha: ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</td>
    </tr></table>
    <p style="font-size:11px;color:#6b7280;margin:0 0 14px">PB = Profundidad de bolsa en mm · Sangrado al sondaje: ● sí / ○ no · Movilidad y furcación: escala 0–3</p>
    ${buildTable(PERIO_DIENTES_SUP,'Superiores')}
    ${buildTable(PERIO_DIENTES_INF,'Inferiores')}
    ${rec.observaciones ? `<div><strong style="font-size:12px">Observaciones:</strong><p style="font-size:13px;margin:4px 0 0;white-space:pre-wrap">${rec.observaciones}</p></div>` : ''}`;

  pdfAbrir(`Periodontograma — ${p ? p.nombre+' '+p.apellidos : 'Paciente'}`, body, cfg);
}

// ════════════════════ ODONTOLOGÍA — PROCEDIMIENTOS ════════════════════
let editingProcId = null;

function renderProcedimientosView() {
  const el = document.getElementById('view-procedimientos');
  if(!el) return;

  const ECOL = { pendiente:'tag-blue', iniciado:'tag-cyan', finalizado:'tag-green', cancelado:'tag-red' };
  const allProc = [...C.proc].sort((a,b) => b.fecha.localeCompare(a.fecha));
  const total       = allProc.length;
  const finalizados = allProc.filter(p => p.estado === 'finalizado').length;
  const pendientes  = allProc.filter(p => p.estado === 'pendiente').length;
  const iniciados   = allProc.filter(p => p.estado === 'iniciado').length;
  const totalPres   = allProc.reduce((s,p) => s + (p.presupuesto||0), 0);

  el.innerHTML = `
    <div class="stats-grid" style="margin-bottom:20px">
      <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#e0f2fe,#bae6fd)">🦷</div><div class="stat-info"><h3>${total}</h3><p>Total procedimientos</p></div></div>
      <div class="stat-card"><div class="stat-icon si-green">✅</div><div class="stat-info"><h3>${finalizados}</h3><p>Finalizados</p></div></div>
      <div class="stat-card"><div class="stat-icon si-blue">📋</div><div class="stat-info"><h3>${pendientes}</h3><p>Pendientes</p></div></div>
      <div class="stat-card"><div class="stat-icon si-orange">🔄</div><div class="stat-info"><h3>${iniciados}</h3><p>Iniciados</p></div></div>
      ${totalPres>0?`<div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#d1fae5,#a7f3d0)">💰</div><div class="stat-info"><h3>$${totalPres.toLocaleString()}</h3><p>Presupuesto total</p></div></div>`:''}
    </div>
    <div class="card">
      <div class="card-header">
        <h3>📋 Plan de Tratamiento</h3>
        <button class="btn btn-primary btn-sm" onclick="openModalProcedimiento()">+ Nuevo</button>
      </div>
      ${!allProc.length ? '<div class="empty-state"><div class="empty-icon">🦷</div><p>Sin procedimientos registrados</p></div>' :
        allProc.map(proc => {
          const pac = C.p.find(x => x.id === proc.pacienteId);
          const nomPac = pac ? `${pac.nombre} ${pac.apellidos}` : '—';
          return `<div class="proc-row" style="display:flex;align-items:center;gap:10px;padding:11px 14px;border-bottom:1px solid var(--border)">
            <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#e0f2fe,#bae6fd);display:flex;align-items:center;justify-content:center;font-size:17px;flex-shrink:0">🦷</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${proc.procedimiento}${proc.diente?` <span style="font-size:11px;color:var(--text-light);font-weight:400">— Diente ${proc.diente}</span>`:''}</div>
              <div style="font-size:11px;color:var(--text-light);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                <a href="#" onclick="navigate('paciente-detalle',${proc.pacienteId});return false" style="color:var(--primary);font-weight:600">${nomPac}</a>
                · ${formatFecha(proc.fecha)} · <span class="tag tag-blue" style="font-size:9px;padding:1px 6px">${proc.categoria}</span>
              </div>
            </div>
            ${proc.presupuesto!=null?`<span style="font-weight:700;font-size:13px;color:var(--success);white-space:nowrap;flex-shrink:0">$${Number(proc.presupuesto).toLocaleString()}</span>`:''}
            <span class="tag ${ECOL[proc.estado]||'tag-blue'}" style="white-space:nowrap;flex-shrink:0">${proc.estado}</span>
            <div class="actions-cell" style="gap:5px;flex-shrink:0">
              <button class="btn btn-secondary btn-sm" onclick="openModalProcedimiento(${proc.id})">✏️</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarProcedimiento(${proc.id})">🗑️</button>
            </div>
          </div>`;
        }).join('')
      }
    </div>
    <div class="card" style="margin-top:20px">
      <div class="card-header">
        <h3>🦷 Odontogramas</h3>
        <div style="font-size:12px;color:var(--text-light)">Acceso rápido al odontograma de cualquier paciente</div>
      </div>
      <div style="padding:12px 16px 4px">
        <input id="odo-search-input" type="text" placeholder="Buscar paciente por nombre..." style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);color:var(--text);font-size:13px;box-sizing:border-box" oninput="_renderOdoSearchResults()" />
      </div>
      <div id="odo-search-results">${_buildOdoSearchRows('')}</div>
    </div>`;
}

function _buildOdoSearchRows(q) {
  const term = (q||'').toLowerCase().trim();
  let pacs = [...C.p].sort((a,b) => b.id - a.id);
  if(term) pacs = pacs.filter(p => (p.nombre+' '+p.apellidos).toLowerCase().includes(term));
  pacs = pacs.slice(0, 10);
  if(!pacs.length) return '<div class="empty-state" style="padding:20px"><div class="empty-icon">🔍</div><p>Sin pacientes encontrados</p></div>';
  return pacs.map(pac => {
    const edad = _getEdadNum(pac.fechaNac);
    const esInfantil = edad !== null && edad <= 15;
    const tipoTag = esInfantil
      ? '<span style="background:#fef3c7;color:#92400e;border:1px solid #fbbf24;border-radius:10px;font-size:10px;font-weight:700;padding:2px 7px">Infantil</span>'
      : '<span style="background:#dbeafe;color:#1e40af;border:1px solid #93c5fd;border-radius:10px;font-size:10px;font-weight:700;padding:2px 7px">Adulto</span>';
    return `<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border)">
      <div style="width:34px;height:34px;border-radius:8px;background:${colAvatar(pac.id)};display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:13px;flex-shrink:0">${ini(pac.nombre,pac.apellidos)}</div>
      <div style="flex:1;min-width:0">
        <div style="font-weight:600;font-size:13px">${pac.nombre} ${pac.apellidos}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">${edad!=null?edad+' años':'—'} &nbsp;${tipoTag}</div>
      </div>
      <button class="btn btn-sm" style="background:linear-gradient(135deg,#0891b2,#0e7490);color:#fff;font-size:11px;white-space:nowrap;flex-shrink:0" onclick="abrirModalOdontograma(${pac.id})">🦷 Ver odontograma</button>
    </div>`;
  }).join('');
}
function _renderOdoSearchResults() {
  const q = document.getElementById('odo-search-input')?.value || '';
  const el = document.getElementById('odo-search-results');
  if(el) el.innerHTML = _buildOdoSearchRows(q);
}

function renderProcedimientosTab(pid) {
  const el = document.getElementById('tab-procedimientos-p');
  if(!el) return;
  const procs = (C.proc||[]).filter(p => p.pacienteId === pid).sort((a,b) => b.fecha.localeCompare(a.fecha));
  const ECOL = { pendiente:'tag-blue', iniciado:'tag-cyan', finalizado:'tag-green', cancelado:'tag-red' };
  const totalPres = procs.reduce((s,p) => s+(p.presupuesto||0), 0);

  const bycat = {};
  procs.forEach(p => {
    if(!bycat[p.categoria]) bycat[p.categoria] = [];
    bycat[p.categoria].push(p);
  });

  el.innerHTML = `<div class="card">
    <div class="card-header">
      <h3>📋 Plan de Tratamiento</h3>
      <div style="display:flex;gap:8px;align-items:center">
        ${totalPres>0?`<span style="font-size:13px;font-weight:700;color:var(--success)">$${totalPres.toLocaleString()}</span>`:''}
        <button class="btn btn-primary btn-sm" onclick="openModalProcedimiento(null,${pid})">+ Nuevo</button>
      </div>
    </div>
    ${!procs.length ? '<div class="empty-state"><div class="empty-icon">📋</div><p>Sin procedimientos en el plan</p></div>' :
      Object.entries(bycat).map(([cat, items]) => `
        <div style="margin-bottom:16px">
          <div style="font-size:11px;font-weight:700;color:var(--text-light);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid var(--border)">${cat}</div>
          ${items.map(proc => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:18px">🦷</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;font-size:13px">${proc.procedimiento}${proc.diente?` <span style="font-size:11px;color:var(--text-light);font-weight:400">— Diente ${proc.diente}</span>`:''}</div>
                ${proc.notas?`<div style="font-size:12px;color:var(--text-light);margin-top:2px">${proc.notas}</div>`:''}
                <div style="font-size:11px;color:var(--text-light);margin-top:2px">${formatFecha(proc.fecha)}</div>
              </div>
              ${proc.presupuesto!=null?`<span style="font-weight:700;font-size:13px;color:var(--success);white-space:nowrap">$${Number(proc.presupuesto).toLocaleString()}</span>`:''}
              <span class="tag ${ECOL[proc.estado]||'tag-blue'}" style="white-space:nowrap;flex-shrink:0">${proc.estado}</span>
              <div class="actions-cell" style="flex-shrink:0">
                <button class="btn btn-secondary btn-sm" onclick="openModalProcedimiento(${proc.id},${pid})">✏️</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarProcedimiento(${proc.id})">🗑️</button>
              </div>
            </div>`).join('')}
        </div>`).join('')
    }
  </div>`;
}

function _buildProcCatOptions(selectedCat) {
  return PROCEDIMIENTOS_DENTALES.map(c =>
    `<optgroup label="${c.cat}">${c.procs.map(p =>
      `<option value="${escAttr(p)}" data-cat="${escAttr(c.cat)}" ${p===selectedCat?'selected':''}>${p}</option>`
    ).join('')}</optgroup>`
  ).join('');
}

function _fillProcPacienteSelect(selectedId) {
  const sel = document.getElementById('proc-paciente');
  if(!sel) return;
  sel.innerHTML = '<option value="">Seleccionar paciente...</option>' +
    [...C.p].sort((a,b)=>(a.nombre+a.apellidos).localeCompare(b.nombre+b.apellidos))
    .map(p => `<option value="${p.id}" ${p.id===selectedId?'selected':''}>${p.nombre} ${p.apellidos}</option>`)
    .join('');
}

function openModalProcedimiento(id, pid) {
  editingProcId = id || null;
  document.getElementById('modal-proc-title').textContent = id ? '✏️ Editar Procedimiento' : '🦷 Nuevo Procedimiento';
  document.getElementById('proc-fecha').value = hoy();
  document.getElementById('proc-estado').value = 'pendiente';
  document.getElementById('proc-notas').value = '';
  document.getElementById('proc-presupuesto').value = '';
  document.getElementById('proc-diente').value = '';

  const procSel = document.getElementById('proc-procedimiento');
  procSel.innerHTML = '<option value="">Seleccionar procedimiento...</option>' + _buildProcCatOptions('');

  _fillProcPacienteSelect(pid || null);

  if(id) {
    const proc = C.proc.find(p => p.id === id);
    if(proc) {
      _fillProcPacienteSelect(proc.pacienteId);
      procSel.innerHTML = '<option value="">Seleccionar procedimiento...</option>' + _buildProcCatOptions(proc.procedimiento);
      document.getElementById('proc-fecha').value = proc.fecha;
      document.getElementById('proc-estado').value = proc.estado;
      document.getElementById('proc-notas').value = proc.notas || '';
      document.getElementById('proc-presupuesto').value = proc.presupuesto!=null ? proc.presupuesto : '';
      document.getElementById('proc-diente').value = proc.diente || '';
    }
  }
  openModalOverlay('modal-procedimiento');
}

async function guardarProcedimiento() {
  if(!currentClinicaId) { toast('Sin clínica asignada','error'); return; }
  const pacienteId = parseInt(document.getElementById('proc-paciente').value) || null;
  const procSel    = document.getElementById('proc-procedimiento');
  const procedimiento = procSel.value;
  const selectedOpt   = procSel.options[procSel.selectedIndex];
  const categoria     = selectedOpt?.dataset?.cat || '';
  const fecha  = document.getElementById('proc-fecha').value;
  const estado = document.getElementById('proc-estado').value;
  const notas      = document.getElementById('proc-notas').value.trim();
  const presupuesto= document.getElementById('proc-presupuesto').value ? Number(document.getElementById('proc-presupuesto').value) : null;
  const diente     = document.getElementById('proc-diente').value.trim()||null;
  if(!pacienteId || !procedimiento || !fecha) { toast('Completa paciente, procedimiento y fecha','error'); return; }
  setLoading(true);
  const obj = toProc({ pacienteId, procedimiento, categoria, fecha, estado, notas, presupuesto, diente });
  let err;
  if(editingProcId) {
    const r = await sb.from('procedimientos_odontologicos').update(obj).eq('id', editingProcId);
    err = r.error;
  } else {
    const r = await sb.from('procedimientos_odontologicos').insert([obj]);
    err = r.error;
  }
  setLoading(false);
  if(err) { toast('Error: ' + err.message, 'error'); return; }
  toast(editingProcId ? 'Procedimiento actualizado' : 'Procedimiento registrado ✅');
  closeModal('modal-procedimiento');
  await loadAll();
  renderView(currentView);
}

async function eliminarProcedimiento(id) {
  const ok = await customConfirm({ icon:'🗑️', title:'Eliminar procedimiento', msg:'¿Eliminar este procedimiento? Esta acción no se puede deshacer.', okText:'Eliminar', danger:true });
  if(!ok) return;
  setLoading(true);
  const { error } = await sb.from('procedimientos_odontologicos').delete().eq('id', id);
  setLoading(false);
  if(error) { toast('Error: ' + error.message, 'error'); return; }
  toast('Procedimiento eliminado');
  await loadAll();
  renderView(currentView);
}

// ════════════════════ PDF HELPERS ════════════════════
const PDF_CSS = `
.pdf-contacto{margin-top:18px;padding:7px 10px;border-top:1.5px solid #cbd5e1;border-bottom:1.5px solid #cbd5e1;
  text-align:center;font-size:10.5px;color:#334155;font-weight:600}
.rx-proxima{display:flex;justify-content:space-between;align-items:flex-end;gap:20px;margin-top:24px;
  font-size:11.5px;color:#334155;font-weight:700}
.rx-linea{display:inline-block;width:150px;border-bottom:1px solid #94a3b8;margin-left:4px}

@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap');
@page{size:auto;margin:10mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;color:#111827;background:#fff;font-size:13px;line-height:1.55}
.page{max-width:820px;margin:0 auto;padding:28px 32px 24px}
.pdf-header{display:flex;align-items:flex-start;gap:18px;padding-bottom:18px;border-bottom:3px solid #1D4ED8;margin-bottom:26px}
.pdf-logo{width:68px;height:68px;border-radius:14px;background:linear-gradient(135deg,#2563EB,#06B6D4);display:flex;align-items:center;justify-content:center;font-size:26px;flex-shrink:0;overflow:hidden}
.pdf-logo img{width:100%;height:100%;object-fit:contain;border-radius:14px}
.pdf-clinic-info{flex:1}
.pdf-clinic-info h1{font-size:21px;font-weight:900;color:#1D4ED8;line-height:1.1;margin-bottom:4px}
.pdf-clinic-info p{font-size:11px;color:#64748B;margin-top:1.5px}
.pdf-right{text-align:right;flex-shrink:0}
.pdf-right .pdf-date{font-size:14px;font-weight:800;color:#0F172A}
.pdf-right .pdf-sub{font-size:10px;color:#94A3B8;margin-top:3px}
.section-title{font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:1px;color:#1D4ED8;margin:22px 0 10px;padding-bottom:6px;border-bottom:1.5px solid #E2E8F0;display:flex;align-items:center;gap:6px}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:22px}
.kpi{border:1px solid #E2E8F0;border-radius:12px;padding:16px 12px;text-align:center;background:#FAFBFC;position:relative;overflow:hidden}
.kpi::before{content:'';position:absolute;top:0;left:0;right:0;height:3px}
.kpi.blue::before{background:#2563EB}.kpi.green::before{background:#10B981}
.kpi.orange::before{background:#F59E0B}.kpi.red::before{background:#EF4444}
.kpi-val{font-size:28px;font-weight:900;color:#0F172A;line-height:1}
.kpi-lbl{font-size:10px;color:#64748B;margin-top:5px;font-weight:600;text-transform:uppercase;letter-spacing:.4px}
table{width:100%;border-collapse:collapse;margin-bottom:18px}
thead tr{background:#1D4ED8}
thead th{padding:9px 14px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#fff}
thead th:first-child{border-radius:6px 0 0 6px}
thead th:last-child{border-radius:0 6px 6px 0}
tbody tr:nth-child(even){background:#F8FAFC}
td{padding:9px 14px;border-bottom:1px solid #E2E8F0;font-size:12px;color:#1E293B}
.tag{display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700}
.tag-green{background:#F0FDF4;color:#15803D}.tag-orange{background:#FFFBEB;color:#B45309}
.tag-cyan{background:#ECFEFF;color:#0E7490}.tag-red{background:#FEF2F2;color:#B91C1C}
.tag-gray{background:#F1F5F9;color:#475569}.tag-blue{background:#EFF6FF;color:#1D4ED8}
.bar-row{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.bar-lbl{min-width:140px;font-size:11px;font-weight:600;color:#475569;text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.bar-track{flex:1;background:#E2E8F0;border-radius:8px;height:24px;overflow:hidden}
.bar-fill{height:100%;background:linear-gradient(90deg,#1D4ED8,#06B6D4);border-radius:8px;display:flex;align-items:center;padding-left:10px;min-width:0;transition:width .4s}
.bar-fill span{color:#fff;font-size:11px;font-weight:700}
.bar-val{min-width:28px;font-size:13px;font-weight:800;color:#0F172A;text-align:right}
.sig-wrap{display:flex;justify-content:flex-end;margin:40px 0 18px}
.sig-box{text-align:center;min-width:230px}
.sig-line{border-top:1.5px solid #334155;margin-bottom:8px}
.sig-name{font-size:14px;font-weight:800;color:#0F172A}
.sig-role{font-size:11px;color:#64748B;margin-top:3px}
.pdf-footer{margin-top:28px;padding-top:12px;border-top:1.5px solid #E2E8F0;display:flex;justify-content:space-between;align-items:center;font-size:10px;color:#94A3B8}
.badge-tipo{display:inline-flex;align-items:center;gap:6px;padding:5px 16px;border-radius:20px;font-size:12px;font-weight:700;color:#fff;margin-bottom:16px}
.patient-box{display:flex;gap:14px;align-items:center;background:#F0F7FF;border:1px solid #BFDBFE;border-radius:12px;padding:14px 16px;margin-bottom:20px}
.patient-av{width:52px;height:52px;border-radius:50%;background:#1D4ED8;display:flex;align-items:center;justify-content:center;color:#fff;font-size:18px;font-weight:800;flex-shrink:0}
.patient-name{font-size:17px;font-weight:800;margin-bottom:4px;color:#0F172A}
.patient-meta{display:flex;flex-wrap:wrap;gap:10px;font-size:11px;color:#475569}
.note-box{border-left:4px solid #1D4ED8;border-radius:0 12px 12px 0;background:#F8FAFC;padding:18px 20px;margin-bottom:16px}
.note-title{font-size:16px;font-weight:800;color:#0F172A;margin-bottom:10px}
.note-body{white-space:pre-wrap;font-size:13px;line-height:1.85;color:#1E293B}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}.page{padding:20px 24px}}
`;

function pdfHeader(cfg) {
  return `<div class="pdf-header">
    <div class="pdf-logo">${cfg.logoUrl?`<img src="${cfg.logoUrl}" alt="logo">`:'🏥'}</div>
    <div class="pdf-clinic-info">
      <h1>${cfg.nombreClinica||'Lumea Med'}</h1>
      <p>${currentUser?.name||cfg.nombreDoctor||''}</p>
      ${especialidadFirma(cfg).split(/\r?\n/).filter(Boolean).map(l=>`<p>${l}</p>`).join('')}
      ${cfg.institucion?`<p>${cfg.institucion}</p>`:''}
      ${cfg.registro?`<p>Reg. Med. ${cfg.registro}</p>`:''}
    </div>
    <div class="pdf-right">
      <div class="pdf-date">${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</div>
      <div class="pdf-sub">${new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}</div>
    </div>
  </div>`;
}

function pdfFooter(cfg) {
  // Barra de contacto como en el talonario impreso; se omite lo que no esté configurado
  const contacto = [
    cfg.telefono  ? '&#128222; ' + cfg.telefono  : '',
    cfg.email     ? '&#9993; '   + cfg.email     : '',
    cfg.direccion ? '&#128205; ' + cfg.direccion : ''
  ].filter(Boolean).join(' &nbsp;|&nbsp; ');
  return `${contacto?`<div class="pdf-contacto">${contacto}</div>`:''}
  <div class="pdf-footer">
    <span><strong>${cfg.nombreClinica||'Lumea Med'}</strong>${cfg.notaPie?' · '+cfg.notaPie:''}</span>
    <span>Generado: ${new Date().toLocaleString('es-ES')}</span>
  </div>`;
}

function pdfAbrir(titulo, body, cfg) {
  const w = window.open('','_blank','width=900,height=1100');
  w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${titulo}</title>
    <style>${PDF_CSS}</style></head><body>
    <div class="page">${pdfHeader(cfg)}${body}${pdfFooter(cfg)}</div>
    <script>window.onload=function(){window.print()}<\/script>
    </body></html>`);
  w.document.close();
}

// ════════════════════ ESTADÍSTICAS ════════════════════
let estTab = 'dia';

function switchEstTab(tab) {
  estTab = tab;
  ['dia','semana','mes'].forEach(t => {
    document.getElementById('est-panel-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('tab-est-'+t).classList.toggle('active', t===tab);
  });
  if(tab==='dia') renderEstDia();
  if(tab==='semana') renderEstSemana();
  if(tab==='mes') renderEstMes();
}

function renderEstadisticas() {
  const d = document.getElementById('est-dia-fecha');
  if (!d.value) d.value = hoy();
  const s = document.getElementById('est-semana-fecha');
  if (!s.value) s.value = semanaISO(new Date());
  const m = document.getElementById('est-mes-fecha');
  if (!m.value) m.value = hoy().slice(0,7);
  renderEstDia();
}

function semanaISO(d) {
  const dt = new Date(d); dt.setHours(0,0,0,0);
  dt.setDate(dt.getDate() + 3 - (dt.getDay()+6)%7);
  const w = new Date(dt.getFullYear(),0,4);
  const wk = 1+Math.round(((dt-w)/86400000 - 3 + (w.getDay()+6)%7)/7);
  return `${dt.getFullYear()}-W${String(wk).padStart(2,'0')}`;
}

function estCards(total, atendidos, canceladas, pendientes) {
  const pct = total ? Math.round(atendidos/total*100) : 0;
  return `<div class="stats-grid" style="margin-bottom:18px">
    <div class="stat-card"><div class="stat-icon si-blue">📋</div><div class="stat-info"><h3>${total}</h3><p>Total citas</p></div></div>
    <div class="stat-card"><div class="stat-icon si-green">✅</div><div class="stat-info"><h3>${atendidos}</h3><p>Atendidos</p><span class="stat-trend ok">↑ ${pct}%</span></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">⏳</div><div class="stat-info"><h3>${pendientes}</h3><p>Pendientes</p></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#FEF2F2,#FEE2E2)">❌</div><div class="stat-info"><h3>${canceladas}</h3><p>Canceladas</p></div></div>
  </div>`;
}

function estBarras(datos, titulo) {
  if (!datos.length) return '';
  const max = Math.max(...datos.map(d=>d.v), 1);
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-header"><h3>${titulo}</h3></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      ${datos.map(d=>`
        <div style="display:flex;align-items:center;gap:12px">
          <div style="min-width:110px;font-size:12px;font-weight:600;color:var(--text-light);text-align:right">${d.k}</div>
          <div style="flex:1;background:var(--bg);border-radius:8px;height:28px;overflow:hidden">
            <div style="height:100%;width:${Math.round(d.v/max*100)}%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:8px;display:flex;align-items:center;padding-left:8px;transition:width .5s;min-width:${d.v?'28px':'0'}">
              ${d.v ? `<span style="color:#fff;font-size:11px;font-weight:700">${d.v}</span>` : ''}
            </div>
          </div>
          <div style="min-width:24px;font-size:13px;font-weight:800;color:var(--text)">${d.v}</div>
        </div>`).join('')}
    </div>
  </div>`;
}

function estTabla(citas, titulo) {
  if (!citas.length) return `<div class="card"><div class="card-header"><h3>${titulo}</h3></div><div class="empty-state"><div class="empty-icon">📋</div><p>Sin registros</p></div></div>`;
  return `<div class="card" style="margin-bottom:16px">
    <div class="card-header"><h3>${titulo}</h3></div>
    ${citas.map(c=>{
      const p=C.p.find(x=>x.id===c.pacienteId);
      return `<div style="display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:1px solid var(--border)">
        <div style="min-width:52px;text-align:center;background:var(--primary-light);color:var(--primary);border-radius:8px;padding:4px 6px;font-weight:800;font-size:12px;flex-shrink:0">${c.hora||'—'}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p?p.nombre+' '+p.apellidos:'—'}</div>
          ${c.fecha?`<div style="font-size:11px;color:var(--text-light)">${formatFecha(c.fecha)}</div>`:''}
        </div>
        <span class="tag tag-cyan" style="flex-shrink:0;white-space:nowrap">${c.tipo}</span>
        <span style="flex-shrink:0">${estadoTag(c.estado)}</span>
      </div>`;
    }).join('')}
  </div>`;
}

function renderEstDia() {
  const fecha = document.getElementById('est-dia-fecha').value || hoy();
  document.getElementById('est-dia-fecha').value = fecha;
  const citas = C.c.filter(c=>c.fecha===fecha);
  const atendidos = citas.filter(c=>c.estado==='completada');
  const canceladas = citas.filter(c=>c.estado==='cancelada');
  const pendientes = citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  const tipos = ['consulta','control','urgencia','cirugia','examen'].map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  document.getElementById('est-dia-stats').innerHTML =
    estCards(citas.length, atendidos.length, canceladas.length, pendientes.length) +
    (tipos.length ? estBarras(tipos, '📊 Por tipo de cita') : '') +
    estTabla(citas.sort((a,b)=>(a.hora||'').localeCompare(b.hora||'')), `📋 Detalle del ${formatFecha(fecha)}`);
}

function renderEstSemana() {
  const val = document.getElementById('est-semana-fecha').value;
  if (!val) return;
  const [yr, wk] = val.split('-W').map(Number);
  const simple = d => d.toISOString().split('T')[0];
  const lunes = new Date(yr, 0, 1 + (wk-1)*7);
  lunes.setDate(lunes.getDate() - (lunes.getDay()||7) + 1);
  const dias = Array.from({length:7}, (_,i)=>{ const d=new Date(lunes); d.setDate(d.getDate()+i); return simple(d); });
  const diasNom = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];
  const citas = C.c.filter(c=>dias.includes(c.fecha));
  const atendidos = citas.filter(c=>c.estado==='completada');
  const canceladas = citas.filter(c=>c.estado==='cancelada');
  const pendientes = citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  const porDia = dias.map((f,i)=>({k:diasNom[i], v:C.c.filter(c=>c.fecha===f&&c.estado==='completada').length}));
  const tipos = ['consulta','control','urgencia','cirugia','examen'].map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  document.getElementById('est-semana-stats').innerHTML =
    estCards(citas.length, atendidos.length, canceladas.length, pendientes.length) +
    estBarras(porDia, '📅 Atendidos por día') +
    (tipos.length ? estBarras(tipos,'📊 Por tipo') : '') +
    estTabla(citas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||'')), '📋 Detalle de la semana');
}

function renderEstMes() {
  const val = document.getElementById('est-mes-fecha').value;
  if (!val) return;
  const [yr, mo] = val.split('-').map(Number);
  const citas = C.c.filter(c=>c.fecha.startsWith(val));
  const atendidos = citas.filter(c=>c.estado==='completada');
  const canceladas = citas.filter(c=>c.estado==='cancelada');
  const pendientes = citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  // Agrupar por semana del mes
  const semanas = {};
  citas.filter(c=>c.estado==='completada').forEach(c=>{
    const d = new Date(c.fecha+'T12:00:00'), wk = Math.ceil(d.getDate()/7);
    const k = `Sem ${wk}`; semanas[k] = (semanas[k]||0)+1;
  });
  const porSemana = Object.entries(semanas).map(([k,v])=>({k,v}));
  const tipos = ['consulta','control','urgencia','cirugia','examen'].map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  // Top pacientes
  const freq = {};
  citas.forEach(c=>{ freq[c.pacienteId]=(freq[c.pacienteId]||0)+1; });
  const topP = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([id,v])=>{
    const p=C.p.find(x=>x.id==id); return {k:p?p.nombre+' '+p.apellidos:'#'+id, v};
  });
  document.getElementById('est-mes-stats').innerHTML =
    estCards(citas.length, atendidos.length, canceladas.length, pendientes.length) +
    (porSemana.length ? estBarras(porSemana,'📅 Atendidos por semana') : '') +
    (tipos.length ? estBarras(tipos,'📊 Por tipo de cita') : '') +
    (topP.length ? estBarras(topP,'👥 Pacientes frecuentes') : '') +
    estTabla(citas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||'')), '📋 Detalle del mes');
}

// ════════════════════ SUPER ADMIN ════════════════════
const SUPER_ADMIN_EMAIL = 'sebasgale65@gmail.com';
let adminClinicas = [];
let adminUsuarios = [];
let adminActividad = [];
let adminTab = 'clinicas';
let prodPeriodo = 'hoy';
let editingClinicaId = null;
let editingUsuarioId = null;
let currentDetalleClinicaId = null;
let detalleTab = 'info';

function isSuperAdmin() {
  if(!currentUser) return false;
  const SA = SUPER_ADMIN_EMAIL.toLowerCase();
  // Chequea todas las fuentes de email disponibles
  const fromProfile = (currentUser.email || '').trim().toLowerCase();
  const fromAuth    = (_authEmail || '').trim().toLowerCase();
  const emailMatch  = fromProfile === SA || fromAuth === SA;
  const rolMatch    = currentUser.key === 'superadmin';
  return emailMatch || rolMatch;
}
function isFarmaceutico() { return currentUser?.key === 'farmaceutico'; }
function isOdontologo()   { return currentUser?.key === 'odontologo'; }
function hasPermiso(perm) {
  if(isSuperAdmin()) return true;
  const p = currentUser?.permisos;
  // Si el administrador configuró los permisos (aunque sea una lista vacía) se
  // respetan exactamente. El defecto por rol solo aplica a usuarios antiguos
  // que nunca tuvieron permisos guardados.
  const base = Array.isArray(p) ? p : (PERMISOS_DEFECTO[currentUser?.key] || []);
  return base.includes(perm);
}

function toggleAdminMenu() { applyRoleMenu(); }

function applyRoleMenu() {
  const sa       = isSuperAdmin();
  const role     = currentUser?.key;
  const isAdmin  = role === 'admin';
  const isMed    = role === 'medico';
  const isMedAdm = role === 'medico_admin';
  const isRec    = role === 'recepcion';
  const isEnf    = role === 'enfermeria';
  const isFarm   = role === 'farmaceutico';
  const isOdonto = isOdontologo();
  const esFarmacia  = currentClinica?.tipo === 'farmacia';
  const modoFarmacia = isFarm || esFarmacia;

  const vis = (id, show) => {
    const el = document.getElementById(id);
    if(!el) return;
    el.style.display = show ? (el.classList.contains('menu-section') ? 'block' : 'flex') : 'none';
  };

  // ─ Expedientes: oculto en modo farmacia
  vis('menu-expedientes', !modoFarmacia);

  // ─ Módulo Farmacia
  vis('menu-farmacia', modoFarmacia || sa || hasPermiso('farmacia'));

  // ─ Sección Clínica y sus ítems (oculta en modo farmacia)
  const hasClinica = !modoFarmacia;
  vis('menu-clinica-section', hasClinica);
  vis('menu-pacientes',       hasClinica && hasPermiso('pacientes'));
  vis('menu-citas',             hasClinica && hasPermiso('citas'));
  vis('menu-agendas',          hasClinica && hasPermiso('agendas') && !isOdonto);
  vis('menu-medicaciones',     hasClinica && hasPermiso('medicaciones'));
  vis('menu-notas',            hasClinica && hasPermiso('notas'));
  vis('menu-atendidos',        hasClinica && hasPermiso('atendidos') && !isOdonto);
  vis('menu-procedimientos',   hasClinica && (isOdonto || sa));

  // ─ Sección Gestión
  // Sin atajos por tipo de clínica: el menú refleja exactamente los permisos
  // otorgados, igual que los guardas de navigate().
  const invAccess  = hasPermiso('inventario');
  const finAccess  = hasPermiso('finanzas');
  const expAccess  = hasPermiso('exportar');
  const statAccess = hasPermiso('estadisticas');
  const hasGestion = invAccess || finAccess || expAccess || statAccess;
  vis('menu-gestion-section', hasGestion);
  vis('menu-inventario',      invAccess);
  vis('menu-finanzas',        finAccess);
  vis('menu-estadisticas',    statAccess);
  vis('menu-exportar',        expAccess);

  // ─ Admin: solo superadmin
  vis('menu-admin-section',  sa);
  vis('menu-admin',          sa);
  vis('menu-configuracion',  sa);

  // ─ Botón importar catálogo MINSA: quien tenga acceso a inventario o estadísticas
  const btnMinsa = document.getElementById('btn-importar-minsa');
  if(btnMinsa) btnMinsa.style.display = (sa || invAccess || statAccess) ? '' : 'none';
}

async function loadAdminData() {
  setLoading(true);
  const [rc, ru, ra] = await Promise.all([
    sb.from('clinicas').select('*').order('id'),
    sb.from('profiles').select('*').order('nombre'),
    sb.from('actividad_usuarios').select('*').order('created_at', {ascending:false}).limit(2000)
  ]);
  adminClinicas = rc.data || [];
  adminUsuarios = ru.data || [];
  adminActividad = ra.data || [];
  setLoading(false);
}

function switchAdminTab(tab) {
  adminTab = tab;
  ['clinicas','usuarios','productividad','global'].forEach(t => {
    const panel = document.getElementById('admin-panel-'+t);
    const tabEl = document.getElementById('tab-admin-'+t);
    if(panel) panel.style.display = t===tab ? 'block' : 'none';
    if(tabEl) tabEl.classList.toggle('active', t===tab);
  });
  const btn = document.getElementById('btn-admin-add');
  const noAdd = ['productividad','global'].includes(tab);
  if(btn) btn.style.display = noAdd ? 'none' : 'inline-flex';
  if(btn && !noAdd) btn.textContent = tab==='clinicas' ? '+ Nueva Clínica' : '+ Nuevo Usuario';
  if(tab==='clinicas')     renderAdminClinicas();
  if(tab==='usuarios')     renderAdminUsuarios();
  if(tab==='productividad') renderProductividad();
  if(tab==='global')       renderAdminGlobal();
  renderAdminStats();
}

function adminAddNew() {
  if(adminTab==='clinicas') openModalClinica();
  else openModalUsuario();
}

function renderAdminStats() {
  const el = document.getElementById('admin-stats-row');
  if(!el) return;
  const activas = adminClinicas.filter(c=>c.activa).length;
  el.innerHTML = `
    <div class="admin-stat"><div class="admin-stat-icon">🏥</div><div><div class="admin-stat-val">${adminClinicas.length}</div><div class="admin-stat-label">Clínicas totales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">✅</div><div><div class="admin-stat-val">${activas}</div><div class="admin-stat-label">Clínicas activas</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👥</div><div><div class="admin-stat-val">${adminUsuarios.length}</div><div class="admin-stat-label">Usuarios registrados</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👑</div><div><div class="admin-stat-val">1</div><div class="admin-stat-label">Super Admin</div></div></div>`;
}

function renderAdminClinicas() {
  const el = document.getElementById('admin-clinicas-list');
  if(!el) return;
  if(!adminClinicas.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">🏥</div><p>No hay clínicas registradas.<br>Crea la primera con <strong>+ Nueva Clínica</strong></p></div>`;
    return;
  }
  el.innerHTML = adminClinicas.map(c => {
    const cnt    = adminUsuarios.filter(u=>u.clinica_id===c.id).length;
    const isProd = c.en_produccion === true;
    return `<div class="admin-item-card${isProd?' prod-row-highlight':''}">
      <div class="admin-item-card-top">
        <div class="admin-item-card-name">
          ${isProd?'<span style="color:#7c3aed;margin-right:4px">★</span>':''}${c.nombre}
        </div>
        <div style="display:flex;gap:6px;align-items:center;flex-shrink:0;flex-wrap:wrap">
          ${c.activa?'<span class="tag tag-green">Activa</span>':'<span class="tag tag-red">Inactiva</span>'}
          ${isProd?'<span class="tag-purple">Producción</span>':''}
        </div>
      </div>
      <div class="admin-item-card-meta">
        <span>🔑 Código: <code style="background:var(--card);padding:1px 6px;border-radius:5px;font-size:11px">${c.codigo}</code></span>
        <span>👥 ${cnt} usuario${cnt!==1?'s':''}</span>
        <span style="color:var(--text-light);font-size:11px">#${c.id}</span>
      </div>
      <div class="admin-item-card-actions">
        <button class="btn btn-sm btn-primary" data-cid="${c.id}" onclick="verDetalleClinica(Number(this.dataset.cid))">🔍 Ver detalle</button>
        <button class="btn btn-sm btn-secondary" data-cid="${c.id}" onclick="openModalClinicaEdit(Number(this.dataset.cid))">✏️ Editar</button>
        <button class="btn btn-sm btn-danger" data-cid="${c.id}" onclick="eliminarClinica(Number(this.dataset.cid))">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function renderAdminUsuarios() {
  const el = document.getElementById('admin-usuarios-list');
  if(!el) return;
  const rolLabel = r => ({admin:'Administración',medico:'Médico',medico_admin:'Médico Adm.',dr:'Dr.',dra:'Dra.',recepcion:'Recepcionista',enfermeria:'Enfermería',superadmin:'Super Admin',farmaceutico:'Farmacéutico'}[r]||r);
  const rolTag   = r => ({admin:'tag-blue',medico:'tag-cyan',medico_admin:'tag-cyan',dr:'tag-cyan',dra:'tag-cyan',recepcion:'tag-orange',enfermeria:'tag-green',farmaceutico:'tag-emerald'}[r]||'tag-gray');
  if(!adminUsuarios.length) {
    el.innerHTML = `<div class="empty-state"><div class="empty-icon">👥</div><p>No hay usuarios registrados.<br>Crea el primero con <strong>+ Nuevo Usuario</strong></p></div>`;
    return;
  }
  el.innerHTML = adminUsuarios.map(u => {
    const clinica = adminClinicas.find(c=>c.id===u.clinica_id);
    const perms = Array.isArray(u.permisos) ? u.permisos : (PERMISOS_DEFECTO[u.rol] || []);
    const permIcons = perms.map(id => {
      const p = ALL_PERMISOS.find(x=>x.id===id);
      return p ? `<span title="${p.label}" style="font-size:15px">${p.icon}</span>` : '';
    }).join('');
    const permSrc = Array.isArray(u.permisos)
      ? (u.permisos.length ? '' : '<span style="font-size:10px;color:var(--text-light);margin-left:4px">Sin permisos asignados</span>')
      : '<span style="font-size:10px;color:var(--text-light);margin-left:4px">(por rol)</span>';
    const esBloqueado = u.bloqueado === true;
    const intentos = u.intentos_fallidos || 0;
    return `<div class="admin-item-card${esBloqueado?' admin-item-card-blocked':''}">
      <div class="admin-item-card-top">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          <div class="patient-avatar" style="background:${esBloqueado?'linear-gradient(135deg,#ef4444,#b91c1c)':'linear-gradient(135deg,var(--primary),var(--accent))'};font-size:18px;width:36px;height:36px;flex-shrink:0">${esBloqueado?'🔒':u.icono||'👤'}</div>
          <div style="flex:1;min-width:0">
            <div class="admin-item-card-name">${u.nombre}</div>
            <div style="font-size:11px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.email||'Sin email'}</div>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0">
          <span class="tag ${rolTag(u.rol)}">${rolLabel(u.rol)}</span>
          ${esBloqueado?`<span class="tag tag-red" style="font-size:10px">🔒 Bloqueado</span>`:''}
          ${!esBloqueado&&intentos>0?`<span class="tag tag-orange" style="font-size:10px">⚠️ ${intentos}/3 intentos</span>`:''}
        </div>
      </div>
      <div class="admin-item-card-meta">
        <span>🏥 ${clinica?clinica.nombre:'Sin clínica asignada'}</span>
        ${u.especialidad?`<span>🩺 ${u.especialidad}</span>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;padding:6px 0 2px;border-top:1px solid var(--border);margin-top:6px">
        ${permIcons}${permSrc}
      </div>
      <div class="admin-item-card-actions">
        ${esBloqueado
          ? `<button class="btn btn-sm" style="background:var(--success);color:#fff" data-uid="${u.id}" onclick="desbloquearUsuario(this.dataset.uid)">🔓 Desbloquear</button>`
          : `<button class="btn btn-sm btn-secondary" data-uid="${u.id}" onclick="openModalUsuarioEditById(this.dataset.uid)">✏️ Editar</button>`
        }
        <button class="btn btn-sm btn-secondary" data-uid="${u.id}" data-nombre="${u.nombre}" onclick="restablecerPasswordAdmin(this.dataset.uid,this.dataset.nombre)">🔑 Contraseña</button>
        <button class="btn btn-sm btn-danger" data-uid="${u.id}" onclick="eliminarUsuario(this.dataset.uid)">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

// ── Productividad ──
function setProdPeriodo(p, el) {
  prodPeriodo = p;
  document.querySelectorAll('[id^="prod-chip-"]').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderProductividad();
}

function prodFechaRango() {
  const now = new Date(), h = hoy();
  if(prodPeriodo === 'hoy') return [h, h];
  if(prodPeriodo === 'semana') {
    const lunes = new Date(now); lunes.setDate(now.getDate()-(now.getDay()||7)+1); lunes.setHours(0,0,0,0);
    return [lunes.toISOString().split('T')[0], h];
  }
  return [h.slice(0,7)+'-01', h];
}

function renderProductividad() {
  const [desde, hasta] = prodFechaRango();
  const acts = adminActividad.filter(a => a.fecha >= desde && a.fecha <= hasta);

  // Resumen global
  const logins  = acts.filter(a=>a.accion==='login').length;
  const acciones = acts.filter(a=>a.accion!=='login').length;
  const usuariosActivos = new Set(acts.map(a=>a.user_id)).size;
  const resEl = document.getElementById('prod-resumen-row');
  if(resEl) resEl.innerHTML=`
    <div class="stat-card"><div class="stat-icon si-blue">👤</div><div class="stat-info"><h3>${usuariosActivos}</h3><p>Usuarios activos</p></div></div>
    <div class="stat-card"><div class="stat-icon si-green">🔑</div><div class="stat-info"><h3>${logins}</h3><p>Inicios de sesión</p></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">⚡</div><div class="stat-info"><h3>${acciones}</h3><p>Acciones registradas</p></div></div>
    <div class="stat-card"><div class="stat-icon" style="background:linear-gradient(135deg,#EEF2FF,#E0E7FF)">📊</div><div class="stat-info"><h3>${acts.length}</h3><p>Total eventos</p></div></div>`;

  // Por usuario
  const listEl = document.getElementById('prod-usuarios-list');
  if(!listEl) return;
  const porUsuario = {};
  acts.forEach(a => {
    if(!porUsuario[a.user_id]) porUsuario[a.user_id] = {nombre:a.user_nombre, login:0, cita:0, paciente:0, nota:0, medicacion:0, otros:0};
    const u = porUsuario[a.user_id];
    if(a.accion in u) u[a.accion]++; else u.otros++;
  });
  const usuarios = Object.entries(porUsuario).sort((a,b)=>{
    const ta = Object.values(a[1]).slice(1).reduce((s,v)=>s+v,0);
    const tb = Object.values(b[1]).slice(1).reduce((s,v)=>s+v,0);
    return tb-ta;
  });

  if(!usuarios.length){
    listEl.innerHTML=`<div class="empty-state"><div class="empty-icon">📊</div><p>Sin actividad registrada en este período</p></div>`;
    renderTimeline(desde);
    return;
  }

  const maxScore = Math.max(...usuarios.map(([,u])=>u.cita+u.paciente+u.nota+u.medicacion+u.otros),1);
  listEl.innerHTML = usuarios.map(([uid,u])=>{
    const prof = adminUsuarios.find(p=>p.id===uid);
    const clinica = adminClinicas.find(c=>c.id===prof?.clinica_id);
    const score = u.cita+u.paciente+u.nota+u.medicacion+u.otros;
    const pct = Math.round(score/maxScore*100);
    const nivel = score===0?['tag-gray','Inactivo']:score<5?['tag-orange','Bajo']:score<15?['tag-cyan','Activo']:['tag-green','Muy activo'];
    const mini = (lbl,val)=>`<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:var(--text-light);background:var(--bg);border-radius:8px;padding:3px 8px;white-space:nowrap">${lbl} <strong style="color:var(--text)">${val}</strong></span>`;
    return `<div style="padding:12px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-wrap:wrap">
        <div class="patient-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent));font-size:16px;flex-shrink:0">${prof?.icono||'👤'}</div>
        <div style="flex:1;min-width:0">
          <strong style="font-size:13px">${u.nombre}</strong>
          <div style="font-size:11px;color:var(--text-light);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${prof?.email||''}${clinica?` · ${clinica.nombre}`:''}</div>
        </div>
        <span class="tag ${nivel[0]}" style="flex-shrink:0">${nivel[1]}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px">
        ${mini('🔑 Logins',u.login)}${mini('📆 Citas',u.cita)}${mini('👥 Pacientes',u.paciente)}${mini('📝 Notas',u.nota)}${mini('💊 Medicaciones',u.medicacion)}
      </div>
      <div style="background:var(--bg);border-radius:6px;height:14px;overflow:hidden">
        <div style="width:${pct}%;height:100%;background:linear-gradient(90deg,var(--primary),var(--accent));border-radius:6px"></div>
      </div>
    </div>`;
  }).join('');

  renderTimeline(desde);
}

function renderTimeline(desde) {
  const el = document.getElementById('prod-timeline'); if(!el) return;
  const diasNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const dias = Array.from({length:7},(_,i)=>{
    const d = new Date(); d.setDate(d.getDate()-6+i); return d.toISOString().split('T')[0];
  });
  const porDia = dias.map(f=>({
    f, nom:diasNom[new Date(f+'T12:00:00').getDay()],
    login: adminActividad.filter(a=>a.fecha===f&&a.accion==='login').length,
    total: adminActividad.filter(a=>a.fecha===f).length
  }));
  const maxT = Math.max(...porDia.map(d=>d.total),1);
  el.innerHTML = `<div style="display:flex;gap:8px;align-items:flex-end;height:120px;padding:0 4px">
    ${porDia.map(d=>`
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
        <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;width:100%">
          <div title="${d.total} eventos" style="width:100%;background:linear-gradient(to top,var(--primary),var(--accent));border-radius:6px 6px 0 0;height:${Math.max(d.total?Math.round(d.total/maxT*90):0,0)}%;min-height:${d.total?'4px':'0'};transition:height .4s;position:relative">
            ${d.total?`<div style="position:absolute;top:-18px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:var(--primary)">${d.total}</div>`:''}
          </div>
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--text-light);text-transform:uppercase">${d.nom}</div>
        <div style="font-size:9px;color:var(--text-light)">${d.f.slice(5)}</div>
      </div>`).join('')}
  </div>
  <div style="display:flex;gap:14px;margin-top:10px;font-size:11px;color:var(--text-light)">
    <span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:2px;background:linear-gradient(135deg,var(--primary),var(--accent));display:inline-block"></span>Total eventos por día</span>
  </div>`;
}

// ── Examen Visual (Óptica) ──
function abrirExamenVisual(pacienteId) {
  document.getElementById('ev-paciente-id').value = pacienteId;
  const campos = ['lm-esf-od','lm-cil-od','lm-eje-od','lm-add-od',
    'lm-esf-oi','lm-cil-oi','lm-eje-oi','lm-add-oi',
    'av-sc-od','av-sc-oi','av-sc-ao','ae-od','ae-oi','ev-cover-obs',
    'ev-moe-obs','ev-ppc','ev-ppa','ev-acomo-obs',
    'rx-esf-od','rx-cil-od','rx-eje-od','rx-add-od',
    'rx-esf-oi','rx-cil-oi','rx-eje-oi','rx-add-oi',
    'pa-dip','pa-dip-od','pa-dip-oi','pa-altura','pa-vertice',
    'pa-pantoscopico','pa-panoramico','pa-horizontal','pa-vertical','pa-diagonal','pa-puente','pa-obs',
    'av-cc-od','av-cc-oi','av-cc-ao','av-cc-obs',
    'ev-rp-obs','ev-bm-obs-od','ev-bm-obs-oi','ev-fo-obs','ev-recomendaciones'];
  campos.forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['ev-cover','ev-rp-od','ev-rp-oi','ev-bm-od','ev-bm-oi','ev-fo-od','ev-fo-oi','ev-material'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['tr-blueray','tr-fotocrom','tr-antireflejo','tr-amarillo','tr-polarizado'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.checked=false;
  });
  document.getElementById('ev-correccion').value = 'Ninguna por ahora';
  document.getElementById('modal-examen-visual').classList.add('open');
}

async function guardarExamenVisual() {
  const pid = document.getElementById('ev-paciente-id').value;
  if(!pid){ toast('Error: paciente no encontrado','error'); return; }
  const g = id => (document.getElementById(id)?.value||'').trim();
  const fila = (lbl,val) => val ? `  ${lbl.padEnd(12)}: ${val}` : '';

  const contenido = [
    '╔══════════════════════════════════════╗',
    '║        EXAMEN VISUAL COMPLETO        ║',
    '╚══════════════════════════════════════╝',
    '',
    '▸ LENSOMETRÍA (anteojos actuales)',
    fila('OD Esfera', g('lm-esf-od')), fila('OD Cilindro', g('lm-cil-od')),
    fila('OD Eje', g('lm-eje-od')?g('lm-eje-od')+'°':''), fila('OD Adición', g('lm-add-od')),
    fila('OI Esfera', g('lm-esf-oi')), fila('OI Cilindro', g('lm-cil-oi')),
    fila('OI Eje', g('lm-eje-oi')?g('lm-eje-oi')+'°':''), fila('OI Adición', g('lm-add-oi')),
    '',
    '▸ AGUDEZA VISUAL SIN CORRECCIÓN',
    fila('OD', g('av-sc-od')||'—'), fila('OI', g('av-sc-oi')||'—'), fila('AO', g('av-sc-ao')),
    g('ae-od')||g('ae-oi') ? `  Agujero estenopeico — OD: ${g('ae-od')||'—'}  OI: ${g('ae-oi')||'—'}` : '',
    '',
    '▸ COVER TEST',
    fila('Resultado', g('ev-cover')||'—'),
    fila('Observación', g('ev-cover-obs')),
    '',
    '▸ MOTILIDAD OCULAR EXTRÍNSECA',
    fila('Observaciones', g('ev-moe-obs')||'—'),
    '',
    '▸ EXAMINACIÓN DE ACOMODACIÓN',
    fila('PPC', g('ev-ppc')||'—'), fila('PPA', g('ev-ppa')||'—'),
    fila('Observaciones', g('ev-acomo-obs')),
    '',
    '▸ REFRACCIÓN',
    fila('OD Esfera', g('rx-esf-od')), fila('OD Cilindro', g('rx-cil-od')),
    fila('OD Eje', g('rx-eje-od')?g('rx-eje-od')+'°':''), fila('OD Adición', g('rx-add-od')),
    fila('OI Esfera', g('rx-esf-oi')), fila('OI Cilindro', g('rx-cil-oi')),
    fila('OI Eje', g('rx-eje-oi')?g('rx-eje-oi')+'°':''), fila('OI Adición', g('rx-add-oi')),
    '',
    '▸ PARÁMETROS DE ADAPTACIÓN',
    fila('DIP General', g('pa-dip')?g('pa-dip')+' mm':'—'),
    fila('DIP OD', g('pa-dip-od')?g('pa-dip-od')+' mm':'—'),
    fila('DIP OI', g('pa-dip-oi')?g('pa-dip-oi')+' mm':'—'),
    fila('Altura pupilar', g('pa-altura')?g('pa-altura')+' mm':'—'),
    fila('Dist. al vértice', g('pa-vertice')?g('pa-vertice')+' mm':'—'),
    fila('Áng. pantoscópico', g('pa-pantoscopico')||'—'),
    fila('Áng. panorámico', g('pa-panoramico')||'—'),
    fila('Dist. horizontal', g('pa-horizontal')||'—'),
    fila('Dist. vertical', g('pa-vertical')||'—'),
    fila('Dist. diagonal', g('pa-diagonal')||'—'),
    fila('Puente', g('pa-puente')?g('pa-puente')+' mm':'—'),
    fila('Observaciones', g('pa-obs')),
    '',
    '▸ AGUDEZA VISUAL CON CORRECCIÓN',
    fila('OD', g('av-cc-od')||'—'), fila('OI', g('av-cc-oi')||'—'), fila('AO', g('av-cc-ao')),
    fila('Observaciones', g('av-cc-obs')),
    '',
    '▸ REFLEJOS PUPILARES',
    fila('OD', g('ev-rp-od')||'—'), fila('OI', g('ev-rp-oi')||'—'),
    fila('Observaciones', g('ev-rp-obs')),
    '',
    '▸ BIOMICROSCOPÍA',
    fila('OD', g('ev-bm-od')||'—'), fila('  Obs. OD', g('ev-bm-obs-od')),
    fila('OI', g('ev-bm-oi')||'—'), fila('  Obs. OI', g('ev-bm-obs-oi')),
    '',
    '▸ FONDO DE OJO',
    fila('OD', g('ev-fo-od')||'—'), fila('OI', g('ev-fo-oi')||'—'),
    fila('Observaciones', g('ev-fo-obs')),
    '',
    `▸ SERVICIOS VISUALES\n  ${g('ev-correccion')}`,
    g('ev-material') ? fila('  Material', g('ev-material')) : '',
    (()=>{ const tr=[]; if(document.getElementById('tr-blueray')?.checked) tr.push('Blue Ray'); if(document.getElementById('tr-fotocrom')?.checked) tr.push('Fotocromático'); if(document.getElementById('tr-antireflejo')?.checked) tr.push('Antirreflejo'); if(document.getElementById('tr-amarillo')?.checked) tr.push('Filtro Amarillo'); if(document.getElementById('tr-polarizado')?.checked) tr.push('Polarizado'); return tr.length ? fila('  Tratamientos', tr.join(', ')) : ''; })(),
    g('ev-recomendaciones') ? `\n▸ OBSERVACIONES\n  ${g('ev-recomendaciones')}` : '',
  ].filter(l => l !== '').join('\n');

  setLoading(true);
  const {error} = await sb.from('notas').insert([toN({
    pacienteId: Number(pid), tipo:'examen_visual',
    fecha: hoy(), titulo:`Examen Visual — ${formatFecha(hoy())}`, contenido
  })]);
  setLoading(false);
  if(error){ toast('Error al guardar: '+error.message,'error'); return; }
  toast('Examen visual guardado ✅','success');
  closeModal('modal-examen-visual');
  await loadAll();
  if(currentView==='paciente-detalle') renderDetalleP(currentPatientId);
  logActivity('nota');
}

// ── logActivity ──
async function logActivity(accion) {
  if(!currentUser||!currentClinicaId) return;
  sb.from('actividad_usuarios').insert({
    clinica_id: currentClinicaId,
    user_id: currentUser.id || currentUser.email,
    user_nombre: currentUser.name,
    accion,
    fecha: hoy()
  });
}

// ── Modal Clínica ──
function setAdminLogoPreview(src) {
  const box = document.getElementById('cl-logo-preview');
  const btn = document.getElementById('cl-logo-remove');
  if(src) {
    box.innerHTML = `<img src="${src}" style="width:100%;height:100%;object-fit:contain;border-radius:12px" alt="logo">`;
    if(btn) btn.style.display = 'inline-flex';
  } else {
    box.innerHTML = '🏥';
    if(btn) btn.style.display = 'none';
    document.getElementById('cl-logo-url').value = '';
  }
}

function onAdminLogoSelected(input) {
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('cl-logo-url').value = e.target.result;
    setAdminLogoPreview(e.target.result);
  };
  reader.readAsDataURL(file);
  input.value = '';
}

function removeAdminLogo() {
  setAdminLogoPreview(null);
}

function openModalClinica() {
  document.getElementById('modal-clinica-title').textContent = '🏥 Nueva Clínica';
  ['cl-nombre','cl-codigo','cl-logo-url','cl-nombre-doctor','cl-especialidad','cl-registro','cl-telefono','cl-direccion','cl-nota-pie','cl-padecimientos','cl-institucion'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('cl-tipo').value = 'clinica';
  document.getElementById('cl-activa').value = 'true';
  document.getElementById('cl-max-agendas').value = '10';
  document.getElementById('cl-max-pacientes').value = '500';
  setAdminLogoPreview(null);
  editingClinicaId = null;
  document.getElementById('modal-clinica').classList.add('open');
}

function openModalClinicaEdit(id) {
  const c = adminClinicas.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('modal-clinica-title').textContent = '✏️ Editar Clínica';
  document.getElementById('cl-nombre').value = c.nombre || '';
  document.getElementById('cl-codigo').value = c.codigo || '';
  document.getElementById('cl-tipo').value = c.tipo || 'clinica';
  document.getElementById('cl-activa').value = String(c.activa);
  document.getElementById('cl-max-agendas').value = c.max_agendas ?? 10;
  document.getElementById('cl-max-pacientes').value = c.max_pacientes ?? 500;
  document.getElementById('cl-logo-url').value = c.logo_url || '';
  document.getElementById('cl-nombre-doctor').value = c.nombre_doctor || '';
  document.getElementById('cl-especialidad').value = c.especialidad || '';
  document.getElementById('cl-registro').value = c.registro || '';
  document.getElementById('cl-telefono').value = c.telefono || '';
  document.getElementById('cl-direccion').value = c.direccion || '';
  document.getElementById('cl-nota-pie').value = c.nota_pie || '';
  const clPad = document.getElementById('cl-padecimientos');
  if(clPad) clPad.value = c.padecimientos || '';
  const clInst = document.getElementById('cl-institucion');
  if(clInst) clInst.value = c.institucion || '';
  setAdminLogoPreview(c.logo_url || null);
  editingClinicaId = id;
  document.getElementById('modal-clinica').classList.add('open');
}

async function guardarClinica() {
  const nombre = document.getElementById('cl-nombre').value.trim();
  const codigo = document.getElementById('cl-codigo').value.trim();
  const tipo   = document.getElementById('cl-tipo').value;
  const activa = document.getElementById('cl-activa').value === 'true';
  const max_agendas  = parseInt(document.getElementById('cl-max-agendas').value) || 10;
  const max_pacientes = parseInt(document.getElementById('cl-max-pacientes').value) || 500;
  const logo_url      = document.getElementById('cl-logo-url').value.trim() || null;
  const nombre_doctor = document.getElementById('cl-nombre-doctor').value.trim() || null;
  const especialidad  = document.getElementById('cl-especialidad').value.trim() || null;
  const registro      = document.getElementById('cl-registro').value.trim() || null;
  const telefono      = document.getElementById('cl-telefono').value.trim() || null;
  const direccion     = document.getElementById('cl-direccion').value.trim() || null;
  const nota_pie      = document.getElementById('cl-nota-pie').value.trim() || null;
  const padecimientos = document.getElementById('cl-padecimientos')?.value.trim() || null;
  const institucion   = document.getElementById('cl-institucion')?.value.trim() || null;
  if(!nombre||!codigo){ toast('Nombre y código son obligatorios','error'); return; }
  setLoading(true);
  const payload = {nombre,codigo,tipo,activa,max_agendas,max_pacientes,logo_url,nombre_doctor,especialidad,registro,telefono,direccion,nota_pie,padecimientos,institucion};
  if(editingClinicaId) {
    const {error} = await sb.from('clinicas').update(payload).eq('id',editingClinicaId);
    if(error){ toast('Error al actualizar: '+error.message,'error'); setLoading(false); return; }
    if(editingClinicaId === currentClinicaId) {
      const {data} = await sb.from('clinicas').select('*').eq('id',currentClinicaId).single();
      if(data) currentClinica = data;
    }
    toast('Clínica actualizada','success');
  } else {
    const {error} = await sb.from('clinicas').insert(payload);
    if(error){ toast('Error al crear: '+error.message,'error'); setLoading(false); return; }
    toast('Clínica creada exitosamente','success');
  }
  closeModal('modal-clinica');
  await loadAdminData();
  renderAdminClinicas();
  renderAdminStats();
  setLoading(false);
}

async function eliminarClinica(id) {
  const c = adminClinicas.find(x=>x.id===id);
  const cnt = adminUsuarios.filter(u=>u.clinica_id===id).length;
  const ok = await customConfirm({
    icon:'🗑️', title:'Eliminar clínica',
    msg: cnt > 0
      ? `La clínica <strong>${c?.nombre}</strong> tiene <strong>${cnt} usuario(s)</strong>.<br><br>Se borrarán <strong>TODOS</strong> sus datos: pacientes, citas, inventario y usuarios.`
      : `¿Eliminar la clínica <strong>${c?.nombre}</strong>?<br><br>Se borrarán <strong>TODOS</strong> sus datos y no se puede deshacer.`,
    okText:'Eliminar clínica', danger:true
  });
  if(!ok) return;
  setLoading(true);
  // Borrar datos relacionados en orden para evitar violaciones de FK
  await sb.from('inventario_movimientos').delete().eq('clinica_id', id);
  await sb.from('inventario').delete().eq('clinica_id', id);
  await sb.from('notas').delete().eq('clinica_id', id);
  await sb.from('medicaciones').delete().eq('clinica_id', id);
  await sb.from('expediente').delete().eq('clinica_id', id);
  await sb.from('citas').delete().eq('clinica_id', id);
  await sb.from('pacientes').delete().eq('clinica_id', id);
  await sb.from('profiles').update({clinica_id: null}).eq('clinica_id', id);
  const {error} = await sb.from('clinicas').delete().eq('id',id);
  if(error){ toast('Error al eliminar: '+error.message,'error'); setLoading(false); return; }
  toast('Clínica eliminada','success');
  await loadAdminData();
  renderAdminClinicas();
  renderAdminStats();
  setLoading(false);
}

// ── Ver Detalle Clínica ──
async function verDetalleClinica(id) {
  const c = adminClinicas.find(x=>x.id===id);
  if(!c) return;
  currentDetalleClinicaId = id;
  detalleTab = 'info';

  // Header
  document.getElementById('detalle-clinica-nombre').textContent = c.nombre;
  document.getElementById('detalle-clinica-codigo').textContent = c.codigo;

  const logoBox = document.getElementById('detalle-clinica-logo-box');
  if(c.logo_url) {
    logoBox.innerHTML = `<img src="${c.logo_url}" alt="Logo">`;
  } else {
    logoBox.innerHTML = `<span style="font-size:30px">🏥</span>`;
  }

  const isProd = c.en_produccion === true;
  document.getElementById('detalle-clinica-prod-badge').style.display = isProd ? 'inline-flex' : 'none';
  const btnProd = document.getElementById('detalle-btn-prod');
  btnProd.textContent = isProd ? '✕ Quitar de Producción' : '★ Marcar en Producción';
  btnProd.className   = isProd ? 'btn btn-danger' : 'btn btn-secondary';
  document.getElementById('detalle-clinica-status-tag').innerHTML = c.activa
    ? '<span class="tag tag-green">Activa</span>'
    : '<span class="tag tag-red">Inactiva</span>';

  // Reset tabs
  ['info','usuarios','actividad'].forEach(t => {
    document.getElementById('detalle-panel-'+t).style.display = t==='info' ? 'block' : 'none';
    document.getElementById('detalle-tab-'+t).classList.toggle('active', t==='info');
  });
  renderDetallePanel('info');

  document.getElementById('modal-clinica-detalle').classList.add('open');

  // Fetch counts async — no loading overlay para no bloquear la UI
  const [rPac, rCit, rCitMes, rInv] = await Promise.all([
    sb.from('pacientes').select('*',{count:'exact',head:true}).eq('clinica_id',id),
    sb.from('citas').select('*',{count:'exact',head:true}).eq('clinica_id',id),
    sb.from('citas').select('*',{count:'exact',head:true}).eq('clinica_id',id).gte('fecha',hoy().slice(0,7)+'-01'),
    sb.from('inventario').select('*',{count:'exact',head:true}).eq('clinica_id',id)
  ]);
  const nPac   = rPac.count  || 0;
  const nCit   = rCit.count  || 0;
  const nCitM  = rCitMes.count || 0;
  const nInv   = rInv.count  || 0;
  const nUsers = adminUsuarios.filter(u=>u.clinica_id===id).length;

  const sEl = document.getElementById('detalle-stats-row');
  if(sEl) sEl.innerHTML = `
    <div class="admin-stat"><div class="admin-stat-icon">👤</div><div><div class="admin-stat-val">${nPac}</div><div class="admin-stat-label">Pacientes</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📅</div><div><div class="admin-stat-val">${nCit}</div><div class="admin-stat-label">Citas totales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📆</div><div><div class="admin-stat-val">${nCitM}</div><div class="admin-stat-label">Citas este mes</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📦</div><div><div class="admin-stat-val">${nInv}</div><div class="admin-stat-label">Productos inv.</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👥</div><div><div class="admin-stat-val">${nUsers}</div><div class="admin-stat-label">Usuarios</div></div></div>`;
}

function switchDetalleTab(tab) {
  detalleTab = tab;
  ['info','usuarios','actividad'].forEach(t => {
    document.getElementById('detalle-panel-'+t).style.display = t===tab ? 'block' : 'none';
    document.getElementById('detalle-tab-'+t).classList.toggle('active', t===tab);
  });
  renderDetallePanel(tab);
}

function renderDetallePanel(tab) {
  const id = currentDetalleClinicaId;
  const c  = adminClinicas.find(x=>x.id===id);
  if(!c) return;

  if(tab === 'info') {
    const f = (lbl,val) => `<div class="form-group"><label style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">${lbl}</label><div class="field-val">${val||'<span style="color:var(--text-light)">—</span>'}</div></div>`;
    document.getElementById('detalle-panel-info').innerHTML = `
      <div class="clinica-detail-grid">
        ${f('Doctor / Responsable', c.nombre_doctor)}
        ${f('Especialidad', c.especialidad)}
        ${f('Registro médico', c.registro)}
        ${f('Teléfono', c.telefono)}
        ${f('Tipo', c.tipo||'clinica')}
        ${f('Máx. agendas / pacientes', `${c.max_agendas??10} / ${c.max_pacientes??500}`)}
        <div class="form-group full"><label style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">Dirección</label><div class="field-val">${c.direccion||'<span style="color:var(--text-light)">—</span>'}</div></div>
        <div class="form-group full"><label style="font-size:11px;font-weight:600;color:var(--text-light);text-transform:uppercase;letter-spacing:.04em">Nota de pie (PDFs/facturas)</label><div class="field-val" style="font-size:12px;font-style:italic">${c.nota_pie||'<span style="color:var(--text-light)">—</span>'}</div></div>
      </div>`;
  }

  if(tab === 'usuarios') {
    const usuarios = adminUsuarios.filter(u=>u.clinica_id===id);
    const rolLabel = r => ({admin:'Administrador',medico:'Médico',medico_admin:'Médico Adm.',recepcion:'Recepcionista',enfermeria:'Enfermería',farmaceutico:'Farmacéutico',superadmin:'Super Admin'}[r]||r);
    const rolTag   = r => ({admin:'tag-blue',medico:'tag-cyan',medico_admin:'tag-cyan',recepcion:'tag-orange',enfermeria:'tag-green',farmaceutico:'tag-emerald'}[r]||'tag-gray');
    document.getElementById('detalle-panel-usuarios').innerHTML = usuarios.length
      ? `<div class="table-wrap"><table>
          <thead><tr><th>Usuario</th><th>Email</th><th>Rol</th></tr></thead>
          <tbody>${usuarios.map(u=>`<tr>
            <td><div class="patient-name-cell">
              <div class="patient-avatar" style="background:linear-gradient(135deg,var(--primary),var(--accent));font-size:18px;width:34px;height:34px">${u.icono||'👤'}</div>
              <strong>${u.nombre}</strong>
            </div></td>
            <td style="font-size:12px;color:var(--text-light)">${u.email||'—'}</td>
            <td><span class="tag ${rolTag(u.rol)}">${rolLabel(u.rol)}</span></td>
          </tr>`).join('')}</tbody>
        </table></div>`
      : `<div class="empty-state"><div class="empty-icon">👥</div><p>Sin usuarios asignados a esta clínica</p></div>`;
  }

  if(tab === 'actividad') {
    const usuarios = adminUsuarios.filter(u=>u.clinica_id===id);
    const uids = new Set(usuarios.map(u=>u.id));
    const acts = adminActividad.filter(a=>uids.has(a.user_id));
    const logins    = acts.filter(a=>a.accion==='login').length;
    const pacActs   = acts.filter(a=>a.accion==='paciente').length;
    const citaActs  = acts.filter(a=>a.accion==='cita').length;
    const notaActs  = acts.filter(a=>a.accion==='nota').length;

    const diasNom = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
    const dias = Array.from({length:7},(_,i)=>{
      const d = new Date(); d.setDate(d.getDate()-6+i); return d.toISOString().split('T')[0];
    });
    const porDia = dias.map(f=>({
      f, nom:diasNom[new Date(f+'T12:00:00').getDay()],
      total: acts.filter(a=>a.fecha===f).length
    }));
    const maxT = Math.max(...porDia.map(d=>d.total),1);

    document.getElementById('detalle-panel-actividad').innerHTML = `
      <div class="admin-stat-row" style="margin-bottom:18px">
        <div class="admin-stat"><div class="admin-stat-icon">🔑</div><div><div class="admin-stat-val">${logins}</div><div class="admin-stat-label">Logins registrados</div></div></div>
        <div class="admin-stat"><div class="admin-stat-icon">👤</div><div><div class="admin-stat-val">${pacActs}</div><div class="admin-stat-label">Altas de pacientes</div></div></div>
        <div class="admin-stat"><div class="admin-stat-icon">📅</div><div><div class="admin-stat-val">${citaActs}</div><div class="admin-stat-label">Citas agendadas</div></div></div>
        <div class="admin-stat"><div class="admin-stat-icon">📝</div><div><div class="admin-stat-val">${notaActs}</div><div class="admin-stat-label">Notas médicas</div></div></div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">Actividad últimos 7 días</div>
      <div style="display:flex;gap:8px;align-items:flex-end;height:110px;padding:0 4px">
        ${porDia.map(d=>`
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%">
            <div style="flex:1;display:flex;flex-direction:column;justify-content:flex-end;width:100%">
              <div style="width:100%;background:linear-gradient(to top,var(--primary),var(--accent));border-radius:5px 5px 0 0;height:${Math.max(d.total?Math.round(d.total/maxT*85):0,0)}%;min-height:${d.total?'4px':'0'};position:relative">
                ${d.total?`<div style="position:absolute;top:-17px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:var(--primary)">${d.total}</div>`:''}
              </div>
            </div>
            <div style="font-size:9px;font-weight:700;color:var(--text-light);text-transform:uppercase">${d.nom}</div>
            <div style="font-size:9px;color:var(--text-light)">${d.f.slice(5)}</div>
          </div>`).join('')}
      </div>
      ${!acts.length?'<div style="text-align:center;color:var(--text-light);font-size:13px;margin-top:16px;padding:20px">Sin actividad registrada para esta clínica</div>':''}`;
  }
}

async function setClinicaProduccion(id) {
  const c = adminClinicas.find(x=>x.id===id);
  if(!c) return;
  const nuevoEstado = !(c.en_produccion === true);
  const ok = await customConfirm({
    icon: nuevoEstado ? '🚀' : '✕',
    title: nuevoEstado ? 'Marcar en producción' : 'Quitar de producción',
    msg: nuevoEstado
      ? `¿Marcar <strong>${c.nombre}</strong> como clínica en producción?<br><small style="color:var(--text-light)">Varias clínicas pueden estar en producción al mismo tiempo.</small>`
      : `¿Quitar <strong>${c.nombre}</strong> del estado de producción?`,
    okText: nuevoEstado ? 'Marcar en producción' : 'Quitar',
    danger: !nuevoEstado
  });
  if(!ok) return;
  setLoading(true);
  const {error} = await sb.from('clinicas').update({en_produccion: nuevoEstado}).eq('id', id);
  if(error) {
    setLoading(false);
    toast('Ejecuta este SQL en Supabase → SQL Editor:\nALTER TABLE clinicas ADD COLUMN IF NOT EXISTS en_produccion BOOLEAN DEFAULT FALSE;', 'error');
    return;
  }
  await loadAdminData();
  renderAdminClinicas();
  // Actualizar modal abierto
  document.getElementById('detalle-clinica-prod-badge').style.display = nuevoEstado ? 'inline-flex' : 'none';
  const btnProd = document.getElementById('detalle-btn-prod');
  btnProd.textContent = nuevoEstado ? '✕ Quitar de Producción' : '★ Marcar en Producción';
  btnProd.className   = nuevoEstado ? 'btn btn-danger' : 'btn btn-secondary';
  toast(nuevoEstado ? `"${c.nombre}" marcada en producción` : `"${c.nombre}" quitada de producción`, 'success');
  setLoading(false);
}

// ── Modal Usuario ──
function fillClinicaSelect(selectedId) {
  document.getElementById('u-clinica').innerHTML =
    '<option value="">Sin clínica</option>' +
    adminClinicas.map(c=>`<option value="${c.id}" ${c.id===selectedId?'selected':''}>${c.nombre}</option>`).join('');
}

function selectIcon(btn) {
  document.querySelectorAll('#u-icono-grid .icon-opt').forEach(b=>b.classList.remove('selected'));
  btn.classList.add('selected');
  document.getElementById('u-icono').value = btn.dataset.icon;
}

function renderPermisosModal(checked = []) {
  const grid = document.getElementById('u-permisos-grid');
  if(!grid) return;
  grid.innerHTML = ALL_PERMISOS.map(p => {
    const on = checked.includes(p.id);
    return `<label id="perm-label-${p.id}" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:var(--bg);border:1.5px solid ${on?'var(--primary)':'var(--border)'};border-radius:8px;cursor:pointer;font-size:13px;transition:border .15s;user-select:none">
      <input type="checkbox" id="perm-${p.id}" value="${p.id}" ${on?'checked':''} onchange="togglePermLabel('${p.id}')">
      <span>${p.icon}</span>
      <span>${p.label}</span>
    </label>`;
  }).join('');
}
function togglePermLabel(id) {
  const cb = document.getElementById('perm-'+id);
  const lbl = document.getElementById('perm-label-'+id);
  if(lbl) lbl.style.borderColor = cb?.checked ? 'var(--primary)' : 'var(--border)';
}
// ── Firma manuscrita del usuario ──
let _pendingFirmaFile = null;   // archivo elegido, se sube al guardar
let _firmaUrlActual   = null;   // firma ya guardada del usuario en edición
let _firmaQuitar      = false;  // el usuario pidió borrar la firma existente

function _pintarFirma(url) {
  const img = document.getElementById('u-firma-img');
  const ph  = document.getElementById('u-firma-placeholder');
  const del = document.getElementById('u-firma-remove');
  if(!img || !ph) return;
  if(url) { img.src = url; img.style.display = ''; ph.style.display = 'none'; }
  else    { img.removeAttribute('src'); img.style.display = 'none'; ph.style.display = ''; }
  if(del) del.style.display = url ? '' : 'none';
}

function _resetFirmaUsuario(url) {
  _pendingFirmaFile = null;
  _firmaQuitar = false;
  _firmaUrlActual = url || null;
  const f = document.getElementById('u-firma-file');
  if(f) f.value = '';
  _pintarFirma(_firmaUrlActual);
}

function onFirmaSeleccionada(input) {
  const file = input.files && input.files[0];
  if(!file) return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)) {
    toast('La firma debe ser una imagen PNG, JPG o WEBP','error');
    input.value = ''; return;
  }
  if(file.size > 2 * 1024 * 1024) {
    toast('La imagen supera los 2 MB','error');
    input.value = ''; return;
  }
  _pendingFirmaFile = file;
  _firmaQuitar = false;
  const lector = new FileReader();
  lector.onload = e => _pintarFirma(e.target.result);
  lector.readAsDataURL(file);
}

function quitarFirmaUsuario() {
  _pendingFirmaFile = null;
  _firmaQuitar = !!_firmaUrlActual;   // solo hay que borrar en BD si había una guardada
  const f = document.getElementById('u-firma-file');
  if(f) f.value = '';
  _pintarFirma(null);
}

// Imagen de la firma sobre la línea; si no hay, deja el espacio en blanco de siempre
function _firmaImgHTML(alto) {
  const url = currentUser?.firmaUrl;
  if(!url) return '<div style="height:'+alto+'px"></div>';
  // Limpia la foto de la firma: multiply funde el papel con la hoja y el contraste
  // lleva el gris del papel a blanco, dejando solo el trazo de tinta.
  return '<div style="height:'+alto+'px;display:flex;align-items:flex-end;justify-content:center">'
       + '<img src="'+url+'" alt="Firma" style="max-height:'+alto+'px;max-width:210px;object-fit:contain;mix-blend-mode:multiply;filter:brightness(1.25) contrast(1.7)">'
       + '</div>';
}

// Roles clínicos que ejercen una especialidad; el resto no muestra el campo.
const ROLES_CON_ESPECIALIDAD = ['medico','medico_admin','odontologo','enfermeria'];

// La columna profiles.especialidad puede no existir todavía. Si es así, se
// guarda el resto del usuario igual en lugar de fallar el formulario entero.
function _faltaColumnaEspecialidad(error) { return _faltaColumna(error, 'especialidad'); }
function _faltaColumna(error, col) {
  const m = (error?.message || '').toLowerCase();
  return m.includes(col) && (m.includes('column') || m.includes('schema') || m.includes('does not exist'));
}
function _avisarFaltaColumnaEspecialidad() {
  toast('Usuario guardado, pero falta la columna "especialidad" en la tabla profiles de Supabase','warning');
}

function _syncEspecialidadUsuario() {
  const rol  = document.getElementById('u-rol')?.value;
  const wrap = document.getElementById('u-especialidad-wrap');
  if(!wrap) return;
  const aplica = ROLES_CON_ESPECIALIDAD.includes(rol);
  wrap.style.display = aplica ? '' : 'none';
  if(!aplica) { const inp = document.getElementById('u-especialidad'); if(inp) inp.value = ''; }
}

function onRolChange() {
  const rol = document.getElementById('u-rol').value;
  renderPermisosModal(PERMISOS_DEFECTO[rol] || []);
  _syncEspecialidadUsuario();
}

function openModalUsuario() {
  document.getElementById('modal-usuario-title').textContent = '👤 Nuevo Usuario';
  document.getElementById('u-nombre').value = '';
  document.getElementById('u-email').value = '';
  document.getElementById('u-rol').value = 'medico';
  document.getElementById('u-icono').value = '👨‍⚕️';
  document.getElementById('u-password').value = '';
  document.getElementById('u-pass-req').style.display = 'inline';
  document.getElementById('u-pass-hint').style.display = 'none';
  document.querySelectorAll('#u-icono-grid .icon-opt').forEach((b,i)=>b.classList.toggle('selected',i===0));
  fillClinicaSelect(null);
  editingUsuarioId = null;
  renderPermisosModal(PERMISOS_DEFECTO['medico'] || []);
  document.getElementById('u-especialidad').value = '';
  _syncEspecialidadUsuario();
  _resetFirmaUsuario(null);
  document.getElementById('modal-usuario').classList.add('open');
}

function openModalUsuarioEditById(id) {
  const u = adminUsuarios.find(x=>x.id===id);
  if(!u) return;
  document.getElementById('modal-usuario-title').textContent = '✏️ Editar Usuario';
  document.getElementById('u-nombre').value = u.nombre;
  document.getElementById('u-email').value = u.email||'';
  document.getElementById('u-rol').value = u.rol;
  document.getElementById('u-icono').value = u.icono||'👨‍⚕️';
  document.getElementById('u-password').value = '';
  // Mostrar campo de contraseña solo si es Super Admin
  const passGroup = document.getElementById('u-password').closest('.form-group');
  if(passGroup) passGroup.style.display = isSuperAdmin() ? '' : 'none';
  document.getElementById('u-pass-req').style.display = 'none';
  document.getElementById('u-pass-hint').style.display = isSuperAdmin() ? 'block' : 'none';
  document.querySelectorAll('#u-icono-grid .icon-opt').forEach(b=>{
    b.classList.toggle('selected', b.dataset.icon===(u.icono||'👨‍⚕️'));
  });
  fillClinicaSelect(u.clinica_id);
  editingUsuarioId = u.id;
  const permsActuales = Array.isArray(u.permisos) ? u.permisos : (PERMISOS_DEFECTO[u.rol] || []);
  renderPermisosModal(permsActuales);
  document.getElementById('u-especialidad').value = u.especialidad || '';
  _syncEspecialidadUsuario();
  _resetFirmaUsuario(u.firma_url || null);
  document.getElementById('modal-usuario').classList.add('open');
}

async function guardarUsuario() {
  const nombre = document.getElementById('u-nombre').value.trim();
  const email = document.getElementById('u-email').value.trim();
  const rol = document.getElementById('u-rol').value;
  const icono = document.getElementById('u-icono').value;
  const password = document.getElementById('u-password').value;
  const clinicaVal = document.getElementById('u-clinica').value;
  const clinica_id = clinicaVal ? Number(clinicaVal) : null;
  const permisos = ALL_PERMISOS.map(p => p.id).filter(id => document.getElementById('perm-'+id)?.checked);
  // Solo se conserva la especialidad en los roles que la ejercen
  const especialidad = ROLES_CON_ESPECIALIDAD.includes(rol)
    ? (document.getElementById('u-especialidad')?.value.trim() || null)
    : null;
  if(!nombre){ toast('El nombre es obligatorio','error'); return; }
  if(!editingUsuarioId && !password){ toast('La contraseña es obligatoria','error'); return; }
  setLoading(true);
  if(editingUsuarioId) {
    // Subir la firma primero: si falla, no se guarda una URL que no existe
    let firma_url = _firmaQuitar ? null : _firmaUrlActual;
    if(_pendingFirmaFile) {
      try { firma_url = await subirFirmaUsuario(_pendingFirmaFile, editingUsuarioId); }
      catch(e) { toast('No se pudo subir la firma: '+(e.message||e),'error'); setLoading(false); return; }
    }
    const upd = {nombre,email:email||null,rol,icono,clinica_id,permisos,especialidad,firma_url};
    // Solo el Super Admin puede cambiar contraseñas de otros usuarios
    if(password && isSuperAdmin()) {
      const { data: { session: adminSess } } = await sb.auth.getSession();
      // Actualizar en Auth: el usuario debe estar autenticado — usamos signUp si ya existe
      const { error: authUpd } = await sb.from('profiles').update({password}).eq('id', editingUsuarioId);
      // Intentar actualizar via auth admin (si el usuario existe en Auth)
      upd.password = password;
    } else if(password && !isSuperAdmin()) {
      toast('Solo el Super Admin puede cambiar contraseñas de otros usuarios','error');
      setLoading(false); return;
    }
    let {error} = await sb.from('profiles').update(upd).eq('id',editingUsuarioId);
    if(error && (_faltaColumnaEspecialidad(error) || _faltaColumna(error,'firma_url'))) {
      const faltaFirma = _faltaColumna(error,'firma_url');
      const {especialidad:_e, firma_url:_f, ...base} = upd;
      const reintento = faltaFirma ? base : {...base, especialidad};
      ({error} = await sb.from('profiles').update(reintento).eq('id',editingUsuarioId));
      if(!error) toast('Usuario guardado, pero falta la columna "'+(faltaFirma?'firma_url':'especialidad')+'" en la tabla profiles de Supabase','warning');
    }
    if(error){ toast('Error al actualizar: '+error.message,'error'); setLoading(false); return; }
    if(currentUser && currentUser.id === editingUsuarioId) currentUser.firmaUrl = firma_url || null;
    toast('Usuario actualizado','success');
  } else {
    // Crear en Supabase Auth y restaurar sesión del super admin
    const { data: { session: adminSess } } = await sb.auth.getSession();
    const { data: newAuth, error: authErr } = await sb.auth.signUp({ email, password });
    if(adminSess) await sb.auth.setSession(adminSess);
    if(authErr){ toast('Error Auth: '+authErr.message,'error'); setLoading(false); return; }
    const newId = newAuth?.user?.id || crypto.randomUUID();
    const nuevo = {id:newId,nombre,email:email||null,rol,icono,clinica_id,password,permisos,especialidad};
    let {error} = await sb.from('profiles').insert(nuevo);
    if(error && _faltaColumnaEspecialidad(error)) {
      const {especialidad:_omitida, ...sinEsp} = nuevo;
      ({error} = await sb.from('profiles').insert(sinEsp));
      if(!error) _avisarFaltaColumnaEspecialidad();
    }
    if(error){ toast('Error al crear: '+error.message,'error'); setLoading(false); return; }
    toast('Usuario creado exitosamente','success');
  }
  closeModal('modal-usuario');
  await loadAdminData();
  renderAdminUsuarios();
  renderAdminStats();
  setLoading(false);
}

async function eliminarUsuario(id) {
  const u = adminUsuarios.find(x=>x.id===id);
  const ok=await customConfirm({icon:'👤',title:'Eliminar usuario',msg:`¿Eliminar el usuario <strong>${u?.nombre}</strong>?<br><br>Esta acción no se puede deshacer.`,okText:'Eliminar'});
  if(!ok) return;
  setLoading(true);
  const {error} = await sb.from('profiles').delete().eq('id',id);
  if(error){ toast('Error al eliminar: '+error.message,'error'); setLoading(false); return; }
  toast('Usuario eliminado','success');
  await loadAdminData();
  renderAdminUsuarios();
  renderAdminStats();
  setLoading(false);
}

async function desbloquearUsuario(id) {
  const u = adminUsuarios.find(x=>x.id===id);
  const ok = await customConfirm({
    icon:'🔓', title:'Desbloquear usuario',
    msg:`¿Desbloquear la cuenta de <strong>${u?.nombre}</strong>?<br><br>El contador de intentos fallidos se restablecerá a cero y el usuario podrá volver a iniciar sesión.`,
    okText:'🔓 Desbloquear', danger:false
  });
  if(!ok) return;
  setLoading(true);
  const {error} = await sb.from('profiles').update({ bloqueado: false, intentos_fallidos: 0 }).eq('id', id);
  if(error){ toast('Error: '+error.message,'error'); setLoading(false); return; }
  toast(`✅ Cuenta de ${u?.nombre} desbloqueada correctamente`);
  await loadAdminData(); renderAdminUsuarios(); renderAdminStats(); setLoading(false);
}

async function restablecerPasswordAdmin(id, nombre) {
  const ok = await customConfirm({
    icon:'🔑', title:`Restablecer contraseña — ${nombre}`,
    msg:`Ingresa la nueva contraseña temporal para <strong>${nombre}</strong>:<br><br>
      <div style="margin-top:10px">
        <div style="position:relative">
          <input id="_nueva-pass" type="password" placeholder="Nueva contraseña (mín. 6 caracteres)"
            style="width:100%;padding:10px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:14px;background:var(--card);color:var(--text);box-sizing:border-box">
        </div>
        <button type="button" onclick="const i=document.getElementById('_nueva-pass');i.type=i.type==='password'?'text':'password';this.textContent=i.type==='password'?'👁 Mostrar':'🙈 Ocultar'"
          style="margin-top:8px;font-size:12px;background:none;border:none;color:var(--primary);cursor:pointer;font-weight:600;padding:0">👁 Mostrar</button>
        <div style="font-size:11px;color:var(--text-light);margin-top:6px">Al guardar, el usuario también quedará desbloqueado si estaba bloqueado.</div>
      </div>`,
    okText:'🔑 Restablecer contraseña', danger:false
  });
  if(!ok) return;
  const pass = document.getElementById('_nueva-pass')?.value?.trim();
  if(!pass || pass.length < 6){ toast('La contraseña debe tener al menos 6 caracteres','error'); return; }
  setLoading(true);
  const {error} = await sb.from('profiles').update({ password: pass, bloqueado: false, intentos_fallidos: 0 }).eq('id', id);
  if(error){ toast('Error al restablecer: '+error.message,'error'); setLoading(false); return; }
  toast(`🔑 Contraseña de ${nombre} restablecida · La cuenta quedó desbloqueada`);
  await loadAdminData(); renderAdminUsuarios(); renderAdminStats(); setLoading(false);
}

// ════════════════════ ESTADÍSTICAS ════════════════════
function descargarPDFEstadisticas() {
  const cfg = getClinicaConfig();
  let titulo='', citas=[], periodo='';
  if(estTab==='dia'){
    const fecha=document.getElementById('est-dia-fecha').value||hoy();
    titulo=`Estadísticas Diarias`; periodo=formatFecha(fecha);
    citas=C.c.filter(c=>c.fecha===fecha);
  } else if(estTab==='semana'){
    const val=document.getElementById('est-semana-fecha').value||'';
    const [yr,wk]=val.split('-W').map(Number);
    const lunes=new Date(yr,0,1+(wk-1)*7);
    lunes.setDate(lunes.getDate()-(lunes.getDay()||7)+1);
    const dom=new Date(lunes); dom.setDate(lunes.getDate()+6);
    const s=d=>d.toISOString().split('T')[0];
    const dias=Array.from({length:7},(_,i)=>{const d=new Date(lunes);d.setDate(d.getDate()+i);return s(d);});
    titulo='Estadísticas Semanales'; periodo=`${formatFecha(s(lunes))} al ${formatFecha(s(dom))}`;
    citas=C.c.filter(c=>dias.includes(c.fecha));
  } else {
    const val=document.getElementById('est-mes-fecha').value||hoy().slice(0,7);
    const [yr,mo]=val.split('-');
    periodo=new Date(yr,mo-1,1).toLocaleDateString('es-ES',{month:'long',year:'numeric'});
    titulo='Estadísticas Mensuales';
    citas=C.c.filter(c=>c.fecha.startsWith(val));
  }
  const atendidos=citas.filter(c=>c.estado==='completada');
  const canceladas=citas.filter(c=>c.estado==='cancelada');
  const pendientes=citas.filter(c=>c.estado==='pendiente'||c.estado==='confirmada');
  const pct=citas.length?Math.round(atendidos.length/citas.length*100):0;
  const tipos=['consulta','control','urgencia','cirugia','examen'];
  const porTipo=tipos.map(t=>({k:t,v:citas.filter(c=>c.tipo===t).length})).filter(d=>d.v>0);
  const maxT=porTipo.length?Math.max(...porTipo.map(d=>d.v),1):1;
  const freq={};
  citas.forEach(c=>{freq[c.pacienteId]=(freq[c.pacienteId]||0)+1;});
  const topP=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,6).map(([id,v])=>{
    const p=C.p.find(x=>x.id==id); return {k:p?p.nombre+' '+p.apellidos:'#'+id,v};
  });
  const maxP=topP.length?Math.max(...topP.map(d=>d.v),1):1;

  const body=`
    <div style="margin-bottom:20px">
      <div style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:4px">${titulo}</div>
      <div style="font-size:13px;color:#64748B;font-weight:600">Período: ${periodo}</div>
    </div>
    <div class="kpi-grid">
      <div class="kpi blue"><div class="kpi-val">${citas.length}</div><div class="kpi-lbl">Total citas</div></div>
      <div class="kpi green"><div class="kpi-val">${atendidos.length}</div><div class="kpi-lbl">Atendidos (${pct}%)</div></div>
      <div class="kpi orange"><div class="kpi-val">${pendientes.length}</div><div class="kpi-lbl">Pendientes</div></div>
      <div class="kpi red"><div class="kpi-val">${canceladas.length}</div><div class="kpi-lbl">Canceladas</div></div>
    </div>
    ${porTipo.length?`<div class="section-title">📊 Distribución por tipo de consulta</div>
    <div style="margin-bottom:20px">${porTipo.map(d=>`<div class="bar-row">
      <div class="bar-lbl" style="text-transform:capitalize">${d.k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.v/maxT*100)}%"><span>${d.v}</span></div></div>
      <div class="bar-val">${d.v}</div>
    </div>`).join('')}</div>`:''}
    ${topP.length?`<div class="section-title">👥 Pacientes más frecuentes</div>
    <div style="margin-bottom:20px">${topP.map(d=>`<div class="bar-row">
      <div class="bar-lbl">${d.k}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.round(d.v/maxP*100)}%;background:linear-gradient(90deg,#7C3AED,#06B6D4)"><span>${d.v}</span></div></div>
      <div class="bar-val">${d.v}</div>
    </div>`).join('')}</div>`:''}
    ${citas.length?`<div class="section-title">📋 Detalle de citas</div>
    <table><thead><tr><th>Fecha</th><th>Hora</th><th>Paciente</th><th>Tipo</th><th>Estado</th></tr></thead>
    <tbody>${citas.sort((a,b)=>a.fecha.localeCompare(b.fecha)||(a.hora||'').localeCompare(b.hora||'')).map(c=>{
      const p=C.p.find(x=>x.id===c.pacienteId);
      const stCls={completada:'tag-green',cancelada:'tag-red',pendiente:'tag-orange',confirmada:'tag-cyan'}[c.estado]||'tag-gray';
      return `<tr><td>${formatFecha(c.fecha)}</td><td>${c.hora||'—'}</td><td>${p?p.nombre+' '+p.apellidos:'—'}</td><td><span class="tag tag-blue" style="text-transform:capitalize">${c.tipo}</span></td><td><span class="tag ${stCls}">${c.estado}</span></td></tr>`;
    }).join('')}</tbody></table>`:'<p style="color:#94A3B8;text-align:center;padding:20px">Sin citas en este período</p>'}`;

  pdfAbrir(titulo+' — '+periodo, body, cfg);
}

function descargarPDFInventario() {
  const cfg = getClinicaConfig();
  const now = new Date();
  const mesActual = hoy().slice(0,7);
  const yrActual = now.getFullYear().toString();
  const movMes = C.mov.filter(m=>m.fecha.startsWith(mesActual));
  const movYear = C.mov.filter(m=>m.fecha.startsWith(yrActual));
  const totEntMes = movMes.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.cantidad,0);
  const totSalMes = movMes.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.cantidad,0);
  const totEntYear = movYear.filter(m=>m.tipo==='entrada').reduce((s,m)=>s+m.cantidad,0);
  const totSalYear = movYear.filter(m=>m.tipo==='salida').reduce((s,m)=>s+m.cantidad,0);
  const bajoStock = C.inv.filter(p=>p.stockMin>0&&p.stock<=p.stockMin);
  const sinStock  = C.inv.filter(p=>p.stock===0);
  const catIcon   = c=>({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
  const nomMes = now.toLocaleDateString('es-ES',{month:'long',year:'numeric'});

  const body=`
    <div style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:4px">Control de Inventario</div>
    <div style="font-size:13px;color:#64748B;font-weight:600;margin-bottom:20px">${cfg.nombreClinica||'Lumea Med'} · Generado: ${new Date().toLocaleString('es-ES')}</div>

    <div class="kpi-grid">
      <div class="kpi blue"><div class="kpi-val">${C.inv.length}</div><div class="kpi-lbl">Total productos</div></div>
      <div class="kpi green"><div class="kpi-val">${totEntMes}</div><div class="kpi-lbl">Entradas este mes</div></div>
      <div class="kpi orange"><div class="kpi-val">${totSalMes}</div><div class="kpi-lbl">Salidas este mes</div></div>
      <div class="kpi red"><div class="kpi-val">${bajoStock.length}</div><div class="kpi-lbl">Bajo stock / sin stock (${sinStock.length})</div></div>
    </div>

    <div class="section-title">📊 Resumen anual ${yrActual}</div>
    <div style="margin-bottom:20px;display:flex;gap:20px">
      <div style="flex:1;background:#F0FDF4;border:1px solid #DCFCE7;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#15803D">${totEntYear}</div>
        <div style="font-size:11px;color:#166534;margin-top:3px;font-weight:600">TOTAL ENTRADAS ${yrActual}</div>
      </div>
      <div style="flex:1;background:#FEF2F2;border:1px solid #FEE2E2;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#B91C1C">${totSalYear}</div>
        <div style="font-size:11px;color:#B91C1C;margin-top:3px;font-weight:600">TOTAL SALIDAS ${yrActual}</div>
      </div>
      <div style="flex:1;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:24px;font-weight:900;color:#1D4ED8">${movYear.length}</div>
        <div style="font-size:11px;color:#1D4ED8;margin-top:3px;font-weight:600">MOVIMIENTOS TOTALES ${yrActual}</div>
      </div>
    </div>

    <div class="section-title">📦 Catálogo de productos — Estado actual</div>
    <table><thead><tr><th>Producto</th><th>Categoría</th><th>Unidad</th><th>Stock actual</th><th>Mínimo</th><th>Estado</th></tr></thead>
    <tbody>${C.inv.map(p=>{
      const st=p.stock===0?['tag-red','Sin stock']:p.stockMin>0&&p.stock<=p.stockMin?['tag-orange','Bajo stock']:['tag-green','OK'];
      return `<tr><td><strong>${catIcon(p.categoria)} ${p.nombre}</strong>${p.descripcion?`<div style="font-size:10px;color:#94A3B8">${p.descripcion}</div>`:''}</td><td style="text-transform:capitalize">${p.categoria}</td><td>${p.unidad}</td><td><strong>${p.stock}</strong></td><td>${p.stockMin||'—'}</td><td><span class="tag ${st[0]}">${st[1]}</span></td></tr>`;
    }).join('')}</tbody></table>

    ${bajoStock.length?`<div class="section-title" style="color:#B91C1C">⚠️ Alertas de stock</div>
    <table><thead><tr><th>Producto</th><th>Stock actual</th><th>Mínimo</th><th>Faltante</th></tr></thead>
    <tbody>${bajoStock.map(p=>`<tr style="background:#FEF2F2">
      <td><strong>${p.nombre}</strong></td>
      <td style="color:${p.stock===0?'#B91C1C':'#B45309'};font-weight:800">${p.stock}</td>
      <td>${p.stockMin}</td>
      <td style="color:#B91C1C;font-weight:700">${Math.max(0,p.stockMin-p.stock)} ${p.unidad}(s)</td>
    </tr>`).join('')}</tbody></table>`:''}

    <div class="section-title">🔄 Últimos movimientos del mes — ${nomMes}</div>
    ${movMes.length?`<table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th><th>Motivo</th></tr></thead>
    <tbody>${movMes.slice(0,30).map(m=>{
      const p=C.inv.find(x=>x.id===m.invId);
      return `<tr><td>${formatFecha(m.fecha)}</td><td>${p?p.nombre:'—'}</td><td><span class="tag ${m.tipo==='entrada'?'tag-green':'tag-red'}">${m.tipo==='entrada'?'📥 Entrada':'📤 Salida'}</span></td><td><strong>${m.cantidad}</strong></td><td style="color:#64748B">${m.motivo||'—'}</td></tr>`;
    }).join('')}</tbody></table>`:'<p style="color:#94A3B8;text-align:center;padding:16px">Sin movimientos este mes</p>'}`;

  pdfAbrir('Control de Inventario — '+nomMes, body, cfg);
}

// ════════════════════ MIGRACIÓN A SUPABASE AUTH ════════════════════
async function verificarEstadoAuth() {
  const { data: profiles } = await sb.from('profiles').select('id,email,nombre,password');
  if(!profiles) return;
  const conAuth = profiles.filter(p => !p.password || p.password === '');
  const sinAuth = profiles.filter(p => p.password && p.password !== '');
  const badge = document.getElementById('auth-status-badge');
  const prog  = document.getElementById('migracion-progress');
  if(sinAuth.length === 0) {
    if(badge) { badge.textContent = '✅ Migrado'; badge.className = 'tag tag-green'; }
    if(prog) prog.textContent = `Todos los usuarios (${profiles.length}) usan Supabase Auth.`;
  } else {
    if(badge) { badge.textContent = 'Pendiente'; badge.className = 'tag tag-orange'; }
    if(prog) prog.textContent = `${conAuth.length}/${profiles.length} migrados. ${sinAuth.length} pendiente(s).`;
  }
}

async function migrarUsuariosAAuth() {
  const { data: profiles, error } = await sb.from('profiles').select('*');
  if(error || !profiles?.length) { toast('No se pudieron cargar los perfiles','error'); return; }

  const pendientes = profiles.filter(p => p.password && p.email);
  if(!pendientes.length) { toast('Todos los usuarios ya están migrados ✅','success'); return; }

  const ok = await customConfirm({
    icon: '🔐', title: 'Migrar a Supabase Auth',
    msg: `Se van a migrar <strong>${pendientes.length} usuario(s)</strong> al sistema de Auth seguro.<br><br>
          <strong>Antes de continuar:</strong> en Supabase → Authentication → Settings → Email → desactiva <em>"Confirm email"</em>.`,
    okText: 'Migrar ahora', danger: false
  });
  if(!ok) return;

  const log = document.getElementById('migracion-log');
  const prog = document.getElementById('migracion-progress');
  if(log) { log.style.display = 'block'; log.innerHTML = ''; }

  const addLog = (msg, ok=true) => {
    if(log) log.innerHTML += `<div style="color:${ok?'#10B981':'#EF4444'}">${msg}</div>`;
  };

  let migrados = 0, errores = 0;
  const { data: { session: adminSess } } = await sb.auth.getSession();

  for(const p of pendientes) {
    if(prog) prog.textContent = `Migrando ${migrados + errores + 1}/${pendientes.length}...`;
    const { data: newAuth, error: authErr } = await sb.auth.signUp({ email: p.email, password: p.password });
    // Restaurar sesión del super admin inmediatamente
    if(adminSess) await sb.auth.setSession(adminSess);

    if(authErr) {
      if(authErr.message.includes('already registered')) {
        addLog(`⚠️ ${p.email} — ya existe en Auth (OK)`);
        migrados++;
      } else {
        addLog(`❌ ${p.email} — ${authErr.message}`, false);
        errores++;
      }
      continue;
    }

    const newId = newAuth?.user?.id;
    if(newId && newId !== p.id) {
      await sb.from('profiles').update({ id: newId, password: null }).eq('id', p.id);
    } else {
      await sb.from('profiles').update({ password: null }).eq('id', p.id);
    }
    addLog(`✅ ${p.nombre} (${p.email}) — migrado`);
    migrados++;
  }

  if(prog) prog.textContent = `Completado: ${migrados} migrados, ${errores} error(es).`;
  toast(`Migración completada: ${migrados} usuario(s) migrados`, migrados > 0 ? 'success' : 'warning');
  await loadAdminData();
  await verificarEstadoAuth();
}

// ════════════════════ DATE PICKERS ════════════════════
const fpEs = {
  firstDayOfWeek: 1,
  weekdays: {
    shorthand: ['Do','Lu','Ma','Mi','Ju','Vi','Sa'],
    longhand:  ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado']
  },
  months: {
    shorthand: ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'],
    longhand:  ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  }
};

function initDatePickers() {
  if(typeof flatpickr === 'undefined') return;
  document.querySelectorAll('input[type="date"]').forEach(el => {
    if(el._flatpickr) return;
    const isBirthDate = el.id === 'p-fechanac';
    const isCitaDate  = el.id === 'c-fecha';
    flatpickr(el, {
      locale:        fpEs,
      dateFormat:    'Y-m-d',
      allowInput:    true,
      disableMobile: true,
      maxDate:       isBirthDate ? 'today' : null,
      minDate:       isBirthDate ? '1900-01-01' : isCitaDate ? 'today' : null,
      defaultDate:   el.value || null,
      prevArrow:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 18l-6-6 6-6"/></svg>',
      nextArrow:     '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 18l6-6-6-6"/></svg>',
      onReady(_, __, fp) {
        fp.calendarContainer.style.fontFamily = "'Inter', sans-serif";
      },
      onChange: isCitaDate ? function(_, dateStr) {
        const minH = dateStr === hoy() ? _getMinHoraHoy() : null;
        const curVal = document.getElementById('c-hora').value;
        fillHoraSelect(minH && curVal < minH ? '' : curVal, minH);
        marcarHorasOcupadas();
      } : undefined
    });
  });
}

document.addEventListener('DOMContentLoaded', initDatePickers);

// ════════════════════ FINANZAS ════════════════════
let finTab = 'resumen';
let finPeriodo = 'mes';
let finTipoFiltro = '';
let editingFacturaId = null;
let facturaItems = [];
let _factItemCounter = 0;

const fmtC = n => 'C$ ' + Number(n||0).toLocaleString('es-NI',{minimumFractionDigits:2,maximumFractionDigits:2});

function getFinDateRange() {
  const h = new Date();
  let from, to = h.toISOString().split('T')[0];
  if(finPeriodo==='hoy') { from = to; }
  else if(finPeriodo==='semana') { const d=new Date(h); d.setDate(h.getDate()-6); from=d.toISOString().split('T')[0]; }
  else if(finPeriodo==='mes') { from=h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-01'; }
  else { from=h.getFullYear()+'-01-01'; }
  return {from,to};
}

function setFinPeriodo(p, el) {
  finPeriodo = p;
  document.querySelectorAll('#fin-periodo-chips .chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  if(finTab==='resumen') renderResumenFinanzas();
  else if(finTab==='transacciones') renderTransacciones();
  else if(finTab==='facturas') renderFacturasList();
}

function setFinTipo(tipo, el) {
  finTipoFiltro = tipo;
  document.querySelectorAll('#fin-panel-transacciones .chip').forEach(c=>c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderTransacciones();
}

function renderFinanzas() { switchFinTab(finTab||'resumen'); }

function switchFinTab(tab) {
  finTab = tab;
  ['resumen','transacciones','facturas'].forEach(t => {
    const p = document.getElementById('fin-panel-'+t);
    const b = document.getElementById('tab-fin-'+t);
    if(p) p.style.display = t===tab ? 'block' : 'none';
    if(b) b.classList.toggle('active', t===tab);
  });
  const btnPdf = document.getElementById('btn-pdf-resumen-fin');
  if(btnPdf) btnPdf.style.display = tab === 'resumen' ? '' : 'none';
  if(tab==='resumen') renderResumenFinanzas();
  else if(tab==='transacciones') renderTransacciones();
  else if(tab==='facturas') renderFacturasList();
}

function renderResumenFinanzas() {
  const {from,to} = getFinDateRange();
  const finData  = (C.fin||[]).filter(f=>f.fecha>=from && f.fecha<=to);
  const factData = (C.fact||[]).filter(f=>f.fecha>=from && f.fecha<=to);
  const ingresos = finData.filter(f=>f.tipo==='ingreso').reduce((s,f)=>s+f.monto,0);
  const egresos  = finData.filter(f=>f.tipo==='egreso').reduce((s,f)=>s+f.monto,0);
  const utilidad = ingresos - egresos;
  const fEmit    = factData.length;
  const fPag     = factData.filter(f=>f.estado==='pagada').length;
  const statsEl  = document.getElementById('fin-stats');
  if(statsEl) statsEl.innerHTML = `
    <div class="stat-card"><div class="stat-icon si-green">💰</div>
      <div class="stat-info"><h3 style="color:var(--success);font-size:20px">${fmtC(ingresos)}</h3><p>Ingresos del período</p></div></div>
    <div class="stat-card"><div class="stat-icon si-red">📤</div>
      <div class="stat-info"><h3 style="color:var(--danger);font-size:20px">${fmtC(egresos)}</h3><p>Gastos del período</p></div></div>
    <div class="stat-card"><div class="stat-icon ${utilidad>=0?'si-blue':'si-red'}">📊</div>
      <div class="stat-info"><h3 style="color:${utilidad>=0?'var(--primary)':'var(--danger)'};font-size:20px">${fmtC(utilidad)}</h3><p>Utilidad neta</p></div></div>
    <div class="stat-card"><div class="stat-icon si-orange">🧾</div>
      <div class="stat-info"><h3 style="font-size:20px">${fEmit}</h3><p>Facturas (${fPag} pagadas)</p></div></div>`;
  const recent = [...finData].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,8);
  const ultEl = document.getElementById('fin-ultimas');
  if(ultEl) {
    if(!recent.length) { ultEl.innerHTML='<div class="empty-state" style="padding:32px"><div class="empty-icon">💰</div><p>No hay transacciones en este período</p></div>'; }
    else ultEl.innerHTML=`<div class="table-wrap"><table>
      <thead><tr><th>Fecha</th><th>Descripción</th><th>Tipo</th><th style="text-align:right">Monto</th></tr></thead>
      <tbody>${recent.map(f=>`<tr>
        <td style="white-space:nowrap">${formatFecha(f.fecha)}</td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.descripcion}</td>
        <td>${f.tipo==='ingreso'?'<span class="tag tag-green" style="font-size:10px">💰 Ingreso</span>':'<span class="tag tag-red" style="font-size:10px">📤 Gasto</span>'}</td>
        <td style="font-weight:700;color:${f.tipo==='ingreso'?'var(--success)':'var(--danger)'};text-align:right;white-space:nowrap">
          ${f.tipo==='ingreso'?'+':'−'}${fmtC(f.monto)}</td>
      </tr>`).join('')}</tbody></table></div>`;
  }
  // Facturas del período activo (no de todos los tiempos)
  const factRecent = [...factData].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,5);
  const fResEl = document.getElementById('fin-fact-resumen');
  if(fResEl) {
    if(!factRecent.length) { fResEl.innerHTML='<div class="empty-state" style="padding:32px"><div class="empty-icon">🧾</div><p>No hay facturas en este período</p></div>'; }
    else {
      const estadoTag = e => ({pagada:'tag-green',pendiente:'tag-orange',cancelada:'tag-red',anulada:'tag-gray'})[e]||'tag-gray';
      fResEl.innerHTML=`<div class="table-wrap"><table>
        <thead><tr><th>N°</th><th>Paciente</th><th>Estado</th><th style="text-align:right">Total</th></tr></thead>
        <tbody>${factRecent.map(f=>`<tr>
          <td><code style="font-size:11px;background:var(--bg);padding:2px 6px;border-radius:5px">${f.numero||'—'}</code></td>
          <td style="max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${f.pacienteNombre||'—'}</td>
          <td><span class="tag ${estadoTag(f.estado)}">${f.estado}</span></td>
          <td style="font-weight:700;text-align:right;white-space:nowrap">${fmtC(f.total)}</td>
        </tr>`).join('')}</tbody></table></div>`;
    }
  }
}

function descargarPDFResumenFinanzas() {
  const cfg = getClinicaConfig();
  const {from, to} = getFinDateRange();
  const periodoLabel = {
    hoy: 'Hoy — ' + formatFecha(to),
    semana: 'Últimos 7 días',
    mes: new Date().toLocaleDateString('es-ES', {month:'long', year:'numeric'}),
    anio: 'Año ' + new Date().getFullYear()
  }[finPeriodo] || finPeriodo;

  const finData  = (C.fin||[]).filter(f => f.fecha >= from && f.fecha <= to);
  const factData = (C.fact||[]).filter(f => f.fecha >= from && f.fecha <= to);
  const ingresos  = finData.filter(f => f.tipo === 'ingreso');
  const egresos   = finData.filter(f => f.tipo === 'egreso');
  const totalIng  = ingresos.reduce((s,f) => s + f.monto, 0);
  const totalEgr  = egresos.reduce((s,f) => s + f.monto, 0);
  const utilidad  = totalIng - totalEgr;
  const fPag      = factData.filter(f => f.estado === 'pagada').length;

  // Agrupar ingresos y egresos por categoría
  const agrupar = arr => {
    const m = {};
    arr.forEach(f => { m[f.categoria] = (m[f.categoria]||0) + f.monto; });
    return Object.entries(m).sort((a,b) => b[1]-a[1]);
  };
  const catIng = agrupar(ingresos);
  const catEgr = agrupar(egresos);

  // Agrupar por día
  const porDia = {};
  finData.forEach(f => { porDia[f.fecha] = (porDia[f.fecha]||{ing:0,egr:0}); if(f.tipo==='ingreso') porDia[f.fecha].ing+=f.monto; else porDia[f.fecha].egr+=f.monto; });
  const diasOrdenados = Object.keys(porDia).sort((a,b) => b.localeCompare(a));

  const catTag = c => `<span class="tag tag-gray" style="font-size:10px">${c||'general'}</span>`;
  const estadoFact = e => ({pagada:'tag-green',pendiente:'tag-orange',cancelada:'tag-red',anulada:'tag-gray'})[e]||'tag-gray';

  const body = `
    <div style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:4px">Resumen Financiero</div>
    <div style="font-size:13px;color:#64748B;font-weight:600;margin-bottom:20px">Período: ${periodoLabel} · Generado: ${new Date().toLocaleString('es-ES')}</div>

    <div class="kpi-grid">
      <div class="kpi green"><div class="kpi-val">${fmtC(totalIng)}</div><div class="kpi-lbl">Total Ingresos</div></div>
      <div class="kpi red"><div class="kpi-val">${fmtC(totalEgr)}</div><div class="kpi-lbl">Total Gastos</div></div>
      <div class="kpi ${utilidad>=0?'blue':'red'}"><div class="kpi-val">${fmtC(utilidad)}</div><div class="kpi-lbl">Utilidad Neta</div></div>
      <div class="kpi orange"><div class="kpi-val">${factData.length}</div><div class="kpi-lbl">Facturas (${fPag} pagadas)</div></div>
    </div>

    <div style="display:flex;gap:20px;margin-bottom:20px">
      ${catIng.length ? `<div style="flex:1">
        <div class="section-title" style="margin-bottom:8px">💰 Ingresos por categoría</div>
        <table><thead><tr><th>Categoría</th><th>Total</th></tr></thead>
        <tbody>${catIng.map(([cat,tot])=>`<tr><td style="text-transform:capitalize">${cat}</td><td style="font-weight:700;color:#15803D">${fmtC(tot)}</td></tr>`).join('')}</tbody></table>
      </div>` : ''}
      ${catEgr.length ? `<div style="flex:1">
        <div class="section-title" style="margin-bottom:8px">📤 Gastos por categoría</div>
        <table><thead><tr><th>Categoría</th><th>Total</th></tr></thead>
        <tbody>${catEgr.map(([cat,tot])=>`<tr><td style="text-transform:capitalize">${cat}</td><td style="font-weight:700;color:#B91C1C">${fmtC(tot)}</td></tr>`).join('')}</tbody></table>
      </div>` : ''}
    </div>

    ${diasOrdenados.length ? `<div class="section-title">📅 Movimiento por Día</div>
    <table style="margin-bottom:20px"><thead><tr><th>Fecha</th><th>Ingresos</th><th>Gastos</th><th>Neto del día</th></tr></thead>
    <tbody>${diasOrdenados.map(fecha => {
      const d = porDia[fecha];
      const neto = d.ing - d.egr;
      return `<tr>
        <td>${formatFecha(fecha)}</td>
        <td style="color:#15803D;font-weight:600">${fmtC(d.ing)}</td>
        <td style="color:#B91C1C;font-weight:600">${fmtC(d.egr)}</td>
        <td style="font-weight:700;color:${neto>=0?'#1D4ED8':'#B91C1C'}">${fmtC(neto)}</td>
      </tr>`;
    }).join('')}</tbody></table>` : ''}

    <div class="section-title">📋 Todas las Transacciones del Período</div>
    ${finData.length ? `<table><thead><tr><th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Método</th><th>Tipo</th><th>Monto</th></tr></thead>
    <tbody>${[...finData].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(f=>`<tr>
      <td>${formatFecha(f.fecha)}</td>
      <td>${f.descripcion}${f.referencia?`<div style="font-size:10px;color:#94A3B8">Ref: ${f.referencia}</div>`:''}</td>
      <td>${catTag(f.categoria)}</td>
      <td style="font-size:11px;color:#64748B">${f.metodoPago||'—'}</td>
      <td><span class="tag ${f.tipo==='ingreso'?'tag-green':'tag-red'}">${f.tipo==='ingreso'?'💰 Ingreso':'📤 Gasto'}</span></td>
      <td style="font-weight:700;color:${f.tipo==='ingreso'?'#15803D':'#B91C1C'}">${f.tipo==='ingreso'?'+':'−'}${fmtC(f.monto)}</td>
    </tr>`).join('')}</tbody></table>`
    : '<p style="color:#94A3B8;text-align:center;padding:16px">Sin transacciones en este período</p>'}

    ${factData.length ? `<div class="section-title">🧾 Facturas del Período</div>
    <table><thead><tr><th>N° Factura</th><th>Paciente</th><th>Fecha</th><th>Estado</th><th>Total</th></tr></thead>
    <tbody>${[...factData].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map(f=>`<tr>
      <td><code style="font-size:10px">${f.numero||'—'}</code></td>
      <td>${f.pacienteNombre||'—'}</td>
      <td>${formatFecha(f.fecha)}</td>
      <td><span class="tag ${estadoFact(f.estado)}">${f.estado}</span></td>
      <td style="font-weight:700">${fmtC(f.total)}</td>
    </tr>`).join('')}</tbody></table>` : ''}`;

  pdfAbrir('Resumen Financiero — ' + periodoLabel, body, cfg);
}

function renderTransacciones() {
  const {from,to} = getFinDateRange();
  let data = (C.fin||[]).filter(f=>f.fecha>=from && f.fecha<=to);
  if(finTipoFiltro) data = data.filter(f=>f.tipo===finTipoFiltro);
  data.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const el = document.getElementById('fin-trans-list');
  if(!el) return;
  if(!data.length) { el.innerHTML='<div class="empty-state" style="padding:40px"><div class="empty-icon">📋</div><p>No hay transacciones en este período</p></div>'; return; }
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const totalIng = data.filter(x=>x.tipo==='ingreso').reduce((s,x)=>s+x.monto,0);
  const totalEgr = data.filter(x=>x.tipo==='egreso').reduce((s,x)=>s+x.monto,0);
  el.innerHTML = `<div class="fin-list-header">
    <span class="fin-list-header-lbl">${data.length} transaccion${data.length!==1?'es':''}</span>
    <span class="fin-list-header-val"><span style="color:var(--success)">+${fmtC(totalIng)}</span>&nbsp;·&nbsp;<span style="color:var(--danger)">−${fmtC(totalEgr)}</span></span>
  </div>
  <div class="fin-list">`+data.map(f=>{
    const esI=f.tipo==='ingreso';
    const [,mm,dd]=(f.fecha||hoy()).split('-');
    return `<div class="fin-item">
      <div class="fin-date-pill ${esI?'ingreso':'egreso'}">
        <div class="fin-date-day">${dd}</div>
        <div class="fin-date-mon">${MESES[parseInt(mm)-1]}</div>
      </div>
      <div class="fin-item-info">
        <div class="fin-item-title">${f.descripcion}</div>
        <div class="fin-item-meta">${f.categoria||'general'} · ${f.metodoPago||'—'}${f.referencia?' · '+f.referencia:''}</div>
      </div>
      <div class="fin-item-right">
        <span class="tag ${esI?'tag-green':'tag-red'}" style="font-size:10px">${esI?'💰 Ingreso':'📤 Gasto'}</span>
        <span class="fin-monto ${esI?'ingreso':'egreso'}">${esI?'+':'−'}${fmtC(f.monto)}</span>
        <button class="btn btn-sm btn-danger" onclick="eliminarTransaccion(${f.id})" title="Eliminar transacción">🗑️</button>
      </div>
    </div>`;
  }).join('')+'</div>';
}

function setFactEstadoChip(el, estado) {
  document.querySelectorAll('#fact-estado-chips .chip').forEach(c=>c.classList.remove('active'));
  el.classList.add('active');
  renderFacturasList();
}

function renderFacturasList() {
  const {from,to} = getFinDateRange();
  const q = (document.getElementById('fact-search')?.value||'').toLowerCase().trim();
  const estadoChip = document.querySelector('#fact-estado-chips .chip.active')?.dataset?.estado||'';
  let data = (C.fact||[]).filter(f=>{
    if(f.fecha<from || f.fecha>to) return false;
    if(estadoChip && f.estado!==estadoChip) return false;
    if(q && !((f.numero||'').toLowerCase().includes(q)) && !(f.pacienteNombre||'').toLowerCase().includes(q) && !(f.estado||'').toLowerCase().includes(q)) return false;
    return true;
  }).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const estadoTag = e => ({pagada:'tag-green',pendiente:'tag-orange',cancelada:'tag-red',anulada:'tag-gray'})[e]||'tag-gray';
  const el = document.getElementById('fin-fact-list');
  if(!el) return;
  if(!data.length) { el.innerHTML='<div class="empty-state" style="padding:40px"><div class="empty-icon">🧾</div><p>No hay facturas en este período.<br>Usa <strong>+ Nueva Factura</strong> para comenzar.</p></div>'; return; }
  const MESES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  const totalFact = data.reduce((s,f)=>s+f.total,0);
  const pagadas = data.filter(f=>f.estado==='pagada').length;
  const pendientes = data.filter(f=>f.estado==='pendiente').length;
  el.innerHTML = `<div class="fin-list-header">
    <span class="fin-list-header-lbl">${data.length} factura${data.length!==1?'s':''} · <span style="color:var(--success)">${pagadas} pagada${pagadas!==1?'s':''}</span>${pendientes?` · <span style="color:var(--warning)">${pendientes} pendiente${pendientes!==1?'s':''}</span>`:''}</span>
    <span class="fin-list-header-val" style="color:var(--text)">${fmtC(totalFact)}</span>
  </div>
  <div class="fin-list">`+data.map(f=>{
    const [,mm,dd]=(f.fecha||hoy()).split('-');
    const esPend=f.estado==='pendiente';
    return `<div class="fin-item">
      <div class="fin-date-pill factura">
        <div class="fin-date-day">${dd}</div>
        <div class="fin-date-mon">${MESES[parseInt(mm)-1]}</div>
      </div>
      <div class="fin-item-info">
        <div class="fin-item-title">${f.pacienteNombre||'Consumidor Final'}</div>
        <div class="fin-item-meta">${f.numero||'—'} · <strong style="color:var(--text);font-size:12px">${fmtC(f.total)}</strong></div>
      </div>
      <div class="fin-item-right">
        <span class="tag ${estadoTag(f.estado)}">${f.estado}</span>
        <div class="actions-cell" style="gap:4px">
          ${esPend?`<button class="btn btn-sm btn-primary" onclick="pagarFactura(${f.id})" title="Marcar como pagada">✅</button>`:''}
          <button class="btn btn-sm btn-secondary" onclick="verFacturaPDF(${f.id})" title="Ver PDF">🖨️</button>
          ${esPend?`<button class="btn btn-sm btn-danger" onclick="anularFactura(${f.id})" title="Anular factura">❌</button>`:''}
        </div>
      </div>
    </div>`;
  }).join('')+'</div>';
}

// ── Modal Transacción ──
function openModalTransaccion(tipo='ingreso') {
  document.getElementById('trans-tipo').value = tipo;
  const disp = document.getElementById('trans-tipo-display');
  if(disp) {
    disp.textContent  = tipo==='ingreso' ? '💰 Ingreso' : '📤 Gasto';
    disp.style.color  = tipo==='ingreso' ? 'var(--accent-green,#16a34a)' : 'var(--accent-red,#dc2626)';
  }
  document.getElementById('modal-trans-title').textContent = tipo==='ingreso' ? '💰 Nuevo Ingreso' : '📤 Nuevo Gasto';
  document.getElementById('trans-descripcion').value = '';
  document.getElementById('trans-monto').value = '';
  document.getElementById('trans-fecha').value = hoy();
  document.getElementById('trans-metodo').value = 'efectivo';
  document.getElementById('trans-referencia').value = '';
  // Filtrar categorías según tipo
  const catSel = document.getElementById('trans-categoria');
  if(catSel) {
    const ingrCats = ['consulta','procedimiento','medicamento','insumo','equipo','general'];
    const egrCats  = ['nomina','alquiler','servicios','factura','medicamento','insumo','equipo','general'];
    const allowed  = tipo === 'ingreso' ? ingrCats : egrCats;
    Array.from(catSel.options).forEach(o => { o.hidden = !allowed.includes(o.value); });
    const first = Array.from(catSel.options).find(o => !o.hidden);
    if(first) catSel.value = first.value;
  }
  _transInvSeleccion = [];
  const wrap = document.getElementById('trans-compra-inv-wrap');
  if(wrap) wrap.style.display = 'none';
  const chips = document.getElementById('trans-inv-chips');
  if(chips) chips.innerHTML = '';
  const resumen = document.getElementById('trans-inv-seleccionados-resumen');
  if(resumen) resumen.style.display = 'none';
  document.getElementById('modal-transaccion').classList.add('open');
  setTimeout(initDatePickers, 50);
}

// Almacena la selección del modal de inventario: { id, nombre, cantidad, unidad }
let _transInvSeleccion = [];
let _sinvCat = '';

function toggleTransCompraInv() {
  const tipo = document.getElementById('trans-tipo')?.value;
  const cat  = document.getElementById('trans-categoria')?.value;
  const wrap = document.getElementById('trans-compra-inv-wrap');
  if(!wrap) return;
  const mostrar = ['medicamento','insumo','equipo','material','general'].includes(cat);
  wrap.style.display = mostrar ? '' : 'none';
  const lbl = document.getElementById('trans-compra-inv-label');
  if(lbl) lbl.textContent = tipo === 'ingreso'
    ? 'Productos que ingresan — se agregarán al inventario automáticamente'
    : 'Productos que egresan — se descontarán del inventario automáticamente';
}

function abrirModalSeleccionInv() {
  _sinvCat = '';
  document.querySelectorAll('#sinv-cat-chips .chip').forEach((c,i) => c.classList.toggle('active', i===0));
  const buscar = document.getElementById('sinv-buscar'); if(buscar) buscar.value = '';
  renderModalInvLista();
  actualizarResumenSinv();
  openModalOverlay('modal-seleccion-inv');
}

function setSinvCat(cat, el) {
  _sinvCat = cat;
  document.querySelectorAll('#sinv-cat-chips .chip').forEach(c => c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderModalInvLista();
}

function renderModalInvLista() {
  const lista = document.getElementById('sinv-lista');
  if(!lista) return;
  const q = (document.getElementById('sinv-buscar')?.value || '').toLowerCase();
  const catIcon = { medicamento:'💊', material:'🩺', insumo:'🧹', equipo:'🔬', papeleria:'📄', general:'📦' };
  const catLabel = { medicamento:'Medicamento', material:'Material', insumo:'Insumo', equipo:'Equipo', papeleria:'Papelería', general:'General' };
  const catColor = { medicamento:'#EFF6FF', material:'#F0FDF4', insumo:'#FFFBEB', equipo:'#F5F3FF', general:'#F1F5F9' };

  const productos = C.inv.filter(p =>
    (!_sinvCat || p.categoria === _sinvCat) &&
    (!q || p.nombre.toLowerCase().includes(q) || (p.descripcion||'').toLowerCase().includes(q))
  );

  if(!productos.length) {
    lista.innerHTML = '<div style="color:var(--text-light);font-size:13px;text-align:center;padding:32px">No se encontraron productos</div>';
    return;
  }

  lista.innerHTML = productos.map(p => {
    const sel = _transInvSeleccion.find(s => s.id === p.id);
    const checked = !!sel;
    const cantVal = sel ? sel.cantidad : 1;
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:12px;border:1.5px solid ${checked?'var(--primary)':'var(--border)'};background:${checked?'var(--primary-light)':'var(--card)'};transition:all .15s" id="sinv-row-${p.id}">
      <input type="checkbox" data-id="${p.id}" ${checked?'checked':''} style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer;flex-shrink:0" onchange="onSinvCheck(this)">
      <div style="width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;background:${catColor[p.categoria]||'#F1F5F9'}">${catIcon[p.categoria]||'📦'}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:14px;font-weight:700">${p.nombre}</div>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">
          <span class="tag tag-gray" style="font-size:10px">${catLabel[p.categoria]||p.categoria}</span>
          &nbsp;Stock: <strong>${p.stock}</strong> ${p.unidad}
          ${p.precio?`&nbsp;·&nbsp;${fmtC(p.precio)} / ${p.unidad}`:''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:6px;flex-shrink:0">
        <label style="font-size:11px;color:var(--text-light)">Cantidad:</label>
        <input type="number" id="sinv-cant-${p.id}" min="1" value="${cantVal}"
          style="width:68px;padding:6px 8px;border:1.5px solid var(--border);border-radius:8px;font-size:13px;font-weight:600;background:var(--bg);color:var(--text);font-family:inherit;outline:none;text-align:center"
          onclick="event.stopPropagation()" onchange="onSinvCantChange(${p.id},this.value)">
        <span style="font-size:11px;color:var(--text-light)">${p.unidad}</span>
      </div>
    </div>`;
  }).join('');
}

function onSinvCheck(cb) {
  const id = parseInt(cb.dataset.id);
  const prod = C.inv.find(p => p.id === id);
  const row = document.getElementById('sinv-row-' + id);
  if(cb.checked) {
    if(!_transInvSeleccion.find(s => s.id === id)) {
      const cant = parseInt(document.getElementById('sinv-cant-'+id)?.value||1,10)||1;
      _transInvSeleccion.push({ id, nombre: prod?.nombre||'—', cantidad: cant, unidad: prod?.unidad||'uds', precio: prod?.precio||0 });
    }
    if(row) { row.style.borderColor='var(--primary)'; row.style.background='var(--primary-light)'; }
  } else {
    _transInvSeleccion = _transInvSeleccion.filter(s => s.id !== id);
    if(row) { row.style.borderColor='var(--border)'; row.style.background='var(--card)'; }
  }
  actualizarResumenSinv();
}

function onSinvCantChange(id, valor) {
  const nueva = parseInt(valor, 10) || 1;
  const idx = _transInvSeleccion.findIndex(s => s.id === id);
  if(idx >= 0) _transInvSeleccion[idx].cantidad = nueva;
  actualizarResumenSinv();
}

function autoMontoTransInv() {
  if(!_transInvSeleccion.length) return;
  const total = _transInvSeleccion.reduce((sum, s) => sum + ((s.precio||0) * s.cantidad), 0);
  if(total > 0) {
    const montoEl = document.getElementById('trans-monto');
    if(montoEl) montoEl.value = total.toFixed(2);
  }
}

function actualizarResumenSinv() {
  const countEl = document.getElementById('sinv-count');
  const resEl = document.getElementById('sinv-resumen');
  if(countEl) countEl.textContent = _transInvSeleccion.length;
  if(resEl) {
    resEl.innerHTML = !_transInvSeleccion.length
      ? '<span style="font-size:12px;color:var(--text-light)">Ningún producto seleccionado aún</span>'
      : _transInvSeleccion.map(s => `
          <span style="display:inline-flex;align-items:center;gap:5px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">
            💊 ${s.nombre} ×${s.cantidad}
            <span onclick="quitarSinvItem(${s.id})" style="cursor:pointer;color:var(--danger);font-weight:700;margin-left:2px">✕</span>
          </span>`).join('');
  }
}

function quitarSinvItem(id) {
  _transInvSeleccion = _transInvSeleccion.filter(s => s.id !== id);
  renderModalInvLista();
  actualizarResumenSinv();
  autoMontoTransInv();
}

function confirmarSeleccionInv() {
  closeModal('modal-seleccion-inv');
  actualizarChipsSinv();
  if(_transInvSeleccion.length) {
    autoDescripcionTransInv();
    autoMontoTransInv();
  }
}

function actualizarChipsSinv() {
  const chips = document.getElementById('trans-inv-chips');
  const resumen = document.getElementById('trans-inv-seleccionados-resumen');
  if(!chips || !resumen) return;
  if(!_transInvSeleccion.length) { resumen.style.display='none'; return; }
  resumen.style.display='';
  chips.innerHTML = _transInvSeleccion.map(s => `
    <span style="display:inline-flex;align-items:center;gap:5px;background:var(--primary-light);color:var(--primary);border:1px solid var(--primary);border-radius:20px;padding:3px 10px;font-size:12px;font-weight:600">
      ${s.nombre} ×${s.cantidad}
      <span onclick="quitarChipSinv(${s.id})" style="cursor:pointer;color:var(--danger);font-weight:700">✕</span>
    </span>`).join('');
}

function quitarChipSinv(id) {
  _transInvSeleccion = _transInvSeleccion.filter(s => s.id !== id);
  actualizarChipsSinv();
  autoDescripcionTransInv();
}

function autoDescripcionTransInv() {
  const desc = document.getElementById('trans-descripcion');
  if(!desc || !_transInvSeleccion.length) return;
  const tipo = document.getElementById('trans-tipo')?.value;
  const prefijo = tipo === 'ingreso' ? 'Ingreso' : 'Gasto';
  desc.value = prefijo + ': ' + _transInvSeleccion.map(s => `${s.nombre} ×${s.cantidad}`).join(', ');
}

function getTransInvSeleccionados() { return [..._transInvSeleccion]; }

function filtrarTransInv() {} // legacy, no-op

async function guardarTransaccion() {
  if(!currentClinicaId){ toast('Sin clínica asignada','error'); return; }
  const tipo   = document.getElementById('trans-tipo').value;
  const desc   = document.getElementById('trans-descripcion').value.trim();
  const monto  = parseFloat(document.getElementById('trans-monto').value);
  const fecha  = document.getElementById('trans-fecha').value || hoy();
  const cat    = document.getElementById('trans-categoria').value||'general';
  const metodo = document.getElementById('trans-metodo').value||'efectivo';
  const ref    = document.getElementById('trans-referencia').value.trim();
  if(!desc){ toast('Ingresa una descripción','error'); return; }
  if(!monto||monto<=0){ toast('Ingresa un monto válido','error'); return; }
  const btn = document.querySelector('[onclick="guardarTransaccion()"]');
  if(!_lockSubmit('trans', btn)) return;

  // Productos de inventario seleccionados (ingreso o egreso con categoría física)
  const tieneInv = ['medicamento','insumo','equipo','material','general'].includes(cat);
  const productosSeleccionados = tieneInv ? getTransInvSeleccionados() : [];

  setLoading(true);

  // Guardar registro en finanzas — obtener ID para enlazar con movimientos
  const {data: finData, error} = await sb.from('finanzas').insert({
    clinica_id:currentClinicaId, tipo, descripcion:desc, monto, fecha,
    categoria:cat, metodo_pago:metodo, referencia:ref||null, creado_por:currentUser?.name
  }).select('id').single();
  if(error){ toast('Error al guardar transacción','error'); setLoading(false); _unlockSubmit('trans', btn); return; }

  // Si hay productos seleccionados, mover inventario
  if(productosSeleccionados.length) {
    // Validar stock suficiente para egresos antes de proceder
    if(tipo === 'egreso') {
      const sinStock = productosSeleccionados.filter(s => {
        const prod = C.inv.find(p => p.id === s.id);
        return prod && s.cantidad > prod.stock;
      });
      if(sinStock.length) {
        const nombres = sinStock.map(s => {
          const prod = C.inv.find(p => p.id === s.id);
          return `• ${s.nombre}: disponible ${prod?.stock||0}, solicitado ${s.cantidad}`;
        }).join('<br>');
        const continuar = await customConfirm({
          icon:'⚠️', title:'Stock insuficiente',
          msg:`Los siguientes productos no tienen stock suficiente:<br><br>${nombres}<br><br>¿Registrar el gasto de todos modos?`,
          okText:'Registrar de todos modos', danger:false
        });
        if(!continuar) { setLoading(false); _unlockSubmit('trans', btn); return; }
      }
    }
    const tipoMov  = tipo === 'ingreso' ? 'entrada' : 'salida';
    // motivo incluye el ID de la finanza para poder revertir si se elimina
    const motivoMov = `fin:${finData.id}`;
    const movimientos = productosSeleccionados.map(s => ({
      inventario_id: s.id, tipo: tipoMov, cantidad: s.cantidad,
      motivo: motivoMov, fecha, clinica_id: currentClinicaId
    }));
    const { error: movErr } = await sb.from('inventario_movimientos').insert(movimientos);
    if(movErr) {
      toast('Transacción guardada pero error al actualizar inventario: ' + movErr.message, 'info');
    } else {
      for(const s of productosSeleccionados) {
        const prod = C.inv.find(p => p.id === s.id);
        if(prod) {
          const nuevoStock = tipo === 'ingreso'
            ? prod.stock + s.cantidad
            : Math.max(0, prod.stock - s.cantidad);
          await sb.from('inventario').update({ stock_actual: nuevoStock }).eq('id', s.id);
          prod.stock = nuevoStock;
        }
      }
      const accion = tipo === 'ingreso' ? 'agregados al' : 'descontados del';
      toast(`${tipo==='ingreso'?'Ingreso 💰':'Gasto 📤'} registrado · ${productosSeleccionados.length} producto(s) ${accion} inventario 📦`);
    }
  } else {
    toast(tipo==='ingreso'?'Ingreso registrado 💰':'Gasto registrado 📤');
  }

  _unlockSubmit('trans', btn);
  closeModal('modal-transaccion');
  await loadAll(); renderFinanzas(); setLoading(false);
}

async function eliminarTransaccion(id) {
  const ok = await customConfirm({icon:'🗑️',title:'Eliminar transacción',msg:'¿Seguro que deseas eliminar esta transacción? No se puede deshacer.',okText:'Eliminar',danger:true});
  if(!ok) return;
  setLoading(true);

  // Revertir movimientos de inventario enlazados a esta transacción
  const { data: movs } = await sb.from('inventario_movimientos')
    .select('*').eq('motivo', `fin:${id}`).eq('clinica_id', currentClinicaId);
  if(movs && movs.length) {
    for(const mov of movs) {
      const prod = C.inv.find(p => p.id === mov.inventario_id);
      if(prod) {
        // Invertir: si fue entrada, se resta; si fue salida, se suma
        const stockRevertido = mov.tipo === 'entrada'
          ? Math.max(0, prod.stock - mov.cantidad)
          : prod.stock + mov.cantidad;
        await sb.from('inventario').update({ stock_actual: stockRevertido }).eq('id', mov.inventario_id);
      }
    }
    await sb.from('inventario_movimientos').delete().eq('motivo', `fin:${id}`).eq('clinica_id', currentClinicaId);
  }

  await sb.from('finanzas').delete().eq('id',id);
  toast('Transacción eliminada' + (movs?.length ? ` · ${movs.length} movimiento(s) de inventario revertido(s)` : ''));
  await loadAll(); renderFinanzas(); setLoading(false);
}

// ── Modal Factura ──
function generarNumFactura() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const prefix = `FACT-${y}${m}-`;
  const existing = (C.fact||[])
    .map(f => parseInt((f.numero||'').replace(prefix,''),10))
    .filter(n => !isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(4,'0')}`;
}

function openModalFactura(citaId=null, pacienteId=null) {
  editingFacturaId = null;
  facturaItems = [];
  _factItemCounter = 0;
  document.getElementById('fact-numero').value = generarNumFactura();
  document.getElementById('fact-fecha').value = hoy();
  document.getElementById('fact-cita-id').value = citaId||'';
  document.getElementById('fact-notas').value = '';
  const sel = document.getElementById('fact-paciente');
  sel.innerHTML = '<option value="">Consumidor Final</option>' +
    C.p.map(p=>`<option value="${p.id}"${p.id==pacienteId?' selected':''}>${p.nombre} ${p.apellidos}</option>`).join('');
  renderFacturaItemsUI();
  calcFacturaTotals();
  document.getElementById('modal-factura').classList.add('open');
  setTimeout(initDatePickers, 50);
}

function addFacturaItem(desc='', tipo='servicio', cant=1, precio=0, invId=null) {
  const id = ++_factItemCounter;
  facturaItems.push({id, desc, tipo, cant:Number(cant)||1, precio:Number(precio)||0, invId});
  renderFacturaItemsUI();
  calcFacturaTotals();
}

function addFacturaItemFromInv() {
  const inv = C.inv.filter(p=>p.precio>0);
  if(!inv.length){ toast('No hay productos con precio en el inventario','warning'); return; }
  const options = inv.map(p=>`<option value="${p.id}">${p.nombre} (${fmtC(p.precio)})</option>`).join('');
  const sel = document.createElement('select');
  sel.innerHTML = '<option value="">Seleccionar producto...</option>' + options;
  sel.style.cssText = 'width:100%;padding:8px 12px;border:1.5px solid var(--border);border-radius:10px;font-size:13px;margin-bottom:12px';
  const wrap = document.getElementById('fact-items-list');
  wrap.prepend(sel);
  sel.onchange = () => {
    const p = inv.find(x=>x.id==sel.value);
    if(p){ addFacturaItem(p.nombre,'producto',1,p.precio,p.id); sel.remove(); }
  };
}

function removeFacturaItem(id) {
  facturaItems = facturaItems.filter(i=>i.id!==id);
  renderFacturaItemsUI();
  calcFacturaTotals();
}

function updateFactItem(id, field, value) {
  const item = facturaItems.find(i=>i.id===id);
  if(item){ item[field]=value; calcFacturaTotals(); }
}

function renderFacturaItemsUI() {
  const el = document.getElementById('fact-items-list');
  if(!el) return;
  if(!facturaItems.length) {
    el.innerHTML='<p style="color:var(--text-light);font-size:13px;text-align:center;padding:20px 0">Agrega líneas usando los botones de arriba</p>';
    return;
  }
  el.innerHTML = facturaItems.map(item=>`
    <div class="fact-item-row">
      <select style="width:120px;flex-shrink:0" onchange="updateFactItem(${item.id},'tipo',this.value)">
        <option value="consulta"${item.tipo==='consulta'?' selected':''}>👨‍⚕️ Consulta</option>
        <option value="servicio"${item.tipo==='servicio'?' selected':''}>🩺 Servicio</option>
        <option value="producto"${item.tipo==='producto'?' selected':''}>📦 Producto</option>
        <option value="procedimiento"${item.tipo==='procedimiento'?' selected':''}>🔬 Procedimiento</option>
      </select>
      <input type="text" value="${item.desc}" placeholder="Descripción..."
        oninput="updateFactItem(${item.id},'desc',this.value)" style="flex:1;min-width:120px">
      <input type="number" value="${item.cant}" min="0.01" step="0.01" placeholder="Cant."
        oninput="updateFactItem(${item.id},'cant',parseFloat(this.value)||0)" style="width:65px;flex-shrink:0">
      <input type="number" value="${item.precio}" min="0" step="0.01" placeholder="Precio"
        oninput="updateFactItem(${item.id},'precio',parseFloat(this.value)||0)" style="width:100px;flex-shrink:0">
      <span class="fact-item-sub">${fmtC((item.cant||0)*(item.precio||0))}</span>
      <button onclick="removeFacturaItem(${item.id})" style="background:#FEF2F2;color:#B91C1C;border:none;border-radius:6px;padding:4px 8px;cursor:pointer;flex-shrink:0;font-size:13px">✕</button>
    </div>`).join('');
}

function calcFacturaTotals() {
  const sub = facturaItems.reduce((s,i)=>s+(i.cant||0)*(i.precio||0),0);
  const s=document.getElementById('fact-subtotal'), t=document.getElementById('fact-total');
  if(s) s.textContent=fmtC(sub);
  if(t) t.textContent=fmtC(sub);
}

async function guardarFactura() {
  if(!currentClinicaId){ toast('Sin clínica asignada','error'); return; }
  if(!facturaItems.length){ toast('Agrega al menos un servicio o producto','error'); return; }
  const sub = facturaItems.reduce((s,i)=>s+(i.cant||0)*(i.precio||0),0);
  if(sub <= 0){ toast('El total de la factura debe ser mayor a cero','error'); return; }
  const btn = document.querySelector('[onclick="guardarFactura()"]');
  if(!_lockSubmit('factura', btn)) return;
  const numero  = document.getElementById('fact-numero').value.trim()||generarNumFactura();
  const fecha   = document.getElementById('fact-fecha').value||hoy();
  const pacId   = parseInt(document.getElementById('fact-paciente').value)||null;
  const citaId  = parseInt(document.getElementById('fact-cita-id').value)||null;
  const notas   = document.getElementById('fact-notas').value.trim();
  const tot     = sub;
  const pac     = pacId ? C.p.find(p=>p.id===pacId) : null;
  const pacNom  = pac ? `${pac.nombre} ${pac.apellidos}` : 'Consumidor Final';
  setLoading(true);
  const {data:factData, error:factErr} = await sb.from('facturas').insert({
    clinica_id:currentClinicaId, numero, paciente_id:pacId, paciente_nombre:pacNom,
    fecha, estado:'pendiente', subtotal:sub, impuesto_pct:0, impuesto:0,
    total:tot, notas:notas||null, cita_id:citaId
  }).select().single();
  if(factErr){ toast('Error al generar factura','error'); setLoading(false); _unlockSubmit('factura', btn); return; }
  if(facturaItems.length) {
    const {error:itemsErr} = await sb.from('factura_items').insert(facturaItems.map(i=>({
      factura_id:factData.id, descripcion:i.desc, tipo:i.tipo,
      cantidad:i.cant, precio_unitario:i.precio,
      subtotal:(i.cant||0)*(i.precio||0), inventario_id:i.invId||null
    })));
    if(itemsErr) toast('Factura creada pero error al guardar ítems: '+itemsErr.message, 'warning');
  }
  toast('Factura generada 🧾');
  _unlockSubmit('factura', btn);
  closeModal('modal-factura');
  await loadAll(); renderFinanzas(); setLoading(false);
}

async function pagarFactura(id) {
  const fact = (C.fact||[]).find(f=>f.id===id);
  if(!fact) return;
  const metodosOpts = ['efectivo','tarjeta','transferencia','cheque','otro']
    .map(m=>`<option value="${m}">${m.charAt(0).toUpperCase()+m.slice(1)}</option>`).join('');
  const ok = await customConfirm({icon:'✅',title:'Confirmar pago',
    msg:`¿Confirmas el pago de la factura <strong>${fact.numero||'#'+id}</strong>?<br>Total: <strong>${fmtC(fact.total)}</strong><br><br>
      <label style="font-size:13px;font-weight:600">Método de pago:<br>
        <select id="pagar-metodo" style="margin-top:6px;width:100%;padding:8px 10px;border:1.5px solid var(--border);border-radius:8px;font-size:13px">
          ${metodosOpts}
        </select>
      </label>`,
    okText:'Confirmar pago',danger:false});
  if(!ok) return;
  const metodo = document.getElementById('pagar-metodo')?.value || 'efectivo';
  setLoading(true);
  await sb.from('facturas').update({estado:'pagada'}).eq('id',id);
  await sb.from('finanzas').insert({
    clinica_id:currentClinicaId, tipo:'ingreso', categoria:'factura',
    descripcion:`Pago factura ${fact.numero||'#'+id} — ${fact.pacienteNombre}`,
    monto:fact.total, fecha:hoy(), metodo_pago:metodo,
    referencia:fact.numero||null, creado_por:currentUser?.name
  });

  // Descontar inventario para ítems de tipo producto con inventario_id
  const itemsFact = (C.factItems||[]).filter(i => i.facturaId === id && i.inventarioId);
  if(itemsFact.length) {
    const movsInv = itemsFact.map(i => ({
      inventario_id: i.inventarioId, tipo: 'salida', cantidad: i.cantidad,
      motivo: `factura:${fact.numero||id}`, fecha: hoy(), clinica_id: currentClinicaId
    }));
    const { error: movErr } = await sb.from('inventario_movimientos').insert(movsInv);
    if(!movErr) {
      for(const item of itemsFact) {
        const prod = C.inv.find(p => p.id === item.inventarioId);
        if(prod) {
          const nuevoStock = Math.max(0, prod.stock - item.cantidad);
          await sb.from('inventario').update({ stock_actual: nuevoStock }).eq('id', item.inventarioId);
        }
      }
    }
  }

  const invMsg = itemsFact.length ? ` · ${itemsFact.length} producto(s) descontado(s) del inventario` : '';
  toast('Factura pagada ✅ — ingreso registrado automáticamente' + invMsg);
  await loadAll(); renderFacturasList(); setLoading(false);
}

async function anularFactura(id) {
  const ok = await customConfirm({icon:'❌',title:'Anular factura',msg:'¿Seguro que deseas anular esta factura?',okText:'Anular',danger:true});
  if(!ok) return;
  setLoading(true);
  await sb.from('facturas').update({estado:'anulada'}).eq('id',id);
  toast('Factura anulada');
  await loadAll(); renderFacturasList(); setLoading(false);
}

function verFacturaPDF(id) {
  const fact = (C.fact||[]).find(f=>f.id===id);
  if(!fact) return;
  const items = (C.factItems||[]).filter(i=>i.facturaId===id);
  const cl = currentClinica;
  const body = `
    <div style="text-align:center;margin-bottom:24px;padding-bottom:20px;border-bottom:2px solid #e2e8f0">
      <h1 style="font-size:22px;font-weight:800;color:#0f172a;margin-bottom:4px">${cl?.nombre||'Clínica'}</h1>
      <p style="color:#64748b;font-size:12px">${cl?.direccion||''} ${cl?.telefono?'· Tel: '+cl.telefono:''}</p>
    </div>
    <div style="display:flex;justify-content:space-between;margin-bottom:20px;padding:14px;background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0">
      <div>
        <p style="font-size:18px;font-weight:800;color:#0f172a">FACTURA</p>
        <p style="color:#64748b;font-size:13px">N°: <strong>${fact.numero||'—'}</strong></p>
        <p style="color:#64748b;font-size:13px">Fecha: ${formatFecha(fact.fecha)}</p>
        <p style="color:#64748b;font-size:13px">Estado: <strong style="color:${fact.estado==='pagada'?'#16a34a':'#b45309'}">${fact.estado.toUpperCase()}</strong></p>
      </div>
      <div style="text-align:right">
        <p style="font-weight:700;color:#0f172a">Facturar a:</p>
        <p style="font-size:14px">${fact.pacienteNombre}</p>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
      <thead style="background:#0f172a;color:#fff">
        <tr>
          <th style="padding:8px 12px;text-align:left">Descripción</th>
          <th style="padding:8px 12px;text-align:center">Cant.</th>
          <th style="padding:8px 12px;text-align:right">Precio Unit.</th>
          <th style="padding:8px 12px;text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((i,idx)=>`<tr style="background:${idx%2===0?'#fff':'#f8fafc'};border-bottom:1px solid #e2e8f0">
          <td style="padding:8px 12px">${i.descripcion}</td>
          <td style="padding:8px 12px;text-align:center">${i.cantidad}</td>
          <td style="padding:8px 12px;text-align:right">${fmtC(i.precioUnitario)}</td>
          <td style="padding:8px 12px;text-align:right">${fmtC(i.subtotal)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div style="display:flex;justify-content:flex-end">
      <div style="min-width:240px;border-top:2px solid #0f172a;padding-top:12px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px;font-size:13px">
          <span style="color:#64748b">Subtotal</span><strong>${fmtC(fact.subtotal)}</strong>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:16px;font-weight:800;color:#0f172a;border-top:1px solid #e2e8f0;padding-top:8px;margin-top:8px">
          <span>TOTAL</span><span>${fmtC(fact.total)}</span>
        </div>
      </div>
    </div>
    ${fact.notas?`<div style="margin-top:20px;padding:12px;background:#f8fafc;border-radius:8px;font-size:12px;color:#64748b;border:1px solid #e2e8f0"><strong>Notas:</strong> ${fact.notas}</div>`:''}
    <div style="text-align:center;margin-top:28px;color:#94a3b8;font-size:11px">
      Lumea Med — Sistema de Gestión Clínica | lumeamed.net
    </div>`;
  pdfAbrir(`Factura ${fact.numero||'#'+id}`, body, {orientation:'portrait'});
}

// ═══════════════════════════════════════════════
//  MÓDULO EXPEDIENTES
// ═══════════════════════════════════════════════
let expSearchTerm = '';

async function generarExpediente(pid) {
  if(!currentClinicaId) return;
  const initials = (currentClinica?.codigo||currentClinica?.nombre||'EXP').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,4);
  const year = new Date().getFullYear();
  const seq = C.p.filter(p=>p.expediente).length + 1;
  const numExp = `${initials}-${String(seq).padStart(3,'0')}`;
  const { error } = await sb.from('pacientes').update({expediente:numExp}).eq('id',pid);
  if(error){ toast('Error al asignar: '+error.message,'error'); return; }
  await loadAll(); renderExpedientes();
  toast(`Expediente ${numExp} asignado ✅`,'success');
}

function renderExpedientes() {
  filtrarExpedientes(expSearchTerm);
}

function filtrarExpedientes(q) {
  expSearchTerm = (q||'').toLowerCase().trim();
  const el = document.getElementById('exp-list');
  if(!el) return;
  const list = expSearchTerm
    ? C.p.filter(p => `${p.nombre} ${p.apellidos} ${p.expediente||''} ${p.identificacion||''}`.toLowerCase().includes(expSearchTerm))
    : C.p;
  if(!list.length) {
    el.innerHTML = `<p style="color:var(--text-light);text-align:center;padding:32px 0;font-size:14px">${expSearchTerm ? 'Sin resultados para "'+expSearchTerm+'"' : 'No hay pacientes registrados en esta clínica'}</p>`;
    return;
  }
  el.innerHTML = `
    <table class="table" style="margin-top:0">
      <thead><tr>
        <th>N° Expediente</th><th>Paciente</th><th>Edad</th><th>Tipo Sangre</th><th>Última cita</th><th>Estado</th><th style="text-align:right">Acciones</th>
      </tr></thead>
      <tbody>${list.map(p => {
        const lastCita = C.c.filter(c=>c.pacienteId===p.id).sort((a,b)=>b.fecha.localeCompare(a.fecha))[0];
        const edad = p.fechaNac ? _getEdadNum(p.fechaNac) : '—';
        const estadoTag = p.estado==='activo'
          ? '<span class="tag tag-green">Activo</span>'
          : '<span class="tag tag-gray">Inactivo</span>';
        return `<tr>
          <td>${p.expediente
            ? `<strong style="font-family:monospace;letter-spacing:.5px">${p.expediente}</strong>`
            : `<button class="btn btn-sm btn-secondary" onclick="generarExpediente(${p.id})" style="padding:3px 10px;font-size:11px">Asignar N°</button>`
          }</td>
          <td>
            <div style="font-weight:600">${p.nombre} ${p.apellidos}</div>
            <div style="font-size:12px;color:var(--text-light)">${p.telefono||'Sin teléfono'}</div>
          </td>
          <td>${edad !== '—' ? edad + ' años' : '—'}</td>
          <td>${p.tipoSangre||'—'}</td>
          <td>${lastCita ? formatFecha(lastCita.fecha) : '<span style="color:var(--text-light)">Sin citas</span>'}</td>
          <td>${estadoTag}</td>
          <td style="text-align:right">
            <button class="btn btn-secondary btn-sm" onclick="navigate('paciente-detalle',${p.id})" style="margin-right:6px">👁 Ver</button>
            <button class="btn btn-primary btn-sm" onclick="renderExpedienteHistorialPDF(${p.id})">📥 PDF</button>
          </td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <p style="font-size:12px;color:var(--text-light);padding:8px 4px">${list.length} expediente${list.length!==1?'s':''} encontrado${list.length!==1?'s':''}</p>`;
}

function renderExpedienteHistorialPDF(pacienteId) {
  const p   = C.p.find(x=>x.id===pacienteId);
  if(!p) return;
  const exp  = C.e.find(x=>x.pacienteId===pacienteId);
  const citas = C.c.filter(x=>x.pacienteId===pacienteId).sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const meds  = C.m.filter(x=>x.pacienteId===pacienteId);
  const notas = C.n.filter(x=>x.pacienteId===pacienteId);
  const movs  = (C.mov||[]).filter(x=>x.pacienteId===pacienteId||x.referencia?.includes(p.nombre));
  const facts = (C.fact||[]).filter(x=>x.pacienteId===pacienteId);
  const edad  = _getEdadNum(p.fechaNac);
  const cl    = currentClinica;

  const sectionTitle = (icon, title, color='#0f172a') =>
    `<div style="background:${color};color:white;padding:10px 16px;border-radius:8px;margin:20px 0 12px;font-weight:700;font-size:14px">${icon} ${title}</div>`;

  const field = (label, val) => val
    ? `<div style="display:flex;gap:8px;padding:5px 0;border-bottom:1px solid #f1f5f9;font-size:13px"><span style="color:#64748b;min-width:160px">${label}</span><strong>${val}</strong></div>`
    : '';

  // ── Sección 1: Datos del paciente
  const secPaciente = `
    ${sectionTitle('👤','Datos del Paciente','#1e40af')}
    ${field('N° Expediente', p.expediente)}
    ${field('Nombre completo', p.nombre+' '+p.apellidos)}
    ${field('Identificación', p.identificacion)}
    ${field('Fecha de nacimiento', p.fechaNac ? formatFecha(p.fechaNac)+(edad?' ('+edad+' años)':'') : null)}
    ${field('Sexo', p.sexo)}
    ${field('Tipo de sangre', p.tipoSangre)}
    ${field('Teléfono', p.telefono)}
    ${field('Email', p.email)}
    ${field('Dirección', p.direccion)}
    ${field('Alergias', p.alergias)}
    ${field('Emergencia', p.contactoEmergencia)}
    ${p.observaciones?`<div style="margin-top:8px;padding:10px;background:#f8fafc;border-radius:6px;font-size:13px"><strong>Observaciones:</strong> ${p.observaciones}</div>`:''}`;

  // ── Sección 2: Antecedentes médicos
  const secExp = exp ? `
    ${sectionTitle('🩺','Antecedentes Médicos','#0f766e')}
    ${field('Peso', exp.peso ? exp.peso+' kg' : null)}
    ${field('Talla', exp.talla ? exp.talla+' cm' : null)}
    ${field('Presión arterial', exp.presion)}
    ${field('Temperatura', exp.temperatura ? exp.temperatura+' °C' : null)}
    ${field('Enfermedades crónicas', exp.enfermedadesCronicas)}
    ${field('Cirugías previas', exp.cirugias)}
    ${field('Antecedentes familiares', exp.antecedentesFamiliares)}
    ${field('Vacunas', exp.vacunas)}
    ${field('Tabaco', exp.tabaco)}
    ${field('Alcohol', exp.alcohol)}
    ${field('Actividad física', exp.actividadFisica)}
    ${field('Ocupación', exp.ocupacion)}
    ${field('Estado civil', exp.estadoCivil)}
    ${exp.observaciones?`<div style="margin-top:8px;padding:10px;background:#f0fdfa;border-radius:6px;font-size:13px"><strong>Observaciones:</strong> ${exp.observaciones}</div>`:''}` : '';

  // ── Sección 3: Historial de citas
  const secCitas = citas.length ? `
    ${sectionTitle('📅','Historial de Citas','#7c3aed')}
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Fecha</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Tipo</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Motivo</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Estado</th>
      </tr></thead>
      <tbody>${citas.map(c=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:7px 10px">${formatFecha(c.fecha)} ${c.hora||''}</td>
        <td style="padding:7px 10px">${c.tipo||'consulta'}</td>
        <td style="padding:7px 10px">${c.motivo||'—'}</td>
        <td style="padding:7px 10px">${c.estado||'—'}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  // ── Sección 4: Medicaciones
  const secMeds = meds.length ? `
    ${sectionTitle('💊','Medicaciones','#b45309')}
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Medicamento</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Dosis</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Frecuencia</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Estado</th>
      </tr></thead>
      <tbody>${meds.map(m=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:7px 10px"><strong>${m.nombre}</strong></td>
        <td style="padding:7px 10px">${m.dosis||'—'}</td>
        <td style="padding:7px 10px">${m.frecuencia||'—'}</td>
        <td style="padding:7px 10px">${m.estado||'—'}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  // ── Sección 5: Notas clínicas
  const secNotas = notas.length ? `
    ${sectionTitle('📝','Notas Clínicas','#0369a1')}
    ${notas.map(n=>`
      <div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;margin-bottom:6px">
          <strong style="font-size:13px">${n.titulo||'Nota'}</strong>
          <span style="font-size:11px;color:#64748b">${formatFecha(n.fecha||n.createdAt)} · ${n.tipo||'nota'}</span>
        </div>
        <p style="font-size:12px;color:#374151;margin:0;white-space:pre-wrap">${n.contenido||'—'}</p>
      </div>`).join('')}` : '';

  // ── Sección 6: Facturas
  const secFacts = facts.length ? `
    ${sectionTitle('🧾','Facturas','#166534')}
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">N° Factura</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Fecha</th>
        <th style="padding:7px 10px;text-align:right;border-bottom:2px solid #e2e8f0">Total</th>
        <th style="padding:7px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Estado</th>
      </tr></thead>
      <tbody>${facts.map(f=>`<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:7px 10px">${f.numero||'—'}</td>
        <td style="padding:7px 10px">${formatFecha(f.fecha)}</td>
        <td style="padding:7px 10px;text-align:right">${fmtC(f.total)}</td>
        <td style="padding:7px 10px">${f.estado||'—'}</td>
      </tr>`).join('')}</tbody>
    </table>` : '';

  const body = `
    <div style="text-align:center;margin-bottom:20px;padding-bottom:16px;border-bottom:2px solid #e2e8f0">
      <h1 style="font-size:20px;font-weight:800;color:#0f172a;margin-bottom:2px">${cl?.nombre||'Clínica'}</h1>
      <p style="color:#64748b;font-size:12px">${cl?.direccion||''} ${cl?.telefono?'· Tel: '+cl.telefono:''}</p>
      <p style="font-size:11px;color:#94a3b8;margin-top:4px">HISTORIAL CLÍNICO COMPLETO · Generado ${new Date().toLocaleDateString('es-ES',{day:'2-digit',month:'long',year:'numeric'})}</p>
    </div>
    ${secPaciente}${secExp}${secCitas}${secMeds}${secNotas}${secFacts}
    <div style="text-align:center;margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:11px">
      Lumea Med — Sistema de Gestión Clínica | lumeamed.net
    </div>`;
  pdfAbrir(`Historial — ${p.nombre} ${p.apellidos}`, body, {orientation:'portrait'});
}

// ═══════════════════════════════════════════════
//  SUPER ADMIN — VISTA GLOBAL
// ═══════════════════════════════════════════════
async function renderAdminGlobal() {
  const el = document.getElementById('global-clinicas-table');
  const statsEl = document.getElementById('global-stats-row');
  const updEl = document.getElementById('global-updated');
  if(!el) return;
  el.innerHTML = statsEl.innerHTML = '<p style="color:var(--text-light);font-size:13px">Cargando datos globales...</p>';

  // Cargar conteos de todas las clínicas en paralelo
  const [rPac, rCit, rFin, rFact] = await Promise.all([
    sb.from('pacientes').select('clinica_id'),
    sb.from('citas').select('clinica_id,estado'),
    sb.from('finanzas').select('clinica_id,tipo,monto'),
    sb.from('facturas').select('clinica_id,estado,total')
  ]);
  const allPac  = rPac.data  || [];
  const allCit  = rCit.data  || [];
  const allFin  = rFin.data  || [];
  const allFact = rFact.data || [];

  // Totales globales
  const totalPac  = allPac.length;
  const totalCit  = allCit.length;
  const totalCitH = allCit.filter(c=>c.estado==='completada').length;
  const totalIng  = allFin.filter(f=>f.tipo==='ingreso').reduce((s,f)=>s+Number(f.monto||0),0);
  const totalEgr  = allFin.filter(f=>f.tipo==='egreso').reduce((s,f)=>s+Number(f.monto||0),0);
  const totalFact = allFact.filter(f=>f.estado==='pagada').reduce((s,f)=>s+Number(f.total||0),0);

  statsEl.innerHTML = `
    <div class="admin-stat"><div class="admin-stat-icon">🏥</div><div><div class="admin-stat-val">${adminClinicas.length}</div><div class="admin-stat-label">Clínicas</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">👥</div><div><div class="admin-stat-val">${totalPac}</div><div class="admin-stat-label">Pacientes totales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📅</div><div><div class="admin-stat-val">${totalCit}</div><div class="admin-stat-label">Citas totales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">✅</div><div><div class="admin-stat-val">${totalCitH}</div><div class="admin-stat-label">Citas completadas</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">💰</div><div><div class="admin-stat-val">${fmtC(totalIng)}</div><div class="admin-stat-label">Ingresos globales</div></div></div>
    <div class="admin-stat"><div class="admin-stat-icon">📈</div><div><div class="admin-stat-val">${fmtC(totalIng-totalEgr)}</div><div class="admin-stat-label">Utilidad global</div></div></div>`;

  // Tabla por clínica
  el.innerHTML = `
    <table class="table" style="margin-top:0">
      <thead><tr>
        <th>Clínica</th><th>Usuarios</th><th>Pacientes</th><th>Citas</th><th>Completadas</th><th>Ingresos</th><th>Facturas pag.</th><th>Estado</th>
      </tr></thead>
      <tbody>${adminClinicas.map(c => {
        const users = adminUsuarios.filter(u=>u.clinica_id===c.id).length;
        const pacs  = allPac.filter(x=>x.clinica_id===c.id).length;
        const cits  = allCit.filter(x=>x.clinica_id===c.id).length;
        const citsH = allCit.filter(x=>x.clinica_id===c.id&&x.estado==='completada').length;
        const ing   = allFin.filter(x=>x.clinica_id===c.id&&x.tipo==='ingreso').reduce((s,x)=>s+Number(x.monto||0),0);
        const fPag  = allFact.filter(x=>x.clinica_id===c.id&&x.estado==='pagada').length;
        return `<tr>
          <td>
            <div style="font-weight:700">${c.nombre}</div>
            <div style="font-size:11px;color:var(--text-light)">${c.codigo||''} ${c.produccion?'<span style="color:#7c3aed">★ Prod</span>':''}</div>
          </td>
          <td>${users}</td>
          <td>${pacs}</td>
          <td>${cits}</td>
          <td>${citsH}</td>
          <td>${fmtC(ing)}</td>
          <td>${fPag}</td>
          <td>${c.activa
            ? '<span class="tag tag-green">Activa</span>'
            : '<span class="tag tag-gray">Inactiva</span>'}</td>
        </tr>`;
      }).join('')}</tbody>
    </table>`;

  if(updEl) updEl.textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});
}

// ═══════════════════════════════════════════════════════════
// MÓDULO FARMACIA
// ═══════════════════════════════════════════════════════════

let carritoFarma = [];
const _locks = new Set();
function _lockSubmit(key, btn) {
  if(_locks.has(key)) return false;
  _locks.add(key);
  if(btn) { btn.disabled = true; btn._origText = btn.innerHTML; btn.innerHTML = '⏳ Procesando...'; }
  return true;
}
function _unlockSubmit(key, btn) {
  _locks.delete(key);
  if(btn) { btn.disabled = false; if(btn._origText) { btn.innerHTML = btn._origText; btn._origText = null; } }
}
let farmaTab = 'despacho';

function switchFarmaTab(tab) {
  farmaTab = tab;
  ['despacho','ventas','recetas','alertas','estadisticas'].forEach(t => {
    const btn = document.getElementById('tab-farma-' + t);
    const panel = document.getElementById('farma-panel-' + t);
    if(btn) btn.classList.toggle('active', t === tab);
    if(panel) panel.style.display = t === tab ? '' : 'none';
  });
  if(tab === 'ventas')       renderFarmaVentas();
  if(tab === 'recetas')      renderFarmaRecetas();
  if(tab === 'alertas')      renderFarmaAlertas();
  if(tab === 'estadisticas') renderFarmaEstadisticas();
}

function renderFarmacia() {
  showView('farmacia');
  const nombreEl = document.getElementById('farma-clinica-nombre');
  if(nombreEl) nombreEl.textContent = currentClinica?.nombre || '';
  actualizarStatsFarma();
  const fechaEl = document.getElementById('farma-ventas-fecha');
  if(fechaEl && !fechaEl.value) fechaEl.value = hoy();
  const ckReceta = document.getElementById('farma-es-receta');
  if(ckReceta) ckReceta.onchange = function() {
    const campos = document.getElementById('farma-receta-campos');
    if(campos) campos.style.display = this.checked ? 'flex' : 'none';
  };
  switchFarmaTab(farmaTab || 'despacho');
  renderFarmaDespacho();
}

function actualizarStatsFarma() {
  const h = hoy();
  const ventasHoy = C.fin.filter(x => x.fecha === h && x.categoria === 'farmacia' && x.tipo === 'ingreso');
  const totalHoy = ventasHoy.reduce((s, x) => s + Number(x.monto || 0), 0);
  const despachos = C.mov.filter(x => x.fecha === h && (x.motivo === 'venta_farmacia' || x.motivo === 'receta')).length;
  const alertas = C.inv.filter(x => x.stock <= 0 || (x.stockMin > 0 && x.stock <= x.stockMin)).length;
  const recetasHoy = C.mov.filter(x => x.fecha === h && x.motivo === 'receta').length;
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('farma-stat-ventas',     fmtC(totalHoy));
  setEl('farma-stat-despachos',  despachos);
  setEl('farma-stat-alertas',    alertas);
  setEl('farma-stat-recetas',    recetasHoy);
}

let farmaCatActual = '';
function setFarmaCat(cat, el) {
  farmaCatActual = cat;
  document.querySelectorAll('#farma-cat-chips .chip').forEach(c => c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderFarmaDespacho();
}
function filtrarProductosFarma() { renderFarmaDespacho(); }

function renderFarmaDespacho() {
  const buscar = (document.getElementById('farma-buscar')?.value || '').toLowerCase();
  const cat = farmaCatActual || '';
  const productos = C.inv.filter(p =>
    p.nombre.toLowerCase().includes(buscar) && (!cat || p.categoria === cat)
  );
  const grid = document.getElementById('farma-productos-grid');
  if(!grid) return;
  const catIcon = { medicamento:'💊', material:'🩺', insumo:'🧹', equipo:'🔬', papeleria:'📄', general:'📦' };
  grid.innerHTML = !productos.length
    ? '<div style="color:var(--text-light);text-align:center;padding:30px;grid-column:1/-1">No se encontraron productos</div>'
    : productos.map(p => {
        const icon = catIcon[p.categoria] || '📦';
        const sinStock = p.stock <= 0;
        const stockBajo = !sinStock && p.stockMin > 0 && p.stock <= p.stockMin;
        const stockColor = sinStock ? '#e53e3e' : stockBajo ? '#d69e2e' : '#38a169';
        return `<div onclick="${sinStock ? '' : 'agregarAlCarrito(' + p.id + ')'}"
          style="background:var(--card);border:1.5px solid ${sinStock ? '#e53e3e33' : 'var(--border)'};
          border-radius:12px;padding:12px;cursor:${sinStock ? 'not-allowed' : 'pointer'};
          opacity:${sinStock ? 0.5 : 1};transition:border-color .15s"
          onmouseover="${sinStock ? '' : "this.style.borderColor='var(--primary)'"}"
          onmouseout="${sinStock ? '' : "this.style.borderColor='var(--border)'"}">
          <div style="font-size:1.4rem;margin-bottom:6px">${icon}</div>
          <div style="font-weight:600;font-size:13px;line-height:1.3;margin-bottom:4px">${p.nombre}</div>
          <div style="font-size:11px;color:var(--text-light);margin-bottom:6px">${p.descripcion || p.unidad}</div>
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-weight:700;color:var(--primary)">${p.precio ? fmtC(p.precio) : 'Sin precio'}</span>
            <span style="font-size:11px;color:${stockColor};font-weight:600">Stock: ${p.stock}</span>
          </div>
        </div>`;
      }).join('');
  renderCarritoFarma();
}

function agregarAlCarrito(prodId) {
  const prod = C.inv.find(p => p.id === prodId);
  if(!prod) return;
  if(prod.stock <= 0) { toast('Sin stock disponible', 'error'); return; }
  const existing = carritoFarma.find(x => x.id === prodId);
  if(existing) {
    if(existing.cantidad >= prod.stock) { toast('No hay suficiente stock', 'error'); return; }
    existing.cantidad++;
  } else {
    carritoFarma.push({ id: prodId, nombre: prod.nombre, precio: Number(prod.precio || 0), cantidad: 1, unidad: prod.unidad });
  }
  renderCarritoFarma();
  toast(prod.nombre + ' agregado', 'success');
}

function renderCarritoFarma() {
  const el = document.getElementById('farma-carrito-items');
  if(!el) return;
  if(!carritoFarma.length) {
    el.innerHTML = '<div style="color:var(--text-light);font-size:13px;text-align:center;padding:12px">El carrito está vacío</div>';
    ['farma-subtotal','farma-total'].forEach(id => { const e = document.getElementById(id); if(e) e.textContent = 'C$ 0.00'; });
    return;
  }
  el.innerHTML = carritoFarma.map((item, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${item.nombre}</div>
        <div style="font-size:11px;color:var(--text-light)">${fmtC(item.precio)} × ${item.cantidad}</div>
      </div>
      <div style="display:flex;align-items:center;gap:4px">
        <button onclick="cambiarCantCarrito(${i},-1)" style="width:22px;height:22px;border:1px solid var(--border);background:#334155;border-radius:4px;cursor:pointer;color:#fff;font-size:14px;font-weight:700;line-height:1">−</button>
        <input type="number" min="1" value="${item.cantidad}" onchange="setCantCarrito(${i},this.value)" style="width:44px;text-align:center;padding:2px 4px;border:1.5px solid var(--border);border-radius:6px;font-size:13px;font-weight:600;background:var(--card);color:var(--text);font-family:inherit;outline:none" onfocus="this.select()">
        <button onclick="cambiarCantCarrito(${i},1)" style="width:22px;height:22px;border:1px solid var(--border);background:#334155;border-radius:4px;cursor:pointer;color:#fff;font-size:14px;font-weight:700;line-height:1">+</button>
        <button onclick="quitarDelCarrito(${i})" style="width:22px;height:22px;border:none;background:#e53e3e22;color:#e53e3e;border-radius:4px;cursor:pointer;font-size:13px;line-height:1">✕</button>
      </div>
      <div style="font-size:13px;font-weight:700;min-width:58px;text-align:right">${fmtC(item.precio * item.cantidad)}</div>
    </div>`).join('');
  const total = carritoFarma.reduce((s, x) => s + x.precio * x.cantidad, 0);
  ['farma-subtotal','farma-total'].forEach(id => { const e = document.getElementById(id); if(e) e.textContent = fmtC(total); });
}

function cambiarCantCarrito(i, delta) {
  const item = carritoFarma[i]; if(!item) return;
  const prod = C.inv.find(p => p.id === item.id);
  const nueva = item.cantidad + delta;
  if(nueva <= 0) { quitarDelCarrito(i); return; }
  if(prod && nueva > prod.stock) { toast('No hay suficiente stock', 'error'); return; }
  carritoFarma[i].cantidad = nueva;
  renderCarritoFarma();
}

function setCantCarrito(i, valor) {
  const item = carritoFarma[i]; if(!item) return;
  const nueva = parseInt(valor, 10);
  if(isNaN(nueva) || nueva <= 0) { quitarDelCarrito(i); return; }
  const prod = C.inv.find(p => p.id === item.id);
  if(prod && nueva > prod.stock) { toast('Stock disponible: ' + prod.stock, 'error'); renderCarritoFarma(); return; }
  carritoFarma[i].cantidad = nueva;
  renderCarritoFarma();
}

function quitarDelCarrito(i) { carritoFarma.splice(i, 1); renderCarritoFarma(); }
function limpiarCarrito() { carritoFarma = []; renderCarritoFarma(); }

async function completarVentaFarma() {
  if(!carritoFarma.length) { toast('El carrito está vacío', 'error'); return; }
  const btn = document.querySelector('[onclick="completarVentaFarma()"]');
  if(!_lockSubmit('venta', btn)) return;
  const metodoPago  = document.getElementById('farma-metodo-pago')?.value || 'efectivo';
  const cliente     = document.getElementById('farma-cliente')?.value?.trim() || '';
  const esReceta    = document.getElementById('farma-es-receta')?.checked || false;
  const doctor      = document.getElementById('farma-doctor')?.value?.trim() || '';
  const pacReceta   = document.getElementById('farma-paciente-receta')?.value?.trim() || '';
  const total       = carritoFarma.reduce((s, x) => s + x.precio * x.cantidad, 0);
  const motivo      = esReceta ? 'receta' : 'venta_farmacia';

  // Abrir ventana del ticket ANTES de cualquier await para evitar el bloqueador de popups
  const ticketWin = window.open('', '_blank', 'width=680,height=860');
  if(ticketWin) ticketWin.document.write('<html><body style="font-family:Arial;text-align:center;padding:40px;color:#64748B"><p style="font-size:18px">Procesando venta...</p></body></html>');

  // Número de factura consecutivo por clínica
  const { count: ventaCount } = await sb.from('finanzas')
    .select('*', { count: 'exact', head: true })
    .eq('clinica_id', currentClinicaId)
    .eq('categoria', 'farmacia')
    .eq('tipo', 'ingreso');
  const ventaId = 'VF-' + String((ventaCount || 0) + 1).padStart(5, '0');

  // Guardar snapshot del carrito para el PDF antes de limpiar
  const itemsParaPDF = carritoFarma.map(x => ({...x}));
  const horaVenta = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

  const productos   = carritoFarma.map(x => x.nombre + ' x' + x.cantidad).join(', ');
  let descripcion   = 'Venta farmacia: ' + productos;
  if(cliente)              descripcion += ' — Cliente: ' + cliente;
  if(esReceta && doctor)   descripcion += ' — Receta Dr. ' + doctor;
  if(esReceta && pacReceta) descripcion += ' — Paciente: ' + pacReceta;

  const movimientos = carritoFarma.map(item => ({
    inventario_id: item.id, tipo: 'salida', cantidad: item.cantidad,
    motivo, fecha: hoy(), clinica_id: currentClinicaId
  }));
  const { error: movErr } = await sb.from('inventario_movimientos').insert(movimientos);
  if(movErr) { toast('Error al registrar movimientos: ' + movErr.message, 'error'); _unlockSubmit('venta', btn); return; }

  for(const item of carritoFarma) {
    const prod = C.inv.find(p => p.id === item.id);
    if(prod) {
      const nuevoStock = Math.max(0, prod.stock - item.cantidad);
      await sb.from('inventario').update({ stock_actual: nuevoStock }).eq('id', item.id);
      prod.stock = nuevoStock;
    }
  }

  if(total > 0) {
    const { error: finErr } = await sb.from('finanzas').insert({
      tipo: 'ingreso', categoria: 'farmacia', descripcion, monto: total,
      fecha: hoy(), metodo_pago: metodoPago, referencia: ventaId, clinica_id: currentClinicaId
    });
    if(finErr) console.error('Error finanzas farmacia:', finErr.message);
  }

  toast('Venta ' + ventaId + ' completada — ' + fmtC(total), 'success');
  carritoFarma = [];
  ['farma-cliente','farma-doctor','farma-paciente-receta'].forEach(id => { const e = document.getElementById(id); if(e) e.value = ''; });
  const ckEl = document.getElementById('farma-es-receta'); if(ckEl) ckEl.checked = false;
  const camposEl = document.getElementById('farma-receta-campos'); if(camposEl) camposEl.style.display = 'none';

  await loadAll();
  _unlockSubmit('venta', btn);
  actualizarStatsFarma();
  renderFarmaDespacho();

  // PDF automático al completar la venta (ticketWin ya fue abierta antes del primer await)
  imprimirTicketVentaFarma({
    numero: ventaId, fecha: hoy(), hora: horaVenta,
    cliente, metodoPago, esReceta, doctor, pacReceta,
    items: itemsParaPDF, total
  }, ticketWin);
}

function imprimirTicketVentaFarma(v, existingWin) {
  const cn  = currentClinica?.nombre || 'Farmacia';
  const dir = currentClinica?.direccion || '';
  const tel = currentClinica?.telefono || '';
  const metLabel = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' }[v.metodoPago] || v.metodoPago;
  const metIcon  = { efectivo: '💵', tarjeta: '💳', transferencia: '🏦' }[v.metodoPago] || '';

  const filas = v.items.map(i => `
    <tr>
      <td>${i.nombre}</td>
      <td class="c">${i.unidad || 'uds'}</td>
      <td class="c">${i.cantidad}</td>
      <td class="r">${fmtC(i.precio)}</td>
      <td class="r b">${fmtC(i.precio * i.cantidad)}</td>
    </tr>`).join('');

  const w = existingWin || window.open('', '_blank', 'width=680,height=860');
  w.document.write(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><title>Ticket ${v.numero}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap');
@page{size:auto;margin:8mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',Arial,sans-serif;color:#0F172A;background:#fff;font-size:13px}
.tk{max-width:560px;margin:0 auto;padding:24px}
.ch{text-align:center;padding-bottom:14px;border-bottom:2px dashed #CBD5E1;margin-bottom:14px}
.cn{font-size:20px;font-weight:800}.cs{font-size:11px;color:#64748B;margin-top:2px}
.ti{font-size:12px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.8px;margin-top:8px}
.nr{display:flex;justify-content:space-between;align-items:center;background:#EFF6FF;border:1px solid #BFDBFE;border-radius:10px;padding:10px 14px;margin-bottom:14px}
.nl{font-size:10px;color:#3B82F6;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.nv{font-size:20px;font-weight:800;color:#1D4ED8}
.fv{font-size:13px;font-weight:700;text-align:right}.fh{font-size:11px;color:#64748B;text-align:right}
table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:12px}
thead tr{background:#F1F5F9}
th{padding:7px 8px;font-size:10px;color:#475569;font-weight:700;text-transform:uppercase;letter-spacing:.4px;text-align:left}
td{padding:6px 8px;border-bottom:1px solid #F8FAFC}
.c{text-align:center}.r{text-align:right}.b{font-weight:700;color:#0F172A}
.tb{background:#1D4ED8;color:#fff;border-radius:10px;padding:14px 18px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px}
.tl{font-size:10px;opacity:.8;font-weight:700;text-transform:uppercase;letter-spacing:.5px}
.tv{font-size:28px;font-weight:800}.tm{font-size:12px;opacity:.8;margin-top:2px}
.ir{display:flex;justify-content:space-between;font-size:12px;color:#334155;padding:3px 0;border-bottom:1px solid #F1F5F9}
.rb{background:#EFF6FF;border-left:3px solid #3B82F6;border-radius:6px;padding:9px 12px;margin-top:10px;font-size:12px}
.ft{text-align:center;color:#94A3B8;font-size:11px;border-top:1px dashed #CBD5E1;padding-top:10px;margin-top:18px}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}
</style></head><body><div class="tk">
  <div class="ch">
    <div style="font-size:28px;margin-bottom:4px">💊</div>
    <div class="cn">${cn}</div>
    ${dir ? `<div class="cs">${dir}</div>` : ''}
    ${tel ? `<div class="cs">Tel: ${tel}</div>` : ''}
    <div class="ti">Ticket de Venta</div>
  </div>
  <div class="nr">
    <div><div class="nl">N de Venta</div><div class="nv">${v.numero}</div></div>
    <div><div class="fv">${v.fecha}</div><div class="fh">${v.hora}</div></div>
  </div>
  <table>
    <thead><tr>
      <th>Producto</th><th class="c">Unidad</th><th class="c">Cant.</th>
      <th class="r">Precio</th><th class="r">Total</th>
    </tr></thead>
    <tbody>${filas}</tbody>
  </table>
  <div class="tb">
    <div><div class="tl">Total a Pagar</div><div class="tm">${metIcon} ${metLabel}</div></div>
    <div class="tv">${fmtC(v.total)}</div>
  </div>
  ${v.cliente ? `<div class="ir"><span>Cliente:</span><span><strong>${v.cliente}</strong></span></div>` : ''}
  <div class="ir"><span>Metodo de pago:</span><span>${metIcon} ${metLabel}</span></div>
  <div class="ir"><span>Atendido por:</span><span>${currentUser?.name || '--'}</span></div>
  ${v.esReceta ? `<div class="rb"><strong>Receta medica</strong>
    ${v.doctor ? `<div>Medico: ${v.doctor}</div>` : ''}
    ${v.pacReceta ? `<div>Paciente: ${v.pacReceta}</div>` : ''}
  </div>` : ''}
  <div class="ft">Gracias por su compra! - ${cn} - ${new Date().toLocaleString('es-ES')}</div>
</div>
<script>window.onload=function(){window.print()}<\/script>
</body></html>`);
  w.document.close();
}

function reimprimirVentaFarma(finId) {
  const v = C.fin.find(x => x.id === finId);
  if(!v) return;

  // Parsear descripción: "Venta farmacia: ProdA x2, ProdB x1 — Cliente: Juan — Receta Dr. García — Paciente: María"
  let resto = (v.descripcion || '').replace('Venta farmacia: ', '');
  const partes = resto.split(' — ');
  const productosStr = partes[0] || '';

  let cliente = '', doctor = '', pacReceta = '', esReceta = false;
  partes.slice(1).forEach(p => {
    if(p.startsWith('Cliente: '))   cliente   = p.replace('Cliente: ', '');
    if(p.startsWith('Receta Dr. ')) { esReceta = true; doctor = p.replace('Receta Dr. ', ''); }
    if(p.startsWith('Paciente: '))  pacReceta = p.replace('Paciente: ', '');
  });

  // Parsear productos "Prod A x2" → { nombre, cantidad, precio }
  const items = productosStr.split(', ').filter(Boolean).map(p => {
    const match = p.match(/^(.+?) x(\d+)$/);
    if(match) {
      const nombre = match[1].trim();
      const cantidad = parseInt(match[2], 10) || 1;
      const prod = C.inv.find(x => x.nombre === nombre);
      return { nombre, cantidad, precio: prod?.precio || 0, unidad: prod?.unidad || 'uds' };
    }
    return { nombre: p, cantidad: 1, precio: 0, unidad: 'uds' };
  });

  imprimirTicketVentaFarma({
    numero: v.referencia || '—',
    fecha: v.fecha, hora: '',
    cliente, metodoPago: v.metodoPago || 'efectivo',
    esReceta, doctor, pacReceta,
    items,
    total: Number(v.monto || 0)
  });
}

function renderFarmaVentas() {
  const fecha = document.getElementById('farma-ventas-fecha')?.value || hoy();
  const ventas = C.fin.filter(x => x.fecha === fecha && x.categoria === 'farmacia' && x.tipo === 'ingreso');
  const tbody = document.getElementById('farma-ventas-tbody');
  if(!tbody) return;
  if(!ventas.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-light);padding:20px">No hay ventas para esta fecha</td></tr>';
    const t = document.getElementById('farma-ventas-total-dia'); if(t) t.textContent = '';
    return;
  }
  const metIcon = { efectivo:'💵', tarjeta:'💳', transferencia:'🏦' };
  tbody.innerHTML = ventas.map(v => {
    const esR = v.descripcion?.includes('Receta') || false;
    const desc = (v.descripcion || '').replace('Venta farmacia: ','');
    return `<tr>
      <td>${v.fecha}</td>
      <td style="font-size:12px;max-width:280px">${desc}</td>
      <td style="font-size:12px">${v.referencia || '—'}</td>
      <td>${metIcon[v.metodoPago]||''} ${v.metodoPago||'—'}</td>
      <td>${esR ? '<span class="tag tag-blue">Receta</span>' : '<span class="tag tag-gray">Directa</span>'}</td>
      <td style="font-weight:700;color:var(--primary)">${fmtC(v.monto)}</td>
      <td><button class="btn btn-secondary btn-sm" onclick="reimprimirVentaFarma(${v.id})" title="Imprimir ticket">🖨️</button></td>
    </tr>`;
  }).join('');
  const total = ventas.reduce((s, x) => s + Number(x.monto || 0), 0);
  const t = document.getElementById('farma-ventas-total-dia'); if(t) t.textContent = 'Total del día: ' + fmtC(total);
}

function renderFarmaRecetas() {
  const recetas = C.mov.filter(x => x.motivo === 'receta');
  const tbody = document.getElementById('farma-recetas-tbody');
  if(!tbody) return;
  if(!recetas.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:20px">No hay recetas despachadas</td></tr>';
    return;
  }
  const grupos = {};
  recetas.forEach(r => {
    const ref = r.referencia || ('mov-' + r.id);
    if(!grupos[ref]) grupos[ref] = { fecha: r.fecha, notas: r.notas || '', items: [], ref };
    const prod = C.inv.find(p => p.id === r.invId);
    grupos[ref].items.push((prod?.nombre || 'Producto') + ' ×' + r.cantidad);
  });
  tbody.innerHTML = Object.values(grupos).sort((a,b) => b.fecha.localeCompare(a.fecha)).map(g => {
    const partes = g.notas.split('|');
    const doctor = (partes[0] || '').replace('Dr:','').trim() || '—';
    const paciente = (partes[1] || '').replace('Pac:','').trim() || '—';
    const fin = C.fin.find(x => x.referencia === g.ref);
    return `<tr>
      <td>${g.fecha}</td>
      <td>${paciente}</td>
      <td>Dr. ${doctor}</td>
      <td style="font-size:12px">${g.items.join(', ')}</td>
      <td style="font-weight:700">${fin ? fmtC(fin.monto) : '—'}</td>
    </tr>`;
  }).join('');
}

function renderFarmaAlertas() {
  const sinStock = C.inv.filter(x => x.stock <= 0);
  const bajStock = C.inv.filter(x => x.stock > 0 && x.stockMin > 0 && x.stock <= x.stockMin);
  const vencList = C.inv.filter(x => x.fechaVenc && _invVencStatus(x) !== 'ok' && _invVencStatus(x) !== null)
    .sort((a,b) => a.fechaVenc.localeCompare(b.fechaVenc));
  const catIcon = { medicamento:'💊', material:'🩺', insumo:'🧹', equipo:'🔬', papeleria:'📄', general:'📦' };
  const renderStockItem = p => `
    <div class="farma-alerta-item">
      <div>
        <span style="margin-right:6px">${catIcon[p.categoria]||'📦'}</span>
        <span style="font-weight:600;font-size:13px">${p.nombre}</span>
        <span style="font-size:11px;color:var(--text-light);margin-left:6px">${p.unidad}</span>
      </div>
      <div style="text-align:right">
        <div style="font-weight:700;font-size:13px">Stock: ${p.stock}</div>
        <div style="font-size:11px;color:var(--text-light)">Mín: ${p.stockMin}</div>
      </div>
    </div>`;
  const renderVencItem = p => {
    const vs = _invVencStatus(p);
    const esCls = vs==='vencido'?'tag-red':'tag-orange';
    const esLbl = vs==='vencido'?'💀 VENCIDO':'🔔 Próximo';
    const diasDiff = Math.round((new Date(p.fechaVenc)-new Date(hoy()))/(1000*60*60*24));
    const diasLbl = vs==='vencido' ? `Venció hace ${Math.abs(diasDiff)} día${Math.abs(diasDiff)!==1?'s':''}` : `Vence en ${diasDiff} día${diasDiff!==1?'s':''}`;
    return `<div class="farma-alerta-item">
      <div>
        <span style="margin-right:6px">${catIcon[p.categoria]||'📦'}</span>
        <span style="font-weight:600;font-size:13px">${p.nombre}</span>
        <span style="font-size:11px;color:var(--text-light);margin-left:6px">${p.unidad}</span>
        <div style="font-size:11px;color:var(--text-light);margin-top:2px">⏰ Alerta: ${p.alertaMeses} mes${p.alertaMeses!==1?'es':''} antes</div>
      </div>
      <div style="text-align:right">
        <span class="tag ${esCls}" style="font-size:10px;margin-bottom:4px;display:inline-block">${esLbl}</span>
        <div style="font-weight:700;font-size:12px">${formatFecha(p.fechaVenc)}</div>
        <div style="font-size:11px;color:var(--text-light)">${diasLbl}</div>
      </div>
    </div>`;
  };
  const noAlert = '<div style="color:var(--text-light);font-size:13px;padding:12px 0">Sin alertas ✓</div>';
  const elCero = document.getElementById('farma-alertas-cero'); if(elCero) elCero.innerHTML = sinStock.length ? sinStock.map(renderStockItem).join('') : noAlert;
  const elBajo = document.getElementById('farma-alertas-bajo'); if(elBajo) elBajo.innerHTML = bajStock.length ? bajStock.map(renderStockItem).join('') : noAlert;
  const elVenc = document.getElementById('farma-alertas-venc'); if(elVenc) elVenc.innerHTML = vencList.length ? vencList.map(renderVencItem).join('') : noAlert;
}

let farmaEstPeriodo = 'mes';

function setFarmaEstPeriodo(p, el) {
  farmaEstPeriodo = p;
  document.querySelectorAll('#farma-est-periodo-chips .chip').forEach(c => c.classList.remove('active'));
  if(el) el.classList.add('active');
  renderFarmaEstadisticas();
}

function getFarmaPeriodoFiltro() {
  const h = hoy();
  const now = new Date();
  if(farmaEstPeriodo === 'hoy')   return { label: 'Hoy — ' + formatFecha(h),    fn: x => x.fecha === h };
  if(farmaEstPeriodo === 'semana') {
    const lunes = new Date(now); lunes.setDate(now.getDate() - ((now.getDay()||7) - 1));
    const dom   = new Date(lunes); dom.setDate(lunes.getDate() + 6);
    const s = d => d.toISOString().split('T')[0];
    return { label: formatFecha(s(lunes)) + ' al ' + formatFecha(s(dom)), fn: x => x.fecha >= s(lunes) && x.fecha <= s(dom) };
  }
  if(farmaEstPeriodo === 'anio') {
    const yr = now.getFullYear().toString();
    return { label: 'Año ' + yr, fn: x => x.fecha.startsWith(yr) };
  }
  const mes = h.substring(0, 7);
  return { label: now.toLocaleDateString('es-ES', {month:'long', year:'numeric'}), fn: x => x.fecha.startsWith(mes) };
}

function renderFarmaEstadisticas() {
  const h = hoy();
  const mes = h.substring(0, 7);
  const { fn } = getFarmaPeriodoFiltro();
  const vPeriodo = C.fin.filter(x => fn(x) && x.categoria === 'farmacia' && x.tipo === 'ingreso');
  const vMes     = C.fin.filter(x => x.fecha.startsWith(mes) && x.categoria === 'farmacia' && x.tipo === 'ingreso');
  const dPeriodo = C.mov.filter(x => fn(x) && (x.motivo === 'venta_farmacia' || x.motivo === 'receta'));
  const rPeriodo = C.mov.filter(x => fn(x) && x.motivo === 'receta');
  const tPeriodo = vPeriodo.reduce((s, x) => s + Number(x.monto || 0), 0);
  const tMes     = vMes.reduce((s, x) => s + Number(x.monto || 0), 0);
  const setEl = (id, v) => { const e = document.getElementById(id); if(e) e.textContent = v; };
  setEl('farma-est-hoy',       fmtC(tPeriodo));
  setEl('farma-est-mes',       fmtC(tMes));
  setEl('farma-est-despachos', dPeriodo.length);
  setEl('farma-est-recetas',   rPeriodo.length);

  // Tabla detalle de ventas del período
  const tbody = document.getElementById('farma-est-ventas-detalle');
  if(tbody) {
    const metIcon = { efectivo:'💵', tarjeta:'💳', transferencia:'🏦' };
    tbody.innerHTML = !vPeriodo.length
      ? '<tr><td colspan="5" style="text-align:center;color:var(--text-light);padding:20px">Sin ventas en este período</td></tr>'
      : [...vPeriodo].sort((a,b) => b.fecha.localeCompare(a.fecha)).map(v => {
          const esR = v.descripcion?.includes('Receta') || v.descripcion?.includes('receta');
          return `<tr>
            <td>${formatFecha(v.fecha)}</td>
            <td style="font-size:12px;max-width:260px">${(v.descripcion||'').replace('Venta farmacia: ','')}</td>
            <td>${metIcon[v.metodoPago]||''} ${v.metodoPago||'—'}</td>
            <td>${esR ? '<span class="tag tag-blue">Receta</span>' : '<span class="tag tag-gray">Directa</span>'}</td>
            <td style="font-weight:700;color:#15803D">${fmtC(v.monto)}</td>
            <td><button class="btn btn-secondary btn-sm" onclick="reimprimirVentaFarma(${v.id})" title="Imprimir ticket">🖨️</button></td>
          </tr>`;
        }).join('');
  }

  // Entradas de stock (compras) del período
  const entradasEl = document.getElementById('farma-est-entradas');
  if(entradasEl) {
    const entradas = C.mov.filter(x => fn(x) && x.tipo === 'entrada');
    entradasEl.innerHTML = !entradas.length
      ? '<div style="color:var(--text-light);font-size:13px;padding:12px 0">Sin entradas en este período</div>'
      : [...entradas].sort((a,b) => b.fecha.localeCompare(a.fecha)).map(m => {
          const prod = C.inv.find(p => p.id === m.invId);
          return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
            <div>
              <div style="font-size:13px;font-weight:600">💊 ${prod?.nombre || '—'}</div>
              <div style="font-size:11px;color:var(--text-light)">${formatFecha(m.fecha)} · ${m.motivo || 'entrada'}</div>
            </div>
            <span class="tag tag-green">+${m.cantidad} ${prod?.unidad||'uds'}</span>
          </div>`;
        }).join('');
  }

  // Salidas de stock agrupadas por producto
  const salidasEl = document.getElementById('farma-est-salidas');
  if(salidasEl) {
    const cIcon = c => ({medicamento:'💊',material:'🩺',equipo:'🔬',insumo:'🧹',papeleria:'📄',general:'📦'}[c]||'📦');
    const cntSalidas = {};
    dPeriodo.forEach(m => { cntSalidas[m.invId] = (cntSalidas[m.invId]||0) + Number(m.cantidad||1); });
    const entries = Object.entries(cntSalidas).sort((a,b) => b[1]-a[1]);
    salidasEl.innerHTML = !entries.length
      ? '<tr><td colspan="6" style="text-align:center;color:var(--text-light);padding:20px">Sin salidas en este período</td></tr>'
      : entries.map(([invId, totalSal]) => {
          const prod = C.inv.find(p => p.id === Number(invId));
          if(!prod) return '';
          const st = prod.stock<=0 ? ['tag-red','Sin stock'] : prod.stockMin>0&&prod.stock<=prod.stockMin ? ['tag-orange','Bajo stock'] : ['tag-green','OK'];
          return `<tr>
            <td><strong>${cIcon(prod.categoria)} ${prod.nombre}</strong></td>
            <td style="text-transform:capitalize;font-size:12px;color:var(--text-light)">${prod.categoria}</td>
            <td><span class="tag tag-red">-${totalSal} ${prod.unidad}</span></td>
            <td style="font-weight:700">${prod.stock} ${prod.unidad}</td>
            <td style="color:var(--text-light)">${prod.stockMin||'—'}</td>
            <td><span class="tag ${st[0]}">${st[1]}</span></td>
          </tr>`;
        }).join('');
  }

  const conteo = {};
  dPeriodo.forEach(m => {
    const prod = C.inv.find(p => p.id === m.invId);
    const nombre = prod?.nombre || ('Producto #' + m.invId);
    conteo[nombre] = (conteo[nombre] || 0) + Number(m.cantidad || 1);
  });
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const elTop = document.getElementById('farma-top-productos');
  if(!elTop) return;
  if(!top.length) { elTop.innerHTML = '<div style="color:var(--text-light);font-size:13px;padding:12px 0">Sin datos este mes</div>'; return; }
  const maxVal = top[0][1];
  elTop.innerHTML = top.map(([nombre, cantidad], i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
      <span style="font-size:11px;color:var(--text-light);min-width:22px">#${i+1}</span>
      <div style="flex:1">
        <div style="font-size:13px;font-weight:600">${nombre}</div>
        <div style="height:5px;background:var(--border);border-radius:3px;margin-top:4px">
          <div style="height:100%;width:${Math.round(cantidad/maxVal*100)}%;background:var(--primary);border-radius:3px"></div>
        </div>
      </div>
      <span style="font-weight:700;font-size:13px;min-width:55px;text-align:right">${cantidad} uds</span>
    </div>`).join('');
}

function descargarPDFFarmacia() {
  const cfg = getClinicaConfig();
  const { label, fn } = getFarmaPeriodoFiltro();
  const ventas    = C.fin.filter(x => fn(x) && x.categoria === 'farmacia' && x.tipo === 'ingreso');
  const despachos = C.mov.filter(x => fn(x) && (x.motivo === 'venta_farmacia' || x.motivo === 'receta'));
  const recetas   = C.mov.filter(x => fn(x) && x.motivo === 'receta');
  const entradas  = C.mov.filter(x => fn(x) && x.tipo === 'entrada');
  const totalVentas = ventas.reduce((s, x) => s + Number(x.monto || 0), 0);
  const catIcon = c => ({ medicamento:'💊', material:'🩺', equipo:'🔬', insumo:'🧹', papeleria:'📄', general:'📦' }[c] || '📦');
  const metIcon = { efectivo:'Efectivo', tarjeta:'Tarjeta', transferencia:'Transferencia', otro:'Otro' };

  // Agrupar ventas por día
  const porDia = {};
  ventas.forEach(v => { porDia[v.fecha] = (porDia[v.fecha] || []).concat(v); });
  const diasOrdenados = Object.keys(porDia).sort((a, b) => b.localeCompare(a));

  // Top 10 productos vendidos
  const conteo = {};
  despachos.forEach(m => {
    const prod = C.inv.find(p => p.id === m.invId);
    const nombre = prod?.nombre || ('Producto #' + m.invId);
    conteo[nombre] = (conteo[nombre] || 0) + Number(m.cantidad || 1);
  });
  const top = Object.entries(conteo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const maxTop = top.length ? top[0][1] : 1;

  const body = `
    <div style="font-size:22px;font-weight:900;color:#0F172A;margin-bottom:4px">Reporte de Farmacia</div>
    <div style="font-size:13px;color:#64748B;font-weight:600;margin-bottom:20px">Período: ${label} · Generado: ${new Date().toLocaleString('es-ES')}</div>

    <div class="kpi-grid">
      <div class="kpi blue"><div class="kpi-val">${fmtC(totalVentas)}</div><div class="kpi-lbl">Total Ventas</div></div>
      <div class="kpi green"><div class="kpi-val">${ventas.length}</div><div class="kpi-lbl">Transacciones</div></div>
      <div class="kpi orange"><div class="kpi-val">${despachos.length}</div><div class="kpi-lbl">Despachos</div></div>
      <div class="kpi red"><div class="kpi-val">${recetas.length}</div><div class="kpi-lbl">Recetas</div></div>
    </div>

    ${top.length ? `<div class="section-title">🏆 Top 10 Productos Más Vendidos</div>
    <div style="margin-bottom:20px">${top.map(([nombre, cant]) => `
      <div class="bar-row">
        <div class="bar-lbl">${nombre}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round(cant/maxTop*100)}%"><span>${cant}</span></div></div>
        <div class="bar-val">${cant} uds</div>
      </div>`).join('')}</div>` : ''}

    <div class="section-title">📅 Ventas Detalladas por Día</div>
    ${diasOrdenados.length ? diasOrdenados.map(fecha => {
      const vDia = porDia[fecha];
      const totalDia = vDia.reduce((s, v) => s + Number(v.monto || 0), 0);
      return `<div style="margin-bottom:18px">
        <div style="font-weight:800;font-size:13px;color:#1D4ED8;background:#EFF6FF;padding:6px 12px;border-radius:6px;margin-bottom:6px">
          📅 ${formatFecha(fecha)} — Total: ${fmtC(totalDia)}
        </div>
        <table><thead><tr><th>Descripción</th><th>Método de Pago</th><th>Tipo</th><th>Monto</th></tr></thead>
        <tbody>${vDia.map(v => {
          const esR = v.descripcion?.includes('Receta') || v.descripcion?.includes('receta');
          return `<tr>
            <td style="font-size:11px">${(v.descripcion||'').replace('Venta farmacia: ','')}</td>
            <td>${metIcon[v.metodoPago] || v.metodoPago || '—'}</td>
            <td><span class="tag ${esR ? 'tag-blue' : 'tag-gray'}">${esR ? 'Receta' : 'Directa'}</span></td>
            <td style="font-weight:700;color:#15803D">${fmtC(v.monto)}</td>
          </tr>`;
        }).join('')}</tbody></table>
      </div>`;
    }).join('') : '<p style="color:#94A3B8;text-align:center;padding:16px">Sin ventas en este período</p>'}

    ${entradas.length ? `<div class="section-title">📥 Entradas de Stock / Compras</div>
    <table><thead><tr><th>Fecha</th><th>Producto</th><th>Categoría</th><th>Cantidad</th><th>Motivo</th></tr></thead>
    <tbody>${[...entradas].sort((a,b) => b.fecha.localeCompare(a.fecha)).map(m => {
      const prod = C.inv.find(p => p.id === m.invId);
      return `<tr>
        <td>${formatFecha(m.fecha)}</td>
        <td><strong>${catIcon(prod?.categoria)} ${prod?.nombre || '—'}</strong></td>
        <td style="text-transform:capitalize">${prod?.categoria || '—'}</td>
        <td><span class="tag tag-green">+${m.cantidad} ${prod?.unidad||'uds'}</span></td>
        <td style="color:#64748B">${m.motivo || 'entrada manual'}</td>
      </tr>`;
    }).join('')}</tbody></table>` : ''}

    ${despachos.length ? (() => {
      const cntSal = {};
      despachos.forEach(m => { cntSal[m.invId] = (cntSal[m.invId]||0) + Number(m.cantidad||1); });
      const salEntries = Object.entries(cntSal).sort((a,b) => b[1]-a[1]);
      return `<div class="section-title">📤 Salidas de Stock del Período</div>
      <table><thead><tr><th>Producto</th><th>Categoría</th><th>Salidas</th><th>Stock Actual</th><th>Stock Mín</th><th>Estado</th></tr></thead>
      <tbody>${salEntries.map(([invId, totalSal]) => {
        const prod = C.inv.find(p => p.id === Number(invId));
        if(!prod) return '';
        const st = prod.stock<=0 ? ['tag-red','Sin stock'] : prod.stockMin>0&&prod.stock<=prod.stockMin ? ['tag-orange','Bajo stock'] : ['tag-green','OK'];
        return `<tr>
          <td><strong>${catIcon(prod.categoria)} ${prod.nombre}</strong></td>
          <td style="text-transform:capitalize">${prod.categoria}</td>
          <td style="color:#DC2626;font-weight:700">-${totalSal} ${prod.unidad}</td>
          <td style="font-weight:700">${prod.stock} ${prod.unidad}</td>
          <td>${prod.stockMin||'—'}</td>
          <td><span class="tag ${st[0]}">${st[1]}</span></td>
        </tr>`;
      }).join('')}</tbody></table>`;
    })() : ''}

    <div class="section-title">📦 Estado Actual del Inventario</div>
    <table><thead><tr><th>Producto</th><th>Categoría</th><th>Stock Actual</th><th>Stock Mínimo</th><th>Precio Unit.</th><th>Estado</th></tr></thead>
    <tbody>${C.inv.map(p => {
      const st = p.stock === 0 ? ['tag-red','Sin stock'] : p.stockMin > 0 && p.stock <= p.stockMin ? ['tag-orange','Bajo stock'] : ['tag-green','OK'];
      return `<tr>
        <td><strong>${catIcon(p.categoria)} ${p.nombre}</strong></td>
        <td style="text-transform:capitalize">${p.categoria}</td>
        <td style="font-weight:700">${p.stock} ${p.unidad}</td>
        <td>${p.stockMin || '—'}</td>
        <td>${p.precio ? fmtC(p.precio) : '—'}</td>
        <td><span class="tag ${st[0]}">${st[1]}</span></td>
      </tr>`;
    }).join('')}</tbody></table>`;

  pdfAbrir('Reporte Farmacia — ' + label, body, cfg);
}

