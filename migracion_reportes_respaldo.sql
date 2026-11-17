BEGIN;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS reportes_respaldo jsonb
  NOT NULL DEFAULT '{"tipos":[],"periodo":"mes"}';

CREATE OR REPLACE FUNCTION public.proteger_reportes_respaldo()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
  v_defecto CONSTANT jsonb := '{"tipos":[],"periodo":"mes"}';
  v_edicion_autorizada boolean := auth.uid() IS NULL OR public.is_superadmin();
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.reportes_respaldo IS NOT DISTINCT FROM OLD.reportes_respaldo THEN
    IF NOT v_edicion_autorizada AND (
      NEW.id IS DISTINCT FROM OLD.id OR NEW.clinica_id IS DISTINCT FROM OLD.clinica_id
      OR lower(NEW.email) IS DISTINCT FROM lower(OLD.email) OR NEW.rol IS DISTINCT FROM OLD.rol
      OR (to_jsonb(NEW)->'permisos') IS DISTINCT FROM (to_jsonb(OLD)->'permisos')
    ) THEN
      NEW.reportes_respaldo := v_defecto;
    END IF;
    RETURN NEW;
  END IF;
  IF NOT v_edicion_autorizada THEN
    IF TG_OP = 'UPDATE' OR NEW.reportes_respaldo IS DISTINCT FROM v_defecto THEN
      RAISE EXCEPTION 'Solo el Super Admin puede configurar los reportes por correo.' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF jsonb_typeof(NEW.reportes_respaldo->'tipos') IS DISTINCT FROM 'array'
    OR coalesce(NEW.reportes_respaldo->>'periodo','') NOT IN ('hoy','semana','mes','historial') THEN
    RAISE EXCEPTION 'La configuración de reportes por correo es inválida.' USING ERRCODE = '22023';
  END IF;
  IF NOT NEW.reportes_respaldo->'tipos' <@ '["actividad","finanzas","inventario","contabilidad"]'::jsonb
      OR jsonb_array_length(NEW.reportes_respaldo->'tipos') > 4 THEN
    RAISE EXCEPTION 'La configuración contiene tipos de reportes inválidos.' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_proteger_reportes_respaldo ON public.profiles;
CREATE TRIGGER trg_proteger_reportes_respaldo
  BEFORE INSERT OR UPDATE OF reportes_respaldo, id, clinica_id, email, rol, permisos ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_reportes_respaldo();

