/**
 * Núcleo D.2b — cifrado + Admin store (compartido Vercel + proxy Vite).
 */

import {
  encryptAffiliateRecord,
  type AffiliateData,
  BLIND_INDEX_NOTE,
} from '../../services/cloudEncryptionService.js';
import {
  DuplicateEncryptedAffiliateError,
  saveEncryptedAffiliateUnique,
  ensureAdminWritePossible,
} from '../../services/encryptedAffiliateFirebaseStore.js';

export type SecureAffiliateBody = {
  orgId?: string;
  payload?: AffiliateData;
};

export type SecureAffiliateResult = {
  status: number;
  body: Record<string, unknown>;
};

function newSyncId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `sync_${globalThis.crypto.randomUUID()}`;
  }
  return `sync_${Date.now()}`;
}

export async function processSecureAffiliateRequest(
  body: SecureAffiliateBody,
  opts?: { requireCloudSecrets?: boolean }
): Promise<SecureAffiliateResult> {
  if (opts?.requireCloudSecrets) {
    if (!process.env.CLOUD_KEK_SECRET?.trim()) {
      return { status: 500, body: { error: 'CLOUD_KEK_SECRET requerido en producción' } };
    }
    if (!process.env.CLOUD_BLIND_SECRET?.trim()) {
      return { status: 500, body: { error: 'CLOUD_BLIND_SECRET requerido en producción' } };
    }
  }

  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : '';
  const payload = body.payload;

  if (!orgId) {
    return { status: 400, body: { error: 'orgId requerido' } };
  }
  if (!payload || typeof payload !== 'object') {
    return { status: 400, body: { error: 'payload requerido' } };
  }

  const storeReady = await ensureAdminWritePossible();
  if (!storeReady.ok) {
    return { status: 500, body: { error: storeReady.detail } };
  }

  let record;
  try {
    record = await encryptAffiliateRecord(payload, orgId, {
      blindSecret: process.env.CLOUD_BLIND_SECRET,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error de cifrado';
    return { status: 400, body: { error: message } };
  }

  const syncId = newSyncId();

  try {
    await saveEncryptedAffiliateUnique(record);
  } catch (err) {
    if (err instanceof DuplicateEncryptedAffiliateError) {
      return {
        status: 409,
        body: {
          ok: true,
          duplicate: true,
          error: err.message,
          code: err.code,
          note: BLIND_INDEX_NOTE,
          syncId,
          affiliateId: `${orgId}__${record.blind_curp}`.slice(0, 1500),
          store: storeReady.mode,
        },
      };
    }
    const message = err instanceof Error ? err.message : 'error de persistencia';
    return { status: 500, body: { error: message } };
  }

  return {
    status: 201,
    body: {
      ok: true,
      note: BLIND_INDEX_NOTE,
      persisted: true,
      store: storeReady.mode,
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      syncId,
      affiliateId: record.id,
      record: {
        id: record.id,
        org_id: record.org_id,
        blind_curp: record.blind_curp,
        enc_v: record.enc_v,
        alg: record.alg,
        key_id: record.key_id,
        kek_id: record.kek_id,
        created_at: record.created_at,
      },
    },
  };
}
