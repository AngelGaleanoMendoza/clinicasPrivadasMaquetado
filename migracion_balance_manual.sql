-- ============================================================
-- LUMEA MED - Ganancia de la clínica escrita a mano
--
-- Ejecutar una vez en: Supabase -> SQL Editor
-- Requiere haber ejecutado antes migracion_balance_reparto.sql
--
-- El reparto por porcentaje no le sirve a todas las clínicas. En muchas, lo que
-- queda a la clínica se acuerda servicio por servicio y no sale de una regla:
-- quien cobra escribe el total y, al lado, cuánto de eso es de la clínica.
--
-- Cada clínica elige su modo. El importe escrito manda sobre el porcentaje, así
-- que una clínica puede cambiar de modo sin que se recalcule lo ya cobrado.
-- ============================================================

-- Lo que queda a la clínica en esa línea, en córdobas. NULL = se calcula con el
-- porcentaje de su tipo, como hasta ahora.
ALTER TABLE public.factura_items
  ADD COLUMN IF NOT EXISTS monto_clinica NUMERIC(12,2);

-- 'porcentaje' (por defecto, el comportamiento actual) o 'manual'.
ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS balance_modo TEXT NOT NULL DEFAULT 'porcentaje';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinicas_balance_modo_check' AND conrelid = 'public.clinicas'::regclass
  ) THEN
    ALTER TABLE public.clinicas
      ADD CONSTRAINT clinicas_balance_modo_check
      CHECK (balance_modo IN ('porcentaje','manual'));
  END IF;
END $$;

COMMENT ON COLUMN public.factura_items.monto_clinica IS
  'Lo que queda a la clínica en esta línea, escrito a mano. Manda sobre porcentaje_clinica; NULL usa el porcentaje.';
COMMENT ON COLUMN public.clinicas.balance_modo IS
  'porcentaje = la parte de la clínica sale del % de cada tipo; manual = se escribe al facturar.';

-- Comprobación: debe devolver las dos columnas.
SELECT table_name, column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'factura_items' AND column_name = 'monto_clinica')
    OR (table_name = 'clinicas' AND column_name = 'balance_modo'))
ORDER BY table_name;
