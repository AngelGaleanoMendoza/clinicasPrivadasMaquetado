-- ============================================================
-- LUMEA MED — Activar Row Level Security (RLS)
-- Pegar y ejecutar en: Supabase > SQL Editor
-- ============================================================

-- PASO 1: Funciones helper (SECURITY DEFINER evita recursión)
-- ============================================================

-- No se eliminan estas funciones: las politicas existentes dependen de ellas.
-- CREATE OR REPLACE permite volver a ejecutar el arreglo sin tocar datos.
CREATE OR REPLACE FUNCTION public.get_my_clinica_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.clinica_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
     OR (
       auth.uid() IS NOT NULL
       AND lower(p.email) = lower(nullif(auth.jwt() ->> 'email', ''))
     )
  ORDER BY (p.id = auth.uid()) DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE auth.uid() IS NOT NULL
      AND (
        p.id = auth.uid()
        OR lower(p.email) = lower(nullif(auth.jwt() ->> 'email', ''))
      )
      AND (
        p.rol = 'superadmin'
        OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'sebasgale65@gmail.com'
      )
  );
$$;

-- PASO 2: RLS por tabla
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- id = auth.uid() va PRIMERO y es lo que salva el arranque: sin esta condición,
-- un usuario cuya fila tenga clinica_id NULL no puede leer ni su propio perfil
-- (en SQL, NULL = NULL da NULL, no verdadero), el login se queda sin perfil y la
-- app responde "contraseña incorrecta" aunque la contraseña sea correcta.
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (id = auth.uid() OR is_superadmin() OR clinica_id = get_my_clinica_id());
CREATE POLICY "profiles_insert" ON public.profiles FOR INSERT WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE USING (is_superadmin() OR clinica_id = get_my_clinica_id());
CREATE POLICY "profiles_delete" ON public.profiles FOR DELETE USING (is_superadmin() OR clinica_id = get_my_clinica_id());

-- pacientes
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pacientes_clinica" ON public.pacientes
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- citas
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "citas_clinica" ON public.citas
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- medicaciones
ALTER TABLE public.medicaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "medicaciones_clinica" ON public.medicaciones
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- notas
ALTER TABLE public.notas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notas_clinica" ON public.notas
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- expediente
ALTER TABLE public.expediente ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expediente_clinica" ON public.expediente
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- inventario
ALTER TABLE public.inventario ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventario_clinica" ON public.inventario
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- inventario_movimientos
ALTER TABLE public.inventario_movimientos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inv_movimientos_clinica" ON public.inventario_movimientos
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- finanzas
ALTER TABLE public.finanzas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finanzas_clinica" ON public.finanzas
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- facturas
ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facturas_clinica" ON public.facturas
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- factura_items (no tiene clinica_id propio, se filtra a través de facturas)
ALTER TABLE public.factura_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "factura_items_clinica" ON public.factura_items
  USING (
    is_superadmin() OR
    factura_id IN (SELECT id FROM public.facturas WHERE clinica_id = get_my_clinica_id())
  )
  WITH CHECK (
    is_superadmin() OR
    factura_id IN (SELECT id FROM public.facturas WHERE clinica_id = get_my_clinica_id())
  );

-- clinicas (superadmin ve todas; otros solo la suya)
ALTER TABLE public.clinicas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clinicas_select" ON public.clinicas FOR SELECT USING (is_superadmin() OR id = get_my_clinica_id());
CREATE POLICY "clinicas_admin_only" ON public.clinicas FOR ALL USING (is_superadmin());

-- examenes (exámenes digitalizados del expediente)
-- Mismo aislamiento por clínica que el resto del expediente clínico.
ALTER TABLE public.examenes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "examenes_clinica" ON public.examenes
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- Clasificación y contexto clínico de los documentos digitalizados.
-- Se mantienen `tipo`, `titulo` y `notas` para compatibilidad con registros
-- anteriores; las nuevas columnas permiten filtrar y relacionar cada estudio.
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS categoria TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS origen TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS centro_laboratorio TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS profesional_responsable TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS hallazgos TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS conclusion TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS relacion_tipo TEXT;
-- Es TEXT porque puede apuntar a citas, notas o tablas de procedimientos y se
-- guarda con prefijo, por ejemplo: cita:25, nota:18, odonto:7 u oft:4.
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS relacion_id TEXT;
ALTER TABLE public.examenes ADD COLUMN IF NOT EXISTS relacion_descripcion TEXT;

