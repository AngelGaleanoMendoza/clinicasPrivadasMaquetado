-- Ejecutar después de migracion_importar_excel.sql.
BEGIN;
ALTER TABLE public.libro_diario_cuentas ADD COLUMN IF NOT EXISTS clase text
  CHECK (clase IN ('activo','pasivo','patrimonio','ingreso','costo','gasto'));
ALTER TABLE public.libro_diario ALTER COLUMN lote_id DROP NOT NULL;
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'excel'
  CHECK (origen IN ('excel','asiento','apertura'));
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS solicitud uuid;
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS autor uuid;
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS concepto text;
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS resultado_desde date;
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS resultado_base jsonb;
ALTER TABLE public.libro_diario ADD COLUMN IF NOT EXISTS firma_solicitud text;
CREATE UNIQUE INDEX IF NOT EXISTS libro_contable_solicitud ON public.libro_diario(clinica_id,solicitud);
CREATE UNIQUE INDEX IF NOT EXISTS libro_contable_apertura ON public.libro_diario(clinica_id) WHERE origen='apertura';

-- También protege los asientos que llegan por el importador existente.
CREATE OR REPLACE FUNCTION public._validar_corte_libro() RETURNS trigger
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lumea-importar-excel:' || NEW.clinica_id,0));
  IF NEW.origen='apertura' AND EXISTS (SELECT 1 FROM public.libro_diario a
    WHERE a.clinica_id=NEW.clinica_id AND a.fecha<=NEW.fecha) THEN
    RAISE EXCEPTION 'El libro ya tiene asientos hasta ese corte. Comprueba la fecha para evitar duplicar saldos.';
  ELSIF NEW.origen<>'apertura' AND EXISTS (SELECT 1 FROM public.libro_diario a
    WHERE a.clinica_id=NEW.clinica_id AND a.origen='apertura' AND a.fecha>=NEW.fecha) THEN
    RAISE EXCEPTION 'El movimiento debe tener fecha posterior al cierre de apertura.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_corte_libro ON public.libro_diario;
