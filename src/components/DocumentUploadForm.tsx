import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { XMarkIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';

interface DocumentType {
  id: string;
  name: string;
  description: string;
  required: boolean;
}

interface DocumentUploadFormProps {
  affiliateId: string;
  onClose: () => void;
}

export function DocumentUploadForm({ affiliateId, onClose }: DocumentUploadFormProps) {
  const [documentTypes, setDocumentTypes] = useState<DocumentType[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    document_type: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoadingTypes, setIsLoadingTypes] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    fetchDocumentTypes();
  }, []);

  async function fetchDocumentTypes() {
    try {
      setIsLoadingTypes(true);
      
      const { data, error } = await supabase
        .from('document_types')
        .select('*')
        .order('name');

      if (error) throw error;
      
      setDocumentTypes(data || []);
      
      // Set default document type if available
      if (data && data.length > 0) {
        setFormData(prev => ({ ...prev, document_type: data[0].id }));
      }
    } catch (error) {
      console.error('Error fetching document types:', error);
      setError('Error al cargar los tipos de documentos.');
    } finally {
      setIsLoadingTypes(false);
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo es demasiado grande. El tamaño máximo permitido es 10MB.');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Tipo de archivo no permitido. Por favor, sube un archivo PDF, PNG, JPG o DOCX.');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setError('Por favor, selecciona un archivo para subir.');
      return;
    }
    
    if (!formData.document_type) {
      setError('Por favor, selecciona un tipo de documento.');
      return;
    }
    
    setLoading(true);
    setError(null);
    setUploadProgress(0);
    
    try {
      // 1. Upload file to storage
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
      const filePath = `${affiliateId}/${fileName}`;
      
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return prev;
          }
          return prev + 10;
        });
      }, 300);
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(filePath, selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      if (uploadError) throw uploadError;
      
      // 2. Get the public URL
      const { data: publicUrlData } = supabase.storage
        .from('documents')
        .getPublicUrl(filePath);
      
      // 3. Create document record in database
      const { error: insertError } = await supabase
        .from('documents')
        .insert([{
          affiliate_id: affiliateId,
          document_type: formData.document_type,
          file_name: selectedFile.name,
          file_path: `documents/${filePath}`,
          file_size: selectedFile.size,
          file_type: selectedFile.type,
          notes: formData.notes,
          status: 'active',
          upload_date: new Date().toISOString()
        }]);
      
      if (insertError) throw insertError;
      
      // Wait a moment to show 100% progress
      setTimeout(() => {
        onClose();
      }, 500);
    } catch (error) {
      console.error('Error uploading document:', error);
      setError('Error al subir el documento. Por favor, intenta de nuevo.');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError('El archivo es demasiado grande. El tamaño máximo permitido es 10MB.');
        return;
      }
      
      // Validate file type
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
      if (!allowedTypes.includes(file.type)) {
        setError('Tipo de archivo no permitido. Por favor, sube un archivo PDF, PNG, JPG o DOCX.');
        return;
      }
      
      setSelectedFile(file);
      setError(null);
    }
  };

  return (
    <Dialog as="div" className="relative z-10" open={true} onClose={onClose}>
      <div className="fixed inset-0 bg-black bg-opacity-25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                Subir Documento
              </Dialog.Title>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={onClose}
                disabled={loading}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {isLoadingTypes ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-mc-orange"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label htmlFor="document_type" className="block text-sm font-medium text-gray-700">
                    Tipo de Documento
                  </label>
                  <select
                    id="document_type"
                    name="document_type"
                    value={formData.document_type}
                    onChange={handleInputChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  >
                    {documentTypes.map(type => (
                      <option key={type.id} value={type.id}>
                        {type.name} {type.required ? '(Requerido)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="file" className="block text-sm font-medium text-gray-700">
                    Archivo
                  </label>
                  <div 
                    className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                  >
                    <div className="space-y-1 text-center">
                      <DocumentArrowUpIcon className="mx-auto h-12 w-12 text-gray-400" />
                      <div className="flex text-sm text-gray-600">
                        <label
                          htmlFor="file"
                          className="relative cursor-pointer bg-white rounded-md font-medium text-mc-orange hover:text-mc-orange/90 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-mc-orange"
                        >
                          <span>Seleccionar archivo</span>
                          <input
                            id="file"
                            name="file"
                            type="file"
                            className="sr-only"
                            onChange={handleFileChange}
                            required
                          />
                        </label>
                        <p className="pl-1">o arrastra y suelta</p>
                      </div>
                      <p className="text-xs text-gray-500">
                        PDF, PNG, JPG, DOCX hasta 10MB
                      </p>
                    </div>
                  </div>
                  {selectedFile && (
                    <p className="mt-2 text-sm text-gray-500">
                      Archivo seleccionado: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                    Notas (opcional)
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    value={formData.notes}
                    onChange={handleInputChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                    placeholder="Agrega notas o comentarios sobre este documento"
                  />
                </div>

                {loading && (
                  <div className="mt-4">
                    <div className="relative pt-1">
                      <div className="flex mb-2 items-center justify-between">
                        <div>
                          <span className="text-xs font-semibold inline-block text-mc-orange">
                            Subiendo archivo
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-semibold inline-block text-mc-orange">
                            {uploadProgress}%
                          </span>
                        </div>
                      </div>
                      <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
                        <div 
                          style={{ width: `${uploadProgress}%` }} 
                          className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-mc-orange transition-all duration-300"
                        ></div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2"
                    disabled={loading}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="rounded-md border border-transparent bg-mc-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2"
                    disabled={loading}
                  >
                    {loading ? 'Subiendo...' : 'Subir Documento'}
                  </button>
                </div>
              </form>
            )}
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}