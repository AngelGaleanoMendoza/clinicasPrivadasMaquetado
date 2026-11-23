# LumeaMed — Brief audiovisual adaptado al médico administrativo

Documento listo para usar como instrucciones de producción. Adaptación basada en el código local del proyecto revisado el 21 de octubre de 2026.

El alcance de esta entrega es el análisis y la adaptación del brief: no se ha producido el video, la locución ni una demostración conectada a producción. Las capacidades descritas están identificadas en el código; su disponibilidad en una clínica concreta depende de los permisos, la configuración y las migraciones aplicadas.

---

## ROL

Eres director creativo, motion designer y editor de audio. Produce un video promocional de **LumeaMed** centrado en la administración cotidiana de un consultorio desde la perspectiva del **médico administrativo**.

El objetivo es mostrar cómo el médico puede organizar pacientes, agendas, documentación de la atención, cobros, gastos, inventario y reportes dentro de la plataforma.

Trabaja a partir de la interfaz y las funcionalidades existentes. Utiliza el recorrido de una clínica de atención humana y el perfil `medico_admin`, con los permisos correspondientes habilitados. No muestres pantallas ni operaciones del superadmin.

El hilo conductor será **«De la cita al balance de tu clínica»**. Presenta un recorrido comprensible: organizar la jornada, consultar al paciente, documentar la atención, registrar el cobro y revisar la operación.

## ① CONTEXTO DEL PRODUCTO

### Marca y propuesta

- **Marca:** LumeaMed.
- **Tagline:** Tu clínica, mejor organizada.
- **Qué es:** Una plataforma web para centralizar la gestión diaria del consultorio: pacientes, citas, expedientes, documentación, inventario y control de ingresos y gastos, según los módulos habilitados.
- **Cliente principal:** Médico que atiende pacientes y también administra su consultorio o coordina la operación de una clínica privada pequeña o mediana.
- **Audiencia complementaria:** Especialistas y equipos de recepción o apoyo que trabajan con los accesos asignados. Las variantes de odontología, optometría, oftalmología y dermatología se presentan únicamente cuando corresponden al servicio mostrado.
- **Mercado de comunicación:** Nicaragua y Centroamérica; español latinoamericano neutro. Las pantallas financieras actuales usan córdobas, identificados como **C$**.

### Problema que resuelve

El médico necesita conocer quién tiene cita, encontrar el expediente, conservar la documentación de la atención, saber qué se ha cobrado, registrar los gastos y revisar los insumos disponibles. Cuando estos registros quedan repartidos entre papel, agendas y hojas de cálculo, es más difícil dar continuidad al trabajo y obtener una visión ordenada de la clínica.

El anuncio debe transmitir estos problemas cotidianos sin inventar pérdidas económicas, resultados médicos o porcentajes de mejora.

### Perfil de demostración

Utilizar una cuenta ficticia de **Médico administrativo** dentro de una única clínica de demostración.

Permisos para el recorrido completo: Pacientes, Exámenes digitalizados, Citas, Agendas, Medicaciones, Notas Clínicas, Atendidos por Día, Procedimientos clínicos, Inventario, Finanzas, Estadísticas y Exportar / Enviar.

**Inventario y Finanzas deben estar habilitados expresamente.** El nombre del rol no los concede automáticamente. Los permisos guardados determinan el acceso; una lista vacía no equivale a acceso completo.

El médico administrativo puede utilizar Balance dentro de Finanzas y gestionar sus opciones de reparto. Esto no le da acceso al panel general de Administración o Configuración.

### Funcionalidades que sustentan la propuesta

