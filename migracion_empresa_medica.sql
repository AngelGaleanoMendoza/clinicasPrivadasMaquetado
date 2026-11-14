-- ============================================================
-- Empresa médica (distribuidora): tipo de establecimiento
-- 'empresa_medica' y rol 'admin_empresa'.
--
-- Se puede ejecutar más de una vez sin daño. No crea tablas: el tipo y el rol
-- son valores nuevos de columnas que ya existen (clinicas.tipo, profiles.rol).
-- ============================================================

-- 1. Si la base tiene una restricción CHECK que fija la lista de roles o de
--    tipos de clínica y no incluye los nuevos, se quita: con ella no se
--    podría crear la empresa ni su administrador. La aplicación valida igual
--    qué rol va con qué tipo de clínica.
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '\mrol\M' AND pg_get_constraintdef(oid) ILIKE '%medico%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%admin_empresa%'
  LOOP
    EXECUTE format('ALTER TABLE public.profiles DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Quitada la restricción % de profiles (no admitía admin_empresa): %', r.conname, r.def;
  END LOOP;

  FOR r IN
    SELECT conname, pg_get_constraintdef(oid) AS def
    FROM pg_constraint
    WHERE conrelid = 'public.clinicas'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ~* '\mtipo\M' AND pg_get_constraintdef(oid) ILIKE '%farmacia%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%empresa_medica%'
  LOOP
    EXECUTE format('ALTER TABLE public.clinicas DROP CONSTRAINT %I', r.conname);
    RAISE NOTICE 'Quitada la restricción % de clinicas (no admitía empresa_medica): %', r.conname, r.def;
  END LOOP;
END $$;

-- 2. El administrador de la empresa también configura el modo de su balance,
--    igual que el médico administrativo en una clínica.
CREATE OR REPLACE FUNCTION public.cambiar_modo_balance_clinica(
  p_clinica_id BIGINT,
  p_modo TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_autorizado BOOLEAN;
BEGIN
  IF p_modo NOT IN ('porcentaje','manual') THEN
    RAISE EXCEPTION 'Modo de balance inválido';
  END IF;

  SELECT public.is_superadmin() OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE (p.id = auth.uid() OR lower(p.email) = lower(nullif(auth.jwt() ->> 'email', '')))
      AND p.clinica_id = p_clinica_id
      AND p.rol IN ('medico_admin', 'admin_empresa')
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RAISE EXCEPTION 'Solo el médico administrativo o el administrador de la empresa puede configurar el balance';
  END IF;

  UPDATE public.clinicas SET balance_modo = p_modo WHERE id = p_clinica_id;
END;
$$;

REVOKE ALL ON FUNCTION public.cambiar_modo_balance_clinica(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cambiar_modo_balance_clinica(BIGINT, TEXT) TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Comprobación: la función debe admitir admin_empresa.
SELECT proname, pg_get_functiondef(oid) ILIKE '%admin_empresa%' AS admite_admin_empresa
FROM pg_proc WHERE proname = 'cambiar_modo_balance_clinica';
