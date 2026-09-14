-- ============================================================
-- LUMEA MED - Balance de reparto por servicio
--
-- Ejecutar una vez en: Supabase -> SQL Editor
-- ============================================================

-- Clínicas que alquilan sus módulos: de cada servicio cobrado, un porcentaje
-- queda a la clínica y el resto al profesional. Se configura por tipo de
-- servicio (consulta, procedimiento, examen, servicio, producto). Un tipo sin
-- fila no tiene porcentaje y el balance lo señala en lugar de suponer uno.
CREATE TABLE IF NOT EXISTS public.reparto_servicios (
  id BIGSERIAL PRIMARY KEY,
  clinica_id BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL,
  porcentaje_clinica NUMERIC(5,2) NOT NULL
    CHECK (porcentaje_clinica >= 0 AND porcentaje_clinica <= 100),
  actualizado_por TEXT,
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (clinica_id, tipo)
);

-- Cada línea de factura guarda el porcentaje vigente cuando se emitió o se
-- cobró: cambiar la configuración después no altera balances ya cerrados.
ALTER TABLE public.factura_items ADD COLUMN IF NOT EXISTS porcentaje_clinica NUMERIC(5,2);

-- Tipo "examen" en las líneas de factura. Si la tabla tiene una restricción
-- sobre tipo que no lo admite, se reemplaza por una que sí; si no tiene
-- ninguna, no se crea.
DO $$
DECLARE
  r RECORD;
  reemplazada BOOLEAN := FALSE;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.factura_items'::regclass AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%tipo%'
      AND pg_get_constraintdef(oid) NOT ILIKE '%examen%'
  LOOP
    EXECUTE format('ALTER TABLE public.factura_items DROP CONSTRAINT %I', r.conname);
    reemplazada := TRUE;
  END LOOP;
  IF reemplazada THEN
    ALTER TABLE public.factura_items ADD CONSTRAINT factura_items_tipo_check
      CHECK (tipo IN ('consulta','servicio','producto','procedimiento','examen')) NOT VALID;
  END IF;
END $$;

-- Datos financieros: cada clínica solo ve y edita su propio reparto.
ALTER TABLE public.reparto_servicios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reparto_servicios_clinica" ON public.reparto_servicios;
CREATE POLICY "reparto_servicios_clinica" ON public.reparto_servicios
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());
