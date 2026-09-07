-- ============================================================
-- LUMEA MED - Productividad y ultima conexion por usuario
--
-- Ejecutar una vez en: Supabase -> SQL Editor
-- ============================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ultimo_acceso TIMESTAMPTZ;

ALTER TABLE public.actividad_usuarios
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ;

ALTER TABLE public.actividad_usuarios
  ALTER COLUMN created_at SET DEFAULT NOW();

UPDATE public.actividad_usuarios
SET created_at = COALESCE(fecha::TIMESTAMP, NOW())
WHERE created_at IS NULL;

ALTER TABLE public.actividad_usuarios
  ALTER COLUMN created_at SET NOT NULL;

CREATE INDEX IF NOT EXISTS actividad_usuarios_clinica_fecha_idx
  ON public.actividad_usuarios(clinica_id, fecha DESC);

CREATE INDEX IF NOT EXISTS actividad_usuarios_usuario_fecha_idx
  ON public.actividad_usuarios(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS actividad_usuarios_accion_fecha_idx
  ON public.actividad_usuarios(accion, created_at DESC);

CREATE INDEX IF NOT EXISTS profiles_ultimo_acceso_idx
  ON public.profiles(ultimo_acceso DESC NULLS LAST);

-- Supabase Auth conserva la conexion real aunque la version anterior de la app
-- no haya alcanzado a escribir su evento en actividad_usuarios.
UPDATE public.profiles AS p
SET ultimo_acceso = u.last_sign_in_at
FROM auth.users AS u
WHERE u.last_sign_in_at IS NOT NULL
  AND (
    p.id::TEXT = u.id::TEXT
    OR (
      p.email IS NOT NULL
      AND u.email IS NOT NULL
      AND LOWER(p.email) = LOWER(u.email)
    )
  )
  AND (p.ultimo_acceso IS NULL OR p.ultimo_acceso < u.last_sign_in_at);

-- Recuperar la ultima conexion que ya exista en el historial. user_id puede ser
-- UUID o texto dependiendo de la antiguedad de la instalacion.
WITH ultimos_login AS (
  SELECT
    user_id::TEXT AS user_ref,
    MAX(created_at) AS ultimo_acceso
  FROM public.actividad_usuarios
  WHERE accion = 'login'
  GROUP BY user_id::TEXT
)
UPDATE public.profiles AS p
SET ultimo_acceso = u.ultimo_acceso
FROM ultimos_login AS u
WHERE (
    p.id::TEXT = u.user_ref
    OR LOWER(COALESCE(p.email, '')) = LOWER(u.user_ref)
  )
  AND (p.ultimo_acceso IS NULL OR p.ultimo_acceso < u.ultimo_acceso);

-- Mantener profiles.ultimo_acceso sincronizado aunque el navegador se cierre
-- inmediatamente despues de insertar el evento de login.
CREATE OR REPLACE FUNCTION public.sincronizar_ultimo_acceso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.accion = 'login' THEN
    UPDATE public.profiles
    SET ultimo_acceso = COALESCE(NEW.created_at, NOW())
    WHERE id::TEXT = NEW.user_id::TEXT
       OR LOWER(COALESCE(email, '')) = LOWER(NEW.user_id::TEXT);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS actividad_usuarios_ultimo_acceso
  ON public.actividad_usuarios;

CREATE TRIGGER actividad_usuarios_ultimo_acceso
AFTER INSERT ON public.actividad_usuarios
FOR EACH ROW
EXECUTE FUNCTION public.sincronizar_ultimo_acceso();

COMMENT ON COLUMN public.profiles.ultimo_acceso IS
  'Fecha y hora del ultimo inicio de sesion exitoso en Lumea Med.';

-- Comprobacion: muestra todos los usuarios y su ultima conexion conocida.
SELECT id, nombre, email, clinica_id, ultimo_acceso
FROM public.profiles
ORDER BY ultimo_acceso DESC NULLS LAST, nombre;
