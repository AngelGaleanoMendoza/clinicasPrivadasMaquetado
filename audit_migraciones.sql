-- ============================================================
-- LUMEA MED - Auditoria de migraciones
--
-- Ejecutar en: Supabase -> SQL Editor. Solo lee catalogos, no modifica nada.
--
-- Devuelve una fila por migracion, en el orden en que deben ejecutarse, con
-- lo que falta de cada una. Las migraciones se comprueban por sus objetos
-- reales (tabla, columna, indice, restriccion, disparador, politica), asi que
-- una migracion a medias aparece como PENDIENTE y dice que le falta.
--
-- El orden importa: migracion_profesional_plantillas_notas necesita
-- notas.estado (notas_borrador) para su restriccion, y codigo_medico_notas y
-- machotes_formato necesitan la tabla plantillas_notas que aquella crea.
-- ============================================================

WITH requisitos(orden, migracion, clase, objeto) AS (VALUES

  -- 1. Estado editable de las notas (borrador / finalizada)
  (1, 'notas_borrador',              'columna',     'notas.estado'),
  (1, 'notas_borrador',              'restriccion', 'notas_estado_check'),
  (1, 'notas_borrador',              'indice',      'idx_notas_estado'),

  -- 2. Signos vitales por consulta
  (2, 'signos_vitales_por_cita',     'columna',     'notas.cita_id'),
  (2, 'signos_vitales_por_cita',     'indice',      'idx_notas_cita_id'),
  (2, 'signos_vitales_por_cita',     'indice',      'idx_notas_paciente_fecha_signos'),

  -- 3. Recetas separadas por medico prescriptor
  (3, 'recetas_por_medico',          'columna',     'medicaciones.receta_id'),
  (3, 'recetas_por_medico',          'columna',     'medicaciones.fecha_emision'),
  (3, 'recetas_por_medico',          'columna',     'medicaciones.prescriptor_id'),
  (3, 'recetas_por_medico',          'columna',     'medicaciones.prescriptor_nombre'),
  (3, 'recetas_por_medico',          'columna',     'medicaciones.prescriptor_especialidad'),
  (3, 'recetas_por_medico',          'columna',     'medicaciones.prescriptor_firma_url'),
  (3, 'recetas_por_medico',          'indice',      'medicaciones_receta_id_idx'),

  -- 4. Configuracion del recetario por medico (antes de recetario_digital:
  --    esa migracion comenta recetario_config, que se crea aqui)
  (4, 'plantillas_recetario',        'columna',     'profiles.recetario_url'),
  (4, 'plantillas_recetario',        'columna',     'profiles.recetario_config'),
  (4, 'plantillas_recetario',        'columna',     'medicaciones.recetario_url'),
  (4, 'plantillas_recetario',        'columna',     'medicaciones.recetario_config'),

  -- 5. Formulario digital de recetas
  (5, 'recetario_digital',           'columna',     'medicaciones.diagnostico'),
  (5, 'recetario_digital',           'columna',     'medicaciones.receta_notas'),
  (5, 'recetario_digital',           'columna',     'medicaciones.proxima_cita'),

  -- 6. Borrar pacientes conservando el historial
  (6, 'historial_borrado_paciente',  'tabla',       'historial_expediente'),
  (6, 'historial_borrado_paciente',  'sin_fk',      'historial_expediente.paciente_id'),

  -- 7. Productividad y ultima conexion
  (7, 'productividad_superadmin',    'columna',     'profiles.ultimo_acceso'),
  (7, 'productividad_superadmin',    'columna',     'actividad_usuarios.created_at'),
  (7, 'productividad_superadmin',    'indice',      'actividad_usuarios_clinica_fecha_idx'),
  (7, 'productividad_superadmin',    'indice',      'actividad_usuarios_usuario_fecha_idx'),
  (7, 'productividad_superadmin',    'indice',      'actividad_usuarios_accion_fecha_idx'),
  (7, 'productividad_superadmin',    'indice',      'profiles_ultimo_acceso_idx'),
  (7, 'productividad_superadmin',    'disparador',  'actividad_usuarios_ultimo_acceso'),

  -- 8. Profesional responsable y machotes de notas (necesita notas.estado)
  (8, 'profesional_plantillas_notas','tabla',       'plantillas_notas'),
  (8, 'profesional_plantillas_notas','columna',     'notas.profesional_id'),
  (8, 'profesional_plantillas_notas','columna',     'notas.profesional_nombre'),
  (8, 'profesional_plantillas_notas','columna',     'notas.profesional_especialidad'),
  (8, 'profesional_plantillas_notas','columna',     'notas.profesional_firma_url'),
  (8, 'profesional_plantillas_notas','columna',     'notas.plantilla_id'),
  (8, 'profesional_plantillas_notas','indice',      'idx_notas_profesional'),
  (8, 'profesional_plantillas_notas','indice',      'idx_plantillas_notas_clinica_tipo'),
  (8, 'profesional_plantillas_notas','restriccion', 'notas_finalizada_profesional_check'),
  (8, 'profesional_plantillas_notas','politica',    'plantillas_notas_clinica'),

  -- 9. Codigo MINSA del medico en cada nota (necesita la 8)
  (9, 'codigo_medico_notas',         'columna',     'notas.profesional_codigo'),

  -- 10. Machotes con formato (necesita la 8)
  (10, 'machotes_formato',           'columna',     'plantillas_notas.documento'),
  (10, 'machotes_formato',           'columna',     'notas.plantilla_valores'),

  -- 11. Balance de reparto por servicio. La restriccion factura_items_tipo_check
  --     solo se crea si existia otra que no admitia 'examen', asi que no se exige.
  (11, 'balance_reparto',            'tabla',       'reparto_servicios'),
  (11, 'balance_reparto',            'columna',     'factura_items.porcentaje_clinica'),
  (11, 'balance_reparto',            'politica',    'reparto_servicios_clinica'),

  -- 12. Quién lleva agenda
  (12, 'agenda_profesional',         'columna',     'profiles.con_agenda'),
  (12, 'agenda_profesional',         'indice',      'profiles_clinica_agenda_idx'),
  -- Sustituye a migracion_baja_profesional.sql: si `activo` sigue ahí, esa
  -- versión quedó a medias y puede dejar gente sin poder entrar.
  (12, 'agenda_profesional',         'sin_columna', 'profiles.activo')

),