CREATE TABLE IF NOT EXISTS public.respaldos_reportes (
  id uuid PRIMARY KEY,
  clinica_id bigint NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  solicitante uuid NOT NULL,
  establecimiento text NOT NULL,
  formato text NOT NULL CHECK (formato IN ('json','pdf')),
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.respaldos_reportes_envios (
  respaldo_id uuid NOT NULL REFERENCES public.respaldos_reportes(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL,
  correo text NOT NULL,
  periodo text NOT NULL,
  desde date,
  hasta date NOT NULL,
  tipos text[] NOT NULL,
  reportes jsonb NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aceptado','omitido')),
  proveedor_id text,
  PRIMARY KEY (respaldo_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS respaldos_reportes_solicitante
  ON public.respaldos_reportes(solicitante,clinica_id,creado_en DESC);

-- El historial contiene direcciones y cifras. Se consulta a través de funciones
-- que limitan los datos por sesión; las tablas solo se usan desde el servidor.
ALTER TABLE public.respaldos_reportes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.respaldos_reportes_envios ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.respaldos_reportes, public.respaldos_reportes_envios FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.respaldos_reportes TO service_role;
GRANT SELECT, UPDATE ON public.respaldos_reportes_envios TO service_role;

CREATE OR REPLACE FUNCTION public._permisos_reportes_respaldo(p_rol text, p_permisos jsonb)
RETURNS text[] LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE
    WHEN p_rol = 'superadmin' THEN ARRAY['exportar','estadisticas','finanzas','inventario','contabilidad']
    WHEN jsonb_typeof(p_permisos) = 'array' THEN ARRAY(SELECT jsonb_array_elements_text(p_permisos))
    WHEN p_rol = 'admin_empresa' THEN ARRAY['exportar','estadisticas','finanzas','inventario','contabilidad']
    WHEN p_rol IN ('medico_admin','admin') THEN ARRAY['exportar','estadisticas']
    WHEN p_rol IN ('oftalmologo','dermatologo') THEN ARRAY['estadisticas']
    WHEN p_rol = 'farmaceutico' THEN ARRAY['finanzas','inventario']
    ELSE ARRAY[]::text[]
  END;
$$;

CREATE OR REPLACE FUNCTION public._destinos_reportes_respaldo(p_clinica bigint, p_empresa boolean)
RETURNS TABLE(usuario_id uuid, correo text, periodo text, tipos text[])
LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT p.id, lower(btrim(u.email)), p.reportes_respaldo->>'periodo',
    ARRAY(
      SELECT DISTINCT t.tipo
      FROM jsonb_array_elements_text(p.reportes_respaldo->'tipos') AS t(tipo)
      WHERE (CASE WHEN t.tipo = 'actividad' THEN 'estadisticas' ELSE t.tipo END)
        = ANY (public._permisos_reportes_respaldo(p.rol,to_jsonb(p)->'permisos'))
        AND (NOT p_empresa OR t.tipo <> 'actividad')
      ORDER BY t.tipo
    )
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id AND lower(btrim(p.email)) = lower(btrim(u.email))
  WHERE p.clinica_id = p_clinica AND u.email_confirmed_at IS NOT NULL
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND coalesce((to_jsonb(p)->>'bloqueado')::boolean,false) = false
    AND jsonb_array_length(p.reportes_respaldo->'tipos') > 0;
$$;

CREATE OR REPLACE FUNCTION public._datos_reporte_respaldo(
  p_tipo text, p_clinica bigint, p_desde date, p_hasta date, p_empresa boolean
)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = '' AS $$
DECLARE
  v jsonb;
  v_padron jsonb := '{}';
  v_compras jsonb := '{}';
  v_documentos jsonb := '{}';
BEGIN
  IF p_tipo = 'actividad' THEN
    IF EXISTS (SELECT 1 FROM public.clinicas c WHERE c.id = p_clinica AND to_jsonb(c)->>'tipo' = 'veterinaria') THEN
      IF to_regclass('public.mascotas') IS NOT NULL THEN
        SELECT jsonb_build_object('Mascotas en el padrón al corte', count(*)) INTO v_padron
        FROM public.mascotas m WHERE m.clinica_id = p_clinica;
      END IF;
    ELSE
      SELECT jsonb_build_object('Pacientes en el padrón al corte', count(*)) INTO v_padron
      FROM public.pacientes p WHERE p.clinica_id = p_clinica;
    END IF;
    SELECT jsonb_build_object(
      'Citas del período', count(*),
      'Citas completadas del período', count(*) FILTER (WHERE c.estado = 'completada')
    ) INTO v FROM public.citas c
      WHERE c.clinica_id = p_clinica AND c.fecha BETWEEN p_desde AND p_hasta;
    RETURN v_padron || v;
  ELSIF p_tipo = 'finanzas' THEN
    SELECT jsonb_build_object(
      'Movimientos', count(*),
      'Ingresos (C$)', coalesce(sum(f.monto) FILTER (WHERE f.tipo = 'ingreso'),0),
      'Egresos (C$)', coalesce(sum(f.monto) FILTER (WHERE f.tipo = 'egreso'),0),
      'Flujo neto (C$)', coalesce(sum(CASE f.tipo WHEN 'ingreso' THEN f.monto WHEN 'egreso' THEN -f.monto END),0)
    ) INTO v FROM public.finanzas f
      WHERE f.clinica_id = p_clinica AND f.fecha BETWEEN p_desde AND p_hasta;
  ELSIF p_tipo = 'inventario' THEN
    SELECT jsonb_build_object(
      'Productos en catálogo al corte',count(*),
      'Productos agotados al corte',count(*) FILTER (WHERE coalesce(i.stock_actual,0) <= 0),
      'Productos por debajo del mínimo al corte',count(*) FILTER (WHERE i.stock_actual > 0 AND i.stock_actual <= i.stock_minimo)
    ) INTO v FROM public.inventario i WHERE i.clinica_id = p_clinica;
    RETURN v || (SELECT jsonb_build_object(
        'Entradas del período',count(*) FILTER (WHERE m.tipo = 'entrada'),
        'Salidas del período',count(*) FILTER (WHERE m.tipo = 'salida')
      ) FROM public.inventario_movimientos m
      WHERE m.clinica_id = p_clinica AND m.fecha BETWEEN p_desde AND p_hasta);
  ELSIF p_tipo = 'contabilidad' THEN
    IF to_regclass('public.compras') IS NOT NULL THEN
      SELECT jsonb_build_object('Compras registradas',count(*),'Total de compras (C$)',coalesce(sum(c.total),0))
      INTO v_compras FROM public.compras c
        WHERE c.clinica_id = p_clinica AND c.estado = 'registrada' AND c.fecha BETWEEN p_desde AND p_hasta;
    END IF;
    IF p_empresa THEN
      IF to_regclass('public.ventas') IS NOT NULL THEN
        SELECT jsonb_build_object('Ventas registradas', count(*),'Total de ventas (C$)',coalesce(sum(s.total),0))
        INTO v_documentos FROM public.ventas s
          WHERE s.clinica_id = p_clinica AND s.estado = 'registrada' AND s.fecha BETWEEN p_desde AND p_hasta;
      END IF;
    ELSE
      SELECT jsonb_build_object('Documentos vigentes',count(*),'Total de documentos (C$)',coalesce(sum(f.total),0))
      INTO v_documentos FROM public.facturas f
        WHERE f.clinica_id = p_clinica AND f.estado IS DISTINCT FROM 'anulada' AND f.fecha BETWEEN p_desde AND p_hasta;
    END IF;
    RETURN v_compras || v_documentos;
  END IF;
  RETURN coalesce(v,'{}');
END;
$$;

CREATE OR REPLACE FUNCTION public.preparar_reportes_respaldo(p_id uuid, p_clinica bigint, p_formato text)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_clinica jsonb;
  v_dia date := (now() AT TIME ZONE 'America/Managua')::date;
  v_empresa boolean;
  v_respaldo public.respaldos_reportes%ROWTYPE;
BEGIN
  IF p_id IS NULL OR p_clinica IS NULL OR coalesce(p_formato,'') NOT IN ('json','pdf') THEN
    RAISE EXCEPTION 'Los datos del respaldo son inválidos.' USING ERRCODE = '22023';
  END IF;
  IF v_uid IS NULL OR (NOT public.is_superadmin() AND (
    p_clinica IS DISTINCT FROM public.get_my_clinica_id() OR NOT EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.clinica_id = p_clinica
        AND (p.id = v_uid OR lower(p.email) = lower(nullif(auth.jwt()->>'email','')))
        AND NOT coalesce((to_jsonb(p)->>'bloqueado')::boolean,false)
        AND 'exportar' = ANY(public._permisos_reportes_respaldo(p.rol,to_jsonb(p)->'permisos'))
    )
  )) THEN
    RAISE EXCEPTION 'No tienes permiso para enviar reportes de este respaldo.' USING ERRCODE = '42501';
  END IF;
  SELECT to_jsonb(c) INTO STRICT v_clinica FROM public.clinicas c WHERE c.id = p_clinica;
  v_empresa := coalesce(v_clinica->>'tipo' = 'empresa_medica',false);
  IF v_empresa AND p_formato = 'pdf' THEN
    RAISE EXCEPTION 'El respaldo de empresa se genera en JSON.' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.respaldos_reportes(id,clinica_id,solicitante,establecimiento,formato)
  VALUES(p_id,p_clinica,v_uid,coalesce(v_clinica->>'nombre','LumeaMed'),p_formato)
  ON CONFLICT (id) DO NOTHING RETURNING * INTO v_respaldo;
  IF NOT FOUND THEN
    IF NOT EXISTS (SELECT 1 FROM public.respaldos_reportes r
      WHERE r.id = p_id AND r.solicitante = v_uid AND r.clinica_id = p_clinica AND r.formato = p_formato) THEN
      RAISE EXCEPTION 'El identificador pertenece a otro respaldo.' USING ERRCODE = '42501';
    END IF;
    RETURN (SELECT count(*)::integer FROM public.respaldos_reportes_envios e WHERE e.respaldo_id = p_id AND e.estado = 'pendiente');
  END IF;
  WITH destinos AS MATERIALIZED (
    SELECT d.*, CASE d.periodo WHEN 'hoy' THEN v_dia WHEN 'semana' THEN date_trunc('week',v_dia::timestamp)::date
      WHEN 'mes' THEN date_trunc('month',v_dia::timestamp)::date ELSE '-infinity'::date END AS desde
    FROM public._destinos_reportes_respaldo(p_clinica,v_empresa) d WHERE cardinality(d.tipos) > 0
  ), reportes AS MATERIALIZED (
    SELECT x.tipo,x.desde,public._datos_reporte_respaldo(x.tipo,p_clinica,x.desde,v_dia,v_empresa) AS datos
    FROM (SELECT DISTINCT unnest(d.tipos) AS tipo,d.desde FROM destinos d) x
  )
  INSERT INTO public.respaldos_reportes_envios(respaldo_id,usuario_id,correo,periodo,desde,hasta,tipos,reportes)
  SELECT p_id,d.usuario_id,d.correo,d.periodo,nullif(d.desde,'-infinity'::date),v_dia,d.tipos,
    (SELECT jsonb_object_agg(r.tipo,r.datos) FROM reportes r WHERE r.desde = d.desde AND r.tipo = ANY (d.tipos))
  FROM destinos d;
  RETURN (SELECT count(*)::integer FROM public.respaldos_reportes_envios e WHERE e.respaldo_id = p_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.pendientes_reportes_respaldo(p_clinica bigint)
RETURNS TABLE(id uuid, formato text, creado_en timestamptz, pendientes bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT r.id,r.formato,r.creado_en,count(*)
  FROM public.respaldos_reportes r JOIN public.respaldos_reportes_envios e ON r.id = e.respaldo_id
  WHERE r.clinica_id = p_clinica AND auth.uid() IS NOT NULL AND r.solicitante = auth.uid()
    AND (public.is_superadmin() OR public.get_my_clinica_id() = p_clinica)
    AND r.creado_en > now() - interval '23 hours' AND e.estado = 'pendiente'
  GROUP BY r.id ORDER BY r.creado_en DESC LIMIT 10;
$$;

-- La Edge Function autentica la sesión antes de usar la clave de servicio.
-- Se comprueba que el lote pertenezca a esa sesión y se revalidan los destinatarios.
CREATE OR REPLACE FUNCTION public.lote_reportes_respaldo(p_id uuid,p_solicitante uuid,p_despues uuid DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  r public.respaldos_reportes%ROWTYPE;
  v_empresa boolean;
BEGIN
  SELECT * INTO r FROM public.respaldos_reportes WHERE id = p_id AND solicitante = p_solicitante;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT coalesce(to_jsonb(c)->>'tipo' = 'empresa_medica',false) INTO v_empresa FROM public.clinicas c WHERE c.id = r.clinica_id;
  UPDATE public.respaldos_reportes_envios e SET estado = 'omitido'
    WHERE e.respaldo_id = p_id AND e.estado = 'pendiente' AND (
      r.creado_en <= now() - interval '23 hours' OR NOT EXISTS (
        SELECT 1 FROM public._destinos_reportes_respaldo(r.clinica_id,v_empresa) d
        WHERE d.usuario_id = e.usuario_id AND d.correo = e.correo AND d.periodo = e.periodo
          AND e.tipos <@ d.tipos
      )
    );
  RETURN jsonb_build_object(
    'establecimiento',r.establecimiento,'formato',r.formato,'creado_en',r.creado_en,
    'aceptados',(SELECT count(*) FROM public.respaldos_reportes_envios e WHERE e.respaldo_id = p_id AND e.estado = 'aceptado'),
    'omitidos',(SELECT count(*) FROM public.respaldos_reportes_envios e WHERE e.respaldo_id = p_id AND e.estado = 'omitido'),
    'pendientes',(SELECT count(*) FROM public.respaldos_reportes_envios e WHERE e.respaldo_id = p_id AND e.estado = 'pendiente'),
    'envios',coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.usuario_id) FROM (
      SELECT usuario_id,correo,periodo,desde,hasta,reportes FROM public.respaldos_reportes_envios
      WHERE respaldo_id = p_id AND estado = 'pendiente' AND (p_despues IS NULL OR usuario_id > p_despues)
      ORDER BY usuario_id LIMIT 20
    ) e),'[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.proteger_reportes_respaldo(),
  public._permisos_reportes_respaldo(text,jsonb), public._destinos_reportes_respaldo(bigint,boolean),
  public._datos_reporte_respaldo(text,bigint,date,date,boolean),
  public.lote_reportes_respaldo(uuid,uuid,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.preparar_reportes_respaldo(uuid,bigint,text),public.pendientes_reportes_respaldo(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preparar_reportes_respaldo(uuid,bigint,text),public.pendientes_reportes_respaldo(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lote_reportes_respaldo(uuid,uuid,uuid) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

SELECT to_regprocedure('public.preparar_reportes_respaldo(uuid,bigint,text)') AS funcion_reportes_respaldo;