| Área | Funcionamiento existente que puede explicarse | Beneficio administrativo |
|---|---|---|
| Dashboard | Pacientes registrados, citas de hoy, citas pendientes, medicaciones activas, agenda del día y accesos a registros recientes. | Orientar el inicio de la jornada. |
| Pacientes | Registrar, buscar y editar datos de identificación, contacto y datos básicos del paciente; acceder a su expediente. | Encontrar la información del paciente desde un mismo registro. |
| Expedientes | Consultar datos personales, antecedentes y documentación vinculada; revisar historial e imprimir o descargar el expediente. | Mantener organizada la información de cada paciente. |
| Citas | Asignar paciente, profesional, fecha, hora, motivo y servicio; editar, reprogramar y registrar estados: pendiente, confirmada, completada, cancelada o no asistió. | Dar seguimiento a la atención programada. |
| Agendas | Consultar calendarios y citas por profesional, horarios y disponibilidad. El médico administrativo puede cancelar en bloque las citas pendientes o confirmadas de una agenda mediante confirmación. | Coordinar el trabajo diario de los profesionales. |
| Notas Clínicas | Registrar notas vinculadas al paciente, signos vitales y profesional; trabajar con borradores y notas finalizadas, plantillas y documentos imprimibles. | Documentar la atención y reutilizar formatos de trabajo. |
| Medicaciones y recetas | Registrar medicamentos, indicaciones y prescriptor; agrupar recetas y generar documentos con los datos y elementos gráficos configurados. | Conservar y emitir la documentación de las indicaciones del médico. |
| Exámenes digitalizados | Adjuntar archivos o enlaces, clasificarlos y relacionarlos con el paciente y, cuando aplica, con la atención. | Mantener los documentos de apoyo accesibles en el expediente. |
| Procedimientos clínicos | Registrar paciente, servicio, profesional, fecha, estado, documentación, adjuntos y seguimiento; consultar procedimientos programados o completados. | Organizar y documentar procedimientos y controles. |
| Atendidos por Día | Consultar pacientes atendidos en una fecha y el resumen de la cita. | Revisar la actividad efectivamente registrada. |
| Inventario | Administrar productos, categorías, unidades, precios, existencias mínimas y vencimientos; registrar entradas y salidas, consultar kardex y reportes. | Conocer existencias y movimientos de medicamentos, materiales, equipos e insumos. |
| Finanzas | Registrar ingresos, gastos, categorías, fecha, método de pago y referencia; consultar transacciones y resúmenes por período. | Revisar el dinero registrado en la operación. |
| Facturas o comprobantes | Crear documentos con servicios y productos, asociar paciente y, cuando aplica, cita; registrar el pago y generar su impresión o PDF. | Documentar cobros pendientes y realizados. |
| Integración de cobro e inventario | Al confirmar el pago de una factura, el flujo registra el ingreso y descuenta los productos vinculados al inventario. | Relacionar el cobro con los productos incluidos en el documento. |
| Balance y reparto | Consultar ingresos propios de la clínica, gastos y balance; distinguir la parte de los profesionales. Permite reparto por porcentaje de servicio o importe manual por línea. | Comprender qué parte de los cobros corresponde a la clínica. |
| Estadísticas | Consultar citas y atendidos por día, semana o mes, con estados y tipos de atención; imprimir o descargar reportes. | Revisar la actividad del consultorio. |
| Exportación y respaldo | Descargar un respaldo JSON, generar PDF de expedientes y utilizar la importación disponible para registros compatibles de la misma clínica. | Obtener copias de la información con acciones iniciadas por el usuario. |
| Acceso web | Interfaz con adaptación a escritorio y móvil, navegación móvil y modos claro y oscuro. | Consultar la plataforma desde un navegador compatible y con acceso autorizado. |

La documentación clínica se muestra por su utilidad organizativa. No representar al sistema interpretando exámenes, indicando tratamientos ni tomando decisiones médicas.

### Recorrido concreto: cómo funciona durante una jornada

