-- ============================================================
-- LUMEA MED - Baja de un profesional que deja la clínica
--
-- Ejecutar una vez en: Supabase -> SQL Editor
--
-- Cuando un médico se va no se borra su perfil: su nombre tiene que seguir
-- apareciendo en las citas que atendió, en las notas que firmó y en las recetas
-- que emitió. Un expediente sin saber quién atendió al paciente no sirve como
-- documento clínico.
--
-- En su lugar el perfil se marca como inactivo: deja de aparecer en las agendas
-- y en los selectores al crear citas, y no puede iniciar sesión, pero todo lo
-- que ya firmó se conserva intacto.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- Quién se fue y cuándo. El motivo es libre: renuncia, fin de contrato,
-- traslado, cuenta duplicada.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS baja_fecha  TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS baja_motivo TEXT;

-- Las agendas piden el personal activo de una clínica en cada carga.
CREATE INDEX IF NOT EXISTS profiles_clinica_activo_idx
  ON public.profiles(clinica_id, activo);

COMMENT ON COLUMN public.profiles.activo IS
  'FALSE = el profesional dejó la clínica: no entra ni se le asignan citas nuevas, pero su historial se conserva.';
COMMENT ON COLUMN public.profiles.baja_fecha IS
  'Fecha en que se dio de baja al profesional.';
COMMENT ON COLUMN public.profiles.baja_motivo IS
  'Motivo escrito al darlo de baja; queda como rastro de por qué dejó de aparecer.';

-- Comprobación: debe devolver las tres columnas.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('activo','baja_fecha','baja_motivo')
ORDER BY column_name;
