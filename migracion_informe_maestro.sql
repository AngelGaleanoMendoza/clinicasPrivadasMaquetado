-- Ejecutar completa después de migracion_importar_excel.sql y migracion_libro_contable.sql.
BEGIN;

CREATE TABLE IF NOT EXISTS public.controles_inventario (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinica_id bigint NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  fecha date NOT NULL, bodega text NOT NULL, modo text NOT NULL CHECK (modo IN ('apertura','cierre')),
  firma text NOT NULL, filas jsonb NOT NULL, vigente boolean NOT NULL DEFAULT true,
  creado_por uuid NOT NULL, creado_en timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS control_vigente_por_corte ON public.controles_inventario
  (clinica_id, fecha, lower(bodega), modo) WHERE vigente;
CREATE UNIQUE INDEX IF NOT EXISTS control_apertura_por_bodega ON public.controles_inventario
  (clinica_id, lower(bodega)) WHERE modo='apertura' AND vigente;
CREATE TABLE IF NOT EXISTS public.cierres_maestro (
  clinica_id bigint NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  mes date NOT NULL, fuentes jsonb NOT NULL, aprobado_por uuid NOT NULL,
  aprobado_en timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (clinica_id, mes)
);
ALTER TABLE public.controles_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_maestro ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS controles_inventario_lectura ON public.controles_inventario;
CREATE POLICY controles_inventario_lectura ON public.controles_inventario FOR SELECT TO authenticated
  USING ('inventario'=ANY(public.modulos_importacion_excel(clinica_id)));
DROP POLICY IF EXISTS cierres_maestro_lectura ON public.cierres_maestro;
CREATE POLICY cierres_maestro_lectura ON public.cierres_maestro FOR SELECT TO authenticated
  USING (ARRAY['inventario','contabilidad'] <@ public.modulos_importacion_excel(clinica_id));
REVOKE ALL ON public.controles_inventario,public.cierres_maestro FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.controles_inventario,public.cierres_maestro TO authenticated;

CREATE OR REPLACE FUNCTION public._acceso_maestro(p_clinica bigint,contable boolean)
RETURNS void LANGUAGE plpgsql STABLE SET search_path='' AS $$
BEGIN
  IF NOT (ARRAY['inventario'] || CASE WHEN contable THEN ARRAY['contabilidad'] ELSE ARRAY[]::text[] END
      <@ public.modulos_importacion_excel(p_clinica))
    OR NOT EXISTS (SELECT FROM public.clinicas WHERE id=p_clinica AND tipo='empresa_medica') THEN
    RAISE EXCEPTION 'Se requieren los permisos de la empresa para esta operación.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.importar_control_inventario(p_clinica bigint,p_fecha date,p_bodega text,p_modo text,
  p_filas jsonb,p_confirmar boolean,p_revision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
<<carga>>
DECLARE
  f jsonb; d jsonb; lin jsonb; plan jsonb:='[]'; guardadas jsonb:='[]'; resultados jsonb;
  partidas jsonb:='[]'; grupo record; firma_anterior text;
  origen jsonb; antiguo jsonb; origenes jsonb; libre numeric; cantidad_origen numeric;
  fuente public.controles_inventario%ROWTYPE; prod public.inventario%ROWTYPE;
  nombre text; codigo text; unidad text; cat text; archivo text; hoja text; num int; k text;
  ini numeric; ent numeric; sal numeric; actual numeric; costo numeric; valor numeric; precio numeric; compra numeric;
  producto_id bigint; n int; stock_corte numeric; mov_id bigint; accion text;
  fuente_id uuid; firma text; revision text; repetida boolean; cambio boolean; resumen jsonb;
  vieja jsonb; previos numeric; calculado numeric; pendientes bigint; cantidad_bodegas numeric; mejora boolean:=false;
  porcentaje numeric; margen numeric; lote_fisico bigint; cubierto numeric; esperado numeric; guardado numeric;
BEGIN
  PERFORM public._acceso_maestro(p_clinica,false);
  p_bodega:=public._excel_texto(p_bodega,'La bodega',100,true);
  IF p_modo IS NULL OR p_modo NOT IN ('apertura','cierre') OR p_fecha IS NULL OR p_confirmar IS NULL THEN
    RAISE EXCEPTION 'Indica la modalidad, fecha y bodega del control.';
  END IF;
  IF p_modo='cierre' AND extract(day FROM p_fecha+1)<>1 THEN RAISE EXCEPTION 'Usa el último día del mes para el conteo de cierre.'; END IF;
  IF p_modo='apertura' AND extract(day FROM p_fecha)<>1 AND extract(day FROM p_fecha+1)<>1 THEN
    RAISE EXCEPTION 'La apertura mensual requiere el saldo al primer día del mes o al último día del mes anterior.'; END IF;
  IF jsonb_typeof(p_filas) IS DISTINCT FROM 'array' OR jsonb_array_length(p_filas) NOT BETWEEN 1 AND 1000 THEN
    RAISE EXCEPTION 'Selecciona entre 1 y 1,000 filas del control.'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('lumea-importar-excel:'||p_clinica,0));
  SELECT * INTO fuente FROM public.controles_inventario WHERE clinica_id=p_clinica AND fecha=p_fecha
    AND lower(bodega)=lower(p_bodega) AND modo=p_modo AND vigente;
  -- La huella de datos es independiente del orden de filas y nombre de archivo.
  WITH valores AS (SELECT x->>'hoja' hoja,(x->'datos')-'fecha_actualizacion' datos FROM jsonb_array_elements(p_filas) x),
  huellas AS (SELECT jsonb_build_array(v.hoja,v.datos) actual, v.datos-ARRAY['fecha_origen','observaciones','bonificacion'] anterior FROM valores v)
  SELECT 'v2:'||md5(jsonb_agg(h.actual ORDER BY h.actual::text)::text),md5(jsonb_agg(anterior ORDER BY anterior::text)::text)
    INTO firma,firma_anterior FROM huellas h;
  repetida:=fuente.id IS NOT NULL AND fuente.firma IN (firma,firma_anterior);
  IF NOT repetida AND EXISTS (SELECT FROM public.cierres_maestro WHERE clinica_id=p_clinica
      AND mes+interval '1 month'>p_fecha) THEN RAISE EXCEPTION 'Ya existe un cierre aprobado que incluye este corte.'; END IF;
  IF NOT repetida AND p_modo='apertura' AND EXISTS (SELECT FROM public.controles_inventario WHERE clinica_id=p_clinica
        AND lower(bodega)=lower(p_bodega) AND modo='apertura' AND fecha<>p_fecha AND vigente) THEN RAISE EXCEPTION 'La apertura de esa bodega ya se registró. Usa un conteo de cierre.'; END IF;
  IF NOT repetida THEN
    FOR f IN SELECT value FROM jsonb_array_elements(p_filas) LOOP
      d:=f->'datos';
      archivo:=public._excel_texto(f->>'archivo','El archivo',500,true); hoja:=public._excel_texto(f->>'hoja','La hoja',128,true);
      num:=(f->>'fila')::integer;
      IF num IS NULL OR num NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'Número de fila inválido.'; END IF;
      IF regexp_replace(archivo,'^.*/','') ~* '^([0-9]+[ ._-]+)?(iva|retenciones|anticipo[ _-]+ir)[ ._-]' THEN
        RAISE EXCEPTION 'La plantilla fiscal corresponde al expediente de respaldos.'; END IF;
      nombre:=public._excel_texto(d->>'nombre','El artículo',150,true); codigo:=public._excel_texto(d->>'sku','El código',100);
      unidad:=lower(public._excel_texto(d->>'unidad','La unidad',60,true));
      cat:=coalesce(public._excel_texto(d->>'categoria','La categoría',80),'general');
      ini:=public._excel_numero(d->>'inicial','Existencia inicial',3); ent:=coalesce(public._excel_numero(d->>'entradas','Entradas',3),0);
      sal:=coalesce(public._excel_numero(d->>'salidas','Salidas',3),0); actual:=public._excel_numero(d->>'actual','Existencia actual',3);
      IF ini IS NULL OR actual IS NULL OR ini+ent-sal<>actual THEN RAISE EXCEPTION '% · fila %: la existencia inicial más entradas menos salidas difiere de la actual.',hoja,num; END IF;
      costo:=public._excel_numero(d->>'costo','Costo unitario',4); valor:=public._excel_numero(d->>'costo_total','Valor total',2);
      precio:=public._excel_numero(d->>'precio','Precio de venta',2); compra:=public._excel_numero(d->>'precio_compra','Precio de compra',4);
      porcentaje:=public._excel_numero(regexp_replace(d->>'ganancia_pct','^-',''),'Porcentaje declarado',6)*CASE WHEN d->>'ganancia_pct' LIKE '-%' THEN -1 ELSE 1 END;
      margen:=public._excel_numero(regexp_replace(d->>'margen_ganancia','^-',''),'Margen declarado',2)*CASE WHEN d->>'margen_ganancia' LIKE '-%' THEN -1 ELSE 1 END;
      IF costo IS NULL AND valor=0 AND actual>0 THEN valor:=NULL; END IF;
      IF costo IS NULL AND actual>0 AND valor IS NOT NULL THEN costo:=round(valor/actual,4); END IF;
      IF valor IS NOT NULL AND valor<>round(actual*coalesce(costo,0),2) THEN RAISE EXCEPTION '% · fila %: el costo y el valor declarado difieren.',hoja,num; END IF;
      valor:=coalesce(valor,CASE WHEN actual=0 THEN 0 ELSE round(actual*costo,2) END);
      partidas:=partidas||jsonb_build_array(jsonb_build_object(
        'archivo',archivo,'hoja',hoja,'fila',num,'sku',codigo,'nombre',nombre,'categoria',cat,'unidad',unidad,
        'fecha_actualizacion',public._excel_fecha(d->>'fecha_actualizacion','Fecha de actualización del archivo',false),
        'fecha_origen',public._excel_fecha(d->>'fecha_origen','Fecha de la fila',false),
        'observaciones',public._excel_texto(d->>'observaciones','Las observaciones',500),
        'bonificacion',coalesce((d->>'bonificacion')::boolean,false),
        'inicial',ini,'entradas',ent,'salidas',sal,'actual',actual,'costo',costo,'costo_total',valor::text,
        'precio_compra',compra,'precio',precio,'ganancia_pct',porcentaje,'margen_ganancia',margen));
    END LOOP;
    IF EXISTS (SELECT FROM jsonb_array_elements(partidas) x GROUP BY x->>'archivo',x->>'hoja',x->>'fila' HAVING count(*)>1) THEN
      RAISE EXCEPTION 'La misma fila de origen aparece dos veces. Selecciona una sola copia del control.'; END IF;
    -- En una bodega, una ficha tiene una presentación. Una fila de bonificación conserva su hoja y su costo.
    FOR grupo IN
      SELECT jsonb_agg(x ORDER BY ord) filas, count(*) n,
        count(DISTINCT jsonb_build_array(x->'archivo',lower(x->>'sku'),lower(x->>'categoria'))) identidades,
        sum((x->>'inicial')::numeric) inicial, sum((x->>'entradas')::numeric) entradas,
        sum((x->>'salidas')::numeric) salidas, sum((x->>'actual')::numeric) existencia,
        CASE WHEN bool_and(x->>'costo_total' IS NOT NULL) THEN sum((x->>'costo_total')::numeric) END importe,
        CASE WHEN count(DISTINCT x->'costo')=1 THEN min((x->>'costo')::numeric)
          WHEN bool_and((x->>'actual')::numeric=0 OR x->>'costo' IS NOT NULL)
          THEN round(sum((x->>'actual')::numeric*(x->>'costo')::numeric)/nullif(sum((x->>'actual')::numeric),0),4) END promedio
      FROM jsonb_array_elements(partidas) WITH ORDINALITY AS t(x,ord)
      GROUP BY lower(x->>'nombre'),x->>'unidad' ORDER BY min(ord)
    LOOP
      lin:=grupo.filas->0;
      nombre:=lin->>'nombre'; unidad:=lin->>'unidad'; codigo:=lin->>'sku';
      hoja:=lin->>'hoja'; num:=(lin->>'fila')::integer;
      IF grupo.n>1 THEN
        IF grupo.identidades>1 THEN RAISE EXCEPTION '% · %: hay varias filas para % en % con distinto archivo, código o categoría. Revisa sus presentaciones.',hoja,num,nombre,unidad; END IF;
        lin:=lin||jsonb_build_object('origenes',grupo.filas,'inicial',grupo.inicial,'entradas',grupo.entradas,
          'salidas',grupo.salidas,'actual',grupo.existencia,'costo',grupo.promedio,'costo_total',grupo.importe::text);
        -- Un precio o margen distinto por partida sólo se muestra en el detalle de origen.
        FOREACH k IN ARRAY ARRAY['precio','precio_compra','ganancia_pct','margen_ganancia'] LOOP
          IF EXISTS (SELECT FROM jsonb_array_elements(grupo.filas) x WHERE x->k IS DISTINCT FROM lin->k) THEN
            lin:=jsonb_set(lin,ARRAY[k],'null');
          END IF;
        END LOOP;
      END IF;
      ini:=grupo.inicial; ent:=grupo.entradas; sal:=grupo.salidas; actual:=grupo.existencia; costo:=(lin->>'costo')::numeric;
      SELECT count(*),min(i.id) INTO n,producto_id FROM public.inventario i WHERE i.clinica_id=p_clinica AND
        ((lower(btrim(i.nombre))=lower(carga.nombre) AND lower(btrim(i.unidad))=carga.unidad)
          OR (codigo IS NOT NULL AND lower(btrim(i.sku))=lower(codigo)));
      IF n>1 THEN RAISE EXCEPTION '% · fila %: el nombre o código identifica más de un producto.',hoja,num; END IF;
      accion:='documental'; vieja:=NULL; stock_corte:=NULL;
      IF producto_id IS NOT NULL THEN
        SELECT * INTO STRICT prod FROM public.inventario WHERE clinica_id=p_clinica AND id=producto_id FOR UPDATE;
        IF (codigo IS NOT NULL AND prod.sku IS NOT NULL AND lower(btrim(prod.sku))<>lower(codigo)) OR
           lower(btrim(prod.unidad)) IS DISTINCT FROM unidad THEN RAISE EXCEPTION '% · fila %: código o unidad incompatible con el catálogo.',hoja,num; END IF;
      END IF;
      IF p_modo='apertura' THEN
        IF producto_id IS NULL THEN accion:='alta';
        ELSE
          SELECT coalesce(prod.stock_actual,0)-coalesce(sum(CASE WHEN m.tipo='entrada' THEN m.cantidad ELSE -m.cantidad END)
            FILTER (WHERE m.fecha>p_fecha OR (m.fecha=p_fecha AND extract(day FROM p_fecha)=1
              AND coalesce(m.motivo,'') NOT IN ('Existencia inicial','Excel · Existencia inicial')
              AND coalesce(m.motivo,'') NOT LIKE 'Excel · Apertura de inventario · %')),0) INTO stock_corte FROM public.inventario_movimientos m
            WHERE m.clinica_id=p_clinica AND m.inventario_id=producto_id;
          IF fuente.id IS NOT NULL THEN
            SELECT x INTO vieja FROM jsonb_array_elements(fuente.filas) x WHERE (x->>'inventario_id')::bigint=producto_id;
            IF vieja IS NULL OR vieja->>'sku' IS DISTINCT FROM codigo OR vieja->>'nombre'<>nombre OR vieja->>'unidad'<>unidad OR
              (vieja->>'actual')::numeric<>actual OR (vieja->>'inicial')::numeric<>ini OR (vieja->>'entradas')::numeric<>ent OR (vieja->>'salidas')::numeric<>sal
              OR (vieja->>'costo' IS NOT NULL AND (vieja->>'costo')::numeric IS DISTINCT FROM costo) THEN
              RAISE EXCEPTION 'La cantidad o identidad de % cambió. La apertura admite completar costos pendientes en las mismas filas.',nombre;
            END IF;
            IF vieja ? 'origenes' OR lin ? 'origenes' THEN
              IF jsonb_array_length(coalesce(vieja->'origenes','[]'))<>grupo.n THEN
                RAISE EXCEPTION 'Las filas de origen de % cambiaron. Conserva sus hojas y cantidades al completar costos.',nombre;
              END IF;
              origenes:='[]';
              FOR origen IN SELECT value FROM jsonb_array_elements(grupo.filas) LOOP
                SELECT x INTO antiguo FROM jsonb_array_elements(vieja->'origenes') x
                  WHERE x->>'hoja'=origen->>'hoja' AND x->'fila'=origen->'fila';
                IF antiguo IS NULL OR jsonb_build_array(antiguo->'inicial',antiguo->'entradas',antiguo->'salidas',antiguo->'actual',antiguo->'bonificacion')
                  <>jsonb_build_array(origen->'inicial',origen->'entradas',origen->'salidas',origen->'actual',origen->'bonificacion')
                  OR (antiguo->>'costo' IS NOT NULL AND antiguo->'costo' IS DISTINCT FROM origen->'costo') THEN
                  RAISE EXCEPTION 'Conserva las partidas y los costos ya registrados de % en % · fila %.',nombre,origen->>'hoja',origen->>'fila';
                END IF;
                mejora:=mejora OR (antiguo->>'costo' IS NULL AND origen->>'costo' IS NOT NULL);
                origenes:=origenes||jsonb_build_array(origen||jsonb_build_object('lote_fisico_id',antiguo->'lote_fisico_id'));
              END LOOP;
              lin:=jsonb_set(lin,'{origenes}',origenes);
            END IF;
            mejora:=mejora OR (vieja->>'costo' IS NULL AND costo IS NOT NULL);
            accion:='completar';
          ELSIF EXISTS (SELECT FROM public.controles_inventario c CROSS JOIN LATERAL jsonb_array_elements(c.filas) x
            WHERE c.clinica_id=p_clinica AND c.modo='apertura' AND c.vigente AND (x->>'inventario_id')::bigint=producto_id) THEN
            SELECT sum((x->>'actual')::numeric) INTO previos FROM public.controles_inventario c
              CROSS JOIN LATERAL jsonb_array_elements(c.filas) x
              WHERE c.clinica_id=p_clinica AND c.modo='apertura' AND c.fecha=p_fecha AND c.vigente AND (x->>'inventario_id')::bigint=producto_id;
            IF previos IS DISTINCT FROM prod.stock_actual OR EXISTS (
              SELECT FROM public.inventario_movimientos m WHERE m.clinica_id=p_clinica AND m.inventario_id=producto_id AND m.fecha>p_fecha)
              THEN RAISE EXCEPTION 'Para agregar otra bodega, revisa los movimientos y el corte ya registrado de %.',nombre; END IF;
            accion:='ampliar';
          ELSIF stock_corte=actual THEN accion:='vincular';
          ELSIF prod.stock_actual=0 AND NOT EXISTS (SELECT FROM public.inventario_movimientos WHERE clinica_id=p_clinica AND inventario_id=producto_id) THEN accion:='inicializar';
          ELSE RAISE EXCEPTION '% · fila %: ya existe inventario con % unidades al corte; revisa el saldo declarado %.',hoja,num,stock_corte,actual;
          END IF;
        END IF;
      ELSIF producto_id IS NULL THEN accion:='alta_catalogo';
      END IF;
      lin:=lin||jsonb_build_object('inventario_id',producto_id,'accion',accion,
        'movimiento_inicial_id',vieja->'movimiento_inicial_id','lote_fisico_id',vieja->'lote_fisico_id','existencia_previa',stock_corte);
      plan:=plan||jsonb_build_array(lin);
    END LOOP;
    IF p_modo='apertura' AND fuente.id IS NOT NULL AND (NOT mejora OR jsonb_array_length(fuente.filas)<>jsonb_array_length(plan)
      OR EXISTS (SELECT FROM jsonb_array_elements(plan) x WHERE x->>'accion'<>'completar')) THEN
      RAISE EXCEPTION 'La apertura ya se aplicó. Para completar costos pendientes conserva todos los artículos y cantidades de ese corte.'; END IF;
    IF EXISTS (SELECT FROM jsonb_array_elements(plan) x WHERE x->>'sku' IS NOT NULL GROUP BY lower(x->>'sku') HAVING count(*)>1)
       OR EXISTS (SELECT FROM jsonb_array_elements(plan) x WHERE x->>'inventario_id' IS NOT NULL GROUP BY x->>'inventario_id' HAVING count(*)>1) THEN
      RAISE EXCEPTION 'Dos presentaciones comparten el mismo código o apuntan a la misma ficha. Comprueba los códigos del archivo.';
    END IF;
  ELSE plan:=fuente.filas;
  END IF;
  revision:=md5(jsonb_build_array(p_clinica,p_fecha,lower(p_bodega),p_modo,fuente.id,plan)::text);
  cambio:=p_confirmar AND NOT repetida AND p_revision IS DISTINCT FROM revision;
  fuente_id:=fuente.id;
  IF p_confirmar AND NOT cambio AND NOT repetida THEN
    FOR lin IN SELECT value FROM jsonb_array_elements(plan) LOOP
      producto_id:=(lin->>'inventario_id')::bigint; mov_id:=(lin->>'movimiento_inicial_id')::bigint; actual:=(lin->>'actual')::numeric;
      esperado:=NULL;
      IF lin->>'accion' IN ('alta','alta_catalogo') THEN
        esperado:=CASE WHEN p_modo='apertura' THEN actual ELSE 0 END;
        INSERT INTO public.inventario(clinica_id,sku,nombre,unidad,categoria,stock_minimo,stock_actual,costo_unitario,precio_unitario)
        VALUES(p_clinica,lin->>'sku',lin->>'nombre',lin->>'unidad',lin->>'categoria',0,
          esperado,CASE WHEN p_modo='apertura' THEN (lin->>'costo')::numeric END,(lin->>'precio')::numeric) RETURNING id,stock_actual INTO producto_id,guardado;
      ELSIF lin->>'accion'='inicializar' THEN
        esperado:=actual;
        UPDATE public.inventario SET stock_actual=actual,costo_unitario=(lin->>'costo')::numeric,
          precio_unitario=coalesce((lin->>'precio')::numeric,precio_unitario),sku=coalesce(sku,lin->>'sku')
          WHERE clinica_id=p_clinica AND id=producto_id RETURNING stock_actual INTO guardado;
      ELSIF lin->>'accion'='vincular' THEN
        UPDATE public.inventario i SET sku=coalesce(nullif(btrim(i.sku),''),lin->>'sku'),
          precio_unitario=coalesce(i.precio_unitario,(lin->>'precio')::numeric),
          costo_unitario=CASE WHEN i.costo_unitario IS NULL AND NOT EXISTS
            (SELECT FROM public.inventario_movimientos m WHERE m.clinica_id=p_clinica AND m.inventario_id=i.id AND m.fecha>p_fecha)
            THEN (lin->>'costo')::numeric ELSE i.costo_unitario END
          WHERE i.clinica_id=p_clinica AND i.id=producto_id;
      ELSIF lin->>'accion' IN ('completar','ampliar') THEN
        SELECT coalesce(sum((x->>'actual')::numeric),0),coalesce(sum((x->>'costo_total')::numeric),0),
          count(*) FILTER (WHERE (x->>'actual')::numeric>0 AND x->>'costo_total' IS NULL)
          INTO cantidad_bodegas,calculado,pendientes
          FROM public.controles_inventario c CROSS JOIN LATERAL jsonb_array_elements(c.filas) x
          WHERE c.clinica_id=p_clinica AND c.vigente AND c.fecha=p_fecha AND c.modo='apertura' AND c.id IS DISTINCT FROM fuente.id
            AND (x->>'inventario_id')::bigint=producto_id;
        IF lin->>'accion'='ampliar' THEN
          SELECT i.stock_actual+actual INTO esperado FROM public.inventario i WHERE i.id=producto_id;
          UPDATE public.inventario SET stock_actual=esperado WHERE clinica_id=p_clinica AND id=producto_id RETURNING stock_actual INTO guardado;
        END IF;
        -- Un costo faltante en el origen se puede completar sin valorar retroactivamente ventas ni alterar unidades.
        IF lin->>'accion'='completar' AND mov_id IS NOT NULL THEN UPDATE public.inventario_movimientos SET
          costo_unitario=(lin->>'costo')::numeric,valor_costo=(lin->>'costo_total')::numeric
          WHERE clinica_id=p_clinica AND inventario_id=producto_id AND id=mov_id AND costo_unitario IS NULL; END IF;
        IF NOT EXISTS (SELECT FROM public.inventario_movimientos WHERE clinica_id=p_clinica AND inventario_id=producto_id AND fecha>=p_fecha
            AND motivo NOT LIKE 'Excel · Apertura de inventario · %') AND cantidad_bodegas+actual>0 THEN
          UPDATE public.inventario SET costo_unitario=CASE WHEN pendientes=0 AND (actual=0 OR lin->>'costo_total' IS NOT NULL)
                THEN round((calculado+coalesce((lin->>'costo_total')::numeric,0))/(cantidad_bodegas+actual),4) END
            WHERE clinica_id=p_clinica AND id=producto_id;
        END IF;
      END IF;
      IF esperado IS NOT NULL AND guardado IS DISTINCT FROM esperado THEN RAISE EXCEPTION 'El stock de % no conserva la precisión del archivo.',lin->>'nombre'; END IF;
      IF actual>0 AND lin->>'accion' IN ('alta','inicializar','ampliar') THEN
        INSERT INTO public.inventario_movimientos(clinica_id,inventario_id,fecha,tipo,cantidad,motivo,costo_unitario,valor_costo,costo_importado)
        VALUES(p_clinica,producto_id,p_fecha,'entrada',actual,'Excel · Apertura de inventario · '||p_bodega,
          (lin->>'costo')::numeric,(lin->>'costo_total')::numeric,true) RETURNING id,cantidad INTO mov_id,guardado;
        IF guardado IS DISTINCT FROM actual THEN RAISE EXCEPTION 'El movimiento de apertura pierde precisión para %.',lin->>'nombre'; END IF;
      END IF;
      lote_fisico:=(lin->>'lote_fisico_id')::bigint;
      IF p_modo='apertura' AND actual>0 AND lote_fisico IS NULL AND
          NOT EXISTS (SELECT FROM public.inventario_movimientos WHERE clinica_id=p_clinica AND inventario_id=producto_id AND fecha>=p_fecha AND tipo='salida') THEN
        SELECT coalesce(sum(l.cantidad_disponible),0) INTO cubierto FROM public.inventario_lotes l
          WHERE l.clinica_id=p_clinica AND l.inventario_id=producto_id;
        SELECT i.stock_actual-cubierto INTO libre FROM public.inventario i WHERE i.id=producto_id;
        origenes:='[]';
        FOR origen IN SELECT value FROM jsonb_array_elements(coalesce(lin->'origenes',jsonb_build_array(lin))) LOOP
          lote_fisico:=(origen->>'lote_fisico_id')::bigint; cantidad_origen:=(origen->>'actual')::numeric;
          IF lote_fisico IS NULL AND origen->>'costo' IS NOT NULL AND cantidad_origen>0 AND cantidad_origen<=libre THEN
            INSERT INTO public.inventario_lotes(clinica_id,inventario_id,lote,fecha_ingreso,cantidad_inicial,cantidad_disponible,costo_unitario)
              VALUES(p_clinica,producto_id,'Apertura · '||p_bodega||
                CASE WHEN lin ? 'origenes' THEN ' · '||(origen->>'hoja')||' · fila '||(origen->>'fila') ELSE '' END,
                p_fecha,cantidad_origen,cantidad_origen,(origen->>'costo')::numeric) RETURNING id INTO lote_fisico;
            libre:=libre-cantidad_origen;
          END IF;
          IF lin ? 'origenes' THEN origenes:=origenes||jsonb_build_array(origen||jsonb_build_object('lote_fisico_id',lote_fisico)); END IF;
        END LOOP;
        IF lin ? 'origenes' THEN lin:=jsonb_set(lin,'{origenes}',origenes); lote_fisico:=NULL; END IF;
      END IF;
      guardadas:=guardadas||jsonb_build_array(lin||jsonb_build_object('inventario_id',producto_id,'movimiento_inicial_id',mov_id,'lote_fisico_id',lote_fisico));
    END LOOP;
    UPDATE public.controles_inventario SET vigente=false WHERE id=fuente.id;
    INSERT INTO public.controles_inventario(clinica_id,fecha,bodega,modo,firma,filas,creado_por)
      VALUES(p_clinica,p_fecha,p_bodega,p_modo,firma,guardadas,auth.uid()) RETURNING id INTO fuente_id;
  END IF;
  SELECT jsonb_build_object('nuevas',CASE WHEN repetida THEN 0 ELSE count(*) END,'duplicadas',CASE WHEN repetida THEN count(*) ELSE 0 END,
      'errores',0,'productos_sin_costo',count(*) FILTER(WHERE (x->>'actual')::numeric>0 AND x->>'costo_total' IS NULL))
    INTO resumen FROM jsonb_array_elements(plan) x;
  SELECT resumen||jsonb_build_object('filas_origen',count(*),'filas_bonificacion',count(*) FILTER(WHERE (o->>'bonificacion')::boolean),
      'valor_conocido',coalesce(sum((o->>'costo_total')::numeric),0),
      'valor_bonificacion',coalesce(sum((o->>'costo_total')::numeric) FILTER(WHERE (o->>'bonificacion')::boolean),0)),
    jsonb_agg(jsonb_build_object('archivo',o->>'archivo','hoja',o->>'hoja','fila',o->'fila','nombre',o->>'nombre',
      'bonificacion',coalesce((o->>'bonificacion')::boolean,false),'estado',
      CASE WHEN repetida THEN 'duplicada' WHEN p_confirmar AND NOT cambio THEN 'guardada' ELSE 'lista' END,
      'detalle',CASE WHEN repetida THEN 'Conteo ya registrado' WHEN fuente.id IS NOT NULL THEN 'Sustituye el conteo previo de esta bodega'
        ELSE CASE x->>'accion' WHEN 'alta' THEN 'Alta con existencia inicial' WHEN 'vincular' THEN 'Existencia previa vinculada'
        WHEN 'inicializar' THEN 'Inicializa la ficha existente' WHEN 'alta_catalogo' THEN 'Alta de ficha y conteo documental'
        ELSE 'Conteo documental' END END) ORDER BY ficha_ord,origen_ord)
    INTO resumen,resultados FROM jsonb_array_elements(plan) WITH ORDINALITY AS fichas(x,ficha_ord)
    CROSS JOIN LATERAL jsonb_array_elements(coalesce(x->'origenes',jsonb_build_array(x))) WITH ORDINALITY AS origen(o,origen_ord);
  RETURN jsonb_build_object('revision',revision,'cambio',cambio,'lote',CASE WHEN p_confirmar AND NOT cambio THEN fuente_id END,'resumen',resumen,'filas',resultados);
