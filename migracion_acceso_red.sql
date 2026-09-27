-- ============================================================
-- LUMEA MED - Uso solo desde la red de la clínica
--
-- Ejecutar una vez en: Supabase -> SQL Editor. Es idempotente.
--
-- Una clínica puede exigir que su personal trabaje solo desde el local. Se
-- reconoce la red por la IP pública con la que sale a internet: toda la red de
-- la clínica comparte la misma. El Super Admin registra esas IPs y marca qué
-- usuarios pueden trabajar también desde fuera.
--
-- La restricción se aplica en la base, no solo en la pantalla: si alguien entra
-- en la clínica y se lleva el teléfono a casa, deja de recibir datos aunque siga
-- con la sesión abierta.
--
-- Mientras una clínica no tenga ninguna IP registrada, nada cambia para ella.
-- ============================================================

-- ── 1. Configuración ─────────────────────────────────────────
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS ips_permitidas TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS acceso_remoto BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.clinicas.ips_permitidas IS
  'IPs públicas de la red de la clínica. Vacío = sin restricción de red.';
COMMENT ON COLUMN public.profiles.acceso_remoto IS
  'TRUE = puede usar el sistema también fuera de la red de la clínica. Solo lo cambia el Super Admin.';

-- ── 2. IP de quien hace la petición ──────────────────────────
-- PostgREST deja las cabeceras HTTP en request.headers. Se prefieren las que
-- pone la infraestructura (Cloudflare, el proxy) sobre x-forwarded-for, cuyo
-- primer valor lo puede escribir el propio navegador.
CREATE OR REPLACE FUNCTION public.ip_cliente()
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH h AS (
    SELECT nullif(current_setting('request.headers', true), '')::json AS j
  )
  SELECT nullif(btrim(split_part(coalesce(
           h.j ->> 'cf-connecting-ip',
           h.j ->> 'x-real-ip',
           h.j ->> 'x-forwarded-for'
         ), ',', 1)), '')
  FROM h;
$$;

-- ── 3. ¿Puede este usuario trabajar desde donde está? ────────
-- Deja pasar si: es Super Admin, su clínica no tiene IPs registradas, tiene
-- acceso remoto, está en una IP registrada, o la IP no se puede leer (en ese
-- caso la restricción no se aplica; el panel del Super Admin lo avisa, para no
-- dejar a una clínica entera sin sus expedientes por un fallo de configuración).
CREATE OR REPLACE FUNCTION public.acceso_red_permitido()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.is_superadmin() OR coalesce((
    SELECT p.acceso_remoto
        OR coalesce(cardinality(c.ips_permitidas), 0) = 0
        OR public.ip_cliente() IS NULL
        OR public.ip_cliente() = ANY (c.ips_permitidas)
    FROM public.profiles AS p
    LEFT JOIN public.clinicas AS c ON c.id = p.clinica_id
    WHERE p.id = auth.uid()
       OR (auth.uid() IS NOT NULL
           AND lower(p.email) = lower(nullif(auth.jwt() ->> 'email', '')))
    ORDER BY (p.id = auth.uid()) DESC NULLS LAST
    LIMIT 1
  ), TRUE);
$$;

-- ── 4. El punto donde se aplica ──────────────────────────────
-- Todas las políticas por clínica comparan contra get_my_clinica_id(). Si
-- devuelve NULL, ninguna fila de la clínica coincide: fuera de la red no se ve
-- ni se escribe nada. El propio perfil se sigue pudiendo leer (su política no
-- depende de esta función), que es lo que permite enseñar el aviso al entrar.
CREATE OR REPLACE FUNCTION public.get_my_clinica_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT CASE
           WHEN p.acceso_remoto
             OR coalesce(cardinality(c.ips_permitidas), 0) = 0
             OR public.ip_cliente() IS NULL
             OR public.ip_cliente() = ANY (c.ips_permitidas)
           THEN p.clinica_id
         END
  FROM public.profiles AS p
  LEFT JOIN public.clinicas AS c ON c.id = p.clinica_id
  WHERE p.id = auth.uid()
     OR (
       auth.uid() IS NOT NULL
       AND lower(p.email) = lower(nullif(auth.jwt() ->> 'email', ''))
     )
  ORDER BY (p.id = auth.uid()) DESC NULLS LAST
  LIMIT 1;
$$;

