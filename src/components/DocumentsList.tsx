import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { PlusIcon, DocumentIcon, TrashIcon, ArrowDownTrayIcon, EyeIcon } from '@heroicons/react/24/outline';
import { DocumentUploadForm } from './DocumentUploadForm';
import { DocumentPreview } from './DocumentPreview';

interface Document {
  id: string;
  affiliate_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  upload_date: string;
  status: string;
  notes: string;
  document_type_name?: string;
  document_type_description?: string;
}

interface DocumentsListProps {
  affiliateId: string;
  affiliateName: string;
}

export function DocumentsList({ affiliateId, affiliateName }: DocumentsListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [documentTypes, setDocumentTypes] = useState<Record<string, any>>({});
  const [requiredDocuments, setRequiredDocuments] = useState<string[]>([]);
  const [missingDocuments, setMissingDocuments] = useState<string[]>([]);

  useEffect(() => {
    fetchDocuments();
    fetchDocumentTypes();
  }, [affiliateId]);

  async function fetchDocumentTypes() {
    try {
      const { data, error } = await supabase
        .from('document_types')
        .select('*');
        
      if (error) throw error;
      
      const typesMap: Record<string, any> = {};
      const requiredTypes: string[] = [];
      
      if (data) {
        data.forEach(type => {
          typesMap[type.id] = type;
          if (type.required) {
            requiredTypes.push(type.id);
          }
        });
      }
      
      setDocumentTypes(typesMap);
      setRequiredDocuments(requiredTypes);
    } catch (error) {
      console.error('Error fetching document types:', error);
    }
  }

  async function fetchDocuments() {
    try {
      setIsLoading(true);
      setError(null);
      
      // First, get all documents for this affiliate
      const { data: documentsData, error: documentsError } = await supabase
        .from('documents')
        .select('*')
        .eq('affiliate_id', affiliateId)
        .order('upload_date', { ascending: false });

      if (documentsError) throw documentsError;
      
      // Then, get all document types
      const { data: documentTypes, error: typesError } = await supabase
        .from('document_types')
        .select('*');
        
      if (typesError) throw typesError;
      
      // Create a map of document type IDs to their details
      const documentTypeMap: Record<string, any> = {};
      if (documentTypes) {
        documentTypes.forEach(type => {
          documentTypeMap[type.id] = type;
        });
      }
      
      // Combine the data
      const processedDocuments = documentsData?.map(doc => ({
        ...doc,
        document_type_name: documentTypeMap[doc.document_type]?.name || 'Tipo desconocido',
        document_type_description: documentTypeMap[doc.document_type]?.description || ''
      })) || [];
      
      setDocuments(processedDocuments);
      
      // Calculate missing required documents
      const requiredTypes = documentTypes?.filter(type => type.required).map(type => type.id) || [];
      const uploadedTypes = new Set(processedDocuments.map(doc => doc.document_type));
      const missing = requiredTypes.filter(typeId => !uploadedTypes.has(typeId));
      
      setMissingDocuments(missing);
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Error al cargar los documentos. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este documento?')) return;

    try {
      setError(null);
      
      // First, get the file path to delete from storage
      const { data: documentData } = await supabase
        .from('documents')
        .select('file_path')
        .eq('id', id)
        .single();
      
      if (documentData?.file_path) {
        // Delete the file from storage
        const { error: storageError } = await supabase.storage
          .from('documents')
          .remove([documentData.file_path.replace('documents/', '')]);
        
        if (storageError) {
          console.error('Error deleting file from storage:', storageError);
        }
      }
      
      // Delete the document record
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update the local state
      setDocuments(documents.filter(doc => doc.id !== id));
      
      // Recalculate missing documents
      const uploadedTypes = new Set(documents.filter(doc => doc.id !== id).map(doc => doc.document_type));
      const missing = requiredDocuments.filter(typeId => !uploadedTypes.has(typeId));
      setMissingDocuments(missing);
    } catch (error) {
      console.error('Error deleting document:', error);
      setError('Error al eliminar el documento. Por favor, intenta de nuevo.');
    }
  };

  const handleUploadFormClose = () => {
    setShowUploadForm(false);
    fetchDocuments();
  };

  const handleDownload = async (document: Document) => {
    try {
      setError(null);
      
      const filePath = document.file_path.replace('documents/', '');
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);
      
      if (error) throw error;
      
      // Create a download link and trigger the download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = document.file_name;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading document:', error);
      setError('Error al descargar el documento. Por favor, intenta de nuevo.');
    }
  };

  const handlePreview = async (document: Document) => {
    setPreviewDocument(document);
  };

  const closePreview = () => {
    setPreviewDocument(null);
  };

  const formatFileSize = (bytes: number) => {
    if (!bytes) return 'Desconocido';
    
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-mc-orange"></div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow rounded-lg p-6">
      <div className="sm:flex sm:items-center sm:justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Documentos de {affiliateName}</h2>
          <p className="mt-1 text-sm text-gray-500">
            Gestiona los documentos asociados a este afiliado.
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            type="button"
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-mc-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Subir Documento
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Missing Documents Alert */}
      {missingDocuments.length > 0 && (
        <div className="mb-6 rounded-md bg-yellow-50 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Documentos requeridos pendientes</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Este afiliado aún no ha subido los siguientes documentos requeridos:
                </p>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  {missingDocuments.map(typeId => (
                    <li key={typeId}>{documentTypes[typeId]?.name || 'Documento desconocido'}</li>
                  ))}
                </ul>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(true)}
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
                >
                  Subir documentos pendientes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {documents.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <DocumentIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No hay documentos</h3>
          <p className="mt-1 text-sm text-gray-500">
            Comienza subiendo documentos para este afiliado.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={() => setShowUploadForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
            >
              <PlusIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Subir Documento
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                  Tipo de Documento
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Nombre del Archivo
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Tamaño
                </th>
                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                  Fecha de Subida
                </th>
                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {documents.map((document) => (
                <tr key={document.id}>
                  <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                    <div className="flex items-center">
                      {document.document_type_name || 'Tipo desconocido'}
                      {documentTypes[document.document_type]?.required && (
                        <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          Requerido
                        </span>
                      )}
                    </div>
                    {document.notes && (
                      <p className="mt-1 text-xs text-gray-500">{document.notes}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {document.file_name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {formatFileSize(document.file_size)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                    {formatDate(document.upload_date)}
                  </td>
                  <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                    <button
                      onClick={() => handlePreview(document)}
                      className="text-mc-orange hover:text-mc-orange/90 mr-4"
                      title="Previsualizar"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDownload(document)}
                      className="text-mc-orange hover:text-mc-orange/90 mr-4"
                      title="Descargar"
                    >
                      <ArrowDownTrayIcon className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(document.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Eliminar"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showUploadForm && (
        <DocumentUploadForm
          affiliateId={affiliateId}
          onClose={handleUploadFormClose}
        />
      )}

      {previewDocument && (
        <DocumentPreview
          document={previewDocument}
          onClose={closePreview}
        />
      )}
    </div>
  );
}