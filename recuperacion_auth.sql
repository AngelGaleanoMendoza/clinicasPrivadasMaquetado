-- ============================================================
-- LUMEA MED — Recuperación de acceso tras la migración a Supabase Auth
--
-- Ejecutar en: Supabase → SQL Editor
--
-- CÓMO USARLO: ejecuta UN BLOQUE A LA VEZ, de arriba a abajo, y lee el
-- resultado de cada uno antes de seguir. No lo pegues entero de una vez:
-- el BLOQUE 4 necesita que TÚ decidas qué contraseña lleva cada usuario.
--
-- NO ejecutes rls_setup.sql por partes. Su "PASO 8" reescribe la política
-- profiles_select SIN el reconocimiento por email y deshace el arreglo del
-- "PASO 9". El archivo solo es correcto ejecutado entero, de principio a fin.
-- ============================================================


-- ============================================================
-- BLOQUE 0 — DIAGNÓSTICO (solo lectura, no cambia nada)
--
-- Ejecuta esto primero. La columna "problema" te dice, por cada persona,
-- exactamente por qué no puede entrar.
-- ============================================================

SELECT
  p.email,
  p.nombre,
  p.rol,
  p.clinica_id,
  CASE
    WHEN p.email IS NULL OR btrim(p.email) = ''
      THEN 'SIN CORREO — no puede entrar de ninguna forma; asígnale uno'
    WHEN u.id IS NULL
      THEN 'SIN CUENTA EN AUTH — créala desde el Dashboard (ver BLOQUE 3)'
    WHEN u.email_confirmed_at IS NULL
      THEN 'CORREO SIN CONFIRMAR — lo arregla el BLOQUE 2'
    WHEN p.id IS DISTINCT FROM u.id
      THEN 'ID DESALINEADO — lo arregla el BLOQUE 5'
    ELSE 'OK'
  END AS problema,
  (p.password IS NOT NULL AND p.password <> '') AS conserva_clave_antigua,
  p.bloqueado,
  p.intentos_fallidos,
  u.last_sign_in_at AS ultimo_ingreso_real
FROM public.profiles p
LEFT JOIN auth.users u ON lower(u.email) = lower(btrim(p.email))
ORDER BY
  CASE
    WHEN p.email IS NULL OR btrim(p.email) = '' THEN 1
    WHEN u.id IS NULL                           THEN 2
    WHEN u.email_confirmed_at IS NULL           THEN 3
    WHEN p.id IS DISTINCT FROM u.id             THEN 4
    ELSE 5
  END,
  p.email;


-- ============================================================
-- BLOQUE 1 — Dejar las políticas en su versión correcta
--
-- Idempotente: se puede repetir sin daño. Esto garantiza que un usuario
-- pueda leer su propia fila aunque su id todavía no coincida con Auth,
-- que es la condición para que el login funcione.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_clinica_id()
RETURNS bigint LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT p.clinica_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
     OR (auth.uid() IS NOT NULL
         AND lower(p.email) = lower(nullif(auth.jwt() ->> 'email', '')))
  ORDER BY (p.id = auth.uid()) DESC NULLS LAST
  LIMIT 1;
$$;