1. **Revisar el día.** El médico abre el dashboard y consulta citas de hoy y pendientes.
2. **Localizar o registrar al paciente.** Busca a una persona existente o crea su registro para continuar con la cita o el expediente.
3. **Organizar la cita.** Selecciona el profesional, fecha, horario y servicio. Si hay coincidencia de horario, el sistema contempla advertencias y excepciones; no prometer bloqueo absoluto de dobles reservas.
4. **Registrar la atención.** Marca la asistencia y documenta la consulta mediante notas, signos vitales, recetas, exámenes o procedimientos, según corresponda.
5. **Conservar la documentación.** Consulta el historial y genera los impresos o PDF necesarios. El aspecto de los documentos utiliza la configuración disponible de la clínica y del profesional.
6. **Documentar el cobro.** Genera una factura o comprobante, agrega los servicios o productos y registra el pago con su método correspondiente. El nombre del documento depende de la configuración existente.
7. **Controlar existencias y gastos.** Revisa movimientos, stock mínimo y vencimientos; registra los gastos de la operación. La integración automática con inventario debe mostrarse mediante el flujo real de cobro de productos vinculados.
8. **Revisar el resultado.** Consulta atendidos, estadísticas, ingresos, gastos y balance. Cuando aplica reparto, distingue lo que queda a la clínica de lo que corresponde a los profesionales.
9. **Descargar documentación.** Obtiene reportes o respaldos manuales desde los módulos autorizados.

### Ejemplo financiero para una demostración ampliada

Datos completamente ficticios: una consulta cobrada por **C$ 1,000**, con reparto configurado de **40% para la clínica**, representa **C$ 400 para la clínica** y **C$ 600 para el profesional**. Si la clínica registra un gasto propio de **C$ 100**, el balance de este ejemplo es **C$ 300**.

El balance usa la fecha del ingreso registrado. La parte del profesional se informa por separado. No presentar el total cobrado como ingreso propio de la clínica, ni descontar de nuevo la parte del profesional como si fuera un gasto operativo ordinario. El sistema contempla una categoría específica para registrar pagos a profesionales.

Este ejemplo explica la lógica del producto; no representa rentabilidad real ni una recomendación de reparto. No necesita aparecer en el anuncio de 60 segundos.

### Beneficios y diferenciadores

- Un recorrido compartido entre agenda, paciente, documentación y cobro.
- Expedientes y documentos vinculados a la persona atendida.
- Agenda por profesional y seguimiento de estados de las citas.
- Impresos y PDF para utilizar la información fuera de la pantalla.
- Inventario con movimientos, stock mínimo y vencimientos registrados.
- Balance con distinción entre la parte de la clínica y la de los profesionales.
- Acceso por módulos según los permisos asignados.
- Vistas específicas para determinadas especialidades, según configuración.

Usar expresiones como **«organiza»**, **«consulta»**, **«registra»** y **«lleva el control»**. Evitar prometer ahorro medido, ingresos mayores, disponibilidad permanente o ausencia de errores.

### Variantes existentes, fuera del recorrido principal

- **Odontología:** historia dental, odontograma, periodontograma y procedimientos. Solo mostrar dentro de la variante odontológica correspondiente.
- **Optometría y oftalmología:** documentación del examen visual y procedimientos relacionados con esos servicios.
- **Dermatología:** catálogos y documentación de procedimientos de la especialidad.
- **Farmacia:** despacho con carrito, ventas, ticket, recetas, alertas y estadísticas cuando el módulo está habilitado. No presentar un punto de venta de farmacia como acceso estándar de cualquier médico.

La versión principal se concentra en la administración del consultorio. No incluir veterinaria, clientes de mascotas ni hospitalización veterinaria.

### Evidencia visual y datos de demostración

Usar capturas de la interfaz actual con información ficticia y coherente entre pantallas. Los contadores deben corresponder a los registros mostrados, sin hacerlos pasar por métricas comerciales.

