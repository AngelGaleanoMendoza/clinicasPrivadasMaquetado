-- ============================================================
-- LUMEA MED - Código del médico en cada nota
--
-- Ejecutar una vez en: Supabase -> SQL Editor
-- Requiere haber ejecutado antes migracion_profesional_plantillas_notas.sql
-- ============================================================

-- Los médicos de una clínica pueden cambiar y no siempre tienen cuenta: cada
-- nota guarda el nombre escrito del médico que atendió y su código MINSA (o
-- registro profesional en veterinaria). La app lo exige para guardar la nota.
-- No se agrega una restricción en la base: las notas anteriores no tienen
-- código y deben poder seguir editándose.
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS profesional_codigo TEXT;

COMMENT ON COLUMN public.notas.profesional_codigo IS
  'Código MINSA (o registro profesional) del médico que atendió, escrito en la nota.';

-- La tabla notas ya tiene RLS por clínica: la columna nueva queda protegida por ella.

-- Comprobación rápida: debe salir 1 fila
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notas' AND column_name = 'profesional_codigo';
