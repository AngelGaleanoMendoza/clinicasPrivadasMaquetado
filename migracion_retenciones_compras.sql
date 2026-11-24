-- Requiere migracion_compras_proveedores.sql.
-- NULL significa que esa tasa no se aplicó a la factura.
BEGIN;

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS retencion_ir_2 numeric(14,2),
  ADD COLUMN IF NOT EXISTS retencion_ir_1 numeric(14,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT FROM pg_constraint
    WHERE conrelid = 'public.compras'::regclass AND conname = 'compras_retenciones_ir_check'
  ) THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_retenciones_ir_check CHECK (
      (retencion_ir_2 IS NULL AND retencion_ir_1 IS NULL) OR (
        subtotal BETWEEN 0 AND 999999999999.99
        AND total BETWEEN 0 AND 999999999999.99
        AND (retencion_ir_2 IS NULL OR retencion_ir_2 = round(subtotal * 0.02, 2))
        AND (retencion_ir_1 IS NULL OR retencion_ir_1 = round(subtotal * 0.01, 2))
        AND coalesce(retencion_ir_2, 0) + coalesce(retencion_ir_1, 0) <= total
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT count(*) = 2 AS retenciones_compras_listas
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'compras'
  AND column_name IN ('retencion_ir_2', 'retencion_ir_1');
