# Lumea Med — Guía del proyecto

Sistema de gestión para clínicas privadas. JavaScript sin framework, Supabase como
backend y GitHub Pages como hosting.

## Cómo trabajar aquí

- **Todo va en `main`.** No se usan ramas de trabajo ni pull requests.
- **Siempre aplicar mejoras visuales.** Al construir o tocar cualquier función,
  dejarla además pulida y responsive sin que haya que pedirlo: revisar cómo se ve
  en escritorio y en móvil, y corregir lo que quede desalineado, apretado o
  desbordado.
- El sistema se usa mucho **desde el teléfono**. Toda vista nueva se prueba a
  360–430 px, no solo en escritorio.
- La interfaz está **en español**, incluidos mensajes de error y textos de botones.

## Estructura

`index.html` debe quedarse en la raíz para que GitHub Pages funcione. El código
vive en tres archivos: `index.html`, `js/app.js` y `css/styles.css`. Las carpetas
`html/` y `scss/` son de una refactorización que quedó a medias; no se usan.

## Reglas que ya causaron errores

- **El bucket de Storage es `Pacientes`, con mayúscula.** Supabase distingue
  mayúsculas; usar la constante `STORAGE_BUCKET`, nunca el nombre suelto.
- **No fijar en el código datos de una clínica concreta.** El sistema es
  multiclínica: lo específico (padecimientos del recetario, línea institucional,
  membrete) va en la configuración de cada clínica y, si está vacío, no se imprime.
- **Toda tabla nueva necesita su política RLS** en `rls_setup.sql`. Sin ella queda
  abierta a todas las clínicas, y aquí se guardan datos médicos.
- **Los permisos guardados mandan sobre el rol.** Una lista vacía significa "sin
  permisos", no "usar los del rol". El defecto por rol solo aplica a usuarios
  antiguos que nunca tuvieron permisos configurados (`permisos` en `null`).
- **Al escribir una columna nueva**, contemplar que quizá no exista todavía en
  Supabase: reintentar sin ella y avisar, en vez de romper el formulario entero.

## Impresos

Los PDF se arman como HTML en `pdfAbrir()`, que no carga `css/styles.css`: los
estilos van embebidos en `PDF_CSS` o en línea. La firma y la especialidad salen
del usuario en sesión, con respaldo a los datos de la clínica.

## Base de datos

Supabase, proyecto `galesistem`. El Super Admin está fijado por email en
`SUPER_ADMIN_EMAIL` y nunca se bloquea por intentos fallidos.
