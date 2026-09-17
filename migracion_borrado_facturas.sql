-- ============================================================
-- Borrado integral de facturas y consecutivo no reutilizable
-- Ejecutar en Supabase > SQL Editor.
-- Es idempotente: puede ejecutarse más de una vez.
-- ============================================================

ALTER TABLE public.finanzas
  ADD COLUMN IF NOT EXISTS factura_id BIGINT REFERENCES public.facturas(id) ON DELETE CASCADE;

ALTER TABLE public.inventario_movimientos
  ADD COLUMN IF NOT EXISTS factura_id BIGINT REFERENCES public.facturas(id) ON DELETE CASCADE;

ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS factura_periodo TEXT,
  ADD COLUMN IF NOT EXISTS factura_ultimo_numero INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_finanzas_factura_id
  ON public.finanzas(factura_id) WHERE factura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_inv_mov_factura_id
  ON public.inventario_movimientos(factura_id) WHERE factura_id IS NOT NULL;

-- Enlaza registros históricos cuando el número identifica una sola factura.
UPDATE public.finanzas AS fin
SET factura_id = f.id
FROM public.facturas AS f
WHERE fin.factura_id IS NULL
  AND fin.clinica_id = f.clinica_id
  AND fin.categoria = 'factura'
  AND fin.referencia = f.numero
  AND 1 = (SELECT count(*) FROM public.facturas x
           WHERE x.clinica_id = f.clinica_id AND x.numero = f.numero);

UPDATE public.inventario_movimientos AS mov
SET factura_id = f.id
FROM public.facturas AS f
WHERE mov.factura_id IS NULL
  AND mov.clinica_id = f.clinica_id
  AND mov.motivo = 'factura:' || f.numero
  AND 1 = (SELECT count(*) FROM public.facturas x
           WHERE x.clinica_id = f.clinica_id AND x.numero = f.numero);

-- Reserva el próximo folio dentro de una transacción. El contador vive en la
-- clínica, por lo que borrar la factura de mayor número nunca reutiliza el folio.
CREATE OR REPLACE FUNCTION public.reservar_numero_factura(p_clinica_id BIGINT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_periodo TEXT := to_char(timezone('America/Guatemala', now()), 'YYYYMM');
  v_periodo_actual TEXT;
  v_ultimo INTEGER;
  v_max_existente INTEGER := 0;
BEGIN
  IF NOT (public.is_superadmin() OR p_clinica_id = public.get_my_clinica_id()) THEN
    RAISE EXCEPTION 'No tienes acceso a esta clínica';
  END IF;

  SELECT factura_periodo, factura_ultimo_numero
    INTO v_periodo_actual, v_ultimo
  FROM public.clinicas
  WHERE id = p_clinica_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Clínica no encontrada'; END IF;

  SELECT COALESCE(max((m)[1]::INTEGER), 0)
    INTO v_max_existente
  FROM (
    SELECT regexp_match(numero, '^FACT-' || v_periodo || '-([0-9]+)$') AS m
    FROM public.facturas
    WHERE clinica_id = p_clinica_id
  ) AS existentes
  WHERE m IS NOT NULL;

  IF v_periodo_actual IS DISTINCT FROM v_periodo THEN
    v_ultimo := v_max_existente + 1;
  ELSE
    v_ultimo := greatest(COALESCE(v_ultimo, 0), v_max_existente) + 1;
  END IF;

  UPDATE public.clinicas
  SET factura_periodo = v_periodo, factura_ultimo_numero = v_ultimo
  WHERE id = p_clinica_id;

  RETURN 'FACT-' || v_periodo || '-' || lpad(v_ultimo::TEXT, 4, '0');
END;
$$;

-- Borra en una sola transacción todo lo generado por la factura y repone el
-- inventario que se descontó al cobrar. También reconoce registros históricos.
CREATE OR REPLACE FUNCTION public.eliminar_factura_completa(p_factura_id BIGINT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_clinica_id BIGINT;
  v_numero TEXT;
  r RECORD;
BEGIN
  SELECT clinica_id, numero INTO v_clinica_id, v_numero
  FROM public.facturas
  WHERE id = p_factura_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Factura no encontrada'; END IF;
  IF NOT (public.is_superadmin() OR v_clinica_id = public.get_my_clinica_id()) THEN
    RAISE EXCEPTION 'No tienes acceso a esta factura';
  END IF;

  FOR r IN
    SELECT inventario_id, sum(cantidad) AS cantidad
    FROM public.inventario_movimientos
    WHERE clinica_id = v_clinica_id
      AND tipo = 'salida'
      AND (factura_id = p_factura_id OR
           (factura_id IS NULL AND motivo = 'factura:' || COALESCE(v_numero, p_factura_id::TEXT)))
    GROUP BY inventario_id
  LOOP
    UPDATE public.inventario
    SET stock_actual = COALESCE(stock_actual, 0) + r.cantidad
    WHERE id = r.inventario_id AND clinica_id = v_clinica_id;
  END LOOP;

  DELETE FROM public.inventario_movimientos
  WHERE clinica_id = v_clinica_id
    AND (factura_id = p_factura_id OR
         (factura_id IS NULL AND motivo = 'factura:' || COALESCE(v_numero, p_factura_id::TEXT)));

  DELETE FROM public.finanzas
  WHERE clinica_id = v_clinica_id
    AND (factura_id = p_factura_id OR
         (factura_id IS NULL AND categoria = 'factura' AND referencia = v_numero));

  DELETE FROM public.factura_items WHERE factura_id = p_factura_id;
  DELETE FROM public.facturas WHERE id = p_factura_id AND clinica_id = v_clinica_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reservar_numero_factura(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.eliminar_factura_completa(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reservar_numero_factura(BIGINT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.eliminar_factura_completa(BIGINT) TO authenticated;

NOTIFY pgrst, 'reload schema';
