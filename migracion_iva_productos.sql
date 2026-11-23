-- Requiere las migraciones de Compras y Contabilidad.
-- En documentos anteriores, ambos campos quedan nulos porque solo se guardaba
-- el IVA del documento. Una línea nueva exenta guarda 0 en ambos campos.
BEGIN;

ALTER TABLE public.compra_items
  ADD COLUMN IF NOT EXISTS iva_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS iva numeric(14,2);

ALTER TABLE public.venta_items
  ADD COLUMN IF NOT EXISTS iva_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS iva numeric(14,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_constraint
    WHERE conrelid = 'public.compra_items'::regclass AND conname = 'compra_items_iva_check') THEN
    ALTER TABLE public.compra_items ADD CONSTRAINT compra_items_iva_check CHECK (
      (iva_pct IS NULL AND iva IS NULL) OR (
        iva_pct IS NOT NULL AND iva IS NOT NULL AND iva_pct BETWEEN 0 AND 100
        AND iva >= 0 AND iva <> 'NaN'::numeric AND (iva_pct > 0 OR iva = 0)
      )
    );
  END IF;

  IF NOT EXISTS (SELECT FROM pg_constraint
    WHERE conrelid = 'public.venta_items'::regclass AND conname = 'venta_items_iva_check') THEN
    ALTER TABLE public.venta_items ADD CONSTRAINT venta_items_iva_check CHECK (
      (iva_pct IS NULL AND iva IS NULL) OR (
        iva_pct IS NOT NULL AND iva IS NOT NULL AND iva_pct BETWEEN 0 AND 100
        AND iva >= 0 AND iva <> 'NaN'::numeric AND (iva_pct > 0 OR iva = 0)
      )
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT count(*) = 4 AS iva_por_producto_listo
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name IN ('compra_items', 'venta_items')
  AND column_name IN ('iva_pct', 'iva');
