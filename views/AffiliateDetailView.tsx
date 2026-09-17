/**
 * APO-DEMO-RESET A.1 — Detalle Admin: envelope desencriptado.
 * APO-ADMIN-BAJA — Dar de baja (hard delete; CURP reafiliable).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Affiliate } from '../types';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import { getStoredAuthUser } from '../services/authSessionStore';
import { appendForensicEvent } from '../services/forensicAuditClient';
import {
  fetchAffiliateFrontThumb,
  isIneFrontThumbUiEnabled,
} from '../services/affiliateFrontThumbClient';

interface AffiliateDetailViewProps {
  affiliate: Affiliate;
  onBack: () => void;
  /** Path cifrado: permite hard delete vía API Admin */
  canDeleteEncrypted?: boolean;
  deleting?: boolean;
  onDeleteEncrypted?: (
    affiliateId: string,
    opts?: { curp?: string }
  ) => Promise<{ ok: boolean; error?: string }>;
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

const AffiliateDetailView: React.FC<AffiliateDetailViewProps> = ({
  affiliate,
  onBack,
  canDeleteEncrypted = false,
  deleting = false,
  onDeleteEncrypted,
}) => {
  const { fullName, email, phone, address, createdAt } = affiliate;
  const curp = affiliate.ineData?.curp?.trim() || '';
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const showThumb = isIneFrontThumbUiEnabled();
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [thumbError, setThumbError] = useState<string | null>(null);

  const loadThumb = useCallback(async () => {
    if (!showThumb) return;
    setThumbLoading(true);
    setThumbError(null);
    const result = await fetchAffiliateFrontThumb(affiliate.id);
    if (result.ok === true) {
      setThumbUrl(result.dataUrl);
    } else {
      setThumbUrl(null);
      setThumbError(
        result.status === 404
          ? 'Sin miniatura INE para este afiliado.'
          : result.error
      );
    }
    setThumbLoading(false);
  }, [affiliate.id, showThumb]);

  useEffect(() => {
    const u = getStoredAuthUser();
    if (!u?.email) return;
    const t = window.setTimeout(() => {
      void appendForensicEvent({
        action: 'SCREEN_VIEW',
        actorEmail: u.email,
        actorRole: u.role === 'admin' ? 'admin' : 'unknown',
        screen: 'admin.affiliate_detail',
        affiliateId: affiliate.id,
      });
    }, 400);
    return () => window.clearTimeout(t);
  }, [affiliate.id]);

  useEffect(() => {
    void loadThumb();
  }, [loadThumb]);

  const handleConfirmDelete = async () => {
    if (!onDeleteEncrypted) return;
    setDeleteError(null);
    const result = await onDeleteEncrypted(affiliate.id, {
      curp: curp || undefined,
    });
    if (!result.ok) {
      setDeleteError(result.error || 'No se pudo dar de baja. Reintenta.');
      return;
    }
    setConfirmOpen(false);
    onBack();
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{fullName}</h1>
          {curp ? (
            <p className="text-gray-500 dark:text-gray-300 mt-1">CURP: {curp}</p>
          ) : null}
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <Button onClick={onBack} variant="secondary" className="w-full sm:w-auto" disabled={deleting}>
            &larr; Volver a la lista
          </Button>
          {canDeleteEncrypted && onDeleteEncrypted ? (
            <Button
              onClick={() => {
                setDeleteError(null);
                setConfirmOpen(true);
              }}
              variant="danger"
              className="w-full sm:w-auto"
              disabled={deleting}
              isLoading={deleting}
            >
              Dar de baja
            </Button>
          ) : null}
        </div>
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

      {showThumb ? (
        <Card>
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">
            Credencial INE (anverso)
          </h2>
          {thumbLoading ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Cargando miniatura…</p>
          ) : thumbUrl ? (
            <img
              src={thumbUrl}
              alt="Miniatura INE frontal"
              className="max-w-full max-h-72 rounded-md border border-gray-200 dark:border-gray-700 object-contain bg-gray-50 dark:bg-gray-950"
            />
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {thumbError || 'Sin miniatura INE.'}
              </p>
              <Button type="button" variant="secondary" onClick={() => void loadThumb()}>
                Reintentar
              </Button>
            </div>
          )}
        </Card>
      ) : null}

      <Modal
        isOpen={confirmOpen}
        onClose={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        title="Confirmar baja"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-700 dark:text-gray-200">
            ¿Dar de baja a <strong>{fullName}</strong>
            {curp ? (
              <>
                {' '}
                (CURP <strong>{curp}</strong>)
              </>
            ) : null}
            ?
          </p>
          <p className="text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-md p-3">
            Se eliminará el registro cifrado de forma permanente. El CURP quedará libre y podrá
            afiliarse de nuevo en el futuro.
          </p>
          {deleteError ? (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {deleteError}
            </p>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-3 justify-end pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmOpen(false)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={() => void handleConfirmDelete()}
              isLoading={deleting}
              disabled={deleting}
            >
              Confirmar baja
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AffiliateDetailView;