-- Antes de nada, asegurar el rol del Super Admin. Si su fila tiene `rol` vacío,
-- la función de abajo le negaría el acceso a todas las tablas en cuanto se
-- reemplace. La app ya fija al Super Admin por correo (SUPER_ADMIN_EMAIL), así
-- que aquí se refleja la misma regla.
UPDATE public.profiles
SET rol = 'superadmin'
WHERE lower(btrim(email)) = 'sebasgale65@gmail.com'
  AND coalesce(rol, '') <> 'superadmin';

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles AS p
    WHERE auth.uid() IS NOT NULL
      AND (p.id = auth.uid()
           OR lower(p.email) = lower(nullif(auth.jwt() ->> 'email', '')))
      AND (
        p.rol = 'superadmin'
        -- Red de seguridad: el Super Admin está fijado por correo en la app
        -- (SUPER_ADMIN_EMAIL). Sin esto, borrarle el rol por accidente lo dejaría
        -- sin acceso a nada y sin forma de devolvérselo desde la interfaz.
        OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'sebasgale65@gmail.com'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_clinica_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_superadmin()     TO authenticated;

-- Leer el propio perfil aunque el id aún no esté sincronizado
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (auth.uid() IS NOT NULL
        AND lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
    OR public.is_superadmin()
    OR clinica_id = public.get_my_clinica_id()
  );

-- Y poder corregir el propio id (es lo que hace resolverPerfil al entrar)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR (auth.uid() IS NOT NULL
        AND lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
    OR public.is_superadmin()
    OR clinica_id = public.get_my_clinica_id()
  )
  WITH CHECK (
    id = auth.uid()
    OR (auth.uid() IS NOT NULL
        AND lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
    OR public.is_superadmin()
    OR clinica_id = public.get_my_clinica_id()
  );

COMMIT;


-- ============================================================
-- BLOQUE 2 — Confirmar los correos que la migración dejó a medias
--
-- Si "Confirm email" estaba ACTIVADA cuando corriste la migración, se
-- crearon cuentas en Auth que nunca quedaron confirmadas. Auth las rechaza
-- al iniciar sesión con el mensaje "Email not confirmed".
--
-- OJO: se toca SOLO email_confirmed_at. La columna confirmed_at es
-- GENERADA por Supabase (se calcula sola); escribirla da error.
-- ============================================================

BEGIN;

UPDATE auth.users u
SET email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
    updated_at         = now()
WHERE u.email_confirmed_at IS NULL
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE lower(btrim(p.email)) = lower(u.email)
  );

COMMIT;


-- ============================================================
-- BLOQUE 3 — Usuarios que NO tienen cuenta en Auth
--
-- Estos NO se crean por SQL. Insertar filas a mano en auth.users deja la
-- cuenta incompleta (falta su fila en auth.identities) y el login puede
-- fallar de formas difíciles de diagnosticar.
--
-- Hazlo desde el Dashboard, uno por uno:
--   Authentication → Users → "Add user" → "Create new user"
--   · Email: el mismo que aparece en profiles (respeta el texto exacto)
--   · Password: la que le vayas a dar
--   · MARCA la casilla "Auto Confirm User"
--
-- Después vuelve a ejecutar el BLOQUE 0 para comprobar, y sigue al BLOQUE 5.
--
-- Esta consulta te lista exactamente a quiénes les falta:
-- ============================================================

SELECT p.email, p.nombre, p.rol
FROM public.profiles p
LEFT JOIN auth.users u ON lower(u.email) = lower(btrim(p.email))
WHERE u.id IS NULL
  AND p.email IS NOT NULL
  AND btrim(p.email) <> ''
ORDER BY p.email;


-- ============================================================
-- BLOQUE 4 — Fijar contraseñas conocidas en Auth
--
-- Esto es lo que el botón "🔑 Contraseña" del panel NO hace: cambiar la
-- contraseña REAL de Supabase Auth. Úsalo para las personas que quedaron
-- fuera porque su cuenta de Auth tiene una clave distinta a la que conocen.
--
-- EDITA la lista de abajo: un par (correo, contraseña) por línea.
-- Borra las líneas de ejemplo y pon las tuyas. Cada persona debería
-- cambiarla después desde "¿Olvidaste tu contraseña?".
--
-- No pongas aquí contraseñas que quieras conservar en secreto a largo
-- plazo: quedan en el historial del SQL Editor de Supabase.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

BEGIN;

WITH nuevas(email, clave) AS (
  VALUES
    -- ↓↓↓ EDITA ESTAS LÍNEAS ↓↓↓
    ('juliotest@lumea.com', 'CambiarEn2026!'),
    ('machu@lumea.com',     'CambiarEn2026!')
    -- ↑↑↑ una línea por usuario, sin coma en la última ↑↑↑
)
UPDATE auth.users u
SET encrypted_password = extensions.crypt(n.clave, extensions.gen_salt('bf', 10)),
    email_confirmed_at = COALESCE(u.email_confirmed_at, now()),
    updated_at         = now()
FROM nuevas n
WHERE lower(u.email) = lower(btrim(n.email));

COMMIT;

-- Comprueba que las contraseñas quedaron aplicadas (debe decir true):
WITH nuevas(email, clave) AS (
  VALUES
    -- ↓↓↓ repite aquí la MISMA lista de arriba ↓↓↓
    ('juliotest@lumea.com', 'CambiarEn2026!'),
    ('machu@lumea.com',     'CambiarEn2026!')
)
SELECT u.email,
       (u.encrypted_password = extensions.crypt(n.clave, u.encrypted_password)) AS clave_correcta,
       (u.email_confirmed_at IS NOT NULL) AS correo_confirmado
FROM auth.users u
JOIN nuevas n ON lower(u.email) = lower(btrim(n.email));


-- ============================================================
-- BLOQUE 5 — Realinear profiles.id con el UUID de Auth
--
-- La migración dejó de sincronizar el id, y eso rompe dos cosas concretas:
--   · Al RECARGAR la página se pierde la sesión: el arranque busca el perfil
--     solo por id, sin el respaldo por email que sí tiene el login.
--   · Guardar un procedimiento oftalmológico falla, porque escribe
--     profesional_id contra una clave foránea a profiles(id).
--
-- Antes de mover los ids se cambia esa clave foránea a ON UPDATE CASCADE.
-- Sin eso, el UPDATE de profiles.id revienta por violación de clave foránea
-- y se cae el bloque entero.
-- ============================================================

BEGIN;

-- 5.1 — Toda clave foránea que apunte a profiles(id) debe seguirlo al cambiar.
-- Se buscan por catálogo en vez de por nombre, para no depender de cómo se
-- llamaron ni de que sepamos de antemano cuántas hay.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT con.conname,
           con.conrelid::regclass AS tabla,
           pg_get_constraintdef(con.oid) AS definicion
    FROM pg_constraint con
    JOIN pg_class ref ON ref.oid = con.confrelid
    JOIN pg_namespace n ON n.oid = ref.relnamespace
    WHERE con.contype = 'f'
      AND n.nspname = 'public'
      AND ref.relname = 'profiles'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%ON UPDATE CASCADE%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tabla, c.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s ON UPDATE CASCADE',
                   c.tabla, c.conname, c.definicion);
    RAISE NOTICE 'FK % en % ahora sigue al id (ON UPDATE CASCADE)', c.conname, c.tabla;
  END LOOP;
