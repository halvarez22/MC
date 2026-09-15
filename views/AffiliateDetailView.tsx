/**
 * APO-DEMO-RESET A.1 — Detalle Admin: solo campos del envelope desencriptado.
 * fullName, curp, email, phone, address, createdAt — sin placeholders city/CP.
 */
import React from 'react';
import { Affiliate } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

interface AffiliateDetailViewProps {
  affiliate: Affiliate;
  onBack: () => void;
}

const DetailItem: React.FC<{ label: string; value?: React.ReactNode }> = ({ label, value }) => {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="py-2 sm:grid sm:grid-cols-3 sm:gap-4">
      <dt className="text-sm font-medium text-gray-500 dark:text-gray-300">{label}</dt>
      <dd className="mt-1 text-sm text-gray-900 dark:text-white sm:mt-0 sm:col-span-2 break-words">
        {value}
      </dd>
    </div>
  );
};

function formatCreatedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString('es-MX', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

const AffiliateDetailView: React.FC<AffiliateDetailViewProps> = ({ affiliate, onBack }) => {
  const { fullName, email, phone, address, createdAt } = affiliate;
  const curp = affiliate.ineData?.curp?.trim() || '';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{fullName}</h1>
          {curp ? (
            <p className="text-gray-500 dark:text-gray-300 mt-1">CURP: {curp}</p>
          ) : null}
        </div>
        <Button onClick={onBack} variant="secondary" className="w-full sm:w-auto">
          &larr; Volver a la lista
        </Button>
      </div>

      <Card>
        <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
          Datos del afiliado (desencriptados)
        </h2>
        <dl className="divide-y divide-gray-200 dark:divide-gray-700">
          <DetailItem label="Nombre completo" value={fullName} />
          <DetailItem label="CURP" value={curp || undefined} />
          <DetailItem label="Correo electrónico" value={email} />
          <DetailItem label="Teléfono" value={phone} />
          <DetailItem label="Dirección" value={address} />
          <DetailItem label="Fecha de registro" value={formatCreatedAt(createdAt)} />
        </dl>
      </Card>
    </div>
  );
};

export default AffiliateDetailView;
