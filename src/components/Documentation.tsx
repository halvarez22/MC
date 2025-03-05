import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DocumentUploadForm } from './DocumentUploadForm';
import { DocumentsList } from './DocumentsList';

export function Documentation() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [selectedAffiliate, setSelectedAffiliate] = useState<string | null>(null);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAffiliates();
  }, []);

  async function fetchAffiliates() {
    try {
      setIsLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('affiliates')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      setError('Error al cargar los afiliados');
    } finally {
      setIsLoading(false);
    }
  }

  const handleAffiliateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedAffiliate(e.target.value);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-mc-orange"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Documentación</h1>
          <p className="mt-2 text-sm text-gray-700">
            Gestiona los documentos de los afiliados
          </p>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="bg-white shadow rounded-lg p-6">
        <div className="space-y-4">
          <div>
            <label htmlFor="affiliate" className="block text-sm font-medium text-gray-700">
              Seleccionar Afiliado
            </label>
            <select
              id="affiliate"
              name="affiliate"
              className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-mc-orange focus:border-mc-orange sm:text-sm rounded-md"
              value={selectedAffiliate || ''}
              onChange={handleAffiliateChange}
            >
              <option value="">Selecciona un afiliado</option>
              {affiliates.map((affiliate) => (
                <option key={affiliate.id} value={affiliate.id}>
                  {affiliate.first_name} {affiliate.last_name}
                </option>
              ))}
            </select>
          </div>

          {selectedAffiliate && (
            <div>
              <DocumentsList
                affiliateId={selectedAffiliate}
                affiliateName={
                  affiliates.find(a => a.id === selectedAffiliate)?.first_name + ' ' +
                  affiliates.find(a => a.id === selectedAffiliate)?.last_name
                }
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}