END $$;

-- 5.2 — Avisar si hay correos duplicados en profiles: harían fallar el realineo
DO $$
DECLARE dup TEXT;
BEGIN
  SELECT string_agg(email, ', ') INTO dup
  FROM (
    SELECT lower(btrim(email)) AS email
    FROM public.profiles
    WHERE email IS NOT NULL AND btrim(email) <> ''
    GROUP BY 1 HAVING count(*) > 1
  ) d;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'Hay perfiles con el mismo correo (%). Únelos o corrígelos antes de realinear.', dup;
  END IF;
END $$;

-- 5.3 — Alinear el id arrastrando las columnas que lo referencian
DO $$
DECLARE f RECORD;
BEGIN
  FOR f IN
    SELECT p.id AS viejo, u.id AS nuevo
    FROM public.profiles p
    JOIN auth.users u ON lower(u.email) = lower(btrim(p.email))
    WHERE p.id IS DISTINCT FROM u.id
      AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = u.id)
  LOOP
    -- Primero el perfil: la FK de procedimientos ya va en CASCADE
    UPDATE public.profiles SET id = f.nuevo WHERE id = f.viejo;

    -- Las demás columnas son UUID sueltos, sin FK: hay que moverlas a mano
    IF to_regclass('public.citas') IS NOT NULL THEN
      UPDATE public.citas SET medico_id = f.nuevo WHERE medico_id = f.viejo;
    END IF;
    -- actividad_usuarios.user_id guarda a veces el UUID y a veces el correo,
    -- así que su tipo puede ser texto o uuid: se resuelve en tiempo de ejecución.
    IF to_regclass('public.actividad_usuarios') IS NOT NULL THEN
      EXECUTE format(
        'UPDATE public.actividad_usuarios SET user_id = %L::%s WHERE user_id::text = %L',
        f.nuevo::text,
        (SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = 'actividad_usuarios'
            AND column_name = 'user_id'),
        f.viejo::text);
    END IF;
    IF to_regclass('public.vacunas_mascota') IS NOT NULL THEN
      UPDATE public.vacunas_mascota SET veterinario_id = f.nuevo WHERE veterinario_id = f.viejo;
    END IF;
    IF to_regclass('public.desparasitaciones') IS NOT NULL THEN
      UPDATE public.desparasitaciones SET veterinario_id = f.nuevo WHERE veterinario_id = f.viejo;
    END IF;
    IF to_regclass('public.hospitalizaciones') IS NOT NULL THEN
      UPDATE public.hospitalizaciones SET veterinario_id = f.nuevo WHERE veterinario_id = f.viejo;
    END IF;

    RAISE NOTICE 'Perfil realineado: % -> %', f.viejo, f.nuevo;
  END LOOP;
END $$;

COMMIT;


-- ============================================================
-- BLOQUE 6 — Desbloquear cuentas y limpiar contadores
-- ============================================================

BEGIN;

UPDATE public.profiles
SET bloqueado = FALSE, intentos_fallidos = 0
WHERE bloqueado IS TRUE OR COALESCE(intentos_fallidos, 0) > 0;

COMMIT;


-- ============================================================
-- BLOQUE 7 — Comprobación final
--
-- Todas las filas deberían decir 'OK'. Si alguna no, vuelve al bloque que
-- corresponde según lo que diga la columna "problema".
-- ============================================================

SELECT
  p.email,
  p.nombre,
  p.rol,
  CASE
    WHEN p.email IS NULL OR btrim(p.email) = '' THEN 'SIN CORREO'
    WHEN u.id IS NULL                           THEN 'SIN CUENTA EN AUTH'
    WHEN u.email_confirmed_at IS NULL           THEN 'CORREO SIN CONFIRMAR'
    WHEN p.id IS DISTINCT FROM u.id             THEN 'ID DESALINEADO'
    WHEN p.bloqueado IS TRUE                    THEN 'CUENTA BLOQUEADA'
    ELSE 'OK'
  END AS problema
FROM public.profiles p
LEFT JOIN auth.users u ON lower(u.email) = lower(btrim(p.email))
ORDER BY 4, p.email;
