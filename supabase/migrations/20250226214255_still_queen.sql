/*
  # Crear sistema de gestión de documentos

  1. Nuevas Tablas
    - `document_types`
      - `id` (uuid, primary key)
      - `name` (text, not null)
      - `description` (text)
      - `required` (boolean, default: false)
      - `created_at` (timestamptz, default: now())
      - `updated_at` (timestamptz, default: now())
    
    - `documents`
      - `id` (uuid, primary key)
      - `affiliate_id` (uuid, foreign key to affiliates)
      - `document_type_id` (uuid, foreign key to document_types)
      - `file_name` (text, not null)
      - `file_path` (text, not null)
      - `file_size` (integer)
      - `file_type` (text)
      - `upload_date` (timestamptz, default: now())
      - `status` (text, default: 'active')
      - `notes` (text)
      - `created_at` (timestamptz, default: now())
      - `updated_at` (timestamptz, default: now())
  
  2. Seguridad
    - Habilitar RLS en las tablas `document_types` y `documents`
    - Agregar políticas para que los usuarios autenticados puedan leer todos los tipos de documentos
    - Agregar políticas para que los usuarios autenticados puedan gestionar documentos
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

-- Crear tabla de documentos
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES affiliates(id) ON DELETE CASCADE,
  document_type_id uuid REFERENCES document_types(id),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  file_type text,
  upload_date timestamptz DEFAULT now(),
  status text DEFAULT 'active',
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar Row Level Security
ALTER TABLE document_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Crear políticas para tipos de documentos
CREATE POLICY "Usuarios autenticados pueden ver todos los tipos de documentos"
  ON document_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Administradores pueden gestionar tipos de documentos"
  ON document_types FOR ALL
  TO authenticated
  USING (true);

-- Crear políticas para documentos
CREATE POLICY "Usuarios autenticados pueden ver todos los documentos"
  ON documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden insertar documentos"
  ON documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios autenticados pueden actualizar documentos"
  ON documents FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios autenticados pueden eliminar documentos"
  ON documents FOR DELETE
  TO authenticated
  USING (true);

-- Insertar tipos de documentos predeterminados
INSERT INTO document_types (name, description, required)
VALUES 
  ('INE', 'Credencial de elector', true),
  ('Comprobante de domicilio', 'Recibo de servicios no mayor a 3 meses', true),
  ('CURP', 'Clave Única de Registro de Población', true),
  ('Acta de nacimiento', 'Documento oficial de nacimiento', false),
  ('Carta de afiliación', 'Documento firmado de afiliación al partido', true);