Personajes propuestos: **Dra. Sofía Martínez**, **María López** y **José Hernández**. Clínica: **Consultorio Demostración LumeaMed**. Identificadores visibles: `DEMO-001`, `DEMO-002`, cuando el campo permita texto libre; omitir teléfonos o utilizar marcadores inequívocos de demostración.

El número de expediente debe respetar el formato que realmente genere la aplicación. Para una clínica con código `DEMO`, el formato actual puede verse como `DEMO2026-001`. No imponer el formato `LM-2026-00124` del brief anterior sobre una pantalla que genera otro.

Mostrar como evidencia: agenda por profesional, estados de citas, documentos del paciente, comprobante pendiente/pagado, movimientos de inventario, balance y estadísticas. Los módulos que no estén operativos en la demostración no deben simularse como funcionalidades probadas.

### CTA y formato

**CTA de cierre:** Agenda tu demostración y descubre cómo organizar la administración de tu consultorio con LumeaMed.

**Pantalla final:**

LumeaMed  
Tu clínica, mejor organizada.  
**Agenda tu demo**  
**lumeamed.net**

Conservar el crédito **«A product by ASG Development»** indicado en el encargo, como texto secundario. Este crédito proviene del brief proporcionado.

- Duración máxima: **60 segundos**.
- Máster: **1920 × 1080, 16:9, 30 FPS**.
- Destinos: web del producto, presentaciones comerciales, YouTube y piezas digitales.
- Preparar composición adaptable a una versión independiente de **1080 × 1920, 9:16**.
- El dominio figura en el archivo `CNAME`; el recorrido para solicitar la demo debe comprobarse antes de publicar. No inventar un formulario, teléfono o enlace de reserva no proporcionado.

## ② GUION Y MAPA DE ESCENAS

Las siguientes ventanas son tiempos de montaje propuestos. Los timestamps definitivos se obtendrán de la locución generada; todavía no representan mediciones de audio.

| Tiempo | Locución | Pantalla y movimiento |
|---|---|---|
| 0–6 s | «Entre agendas, expedientes y cobros, administrar tu consultorio puede ocupar gran parte del día.» | Tres elementos separados: agenda, carpeta y comprobante. Movimiento contenido que sugiere tareas dispersas. Texto: **Tu consulta. Tu agenda. Tus cobros.** |
| 6–12 s | «Cuando la información está separada, cuesta seguir cada cita, cada documento y cada pago.» | Conexiones incompletas entre tarjetas. Aparece **¿Y si pudieras organizarlo en un solo lugar?** Evitar representar errores clínicos o pérdidas económicas. |
| 12–18 s | «Con LumeaMed, reúne la gestión diaria de tu clínica en un solo lugar.» | Las tarjetas convergen hacia la identidad de LumeaMed y dan paso al dashboard del médico administrativo. Texto: **Tu clínica, mejor organizada.** |
| 18–27 s | «Organiza pacientes y agendas. Consulta expedientes y registra notas, recetas, exámenes y procedimientos, con la información vinculada a cada paciente.» | Agenda → paciente → expediente. Resaltar pestañas y documentos reales del mismo paciente. Texto principal: **Cada paciente, con su información.** Mostrar los módulos como apoyos breves, sin intentar leer todas sus pantallas. |
| 27–35 s | «Controla existencias, entradas y salidas. Identifica productos con bajo stock y revisa sus fechas de vencimiento.» | Inventario → movimiento → indicador de stock y vencimiento. Texto: **Existencias y movimientos.** Mostrar una alerta dentro del sistema, sin fingir una notificación externa. |
| 35–46 s | «Registra cobros y gastos. Genera comprobantes y consulta el balance, con el detalle de lo que corresponde a la clínica y a los profesionales.» | Documento → pago registrado → resumen financiero → balance. Priorizar la distinción **Clínica / Profesionales** y la lectura del balance. Mantener los mismos importes del ejemplo de demostración. |
| 46–52 s | «Revisa pacientes atendidos y reportes. Consulta la plataforma desde tu computadora o celular.» | Reporte de atendidos y transición a la vista móvil real. Texto: **Tu operación, a la vista.** |
| 52–60 s | «LumeaMed. Tu clínica, mejor organizada. Agenda tu demostración y conoce cómo administrar tu consultorio desde un solo lugar.» | Identidad de marca, CTA y dominio. Dejar el cierre estable al menos los últimos cuatro segundos. Crédito secundario de ASG Development. |

