/*
  # Configuración de la tabla de documentos

  1. Nueva Tabla
    - `documents`
      - `id` (uuid, primary key)
      - `affiliate_id` (uuid, foreign key)
      - `document_type` (uuid, foreign key)
      - `file_name` (text)
      - `file_path` (text)
      - `file_size` (bigint)
      - `file_type` (text)
      - `notes` (text)
      - `status` (text)
      - `upload_date` (timestamp)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Seguridad
    - Habilitar RLS
    - Políticas para usuarios autenticados
    - Políticas específicas para staff y admin
*/

-- Crear tabla de documentos
CREATE TABLE IF NOT EXISTS documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_id uuid REFERENCES affiliates(id) ON DELETE CASCADE,
  document_type uuid REFERENCES document_types(id),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  file_type text,
  notes text,
  status text DEFAULT 'active',
  upload_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(affiliate_id, document_type)
);

-- Habilitar Row Level Security
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Políticas de seguridad
CREATE POLICY "Staff puede ver todos los documentos"
  ON documents
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

CREATE POLICY "Staff puede gestionar documentos"
  ON documents
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'staff')
    )
  );

-- Trigger para actualizar updated_at
CREATE TRIGGER update_documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_documents_affiliate_id ON documents(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_documents_document_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);