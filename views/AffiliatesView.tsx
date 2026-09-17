// Gestión de Afiliados — Strangler: mock legacy | lista decrypt API (APO Admin).
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
import { useEncryptedAffiliatesAdmin } from '../hooks/useEncryptedAffiliatesAdmin';

interface AffiliatesViewProps {
  user: User;
}

const ITEMS_PER_PAGE = 20;

const AffiliatesView: React.FC<AffiliatesViewProps> = ({ user }) => {
  const encryptedAdmin = useEncryptedAffiliatesAdmin();

  const [mockAffiliates, setMockAffiliates] = useState<Affiliate[]>([]);
  const [mockLoading, setMockLoading] = useState(true);
  const [mockError, setMockError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [locationFilter, setLocationFilter] = useState<string>('todos');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [affiliateForDetail, setAffiliateForDetail] = useState<Affiliate | null>(null);

  useEffect(() => {
    if (encryptedAdmin.enabled) {
      setMockLoading(false);
      return;
    }
    try {
      const unsubscribe = firebaseService.onAffiliatesSnapshot((data) => {
        setMockAffiliates(data);
        setMockError(null);
        setMockLoading(false);
      });
      return () => unsubscribe();
    } catch (err) {
      setMockError('No se pudieron cargar los afiliados.');
      console.error(err);
      setMockLoading(false);
    }
  }, [encryptedAdmin.enabled]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, locationFilter]);

  const affiliates = encryptedAdmin.enabled ? encryptedAdmin.data : mockAffiliates;
  const loading = encryptedAdmin.enabled ? encryptedAdmin.loading : mockLoading;
  const error = encryptedAdmin.enabled ? encryptedAdmin.error : mockError;

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

    return affiliates.filter((affiliate) => {
      const matchesSearch =
        !lowercasedFilter ||
        affiliate.fullName.toLowerCase().includes(lowercasedFilter) ||
        affiliate.email.toLowerCase().includes(lowercasedFilter) ||
        affiliate.id.toLowerCase().includes(lowercasedFilter) ||
        affiliate.city.toLowerCase().includes(lowercasedFilter) ||
        (affiliate.ineData?.curp || '').toLowerCase().includes(lowercasedFilter);

      const matchesStatus = statusFilter === 'todos' || affiliate.status === statusFilter;
      const matchesLocation = locationFilter === 'todos' || affiliate.state === locationFilter;

      return matchesSearch && matchesStatus && matchesLocation;
    });
  }, [affiliates, searchTerm, statusFilter, locationFilter]);

  const totalPages = Math.ceil(filteredAffiliates.length / ITEMS_PER_PAGE) || 1;
  const paginatedAffiliates = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredAffiliates.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredAffiliates, currentPage]);

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <div className="flex flex-wrap gap-3">
          {encryptedAdmin.enabled && (
            <Button onClick={() => encryptedAdmin.refetch()}>Reintentar</Button>
          )}
          <Button
            variant="secondary"
            onClick={() => {
              setViewMode('list');
              setAffiliateForDetail(null);
              if (encryptedAdmin.enabled) encryptedAdmin.refetch();
            }}
          >
            Volver
          </Button>
        </div>
      </div>
    );
  }

  if (viewMode === 'detail' && affiliateForDetail) {
    return (
      <AffiliateDetailView
        affiliate={affiliateForDetail}
        onBack={handleBackToList}
        canDeleteEncrypted={encryptedAdmin.enabled && user.role === 'admin'}
        deleting={encryptedAdmin.removing}
        onDeleteEncrypted={
          encryptedAdmin.enabled
            ? async (id, opts) => {
                const result = await encryptedAdmin.removeAffiliate(id, {
                  curp: opts?.curp,
                  actorEmail: user.email,
                });
                if (!result.ok) {
                  return { ok: false, error: result.error };
                }
                return { ok: true };
              }
            : undefined
        }
      />
    );
  }

  return (
    <div className="space-y-6">
      {encryptedAdmin.enabled && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
          role="status"
        >
          🔒 Datos desencriptados vía proxy autorizado (Modo Demo)
          {encryptedAdmin.orgId ? ` · org: ${encryptedAdmin.orgId}` : ''}
          {typeof encryptedAdmin.count === 'number' ? ` · ${encryptedAdmin.count} registro(s)` : ''}
        </div>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Gestión de Afiliados</h1>
          {user.role === 'admin' && !encryptedAdmin.enabled && (
            <Button onClick={handleOpenModalForCreate}>+ Nuevo Afiliado</Button>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-grow">
            <Input
              id="search"
              label="Buscar"
              placeholder="Buscar por nombre, email, ID, ciudad, CURP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full"
            />
          </div>

          <div className="w-full sm:w-auto">
            <label
              htmlFor="status-filter"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
            >
              Estatus
            </label>
            <select
              id="status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full sm:w-48 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm bg-white dark:bg-gray-950 text-gray-900 dark:text-white focus:outline-none focus:ring-primary focus:border-primary"
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
              {MEXICAN_STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
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
        hideEdit={encryptedAdmin.enabled}
      />

      {filteredAffiliates.length > ITEMS_PER_PAGE && (
        <div className="flex justify-center items-center space-x-4 mt-4">
          <Button onClick={handlePrevPage} disabled={currentPage === 1} variant="secondary">
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
