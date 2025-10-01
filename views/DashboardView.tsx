import React, { useState, useEffect } from 'react';
import { firebaseService } from '../services/firebaseService';
import { DashboardMetrics } from '../types';
import Spinner from '../components/ui/Spinner';
import Card from '../components/ui/Card';
import StatCard from '../components/dashboard/StatCard';
import AffiliationChart from '../components/dashboard/AffiliationChart';
import GeoDistributionChart from '../components/dashboard/GeoDistributionChart';
import RecentAffiliates from '../components/dashboard/RecentAffiliates';
import { ICONS } from '../constants';

const DashboardView: React.FC = () => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const data = await firebaseService.getDashboardMetrics();
        setMetrics(data);
      } catch (err) {
        setError('No se pudieron cargar las métricas del dashboard.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  if (loading) {
    return <Spinner />;
  }

  if (error || !metrics) {
    return <div className="text-red-500">{error || 'No hay datos disponibles.'}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Dashboard Ejecutivo</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <StatCard 
            title="Total de Afiliados" 
            value={metrics.totalAffiliates.toLocaleString('es-MX')} 
            icon={ICONS.users}
        />
        <StatCard 
            title="Afiliados Activos" 
            value={`${metrics.activePercentage}%`} 
            icon={ICONS.active}
        />
        <StatCard 
            title="Documentación Completa" 
            value={`${metrics.docsCompletePercentage}%`} 
            icon={ICONS.docs}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <h2 className="text-xl font-semibold mb-4">Crecimiento Mensual de Afiliados</h2>
          <AffiliationChart data={metrics.monthlyGrowth} />
        </Card>
        <Card className="lg:col-span-2">
           <h2 className="text-xl font-semibold mb-4">Distribución Geográfica</h2>
           <GeoDistributionChart data={metrics.geoDistribution} />
        </Card>
      </div>

       <Card>
           <h2 className="text-xl font-semibold mb-4">Afiliados Recientes</h2>
           <RecentAffiliates affiliates={metrics.recentAffiliates} />
       </Card>
    </div>
  );
};

export default DashboardView;