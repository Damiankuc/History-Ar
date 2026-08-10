-- ========================================================
-- Opción B: Integración Nativa con Supabase Auth (UUID) - Corregido
-- Copiar y ejecutar este script en el SQL Editor de Supabase
-- ========================================================

-- 1. Eliminar primero todas las políticas existentes para permitir modificar columnas
DROP POLICY IF EXISTS "Allow anon all on pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Allow anon all on consultas" ON public.consultas;
DROP POLICY IF EXISTS "Allow anon all on recetas" ON public.recetas;
DROP POLICY IF EXISTS "Allow anon all on citas" ON public.citas;
DROP POLICY IF EXISTS "Allow anon all on documentos" ON public.documentos;

DROP POLICY IF EXISTS "Permitir auto-registro publico por QR" ON public.pacientes;
DROP POLICY IF EXISTS "Medicos gestionan solo sus pacientes" ON public.pacientes;
DROP POLICY IF EXISTS "Medicos gestionan solo consultas de sus pacientes" ON public.consultas;
DROP POLICY IF EXISTS "Medicos gestionan solo recetas de sus pacientes" ON public.recetas;
DROP POLICY IF EXISTS "Medicos gestionan solo citas de sus pacientes" ON public.citas;
DROP POLICY IF EXISTS "Medicos gestionan solo documentos de sus pacientes" ON public.documentos;
DROP POLICY IF EXISTS "Permitir auto-registro publico de documentos por QR" ON public.documentos;

-- 2. Eliminar la restricción de clave foránea previa si existía con BIGINT
ALTER TABLE public.pacientes DROP CONSTRAINT IF EXISTS pacientes_usuario_id_fkey;

-- 3. Convertir la columna usuario_id a tipo UUID
ALTER TABLE public.pacientes 
  ALTER COLUMN usuario_id TYPE UUID USING (
    CASE 
      WHEN usuario_id IS NULL THEN NULL 
      WHEN usuario_id::text ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN usuario_id::text::uuid 
      ELSE NULL 
    END
  );

-- 4. (Opcional) Vincular usuario_id directamente a la tabla auth.users nativa de Supabase
ALTER TABLE public.pacientes 
  ADD CONSTRAINT pacientes_usuario_id_fkey 
  FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 5. Habilitar Row Level Security (RLS) en todas las tablas
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recetas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

-- 6. Crear Políticas RLS puras de UUID (directas con auth.uid())

-- A. TABLA PACIENTES
-- Permite que los pacientes se auto-registren por QR (INSERT sin revelar otros datos)
CREATE POLICY "Permitir auto-registro publico por QR" 
ON public.pacientes 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Médicos autenticados ven y gestionan únicamente sus pacientes asignados
CREATE POLICY "Medicos gestionan solo sus pacientes" 
ON public.pacientes 
FOR ALL 
TO authenticated 
USING (usuario_id = auth.uid()) 
WITH CHECK (usuario_id = auth.uid());

-- B. TABLA CONSULTAS (HISTORIAS CLÍNICAS)
CREATE POLICY "Medicos gestionan solo consultas de sus pacientes" 
ON public.consultas 
FOR ALL 
TO authenticated 
USING (
  paciente_id IN (
    SELECT id FROM public.pacientes WHERE usuario_id = auth.uid()
  )
) 
WITH CHECK (
  paciente_id IN (
    SELECT id FROM public.pacientes WHERE usuario_id = auth.uid()
  )
);

-- C. TABLA RECETAS MÉDICAS
CREATE POLICY "Medicos gestionan solo recetas de sus pacientes" 
ON public.recetas 
FOR ALL 
TO authenticated 
USING (
  paciente_id IN (
    SELECT id FROM public.pacientes WHERE usuario_id = auth.uid()
  )
);

-- D. TABLA CITAS / AGENDA
CREATE POLICY "Medicos gestionan solo citas de sus pacientes" 
ON public.citas 
FOR ALL 
TO authenticated 
USING (
  paciente_id IN (
    SELECT id FROM public.pacientes WHERE usuario_id = auth.uid()
  )
);

-- E. TABLA DOCUMENTOS ADJUNTOS
-- Permite que los pacientes adjunten documentos/estudios al auto-registrarse por QR
CREATE POLICY "Permitir auto-registro publico de documentos por QR" 
ON public.documentos 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

-- Médicos autenticados gestionan documentos de sus pacientes
CREATE POLICY "Medicos gestionan solo documentos de sus pacientes" 
ON public.documentos 
FOR ALL 
TO authenticated 
USING (
  paciente_id IN (
    SELECT id FROM public.pacientes WHERE usuario_id = auth.uid()
  )
);
