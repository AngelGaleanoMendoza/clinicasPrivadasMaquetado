-- Requiere las tablas de Finanzas e Inventario y migracion_compras_proveedores.sql
-- (costo_unitario). Para clientes y saldos pendientes de clientes, también
-- migracion_contabilidad.sql. Ejecutar en el SQL Editor de Supabase.
-- Se puede ejecutar más de una vez sin daño.
BEGIN;

CREATE TABLE IF NOT EXISTS public.importaciones_excel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id bigint NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  creado_en timestamptz NOT NULL DEFAULT now(),
  modulos text[] NOT NULL,
  resumen jsonb NOT NULL,
  UNIQUE (clinica_id, id)
);

CREATE TABLE IF NOT EXISTS public.importaciones_excel_filas (
  clinica_id bigint NOT NULL,
  lote_id uuid NOT NULL,
  ordinal integer NOT NULL,
  tipo text NOT NULL,
  clave text NOT NULL,
  archivo text NOT NULL,
  hoja text NOT NULL,
  fila integer NOT NULL,
  datos jsonb NOT NULL,
  registro_id bigint NOT NULL,
  movimiento_inicial_id bigint,
  PRIMARY KEY (clinica_id, tipo, clave),
  UNIQUE (clinica_id, lote_id, ordinal),
  FOREIGN KEY (clinica_id, lote_id) REFERENCES public.importaciones_excel(clinica_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS importaciones_excel_historial
  ON public.importaciones_excel (clinica_id, creado_en DESC);

-- Destinos de la carga: catálogos, movimientos y saldos pendientes al migrar.
ALTER TABLE public.importaciones_excel_filas DROP CONSTRAINT IF EXISTS importaciones_excel_filas_tipo_check;
ALTER TABLE public.importaciones_excel_filas ADD CONSTRAINT importaciones_excel_filas_tipo_check
  CHECK (tipo IN ('finanzas','productos','movimientos','proveedores','clientes','cxc','cxp'));

-- Saldos iniciales: lo que los clientes debían y lo que se debía a proveedores
-- al migrar. Se guardan como venta o compra al crédito marcada, para cobrarlas
-- y pagarlas igual que las demás; Contabilidad no las cuenta como venta del período.
DO $$
BEGIN
  IF to_regclass('public.ventas') IS NOT NULL THEN
    ALTER TABLE public.ventas ADD COLUMN IF NOT EXISTS saldo_inicial boolean NOT NULL DEFAULT false;
  END IF;
  IF to_regclass('public.compras') IS NOT NULL THEN
    ALTER TABLE public.compras ADD COLUMN IF NOT EXISTS saldo_inicial boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.modulos_importacion_excel(p_clinica bigint)
RETURNS text[] LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_permisos jsonb;
  v_rol text;
BEGIN
  IF auth.uid() IS NULL OR p_clinica IS NULL THEN
    RETURN ARRAY[]::text[];
  END IF;
  IF public.is_superadmin() THEN
    RETURN ARRAY['finanzas','inventario','contabilidad'];
  END IF;
  IF p_clinica IS DISTINCT FROM public.get_my_clinica_id() THEN
    RETURN ARRAY[]::text[];
  END IF;

  SELECT to_jsonb(p)->'permisos', p.rol INTO v_permisos, v_rol
  FROM public.profiles p
  WHERE p.clinica_id = p_clinica AND
    (p.id = auth.uid() OR lower(p.email) = lower(nullif(auth.jwt()->>'email', '')))
  ORDER BY (p.id = auth.uid()) DESC NULLS LAST
  LIMIT 1;

  IF jsonb_typeof(v_permisos) = 'array' THEN
    RETURN ARRAY(SELECT value FROM jsonb_array_elements_text(v_permisos)
      WHERE value IN ('finanzas','inventario','contabilidad'));
  END IF;
  IF v_rol = 'admin_empresa' THEN
    RETURN ARRAY['finanzas','inventario','contabilidad'];
  END IF;
  IF v_rol = 'farmaceutico' THEN
    RETURN ARRAY['finanzas','inventario'];
  END IF;
  RETURN ARRAY[]::text[];
END;
$$;

ALTER TABLE public.importaciones_excel ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importaciones_excel_filas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS importaciones_excel_leer ON public.importaciones_excel;
CREATE POLICY importaciones_excel_leer ON public.importaciones_excel FOR SELECT TO authenticated
  USING (cardinality(modulos) > 0 AND modulos <@ public.modulos_importacion_excel(clinica_id));
DROP POLICY IF EXISTS importaciones_excel_filas_leer ON public.importaciones_excel_filas;
CREATE POLICY importaciones_excel_filas_leer ON public.importaciones_excel_filas FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.importaciones_excel l
    WHERE l.clinica_id = importaciones_excel_filas.clinica_id AND l.id = importaciones_excel_filas.lote_id));
