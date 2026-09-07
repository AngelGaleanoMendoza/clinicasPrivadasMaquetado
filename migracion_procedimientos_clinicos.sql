-- Procedimientos clinicos unificados por servicio.
-- Es idempotente: puede ejecutarse varias veces sin duplicar registros migrados.

CREATE TABLE IF NOT EXISTS public.procedimientos_clinicos (
  id                         BIGSERIAL PRIMARY KEY,
  paciente_id                BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  cita_id                    BIGINT REFERENCES public.citas(id) ON DELETE SET NULL,
  servicio                   TEXT NOT NULL DEFAULT 'consulta',
  procedimiento              TEXT NOT NULL,
  categoria                  TEXT NOT NULL DEFAULT 'General',
  tipo                       TEXT NOT NULL DEFAULT 'clinico',
  especialidad               TEXT,
  fecha                      DATE NOT NULL DEFAULT CURRENT_DATE,
  hora                       TIME,
  profesional_id             UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  profesional_nombre         TEXT,
  rol_profesional            TEXT,
  firma_url                  TEXT,
  estado                     TEXT NOT NULL DEFAULT 'programado',
  prioridad                  TEXT NOT NULL DEFAULT 'normal',
  sala                       TEXT,
  lateralidad                TEXT NOT NULL DEFAULT 'no_aplica',
  diente                     TEXT,
  presupuesto                NUMERIC(12,2),
  diagnostico_indicacion     TEXT,
  procedimiento_realizado    TEXT,
  tecnica_utilizada          TEXT,
  hallazgos_previos          TEXT,
  anestesia                  TEXT NOT NULL DEFAULT 'ninguna',
  equipo_utilizado           TEXT,
  materiales_implantes       TEXT,
  dispositivo_implantado     TEXT,
  medicamento_administrado   TEXT,
  hallazgos_posteriores      TEXT,
  complicaciones             TEXT DEFAULT 'Ninguna',
  resultado_inmediato        TEXT,
  indicaciones_posteriores   TEXT,
  seguimiento_requerido      BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_proximo_control      DATE,
  referencia                 TEXT,
  consentimiento_informado   BOOLEAN NOT NULL DEFAULT FALSE,
  consentimiento_fecha       DATE,
  adjuntos                   JSONB NOT NULL DEFAULT '[]'::jsonb,
  origen_tabla               TEXT,
  origen_id                  BIGINT,
  clinica_id                 BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  creado_en                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS proc_clin_clinica_idx
  ON public.procedimientos_clinicos(clinica_id);
CREATE INDEX IF NOT EXISTS proc_clin_paciente_idx
  ON public.procedimientos_clinicos(paciente_id);
CREATE INDEX IF NOT EXISTS proc_clin_servicio_agenda_idx
  ON public.procedimientos_clinicos(clinica_id, servicio, fecha, estado);
CREATE INDEX IF NOT EXISTS proc_clin_control_idx
  ON public.procedimientos_clinicos(clinica_id, fecha_proximo_control)
  WHERE seguimiento_requerido = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS proc_clin_origen_uidx
  ON public.procedimientos_clinicos(origen_tabla, origen_id)
  WHERE origen_tabla IS NOT NULL AND origen_id IS NOT NULL;

ALTER TABLE public.procedimientos_clinicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procedimientos_clinicos_clinica" ON public.procedimientos_clinicos;
CREATE POLICY "procedimientos_clinicos_clinica" ON public.procedimientos_clinicos
  FOR ALL TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

-- Conserva el plan odontologico dentro del nuevo modelo comun.
DO $$
BEGIN
IF to_regclass('public.procedimientos_odontologicos') IS NOT NULL THEN
INSERT INTO public.procedimientos_clinicos (
  paciente_id, servicio, procedimiento, categoria, tipo, fecha, estado,
  diente, presupuesto, diagnostico_indicacion, clinica_id, origen_tabla, origen_id
)
SELECT paciente_id, 'odontologia', procedimiento, COALESCE(categoria, 'Odontologia'),
  'odontologico', fecha,
  CASE estado WHEN 'finalizado' THEN 'completado' WHEN 'iniciado' THEN 'en_procedimiento'
    WHEN 'cancelado' THEN 'cancelado' ELSE 'programado' END,
  diente, presupuesto, notas, clinica_id, 'procedimientos_odontologicos', id
FROM public.procedimientos_odontologicos
ON CONFLICT (origen_tabla, origen_id) WHERE origen_tabla IS NOT NULL AND origen_id IS NOT NULL DO NOTHING;
END IF;
END $$;

-- Conserva las notas oftalmologicas con toda su informacion estructurada.
DO $$
BEGIN
IF to_regclass('public.procedimientos_oftalmologicos') IS NOT NULL THEN
INSERT INTO public.procedimientos_clinicos (
  paciente_id, cita_id, servicio, procedimiento, categoria, tipo, especialidad,
  fecha, hora, profesional_id, profesional_nombre, rol_profesional, firma_url,
  estado, prioridad, sala, lateralidad, diagnostico_indicacion,
  procedimiento_realizado, tecnica_utilizada, hallazgos_previos, anestesia,
  equipo_utilizado, materiales_implantes, dispositivo_implantado,
  medicamento_administrado, hallazgos_posteriores, complicaciones,
  resultado_inmediato, indicaciones_posteriores, seguimiento_requerido,
  fecha_proximo_control, referencia, consentimiento_informado,
  consentimiento_fecha, adjuntos, clinica_id, creado_en, actualizado_en,
  origen_tabla, origen_id
)
SELECT paciente_id, cita_id,
  CASE WHEN tipo = 'optometrico' THEN 'optometria' ELSE 'oftalmologia' END,
  procedimiento, categoria, tipo, especialidad, fecha, hora, profesional_id,
  profesional_nombre, rol_profesional, firma_url, estado, prioridad, sala, ojo,
  diagnostico_indicacion, procedimiento_realizado, tecnica_utilizada,
  hallazgos_previos, anestesia, equipo_utilizado, materiales_implantes,
  dispositivo_implantado, medicamento_administrado, hallazgos_posteriores,
  complicaciones, resultado_inmediato, indicaciones_posteriores,
  seguimiento_requerido, fecha_proximo_control, referencia,
  consentimiento_informado, consentimiento_fecha, adjuntos, clinica_id,
  creado_en, actualizado_en, 'procedimientos_oftalmologicos', id
FROM public.procedimientos_oftalmologicos
ON CONFLICT (origen_tabla, origen_id) WHERE origen_tabla IS NOT NULL AND origen_id IS NOT NULL DO NOTHING;
END IF;
END $$;

-- Integra la tabla al historial si la función de auditoría ya está instalada.
DO $$
BEGIN
  IF to_regprocedure('public.registrar_historial_expediente()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_historial_proc_clinicos ON public.procedimientos_clinicos;
    CREATE TRIGGER trg_historial_proc_clinicos
      AFTER INSERT OR UPDATE OR DELETE ON public.procedimientos_clinicos
      FOR EACH ROW EXECUTE FUNCTION public.registrar_historial_expediente();
  END IF;
END $$;
