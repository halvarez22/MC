import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

interface DocumentPreviewProps {
  document: any;
  onClose: () => void;
}

export function DocumentPreview({ document, onClose }: DocumentPreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDocumentPreview();
    
    // Cleanup function to revoke object URL when component unmounts
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [document]);

  async function loadDocumentPreview() {
    try {
      setIsLoading(true);
      setError(null);
      
      const filePath = document.file_path.replace('documents/', '');
      
      const { data, error } = await supabase.storage
        .from('documents')
        .download(filePath);
      
      if (error) throw error;
      
      // Create a preview URL
      const url = URL.createObjectURL(data);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Error loading document preview:', error);
      setError('Error al cargar la previsualización del documento.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleDownload = () => {
    if (!previewUrl) return;
    
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = document.file_name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const renderPreview = () => {
    if (!previewUrl) return null;
    
    const fileType = document.file_type;
    
    if (fileType.startsWith('image/')) {
      return (
        <img 
          src={previewUrl} 
          alt={document.file_name} 
          className="max-w-full max-h-[70vh] object-contain mx-auto"
        />
      );
    } else if (fileType === 'application/pdf') {
      return (
        <iframe 
          src={`${previewUrl}#toolbar=0`} 
          className="w-full h-[70vh]" 
          title={document.file_name}
        />
      );
    } else {
      return (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Vista previa no disponible</h3>
          <p className="mt-1 text-sm text-gray-500">
            Este tipo de archivo no puede ser previsualizado. Por favor, descarga el archivo para verlo.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleDownload}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
            >
              <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
              Descargar Archivo
            </button>
          </div>
        </div>
      );
    }
  };

  return (
    <Dialog as="div" className="relative z-10" open={true} onClose={onClose}>
      <div className="fixed inset-0 bg-black bg-opacity-75 transition-opacity" />
      
      <div className="fixed inset-0 z-10 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
          <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pt-5 pb-4 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl sm:p-6">
            <div className="absolute top-0 right-0 pt-4 pr-4">
              <button
                type="button"
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2"
                onClick={onClose}
              >
                <span className="sr-only">Cerrar</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
            
            <div className="sm:flex sm:items-start">
              <div className="mt-3 text-center sm:mt-0 sm:text-left w-full">
                <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                  {document.document_type_name}: {document.file_name}
                </Dialog.Title>
                
                <div className="mt-4">
                  {isLoading ? (
                    <div className="flex justify-center items-center h-64">
                      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-mc-orange"></div>
                    </div>
                  ) : error ? (
                    <div className="rounded-md bg-red-50 p-4">
                      <div className="text-sm text-red-700">{error}</div>
                      <div className="mt-4 flex justify-center">
                        <button
                          type="button"
                          onClick={handleDownload}
                          className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
                        >
                          <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                          Descargar Archivo
                        </button>
                      </div>
                    </div>
                  ) : (
                    renderPreview()
                  )}
                </div>
              </div>
            </div>
            
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
              <button
                type="button"
                className="inline-flex w-full justify-center rounded-md border border-transparent bg-mc-orange px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2 sm:ml-3 sm:w-auto sm:text-sm"
                onClick={handleDownload}
              >
                <ArrowDownTrayIcon className="-ml-1 mr-2 h-5 w-5" aria-hidden="true" />
                Descargar
              </button>
              <button
                type="button"
                className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2 sm:mt-0 sm:w-auto sm:text-sm"
                onClick={onClose}
              >
                Cerrar
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}