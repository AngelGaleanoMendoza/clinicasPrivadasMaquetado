-- ============================================================
-- Compras a proveedores y costo de los productos
--
-- - proveedores: a quién se le compra.
-- - compras y compra_items: cada compra con sus productos, cantidad y
--   costo unitario (lo que se le pagó al proveedor).
-- - inventario.costo_unitario: costo promedio del producto. Cada compra lo
--   recalcula ponderando lo que ya había con lo que entra.
-- - factura_items.costo_unitario: el costo del producto en el momento de
--   venderlo. Se guarda en la línea para que la ganancia de una venta pasada
--   no cambie cuando el proveedor sube el precio.
--
-- Se puede ejecutar más de una vez sin daño. Todas las tablas nuevas llevan
-- su política RLS: cada clínica o empresa ve solo lo suyo.
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
  estado          TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada','anulada')),
  notas           TEXT,
  finanzas_id     BIGINT,          -- el gasto que la compra anotó en Finanzas
  creado_por      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
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

ALTER TABLE public.inventario    ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14,4);
ALTER TABLE public.factura_items ADD COLUMN IF NOT EXISTS costo_unitario NUMERIC(14,4);

-- RLS: cada clínica o empresa solo ve y escribe lo suyo.
ALTER TABLE public.proveedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compras      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compra_items ENABLE ROW LEVEL SECURITY;

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

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proveedores, public.compras, public.compra_items TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.proveedores_id_seq, public.compras_id_seq, public.compra_items_id_seq TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Comprobación: tres tablas con RLS activo y las dos columnas de costo.
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('proveedores','compras','compra_items')
ORDER BY 1;
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'costo_unitario'
  AND table_name IN ('inventario','factura_items');
