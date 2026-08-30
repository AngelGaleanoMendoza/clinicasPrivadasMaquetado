-- Plantillas personalizadas de recetario por médico
-- Ejecutar una vez en Supabase > SQL Editor.

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recetario_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS recetario_config JSONB;

-- La receta conserva una instantánea. Si el médico cambia su plantilla mañana,
-- las recetas ya emitidas continúan imprimiéndose con el formato original.
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS recetario_url TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS recetario_config JSONB;

COMMENT ON COLUMN public.profiles.recetario_url IS
  'Imagen de fondo del recetario personal del médico';
COMMENT ON COLUMN public.profiles.recetario_config IS
  'Área imprimible en milímetros: top, side y bottom';
COMMENT ON COLUMN public.medicaciones.recetario_url IS
  'Instantánea de la plantilla usada al emitir la receta';
COMMENT ON COLUMN public.medicaciones.recetario_config IS
  'Instantánea de la calibración usada al emitir la receta';
