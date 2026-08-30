-- Configuración personal del recetario por médico
-- Esta migración se conserva por compatibilidad. El diseño actual es digital y
-- utiliza recetario_config; recetario_url queda como columna legacy sin uso.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recetario_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recetario_config JSONB;

-- La receta conserva una instantánea de la configuración digital.
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS recetario_url TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS recetario_config JSONB;

COMMENT ON COLUMN public.profiles.recetario_url IS
  'Columna legacy; el recetario digital no usa imágenes de fondo';
COMMENT ON COLUMN public.profiles.recetario_config IS
  'Configuración estructurada del recetario digital del médico';
COMMENT ON COLUMN public.medicaciones.recetario_url IS
  'Columna legacy; no se usa en nuevas recetas';
COMMENT ON COLUMN public.medicaciones.recetario_config IS
  'Instantánea del diseño digital usado al emitir la receta';