### Locución continua

> Entre agendas, expedientes y cobros, administrar tu consultorio puede ocupar gran parte del día.
>
> Cuando la información está separada, cuesta seguir cada cita, cada documento y cada pago.
>
> Con LumeaMed, reúne la gestión diaria de tu clínica en un solo lugar.
>
> Organiza pacientes y agendas. Consulta expedientes y registra notas, recetas, exámenes y procedimientos, con la información vinculada a cada paciente.
>
> Controla existencias, entradas y salidas. Identifica productos con bajo stock y revisa sus fechas de vencimiento.
>
> Registra cobros y gastos. Genera comprobantes y consulta el balance, con el detalle de lo que corresponde a la clínica y a los profesionales.
>
> Revisa pacientes atendidos y reportes. Consulta la plataforma desde tu computadora o celular.
>
> LumeaMed. Tu clínica, mejor organizada. Agenda tu demostración y conoce cómo administrar tu consultorio desde un solo lugar.

El inventario funcional del brief es más amplio que el anuncio. Las plantillas, respaldos, especialidades y detalles del reparto se explican en la demostración comercial; no añadir más locución para intentar enumerarlos todos en 60 segundos.

## ③ ESTILO VISUAL

### Identidad existente

Usar la identidad del proyecto. Existe el archivo **`lmd_logo.png`**, cuyo texto visible es **LMD**, y una identidad de acceso construida en HTML/CSS con el nombre de la plataforma. No tratar el PNG como si incluyera el nombre completo LumeaMed.

Para el video, usar el PNG sin deformarlo ni reinterpretarlo y acompañarlo con el nombre **LumeaMed** como texto independiente. Si se obtiene un original vectorial oficial, utilizarlo. Animar el recurso completo con escala, opacidad y máscara; separar isotipo y letras únicamente si existen archivos oficiales separados.

### Paleta basada en el proyecto

| Uso | Color |
|---|---|
| Primario de la interfaz | `#2563EB` |
| Primario oscuro | `#1D4ED8` |
| Acento de interfaz | `#06B6D4` |
| Fondo de identidad/acceso | `#080C18` |
| Fondo oscuro y navegación | `#0F172A` |
| Cian de identidad | `#00D4FF` |
| Violeta de identidad | `#7C4DFF` |
| Estado positivo | `#10B981` |
| Advertencia de interfaz | `#F59E0B` |
| Alerta de interfaz | `#EF4444` |
| Blanco | `#FFFFFF` |

Son valores presentes en la implementación, no un manual de marca certificado. Preservar los fondos, colores y estados propios de cada captura. Usar el degradado cian/violeta como acento de identidad; no sustituir toda la interfaz por el turquesa provisional del brief original.

### Tipografía y composición

- **Inter:** titulares, textos y acompañamiento de la interfaz.
- **Outfit:** nombre de marca y acentos coherentes con la pantalla de acceso.
- No introducir DM Sans como tipografía principal: no es la combinación utilizada actualmente en el proyecto.
- Dirección: interfaz real, tarjetas, sombras suaves y profundidad moderada.
- Metáfora: los registros separados se ordenan alrededor del recorrido del paciente.
- Inicio oscuro y contenido; después, claridad visual y movimientos precisos.
- No usar pantallas densas como fondos ilegibles: ampliar el área que demuestra la función.
- Cambios de foco cada 2–3 segundos en los bloques explicativos; sostener más tiempo la lectura de finanzas y balance.
- Transiciones: expansión de tarjeta, continuidad entre elementos, máscaras y desplazamientos suaves con aceleración y desaceleración.
- Mostrar móvil mediante su diseño responsive real; verificar tablet si se utiliza. No estirar una captura de escritorio para simular otra pantalla.

