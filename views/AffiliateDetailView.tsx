import React, { useState } from 'react';
import { Affiliate, Document } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { ICONS } from '../constants';

interface AffiliateDetailViewProps {
  affiliate: Affiliate;
  onBack: () => void;
}

const DetailItem: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => (
  <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
    <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">{label}</dt>
    <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2">{value || 'N/A'}</dd>
  </div>
);

const AffiliateDetailView: React.FC<AffiliateDetailViewProps> = ({ affiliate, onBack }) => {
  const {
    fullName, email, phone, address, city, state, zip, status,
    createdAt, documentation, latitude, longitude
  } = affiliate;
  
  const [previewingDoc, setPreviewingDoc] = useState<Document | null>(null);

  const renderDocStatus = (doc: Document) => (
    <li 
      key={doc.id} 
      className="p-3 border border-gray-200 dark:border-gray-700 rounded-md bg-gray-50 dark:bg-gray-800/60 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
      onClick={() => setPreviewingDoc(doc)}
    >
      <div className="flex justify-between items-center flex-wrap gap-2">
        <div>
          <p className="font-semibold text-gray-800 dark:text-white">{doc.type}</p>
          <p className="text-xs text-gray-500 dark:text-gray-300">{doc.fileName || 'Nombre de archivo no disponible'}</p>
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full capitalize ${
          doc.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' :
          doc.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200' : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200'
        }`}>
          {doc.status}
        </span>
      </div>
      {doc.status === 'rejected' && doc.rejectionReason && (
        <p 
          className="text-xs text-red-600 dark:text-red-300 mt-2 italic border-l-2 border-red-200 dark:border-red-700 pl-2"
          onClick={(e) => e.stopPropagation()}
        >
          <strong>Motivo:</strong> {doc.rejectionReason}
        </p>
      )}
    </li>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{fullName}</h1>
          <p className="text-gray-500 dark:text-gray-300">ID: {affiliate.id}</p>
        </div>
        <Button onClick={onBack} variant="secondary" className="w-full sm:w-auto">
          &larr; Volver a la lista
        </Button>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Datos Personales</h2>
        <dl className="divide-y divide-gray-200 dark:divide-gray-700">
          <DetailItem label="Correo Electrónico" value={email} />
          <DetailItem label="Teléfono" value={phone} />
          <DetailItem label="Dirección" value={`${address}, ${city}, ${state}, C.P. ${zip}`} />
        </dl>
      </Card>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Estatus</h2>
          <dl className="divide-y divide-gray-200 dark:divide-gray-700">
            <DetailItem label="Estado de Afiliación" value={
              <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                status === 'activo' ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200' : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
              }`}>{status}</span>
            } />
            <DetailItem label="Fecha de Registro" value={new Date(createdAt).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })} />
          </dl>
        </Card>
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Geolocalización</h2>
          <dl className="divide-y divide-gray-200 dark:divide-gray-700">
            {latitude && longitude ? (
              <>
                <DetailItem label="Latitud" value={latitude.toFixed(6)} />
                <DetailItem label="Longitud" value={longitude.toFixed(6)} />
                <div className="pt-3">
                   <a
                    href={`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-primary hover:text-primary-dark"
                  >
                    Ver en Google Maps &rarr;
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500 pt-2">No se capturó la geolocalización para este afiliado.</p>
            )}
          </dl>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">Documentación</h2>
        {documentation && documentation.length > 0 ? (
          <ul className="space-y-3">
            {documentation.map(renderDocStatus)}
          </ul>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-300">No hay documentos registrados para este afiliado.</p>
        )}
      </Card>

      <Modal
        isOpen={!!previewingDoc}
        onClose={() => setPreviewingDoc(null)}
        title={`Vista Previa: ${previewingDoc?.type}`}
      >
        <div className="text-center p-4">
          <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-primary-lightest dark:bg-primary/20">
            {React.cloneElement(ICONS.docs, { className: "h-12 w-12 text-primary"})}
          </div>
          <p className="mt-4 text-lg font-medium text-gray-800 dark:text-white break-words">
            {previewingDoc?.fileName || 'Nombre de archivo no disponible'}
          </p>
          <p className="mt-2 text-sm text-gray-500 dark:text-gray-300">
            En un sistema real, aquí se mostraría una vista previa del documento.
          </p>
          <div className="mt-6">
            <Button onClick={() => setPreviewingDoc(null)} variant="secondary">
              Cerrar
            </Button>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default AffiliateDetailView;