END $$;

-- Una sola lectura consistente y completa del establecimiento; no depende de los
-- límites de paginación del cliente ni de un precio actual para reconstruir costos.
CREATE OR REPLACE FUNCTION public.datos_informe_maestro(p_clinica bigint,p_mes date)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE fin date; fuente jsonb; publicado public.cierres_maestro%ROWTYPE;
BEGIN
  PERFORM public._acceso_maestro(p_clinica,true);
  IF p_mes IS NULL OR extract(day FROM p_mes)<>1 THEN RAISE EXCEPTION 'Indica el primer día del mes.'; END IF;
  fin:=(p_mes+interval '1 month')::date-1;
  SELECT * INTO publicado FROM public.cierres_maestro WHERE clinica_id=p_clinica AND mes=p_mes;
  IF FOUND THEN RETURN publicado.fuentes||jsonb_build_object('aprobado',true,'aprobado_en',publicado.aprobado_en,'aprobado_por',publicado.aprobado_por); END IF;
  WITH anterior AS (
    SELECT fuentes FROM public.cierres_maestro WHERE clinica_id=p_clinica AND mes=(p_mes-interval '1 month')::date
  ), controles AS (
    SELECT x||jsonb_build_object('bodega',c.bodega,'fecha',c.fecha,'modo',c.modo,'control_id',c.id) f
    FROM public.controles_inventario c CROSS JOIN LATERAL jsonb_array_elements(c.filas) x
    WHERE c.clinica_id=p_clinica AND c.vigente AND c.fecha IN (p_mes-1,p_mes,fin)
  ), apertura_base AS (
    SELECT x AS f FROM anterior CROSS JOIN LATERAL jsonb_array_elements(fuentes->'conteos') x
    UNION ALL SELECT f FROM controles WHERE f->>'modo'='apertura' AND (f->>'fecha')::date IN (p_mes-1,p_mes)
      AND NOT EXISTS (SELECT FROM anterior)
  ), apertura AS (
    SELECT f FROM apertura_base
    UNION ALL
    SELECT jsonb_build_object('inventario_id',i.registro_id,'archivo',i.archivo,'hoja',i.hoja,'fila',i.fila,'modo','apertura',
      'fecha',i.datos->>'fecha','bodega','Sin bodega en archivo','inicial',i.datos->'stock','actual',i.datos->'stock',
      'entradas',0,'salidas',0,'movimiento_inicial_id',i.movimiento_inicial_id,'control_id',i.lote_id)||i.datos
    FROM public.importaciones_excel_filas i WHERE i.clinica_id=p_clinica AND tipo='productos' AND i.datos->>'fecha' IN ((p_mes-1)::text,p_mes::text)
      AND NOT EXISTS (SELECT FROM anterior) AND NOT EXISTS (SELECT FROM apertura_base a WHERE (a.f->>'inventario_id')::bigint=i.registro_id)
  ), lineas_anuladas AS (
    SELECT 'venta' tipo,v.id,v.fecha,lower(v.numero) doc,i.inventario_id,sum(i.cantidad) unidades
      FROM public.ventas v JOIN public.venta_items i ON i.venta_id=v.id AND i.clinica_id=v.clinica_id
      WHERE v.clinica_id=p_clinica AND v.fecha BETWEEN p_mes AND fin AND NOT v.saldo_inicial AND v.estado='anulada'
        AND NOT EXISTS (SELECT FROM public.ventas otra WHERE otra.clinica_id=p_clinica AND otra.id<>v.id AND lower(otra.numero)=lower(v.numero))
      GROUP BY v.id,v.fecha,v.numero,i.inventario_id
    UNION ALL
    SELECT 'compra',c.id,c.fecha,lower(c.numero_factura),i.inventario_id,sum(i.cantidad)
      FROM public.compras c JOIN public.compra_items i ON i.compra_id=c.id AND i.clinica_id=c.clinica_id
      WHERE c.clinica_id=p_clinica AND c.fecha BETWEEN p_mes AND fin AND c.estado='anulada' AND NOT c.saldo_inicial AND nullif(c.numero_factura,'') IS NOT NULL
        AND NOT EXISTS (SELECT FROM public.compras otra WHERE otra.clinica_id=p_clinica AND otra.id<>c.id AND lower(otra.numero_factura)=lower(c.numero_factura))
      GROUP BY c.id,c.fecha,c.numero_factura,i.inventario_id
  ), parejas AS (
    -- Exigir comprobante unívoco, fechas dentro del mes y unidades completas por producto.
    SELECT a.*,m.id mov,m.cantidad,m.tipo=CASE a.tipo WHEN 'venta' THEN 'salida' ELSE 'entrada' END original
    FROM lineas_anuladas a LEFT JOIN public.inventario_movimientos m ON m.clinica_id=p_clinica AND m.inventario_id=a.inventario_id
      AND m.fecha BETWEEN a.fecha AND fin AND (
        (a.tipo='venta' AND ((m.tipo='salida' AND m.fecha=a.fecha AND split_part(lower(m.motivo),' · ',1)='venta '||a.doc)
          OR (m.tipo='entrada' AND lower(m.motivo)='anulación de venta '||a.doc)))
        OR (a.tipo='compra' AND split_part(lower(m.motivo),' · fact. ',2)=a.doc AND
          ((m.tipo='entrada' AND m.fecha=a.fecha AND lower(m.motivo) LIKE 'compra a %') OR (m.tipo='salida' AND lower(m.motivo) LIKE 'anulación de compra a %'))))
  ), anuladas_incompletas AS (
    SELECT tipo,id FROM (SELECT tipo,id,inventario_id,unidades FROM parejas GROUP BY tipo,id,inventario_id,unidades
      HAVING inventario_id IS NULL OR unidades IS NULL OR sum(cantidad) FILTER(WHERE original) IS DISTINCT FROM unidades
        OR sum(cantidad) FILTER(WHERE NOT original) IS DISTINCT FROM unidades) incompleta
  ), anuladas_validas AS (
    SELECT DISTINCT p.tipo,p.id,p.mov FROM parejas p WHERE NOT EXISTS (SELECT FROM anuladas_incompletas i WHERE i.tipo=p.tipo AND i.id=p.id)
  ), canceladas AS (
    SELECT 'compra' tipo,c.id,c.fecha,coalesce(c.numero_factura,c.id::text) documento,
      CASE WHEN c.estado='anulada' THEN 'Compra anulada, cotejar fecha e importe de la reversión' ELSE 'Compra sin líneas de detalle' END motivo
      FROM public.compras c WHERE c.clinica_id=p_clinica AND c.fecha BETWEEN p_mes AND fin AND NOT c.saldo_inicial
      AND ((c.estado='anulada' AND NOT EXISTS(SELECT FROM anuladas_validas a WHERE a.tipo='compra' AND a.id=c.id))
        OR NOT EXISTS (SELECT FROM public.compra_items i WHERE i.clinica_id=p_clinica AND i.compra_id=c.id))
    UNION ALL
    SELECT 'venta',v.id,v.fecha,v.numero,CASE WHEN v.estado='anulada' THEN 'Venta anulada, cotejar fecha e importe de la reversión' ELSE 'Venta sin líneas de detalle' END
      FROM public.ventas v WHERE v.clinica_id=p_clinica AND v.fecha BETWEEN p_mes AND fin AND NOT v.saldo_inicial
      AND ((v.estado='anulada' AND NOT EXISTS(SELECT FROM anuladas_validas a WHERE a.tipo='venta' AND a.id=v.id))
        OR NOT EXISTS (SELECT FROM public.venta_items i WHERE i.clinica_id=p_clinica AND i.venta_id=v.id))
    UNION ALL
    SELECT 'movimiento',m.id,m.fecha,m.motivo,'Reversión de inventario: coteja la fecha del documento original'
      FROM public.inventario_movimientos m WHERE m.clinica_id=p_clinica AND m.fecha BETWEEN p_mes AND fin AND m.motivo ~* '^anulaci[oó]n'
        AND NOT EXISTS(SELECT FROM anuladas_validas a WHERE a.mov=m.id)
  ), posteriores AS (
    SELECT inventario_id, sum(CASE WHEN tipo='entrada' THEN cantidad ELSE -cantidad END) desde,
      sum(CASE WHEN tipo='entrada' THEN cantidad ELSE -cantidad END) FILTER (WHERE fecha>fin) posterior
    FROM public.inventario_movimientos WHERE clinica_id=p_clinica AND fecha>=p_mes GROUP BY inventario_id
  ), f AS (
    SELECT 'productos' k,to_jsonb(i)||jsonb_build_object('saldo_inicio',i.stock_actual-coalesce(m.desde,0),
      'saldo_corte',i.stock_actual-coalesce(m.posterior,0)) j FROM public.inventario i
      LEFT JOIN posteriores m ON m.inventario_id=i.id WHERE i.clinica_id=p_clinica
    UNION ALL SELECT 'movimientos',to_jsonb(m)||jsonb_build_object('valor_costo',m.valor_costo::text,
      'anulacion_conciliada',EXISTS(SELECT FROM anuladas_validas a WHERE a.mov=m.id),'es_apertura',EXISTS (SELECT FROM apertura a WHERE
        (a.f->>'movimiento_inicial_id')::bigint=m.id) OR EXISTS (SELECT FROM public.controles_inventario c
        CROSS JOIN LATERAL jsonb_array_elements(c.filas) x WHERE c.clinica_id=p_clinica AND c.modo='apertura' AND c.fecha=p_mes
        AND (x->>'inventario_id')::bigint=m.inventario_id AND x->>'accion'='vincular'
        AND m.motivo IN ('Existencia inicial','Excel · Existencia inicial') AND m.fecha=p_mes))
      FROM public.inventario_movimientos m WHERE m.clinica_id=p_clinica AND m.fecha BETWEEN p_mes AND fin
    UNION ALL SELECT 'compras',to_jsonb(i)||jsonb_build_object('documento',coalesce(nullif(c.numero_factura,''),'Compra '||c.id),'numero_factura',c.numero_factura,'fecha',c.fecha)
      FROM public.compras c JOIN public.compra_items i ON i.compra_id=c.id AND i.clinica_id=c.clinica_id
      WHERE c.clinica_id=p_clinica AND c.fecha BETWEEN p_mes AND fin AND NOT c.saldo_inicial AND c.estado='registrada'
    UNION ALL SELECT 'ventas',to_jsonb(i)||jsonb_build_object('documento',v.numero,'fecha',v.fecha)
      FROM public.ventas v JOIN public.venta_items i ON i.venta_id=v.id AND i.clinica_id=v.clinica_id
      WHERE v.clinica_id=p_clinica AND v.fecha BETWEEN p_mes AND fin AND NOT v.saldo_inicial AND v.estado='registrada'
    UNION ALL SELECT 'kardex',jsonb_build_object('archivo',i.archivo,'hoja',i.hoja,'fila',i.fila,'datos',i.datos,'lote_id',i.lote_id)
      FROM public.importaciones_excel_filas i WHERE i.clinica_id=p_clinica AND tipo='movimientos'
        AND datos @> '{"documental":true}' AND i.datos->>'fecha' BETWEEN p_mes::text AND fin::text
    UNION ALL SELECT 'diario',to_jsonb(d) FROM public.libro_diario d WHERE d.clinica_id=p_clinica AND d.fecha BETWEEN p_mes AND fin
    UNION ALL SELECT 'incidencias_documentos',to_jsonb(i) FROM canceladas i
    UNION ALL SELECT 'aperturas',f FROM apertura
    UNION ALL SELECT 'conteos',f FROM controles WHERE f->>'modo'='cierre' AND (f->>'fecha')::date=fin
  ), conjuntos AS (
    SELECT k,jsonb_agg(j ORDER BY j->>'fecha',(j->>'id')::bigint,j::text) docs FROM f GROUP BY k
  )
  SELECT jsonb_build_object('clinica_id',p_clinica,'mes',p_mes,'desde',p_mes,'hasta',fin,'aprobado',false,
    'apertura_previa_aprobada',EXISTS (SELECT FROM anterior),'aperturas','[]'::jsonb,'conteos','[]'::jsonb,
    'productos','[]'::jsonb,'movimientos','[]'::jsonb,'compras','[]'::jsonb,'ventas','[]'::jsonb,'kardex','[]'::jsonb,
    'diario','[]'::jsonb,'incidencias_documentos','[]'::jsonb,'libro',public.reporte_libro_contable(p_clinica,p_mes,fin))
    ||coalesce((SELECT jsonb_object_agg(k,docs) FROM conjuntos),'{}'::jsonb) INTO fuente;
  RETURN fuente||jsonb_build_object('revision',md5(fuente::text));
