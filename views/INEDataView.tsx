import React, { useState, useEffect } from 'react';
import { Affiliate, INEData } from '../types';
import { firebaseService } from '../services/firebaseService';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { ICONS } from '../constants';

const INEDataView: React.FC = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);
  const [showINEDataModal, setShowINEDataModal] = useState(false);

  useEffect(() => {
    loadAffiliates();
  }, []);

  const loadAffiliates = async () => {
    try {
      const affiliatesData = await firebaseService.getAffiliates();
      // Filtrar solo afiliados que tienen datos del INE
      const affiliatesWithINE = affiliatesData.filter(affiliate => affiliate.ineData);
      setAffiliates(affiliatesWithINE);
    } catch (error) {
      console.error('Error loading affiliates:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewINEData = (affiliate: Affiliate) => {
    setSelectedAffiliate(affiliate);
    setShowINEDataModal(true);
  };

  const INEDataModal = () => {
    if (!selectedAffiliate?.ineData) return null;

    const ineData = selectedAffiliate.ineData;

    return (
      <Modal
        isOpen={showINEDataModal}
        onClose={() => setShowINEDataModal(false)}
        title={`Datos INE - ${selectedAffiliate.fullName}`}
      >
        <div className="space-y-6">
          {/* Información del afiliado */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Información del Afiliado</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Nombre:</span>
                <p className="text-gray-900">{selectedAffiliate.fullName}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Email:</span>
                <p className="text-gray-900">{selectedAffiliate.email}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Teléfono:</span>
                <p className="text-gray-900">{selectedAffiliate.phone}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Estado:</span>
                <p className="text-gray-900">{selectedAffiliate.state}</p>
              </div>
            </div>
          </div>

          {/* Datos extraídos del INE */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-blue-900">Datos Extraídos del INE</h4>
              <div className="flex items-center space-x-2 text-sm text-blue-700">
                <span>Confianza OCR:</span>
                <span className="font-medium">{ineData.confidence ? `${(ineData.confidence * 100).toFixed(0)}%` : 'N/A'}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Nombre (INE):</span>
                  <p className="text-gray-900">{ineData.name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">CURP:</span>
                  <p className="text-gray-900 font-mono">{ineData.curp}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Clave de Elector:</span>
                  <p className="text-gray-900 font-mono">{ineData.voterId}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Estado:</span>
                  <p className="text-gray-900">{ineData.state}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Municipio:</span>
                  <p className="text-gray-900">{ineData.municipality}</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <span className="font-medium text-gray-700">Sección:</span>
                  <p className="text-gray-900">{ineData.section}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Localidad:</span>
                  <p className="text-gray-900">{ineData.locality}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Año de Registro:</span>
                  <p className="text-gray-900">{ineData.registrationYear}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Emisión:</span>
                  <p className="text-gray-900">{ineData.emission}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Vigencia:</span>
                  <p className="text-gray-900">{ineData.validity}</p>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-blue-200">
              <div>
                <span className="font-medium text-gray-700">Domicilio (INE):</span>
                <p className="text-gray-900 mt-1">{ineData.address}</p>
              </div>
            </div>

            <div className="mt-4 text-xs text-blue-600">
              <p>📅 Extraído el: {new Date(ineData.extractedAt).toLocaleString('es-MX')}</p>
            </div>
          </div>

          {/* Documentos del INE */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="font-semibold text-gray-900 mb-2">Documentos del INE</h4>
            <div className="space-y-2">
              {selectedAffiliate.documentation
                .filter(doc => doc.type === 'INE Frontal' || doc.type === 'INE Posterior')
                .map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded border">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                        doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                        doc.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {doc.status === 'approved' ? 'Aprobado' :
                         doc.status === 'rejected' ? 'Rechazado' : 'Pendiente'}
                      </span>
                      <span className="text-sm text-gray-900">{doc.type}</span>
                      <span className="text-xs text-gray-500">{doc.fileName}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Modal>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Datos INE Extraídos</h1>
          <p className="text-gray-600 mt-1">
            Información obtenida mediante OCR de las credenciales de elector
          </p>
        </div>
        <Button onClick={loadAffiliates} variant="secondary">
          ↻ Actualizar
        </Button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-blue-100 rounded-lg">
              <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total con INE</p>
              <p className="text-2xl font-semibold text-gray-900">{affiliates.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg">
              <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Datos Verificados</p>
              <p className="text-2xl font-semibold text-gray-900">
                {affiliates.filter(a => a.documentation.some(d => d.type.includes('INE') && d.status === 'approved')).length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow-sm border">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Pendientes</p>
              <p className="text-2xl font-semibold text-gray-900">
                {affiliates.filter(a => a.documentation.some(d => d.type.includes('INE') && d.status === 'pending')).length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de afiliados con datos INE */}
      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Afiliados con Datos INE</h3>

          {affiliates.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 mb-4">
                <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <p className="text-gray-500">No hay afiliados con datos del INE extraídos aún.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Afiliado
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      CURP
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Clave Elector
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estado INE
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Extraído
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {affiliates.map((affiliate) => (
                    <tr key={affiliate.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {affiliate.fullName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {affiliate.email}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">
                          {affiliate.ineData?.curp || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono text-gray-900">
                          {affiliate.ineData?.voterId || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-900">
                          {affiliate.ineData?.state || 'N/A'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm text-gray-500">
                          {affiliate.ineData?.extractedAt ?
                            new Date(affiliate.ineData.extractedAt).toLocaleDateString('es-MX') :
                            'N/A'
                          }
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Button
                          onClick={() => handleViewINEData(affiliate)}
                          variant="secondary"
                          size="sm"
                        >
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

      <INEDataModal />
    </div>
  );
};

export default INEDataView;
