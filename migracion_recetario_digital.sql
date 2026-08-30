-- Formulario digital de recetas
-- Ejecutar una vez en Supabase > SQL Editor.

-- Estos datos pertenecen a la receta completa. Se repiten en sus medicamentos
-- para mantener compatibilidad con el modelo actual basado en medicaciones.
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS diagnostico TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS receta_notas TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS proxima_cita DATE;

COMMENT ON COLUMN public.profiles.recetario_config IS
  'Diseño digital: distribución, color, encabezado, registro, institución, lista lateral y pie';
COMMENT ON COLUMN public.medicaciones.recetario_config IS
  'Instantánea del diseño digital usado al emitir la receta';
COMMENT ON COLUMN public.medicaciones.diagnostico IS
  'Diagnóstico compartido por todos los medicamentos de la receta';
COMMENT ON COLUMN public.medicaciones.receta_notas IS
  'Indicaciones generales compartidas por la receta';
COMMENT ON COLUMN public.medicaciones.proxima_cita IS
  'Fecha de próximo control indicada en la receta';