evaluado AS (
  SELECT
    r.orden,
    r.migracion,
    r.clase,
    r.objeto,
    CASE r.clase

      WHEN 'tabla' THEN EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = r.objeto
          AND c.relkind IN ('r','p')
      )

      WHEN 'columna' THEN EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = split_part(r.objeto, '.', 1)
          AND a.attname = split_part(r.objeto, '.', 2)
          AND a.attnum > 0 AND NOT a.attisdropped
      )

      WHEN 'indice' THEN EXISTS (
        SELECT 1 FROM pg_indexes i
        WHERE i.schemaname = 'public' AND i.indexname = r.objeto
      )

      WHEN 'restriccion' THEN EXISTS (
        SELECT 1 FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND k.conname = r.objeto
      )

      WHEN 'disparador' THEN EXISTS (
        SELECT 1 FROM pg_trigger t
        JOIN pg_class c ON c.oid = t.tgrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND t.tgname = r.objeto
          AND NOT t.tgisinternal
      )

      WHEN 'politica' THEN EXISTS (
        SELECT 1 FROM pg_policies p
        WHERE p.schemaname = 'public' AND p.policyname = r.objeto
      )

      -- La migracion elimina la columna: esta aplicada si YA NO existe.
      WHEN 'sin_columna' THEN NOT EXISTS (
        SELECT 1 FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
          AND c.relname = split_part(r.objeto, '.', 1)
          AND a.attname = split_part(r.objeto, '.', 2)
          AND a.attnum > 0 AND NOT a.attisdropped
      )

      -- La migracion consiste en quitar la FK: esta aplicada si YA NO existe.
      WHEN 'sin_fk' THEN NOT EXISTS (
        SELECT 1 FROM pg_constraint k
        JOIN pg_class c ON c.oid = k.conrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(k.conkey)
        WHERE n.nspname = 'public' AND k.contype = 'f'
          AND c.relname = split_part(r.objeto, '.', 1)
          AND a.attname = split_part(r.objeto, '.', 2)
      )

    END AS presente
  FROM requisitos r
)

SELECT
  orden                                                        AS "#",
  CASE WHEN bool_and(presente) THEN 'APLICADA' ELSE 'PENDIENTE' END
                                                               AS "Estado",
  'migracion_' || migracion || '.sql'                          AS "Archivo",
  count(*) FILTER (WHERE presente) || ' de ' || count(*)        AS "Objetos",
  COALESCE(
    string_agg(clase || ' ' || objeto, ' | ' ORDER BY clase, objeto)
      FILTER (WHERE NOT presente),
    '-'
  )                                                            AS "Que falta"
FROM evaluado
GROUP BY orden, migracion
ORDER BY orden;
