-- ============================================================
-- LUMEA MED — Auditoría de migraciones aplicadas
--
-- Ejecutar en: Supabase → SQL Editor
-- Este script verifica cuál de las 7 migraciones están aplicadas.
-- ============================================================

-- Tabla para acumular resultados
WITH migraciones_estado AS (

  -- 1. migracion_notas_borrador.sql
  -- Verifica: columna 'estado' en notas, constraint y índice
  SELECT
    'notas_borrador' AS migracion,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notas'
          AND column_name = 'estado'
      )
      AND EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notas_estado_check'
          AND conrelid = 'public.notas'::regclass
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_estado'
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notas'
          AND column_name = 'estado'
      ) THEN 'Falta columna estado'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'notas_estado_check'
          AND conrelid = 'public.notas'::regclass
      ) THEN 'Falta constraint notas_estado_check'
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_estado'
      ) THEN 'Falta índice idx_notas_estado'
      ELSE 'Completa'
    END AS detalles

  UNION ALL

  -- 2. migracion_historial_borrado_paciente.sql
  -- Verifica: FK sobre historial_expediente.paciente_id debe estar eliminada
  SELECT
    'historial_borrado_paciente' AS migracion,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att ON att.attrelid = rel.oid
          AND att.attnum = ANY(con.conkey)
        WHERE nsp.nspname = 'public' AND rel.relname = 'historial_expediente'
          AND att.attname = 'paciente_id' AND con.contype = 'f'
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        JOIN pg_attribute att ON att.attrelid = rel.oid
          AND att.attnum = ANY(con.conkey)
        WHERE nsp.nspname = 'public' AND rel.relname = 'historial_expediente'
          AND att.attname = 'paciente_id' AND con.contype = 'f'
      )
      THEN format('FK aún existe: %s',
        (SELECT con.conname FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
         JOIN pg_attribute att ON att.attrelid = rel.oid
           AND att.attnum = ANY(con.conkey)
         WHERE nsp.nspname = 'public' AND rel.relname = 'historial_expediente'
           AND att.attname = 'paciente_id' AND con.contype = 'f' LIMIT 1)
      )
      ELSE 'FK eliminada correctamente'
    END AS detalles

  UNION ALL

  -- 3. migracion_productividad_superadmin.sql
  -- Verifica: columna ultimo_acceso en profiles, created_at en actividad_usuarios, trigger
  SELECT
    'productividad_superadmin' AS migracion,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'ultimo_acceso'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'actividad_usuarios'
          AND column_name = 'created_at'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND trigger_name = 'actividad_usuarios_ultimo_acceso'
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CONCAT_WS(', ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'ultimo_acceso'
      ) THEN 'Falta profiles.ultimo_acceso' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'actividad_usuarios'
          AND column_name = 'created_at'
      ) THEN 'Falta actividad_usuarios.created_at' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND trigger_name = 'actividad_usuarios_ultimo_acceso'
      ) THEN 'Falta trigger' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'ultimo_acceso'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'actividad_usuarios'
          AND column_name = 'created_at'
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.triggers
        WHERE trigger_schema = 'public' AND trigger_name = 'actividad_usuarios_ultimo_acceso'
      ) THEN 'Completa' END
    ) AS detalles

  UNION ALL

  -- 4. migracion_recetario_digital.sql
  -- Verifica: columnas diagnostico, receta_notas, proxima_cita en medicaciones
  SELECT
    'recetario_digital' AS migracion,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('diagnostico', 'receta_notas', 'proxima_cita')
        GROUP BY table_name HAVING COUNT(*) = 3
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CONCAT_WS(', ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name = 'diagnostico'
      ) THEN 'Falta medicaciones.diagnostico' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name = 'receta_notas'
      ) THEN 'Falta medicaciones.receta_notas' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name = 'proxima_cita'
      ) THEN 'Falta medicaciones.proxima_cita' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('diagnostico', 'receta_notas', 'proxima_cita')
        GROUP BY table_name HAVING COUNT(*) = 3
      ) THEN 'Completa' END
    ) AS detalles

  UNION ALL

  -- 5. migracion_plantillas_recetario.sql
  -- Verifica: columnas recetario_url, recetario_config en profiles y medicaciones
  SELECT
    'plantillas_recetario' AS migracion,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name IN ('recetario_url', 'recetario_config')
        GROUP BY table_name HAVING COUNT(*) = 2
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('recetario_url', 'recetario_config')
        GROUP BY table_name HAVING COUNT(*) = 2
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CONCAT_WS(', ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'recetario_url'
      ) THEN 'Falta profiles.recetario_url' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name = 'recetario_config'
      ) THEN 'Falta profiles.recetario_config' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name = 'recetario_url'
      ) THEN 'Falta medicaciones.recetario_url' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name = 'recetario_config'
      ) THEN 'Falta medicaciones.recetario_config' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'profiles'
          AND column_name IN ('recetario_url', 'recetario_config')
        GROUP BY table_name HAVING COUNT(*) = 2
      )
      AND EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('recetario_url', 'recetario_config')
        GROUP BY table_name HAVING COUNT(*) = 2
      ) THEN 'Completa' END
    ) AS detalles

  UNION ALL

  -- 6. migracion_recetas_por_medico.sql
  -- Verifica: columnas receta_id, fecha_emision, prescriptor_* en medicaciones, índice
  SELECT
    'recetas_por_medico' AS migracion,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('receta_id', 'fecha_emision', 'prescriptor_id',
                             'prescriptor_nombre', 'prescriptor_especialidad',
                             'prescriptor_firma_url')
        GROUP BY table_name HAVING COUNT(*) = 6
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'medicaciones'
          AND indexname = 'medicaciones_receta_id_idx'
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CONCAT_WS(', ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('receta_id', 'fecha_emision', 'prescriptor_id',
                             'prescriptor_nombre', 'prescriptor_especialidad',
                             'prescriptor_firma_url')
      ) THEN 'Faltan columnas prescriptor' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'medicaciones'
          AND indexname = 'medicaciones_receta_id_idx'
      ) THEN 'Falta índice medicaciones_receta_id_idx' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'medicaciones'
          AND column_name IN ('receta_id', 'fecha_emision', 'prescriptor_id',
                             'prescriptor_nombre', 'prescriptor_especialidad',
                             'prescriptor_firma_url')
        GROUP BY table_name HAVING COUNT(*) = 6
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'medicaciones'
          AND indexname = 'medicaciones_receta_id_idx'
      ) THEN 'Completa' END
    ) AS detalles

  UNION ALL

  -- 7. migracion_signos_vitales_por_cita.sql
  -- Verifica: columna cita_id en notas, índices
  SELECT
    'signos_vitales_por_cita' AS migracion,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notas'
          AND column_name = 'cita_id'
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_cita_id'
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_paciente_fecha_signos'
      )
      THEN 'APLICADA ✓'
      ELSE 'PENDIENTE ✗'
    END AS estado,
    CONCAT_WS(', ',
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notas'
          AND column_name = 'cita_id'
      ) THEN 'Falta columna notas.cita_id' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_cita_id'
      ) THEN 'Falta índice idx_notas_cita_id' END,
      CASE WHEN NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_paciente_fecha_signos'
      ) THEN 'Falta índice idx_notas_paciente_fecha_signos' END,
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'notas'
          AND column_name = 'cita_id'
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_cita_id'
      )
      AND EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public' AND tablename = 'notas'
          AND indexname = 'idx_notas_paciente_fecha_signos'
      ) THEN 'Completa' END
    ) AS detalles

)