CREATE INDEX IF NOT EXISTS idx_examenes_clinica_paciente_fecha
  ON public.examenes (clinica_id, paciente_id, fecha DESC);

-- ============================================================
-- PASO 3: Columnas de configuración de clínica
-- La pantalla de Configuración guarda estos datos en Supabase (antes solo
-- quedaban en el navegador). Si faltan, el formulario guarda el resto y avisa.
-- ============================================================
ALTER TABLE public.clinicas ADD COLUMN IF NOT EXISTS en_produccion BOOLEAN DEFAULT FALSE;
ALTER TABLE public.clinicas ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clinicas ADD COLUMN IF NOT EXISTS firma_url TEXT;


-- ============================================================
-- PASO 4: RLS que faltaba en tablas ya en uso
-- Estas tablas se crearon sin política y quedaron abiertas entre clínicas:
-- cualquier clínica podía leer el odontograma, la historia dental y la
-- actividad de las demás. Se cierran con la misma plantilla que el resto.
-- ============================================================
ALTER TABLE public.procedimientos_odontologicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procedimientos_odontologicos_clinica" ON public.procedimientos_odontologicos;
CREATE POLICY "procedimientos_odontologicos_clinica" ON public.procedimientos_odontologicos
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.historial_dental ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "historial_dental_clinica" ON public.historial_dental;
CREATE POLICY "historial_dental_clinica" ON public.historial_dental
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.odontograma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "odontograma_clinica" ON public.odontograma;
CREATE POLICY "odontograma_clinica" ON public.odontograma
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.periodontograma ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "periodontograma_clinica" ON public.periodontograma;
CREATE POLICY "periodontograma_clinica" ON public.periodontograma
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.actividad_usuarios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "actividad_usuarios_clinica" ON public.actividad_usuarios;
CREATE POLICY "actividad_usuarios_clinica" ON public.actividad_usuarios
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());
-- ============================================================
-- PASO 5: OFTALMOLOGIA - procedimientos y quirofano
-- Registro estructurado para optometria, diagnostico, laser, procedimientos
-- invasivos y cirugia. No comparte tabla con procedimientos odontologicos.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.procedimientos_oftalmologicos (
  id                         BIGSERIAL PRIMARY KEY,
  paciente_id                BIGINT NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  cita_id                    BIGINT REFERENCES public.citas(id) ON DELETE SET NULL,
  procedimiento              TEXT NOT NULL,
  categoria                  TEXT NOT NULL,
  tipo                       TEXT NOT NULL,
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
  ojo                        TEXT NOT NULL DEFAULT 'no_aplica',
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
  clinica_id                 BIGINT NOT NULL REFERENCES public.clinicas(id) ON DELETE CASCADE,
  creado_en                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Compatibilidad si la primera versión de la tabla ya se había ejecutado.
ALTER TABLE public.procedimientos_oftalmologicos ADD COLUMN IF NOT EXISTS firma_url TEXT;

CREATE INDEX IF NOT EXISTS proc_oft_clinica_idx
  ON public.procedimientos_oftalmologicos(clinica_id);
CREATE INDEX IF NOT EXISTS proc_oft_paciente_idx
  ON public.procedimientos_oftalmologicos(paciente_id);
CREATE INDEX IF NOT EXISTS proc_oft_agenda_idx
  ON public.procedimientos_oftalmologicos(clinica_id, fecha, estado);
CREATE INDEX IF NOT EXISTS proc_oft_control_idx
  ON public.procedimientos_oftalmologicos(clinica_id, fecha_proximo_control)
  WHERE seguimiento_requerido = TRUE;

ALTER TABLE public.procedimientos_oftalmologicos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "procedimientos_oftalmologicos_clinica" ON public.procedimientos_oftalmologicos;
CREATE POLICY "procedimientos_oftalmologicos_clinica" ON public.procedimientos_oftalmologicos
  FOR ALL
  TO authenticated
  USING (public.is_superadmin() OR clinica_id = public.get_my_clinica_id())
  WITH CHECK (public.is_superadmin() OR clinica_id = public.get_my_clinica_id());

-- PASO 6: LUMEA MED VETERINARY — tablas propias
-- El paciente veterinario es la MASCOTA y su dueño es el CLIENTE.
-- Todo se aísla por clinica_id igual que el resto del sistema.
-- ============================================================

-- clientes (propietarios de las mascotas)
CREATE TABLE IF NOT EXISTS public.clientes (
  id             BIGSERIAL PRIMARY KEY,
  nombre         TEXT NOT NULL,
  apellidos      TEXT,
  identificacion TEXT,
  telefono       TEXT,
  telefono_alt   TEXT,
  email          TEXT,
  direccion      TEXT,
  notas          TEXT,
  estado         TEXT DEFAULT 'activo',
  fecha_registro DATE DEFAULT CURRENT_DATE,
  clinica_id     BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS clientes_clinica_idx ON public.clientes(clinica_id);

-- mascotas (el paciente veterinario)
CREATE TABLE IF NOT EXISTS public.mascotas (
  id                 BIGSERIAL PRIMARY KEY,
  cliente_id         BIGINT REFERENCES public.clientes(id) ON DELETE SET NULL,
  nombre             TEXT NOT NULL,
  especie            TEXT,
  raza               TEXT,
  sexo               TEXT,
  fecha_nac          DATE,
  color              TEXT,
  microchip          TEXT,
  esterilizado       TEXT DEFAULT 'no',
  senas_particulares TEXT,
  alergias           TEXT,
  observaciones      TEXT,
  estado             TEXT DEFAULT 'activo',
  foto_url           TEXT,
  expediente         TEXT,
  fecha_registro     DATE DEFAULT CURRENT_DATE,
  clinica_id         BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS mascotas_clinica_idx ON public.mascotas(clinica_id);
CREATE INDEX IF NOT EXISTS mascotas_cliente_idx ON public.mascotas(cliente_id);

-- expediente_mascota (una fila por mascota, como el expediente humano)
CREATE TABLE IF NOT EXISTS public.expediente_mascota (
  id                    BIGSERIAL PRIMARY KEY,
  mascota_id            BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE,
  peso                  NUMERIC,
  temperatura           NUMERIC,
  fc                    INTEGER,
  fr                    INTEGER,
  condicion_corporal    INTEGER,
  enfermedades_cronicas TEXT,
  cirugias_previas      TEXT,
  dieta                 TEXT,
  ambiente              TEXT,
  convive_con           TEXT,
  reproductivo          TEXT,
  temperamento          TEXT,
  observaciones_medicas TEXT,
  clinica_id            BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE,
  UNIQUE (mascota_id, clinica_id)
);
CREATE INDEX IF NOT EXISTS expediente_mascota_clinica_idx ON public.expediente_mascota(clinica_id);

-- vacunas_mascota (carnet de vacunación con próxima dosis)
CREATE TABLE IF NOT EXISTS public.vacunas_mascota (
  id             BIGSERIAL PRIMARY KEY,
  mascota_id     BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE,
  vacuna         TEXT NOT NULL,
  fecha          DATE,
  proxima_dosis  DATE,
  lote           TEXT,
  laboratorio    TEXT,
  veterinario_id UUID,
  notas          TEXT,
  clinica_id     BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS vacunas_mascota_clinica_idx ON public.vacunas_mascota(clinica_id);
CREATE INDEX IF NOT EXISTS vacunas_mascota_mascota_idx ON public.vacunas_mascota(mascota_id);

-- desparasitaciones (mismo molde que las vacunas)
CREATE TABLE IF NOT EXISTS public.desparasitaciones (
  id              BIGSERIAL PRIMARY KEY,
  mascota_id      BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE,
  producto        TEXT NOT NULL,
  tipo            TEXT,
  fecha           DATE,
  proxima_dosis   DATE,
  peso_aplicacion NUMERIC,
  veterinario_id  UUID,
  notas           TEXT,
  clinica_id      BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS desparasitaciones_clinica_idx ON public.desparasitaciones(clinica_id);
CREATE INDEX IF NOT EXISTS desparasitaciones_mascota_idx ON public.desparasitaciones(mascota_id);

-- hospitalizaciones (internamiento)
CREATE TABLE IF NOT EXISTS public.hospitalizaciones (
  id             BIGSERIAL PRIMARY KEY,
  mascota_id     BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE,
  motivo         TEXT,
  fecha_ingreso  DATE,
  fecha_alta     DATE,
  jaula          TEXT,
  estado         TEXT DEFAULT 'ingresado',
  veterinario_id UUID,
  notas          TEXT,
  clinica_id     BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS hospitalizaciones_clinica_idx ON public.hospitalizaciones(clinica_id);

-- hospitalizacion_seguimiento (control por turnos)
CREATE TABLE IF NOT EXISTS public.hospitalizacion_seguimiento (
  id                 BIGSERIAL PRIMARY KEY,
  hospitalizacion_id BIGINT REFERENCES public.hospitalizaciones(id) ON DELETE CASCADE,
  fecha_hora         TIMESTAMPTZ DEFAULT NOW(),
  temperatura        NUMERIC,
  notas              TEXT,
  medicacion         TEXT,
  usuario            TEXT,
  clinica_id         BIGINT REFERENCES public.clinicas(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS hosp_seg_clinica_idx ON public.hospitalizacion_seguimiento(clinica_id);

-- Políticas RLS de las tablas veterinarias (misma plantilla que el resto)
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clientes_clinica" ON public.clientes
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.mascotas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mascotas_clinica" ON public.mascotas
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.expediente_mascota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expediente_mascota_clinica" ON public.expediente_mascota
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.vacunas_mascota ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vacunas_mascota_clinica" ON public.vacunas_mascota
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.desparasitaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "desparasitaciones_clinica" ON public.desparasitaciones
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.hospitalizaciones ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospitalizaciones_clinica" ON public.hospitalizaciones
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

ALTER TABLE public.hospitalizacion_seguimiento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hosp_seguimiento_clinica" ON public.hospitalizacion_seguimiento
  USING (is_superadmin() OR clinica_id = get_my_clinica_id())
  WITH CHECK (is_superadmin() OR clinica_id = get_my_clinica_id());

-- ============================================================
-- PASO 7: Columnas añadidas a tablas existentes
-- Todas nullable: las clínicas humanas siguen funcionando igual.
-- El código reintenta sin ellas si todavía no existen (_faltaColumna).
-- ============================================================
ALTER TABLE public.citas        ADD COLUMN IF NOT EXISTS mascota_id BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE;
ALTER TABLE public.citas        ADD COLUMN IF NOT EXISTS duracion_min SMALLINT DEFAULT 30;
ALTER TABLE public.citas        ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT;
-- Una cita veterinaria no tiene paciente_id (tiene mascota_id en su lugar).
-- Si paciente_id ya era NOT NULL, esto lo libera; si ya era nullable, no hace nada.
ALTER TABLE public.citas ALTER COLUMN paciente_id DROP NOT NULL;
ALTER TABLE public.notas        ADD COLUMN IF NOT EXISTS mascota_id BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS mascota_id BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE;
-- Cada lote de medicamentos pertenece a una receta y conserva una instantánea
-- del profesional que la emitió. No se usa FK en prescriptor_id para que una
-- receta histórica sobreviva si el perfil del médico se elimina o migra.
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS receta_id TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS fecha_emision DATE;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_id TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_nombre TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_especialidad TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS prescriptor_firma_url TEXT;
CREATE INDEX IF NOT EXISTS medicaciones_receta_id_idx ON public.medicaciones(receta_id);
ALTER TABLE public.examenes     ADD COLUMN IF NOT EXISTS mascota_id BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE;
ALTER TABLE public.facturas     ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.profiles     ADD COLUMN IF NOT EXISTS horario JSONB;
ALTER TABLE public.profiles     ADD COLUMN IF NOT EXISTS recetario_url TEXT;
ALTER TABLE public.profiles     ADD COLUMN IF NOT EXISTS recetario_config JSONB;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS recetario_url TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS recetario_config JSONB;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS diagnostico TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS receta_notas TEXT;
ALTER TABLE public.medicaciones ADD COLUMN IF NOT EXISTS proxima_cita DATE;
ALTER TABLE public.clinicas     ADD COLUMN IF NOT EXISTS horario JSONB;

-- Nota para v2: la validación de solapes de citas es de cliente. Para cerrarla
-- de verdad haría falta una restricción de exclusión en Postgres:
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
--   ALTER TABLE public.citas ADD CONSTRAINT citas_sin_solape
--     EXCLUDE USING gist (medico_id WITH =, clinica_id WITH =,
--       tsrange(fecha + hora, fecha + hora + (duracion_min||' min')::interval) WITH &&)
--     WHERE (estado NOT IN ('cancelada','no_asistio'));
-- Queda fuera de v1 porque el error de constraint llega sin traducir al formulario.


-- Aquí vivía un "PASO 8" que volvía a crear profiles_select SIN reconocer al
-- usuario por el correo de su token. Ejecutado suelto deshacía el arreglo del
-- paso siguiente y dejaba a la gente fuera; se eliminó para que no vuelva a
-- pasar. La versión buena es la de abajo.


-- ============================================================
-- PASO 8: Desbloqueo definitivo del login (candado circular)
--
-- El problema: si `profiles.id` no coincide con el UUID de Supabase Auth,
-- ninguna de las tres ramas de la política deja leer la fila —
--   · id = auth.uid()            → falso, los ids no coinciden
--   · is_superadmin()            → busca por id, no encuentra fila, da falso
--   · clinica_id = get_my_...()  → get_my_clinica_id() también busca por id
--                                  y devuelve NULL; NULL = NULL da NULL
-- …y la app tampoco puede repararlo sola, porque para escribir el id correcto
-- primero tendría que poder LEER la fila. Candado circular.
--
-- La salida es reconocer al usuario también por el email de su token, que
-- Supabase Auth firma y el navegador no puede falsificar.
-- Se puede ejecutar varias veces sin error.
-- ============================================================

-- 8.1 — Los helpers reconocen al usuario por id O por email del token
CREATE OR REPLACE FUNCTION public.get_my_clinica_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p.clinica_id
  FROM public.profiles AS p
  WHERE p.id = auth.uid()
     OR (
       auth.uid() IS NOT NULL
       AND lower(p.email) = lower(nullif(auth.jwt() ->> 'email', ''))
     )
  ORDER BY (p.id = auth.uid()) DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles AS p
    WHERE auth.uid() IS NOT NULL
      AND (
        p.id = auth.uid()
        OR lower(p.email) = lower(nullif(auth.jwt() ->> 'email', ''))
      )
      AND (
        p.rol = 'superadmin'
        OR lower(coalesce(auth.jwt() ->> 'email', '')) = 'sebasgale65@gmail.com'
      )
  );
$$;

-- 8.2 — Ver el propio perfil aunque el id todavía no esté sincronizado
DROP POLICY IF EXISTS "profiles_select" ON public.profiles;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR (auth.uid() IS NOT NULL
        AND lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
    OR is_superadmin()
    OR clinica_id = get_my_clinica_id()
  );

-- 8.3 — Y poder corregir el propio id (es lo que hace resolverPerfil al entrar)
DROP POLICY IF EXISTS "profiles_update" ON public.profiles;
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE
  USING (
    id = auth.uid()
    OR (auth.uid() IS NOT NULL
        AND lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
    OR is_superadmin()
    OR clinica_id = get_my_clinica_id()
  )
  WITH CHECK (
    id = auth.uid()
    OR (auth.uid() IS NOT NULL
        AND lower(email) = lower(nullif(auth.jwt() ->> 'email', '')))
    OR is_superadmin()
    OR clinica_id = get_my_clinica_id()
  );

-- 8.4 — Reparación de una sola vez: alinear profiles.id con el UUID de Auth
-- arrastrando las columnas que apuntan a él, para no dejar citas huérfanas.
-- Solo toca filas cuyo email coincide y cuyo id NO coincide.
DO $$
DECLARE
  f RECORD;
BEGIN
  FOR f IN
    SELECT p.id AS viejo, u.id AS nuevo
    FROM public.profiles p
    JOIN auth.users u ON lower(u.email) = lower(p.email)
    WHERE p.id IS DISTINCT FROM u.id
      AND NOT EXISTS (SELECT 1 FROM public.profiles p2 WHERE p2.id = u.id)
  LOOP
    UPDATE public.profiles SET id = f.nuevo WHERE id = f.viejo;

    IF to_regclass('public.citas') IS NOT NULL THEN
      UPDATE public.citas SET medico_id = f.nuevo WHERE medico_id = f.viejo;
    END IF;
    IF to_regclass('public.actividad_usuarios') IS NOT NULL THEN
      UPDATE public.actividad_usuarios SET user_id = f.nuevo WHERE user_id = f.viejo;
    END IF;
    IF to_regclass('public.vacunas_mascota') IS NOT NULL THEN
      UPDATE public.vacunas_mascota SET veterinario_id = f.nuevo WHERE veterinario_id = f.viejo;
    END IF;
    IF to_regclass('public.desparasitaciones') IS NOT NULL THEN
      UPDATE public.desparasitaciones SET veterinario_id = f.nuevo WHERE veterinario_id = f.viejo;
    END IF;
    IF to_regclass('public.hospitalizaciones') IS NOT NULL THEN
      UPDATE public.hospitalizaciones SET veterinario_id = f.nuevo WHERE veterinario_id = f.viejo;
    END IF;

    RAISE NOTICE 'Perfil realineado: % -> %', f.viejo, f.nuevo;
  END LOOP;
END $$;

-- 8.5 — Comprobación: no debe quedar ninguna fila con "id_desalineado" = true
SELECT p.email, p.rol, p.clinica_id,
       (u.id IS NULL)              AS sin_cuenta_en_auth,
       (u.id IS NOT NULL
        AND p.id IS DISTINCT FROM u.id) AS id_desalineado
FROM public.profiles p
LEFT JOIN auth.users u ON lower(u.email) = lower(p.email)
ORDER BY p.email;


-- ============================================================
-- PASO 9: Archivos adjuntos (Storage)
--
-- El bucket `Pacientes` guarda fotos de paciente, firmas, exámenes
-- digitalizados, fotos de mascota y los adjuntos de los procedimientos
-- oftalmológicos. Las políticas de Storage se habían creado a mano en el
-- Dashboard y solo cubrían las rutas que existían entonces, así que cada
-- carpeta nueva fallaba con "new row violates row-level security policy".
-- Aquí quedan escritas para que no se repita al añadir la siguiente.
--
-- El nombre del bucket lleva mayúscula: Supabase distingue caja.
-- Se puede ejecutar varias veces sin error.
-- ============================================================

DROP POLICY IF EXISTS "pacientes_leer"      ON storage.objects;
DROP POLICY IF EXISTS "pacientes_subir"     ON storage.objects;
DROP POLICY IF EXISTS "pacientes_reemplazar" ON storage.objects;
DROP POLICY IF EXISTS "pacientes_borrar"    ON storage.objects;

-- Leer: hace falta para las subidas con upsert. Antes de escribir, Storage
-- comprueba si el objeto ya existe, y esa consulta va contra storage.objects
-- bajo la sesión del usuario. Sin esta política el upsert se rechaza entero.
-- Que el bucket sea público rige el enlace de descarga, no esta comprobación.
CREATE POLICY "pacientes_leer" ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'Pacientes');

-- Subir: cualquier usuario autenticado, en cualquier carpeta del bucket.
-- No se acota por clínica porque las rutas antiguas no la llevan en el nombre
-- (la foto del paciente se guarda como "<id>.jpg" en la raíz).
CREATE POLICY "pacientes_subir" ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'Pacientes');

-- Reemplazar: hace falta para las subidas con upsert (foto de paciente,
-- firma del usuario, logo y firma de la clínica, foto de mascota).
CREATE POLICY "pacientes_reemplazar" ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'Pacientes')
  WITH CHECK (bucket_id = 'Pacientes');

-- Borrar: al quitar un adjunto de un procedimiento o eliminar el registro.
CREATE POLICY "pacientes_borrar" ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'Pacientes');

-- La LECTURA se deja como está. La aplicación usa getPublicUrl() en todas
-- partes, así que el bucket es público de lectura: quien tenga el enlace ve el
-- archivo sin iniciar sesión. Cambiarlo a privado exigiría pasar toda la app a
-- URLs firmadas (createSignedUrl) y romper los enlaces ya guardados en la base;
-- queda anotado como pendiente porque aquí se almacenan imágenes clínicas.


-- ============================================================
-- PASO 10: Blindaje del Super Admin
--
-- El rol del Super Admin se había quedado vacío más de una vez, y con él
-- vacío is_superadmin() lo deja fuera de todas las tablas. Como es la única
-- cuenta que puede desbloquear a los demás, no hay nadie por encima que pueda
-- devolverle el acceso: hay que entrar por SQL a repararlo.
--
-- Aquí se garantiza por base de datos, no por costumbre:
--   · su rol siempre vuelve a 'superadmin'
--   · nunca queda bloqueado ni acumula intentos fallidos
--   · su fila no se puede borrar
--   · nadie más puede otorgarse el rol 'superadmin' a sí mismo
--
-- Se puede ejecutar varias veces sin error.
-- ============================================================

-- El correo va en una sola función para no repetirlo por el archivo. Es el
-- mismo que la app fija en SUPER_ADMIN_EMAIL.
CREATE OR REPLACE FUNCTION public.super_admin_email()
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT 'sebasgale65@gmail.com';
$$;

-- Distingue una petición del navegador de una ejecución desde el SQL Editor.
-- Sin esto, los propios arreglos por SQL quedarían bloqueados por el candado.
CREATE OR REPLACE FUNCTION public.es_peticion_del_navegador()
RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claims', true), '') IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.proteger_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  -- 1) La fila del Super Admin conserva su rol pase lo que pase
  IF lower(btrim(coalesce(OLD.email, NEW.email))) = public.super_admin_email() THEN
    NEW.rol := 'superadmin';
    NEW.bloqueado := FALSE;
    NEW.intentos_fallidos := 0;
    -- Cambiarle el correo desharía el anclaje: sólo se permite desde SQL,
    -- donde hace falta un acto deliberado y no un descuido de la interfaz.
    IF public.es_peticion_del_navegador() THEN
      NEW.email := OLD.email;
    END IF;
  END IF;

  -- 2) Nadie se asciende a sí mismo. Sólo un Super Admin puede repartir el rol,
  -- y desde el SQL Editor se permite para poder reparar la instalación.
  IF NEW.rol = 'superadmin'
     AND coalesce(OLD.rol, '') <> 'superadmin'
     AND lower(btrim(coalesce(NEW.email, ''))) <> public.super_admin_email()
     AND public.es_peticion_del_navegador()
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Solo un Super Admin puede otorgar el rol superadmin';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_super_admin ON public.profiles;
CREATE TRIGGER trg_proteger_super_admin
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_super_admin();

-- Mismo candado al crear usuarios: no se puede nacer con el rol
CREATE OR REPLACE FUNCTION public.proteger_alta_superadmin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NEW.rol = 'superadmin'
     AND lower(btrim(coalesce(NEW.email, ''))) <> public.super_admin_email()
     AND public.es_peticion_del_navegador()
     AND NOT public.is_superadmin() THEN
    RAISE EXCEPTION 'Solo un Super Admin puede crear otro Super Admin';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proteger_alta_superadmin ON public.profiles;
CREATE TRIGGER trg_proteger_alta_superadmin
  BEFORE INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.proteger_alta_superadmin();

-- Y su fila no se borra
CREATE OR REPLACE FUNCTION public.impedir_borrar_super_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF lower(btrim(coalesce(OLD.email, ''))) = public.super_admin_email() THEN
    RAISE EXCEPTION 'No se puede eliminar la cuenta del Super Admin';
  END IF;
  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS trg_impedir_borrar_super_admin ON public.profiles;
CREATE TRIGGER trg_impedir_borrar_super_admin
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.impedir_borrar_super_admin();

-- Dejar la fila en su sitio ahora mismo
UPDATE public.profiles
SET rol = 'superadmin'
WHERE lower(btrim(email)) = public.super_admin_email();

-- Comprobación: debe devolver rol='superadmin', bloqueado=false
SELECT email, rol, bloqueado, intentos_fallidos
FROM public.profiles
WHERE lower(btrim(email)) = public.super_admin_email();


-- ============================================================
-- PASO 11: Índices de rendimiento — las tablas núcleo nunca los tuvieron
--
-- loadAll() filtra por clinica_id en 10 consultas paralelas, y se llama en
-- 47 sitios del código (cada vez que se guarda un paciente, una cita, una
-- nota...). Sin índice, cada una de esas consultas es un recorrido completo
-- de la tabla ENTERA del sistema —de todas las clínicas juntas—, no solo de
-- la fila que cambió. Crece con el sistema entero, no con lo que usa cada
-- clínica. pacientes, citas, medicaciones, notas y expediente se traen SIN
-- límite en cada llamada; profiles, inventario, finanzas, facturas e
-- inventario_movimientos también se consultan por clinica_id, con límite las
-- tres últimas. Ninguna de las nueve tenía índice: son anteriores a este
-- archivo y las que se añadieron después (veterinaria, exámenes,
-- oftalmología) sí lo llevaban.
--
-- Aparte y seguro de ejecutar solo, sin afectar datos ni políticas.
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_pacientes_clinica    ON public.pacientes(clinica_id);
CREATE INDEX IF NOT EXISTS idx_citas_clinica         ON public.citas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_notas_clinica         ON public.notas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_expediente_clinica    ON public.expediente(clinica_id);
CREATE INDEX IF NOT EXISTS idx_profiles_clinica      ON public.profiles(clinica_id);
CREATE INDEX IF NOT EXISTS idx_inventario_clinica    ON public.inventario(clinica_id);
CREATE INDEX IF NOT EXISTS idx_finanzas_clinica      ON public.finanzas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_facturas_clinica      ON public.facturas(clinica_id);
CREATE INDEX IF NOT EXISTS idx_medicaciones_clinica  ON public.medicaciones(clinica_id);
CREATE INDEX IF NOT EXISTS idx_inv_mov_clinica_fecha ON public.inventario_movimientos(clinica_id, fecha DESC);

-- profiles.email: is_superadmin() y get_my_clinica_id() lo consultan en
-- CADA fila de CADA tabla protegida por RLS, es decir, en casi cada consulta
-- de la aplicación entera.
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(lower(btrim(email)));

-- Comprobación: deben aparecer los 11 índices nuevos
SELECT indexname, tablename FROM pg_indexes
WHERE schemaname = 'public' AND indexname LIKE 'idx_%'
ORDER BY tablename;
