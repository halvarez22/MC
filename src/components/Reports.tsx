import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { DocumentArrowDownIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

interface ReportFilters {
  state: string;
  city: string;
  status: string;
  documentStatus: string;
}

interface ReportData {
  affiliates: any[];
  documentStats: {
    totalDocuments: number;
    completeAffiliates: number;
    incompleteAffiliates: number;
    documentsByType: Record<string, number>;
  };
  states: string[];
  cities: string[];
}

export function Reports() {
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reportData, setReportData] = useState<ReportData>({
    affiliates: [],
    documentStats: {
      totalDocuments: 0,
      completeAffiliates: 0,
      incompleteAffiliates: 0,
      documentsByType: {}
    },
    states: [],
    cities: []
  });
  const [filters, setFilters] = useState<ReportFilters>({
    state: '',
    city: '',
    status: '',
    documentStatus: ''
  });

  useEffect(() => {
    fetchReportData();
  }, []);

  async function fetchReportData() {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch all affiliates with their documents count
      const { data: affiliatesData, error: affiliatesError } = await supabase
        .from('affiliates')
        .select(`
          *,
          documents:documents(count)
        `);
      
      if (affiliatesError) throw affiliatesError;
      
      // Fetch document types
      const { data: documentTypes, error: typesError } = await supabase
        .from('document_types')
        .select('*');
      
      if (typesError) throw typesError;
      
      // Calculate document stats
      const requiredDocumentTypes = documentTypes?.filter(type => type.required) || [];
      const requiredDocCount = requiredDocumentTypes.length;
      
      // Process affiliates data
      const processedAffiliates = affiliatesData?.map(affiliate => {
        const documentCount = affiliate.documents?.[0]?.count || 0;
        const hasCompleteDocuments = documentCount >= requiredDocCount;
        
        return {
          ...affiliate,
          documentCount,
          hasCompleteDocuments
        };
      }) || [];
      
      // Extract unique states and cities
      const states = [...new Set(processedAffiliates.map(a => a.state).filter(Boolean))].sort();
      const cities = [...new Set(processedAffiliates.map(a => a.city).filter(Boolean))].sort();
      
      // Calculate document stats
      const completeAffiliates = processedAffiliates.filter(a => a.hasCompleteDocuments).length;
      const incompleteAffiliates = processedAffiliates.length - completeAffiliates;
      
      // Fetch documents to count by type
      const { data: documents, error: documentsError } = await supabase
        .from('documents')
        .select('document_type');
      
      if (documentsError) throw documentsError;
      
      // Calculate documents by type
      const documentsByType: Record<string, number> = {};
      
      // If we have documents, group them by document_type
      if (documents && documents.length > 0) {
        // Get all unique document type IDs from documents
        const documentTypeIds = [...new Set(documents.map(doc => doc.document_type))];
        
        // Create a map of document type IDs to names
        const documentTypeMap: Record<string, string> = {};
        if (documentTypes) {
          documentTypes.forEach(type => {
            documentTypeMap[type.id] = type.name;
          });
        }
        
        // Count documents by type
        documents.forEach(doc => {
          const typeName = documentTypeMap[doc.document_type] || 'Desconocido';
          documentsByType[typeName] = (documentsByType[typeName] || 0) + 1;
        });
      }
      
      // Set report data
      setReportData({
        affiliates: processedAffiliates,
        documentStats: {
          totalDocuments: documents?.length || 0,
          completeAffiliates,
          incompleteAffiliates,
          documentsByType
        },
        states,
        cities
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      setError('Error al cargar los datos del reporte. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const getFilteredAffiliates = () => {
    return reportData.affiliates.filter(affiliate => {
      // Filter by state
      if (filters.state && affiliate.state !== filters.state) {
        return false;
      }
      
      // Filter by city
      if (filters.city && affiliate.city !== filters.city) {
        return false;
      }
      
      // Filter by status
      if (filters.status && affiliate.status !== filters.status) {
        return false;
      }
      
      // Filter by document status
      if (filters.documentStatus === 'complete' && !affiliate.hasCompleteDocuments) {
        return false;
      }
      if (filters.documentStatus === 'incomplete' && affiliate.hasCompleteDocuments) {
        return false;
      }
      
      return true;
    });
  };

  const exportToCSV = () => {
    try {
      setIsExporting(true);
      
      const filteredAffiliates = getFilteredAffiliates();
      
      // Create CSV content
      const headers = [
        'ID', 
        'Nombre', 
        'Apellidos', 
        'Email', 
        'Teléfono', 
        'Dirección', 
        'Ciudad', 
        'Estado', 
        'Código Postal', 
        'Fecha de Afiliación', 
        'Estado', 
        'Documentos'
      ];
      
      const rows = filteredAffiliates.map(affiliate => [
        affiliate.id,
        affiliate.first_name,
        affiliate.last_name,
        affiliate.email || '',
        affiliate.phone || '',
        affiliate.address || '',
        affiliate.city || '',
        affiliate.state || '',
        affiliate.postal_code || '',
        affiliate.membership_date || '',
        affiliate.status === 'active' ? 'Activo' : 'Inactivo',
        affiliate.documentCount
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      ].join('\n');
      
      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `afiliados_reporte_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      setError('Error al exportar los datos. Por favor, intenta de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-mc-orange"></div>
      </div>
    );
  }

  const filteredAffiliates = getFilteredAffiliates();

  return (
    <div className="space-y-6">
      <div className="sm:flex sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
          <p className="mt-2 text-sm text-gray-700">
            Genera reportes y estadísticas sobre afiliados y documentación.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={fetchReportData}
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
          >
            <ArrowPathIcon className="-ml-1 mr-2 h-5 w-5 text-gray-500" />
            Actualizar
          </button>
          <button
            onClick={exportToCSV}
            disabled={isExporting}
            className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-mc-orange hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-mc-orange"
          >
            <DocumentArrowDownIcon className="-ml-1 mr-2 h-5 w-5" />
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="text-sm text-red-700">{error}</div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Filtros</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="state" className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              id="state"
              name="state"
              value={filters.state}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
            >
              <option value="">Todos los estados</option>
              {reportData.states.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="city" className="block text-sm font-medium text-gray-700">
              Ciudad
            </label>
            <select
              id="city"
              name="city"
              value={filters.city}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
            >
              <option value="">Todas las ciudades</option>
              {reportData.cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Estado
            </label>
            <select
              id="status"
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
            >
              <option value="">Todos</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          <div>
            <label htmlFor="documentStatus" className="block text-sm font-medium text-gray-700">
              Documentación
            </label>
            <select
              id="documentStatus"
              name="documentStatus"
              value={filters.documentStatus}
              onChange={handleFilterChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
            >
              <option value="">Todos</option>
              <option value="complete">Documentación completa</option>
              <option value="incomplete">Documentación incompleta</option>
            </select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Afiliados</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{filteredAffiliates.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Documentos Totales</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {filteredAffiliates.reduce((sum, a) => sum + a.documentCount, 0)}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Documentación Completa</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {filteredAffiliates.filter(a => a.hasCompleteDocuments).length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Documentación Incompleta</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {filteredAffiliates.filter(a => !a.hasCompleteDocuments).length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Resultados ({filteredAffiliates.length} afiliados)
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {filteredAffiliates.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay resultados que coincidan con los filtros seleccionados</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Nombre
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ubicación
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Documentos
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAffiliates.map((affiliate) => (
                    <tr key={affiliate.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {affiliate.first_name} {affiliate.last_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {affiliate.email || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {affiliate.city && affiliate.state 
                          ? `${affiliate.city}, ${affiliate.state}`
                          : affiliate.city || affiliate.state || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          affiliate.status === 'active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {affiliate.status === 'active' ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          affiliate.hasCompleteDocuments
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {affiliate.documentCount} documentos
                          {affiliate.hasCompleteDocuments ? ' (Completo)' : ' (Incompleto)'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Document Types Distribution */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Distribución por Tipo de Documento
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {Object.keys(reportData.documentStats.documentsByType).length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay documentos registrados</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(reportData.documentStats.documentsByType).map(([type, count]) => (
                <div key={type} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-gray-700">{type}</div>
                    <div className="text-sm font-medium text-gray-700">{count} documentos</div>
                  </div>
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div 
                      style={{ 
                        width: `${Math.min(100, (count / reportData.documentStats.totalDocuments) * 100)}%` 
                      }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-mc-orange"
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}