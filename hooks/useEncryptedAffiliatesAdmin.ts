/**
 * APO.2 — Lista afiliados desencriptados vía proxy autorizado.
 * APO-ADMIN-BAJA — removeAffiliate → POST /api/affiliates/secure-delete
 * Nunca importa cloudEncryptionService (SSD).
 */

import { useCallback, useEffect, useState } from 'react';
import type { Affiliate, Document, INEData } from '../types';
import { isEncryptedAffiliatesAdminEnabled } from '../services/featureFlags';

export type DecryptedAffiliateApiRow = {
  id: string;
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  blindCurpPrefix: string;
};

const LIST_PATH = '/api/affiliates/secure-list';
const DELETE_PATH = '/api/affiliates/secure-delete';

function mapToAffiliate(row: DecryptedAffiliateApiRow): Affiliate {
  const ineData: INEData = {
    name: row.fullName,
    address: row.address,
    voterId: '—',
    curp: row.curp,
    registrationYear: '—',
    state: '—',
    municipality: '—',
    section: '—',
    locality: '—',
    emission: '—',
    validity: '—',
    extractedAt: row.createdAt,
  };

  const documentation: Document[] = [];

  return {
    id: row.id,
    createdAt: row.createdAt,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone,
    address: row.address,
    city: '—',
    state: '—',
    zip: '—',
    status: 'activo',
    documentation,
    ineData,
  };
}

export type RemoveAffiliateResult =
  | { ok: true; deleted: boolean; affiliateId: string }
  | { ok: false; error: string };

export type UseEncryptedAffiliatesAdminResult = {
  enabled: boolean;
  loading: boolean;
  data: Affiliate[];
  error: string | null;
  orgId: string | null;
  count: number;
  refetch: () => void;
  removing: boolean;
  removeAffiliate: (affiliateId: string) => Promise<RemoveAffiliateResult>;
};

export function useEncryptedAffiliatesAdmin(): UseEncryptedAffiliatesAdminResult {
  const enabled = isEncryptedAffiliatesAdminEnabled();
  const [loading, setLoading] = useState(enabled);
  const [data, setData] = useState<Affiliate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  const [removing, setRemoving] = useState(false);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  const removeAffiliate = useCallback(
    async (affiliateId: string): Promise<RemoveAffiliateResult> => {
      if (!enabled) {
        return { ok: false, error: 'Modo cifrado Admin no activo' };
      }
      const id = affiliateId?.trim();
      if (!id) {
        return { ok: false, error: 'affiliateId requerido' };
      }
      // TODO(APO.3): Reemplazar VITE_ADMIN_LIST_BEARER por Firebase ID Token
      const bearer = (import.meta.env.VITE_ADMIN_LIST_BEARER as string | undefined)?.trim();
      if (!bearer) {
        return { ok: false, error: 'Falta VITE_ADMIN_LIST_BEARER' };
      }

      setRemoving(true);
      try {
        const res = await fetch(DELETE_PATH, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${bearer}`,
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ affiliateId: id }),
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          ok?: boolean;
          deleted?: boolean;
          affiliateId?: string;
        };
        if (!res.ok) {
          return { ok: false, error: body.error || `Error HTTP ${res.status}` };
        }
        setTick((t) => t + 1);
        return {
          ok: true,
          deleted: Boolean(body.deleted),
          affiliateId: body.affiliateId || id,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Error de red al eliminar',
        };
      } finally {
        setRemoving(false);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setData([]);
      setError(null);
      return;
    }

    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);

      // TODO(APO.3): Reemplazar VITE_ADMIN_LIST_BEARER por Firebase ID Token
      const bearer = (import.meta.env.VITE_ADMIN_LIST_BEARER as string | undefined)?.trim();
      if (!bearer) {
        if (!cancelled) {
          setError('Falta VITE_ADMIN_LIST_BEARER (modo demo). Contacta al administrador.');
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch(LIST_PATH, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${bearer}`,
            Accept: 'application/json',
          },
        });
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
          orgId?: string;
          count?: number;
          affiliates?: DecryptedAffiliateApiRow[];
        };

        if (!res.ok) {
          throw new Error(body.error || `Error HTTP ${res.status}`);
        }

        const rows = Array.isArray(body.affiliates) ? body.affiliates : [];
        if (!cancelled) {
          setData(rows.map(mapToAffiliate));
          setOrgId(typeof body.orgId === 'string' ? body.orgId : null);
          setCount(typeof body.count === 'number' ? body.count : rows.length);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setData([]);
          setError(err instanceof Error ? err.message : 'No se pudieron cargar afiliados cifrados');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [enabled, tick]);

  return {
    enabled,
    loading,
    data,
    error,
    orgId,
    count,
    refetch,
    removing,
    removeAffiliate,
  };
}
