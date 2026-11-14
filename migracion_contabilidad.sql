-- ============================================================
-- Contabilidad de la empresa médica: clientes, ventas de contado y al
-- crédito, cobros (cuentas por cobrar) y lotes de inventario.
--
-- Necesita migracion_compras_proveedores.sql (proveedores y compras).
--
-- - clientes_comerciales: a quién le vende la empresa (clínicas,
--   farmacias...). dias_credito es el plazo habitual que se le da.
-- - ventas: cabecera de cada venta. Subtotal sin IVA, IVA con el porcentaje
--   que se escriba en cada venta, total; contado o crédito con vencimiento.
-- - venta_items: cada línea vendida con su precio y su COSTO en el momento
--   de vender (el del lote). Así la ganancia de una venta no cambia después.
-- - venta_cobros: cada cobro al cliente. De contado nace con un cobro por el
--   total; a crédito se cobra después, también por partes.
-- - inventario_lotes: cada compra de la empresa crea un lote por producto,
--   con su proveedor, su costo y cuánto queda. Las ventas y salidas toman
--   primero de los lotes más antiguos.
--
-- Se puede ejecutar más de una vez sin daño. Todas las tablas llevan RLS.
-- ============================================================

-- 1. Clientes comerciales
CREATE TABLE IF NOT EXISTS public.clientes_comerciales (
  id              BIGSERIAL PRIMARY KEY,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  identificacion  TEXT,            -- RUC o cédula
  contacto        TEXT,
  telefono        TEXT,
  email           TEXT,
  direccion       TEXT,
  dias_credito    INTEGER NOT NULL DEFAULT 30 CHECK (dias_credito >= 0),
  notas           TEXT,
  activo          BOOLEAN NOT NULL DEFAULT TRUE,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_clientes_comerciales_clinica ON public.clientes_comerciales(clinica_id, nombre);

-- 2. Lotes de inventario
CREATE TABLE IF NOT EXISTS public.inventario_lotes (
  id                   BIGSERIAL PRIMARY KEY,
  clinica_id           BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  inventario_id        BIGINT NOT NULL REFERENCES public.inventario(id) ON DELETE CASCADE,
  proveedor_id         BIGINT REFERENCES public.proveedores(id) ON DELETE SET NULL,
  compra_id            BIGINT REFERENCES public.compras(id) ON DELETE SET NULL,
  lote                 TEXT NOT NULL,
  fecha_ingreso        DATE NOT NULL DEFAULT CURRENT_DATE,
  cantidad_inicial     NUMERIC(14,3) NOT NULL CHECK (cantidad_inicial > 0),
  cantidad_disponible  NUMERIC(14,3) NOT NULL CHECK (cantidad_disponible >= 0),
  costo_unitario       NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  creado_en            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_inventario_lotes_producto ON public.inventario_lotes(inventario_id, fecha_ingreso, id);
CREATE INDEX IF NOT EXISTS idx_inventario_lotes_clinica ON public.inventario_lotes(clinica_id);
ALTER TABLE public.compra_items ADD COLUMN IF NOT EXISTS lote    TEXT;
ALTER TABLE public.compra_items ADD COLUMN IF NOT EXISTS lote_id BIGINT;

-- 3. Ventas
CREATE TABLE IF NOT EXISTS public.ventas (
  id              BIGSERIAL PRIMARY KEY,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  cliente_id      BIGINT REFERENCES public.clientes_comerciales(id) ON DELETE SET NULL,
  numero          TEXT NOT NULL,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_pct         NUMERIC(5,2)  NOT NULL DEFAULT 0 CHECK (iva_pct >= 0 AND iva_pct <= 100),
  iva             NUMERIC(14,2) NOT NULL DEFAULT 0,
  total           NUMERIC(14,2) NOT NULL DEFAULT 0,
  condicion       TEXT NOT NULL DEFAULT 'contado' CHECK (condicion IN ('contado','credito')),
  vencimiento     DATE,
  estado          TEXT NOT NULL DEFAULT 'registrada' CHECK (estado IN ('registrada','anulada')),
  notas           TEXT,
  creado_por      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_ventas_numero ON public.ventas(clinica_id, numero);
CREATE INDEX IF NOT EXISTS idx_ventas_clinica_fecha ON public.ventas(clinica_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON public.ventas(cliente_id);

CREATE TABLE IF NOT EXISTS public.venta_items (
  id              BIGSERIAL PRIMARY KEY,
  venta_id        BIGINT NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  inventario_id   BIGINT REFERENCES public.inventario(id) ON DELETE SET NULL,
  lote_id         BIGINT REFERENCES public.inventario_lotes(id) ON DELETE SET NULL,
  lote            TEXT,
  descripcion     TEXT NOT NULL,
  cantidad        NUMERIC(14,3) NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,4) NOT NULL CHECK (precio_unitario >= 0),
  costo_unitario  NUMERIC(14,4) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  subtotal        NUMERIC(14,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_venta_items_venta ON public.venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_venta_items_inventario ON public.venta_items(inventario_id);

CREATE TABLE IF NOT EXISTS public.venta_cobros (
  id              BIGSERIAL PRIMARY KEY,
  venta_id        BIGINT NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  clinica_id      BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  fecha           DATE NOT NULL DEFAULT CURRENT_DATE,
  monto           NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  metodo_pago     TEXT NOT NULL DEFAULT 'efectivo',
  referencia      TEXT,
  finanzas_id     BIGINT,          -- el ingreso que este cobro anotó en Finanzas
  creado_por      TEXT,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_venta_cobros_venta ON public.venta_cobros(venta_id);

-- 4. Seguridad (RLS): cada empresa ve solo lo suyo
ALTER TABLE public.clientes_comerciales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventario_lotes     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_items          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venta_cobros         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clientes_comerciales_clinica" ON public.clientes_comerciales;
CREATE POLICY "clientes_comerciales_clinica" ON public.clientes_comerciales FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "inventario_lotes_clinica" ON public.inventario_lotes;
CREATE POLICY "inventario_lotes_clinica" ON public.inventario_lotes FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "ventas_clinica" ON public.ventas;
CREATE POLICY "ventas_clinica" ON public.ventas FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "venta_items_clinica" ON public.venta_items;
CREATE POLICY "venta_items_clinica" ON public.venta_items FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

DROP POLICY IF EXISTS "venta_cobros_clinica" ON public.venta_cobros;
CREATE POLICY "venta_cobros_clinica" ON public.venta_cobros FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes_comerciales, public.inventario_lotes, public.ventas, public.venta_items, public.venta_cobros TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.clientes_comerciales_id_seq, public.inventario_lotes_id_seq, public.ventas_id_seq, public.venta_items_id_seq, public.venta_cobros_id_seq TO authenticated;
NOTIFY pgrst, 'reload schema';

-- Comprobación: cinco tablas con RLS activo.
SELECT c.relname AS tabla, c.relrowsecurity AS rls_activo
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('clientes_comerciales','inventario_lotes','ventas','venta_items','venta_cobros')
ORDER BY 1;