SELECT
  migracion,
  estado,
  detalles
FROM migraciones_estado
ORDER BY
  CASE WHEN estado = 'APLICADA ✓' THEN 1 ELSE 2 END,
  migracion;

-- Resumen
SELECT
  '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━' AS "",
  COUNT(*) FILTER (WHERE estado = 'APLICADA ✓') as "Aplicadas",
  COUNT(*) FILTER (WHERE estado = 'PENDIENTE ✗') as "Pendientes",
  COUNT(*) as "Total"
FROM (
  WITH migraciones AS (
    SELECT 'notas_borrador' m UNION ALL
    SELECT 'historial_borrado_paciente' UNION ALL
    SELECT 'productividad_superadmin' UNION ALL
    SELECT 'recetario_digital' UNION ALL
    SELECT 'plantillas_recetario' UNION ALL
    SELECT 'recetas_por_medico' UNION ALL
    SELECT 'signos_vitales_por_cita'
  ),
  estado_migraciones AS (
    SELECT
      m,
      CASE
        WHEN m = 'notas_borrador' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'notas'
              AND column_name = 'estado'
          ) AND EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'notas_estado_check'
              AND conrelid = 'public.notas'::regclass
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
        WHEN m = 'historial_borrado_paciente' THEN
          CASE WHEN NOT EXISTS (
            SELECT 1 FROM pg_constraint con
            JOIN pg_class rel ON rel.oid = con.conrelid
            JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
            JOIN pg_attribute att ON att.attrelid = rel.oid
              AND att.attnum = ANY(con.conkey)
            WHERE nsp.nspname = 'public' AND rel.relname = 'historial_expediente'
              AND att.attname = 'paciente_id' AND con.contype = 'f'
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
        WHEN m = 'productividad_superadmin' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles'
              AND column_name = 'ultimo_acceso'
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
        WHEN m = 'recetario_digital' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'medicaciones'
              AND column_name = 'diagnostico'
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
        WHEN m = 'plantillas_recetario' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'profiles'
              AND column_name = 'recetario_url'
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
        WHEN m = 'recetas_por_medico' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'medicaciones'
              AND column_name = 'receta_id'
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
        WHEN m = 'signos_vitales_por_cita' THEN
          CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'notas'
              AND column_name = 'cita_id'
          ) THEN 'APLICADA ✓' ELSE 'PENDIENTE ✗' END
      END estado
    FROM migraciones
  )
  SELECT m, estado FROM estado_migraciones
);
