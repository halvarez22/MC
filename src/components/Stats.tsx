import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ChartBarIcon, UserGroupIcon, DocumentIcon, MapPinIcon } from '@heroicons/react/24/outline';

interface StatsProps {
  period?: 'week' | 'month' | 'year' | 'all';
  className?: string;
}

export function Stats({ period = 'all', className = '' }: StatsProps) {
  const [stats, setStats] = useState({
    totalAffiliates: 0,
    activeAffiliates: 0,
    totalDocuments: 0,
    documentCompletionRate: 0,
    newAffiliatesCount: 0,
    newDocumentsCount: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, [period]);

  async function fetchStats() {
    try {
      setIsLoading(true);
      setError(null);
      
      // Calculate date range based on period
      const now = new Date();
      let startDate: Date | null = null;
      
      if (period === 'week') {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
      } else if (period === 'month') {
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1);
      } else if (period === 'year') {
        startDate = new Date(now);
        startDate.setFullYear(now.getFullYear() - 1);
      }
      
      const startDateStr = startDate ? startDate.toISOString() : null;
      
      // Fetch total affiliates
      const { count: totalAffiliates, error: countError } = await supabase
        .from('affiliates')
        .select('*', { count: 'exact', head: true });
      
      if (countError) throw countError;
      
      // Fetch active affiliates
      const { count: activeAffiliates, error: activeError } = await supabase
        .from('affiliates')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');
      
      if (activeError) throw activeError;
      
      // Fetch total documents
      const { count: totalDocuments, error: docsError } = await supabase
        .from('documents')
        .select('*', { count: 'exact', head: true });
      
      if (docsError) throw docsError;
      
      // Fetch new affiliates in period
      let newAffiliatesCount = 0;
      if (startDateStr) {
        const { count, error: newAffiliatesError } = await supabase
          .from('affiliates')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDateStr);
        
        if (newAffiliatesError) throw newAffiliatesError;
        newAffiliatesCount = count || 0;
      } else {
        newAffiliatesCount = totalAffiliates || 0;
      }
      
      // Fetch new documents in period
      let newDocumentsCount = 0;
      if (startDateStr) {
        const { count, error: newDocsError } = await supabase
          .from('documents')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', startDateStr);
        
        if (newDocsError) throw newDocsError;
        newDocumentsCount = count || 0;
      } else {
        newDocumentsCount = totalDocuments || 0;
      }
      
      // Calculate document completion rate
      // For simplicity, we'll use a fixed calculation here
      // In a real app, you'd want to calculate this based on required documents per affiliate
      const documentCompletionRate = totalAffiliates && totalAffiliates > 0
        ? Math.min(100, Math.round((totalDocuments || 0) / (totalAffiliates * 3) * 100))
        : 0;
      
      setStats({
        totalAffiliates: totalAffiliates || 0,
        activeAffiliates: activeAffiliates || 0,
        totalDocuments: totalDocuments || 0,
        documentCompletionRate,
        newAffiliatesCount,
        newDocumentsCount
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Error al cargar las estadísticas');
    } finally {
      setIsLoading(false);
    }
  }

  if (isLoading) {
    return (
      <div className={`flex justify-center items-center h-24 ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-mc-orange"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`text-center py-4 ${className}`}>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-2 gap-4 sm:grid-cols-4 ${className}`}>
      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-5 w-5 text-mc-orange" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 truncate">
                Afiliados
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.totalAffiliates}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-2">
          <div className="text-xs text-gray-500">
            {period !== 'all' ? `+${stats.newAffiliatesCount} nuevos` : `${stats.activeAffiliates} activos`}
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <DocumentIcon className="h-5 w-5 text-mc-orange" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 truncate">
                Documentos
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.totalDocuments}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-2">
          <div className="text-xs text-gray-500">
            {period !== 'all' ? `+${stats.newDocumentsCount} nuevos` : `${(stats.totalAffiliates > 0 ? stats.totalDocuments / stats.totalAffiliates : 0).toFixed(1)} por afiliado`}
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <ChartBarIcon className="h-5 w-5 text-mc-orange" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 truncate">
                Documentación
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.documentCompletionRate}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-2">
          <div className="text-xs text-gray-500">
            Tasa de completitud
          </div>
        </div>
      </div>

      <div className="bg-white overflow-hidden shadow rounded-lg">
        <div className="p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <UserGroupIcon className="h-5 w-5 text-mc-orange" aria-hidden="true" />
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500 truncate">
                Activos
              </p>
              <p className="text-lg font-semibold text-gray-900">
                {stats.activeAffiliates}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-4 py-2">
          <div className="text-xs text-gray-500">
            {Math.round((stats.activeAffiliates / (stats.totalAffiliates || 1)) * 100)}% del total
          </div>
        </div>
      </div>
    </div>
  );
}