REVOKE ALL ON public.importaciones_excel, public.importaciones_excel_filas FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.importaciones_excel, public.importaciones_excel_filas TO authenticated;

-- Los textos del origen se usan en las vistas existentes y sus impresos.
CREATE OR REPLACE FUNCTION public._excel_texto(p_texto text, p_campo text, p_limite integer, p_requerido boolean DEFAULT false)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  p_texto := nullif(btrim(p_texto),'');
  IF p_requerido AND p_texto IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Falta ' || p_campo || '.';
  END IF;
  IF length(p_texto) > p_limite OR p_texto ~ '[<>[:cntrl:]]' THEN
    RAISE EXCEPTION USING ERRCODE = '22023',
      MESSAGE = p_campo || ' contiene caracteres de control, signos < o >, o supera ' || p_limite || ' caracteres.';
  END IF;
  RETURN p_texto;
END;
$$;

CREATE OR REPLACE FUNCTION public._excel_numero(p_valor text, p_campo text, p_escala integer, p_positivo boolean DEFAULT false)
RETURNS numeric LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE v numeric;
BEGIN
  IF p_valor IS NULL AND NOT p_positivo THEN RETURN NULL; END IF;
  IF p_valor IS NOT NULL AND p_valor ~ '^[0-9]{1,9}(\.[0-9]+)?$' AND length(p_valor) <= 14 THEN
    v := p_valor::numeric;
    IF v = round(v,p_escala) AND (NOT p_positivo OR v > 0) THEN RETURN trim_scale(v); END IF;
  END IF;
  RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = p_campo || ' tiene un valor o una precisión inválidos.';
END;
$$;

CREATE OR REPLACE FUNCTION public._excel_fecha(p_valor text, p_campo text, p_requerida boolean)
RETURNS date LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
BEGIN
  IF p_valor IS NULL AND NOT p_requerida THEN RETURN NULL; END IF;
  IF p_valor ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN RETURN p_valor::date; END IF;
  RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = p_campo || ' debe ser una fecha válida.';
END;
$$;

CREATE OR REPLACE FUNCTION public.importar_excel(
  p_clinica bigint, p_filas jsonb, p_confirmar boolean DEFAULT false, p_revision text DEFAULT NULL
)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_clinica jsonb;
  v_actor text;
  v_permisos text[];
  v_modulos text[] := ARRAY[]::text[];
  v_fila record;
  v_tipo text;
  v_d jsonb;
  v_archivo text;
  v_hoja text;
  v_numero integer;
  v_clave text;
  v_nombre text;
  v_descripcion text;
  v_categoria text;
  v_referencia text;
  v_metodo text;
  v_clase text;
  v_cantidad numeric;
  v_costo numeric;
  v_guardado numeric;
  v_minimo_guardado numeric;
  v_precio_guardado numeric;
  v_costo_guardado numeric;
  v_fecha date;
  v_stock numeric;
  v_prod jsonb;
  v_cantidad_productos integer;
  v_registro bigint;
  v_movimiento bigint;
  v_previa jsonb;
  v_recibo uuid;
  v_lote uuid;
  v_detalle text;
  v_error text;
  v_estado text;
  v_producto_clave text;
  v_mapa_productos jsonb := '{}';
  v_mapa_claves jsonb := '{}';
  v_plan jsonb := '[]';
  v_resultados jsonb := '{}';
  v_resumen jsonb;
  v_revision text;
  v_cambio boolean;
  v_nuevas integer := 0;
  v_duplicadas integer := 0;
  v_errores integer := 0;
  v_finanzas integer := 0;
  v_productos integer := 0;
  v_movimientos integer := 0;
  v_ingresos numeric := 0;
  v_egresos numeric := 0;
  v_doc text;
  v_venc date;
  v_dias integer;
  v_ref bigint;
  v_entidad text;
  v_mapa_entidades jsonb := '{}';
  v_proveedores integer := 0;
  v_clientes integer := 0;
  v_cxc integer := 0;
  v_cxp integer := 0;
  v_por_cobrar numeric := 0;
  v_por_pagar numeric := 0;
