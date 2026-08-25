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
