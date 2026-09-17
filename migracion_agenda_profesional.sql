-- ============================================================
-- LUMEA MED - Quién lleva agenda
--
-- Ejecutar una vez en: Supabase -> SQL Editor
--
-- No todo el personal atiende citas. Recepción o administración trabajan con
-- normalidad pero no tienen pacientes a su nombre, y aparecer en el módulo de
-- Agendas y en la lista de médicos al crear una cita solo estorba.
--
-- `con_agenda = FALSE` los saca de ahí. NO toca su cuenta: entran, trabajan y
-- conservan su rol igual que siempre, y su nombre sigue en las citas que ya
-- hubieran atendido.
--
-- Este archivo sustituye a migracion_baja_profesional.sql, que marcaba a la
-- persona como inactiva y de paso le quitaba el acceso. Si lo ejecutaste, este
-- script deshace aquello: traslada la intención a con_agenda y elimina las
-- columnas viejas, con lo que todo el mundo recupera el acceso.
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS con_agenda BOOLEAN NOT NULL DEFAULT TRUE;

-- Quien hubiera quedado marcado como inactivo pasa a ser simplemente alguien
-- sin agenda. Se comprueba que la columna exista para poder ejecutar este
-- archivo aunque nunca se corriera el anterior.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'activo'
  ) THEN
    EXECUTE 'UPDATE public.profiles SET con_agenda = FALSE WHERE activo IS FALSE';
  END IF;
END $$;

-- Estas tres dejan de usarse: quitar la agenda ya no es una baja de personal.
-- Al desaparecer `activo`, nadie puede volver a quedarse fuera por su culpa.
ALTER TABLE public.profiles DROP COLUMN IF EXISTS activo;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS baja_fecha;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS baja_motivo;

DROP INDEX IF EXISTS public.profiles_clinica_activo_idx;

-- Las agendas piden el personal de una clínica en cada carga.
CREATE INDEX IF NOT EXISTS profiles_clinica_agenda_idx
  ON public.profiles(clinica_id, con_agenda);

COMMENT ON COLUMN public.profiles.con_agenda IS
  'FALSE = no atiende citas: no sale en Agendas ni en los selectores de médico. No afecta al acceso ni al rol.';

-- Comprobación: una fila con con_agenda, y ninguna con las columnas viejas.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles'
  AND column_name IN ('con_agenda','activo','baja_fecha','baja_motivo')
ORDER BY column_name;
