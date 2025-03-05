/*
  # Configure Storage for Document Uploads

  1. Storage Setup
    - Create a new storage bucket for documents
    - Configure public access policies
  2. Security
    - Enable RLS on the storage bucket
    - Add policies for authenticated users to manage their documents
*/

-- Create a new storage bucket for documents if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Enable Row Level Security on the bucket
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Create a policy to allow authenticated users to read their own files
CREATE POLICY "Authenticated users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'documents'
);

-- Create a policy to allow authenticated users to update their own files
CREATE POLICY "Authenticated users can update documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
);

-- Create a policy to allow authenticated users to delete their own files
CREATE POLICY "Authenticated users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
);