END $$;

-- Recalcular los controles críticos en la base. Nunca aceptar totales o permisos del navegador.
CREATE OR REPLACE FUNCTION public._costo_conciliado_maestro(f jsonb) RETURNS numeric
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE conflicto text; costo_ventas numeric;
BEGIN
  IF jsonb_array_length(f->'aperturas')=0 OR jsonb_array_length(f->'conteos')=0 OR jsonb_array_length(f->'incidencias_documentos')>0 THEN
    RAISE EXCEPTION 'Revisa la apertura, el conteo final y los documentos pendientes antes de cerrar.'; END IF;
  IF EXISTS (SELECT FROM jsonb_array_elements(f->'aperturas') a WHERE a->>'bodega'<>'Sin bodega en archivo' AND NOT EXISTS
    (SELECT FROM jsonb_array_elements(f->'conteos') c WHERE lower(c->>'bodega')=lower(a->>'bodega'))) THEN
    RAISE EXCEPTION 'Falta el cierre de una bodega.'; END IF;
  WITH controles AS (
    SELECT x,True apertura FROM jsonb_array_elements(f->'aperturas') x
    UNION ALL SELECT x,False FROM jsonb_array_elements(f->'conteos') x
  ), cant AS (
    SELECT (x->>'inventario_id')::bigint id,
      sum((x->>'actual')::numeric) FILTER(WHERE apertura) inicial,
      sum((x->>'actual')::numeric) FILTER(WHERE NOT apertura) final,
      sum((x->>'inicial')::numeric) FILTER(WHERE NOT apertura) inicial_declarado,
      sum((x->>'entradas')::numeric) FILTER(WHERE NOT apertura) entradas_declaradas,
      sum((x->>'salidas')::numeric) FILTER(WHERE NOT apertura) salidas_declaradas,
      sum(coalesce((x->>'costo_total')::numeric,round((x->>'actual')::numeric*(x->>'costo')::numeric,2))) FILTER(WHERE apertura) valor_i,
      sum(coalesce((x->>'costo_total')::numeric,round((x->>'actual')::numeric*(x->>'costo')::numeric,2))) FILTER(WHERE NOT apertura) valor_f,
      bool_or((x->>'actual')::numeric>0 AND x->>'costo' IS NULL AND coalesce((x->>'costo_total')::numeric,0)=0) sin_valor
    FROM controles GROUP BY 1
  ), ops AS (
    SELECT x.*,lower(btrim(translate(x.motivo,'ÁÉÍÓÚáéíóú','AEIOUaeiou'))) motivo_normal
      FROM jsonb_to_recordset(f->'movimientos') x(inventario_id bigint, tipo text, cantidad numeric, motivo text,
        es_apertura boolean,anulacion_conciliada boolean,valor_costo numeric,costo_unitario numeric,fecha date)
      WHERE NOT x.es_apertura
  ), motivos AS (
    SELECT o.*,CASE WHEN anulacion_conciliada THEN 'anulacion' WHEN tipo='entrada' AND motivo_normal LIKE 'compra a %' THEN 'compra'
      WHEN tipo='salida' AND motivo_normal LIKE 'venta %' THEN 'venta'
      WHEN regexp_replace(motivo_normal,'^excel[[:space:]]*·[[:space:]]*','') ~ '^(mermas?|consumo|uso interno|muestras?|donacion|ajuste|traslado|transferencia)([^a-z]|$)' THEN 'ajuste'
      END clase
    FROM ops o
  ), mov AS (
    SELECT inventario_id id,sum(cantidad) FILTER (WHERE tipo='entrada') entradas,sum(cantidad) FILTER (WHERE tipo='salida') salidas,
      sum(cantidad) FILTER (WHERE clase='compra') unidades_compra,sum(cantidad) FILTER (WHERE clase='venta') unidades_venta,
      bool_or(clase IS NULL OR tipo NOT IN ('entrada','salida') OR cantidad IS NULL OR cantidad<=0 OR
        (clase='ajuste' AND coalesce(valor_costo,costo_unitario) IS NULL)) pendiente,
      sum((CASE tipo WHEN 'entrada' THEN -1 ELSE 1 END)*coalesce(valor_costo,round(cantidad*costo_unitario,2))) FILTER (WHERE clase='ajuste') ajuste
    FROM motivos GROUP BY 1
  ), com AS (
    SELECT inventario_id id,sum(cantidad) cantidad,sum(subtotal) importe,bool_or(subtotal IS NULL OR cantidad IS NULL) falta
      FROM jsonb_to_recordset(f->'compras') x(inventario_id bigint,cantidad numeric,subtotal numeric) GROUP BY 1
  ), ven AS (
    SELECT inventario_id id,sum(cantidad) cantidad,sum(round(cantidad*costo_unitario,2)) importe,
      bool_or(subtotal IS NULL OR costo_unitario IS NULL OR cantidad IS NULL) falta
      FROM jsonb_to_recordset(f->'ventas') x(inventario_id bigint,cantidad numeric,costo_unitario numeric,subtotal numeric) GROUP BY 1
  ), prod AS (
    SELECT * FROM jsonb_to_recordset(f->'productos') x(id bigint,nombre text,saldo_inicio numeric,saldo_corte numeric)
  ), ids AS (
    SELECT id FROM cant UNION SELECT id FROM mov UNION SELECT id FROM com UNION SELECT id FROM ven
    UNION SELECT id FROM prod WHERE saldo_inicio<>0 OR saldo_corte<>0
  ), rev AS (
    SELECT i.id,coalesce(p.nombre,'Artículo sin vínculo') articulo, v.importe costo,
      i.id IS NULL OR p.id IS NULL OR b.final IS NULL OR b.sin_valor OR coalesce(m.pendiente,false) OR coalesce(c.falta,false) OR coalesce(v.falta,false)
      OR (b.inicial IS NULL AND (p.saldo_inicio IS DISTINCT FROM 0 OR coalesce(m.entradas,0)=0))
      OR b.final IS DISTINCT FROM p.saldo_corte OR b.inicial_declarado IS DISTINCT FROM coalesce(b.inicial,0)
      OR b.entradas_declaradas IS DISTINCT FROM coalesce(m.entradas,0) OR b.salidas_declaradas IS DISTINCT FROM coalesce(m.salidas,0)
      OR coalesce(b.inicial,0)+coalesce(m.entradas,0)-coalesce(m.salidas,0) IS DISTINCT FROM b.final
      OR coalesce(m.unidades_compra,0)<>coalesce(c.cantidad,0) OR coalesce(m.unidades_venta,0)<>coalesce(v.cantidad,0)
      OR coalesce(b.valor_i,0)+coalesce(c.importe,0)-coalesce(b.valor_f,0)<>coalesce(v.importe,0)+coalesce(m.ajuste,0) AS difiere
    FROM ids i LEFT JOIN prod p USING(id) LEFT JOIN cant b USING(id) LEFT JOIN mov m USING(id) LEFT JOIN com c USING(id) LEFT JOIN ven v USING(id)
  )
  SELECT min(articulo) FILTER(WHERE difiere),coalesce(sum(costo),0) INTO conflicto,costo_ventas FROM rev;
  IF conflicto IS NOT NULL THEN RAISE EXCEPTION 'Existen diferencias de unidades, costos o documentos en %. Revisa el informe.',conflicto; END IF;
  IF EXISTS (
    WITH unidades AS (
      SELECT 'entrada' tipo,c.inventario_id,c.fecha,lower(coalesce(c.numero_factura,'')) doc,c.cantidad
        FROM jsonb_to_recordset(f->'compras') c(inventario_id bigint,fecha date,numero_factura text,cantidad numeric)
      UNION ALL SELECT 'salida',v.inventario_id,v.fecha,lower(v.documento),v.cantidad
        FROM jsonb_to_recordset(f->'ventas') v(inventario_id bigint,fecha date,documento text,cantidad numeric)
      UNION ALL SELECT m.tipo,m.inventario_id,m.fecha,CASE WHEN m.tipo='entrada' THEN split_part(lower(m.motivo),' · fact. ',2)
        ELSE lower(split_part(substr(m.motivo,7),' · ',1)) END,-m.cantidad
        FROM jsonb_to_recordset(f->'movimientos') m(tipo text,inventario_id bigint,fecha date,motivo text,cantidad numeric,anulacion_conciliada boolean,es_apertura boolean)
        WHERE NOT m.es_apertura AND NOT m.anulacion_conciliada AND
          ((m.tipo='entrada' AND lower(m.motivo) LIKE 'compra a %') OR (m.tipo='salida' AND lower(m.motivo) LIKE 'venta %'))
    )
    SELECT FROM unidades GROUP BY tipo,inventario_id,fecha,doc HAVING sum(cantidad)<>0
  ) THEN RAISE EXCEPTION 'Las unidades por comprobante, fecha y artículo difieren de los movimientos físicos.'; END IF;
  RETURN costo_ventas;