### Elementos prioritarios

Dashboard de clínica, pacientes, agenda por profesional, expediente, documentos, inventario, comprobantes, resumen financiero, balance, atendidos y móvil.

Evitar selectores globales de clínicas, paneles de usuarios, productividad global, configuración de red, migraciones, controles técnicos y pantallas de superadmin. Evitar metáforas de respaldo automático o sincronización continua no demostradas.

## ④ VOZ Y NARRACIÓN

- Voz femenina adulta, cercana y profesional; edad aparente aproximada de 28–38 años.
- Español latinoamericano neutro, adecuado para audiencia centroamericana.
- Ritmo objetivo: **145–155 palabras por minuto**, ajustado al audio real para respetar el máximo de 60 segundos.
- Intención: reconocimiento de las tareas diarias → organización → claridad → invitación a conocer la plataforma.
- Énfasis: **«un solo lugar»**, **«LumeaMed»**, **«balance»**, **«Tu clínica, mejor organizada»**.
- Pronunciación indicada en el encargo: **«Lú-me-a Med»**.
- El crédito ASG Development puede quedar solo en pantalla.
- Generar la voz por frases y conservar archivos individuales. Elegir el motor disponible y verificar sus condiciones de uso comercial antes de producir.
- Si se utiliza ElevenLabs o Edge TTS, tratarlos como opciones de producción sujetas a disponibilidad; no asumir que existe una cuenta, licencia o acceso ya configurado.

## ⑤ AUDIO

- Música instrumental tecnológica, limpia y cálida; propuesta de tempo: **105–115 BPM**.
- Introducción con pocos elementos; apertura armónica al entrar LumeaMed.
- Efectos discretos para cambios de tarjeta, selección de módulo, registro de pago y aparición de marca.
- No convertir las alertas de stock en sonidos de alarma ni utilizar efectos de videojuego.
- Voz siempre inteligible. Usar ducking y ajustar la música aproximadamente 10 dB por debajo de la voz como punto de partida, verificando la mezcla al escuchar.
- Objetivo de entrega propuesto: aproximadamente **−14 LUFS integrados** y pico verdadero máximo de **−1 dBTP**.
- Recursos propios o con licencia compatible con el uso comercial. Documentar procedencia y condiciones de voz, música, efectos y tipografías.

## ⑥ PROCESO DE PRODUCCIÓN

1. **Preparar la demostración.** Usar una clínica ficticia, el perfil médico administrativo y sus permisos efectivos. Comprobar el recorrido que se capturará. No usar información real de pacientes ni modificar una clínica de producción para obtener imágenes.
2. **Capturar la interfaz existente.** La aplicación actual usa HTML, CSS y JavaScript; no es un proyecto React. Conservar sus pantallas como fuente visual.
3. **Preparar el montaje.** Crear, si se utiliza, un proyecto audiovisual independiente con Remotion/React y componentes reutilizables para escenas, tipografía y transiciones. No migrar la aplicación clínica para producir el anuncio.
4. **Generar y medir locución.** Obtener la duración real de cada frase; ajustar pausas y montaje. Los segundos del storyboard son una guía, no timestamps ya generados.
5. **Animar.** Utilizar aceleraciones suaves, spring moderado y continuidad entre tarjetas. Mantener los nombres, cifras y estados consistentes con el recorrido.
6. **Integrar audio y subtítulos.** Sincronizar efectos con acciones visibles y preparar subtítulos en español. Mantener legible la información importante sin depender del sonido.
7. **Verificar la preview.** Revisar el video completo y extraer fotogramas cada 0.5 segundos para detectar cortes, superposiciones y errores de datos.
8. **Exportar.** Generar el máster, comprobar duración y formato, y revisar CTA y sonido en escritorio y móvil.