BEGIN
  v_permisos := public.modulos_importacion_excel(p_clinica);
  IF cardinality(v_permisos) = 0 THEN
    RAISE EXCEPTION 'No tienes permisos para importar en este establecimiento.' USING ERRCODE = '42501';
  END IF;
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'La carga debe contener una lista de filas.';
  END IF;
  IF jsonb_array_length(p_filas) NOT BETWEEN 1 AND 1000 OR pg_column_size(p_filas) > 3000000 THEN
    RAISE EXCEPTION 'La carga admite hasta 1,000 filas y 3 MB de datos asignados.';
  END IF;
  FOR v_fila IN SELECT DISTINCT value->>'tipo' AS tipo FROM jsonb_array_elements(p_filas) LOOP
    v_tipo := CASE v_fila.tipo WHEN 'finanzas' THEN 'finanzas' WHEN 'productos' THEN 'inventario' WHEN 'movimientos' THEN 'inventario'
      WHEN 'proveedores' THEN 'inventario' WHEN 'cxp' THEN 'inventario' WHEN 'clientes' THEN 'contabilidad' WHEN 'cxc' THEN 'contabilidad' END;
    IF v_tipo IS NULL OR NOT v_tipo = ANY(v_permisos) THEN
      RAISE EXCEPTION 'No tienes permiso para uno de los destinos de la carga.' USING ERRCODE = '42501';
    END IF;
    IF NOT v_tipo = ANY(v_modulos) THEN v_modulos := array_append(v_modulos,v_tipo); END IF;
  END LOOP;
  SELECT to_jsonb(c) INTO STRICT v_clinica FROM public.clinicas c WHERE c.id = p_clinica;
  SELECT p.nombre INTO v_actor FROM public.profiles p
    WHERE p.id = auth.uid() OR lower(p.email) = lower(nullif(auth.jwt()->>'email',''))
    ORDER BY (p.id = auth.uid()) DESC NULLS LAST LIMIT 1;

  IF p_confirmar THEN
    -- Serializa importaciones de la misma clínica. Las filas de stock se bloquean al verificarlas.
    PERFORM pg_advisory_xact_lock(hashtextextended('lumea-importar-excel:' || p_clinica, 0));
  END IF;

  FOR v_fila IN
    SELECT f AS fila, n
    FROM jsonb_array_elements(p_filas) WITH ORDINALITY AS t(f,n)
    ORDER BY CASE f->>'tipo' WHEN 'productos' THEN 1 WHEN 'proveedores' THEN 1 WHEN 'clientes' THEN 1 WHEN 'movimientos' THEN 3 ELSE 2 END,
      CASE WHEN f->>'tipo' = 'movimientos' THEN f->'datos'->>'fecha' END, n
  LOOP
    v_tipo := v_fila.fila->>'tipo';
    v_d := v_fila.fila->'datos';
    v_detalle := NULL;
    v_error := NULL;
    v_recibo := NULL;
    v_registro := NULL;
    v_estado := 'lista';
    BEGIN
      v_archivo := left(v_fila.fila->>'archivo',255);
      v_hoja := left(v_fila.fila->>'hoja',128);
      v_numero := (v_fila.fila->>'fila')::integer;
      IF nullif(btrim(v_archivo),'') IS NULL OR nullif(btrim(v_hoja),'') IS NULL OR
        v_numero IS NULL OR v_numero NOT BETWEEN 1 AND 2000 OR jsonb_typeof(v_d) IS DISTINCT FROM 'object' THEN
        RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Faltan el archivo, la hoja, la fila o sus valores.';
      END IF;
      v_cantidad := NULL;
      v_fecha := public._excel_fecha(v_d->>'fecha','La fecha',v_tipo IN ('finanzas','movimientos','cxc','cxp'));
      v_clase := v_d->>'clase';

      IF v_tipo = 'finanzas' THEN
        v_clave := lower(public._excel_texto(v_d->>'id_origen','el ID de origen',120,true));
        v_descripcion := public._excel_texto(v_d->>'descripcion','la descripción',300,true);
        v_cantidad := public._excel_numero(v_d->>'monto','El monto',2,true);
        v_categoria := coalesce(v_d->>'categoria','general');
        v_metodo := coalesce(v_d->>'metodo','efectivo');
        v_referencia := public._excel_texto(v_d->>'referencia','la referencia',150);
        IF v_clase IS NULL OR v_clase NOT IN ('ingreso','egreso') THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El tipo debe ser ingreso o egreso.';
        END IF;
        IF v_metodo NOT IN ('efectivo','tarjeta','transferencia','cheque','otro') THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Método de pago inválido.';
        END IF;
        IF v_categoria IN ('compras','ventas','factura') OR v_categoria !~ '^[a-z0-9_-]{1,100}$' OR NOT (
          v_categoria IN ('medicamento','insumo','equipo','general') OR
          (v_clase = 'ingreso' AND v_categoria IN ('consulta','procedimiento')) OR
          (v_clase = 'egreso' AND v_categoria IN ('nomina','alquiler','servicios','impuestos','pago_iva','abarrotes','desechos','consumibles','pago_profesional')) OR
          (v_clinica->'categorias_finanzas'->v_clase @> jsonb_build_array(jsonb_build_object('id',v_categoria))) IS TRUE) THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Categoría inválida o reservada para documentos vinculados.';
        END IF;
        v_d := jsonb_build_object('fecha',v_fecha,'clase',v_clase,'monto',v_cantidad,'descripcion',v_descripcion,
          'categoria',v_categoria,'metodo',v_metodo,'referencia',v_referencia);
        v_detalle := v_clase || ' · ' || v_descripcion || ' · C$ ' || v_cantidad || ' · ' || v_fecha;
      ELSIF v_tipo = 'productos' THEN
        v_clase := NULL;
        v_nombre := public._excel_texto(v_d->>'nombre','el nombre del producto',150,true);
        v_clave := lower(v_nombre);
        v_categoria := coalesce(v_d->>'categoria','general');
        v_metodo := coalesce(v_d->>'unidad','unidad');
        v_cantidad := coalesce(public._excel_numero(v_d->>'stock','El stock inicial',3),0);
        v_costo := public._excel_numero(v_d->>'costo','El costo',4);
        IF v_categoria NOT IN ('medicamento','material','equipo','insumo','papeleria','general') OR
          v_metodo NOT IN ('unidad','caja','frasco','ampolla','tableta','rollo','litro','ml','par','paquete') THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Categoría o unidad de inventario inválida.';
        END IF;
        IF v_cantidad > 0 AND (v_costo IS NULL OR v_fecha IS NULL) THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El stock inicial requiere fecha de apertura y costo unitario.';
        END IF;
        v_d := jsonb_build_object('nombre',v_nombre,'categoria',v_categoria,'unidad',v_metodo,
          'stock',v_cantidad,'fecha',v_fecha,'costo',v_costo,
          'minimo',coalesce(public._excel_numero(v_d->>'minimo','El stock mínimo',3),0),
          'precio',public._excel_numero(v_d->>'precio','El precio',2),
          'vencimiento',public._excel_fecha(v_d->>'vencimiento','El vencimiento',false),
          'descripcion',public._excel_texto(v_d->>'descripcion','La descripción',300));
        v_detalle := v_nombre || ' · stock inicial ' || v_cantidad;
      ELSIF v_tipo IN ('proveedores','clientes') THEN
        IF v_tipo = 'clientes' AND v_clinica->>'tipo' IS DISTINCT FROM 'empresa_medica' THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los clientes se importan solo en una empresa privada.';
        END IF;
        v_clase := NULL;
        v_nombre := public._excel_texto(v_d->>'nombre','el nombre',150,true);
        v_clave := lower(v_nombre);
        v_dias := NULL;
        IF v_tipo = 'clientes' THEN
          v_dias := coalesce(public._excel_numero(v_d->>'dias_credito','Los días de crédito',0),30);
          IF v_dias > 3650 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los días de crédito deben estar entre 0 y 3650.';
          END IF;
        END IF;
        v_d := jsonb_build_object('nombre',v_nombre,
          'identificacion',public._excel_texto(v_d->>'identificacion','El RUC o la cédula',40),
          'contacto',public._excel_texto(v_d->>'contacto','El contacto',120),
          'telefono',public._excel_texto(v_d->>'telefono','El teléfono',60),
          'email',public._excel_texto(v_d->>'email','El correo',150),
          'direccion',public._excel_texto(v_d->>'direccion','La dirección',250),
          'notas',public._excel_texto(v_d->>'notas','Las notas',300))
          || CASE WHEN v_tipo = 'clientes' THEN jsonb_build_object('dias_credito',v_dias) ELSE '{}'::jsonb END;
        v_detalle := CASE v_tipo WHEN 'clientes' THEN 'Cliente · ' ELSE 'Proveedor · ' END || v_nombre;
      ELSIF v_tipo IN ('cxc','cxp') THEN
        IF v_tipo = 'cxc' AND v_clinica->>'tipo' IS DISTINCT FROM 'empresa_medica' THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Los saldos de clientes se importan solo en una empresa privada.';
        END IF;
        v_clase := NULL;
        v_nombre := public._excel_texto(v_d->>'nombre',CASE v_tipo WHEN 'cxc' THEN 'el cliente' ELSE 'el proveedor' END,150,true);
        v_doc := public._excel_texto(v_d->>'documento','el número de documento',60,true);
        v_clave := lower(v_nombre || ' · ' || v_doc);
        v_cantidad := public._excel_numero(v_d->>'saldo','El saldo pendiente',2,true);
        v_venc := public._excel_fecha(v_d->>'vencimiento','El vencimiento',false);
        IF v_venc < v_fecha THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El vencimiento no puede ser antes de la fecha del documento.';
        END IF;
        v_d := jsonb_build_object('nombre',v_nombre,'documento',v_doc,'fecha',v_fecha,'vencimiento',v_venc,'saldo',v_cantidad);
        v_detalle := CASE v_tipo WHEN 'cxc' THEN 'Por cobrar · ' ELSE 'Por pagar · ' END || v_nombre || ' · ' || v_doc || ' · C$ ' || v_cantidad;
      ELSE
        IF v_clinica->>'tipo' = 'empresa_medica' THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'En empresa privada registra las entradas y salidas desde Compras, Ventas o Inventario para conservar los lotes.';
        END IF;
        v_clave := lower(public._excel_texto(v_d->>'id_origen','el ID de origen',120,true));
        v_nombre := public._excel_texto(v_d->>'producto','el nombre del producto',150,true);
        v_cantidad := public._excel_numero(v_d->>'cantidad','La cantidad',3,true);
        IF v_clase IS NULL OR v_clase NOT IN ('entrada','salida') THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El tipo debe ser entrada o salida.';
        END IF;
        v_d := jsonb_build_object('producto',lower(v_nombre),'fecha',v_fecha,'clase',v_clase,'cantidad',v_cantidad,
          'motivo',public._excel_texto(v_d->>'motivo','El motivo',230));
        v_detalle := v_clase || ' · ' || v_nombre || ' · ' || v_cantidad || ' · ' || v_fecha;
      END IF;

      v_previa := v_mapa_claves->(v_tipo || ':' || v_clave);
      IF v_previa IS NULL THEN
        SELECT jsonb_build_object('datos',a.datos,'lote',a.lote_id,'registro',a.registro_id) INTO v_previa
        FROM public.importaciones_excel_filas a
        WHERE a.clinica_id = p_clinica AND a.tipo = v_tipo AND a.clave = v_clave;
      END IF;
      IF v_previa IS NOT NULL THEN
        IF v_previa->'datos' IS DISTINCT FROM v_d THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El mismo ID de origen o nombre de producto tiene datos diferentes.';
        END IF;
        v_estado := 'duplicada';
        v_recibo := (v_previa->>'lote')::uuid;
        v_registro := (v_previa->>'registro')::bigint;
        v_duplicadas := v_duplicadas + 1;
      ELSE
        IF v_tipo = 'finanzas' AND EXISTS (SELECT 1 FROM public.finanzas f WHERE f.clinica_id = p_clinica
          AND (lower(btrim(f.referencia)) = v_clave OR (v_referencia IS NOT NULL AND lower(btrim(f.referencia)) = lower(v_referencia)
            AND f.tipo = v_clase AND f.fecha = v_fecha AND f.monto = v_cantidad))) THEN
          RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Hay un registro en Finanzas con la misma referencia. Comprueba que el movimiento no exista.';
        END IF;

        IF v_tipo IN ('productos','movimientos') THEN
          v_producto_clave := lower(v_nombre);
          v_prod := v_mapa_productos->v_producto_clave;
          IF v_prod IS NULL THEN
            IF p_confirmar THEN
              PERFORM 1 FROM public.inventario i WHERE i.clinica_id = p_clinica AND lower(btrim(i.nombre)) = v_producto_clave
                ORDER BY i.id FOR UPDATE;
            END IF;
            SELECT count(*), jsonb_agg(jsonb_build_object('id',i.id,'stock',coalesce(i.stock_actual,0)))->0
              INTO v_cantidad_productos, v_prod
            FROM public.inventario i WHERE i.clinica_id = p_clinica AND lower(btrim(i.nombre)) = v_producto_clave;
            IF v_cantidad_productos > 1 THEN
              RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Hay más de un producto con este nombre en el catálogo.';
            END IF;
          END IF;
          IF v_tipo = 'productos' AND v_prod IS NOT NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El producto ya existe. Para ajustar su stock utiliza una hoja de movimientos.';
          END IF;
          IF v_tipo = 'movimientos' AND v_prod IS NULL THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El producto no existe en el catálogo ni en esta carga.';
          END IF;
          v_stock := coalesce((v_prod->>'stock')::numeric,0) + CASE WHEN v_clase = 'salida' THEN -v_cantidad ELSE v_cantidad END;
          IF v_stock < 0 OR v_stock >= 1000000000 THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'La cantidad dejaría el stock fuera del rango permitido. Existencia antes del movimiento: ' || (v_prod->>'stock') || '.';
          END IF;
          IF v_tipo = 'movimientos' AND v_fecha < (v_prod->>'apertura')::date THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'El movimiento tiene una fecha anterior a la apertura del producto en esta carga.';
          END IF;
          v_mapa_productos := jsonb_set(v_mapa_productos,ARRAY[v_producto_clave],jsonb_build_object('stock',v_stock,
            'apertura',CASE WHEN v_tipo = 'productos' AND v_cantidad > 0 THEN v_fecha ELSE (v_prod->>'apertura')::date END));
          IF v_tipo = 'movimientos' THEN v_detalle := v_detalle || ' · saldo ' || v_stock; END IF;
        END IF;
        IF v_tipo IN ('proveedores','clientes') THEN
          IF v_tipo = 'proveedores' AND EXISTS (SELECT 1 FROM public.proveedores x
              WHERE x.clinica_id = p_clinica AND lower(btrim(x.nombre)) = v_clave) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ya existe un proveedor con este nombre.';
          END IF;
          IF v_tipo = 'clientes' AND EXISTS (SELECT 1 FROM public.clientes_comerciales x
              WHERE x.clinica_id = p_clinica AND lower(btrim(x.nombre)) = v_clave) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ya existe un cliente con este nombre.';
          END IF;
          v_mapa_entidades := jsonb_set(v_mapa_entidades,ARRAY[v_tipo || ':' || v_clave],'true');
        ELSIF v_tipo IN ('cxc','cxp') THEN
          v_entidad := CASE v_tipo WHEN 'cxc' THEN 'clientes' ELSE 'proveedores' END;
          IF NOT v_mapa_entidades ? (v_entidad || ':' || lower(v_nombre)) THEN
            IF v_tipo = 'cxc' THEN
              SELECT count(*) INTO v_cantidad_productos FROM public.clientes_comerciales x
                WHERE x.clinica_id = p_clinica AND lower(btrim(x.nombre)) = lower(v_nombre);
            ELSE
              SELECT count(*) INTO v_cantidad_productos FROM public.proveedores x
                WHERE x.clinica_id = p_clinica AND lower(btrim(x.nombre)) = lower(v_nombre);
            END IF;
            IF v_cantidad_productos = 0 THEN
              RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = CASE v_tipo WHEN 'cxc' THEN 'El cliente' ELSE 'El proveedor' END
                || ' no existe en el sistema ni en esta carga. Inclúyelo en una hoja de ' || v_entidad || '.';
            ELSIF v_cantidad_productos > 1 THEN
              RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Hay más de un registro con este nombre en ' || v_entidad || '.';
            END IF;
          END IF;
          IF v_tipo = 'cxc' THEN
            IF v_mapa_entidades ? ('documento:' || lower(v_doc)) OR EXISTS (SELECT 1 FROM public.ventas x
                WHERE x.clinica_id = p_clinica AND lower(x.numero) = lower('SI-' || v_doc)) THEN
              RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ya hay un saldo de cliente con el documento ' || v_doc || '.';
            END IF;
            v_mapa_entidades := jsonb_set(v_mapa_entidades,ARRAY['documento:' || lower(v_doc)],'true');
          ELSIF EXISTS (SELECT 1 FROM public.compras x JOIN public.proveedores pr ON pr.id = x.proveedor_id
              WHERE x.clinica_id = p_clinica AND x.saldo_inicial AND x.estado <> 'anulada'
                AND lower(btrim(x.numero_factura)) = lower(v_doc) AND lower(btrim(pr.nombre)) = lower(v_nombre)) THEN
            RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'Ya hay un saldo con este proveedor y documento.';
          END IF;
        END IF;
        v_mapa_claves := jsonb_set(v_mapa_claves,ARRAY[v_tipo || ':' || v_clave],jsonb_build_object('datos',v_d));
        v_plan := v_plan || jsonb_build_array(jsonb_build_object(
          'n',v_fila.n,'tipo',v_tipo,'clave',v_clave,'datos',v_d));
        v_nuevas := v_nuevas + 1;
        IF v_tipo = 'finanzas' THEN
          v_finanzas := v_finanzas + 1;
          IF v_clase = 'ingreso' THEN v_ingresos := v_ingresos + v_cantidad;
          ELSE v_egresos := v_egresos + v_cantidad;
          END IF;
        ELSIF v_tipo = 'productos' THEN v_productos := v_productos + 1;
        ELSIF v_tipo = 'proveedores' THEN v_proveedores := v_proveedores + 1;
        ELSIF v_tipo = 'clientes' THEN v_clientes := v_clientes + 1;
        ELSIF v_tipo = 'cxc' THEN v_cxc := v_cxc + 1; v_por_cobrar := v_por_cobrar + v_cantidad;
        ELSIF v_tipo = 'cxp' THEN v_cxp := v_cxp + 1; v_por_pagar := v_por_pagar + v_cantidad;
        ELSE v_movimientos := v_movimientos + 1;
        END IF;
      END IF;
    EXCEPTION WHEN data_exception THEN
      v_estado := 'error';
      v_error := SQLERRM;
      v_errores := v_errores + 1;
    END;
    v_resultados := jsonb_set(v_resultados,ARRAY[v_fila.n::text],
      jsonb_build_object('archivo',v_fila.fila->>'archivo','hoja',v_fila.fila->>'hoja','fila',v_fila.fila->>'fila',
        'registro_id',v_registro::text,'estado',v_estado,'error',v_error,'detalle',v_detalle,'lote',v_recibo));
  END LOOP;

  v_resumen := jsonb_build_object('nuevas',v_nuevas,'duplicadas',v_duplicadas,'errores',v_errores,
    'finanzas',v_finanzas,'productos',v_productos,'movimientos',v_movimientos,'ingresos',v_ingresos,'egresos',v_egresos,
    'proveedores',v_proveedores,'clientes',v_clientes,'cxc',v_cxc,'cxp',v_cxp,'por_cobrar',v_por_cobrar,'por_pagar',v_por_pagar);
  v_revision := md5(v_resultados::text || v_plan::text);
  v_cambio := p_confirmar AND p_revision IS NOT NULL AND p_revision <> v_revision AND v_nuevas > 0 AND v_errores = 0;
  IF p_confirmar AND NOT v_cambio AND v_errores = 0 AND v_nuevas > 0 THEN
    INSERT INTO public.importaciones_excel (clinica_id,usuario_id,modulos,resumen)
    VALUES (p_clinica,auth.uid(),v_modulos,v_resumen) RETURNING id INTO v_lote;

    FOR v_fila IN SELECT value AS fila FROM jsonb_array_elements(v_plan) LOOP
      v_tipo := v_fila.fila->>'tipo';
      v_clave := v_fila.fila->>'clave';
      v_d := v_fila.fila->'datos';
      v_movimiento := NULL;
      IF v_tipo = 'finanzas' THEN
        INSERT INTO public.finanzas (clinica_id,tipo,categoria,descripcion,monto,fecha,metodo_pago,referencia,creado_por)
        VALUES (p_clinica,v_d->>'clase',v_d->>'categoria',v_d->>'descripcion',(v_d->>'monto')::numeric,
          (v_d->>'fecha')::date,v_d->>'metodo',coalesce(v_d->>'referencia',v_clave),v_actor) RETURNING id,monto INTO v_registro,v_guardado;
        IF v_guardado IS DISTINCT FROM (v_d->>'monto')::numeric THEN
          RAISE EXCEPTION 'El monto no conserva su precisión en la base de datos. Se canceló la carga.';
        END IF;
      ELSIF v_tipo = 'productos' THEN
        INSERT INTO public.inventario (clinica_id,nombre,categoria,unidad,stock_actual,stock_minimo,costo_unitario,precio_unitario,descripcion,fecha_vencimiento)
        VALUES (p_clinica,v_d->>'nombre',v_d->>'categoria',v_d->>'unidad',(v_d->>'stock')::numeric,(v_d->>'minimo')::numeric,
          (v_d->>'costo')::numeric,(v_d->>'precio')::numeric,v_d->>'descripcion',(v_d->>'vencimiento')::date)
        RETURNING id,stock_actual,stock_minimo,precio_unitario,costo_unitario
        INTO v_registro,v_guardado,v_minimo_guardado,v_precio_guardado,v_costo_guardado;
        IF v_guardado IS DISTINCT FROM (v_d->>'stock')::numeric OR
          v_minimo_guardado IS DISTINCT FROM (v_d->>'minimo')::numeric OR
          v_precio_guardado IS DISTINCT FROM (v_d->>'precio')::numeric OR
          v_costo_guardado IS DISTINCT FROM (v_d->>'costo')::numeric THEN
          RAISE EXCEPTION 'El stock o los importes de un producto no conservan su precisión. Se canceló la carga.';
        END IF;
        IF (v_d->>'stock')::numeric > 0 THEN
          INSERT INTO public.inventario_movimientos (clinica_id,inventario_id,tipo,cantidad,motivo,fecha)
          VALUES (p_clinica,v_registro,'entrada',(v_d->>'stock')::numeric,'Excel · Existencia inicial',(v_d->>'fecha')::date)
          RETURNING id,cantidad INTO v_movimiento,v_guardado;
          IF v_guardado IS DISTINCT FROM (v_d->>'stock')::numeric THEN
            RAISE EXCEPTION 'La cantidad inicial no conserva su precisión en el historial. Se canceló la carga.';
          END IF;
        END IF;
      ELSIF v_tipo = 'proveedores' THEN
        INSERT INTO public.proveedores (clinica_id,nombre,identificacion,contacto,telefono,email,direccion,notas,activo)
        VALUES (p_clinica,v_d->>'nombre',v_d->>'identificacion',v_d->>'contacto',v_d->>'telefono',v_d->>'email',
          v_d->>'direccion',v_d->>'notas',true) RETURNING id INTO v_registro;
      ELSIF v_tipo = 'clientes' THEN
        INSERT INTO public.clientes_comerciales (clinica_id,nombre,identificacion,contacto,telefono,email,direccion,dias_credito,notas,activo)
        VALUES (p_clinica,v_d->>'nombre',v_d->>'identificacion',v_d->>'contacto',v_d->>'telefono',v_d->>'email',
          v_d->>'direccion',(v_d->>'dias_credito')::integer,v_d->>'notas',true) RETURNING id INTO v_registro;
      ELSIF v_tipo = 'cxc' THEN
        SELECT x.id, x.dias_credito INTO STRICT v_ref, v_dias FROM public.clientes_comerciales x
          WHERE x.clinica_id = p_clinica AND lower(btrim(x.nombre)) = lower(v_d->>'nombre');
        INSERT INTO public.ventas (clinica_id,cliente_id,numero,fecha,subtotal,iva_pct,iva,total,condicion,vencimiento,estado,notas,creado_por,saldo_inicial)
        VALUES (p_clinica,v_ref,'SI-' || (v_d->>'documento'),(v_d->>'fecha')::date,(v_d->>'saldo')::numeric,0,0,(v_d->>'saldo')::numeric,
          'credito',coalesce((v_d->>'vencimiento')::date,(v_d->>'fecha')::date + coalesce(v_dias,30)),'registrada',
          'Saldo inicial importado de Excel',v_actor,true) RETURNING id,total INTO v_registro,v_guardado;
        IF v_guardado IS DISTINCT FROM (v_d->>'saldo')::numeric THEN
          RAISE EXCEPTION 'Un saldo de cliente no conserva su precisión. Se canceló la carga.';
        END IF;
      ELSIF v_tipo = 'cxp' THEN
        SELECT x.id INTO STRICT v_ref FROM public.proveedores x
          WHERE x.clinica_id = p_clinica AND lower(btrim(x.nombre)) = lower(v_d->>'nombre');
        INSERT INTO public.compras (clinica_id,proveedor_id,fecha,numero_factura,metodo_pago,subtotal,iva,iva_pct,total,condicion,vencimiento,estado,notas,creado_por,saldo_inicial)
        VALUES (p_clinica,v_ref,(v_d->>'fecha')::date,v_d->>'documento','credito',(v_d->>'saldo')::numeric,0,0,(v_d->>'saldo')::numeric,
          'credito',coalesce((v_d->>'vencimiento')::date,(v_d->>'fecha')::date + 30),'registrada',
          'Saldo inicial importado de Excel',v_actor,true) RETURNING id,total INTO v_registro,v_guardado;
        IF v_guardado IS DISTINCT FROM (v_d->>'saldo')::numeric THEN
          RAISE EXCEPTION 'Un saldo con proveedor no conserva su precisión. Se canceló la carga.';
        END IF;
      ELSE
        v_cantidad := (v_d->>'cantidad')::numeric;
        SELECT coalesce(i.stock_actual,0) INTO STRICT v_stock FROM public.inventario i
          WHERE i.clinica_id = p_clinica AND lower(btrim(i.nombre)) = v_d->>'producto';
        v_stock := v_stock + CASE WHEN v_d->>'clase' = 'entrada' THEN v_cantidad ELSE -v_cantidad END;
        UPDATE public.inventario i SET stock_actual = coalesce(i.stock_actual,0) +
          CASE WHEN v_d->>'clase' = 'entrada' THEN v_cantidad ELSE -v_cantidad END
        WHERE i.clinica_id = p_clinica AND lower(btrim(i.nombre)) = v_d->>'producto'
        RETURNING id,stock_actual INTO STRICT v_registro,v_guardado;
        IF v_guardado IS DISTINCT FROM v_stock THEN
          RAISE EXCEPTION 'La existencia final no conserva su precisión en el catálogo. Se canceló la carga.';
        END IF;
        INSERT INTO public.inventario_movimientos (clinica_id,inventario_id,tipo,cantidad,motivo,fecha)
        VALUES (p_clinica,v_registro,v_d->>'clase',v_cantidad,'Excel · ' || coalesce(v_d->>'motivo',v_clave),(v_d->>'fecha')::date)
        RETURNING id,cantidad INTO v_registro,v_guardado;
        IF v_guardado IS DISTINCT FROM v_cantidad THEN
          RAISE EXCEPTION 'La cantidad del movimiento no conserva su precisión. Se canceló la carga.';
        END IF;
      END IF;
      v_numero := (v_fila.fila->>'n')::integer;
      v_previa := v_resultados->v_numero::text;
      INSERT INTO public.importaciones_excel_filas (clinica_id,lote_id,ordinal,tipo,clave,archivo,hoja,fila,datos,registro_id,movimiento_inicial_id)
      VALUES (p_clinica,v_lote,v_numero,v_tipo,v_clave,v_previa->>'archivo',v_previa->>'hoja',(v_previa->>'fila')::integer,
        v_d,v_registro,v_movimiento);
      v_resultados := jsonb_set(v_resultados,ARRAY[v_numero::text],v_previa ||
        jsonb_build_object('registro_id',v_registro::text,'lote',v_lote,'estado','guardada'));
    END LOOP;
  END IF;

  RETURN jsonb_build_object('lote',v_lote,'resumen',v_resumen,'revision',v_revision,'cambio',v_cambio,'filas',(
    SELECT jsonb_agg(value ORDER BY key::integer) FROM jsonb_each(v_resultados)
  ));
END;
$$;

REVOKE ALL ON FUNCTION public.modulos_importacion_excel(bigint), public.importar_excel(bigint,jsonb,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._excel_texto(text,text,integer,boolean), public._excel_numero(text,text,integer,boolean),
  public._excel_fecha(text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.modulos_importacion_excel(bigint), public.importar_excel(bigint,jsonb,boolean,text) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT to_regprocedure('public.importar_excel(bigint,jsonb,boolean,text)') AS funcion_importar_excel;
