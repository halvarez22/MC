/**
 * APO-ADMIN-INE-VIEW — Strangler: mock legacy | secure-list (cifrado).
 */
import React, { useState, useEffect, useMemo } from 'react';
import { Affiliate } from '../types';
import { firebaseService } from '../services/firebaseService';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { useEncryptedAffiliatesAdmin } from '../hooks/useEncryptedAffiliatesAdmin';

function hasUsableCurp(a: Affiliate): boolean {
  const c = (a.ineData?.curp || '').trim();
  return c.length >= 10 && c !== '—';
}

function displayOrNA(v?: string): string {
  const s = String(v ?? '').trim();
  if (!s || s === '—') return 'N/A';
  return s;
}

const INEDataView: React.FC = () => {
  const encryptedAdmin = useEncryptedAffiliatesAdmin();

  const [mockAffiliates, setMockAffiliates] = useState<Affiliate[]>([]);
  const [mockLoading, setMockLoading] = useState(true);
  const [mockError, setMockError] = useState<string | null>(null);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [showINEDataModal, setShowINEDataModal] = useState(false);

  useEffect(() => {
    if (encryptedAdmin.enabled) {
      setMockLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const affiliatesData = await firebaseService.getAffiliates();
        if (!cancelled) {
          setMockAffiliates(affiliatesData.filter((a) => a.ineData));
          setMockError(null);
        }
      } catch (error) {
        console.error('Error loading affiliates:', error);
        if (!cancelled) setMockError('No se pudieron cargar los afiliados.');
      } finally {
        if (!cancelled) setMockLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [encryptedAdmin.enabled]);

  const affiliates = useMemo(() => {
    if (encryptedAdmin.enabled) {
      return encryptedAdmin.data.filter(hasUsableCurp);
    }
    return mockAffiliates;
  }, [encryptedAdmin.enabled, encryptedAdmin.data, mockAffiliates]);

  const loading = encryptedAdmin.enabled ? encryptedAdmin.loading : mockLoading;
  const error = encryptedAdmin.enabled ? encryptedAdmin.error : mockError;

  const withVoterId = affiliates.filter(
    (a) => displayOrNA(a.ineData?.voterId) !== 'N/A'
  ).length;
  const legacyVerified = affiliates.filter((a) =>
    a.documentation.some((d) => d.type.includes('INE') && d.status === 'approved')
  ).length;

  const handleRefresh = () => {
    if (encryptedAdmin.enabled) {
      encryptedAdmin.refetch();
      return;
    }
    setMockLoading(true);
    void firebaseService
      .getAffiliates()
      .then((data) => {
        setMockAffiliates(data.filter((a) => a.ineData));
        setMockError(null);
      })
      .catch(() => setMockError('No se pudieron cargar los afiliados.'))
      .finally(() => setMockLoading(false));
  };

  const handleViewINEData = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setShowINEDataModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950/40">
        <p className="text-red-700 dark:text-red-300">{error}</p>
        <Button onClick={handleRefresh}>Reintentar</Button>
      </div>
    );
  }

  const ineData = selectedAffiliate?.ineData;

  return (
    <div className="space-y-6">
      {encryptedAdmin.enabled && (
        <div
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100"
          role="status"
        >
          🔒 Datos desencriptados vía proxy autorizado (mismo origen que Afiliados)
          {encryptedAdmin.orgId ? ` · org: ${encryptedAdmin.orgId}` : ''}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Datos INE Extraídos</h1>
          <p className="text-gray-600 dark:text-gray-300 mt-1">
            {encryptedAdmin.enabled
              ? 'Registro cifrado en bóveda (CURP y campos INE disponibles tras captura en campo).'
              : 'Información obtenida mediante OCR de las credenciales de elector'}
          </p>
        </div>
        <Button onClick={handleRefresh} variant="secondary">
          ↻ Actualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {encryptedAdmin.enabled ? 'Con CURP en bóveda' : 'Total con INE'}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">{affiliates.length}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {encryptedAdmin.enabled ? 'Con clave de elector' : 'Datos Verificados'}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {encryptedAdmin.enabled ? withVoterId : legacyVerified}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-900 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {encryptedAdmin.enabled ? 'Registros listados' : 'Pendientes'}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white">
            {encryptedAdmin.enabled
              ? affiliates.length
              : affiliates.filter((a) =>
                  a.documentation.some((d) => d.type.includes('INE') && d.status === 'pending')
                ).length}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 shadow-sm rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Afiliados con Datos INE
          </h3>

          {affiliates.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-300">
                {encryptedAdmin.enabled
                  ? 'No hay afiliados cifrados con CURP aún. Registra desde Modo Campo.'
                  : 'No hay afiliados con datos del INE extraídos aún.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Afiliado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      CURP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Clave Elector
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Estado INE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Extraído
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700">
                  {affiliates.map((affiliate) => (
                    <tr key={affiliate.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {affiliate.fullName}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-300">{affiliate.email}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                        {displayOrNA(affiliate.ineData?.curp)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900 dark:text-white">
                        {displayOrNA(affiliate.ineData?.voterId)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {displayOrNA(affiliate.ineData?.state)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                        {affiliate.ineData?.extractedAt
                          ? new Date(affiliate.ineData.extractedAt).toLocaleDateString('es-MX')
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button onClick={() => handleViewINEData(affiliate)} variant="secondary">
                          Ver Detalles
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showINEDataModal && Boolean(ineData)}
        onClose={() => setShowINEDataModal(false)}
        title={`Datos INE - ${selectedAffiliate?.fullName || ''}`}
      >
        {selectedAffiliate && ineData ? (
          <div className="space-y-6">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Información del Afiliado</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Nombre:</span>
                  <p className="text-gray-900 dark:text-white">{selectedAffiliate.fullName}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Email:</span>
                  <p className="text-gray-900 dark:text-white">{selectedAffiliate.email}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Teléfono:</span>
                  <p className="text-gray-900 dark:text-white">{selectedAffiliate.phone}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Dirección:</span>
                  <p className="text-gray-900 dark:text-white">{selectedAffiliate.address}</p>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-4">Datos Extraídos del INE</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Nombre (INE):</span>
                  <p className="text-gray-900 dark:text-white">{displayOrNA(ineData.name)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">CURP:</span>
                  <p className="text-gray-900 dark:text-white font-mono">{displayOrNA(ineData.curp)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Clave de Elector:</span>
                  <p className="text-gray-900 dark:text-white font-mono">{displayOrNA(ineData.voterId)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Estado:</span>
                  <p className="text-gray-900 dark:text-white">{displayOrNA(ineData.state)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Municipio:</span>
                  <p className="text-gray-900 dark:text-white">{displayOrNA(ineData.municipality)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Sección:</span>
                  <p className="text-gray-900 dark:text-white">{displayOrNA(ineData.section)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Localidad:</span>
                  <p className="text-gray-900 dark:text-white">{displayOrNA(ineData.locality)}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Emisión / Vigencia:</span>
                  <p className="text-gray-900 dark:text-white">
                    {displayOrNA(ineData.emission)} / {displayOrNA(ineData.validity)}
                  </p>
                </div>
                <div className="md:col-span-2">
                  <span className="font-medium text-gray-700 dark:text-gray-300">Domicilio:</span>
                  <p className="text-gray-900 dark:text-white mt-1">{displayOrNA(ineData.address)}</p>
                </div>
              </div>
              <p className="text-xs text-blue-800 dark:text-blue-200 mt-4">
                📅 Registrado: {new Date(ineData.extractedAt).toLocaleString('es-MX')}
              </p>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
};

export default INEDataView;
