-- ============================================================
-- LUMEA MED - Permitir borrar pacientes con historial
--
-- Ejecutar una vez en: Supabase -> SQL Editor
--
-- El historial del expediente se escribe desde triggers AFTER DELETE. Cuando
-- se borra un paciente, el trigger intenta conservar su id en
-- historial_expediente.paciente_id. Si esa columna mantiene una FK hacia
-- pacientes(id), Postgres rechaza el INSERT del historial porque el paciente
-- ya esta siendo eliminado.
--
-- La columna queda como identificador historico normal: conserva el numero para
-- auditoria, pero no depende de que la fila original siga existiendo.
-- ============================================================

DO $$
DECLARE
  fk RECORD;
BEGIN
  FOR fk IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    JOIN pg_attribute att
      ON att.attrelid = rel.oid
     AND att.attnum = ANY(con.conkey)
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'historial_expediente'
      AND att.attname = 'paciente_id'
      AND con.contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.historial_expediente DROP CONSTRAINT %I', fk.conname);
  END LOOP;
END $$;

COMMENT ON COLUMN public.historial_expediente.paciente_id IS
  'Identificador historico del paciente; no usa FK para permitir conservar auditoria despues de borrar el paciente.';

-- Comprobacion: no debe devolver filas.
SELECT con.conname
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
JOIN pg_attribute att
  ON att.attrelid = rel.oid
 AND att.attnum = ANY(con.conkey)
WHERE nsp.nspname = 'public'
  AND rel.relname = 'historial_expediente'
  AND att.attname = 'paciente_id'
  AND con.contype = 'f';
