-- ============================================================
-- LUMEA MED — Activar Row Level Security (RLS)
-- Pegar y ejecutar en: Supabase > SQL Editor
-- ============================================================

-- PASO 1: Funciones helper (SECURITY DEFINER evita recursión)
-- ============================================================

DROP FUNCTION IF EXISTS get_my_clinica_id();
DROP FUNCTION IF EXISTS is_superadmin();

CREATE OR REPLACE FUNCTION get_my_clinica_id()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER STABLE
AS $$
  SELECT clinica_id FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION is_superadmin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND rol = 'superadmin'
  );
$$;

-- PASO 2: RLS por tabla
-- ============================================================

-- profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT USING (is_superadmin() OR clinica_id = get_my_clinica_id());
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
-- PASO 5: LUMEA MED VETERINARY — tablas propias
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
-- PASO 6: Columnas añadidas a tablas existentes
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
ALTER TABLE public.examenes     ADD COLUMN IF NOT EXISTS mascota_id BIGINT REFERENCES public.mascotas(id) ON DELETE CASCADE;
ALTER TABLE public.facturas     ADD COLUMN IF NOT EXISTS cliente_id BIGINT REFERENCES public.clientes(id) ON DELETE SET NULL;
ALTER TABLE public.profiles     ADD COLUMN IF NOT EXISTS horario JSONB;
ALTER TABLE public.clinicas     ADD COLUMN IF NOT EXISTS horario JSONB;

-- Nota para v2: la validación de solapes de citas es de cliente. Para cerrarla
-- de verdad haría falta una restricción de exclusión en Postgres:
--   CREATE EXTENSION IF NOT EXISTS btree_gist;
--   ALTER TABLE public.citas ADD CONSTRAINT citas_sin_solape
--     EXCLUDE USING gist (medico_id WITH =, clinica_id WITH =,
--       tsrange(fecha + hora, fecha + hora + (duracion_min||' min')::interval) WITH &&)
--     WHERE (estado NOT IN ('cancelada','no_asistio'));
-- Queda fuera de v1 porque el error de constraint llega sin traducir al formulario.
