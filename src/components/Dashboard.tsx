import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChartBarIcon, UserGroupIcon, DocumentIcon, MapPinIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { Link } from 'react-router-dom';

interface DashboardStats {
  totalAffiliates: number;
  activeAffiliates: number;
  inactiveAffiliates: number;
  totalDocuments: number;
  pendingDocuments: number;
  topStates: { state: string; count: number }[];
  recentAffiliates: any[];
  monthlyStats: { month: string; affiliates: number }[];
  documentCompletionRate: number;
}

export function Dashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalAffiliates: 0,
    activeAffiliates: 0,
    inactiveAffiliates: 0,
    totalDocuments: 0,
    pendingDocuments: 0,
    topStates: [],
    recentAffiliates: [],
    monthlyStats: [],
    documentCompletionRate: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    try {
      setIsLoading(true);
      setError(null);
      
      // Fetch total affiliates count
      const { count: totalAffiliates, error: countError } = await supabase
        .from('affiliates')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      // Fetch active affiliates count
      const { count: activeAffiliates, error: activeError } = await supabase
        .from('affiliates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (activeError) throw activeError;
      
      // Fetch documents count
      const { count: totalDocuments, error: docsError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (docsError) throw docsError;
      
      // Fetch document types to determine required documents
      const { data: documentTypes, error: typesError } = await supabase
        .from('document_types')
        .select('*')
        .eq('required', true);
        
      if (typesError) throw typesError;
      
      const requiredDocTypes = documentTypes?.length || 0;
      
      // Fetch all affiliates to calculate state distribution and monthly stats
      const { data: affiliatesData, error: affiliatesError } = await supabase
        .from('affiliates')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (affiliatesError) throw affiliatesError;
      
      // Calculate state distribution
      const stateCount: Record<string, number> = {};
      affiliatesData?.forEach(affiliate => {
        if (affiliate.state) {
          stateCount[affiliate.state] = (stateCount[affiliate.state] || 0) + 1;
        }
      });
      
      // Convert to array and sort
      const topStates = Object.entries(stateCount)
        .map(([state, count]) => ({ state, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      // Calculate monthly stats for the last 6 months
      const monthlyStats = calculateMonthlyStats(affiliatesData || []);
      
      // Fetch all documents to calculate completion rate
      const { data: documents, error: allDocsError } = await supabase
        .from('documents')
        .select('affiliate_id, document_type');
      
      if (allDocsError) throw allDocsError;
      
      // Calculate document completion rate
      const documentCompletionRate = calculateDocumentCompletionRate(
        affiliatesData || [], 
        documents || [], 
        requiredDocTypes
      );
      
      // Get recent affiliates (already sorted by created_at desc)
      const recentAffiliates = (affiliatesData || []).slice(0, 5);
      
      setStats({
        totalAffiliates: totalAffiliates || 0,
        activeAffiliates: activeAffiliates || 0,
        inactiveAffiliates: (totalAffiliates || 0) - (activeAffiliates || 0),
        totalDocuments: totalDocuments || 0,
        pendingDocuments: 0,
        topStates: topStates || [],
        recentAffiliates: recentAffiliates || [],
        monthlyStats,
        documentCompletionRate
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setError('Error al cargar los datos del dashboard. Por favor, intenta de nuevo.');
    } finally {
      setIsLoading(false);
    }
  }

  // Calculate monthly stats for the last 6 months
  function calculateMonthlyStats(affiliates: any[]) {
    const months: { [key: string]: number } = {};
    const today = new Date();
    
    // Initialize last 6 months with 0 affiliates
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleString('es-MX', { month: 'short', year: 'numeric' });
      months[monthKey] = 0;
    }
    
    // Count affiliates by month
    affiliates.forEach(affiliate => {
      if (affiliate.created_at) {
        const date = new Date(affiliate.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (months[monthKey] !== undefined) {
          months[monthKey]++;
        }
      }
    });
    
    // Convert to array format for chart
    return Object.entries(months).map(([key, count]) => {
      const [year, month] = key.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, 1);
      return {
        month: date.toLocaleString('es-MX', { month: 'short', year: 'numeric' }),
        affiliates: count
      };
    });
  }

  // Calculate document completion rate
  function calculateDocumentCompletionRate(affiliates: any[], documents: any[], requiredDocTypes: number) {
    if (affiliates.length === 0 || requiredDocTypes === 0) return 0;
    
    // Count documents by affiliate
    const docsByAffiliate: { [key: string]: Set<string> } = {};
    
    documents.forEach(doc => {
      if (!docsByAffiliate[doc.affiliate_id]) {
        docsByAffiliate[doc.affiliate_id] = new Set();
      }
      docsByAffiliate[doc.affiliate_id].add(doc.document_type);
    });
    
    // Count affiliates with complete documentation
    let completeCount = 0;
    
    affiliates.forEach(affiliate => {
      const uniqueDocTypes = docsByAffiliate[affiliate.id]?.size || 0;
      if (uniqueDocTypes >= requiredDocTypes) {
        completeCount++;
      }
    });
    
    return Math.round((completeCount / affiliates.length) * 100);
  }

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('es-MX', {
        year: 'numeric',
        month: 'short',
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

  if (error) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <UserGroupIcon className="h-6 w-6 text-mc-orange" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Afiliados</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.totalAffiliates}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-green-700">{stats.activeAffiliates} activos</span>
              <span className="mx-2 text-gray-500">|</span>
              <span className="font-medium text-red-700">{stats.inactiveAffiliates} inactivos</span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DocumentIcon className="h-6 w-6 text-mc-orange" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Total Documentos</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.totalDocuments}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-700">
                {(stats.totalAffiliates > 0) 
                  ? `${(stats.totalDocuments / stats.totalAffiliates).toFixed(1)} documentos por afiliado`
                  : 'Sin afiliados'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <MapPinIcon className="h-6 w-6 text-mc-orange" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Estados Representados</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">{stats.topStates.length}</div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-700">
                {stats.topStates.length > 0 
                  ? `Estado principal: ${stats.topStates[0]?.state || 'N/A'}`
                  : 'Sin datos de estados'}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ChartBarIcon className="h-6 w-6 text-mc-orange" aria-hidden="true" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">Documentación Completa</dt>
                  <dd>
                    <div className="text-lg font-medium text-gray-900">
                      {stats.documentCompletionRate}%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/reports" className="font-medium text-mc-orange hover:text-mc-orange/90">
                Ver reportes detallados
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Growth Chart */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Crecimiento Mensual de Afiliados
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {stats.monthlyStats.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay datos disponibles</p>
          ) : (
            <div className="h-64">
              <div className="h-full flex items-end">
                {stats.monthlyStats.map((item, index) => {
                  const maxValue = Math.max(...stats.monthlyStats.map(s => s.affiliates));
                  const height = maxValue > 0 ? (item.affiliates / maxValue) * 100 : 0;
                  
                  return (
                    <div key={index} className="flex-1 flex flex-col items-center">
                      <div className="relative w-full flex justify-center">
                        <div 
                          className="bg-mc-orange rounded-t w-16"
                          style={{ height: `${Math.max(5, height)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-500 mt-2 text-center">
                        {item.month}
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        {item.affiliates}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Top States */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Distribución por Estados
          </h3>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {stats.topStates.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay datos de estados disponibles</p>
          ) : (
            <div className="space-y-4">
              {stats.topStates.map((stateData) => (
                <div key={stateData.state} className="relative">
                  <div className="flex items-center justify-between mb-1">
                    <div className="text-sm font-medium text-gray-700">{stateData.state}</div>
                    <div className="text-sm font-medium text-gray-700">{stateData.count} afiliados</div>
                  </div>
                  <div className="overflow-hidden h-2 text-xs flex rounded bg-gray-200">
                    <div 
                      style={{ 
                        width: `${Math.min(100, (stateData.count / stats.totalAffiliates) * 100)}%` 
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

      {/* Recent Affiliates */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:px-6 border-b border-gray-200 flex justify-between items-center">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            Afiliados Recientes
          </h3>
          <Link 
            to="/affiliates" 
            className="text-sm font-medium text-mc-orange hover:text-mc-orange/90"
          >
            Ver todos
          </Link>
        </div>
        <div className="px-4 py-5 sm:p-6">
          {stats.recentAffiliates.length === 0 ? (
            <p className="text-gray-500 text-center py-4">No hay afiliados registrados</p>
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
                      Fecha
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {stats.recentAffiliates.map((affiliate) => (
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(affiliate.created_at)}
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}