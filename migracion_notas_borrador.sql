-- ============================================================
-- LUMEA MED — Estado editable de las notas clínicas
--
-- Ejecutar una vez en: Supabase → SQL Editor
--
-- Una nota puede quedar a medias: el médico empieza a escribir durante la
-- consulta y la termina después. Sin un estado real, ese borrador se
-- confundía con una nota clínica cerrada — se imprimía y alimentaba los
-- signos vitales del expediente como si estuviera terminada.
--
-- Las notas que ya existen se marcan como 'finalizada': estaban en uso y
-- ninguna era un borrador.
-- ============================================================

ALTER TABLE public.notas
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'finalizada';

-- Solo dos estados posibles. Se comprueba antes de crearla para poder
-- reejecutar el archivo entero sin error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notas_estado_check' AND conrelid = 'public.notas'::regclass
  ) THEN
    ALTER TABLE public.notas
      ADD CONSTRAINT notas_estado_check CHECK (estado IN ('borrador','finalizada'));
  END IF;
END $$;

-- Los listados filtran por clínica y estado a la vez.
CREATE INDEX IF NOT EXISTS idx_notas_estado
  ON public.notas(clinica_id, estado);

COMMENT ON COLUMN public.notas.estado IS
  'borrador permite continuar editando; finalizada identifica una nota clínica terminada.';

-- Comprobación: debe devolver una fila con la columna ya creada
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notas' AND column_name = 'estado';
