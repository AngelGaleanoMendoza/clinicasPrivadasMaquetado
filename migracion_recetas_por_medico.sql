-- Separación de recetas por médico prescriptor
-- Ejecutar una vez en Supabase > SQL Editor antes de publicar esta versión.

ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS receta_id TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS fecha_emision DATE;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_id TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_nombre TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_especialidad TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_firma_url TEXT;

CREATE INDEX IF NOT EXISTS medicaciones_receta_id_idx
  ON public.medicaciones(receta_id);

COMMENT ON COLUMN public.medicaciones.receta_id IS
  'Identificador común para todos los medicamentos emitidos en una misma receta';
COMMENT ON COLUMN public.medicaciones.prescriptor_id IS
  'ID del perfil que emitió la receta; texto para admitir perfiles legacy y UUID';
COMMENT ON COLUMN public.medicaciones.prescriptor_nombre IS
  'Instantánea del nombre del médico al emitir la receta';
COMMENT ON COLUMN public.medicaciones.prescriptor_especialidad IS
  'Instantánea de la especialidad del médico al emitir la receta';
COMMENT ON COLUMN public.medicaciones.prescriptor_firma_url IS
  'Instantánea de la firma usada al emitir la receta';
