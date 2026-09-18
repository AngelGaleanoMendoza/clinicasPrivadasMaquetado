-- ============================================================
-- LUMEA MED - Categorías de finanzas propias de cada clínica
--
-- Ejecutar una vez en: Supabase -> SQL Editor. Es idempotente.
--
-- Las categorías de ingreso y gasto venían fijas en el código y no servían
-- igual a todas las clínicas. Aquí se guardan las que cada clínica añade;
-- las de fábrica siguen viviendo en el código y no hace falta copiarlas.
--
-- Forma: {"ingreso":[{"id":"...","label":"...","icon":"..."}],"egreso":[...]}
-- Una propia con el mismo id que una de fábrica la sustituye, lo que permite
-- renombrarla sin perder los registros ya guardados con ese id.
-- ============================================================

ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS categorias_finanzas JSONB;

COMMENT ON COLUMN public.clinicas.categorias_finanzas IS
  'Categorías de finanzas propias de la clínica, por tipo. NULL usa solo las de fábrica.';

-- Comprobación: debe devolver una fila.
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'clinicas'
  AND column_name = 'categorias_finanzas';