### Revisión de contenido antes del máster

- Ninguna pantalla de superadmin ni función atribuida al médico que no le corresponda.
- Permisos de Inventario y Finanzas habilitados en la cuenta demostrada.
- Reportes clínicos diarios, semanales y mensuales; no inventar una pestaña anual de Estadísticas.
- Balance mostrado conforme a la lógica de reparto y al período elegido.
- Factura o comprobante presentado como documento del sistema; no atribuirle certificación fiscal ni integración tributaria.
- Archivos de exámenes presentados como documentos adjuntos, no como resultados interpretados automáticamente.
- Firma gráfica en impresos sin atribuirle firma electrónica certificada.
- Respaldo descrito como descarga manual; los archivos digitalizados no deben presentarse como un paquete binario completo si solo se conservan referencias o enlaces.
- Sin promesas de recordatorios automáticos de citas por WhatsApp, pagos en línea, aplicaciones nativas, uso sin conexión o disponibilidad desde cualquier red.
- Sin porcentajes comerciales o cifras de clientes inventadas.
- Nombre, identidad, ortografía y subtítulos correctos; CTA estable y legible.

## ⑦ ENTREGABLES DE LA FUTURA PRODUCCIÓN

**Video:** MP4 H.264 con audio AAC, 1920 × 1080, 30 FPS y duración máxima de 60 segundos.

**Proyecto editable:** composición y escenas, capturas ficticias, identidad utilizada, tipografías, locución por frases, música y efectos organizados.

**Documentación:** guion final, storyboard, timestamps medidos, subtítulos SRT, lista de recursos y licencias, supuestos y registro de revisión.

**Adaptación opcional posterior:** pieza vertical de 30 segundos, con montaje y textos recompuestos. No entregar un recorte automático como si fuera una adaptación terminada.

## ⑧ SUPUESTOS Y LÍMITES DE LA ADAPTACIÓN

1. «Administración total de un médico» se interpreta como la operación de su clínica mediante el perfil **Médico administrativo**, con los módulos requeridos habilitados.
2. La gestión de usuarios, permisos y configuración general queda fuera de la historia. La configuración específica del reparto en Balance sí pertenece al recorrido identificado para el médico administrativo.
3. El inventario de funciones se basa en el repositorio local. No se verificó una sesión autenticada ni el estado de las migraciones de una base remota.
4. Se conservan marca, tagline, duración, audiencia y crédito del encargo; se corrigen funcionalidades, restricciones, tipografías y colores según el proyecto.
5. El soporte de especialidades es contextual. No mostrar todos los módulos especializados simultáneamente como si estuvieran disponibles para cualquier cuenta.
6. Los respaldos identificados requieren una acción del usuario. No hay evidencia en lo revisado para anunciar respaldos diarios automáticos.
7. El acceso web está sujeto a conexión, autenticación y restricciones de acceso configuradas. No prometer acceso irrestricto «desde cualquier lugar».
8. El producto registra métodos de pago; eso no demuestra procesamiento bancario o cobro en línea.
9. El dato de consentimiento en procedimientos sirve para documentarlo; no implica un flujo de firma electrónica del paciente.
10. La pieza promocional prioriza el recorrido principal. Las funciones complementarias quedan documentadas para la demo, sin saturar el anuncio.

---

## ANEXO — Evidencia local y correcciones al texto original

Rutas relativas al repositorio. Las líneas sirven para localizar la versión revisada y pueden cambiar con futuras ediciones.

