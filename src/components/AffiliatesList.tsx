import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AffiliateForm } from './AffiliateForm';
import { AffiliateDetail } from './AffiliateDetail';
import { Stats } from './Stats';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  DocumentTextIcon 
} from '@heroicons/react/24/outline';

export function AffiliatesList() {
  const [affiliates, setAffiliates] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewingAffiliateId, setViewingAffiliateId] = useState<string | null>(null);
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month' | 'year' | 'all'>('month');

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
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setAffiliates(data || []);
    } catch (error) {
      console.error('Error fetching affiliates:', error);
      setError('Error al cargar los afiliados. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleEdit = (affiliate: any) => {
    setSelectedAffiliate(affiliate);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Estás seguro de que deseas eliminar este afiliado? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      setError(null);
      
      const { error } = await supabase
        .from('affiliates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // Update the local state
      setAffiliates(affiliates.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting affiliate:', error);
      setError('Error al eliminar el afiliado. Por favor, intenta de nuevo.');
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedAffiliate(null);
    fetchAffiliates();
  };

  const handleViewDetail = (id: string) => {
    setViewingAffiliateId(id);
  };

  const handleBackToList = () => {
    setViewingAffiliateId(null);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return 'Fecha inválida';
    }
  };

  const filteredAffiliates = affiliates.filter(affiliate => {
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      affiliate.first_name.toLowerCase().includes(searchLower) ||
      affiliate.last_name.toLowerCase().includes(searchLower) ||
      (affiliate.email && affiliate.email.toLowerCase().includes(searchLower)) ||
      (affiliate.phone && affiliate.phone.includes(searchTerm)) ||
      (affiliate.city && affiliate.city.toLowerCase().includes(searchLower)) ||
      (affiliate.state && affiliate.state.toLowerCase().includes(searchLower))
    );
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-mc-orange"></div>
      </div>
    );
  }

  if (viewingAffiliateId) {
    return (
      <AffiliateDetail 
        affiliateId={viewingAffiliateId} 
        onBack={handleBackToList} 
      />
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-xl font-semibold text-gray-900">Afiliados</h1>
          <p className="mt-2 text-sm text-gray-700">
            Lista de todos los afiliados registrados en el sistema.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-mc-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2 sm:w-auto"
          >
            <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
            Nuevo Afiliado
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div className="mt-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-medium text-gray-900">Estadísticas</h2>
          <div className="flex space-x-2">
            <button
              onClick={() => setStatsPeriod('week')}
              className={`px-3 py-1 text-sm rounded-md ${
                statsPeriod === 'week' 
                  ? 'bg-mc-orange text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Semana
            </button>
            <button
              onClick={() => setStatsPeriod('month')}
              className={`px-3 py-1 text-sm rounded-md ${
                statsPeriod === 'month' 
                  ? 'bg-mc-orange text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Mes
            </button>
            <button
              onClick={() => setStatsPeriod('year')}
              className={`px-3 py-1 text-sm rounded-md ${
                statsPeriod === 'year' 
                  ? 'bg-mc-orange text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Año
            </button>
            <button
              onClick={() => setStatsPeriod('all')}
              className={`px-3 py-1 text-sm rounded-md ${
                statsPeriod === 'all' 
                  ? 'bg-mc-orange text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Total
            </button>
          </div>
        </div>
        <Stats period={statsPeriod} />
      </div>

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      <div className="mt-4">
        <div className="relative rounded-md shadow-sm">
          <input
            type="text"
            className="block w-full rounded-md border-gray-300 pl-10 focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
            placeholder="Buscar afiliados..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {filteredAffiliates.length === 0 ? (
        <div className="mt-8 text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500">
            {searchTerm 
              ? 'No se encontraron afiliados que coincidan con la búsqueda.' 
              : 'No hay afiliados registrados. Agrega uno nuevo para comenzar.'}
          </p>
        </div>
      ) : (
        <div className="mt-8 flex flex-col">
          <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
              <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table className="min-w-full divide-y divide-gray-300">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                        Nombre
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Teléfono
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Ciudad
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Estado
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Fecha de Afiliación
                      </th>
                      <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                        Estado
                      </th>
                      <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Acciones</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {filteredAffiliates.map((affiliate) => (
                      <tr key={affiliate.id}>
                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                          {affiliate.first_name} {affiliate.last_name}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{affiliate.email || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{affiliate.phone || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{affiliate.city || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{affiliate.state || '-'}</td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          {affiliate.membership_date ? formatDate(affiliate.membership_date) : '-'}
                        </td>
                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                          <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                            affiliate.status === 'active' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {affiliate.status === 'active' ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleViewDetail(affiliate.id)}
                            className="text-mc-orange hover:text-mc-orange/90 mr-3"
                            title="Ver detalles"
                          >
                            <DocumentTextIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleEdit(affiliate)}
                            className="text-mc-orange hover:text-mc-orange/90 mr-3"
                            title="Editar"
                          >
                            <PencilIcon className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(affiliate.id)}
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
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <AffiliateForm
          affiliate={selectedAffiliate}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}