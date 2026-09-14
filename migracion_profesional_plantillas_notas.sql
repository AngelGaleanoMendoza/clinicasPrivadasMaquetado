-- ============================================================
-- LUMEA MED - Profesional responsable y machotes de notas
--
-- Ejecutar una vez en: Supabase -> SQL Editor
-- ============================================================

-- La nota conserva una fotografia del profesional que la cerró. No se usan
-- FK hacia profiles para que el documento clínico sobreviva si la cuenta se
-- desactiva, elimina o cambia de especialidad/firma.
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS profesional_id UUID;
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS profesional_nombre TEXT;
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS profesional_especialidad TEXT;
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS profesional_firma_url TEXT;

CREATE TABLE IF NOT EXISTS public.plantillas_notas (
  id BIGSERIAL PRIMARY KEY,
  clinica_id BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  tipo_nota TEXT NOT NULL DEFAULT 'evolucion',
  contenido_modelo TEXT NOT NULL,
  campos JSONB NOT NULL DEFAULT '[]'::jsonb,
  archivo_nombre TEXT,
  archivo_url TEXT,
  creado_por UUID,
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notas
  ADD COLUMN IF NOT EXISTS plantilla_id BIGINT REFERENCES public.plantillas_notas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notas_profesional
  ON public.notas(clinica_id, profesional_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_plantillas_notas_clinica_tipo
  ON public.plantillas_notas(clinica_id, tipo_nota) WHERE activa = TRUE;

-- NOT VALID permite conservar notas históricas sin autor. PostgreSQL sí
-- aplica la regla a cada alta o modificación nueva desde este momento.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'notas_finalizada_profesional_check'
      AND conrelid = 'public.notas'::regclass
  ) THEN
    ALTER TABLE public.notas
      ADD CONSTRAINT notas_finalizada_profesional_check
      CHECK (estado <> 'finalizada' OR NULLIF(BTRIM(profesional_nombre), '') IS NOT NULL)
      NOT VALID;
  END IF;
END $$;

ALTER TABLE public.plantillas_notas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "plantillas_notas_clinica" ON public.plantillas_notas;
CREATE POLICY "plantillas_notas_clinica" ON public.plantillas_notas
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

COMMENT ON COLUMN public.notas.profesional_nombre IS
  'Nombre historico del profesional responsable, obligatorio al cerrar una nota nueva.';
COMMENT ON COLUMN public.plantillas_notas.contenido_modelo IS
  'Texto extraido del machote; los marcadores {{Campo}} se convierten en controles rellenables.';

-- Comprobacion rapida.
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_name = 'plantillas_notas';

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'notas'
  AND column_name IN ('profesional_id','profesional_nombre','profesional_especialidad','profesional_firma_url','plantilla_id')
ORDER BY column_name;
