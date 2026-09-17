-- ============================================================
-- Tipo de documento impreso para facturas, por clínica
-- Ejecutar en Supabase > SQL Editor. Es idempotente.
-- ============================================================

ALTER TABLE public.clinicas
  ADD COLUMN IF NOT EXISTS tipo_documento_factura TEXT NOT NULL DEFAULT 'factura';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'clinicas_tipo_documento_factura_check'
      AND conrelid = 'public.clinicas'::regclass
  ) THEN
    ALTER TABLE public.clinicas
      ADD CONSTRAINT clinicas_tipo_documento_factura_check
      CHECK (tipo_documento_factura IN ('factura','comprobante_pago'));
  END IF;
END $$;

COMMENT ON COLUMN public.clinicas.tipo_documento_factura IS
  'Título elegido por la clínica para el documento impreso desde Facturas; no cambia el consecutivo.';
