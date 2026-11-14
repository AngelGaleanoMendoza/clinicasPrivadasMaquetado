-- ============================================================
-- Compras a proveedores: contado o crédito, con o sin IVA, pagos y costo
-- de los productos.
--
-- - proveedores: a quién se le compra.
-- - compras: cabecera de cada compra. Subtotal (sin IVA), IVA y total;
--   condición contado o crédito y, si es crédito, fecha de vencimiento.
-- - compra_items: productos de la compra con cantidad y costo unitario SIN
--   IVA (lo que le cuesta el producto a la empresa).
-- - compra_pagos: cada pago al proveedor. Una compra de contado nace con un
--   pago por el total; una a crédito se va pagando, también por partes. Lo
--   que falta pagar es el total menos la suma de sus pagos.
-- - inventario.costo_unitario: costo promedio ponderado de cada producto.
-- - factura_items.costo_unitario: el costo del producto al venderlo, para
--   que la ganancia de una venta pasada no cambie con compras nuevas.
--
-- Se puede ejecutar más de una vez sin daño (también si ya se ejecutó una
-- versión anterior de este archivo). Todas las tablas llevan RLS: cada
-- clínica o empresa ve solo lo suyo.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.proveedores (
  id              BIGSERIAL PRIMARY KEY,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  identificacion  TEXT,            -- RUC o cédula
  contacto        TEXT,
  telefono        TEXT,
  email           TEXT,
  direccion       TEXT,
  notas           TEXT,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_proveedores_clinica ON public.proveedores(clinica_id, nombre);

CREATE TABLE IF NOT EXISTS public.compras (
  id              BIGSERIAL PRIMARY KEY,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  proveedor_id    BIGINT REFERENCES public.proveedores(id) ON DELETE SET NULL,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  numero_factura  TEXT,            -- número de la factura del proveedor
  metodo_pago     TEXT NOT NULL DEFAULT 'efectivo',
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'registrada',
  notas           TEXT,
  finanzas_id     BIGINT,
  creado_por      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS subtotal    NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS iva         NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS iva_pct     NUMERIC(5,2)  NOT NULL DEFAULT 0;
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS condicion   TEXT NOT NULL DEFAULT 'contado';
ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS vencimiento DATE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_estado_check') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_estado_check CHECK (estado IN ('registrada','anulada'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_condicion_check') THEN
    ALTER TABLE public.compras ADD CONSTRAINT compras_condicion_check CHECK (condicion IN ('contado','credito'));
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_compras_clinica_fecha ON public.compras(clinica_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_compras_proveedor ON public.compras(proveedor_id);

CREATE TABLE IF NOT EXISTS public.compra_items (
  id              BIGSERIAL PRIMARY KEY,
  compra_id       BIGINT NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  inventario_id   BIGINT REFERENCES public.inventario(id) ON DELETE SET NULL,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
  costo_unitario  NUMERIC(14,4) NOT NULL CHECK (costo_unitario >= 0),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_compra_items_compra ON public.compra_items(compra_id);
CREATE INDEX IF NOT EXISTS idx_compra_items_inventario ON public.compra_items(inventario_id);

CREATE TABLE IF NOT EXISTS public.compra_pagos (
  id              BIGSERIAL PRIMARY KEY,
  compra_id       BIGINT NOT NULL REFERENCES public.compras(id) ON DELETE CASCADE,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  metodo_pago     TEXT NOT NULL DEFAULT 'efectivo',
  referencia      TEXT,
  finanzas_id     BIGINT,          -- el gasto que este pago anotó en Finanzas
  creado_por      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compra_pagos_compra ON public.compra_pagos(compra_id);

ALTER TABLE public.inventario    ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14,4);
ALTER TABLE public.factura_items ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14,4);

-- RLS: cada clínica o empresa solo ve y escribe lo suyo.
ALTER TABLE public.proveedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_pagos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proveedores_clinica" ON public.proveedores;
CREATE POLICY "proveedores_clinica" ON public.proveedores
  FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "compras_clinica" ON public.compras;
CREATE POLICY "compras_clinica" ON public.compras
  FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "compra_items_clinica" ON public.compra_items;
CREATE POLICY "compra_items_clinica" ON public.compra_items
  FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "compra_pagos_clinica" ON public.compra_pagos;
CREATE POLICY "compra_pagos_clinica" ON public.compra_pagos
  FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores, public.compras, public.compra_items, public.compra_pagos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.proveedores_id_seq, public.compras_id_seq, public.compra_items_id_seq, public.compra_pagos_id_seq TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Comprobación: cuatro tablas con RLS activo y las columnas nuevas.
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('proveedores','compras','compra_items','compra_pagos')
ORDER BY 1;
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name IN ('inventario','factura_items') AND column_name = 'costo_unitario')
    OR (table_name = 'compras' AND column_name IN ('subtotal','iva','iva_pct','condicion','vencimiento')))
ORDER BY 1, 2;