CREATE TRIGGER validar_corte_libro BEFORE INSERT ON public.libro_diario FOR EACH ROW EXECUTE FUNCTION public._validar_corte_libro();
REVOKE ALL ON FUNCTION public._validar_corte_libro() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.guardar_cuenta_libro(p_clinica bigint,p_codigo text,p_nombre text,p_clase text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF NOT ('contabilidad'=ANY(public.modulos_importacion_excel(p_clinica))) THEN RAISE EXCEPTION 'Se requiere permiso de Contabilidad.'; END IF;
  p_codigo:=public._excel_texto(p_codigo,'El código',80,true);
  p_nombre:=public._excel_texto(p_nombre,'El nombre de cuenta',150,true);
  IF p_clase IS NULL OR p_clase NOT IN ('activo','pasivo','patrimonio','ingreso','costo','gasto') THEN
    RAISE EXCEPTION 'Selecciona la clase de la cuenta %.',p_codigo;
  END IF;
  INSERT INTO public.libro_diario_cuentas AS c(clinica_id,codigo,nombre,clase) VALUES(p_clinica,p_codigo,p_nombre,p_clase)
  ON CONFLICT(clinica_id,codigo) DO UPDATE SET clase=excluded.clase
    WHERE c.nombre=excluded.nombre AND (c.clase IS NULL OR c.clase=excluded.clase);
  IF NOT FOUND THEN RAISE EXCEPTION 'La cuenta % ya tiene otro nombre o clasificación. Revisa el catálogo.',p_codigo; END IF;
END $$;

CREATE OR REPLACE FUNCTION public._lineas_resultado_libro(p_clinica bigint,p_filas jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path='' AS $$
DECLARE r jsonb; cuenta text; resultado jsonb:='[]';
BEGIN
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_filas)>2000 THEN RAISE EXCEPTION 'Formato de resultados inválido.'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
    cuenta:=btrim(r->>'cuenta');
    IF r->>'clase' NOT IN ('ingreso','costo','gasto') OR coalesce(r->>'importe','') !~ '^-?[0-9]{1,14}([.][0-9]{1,2})?$' THEN
      RAISE EXCEPTION 'Revisa las cuentas e importes del estado de resultados de apertura.';
    END IF;
    PERFORM public.guardar_cuenta_libro(p_clinica,cuenta,r->>'nombre_cuenta',r->>'clase');
    IF resultado @> jsonb_build_array(jsonb_build_object('cuenta',cuenta)) THEN RAISE EXCEPTION 'Cuenta repetida en el resultado de apertura: %.',cuenta; END IF;
    resultado:=resultado||jsonb_build_array(jsonb_strip_nulls(jsonb_build_object('cuenta',cuenta,'importe',(r->>'importe')::numeric::text,
      'archivo',left(r->>'archivo',255),'hoja',left(r->>'hoja',128),'fila',r->>'fila')));
  END LOOP;
  RETURN resultado;
END $$;
REVOKE ALL ON FUNCTION public._lineas_resultado_libro(bigint,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.registrar_resultado_cierre(p_clinica bigint,p_apertura bigint,p_desde date,p_filas jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE apertura public.libro_diario%ROWTYPE; filas jsonb;
BEGIN
  IF NOT ('contabilidad'=ANY(public.modulos_importacion_excel(p_clinica))) THEN RAISE EXCEPTION 'Se requiere permiso de Contabilidad.'; END IF;
  SELECT * INTO STRICT apertura FROM public.libro_diario WHERE clinica_id=p_clinica AND id=p_apertura AND origen='apertura' FOR UPDATE;
  IF p_desde IS NULL OR p_desde>apertura.fecha THEN RAISE EXCEPTION 'Revisa el inicio del período.'; END IF;
  filas:=public._lineas_resultado_libro(p_clinica,p_filas);
  IF filas='[]' THEN RAISE EXCEPTION 'Ingresa el detalle del estado de resultados.'; END IF;
  IF apertura.resultado_base<>'[]' THEN
    IF apertura.resultado_base=filas AND apertura.resultado_desde=p_desde THEN RETURN; END IF;
    RAISE EXCEPTION 'El estado de resultados del cierre ya está registrado.';
  END IF;
  UPDATE public.libro_diario SET resultado_base=filas,resultado_desde=p_desde WHERE id=p_apertura AND clinica_id=p_clinica;
END $$;
REVOKE ALL ON FUNCTION public.registrar_resultado_cierre(bigint,bigint,date,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_resultado_cierre(bigint,bigint,date,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.registrar_asiento_libro(p_clinica bigint,p_solicitud uuid,p_origen text,p_fecha date,
  p_documento text,p_concepto text,p_lineas jsonb,p_resultado jsonb DEFAULT '[]',p_desde date DEFAULT NULL)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE
  v_firma text; v_anterior public.libro_diario%ROWTYPE; v_item jsonb; v_cuenta text; v_nombre text;
  v_clase text; v_debe numeric; v_haber numeric; v_total_d numeric:=0; v_total_h numeric:=0;
  v_lineas jsonb:='[]'; v_resultado jsonb; v_resultado_balanza jsonb:='[]'; v_id bigint;
BEGIN
  IF NOT ('contabilidad'=ANY(public.modulos_importacion_excel(p_clinica))) THEN RAISE EXCEPTION 'Se requiere permiso de Contabilidad.'; END IF;
  IF p_solicitud IS NULL OR p_fecha IS NULL OR p_origen IS NULL OR p_origen NOT IN ('apertura','asiento') THEN
    RAISE EXCEPTION 'Faltan la fecha o los datos del asiento.';
  END IF;
  p_documento:=public._excel_texto(p_documento,'El documento',80,true);
  p_concepto:=public._excel_texto(p_concepto,'El concepto',300,true);
  IF jsonb_typeof(p_lineas) IS DISTINCT FROM 'array' OR jsonb_typeof(p_resultado) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Formato de líneas inválido.';
  END IF;
  IF jsonb_array_length(p_lineas) NOT BETWEEN 2 AND 2000 OR jsonb_array_length(p_resultado)>2000 THEN RAISE EXCEPTION 'El asiento requiere de 2 a 2,000 líneas.'; END IF;
  IF jsonb_array_length(p_resultado)>0 AND (p_origen<>'apertura' OR p_desde IS NULL OR p_desde>p_fecha) THEN
    RAISE EXCEPTION 'Indica el inicio del período del estado de resultados de apertura.';
  END IF;
  v_firma:=md5(jsonb_build_array(p_origen,p_fecha,p_documento,p_concepto,p_lineas,p_resultado,p_desde)::text);
  PERFORM pg_advisory_xact_lock(hashtextextended('lumea-importar-excel:'||p_clinica,0));
  SELECT * INTO v_anterior FROM public.libro_diario WHERE clinica_id=p_clinica AND solicitud=p_solicitud;
  IF FOUND THEN
    IF v_anterior.firma_solicitud<>v_firma THEN RAISE EXCEPTION 'La solicitud ya se guardó con otros datos.'; END IF;
    RETURN v_anterior.id;
  END IF;
  IF EXISTS(SELECT 1 FROM public.libro_diario WHERE clinica_id=p_clinica AND fecha=p_fecha AND lower(documento)=lower(p_documento)) THEN
    RAISE EXCEPTION 'Ese documento ya existe en el libro para la fecha seleccionada.';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_lineas) LOOP
    v_cuenta:=btrim(v_item->>'cuenta'); v_nombre:=btrim(v_item->>'nombre_cuenta'); v_clase:=v_item->>'clase';
    PERFORM public.guardar_cuenta_libro(p_clinica,v_cuenta,v_nombre,v_clase);
    IF strpos(v_cuenta,'-')>1 AND nullif(btrim(v_item->>'nombre_grupo'),'') IS NOT NULL THEN
      PERFORM public.guardar_cuenta_libro(p_clinica,split_part(v_cuenta,'-',1),v_item->>'nombre_grupo',v_clase);
    END IF;
    IF coalesce(v_item->>'debe','0') !~ '^[0-9]{1,14}([.][0-9]{1,2})?$' OR coalesce(v_item->>'haber','0') !~ '^[0-9]{1,14}([.][0-9]{1,2})?$' THEN RAISE EXCEPTION 'Importe inválido en la cuenta %.',v_cuenta; END IF;
    v_debe:=coalesce((v_item->>'debe')::numeric,0); v_haber:=coalesce((v_item->>'haber')::numeric,0);
    IF (v_debe>0)=(v_haber>0) THEN RAISE EXCEPTION 'Indica un importe en Debe o Haber por línea.'; END IF;
    IF p_origen='apertura' THEN
      IF EXISTS(SELECT 1 FROM jsonb_array_elements(v_lineas) x WHERE x->>'cuenta'=v_cuenta OR
        starts_with(x->>'cuenta',v_cuenta||'-') OR starts_with(v_cuenta,(x->>'cuenta')||'-')) THEN
        RAISE EXCEPTION 'Registra solo el saldo de detalle de la cuenta %. Revisa las cuentas repetidas o sus subtotales.',v_cuenta;
      END IF;
      IF v_clase IN ('ingreso','costo','gasto') THEN
        v_resultado_balanza:=v_resultado_balanza||jsonb_build_array(jsonb_build_object('cuenta',v_cuenta,
          'importe',(CASE WHEN v_clase='ingreso' THEN v_haber-v_debe ELSE v_debe-v_haber END)::text));
      END IF;
    END IF;
    v_total_d:=v_total_d+v_debe; v_total_h:=v_total_h+v_haber;
    v_lineas:=v_lineas||jsonb_build_array(jsonb_build_object('cuenta',v_cuenta,'nombre_cuenta',v_nombre,'debe',v_debe::text,'haber',v_haber::text,
      'descripcion',p_concepto,'referencia',CASE WHEN v_item->>'archivo' IS NULL THEN p_documento ELSE
        concat_ws(' · ',left(v_item->>'archivo',255),left(v_item->>'hoja',128),'fila '||left(v_item->>'fila',6)) END));
  END LOOP;
  IF v_total_d<>v_total_h THEN RAISE EXCEPTION 'Asiento descuadrado. Debe %, Haber %.',v_total_d,v_total_h; END IF;
  IF (SELECT count(DISTINCT l->>'cuenta') FROM jsonb_array_elements(v_lineas) l)<2 THEN RAISE EXCEPTION 'Elige al menos dos cuentas diferentes.'; END IF;
  v_resultado:=public._lineas_resultado_libro(p_clinica,p_resultado);
  IF v_resultado_balanza<>'[]' THEN
    IF p_desde IS NULL OR p_desde>p_fecha THEN RAISE EXCEPTION 'Indica el inicio del período de las cuentas de resultados de la balanza.'; END IF;
    IF v_resultado<>'[]' AND EXISTS(
      SELECT 1 FROM jsonb_to_recordset(v_resultado_balanza) b(cuenta text,importe numeric)
      FULL JOIN jsonb_to_recordset(v_resultado) r(cuenta text,importe numeric) USING(cuenta)
      WHERE coalesce(b.importe,0)<>coalesce(r.importe,0)) THEN
      RAISE EXCEPTION 'El estado de resultados difiere de las cuentas de apertura en la balanza.';
    END IF;
    IF v_resultado='[]' THEN v_resultado:=v_resultado_balanza; END IF;
  END IF;
  INSERT INTO public.libro_diario(clinica_id,fecha,documento,concepto,lineas,debe,haber,origen,solicitud,autor,firma_solicitud,resultado_base,resultado_desde)
  VALUES(p_clinica,p_fecha,p_documento,p_concepto,v_lineas,v_total_d,v_total_h,p_origen,p_solicitud,auth.uid(),v_firma,v_resultado,p_desde) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Importes en texto para conservar centavos al leerlos en el navegador.
CREATE OR REPLACE FUNCTION public.reporte_libro_contable(p_clinica bigint,p_desde date,p_hasta date)
RETURNS jsonb LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  WITH apertura AS (SELECT fecha,resultado_desde,resultado_base FROM public.libro_diario
    WHERE clinica_id=p_clinica AND origen='apertura' AND fecha<=p_hasta),
  sumas AS (SELECT l.cuenta,
    sum(l.debe-l.haber) FILTER (WHERE a.fecha<p_desde OR a.origen='apertura') AS inicial,
    sum(l.debe) FILTER (WHERE a.fecha>=p_desde AND a.origen<>'apertura') AS debe,
    sum(l.haber) FILTER (WHERE a.fecha>=p_desde AND a.origen<>'apertura') AS haber,
    sum(l.debe-l.haber) AS final
    FROM public.libro_diario a CROSS JOIN LATERAL jsonb_to_recordset(a.lineas) l(cuenta text,debe numeric,haber numeric)
    WHERE a.clinica_id=p_clinica AND a.fecha<=p_hasta GROUP BY l.cuenta)
  SELECT jsonb_build_object('apertura',(SELECT to_jsonb(apertura) FROM apertura),'cuentas',coalesce((
    SELECT jsonb_agg(jsonb_build_object('codigo',c.codigo,'nombre',c.nombre,'clase',c.clase,
      'inicial',coalesce(s.inicial,0)::text,'debe',coalesce(s.debe,0)::text,'haber',coalesce(s.haber,0)::text,
      'saldo',coalesce(s.final,0)::text,'usada',s.cuenta IS NOT NULL) ORDER BY c.codigo)
    FROM public.libro_diario_cuentas c LEFT JOIN sumas s ON s.cuenta=c.codigo WHERE c.clinica_id=p_clinica),'[]'::jsonb))
$$;
REVOKE ALL ON FUNCTION public.registrar_asiento_libro(bigint,uuid,text,date,text,text,jsonb,jsonb,date),
  public.guardar_cuenta_libro(bigint,text,text,text),public.reporte_libro_contable(bigint,date,date) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.registrar_asiento_libro(bigint,uuid,text,date,text,text,jsonb,jsonb,date),
  public.guardar_cuenta_libro(bigint,text,text,text),public.reporte_libro_contable(bigint,date,date) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT to_regprocedure('public.registrar_asiento_libro(bigint,uuid,text,date,text,text,jsonb,jsonb,date)') IS NOT NULL AS libro_contable_listo;
