import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DocumentsList } from './DocumentsList';
import { PencilIcon, ArrowLeftIcon, DocumentArrowUpIcon } from '@heroicons/react/24/outline';
import { AffiliateForm } from './AffiliateForm';
import { DocumentUploadForm } from './DocumentUploadForm';

interface AffiliateDetailProps {
  affiliateId: string;
  onBack: () => void;
}

export function AffiliateDetail({ affiliateId, onBack }: AffiliateDetailProps) {
  const [affiliate, setAffiliate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    fetchAffiliate();
  }, [affiliateId]);

  async function fetchAffiliate() {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .eq('id', affiliateId)
        .single();

      if (error) throw error;
      
      setAffiliate(data);
    } catch (error) {
      console.error('Error fetching affiliate:', error);
      setError('Error al cargar los datos del afiliado. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleEditFormClose = () => {
    setShowEditForm(false);
    fetchAffiliate();
  };

  const handleUploadFormClose = () => {
    setShowUploadForm(false);
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

  if (error || !affiliate) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <p className="text-red-500">{error || 'No se encontró el afiliado'}</p>
          <button
            onClick={onBack}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90"
          >
            <ArrowLeftIcon className="-ml-1 mr-2 h-5 w-5" />
            Volver a la lista
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
          >
            <ArrowLeftIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Volver
          </button>
          <h1 className="ml-4 text-2xl font-bold text-gray-900">
            Detalle del Afiliado
          </h1>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowEditForm(true)}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
          >
            <PencilIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Editar
          </button>
          <button
            onClick={() => setShowUploadForm(true)}
            className="inline-flex items-center px-3 py-2 border border-transparent shadow-sm text-sm leading-4 font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
          >
            <DocumentArrowUpIcon className="-ml-0.5 mr-2 h-4 w-4" />
            Subir Documentos
          </button>
        </div>
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Información Personal
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Datos personales y de contacto.
            </p>
          </div>
        </div>
        <div className="border-t border-gray-200 px-4 py-5 sm:p-0">
          <dl className="sm:divide-y sm:divide-gray-200">
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Nombre completo</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {affiliate.first_name} {affiliate.last_name}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Email</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {affiliate.email || 'No especificado'}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Teléfono</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {affiliate.phone || 'No especificado'}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Dirección</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {affiliate.address || 'No especificada'}
                {affiliate.city && `, ${affiliate.city}`}
                {affiliate.state && `, ${affiliate.state}`}
                {affiliate.postal_code && ` ${affiliate.postal_code}`}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Fecha de afiliación</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {affiliate.membership_date ? formatDate(affiliate.membership_date) : 'No especificada'}
              </dd>
            </div>
            <div className="py-4 sm:py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Estado</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                  affiliate.status === 'active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {affiliate.status === 'active' ? 'Activo' : 'Inactivo'}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </div>

      <DocumentsList 
        affiliateId={affiliateId} 
        affiliateName={`${affiliate.first_name} ${affiliate.last_name}`} 
      />

      {showEditForm && (
        <AffiliateForm
          affiliate={affiliate}
          onClose={handleEditFormClose}
        />
      )}

      {showUploadForm && (
        <DocumentUploadForm
          affiliateId={affiliateId}
          onClose={handleUploadFormClose}
        />
      )}
    </div>
  );
}