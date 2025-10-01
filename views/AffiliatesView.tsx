// FIX: Implemented the AffiliatesView component to manage and display affiliates, resolving the 'not a module' error. The component includes state management, data fetching, filtering, and a modal for creating/editing affiliates.
import React, { useState, useEffect, useMemo } from 'react';
import { Affiliate, User } from '../types';
import { firebaseService } from '../services/firebaseService';
import { MEXICAN_STATES } from '../constants';
import Spinner from '../components/ui/Spinner';
import AffiliateTable from '../components/affiliates/AffiliateTable';
import AffiliateForm from '../components/affiliates/AffiliateForm';
import Modal from '../components/ui/Modal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import AffiliateDetailView from './AffiliateDetailView';

interface AffiliatesViewProps {
  user: User;
}

const ITEMS_PER_PAGE = 20;

const AffiliatesView: React.FC<AffiliatesViewProps> = ({ user }) => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [locationFilter, setLocationFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [affiliateForDetail, setAffiliateForDetail] = useState<Affiliate | null>(null);


  useEffect(() => {
    try {
      const unsubscribe = firebaseService.onAffiliatesSnapshot(data => {
        setAffiliates(data);
        setError(null);
        setLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setError('No se pudieron cargar los afiliados.');
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, locationFilter]);
  
  const handleOpenModalForCreate = () => {
    setSelectedAffiliate(null);
    setIsModalOpen(true);
  };
  
  const handleOpenModalForEdit = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setIsModalOpen(true);
  };

  const handleViewDetails = (affiliate: Affiliate) => {
    setAffiliateForDetail(affiliate);
    setViewMode('detail');
  };

  const handleBackToList = () => {
    setAffiliateForDetail(null);
    setViewMode('list');
  };
  
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedAffiliate(null);
  };

  const filteredAffiliates = useMemo(() => {
    const lowercasedFilter = searchTerm.trim().toLowerCase();

    return affiliates.filter(affiliate => {
      // Filtro de búsqueda por texto
      const matchesSearch = !lowercasedFilter ||
        affiliate.fullName.toLowerCase().includes(lowercasedFilter) ||
        affiliate.email.toLowerCase().includes(lowercasedFilter) ||
        affiliate.id.toLowerCase().includes(lowercasedFilter) ||
        affiliate.city.toLowerCase().includes(lowercasedFilter);

      // Filtro por estatus
      const matchesStatus = statusFilter === 'todos' || affiliate.status === statusFilter;

      // Filtro por ubicación (estado)
      const matchesLocation = locationFilter === 'todos' || affiliate.state === locationFilter;

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [affiliates, searchTerm, statusFilter, locationFilter]);

  const totalPages = Math.ceil(filteredAffiliates.length / ITEMS_PER_PAGE);
  const paginatedAffiliates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAffiliates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAffiliates, currentPage]);

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-500">{error}</div>;

  if (viewMode === 'detail' && affiliateForDetail) {
    return <AffiliateDetailView affiliate={affiliateForDetail} onBack={handleBackToList} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Gestión de Afiliados</h1>
          {user.role === 'admin' && (
             <Button onClick={handleOpenModalForCreate}>
                + Nuevo Afiliado
             </Button>
          )}
        </div>

        {/* Filtros */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-grow">
            <Input
              id="search"
              label="Buscar"
              placeholder="Buscar por nombre, email, ID, ciudad..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="w-full sm:w-auto">
            <label htmlFor="status-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Estatus
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value="todos">Todos los estatus</option>
              <option value="activo">Activo</option>
              <option value="inactivo">Inactivo</option>
            </select>
          </div>

          <div className="w-full sm:w-auto">
            <label htmlFor="location-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Ubicación
            </label>
            <select
              id="location-filter"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
            >
              <option value="todos">Todos los estados</option>
              {MEXICAN_STATES.map(state => (
                <option key={state} value={state}>{state}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      
      <AffiliateTable 
        affiliates={paginatedAffiliates} 
        onEdit={handleOpenModalForEdit}
        onViewDetails={handleViewDetails}
        user={user} 
      />

      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-4 mt-4">
          <Button 
            onClick={handlePrevPage} 
            disabled={currentPage === 1}
            variant="secondary"
          >
            Anterior
          </Button>
          <span className="text-sm font-medium text-gray-700">
            Página {currentPage} de {totalPages}
          </span>
          <Button 
            onClick={handleNextPage} 
            disabled={currentPage === totalPages}
            variant="secondary"
          >
            Siguiente
          </Button>
        </div>
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title={selectedAffiliate ? 'Editar Afiliado' : 'Nuevo Afiliado'}
      >
        <AffiliateForm
          affiliate={selectedAffiliate}
          onFinished={handleCloseModal}
          onCancel={handleCloseModal}
          user={user}
        />
      </Modal>

    </div>
  );
};

export default AffiliatesView;