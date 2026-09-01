-- Signos vitales por consulta
-- Ejecutar una vez en Supabase > SQL Editor antes de publicar esta versión.

ALTER TABLE public.notas
  ADD COLUMN IF NOT EXISTS cita_id BIGINT REFERENCES public.citas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_notas_cita_id
  ON public.notas(cita_id);

CREATE INDEX IF NOT EXISTS idx_notas_paciente_fecha_signos
  ON public.notas(paciente_id, fecha DESC, id DESC)
  WHERE signos IS NOT NULL;

COMMENT ON COLUMN public.notas.cita_id IS
  'Cita que originó la nota y sus signos vitales; permite conservar una medición independiente por consulta.';
