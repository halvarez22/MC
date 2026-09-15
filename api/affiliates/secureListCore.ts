/**
 * APO Admin list — núcleo compartido (Vercel + Vite).
 * Decrypt SOLO aquí / callers API. Nunca bundle cliente.
 */

import {
  decryptAffiliateRecord,
  type EncryptedAffiliateRecord,
} from '../../services/cloudEncryptionService.js';
import { listEncryptedByOrg } from '../../services/encryptedAffiliateFirebaseStore.js';

export type DecryptedAffiliateDto = {
  id: string;
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
  blindCurpPrefix: string;
};

export type SecureListResult = { status: number; body: Record<string, unknown> };

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

/**
 * TODO(APO.3): Reemplazar ADMIN_LIST_SECRET por validación de Firebase ID Token + Custom Claims
 */
export function authorizeAdminListBearer(authorizationHeader: string | undefined): boolean {
  const secret = process.env.ADMIN_LIST_SECRET?.trim();
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const got = (authorizationHeader || '').trim();
  return timingSafeEqualStr(got, expected);
}

export function resolveAdminListOrgIds(): string[] {
  const raw = process.env.ADMIN_DEFAULT_ORG_ID?.trim() || 'org_default';
  const ids = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : ['org_default'];
}

/** @deprecated usar resolveAdminListOrgIds — se mantiene por compat smoke */
export function resolveAdminListOrgId(): string {
  return resolveAdminListOrgIds()[0] || 'org_default';
}

function toDto(record: EncryptedAffiliateRecord, plain: {
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
}): DecryptedAffiliateDto {
  const blind = record.blind_curp || '';
  return {
    id: record.id,
    fullName: plain.fullName,
    curp: plain.curp,
    email: plain.email,
    phone: plain.phone,
    address: plain.address,
    createdAt: record.created_at || new Date().toISOString(),
    blindCurpPrefix: blind.slice(0, 8),
  };
}

export async function processSecureAffiliateListRequest(params: {
  authorizationHeader?: string;
  requireCloudSecrets?: boolean;
}): Promise<SecureListResult> {
  // TODO(APO.3): Reemplazar ADMIN_LIST_SECRET por validación de Firebase ID Token + Custom Claims
  if (!process.env.ADMIN_LIST_SECRET?.trim()) {
    return {
      status: 500,
      body: { error: 'ADMIN_LIST_SECRET not configured on server' },
    };
  }

  if (!authorizeAdminListBearer(params.authorizationHeader)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  if (params.requireCloudSecrets) {
    if (!process.env.CLOUD_KEK_SECRET?.trim()) {
      return { status: 500, body: { error: 'CLOUD_KEK_SECRET requerido en producción' } };
    }
    if (!process.env.CLOUD_BLIND_SECRET?.trim()) {
      return { status: 500, body: { error: 'CLOUD_BLIND_SECRET requerido en producción' } };
    }
  }

  // orgIds SOLO desde env server (lista allowlist, coma-separada) — nunca query del cliente
  const orgIds = resolveAdminListOrgIds();

  try {
    const seen = new Set<string>();
    const affiliates: DecryptedAffiliateDto[] = [];

    for (const orgId of orgIds) {
      const rows = await listEncryptedByOrg(orgId, { limit: 100 });
      for (const row of rows) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        try {
          const plain = await decryptAffiliateRecord(row, {
            blindSecret: process.env.CLOUD_BLIND_SECRET,
          });
          affiliates.push(toDto(row, plain));
        } catch (err) {
          console.warn(
            '[secure-list] decrypt skip id=',
            row.id,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    return {
      status: 200,
      body: {
        ok: true,
        orgId: orgIds.join(','),
        orgIds,
        count: affiliates.length,
        affiliates,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'List decrypt error';
    return { status: 500, body: { error: message } };
  }
}
