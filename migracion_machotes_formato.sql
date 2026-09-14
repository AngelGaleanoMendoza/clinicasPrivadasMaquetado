-- ============================================================
-- LUMEA MED - Machotes con formato (tablas, imágenes y gráficas)
--
-- Ejecutar una vez en: Supabase -> SQL Editor
-- Requiere haber ejecutado antes migracion_profesional_plantillas_notas.sql
-- ============================================================

-- El machote importado desde Word conserva su maquetación: encabezado, pie,
-- marca de agua, tablas, imágenes y la configuración de sus gráficas. Las
-- imágenes viven en Storage; aquí solo se guardan sus direcciones.
ALTER TABLE public.plantillas_notas ADD COLUMN IF NOT EXISTS documento JSONB;

-- Lo que el médico escribió sobre el documento, campo por campo. El texto
-- plano de la nota sigue en notas.contenido para búsquedas y respaldos.
ALTER TABLE public.notas ADD COLUMN IF NOT EXISTS plantilla_valores JSONB;

COMMENT ON COLUMN public.plantillas_notas.documento IS
  'Machote con formato: {version, pagina, encabezado, pie, cuerpo, marcasAgua, graficas}. NULL en machotes de solo texto.';
COMMENT ON COLUMN public.notas.plantilla_valores IS
  'Valores escritos sobre un machote con formato, por identificador de campo.';

-- Las dos tablas ya tienen RLS por clínica (plantillas_notas_clinica y la
-- política de notas): las columnas nuevas quedan protegidas por ellas.

-- Comprobación rápida.
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'plantillas_notas' AND column_name = 'documento')
    OR (table_name = 'notas' AND column_name = 'plantilla_valores'))
ORDER BY table_name;