-- ── 5. Solo el Super Admin concede el acceso remoto ──────────
-- La política profiles_update deja a cada usuario editar su propia fila: sin
-- esto, cualquiera podría activarse el acceso remoto desde la consola.
-- Desde el SQL Editor (sin usuario en sesión) sí se permite.
CREATE OR REPLACE FUNCTION public.proteger_acceso_remoto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_superadmin() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.acceso_remoto := FALSE;
  ELSIF NEW.acceso_remoto IS DISTINCT FROM OLD.acceso_remoto THEN
    RAISE EXCEPTION 'Solo el Super Admin puede cambiar el acceso fuera de la clínica';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_proteger_acceso_remoto ON public.profiles;
CREATE TRIGGER profiles_proteger_acceso_remoto
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_acceso_remoto();

-- ── 6. Intentos desde fuera, para el Super Admin ─────────────
-- Cuando la IP de la clínica cambia (el proveedor la renueva al reiniciar el
-- router), el personal queda bloqueado. Aquí queda la IP desde la que lo
-- intentaron, para poder autorizarla con un clic.
CREATE TABLE IF NOT EXISTS public.accesos_bloqueados (
  id         BIGSERIAL PRIMARY KEY,
  clinica_id BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE,
  user_id    UUID,
  nombre     TEXT,
  email      TEXT,
  ip         TEXT,
  fecha      DATE NOT NULL DEFAULT CURRENT_DATE,
  creado_en  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, ip, fecha)
);
CREATE INDEX IF NOT EXISTS idx_accesos_bloqueados_clinica
  ON public.accesos_bloqueados(clinica_id, creado_en DESC);

-- Datos de acceso del personal: solo los ve el Super Admin. Se escriben
-- únicamente desde mi_acceso_red(), nunca directamente.
ALTER TABLE public.accesos_bloqueados ENABLE ROW LEVEL SECURITY;
-- Solo lectura desde la app, y RLS la limita al Super Admin. No se concede
-- escritura: los intentos los anota mi_acceso_red() con sus propios permisos.
GRANT SELECT ON public.accesos_bloqueados TO authenticated;
DROP POLICY IF EXISTS "accesos_bloqueados_superadmin" ON public.accesos_bloqueados;
CREATE POLICY "accesos_bloqueados_superadmin" ON public.accesos_bloqueados
  FOR ALL USING (public.is_superadmin()) WITH CHECK (public.is_superadmin());

-- ── 7. Lo que la app pregunta al entrar ──────────────────────
CREATE OR REPLACE FUNCTION public.mi_acceso_red()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_ip TEXT := public.ip_cliente();
  v_ok BOOLEAN := public.acceso_red_permitido();
  v_id UUID; v_nombre TEXT; v_email TEXT; v_clinica BIGINT;
  v_remoto BOOLEAN := FALSE; v_restringida BOOLEAN := FALSE;
BEGIN
  SELECT pr.id, pr.nombre, pr.email, pr.clinica_id, pr.acceso_remoto,
         coalesce(cardinality(c.ips_permitidas), 0) > 0
    INTO v_id, v_nombre, v_email, v_clinica, v_remoto, v_restringida
  FROM public.profiles AS pr
  LEFT JOIN public.clinicas AS c ON c.id = pr.clinica_id
  WHERE pr.id = auth.uid()
     OR (auth.uid() IS NOT NULL
         AND lower(pr.email) = lower(nullif(auth.jwt() ->> 'email', '')))
  ORDER BY (pr.id = auth.uid()) DESC NULLS LAST
  LIMIT 1;

  IF NOT v_ok AND v_id IS NOT NULL THEN
    INSERT INTO public.accesos_bloqueados (clinica_id, user_id, nombre, email, ip)
    VALUES (v_clinica, v_id, v_nombre, v_email, v_ip)
    ON CONFLICT (user_id, ip, fecha) DO NOTHING;
  END IF;

  RETURN json_build_object(
    'ip', v_ip,
    'permitido', v_ok,
    'restringida', coalesce(v_restringida, FALSE),
    'remoto', coalesce(v_remoto, FALSE)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.mi_acceso_red() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mi_acceso_red() TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Comprobación: dos columnas nuevas y la tabla de intentos.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'clinicas' AND column_name = 'ips_permitidas')
    OR (table_name = 'profiles' AND column_name = 'acceso_remoto')
    OR (table_name = 'accesos_bloqueados' AND column_name = 'ip'))
ORDER BY table_name;