END $$;

CREATE OR REPLACE FUNCTION public.aprobar_informe_maestro(p_clinica bigint,p_mes date,p_revision text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; fecha timestamptz:=now();
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lumea-importar-excel:'||p_clinica,0));
  f:=public.datos_informe_maestro(p_clinica,p_mes);
  IF (f->>'aprobado')::boolean THEN RETURN f; END IF;
  IF (p_mes+interval '1 month')::date-1>(current_timestamp AT TIME ZONE 'America/Managua')::date THEN RAISE EXCEPTION 'El mes todavía no ha terminado.'; END IF;
  IF p_revision IS DISTINCT FROM f->>'revision' THEN RAISE EXCEPTION 'Las fuentes cambiaron. Consulta el informe nuevamente.'; END IF;
  PERFORM public._costo_conciliado_maestro(f);
  INSERT INTO public.cierres_maestro(clinica_id,mes,fuentes,aprobado_por,aprobado_en) VALUES(p_clinica,p_mes,f,auth.uid(),fecha);
  RETURN f||jsonb_build_object('aprobado',true,'aprobado_en',fecha,'aprobado_por',auth.uid());
END $$;

CREATE OR REPLACE FUNCTION public.registrar_ajuste_maestro(p_clinica bigint,p_mes date,p_revision text,p_costo_objetivo numeric,
    p_cuenta_costo text,p_cuenta_inventario text)
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE f jsonb; objetivo numeric; diferencia numeric; doc text; lineas jsonb; fin date;
  cc public.libro_diario_cuentas%ROWTYPE; ci public.libro_diario_cuentas%ROWTYPE; registrado numeric;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('lumea-importar-excel:'||p_clinica,0));
  f:=public.datos_informe_maestro(p_clinica,p_mes);
  IF (f->>'aprobado')::boolean THEN RAISE EXCEPTION 'El informe ya está aprobado.'; END IF;
  IF p_revision IS DISTINCT FROM f->>'revision' THEN RAISE EXCEPTION 'Las fuentes cambiaron. Consulta el informe nuevamente.'; END IF;
  fin:=(p_mes+interval '1 month')::date-1; doc:='MAESTRO-'||to_char(p_mes,'YYYY-MM');
  IF fin>(current_timestamp AT TIME ZONE 'America/Managua')::date THEN RAISE EXCEPTION 'El mes todavía no ha terminado.'; END IF;
  objetivo:=public._costo_conciliado_maestro(f);
  IF p_costo_objetivo IS DISTINCT FROM objetivo THEN RAISE EXCEPTION 'El costo de ventas revisado difiere del documentado.'; END IF;
  SELECT * INTO cc FROM public.libro_diario_cuentas WHERE clinica_id=p_clinica AND codigo=p_cuenta_costo AND clase='costo';
  SELECT * INTO ci FROM public.libro_diario_cuentas WHERE clinica_id=p_clinica AND codigo=p_cuenta_inventario AND clase='activo';
  IF cc.codigo IS NULL OR ci.codigo IS NULL THEN RAISE EXCEPTION 'Selecciona una cuenta de costo y una cuenta de activo del catálogo.'; END IF;
  IF EXISTS (SELECT FROM public.libro_diario WHERE clinica_id=p_clinica AND fecha BETWEEN p_mes AND fin AND lower(documento)=lower(doc)) THEN
    RAISE EXCEPTION 'Ya existe el ajuste de ese mes. Revisa el comprobante %.',doc; END IF;
  SELECT (cuenta->>'debe')::numeric-(cuenta->>'haber')::numeric INTO registrado FROM jsonb_array_elements(f->'libro'->'cuentas') cuenta
    WHERE cuenta->>'codigo'=cc.codigo;
  diferencia:=objetivo-coalesce(registrado,0);
  IF diferencia=0 THEN RAISE EXCEPTION 'El costo de ventas ya está registrado en la cuenta seleccionada.'; END IF;
  lineas:=jsonb_build_array(jsonb_build_object('cuenta',cc.codigo,'nombre_cuenta',cc.nombre,'clase',cc.clase,'debe',greatest(diferencia,0),'haber',greatest(-diferencia,0)),
    jsonb_build_object('cuenta',ci.codigo,'nombre_cuenta',ci.nombre,'clase',ci.clase,'debe',greatest(-diferencia,0),'haber',greatest(diferencia,0)));
  RETURN public.registrar_asiento_libro(p_clinica,gen_random_uuid(),'asiento',fin,doc,'Ajuste al costo de ventas conciliado',lineas,'[]',NULL);
END $$;
REVOKE ALL ON FUNCTION public._acceso_maestro(bigint,boolean),public._costo_conciliado_maestro(jsonb) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.importar_control_inventario(bigint,date,text,text,jsonb,boolean,text),public.datos_informe_maestro(bigint,date),
  public.aprobar_informe_maestro(bigint,date,text),public.registrar_ajuste_maestro(bigint,date,text,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.importar_control_inventario(bigint,date,text,text,jsonb,boolean,text),public.datos_informe_maestro(bigint,date),
  public.aprobar_informe_maestro(bigint,date,text),public.registrar_ajuste_maestro(bigint,date,text,numeric,text,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
SELECT to_regprocedure('public.datos_informe_maestro(bigint,date)') IS NOT NULL AS informe_maestro_listo;
