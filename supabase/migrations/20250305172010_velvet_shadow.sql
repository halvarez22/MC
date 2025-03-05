/*
  # Configuración de tipos de documentos

  1. Nueva Tabla
    - `document_types`
      - `id` (uuid, primary key)
      - `name` (text, nombre del tipo de documento)
      - `description` (text, descripción opcional)
      - `required` (boolean, si es requerido)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Seguridad
    - Habilitar RLS en la tabla
    - Agregar políticas para usuarios autenticados
    - Agregar políticas específicas para administradores

  3. Datos Iniciales
    - Insertar tipos de documentos básicos requeridos
*/

-- Crear tabla de tipos de documentos
CREATE TABLE IF NOT EXISTS document_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  required boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Usuarios autenticados pueden ver tipos de documentos"
  ON document_types
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Solo administradores pueden gestionar tipos de documentos"
  ON document_types
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Insertar tipos de documentos básicos
INSERT INTO document_types (name, description, required)
VALUES
  ('INE', 'Credencial de elector vigente', true),
  ('Comprobante de domicilio', 'No mayor a 3 meses de antigüedad', true),
  ('CURP', 'Clave Única de Registro de Población', true),
  ('Acta de nacimiento', 'Documento oficial de nacimiento', true),
  ('Carta de afiliación', 'Documento firmado de afiliación al partido', true),
  ('Fotografía', 'Fotografía reciente tipo credencial', false),
  ('Comprobante de estudios', 'Último grado de estudios', false),
  ('Curriculum Vitae', 'Historial profesional y académico', false)
ON CONFLICT (id) DO NOTHING;

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_document_types_updated_at
  BEFORE UPDATE ON document_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();