| Hallazgo | Evidencia |
|---|---|
| Perfil y permisos efectivos; Inventario y Finanzas no se conceden por defecto a `medico_admin`. | `js/app.js:8`, `PERMISOS_DEFECTO`; `js/app.js:13339`, `permisosEfectivos` y `hasPermiso`. |
| Administración y Configuración visibles solo para superadmin. | `js/app.js:13368`, `applyRoleMenu`, especialmente el bloque de administración. |
| Dashboard operativo de clínica, distinto del global. | `js/app.js:2100`, `renderDashboardClinica`. |
| Registro y consulta de pacientes y expedientes. | `js/app.js:2352`, `renderPacientes`; `js/app.js:2575`, `renderDetalleP`; `js/app.js:8296`, `guardarExpediente`; `js/app.js:17050`, `renderExpedientes`. |
| La cita contempla advertencias por solapamiento y reprogramación. | `js/app.js:3494`, `guardarCita`. |
| Cancelar citas de agenda y quitar la agenda de un profesional son acciones diferentes. La segunda se reserva al superadmin. | `js/app.js:10171`, `puedeVaciarAgenda`; `js/app.js:10226`, `puedeGestionarAgendaProfesional`. |
| Borradores, plantillas y documentos de notas. | `js/app.js:4546`, bloque de plantillas; `js/app.js:4883`, machotes; `js/app.js:7128`, `guardarNota`. |
| Recetas y exámenes digitalizados. | `js/app.js:3989`, `guardarMedicacion`; `js/app.js:7582`, `imprimirRecetaPaciente`; `js/app.js:8134`, `guardarExamen`. |
| Procedimientos y seguimiento vinculados al paciente. | `js/app.js:12455`, `renderProcedimientosClinicosView`; `js/app.js:12639`, `_leerProcClinForm`; `migracion_procedimientos_clinicos.sql`. |
| Inventario, kardex, mínimo de stock y vencimiento. | `js/app.js:10307`, `renderInventario`; `js/app.js:10375`, `abrirKardex`; `js/app.js:10515`, `_invVencStatus`. |
| Finanzas, emisión de documentos y cobro que registra ingreso y salida de productos vinculados. | `js/app.js:15404`, `renderFinanzas`; `js/app.js:16158`, `guardarFactura`; `js/app.js:16216`, `pagarFactura`. |
| Balance disponible para `medico_admin`; reparto porcentual o manual y separación de la parte profesional. | `js/app.js:13359`, `puedeVerBalance`; `js/app.js:16632`, `renderBalanceFinanzas`; `js/app.js:16771`, `cambiarModoBalance`; `migracion_balance_manual.sql`. |
| Estadísticas de atención: día, semana y mes. Los reportes de inventario sí contemplan período anual, y Finanzas tiene filtro de año. | `js/app.js:13148`, `switchEstTab`; `js/app.js:10443`, `switchRepTab`; `js/app.js:15373`, `getFinDateRange`. |
| Respaldo manual JSON y PDF; restauración condicionada. Para usuarios no superadmin se omiten usuarios y configuración de clínica en la restauración. | `js/app.js:9085`, `_construirBackupClinica`; `js/app.js:9176`, `exportarJSON`; `js/app.js:9256`, `exportarPDFClinica`; `js/app.js:9348`, `_restaurarBackupV2`. |
| Exportar por correo abre el cliente de correo; no constituye envío automático del servidor. | `js/app.js:8992`, `exportarEmail`. |
| Los recordatorios de WhatsApp encontrados corresponden a veterinaria y abren un chat con texto preparado. | `js/app.js:19387`, `recordarPorWhatsApp`. |
| Interfaz actual y fuentes. | `index.html:14`, Inter/Outfit; `css/styles.css:13`, variables; estilos `.lm-letters`, `.lm-inner` y `#login-screen`. |
| Activo visual local y dominio. | `lmd_logo.png`, inspeccionado visualmente; `CNAME`. |

**Corrección central:** el mensaje comercial debe ser «organiza la operación de tu consultorio de la cita al balance». No presentar «control total del sistema», porque ese alcance incluiría funciones que el médico administrativo no tiene.
