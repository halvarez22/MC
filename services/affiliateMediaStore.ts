/**
 * APO-ADMIN-INE-THUMB — metadata + bytes de miniatura (Admin SDK) | mock memoria.
 * v1: bytes en Firestore `affiliate_media` (fuera del envelope de texto).
 * Storage opcional v2 — evita fallo de empaquetado Vercel con firebase-admin/storage.
 * Prohibido SDK cliente.
 */

import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  AFFILIATE_MEDIA_COLLECTION,
  buildIneFrontThumbStoragePath,
  stripDataUrlToBase64,
  validateIneFrontThumbBase64,
} from './ineThumbConfig.js';

export type AffiliateMediaMeta = {
  affiliateId: string;
  orgId: string;
  frontThumbPath: string;
  frontThumbBytes: number;
  contentType: 'image/jpeg';
  /** JPEG base64 (sin data:); solo en esta colección satélite, no en envelope */
  frontThumbBase64: string;
  createdAt: string;
  updatedAt: string;
};

type MemoryThumb = {
  meta: AffiliateMediaMeta;
  bytes: Uint8Array;
};

const memoryThumbs = new Map<string, MemoryThumb>();

function hasAdminCredentials(): boolean {
  return !!(
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  );
}

function useRealBackend(): boolean {
  if ((process.env.FIRESTORE_BACKEND || 'mock').toLowerCase() !== 'firestore') {
    return false;
  }
  return hasAdminCredentials();
}

function getAdminApp(): App {
  const existing = getApps().find((a) => a.name === 'mc-admin');
  if (existing) return existing;

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const sa = JSON.parse(json) as {
      project_id?: string;
      client_email: string;
      private_key: string;
    };
    return initializeApp(
      {
        credential: cert({
          projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID,
          clientEmail: sa.client_email,
          privateKey: sa.private_key.replace(/\\n/g, '\n'),
        }),
        projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID,
      },
      'mc-admin'
    );
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'movimiento-15317',
    },
    'mc-admin'
  );
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as Partial<T>;
}

export async function saveAffiliateFrontThumb(input: {
  orgId: string;
  affiliateId: string;
  thumbFrontJpegBase64: string;
}): Promise<{ ok: true; meta: AffiliateMediaMeta } | { ok: false; error: string }> {
  const orgId = input.orgId.trim();
  const affiliateId = input.affiliateId.trim();
  if (!orgId || !affiliateId) {
    return { ok: false, error: 'orgId/affiliateId requeridos' };
  }

  const validated = validateIneFrontThumbBase64(input.thumbFrontJpegBase64);
  if (validated.ok === false) {
    return { ok: false, error: validated.error };
  }

  const b64 = stripDataUrlToBase64(input.thumbFrontJpegBase64);
  const path = buildIneFrontThumbStoragePath(orgId, affiliateId);
  const now = new Date().toISOString();
  const meta: AffiliateMediaMeta = {
    affiliateId,
    orgId,
    frontThumbPath: path,
    frontThumbBytes: validated.byteLength,
    contentType: 'image/jpeg',
    frontThumbBase64: b64,
    createdAt: now,
    updatedAt: now,
  };

  if (!useRealBackend()) {
    const prev = memoryThumbs.get(affiliateId);
    if (prev) meta.createdAt = prev.meta.createdAt;
    memoryThumbs.set(affiliateId, { meta, bytes: validated.bytes });
    return { ok: true, meta };
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const ref = db.collection(AFFILIATE_MEDIA_COLLECTION).doc(affiliateId);
    const existing = await ref.get();
    if (existing.exists) {
      meta.createdAt = String(existing.data()?.createdAt || now);
    }
    await ref.set(
      omitUndefined(meta as unknown as Record<string, unknown>),
      { merge: true }
    );
    return { ok: true, meta };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'error guardando thumb',
    };
  }
}

export async function getAffiliateFrontThumb(affiliateId: string): Promise<
  | { ok: true; meta: AffiliateMediaMeta; bytes: Uint8Array }
  | { ok: false; status: 404 | 500; error: string }
> {
  const id = affiliateId.trim();
  if (!id) return { ok: false, status: 404, error: 'affiliateId requerido' };

  if (!useRealBackend()) {
    const row = memoryThumbs.get(id);
    if (!row) return { ok: false, status: 404, error: 'Sin miniatura' };
    return { ok: true, meta: row.meta, bytes: row.bytes };
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    const snap = await db.collection(AFFILIATE_MEDIA_COLLECTION).doc(id).get();
    if (!snap.exists) {
      return { ok: false, status: 404, error: 'Sin miniatura' };
    }
    const meta = snap.data() as AffiliateMediaMeta;
    if (!meta.frontThumbBase64) {
      return { ok: false, status: 404, error: 'Sin miniatura' };
    }
    const bytes = Buffer.from(stripDataUrlToBase64(meta.frontThumbBase64), 'base64');
    return { ok: true, meta, bytes: new Uint8Array(bytes) };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : 'error leyendo thumb',
    };
  }
}

export async function deleteAffiliateFrontThumb(
  affiliateId: string
): Promise<{ deleted: boolean }> {
  const id = affiliateId.trim();
  if (!id) return { deleted: false };

  if (!useRealBackend()) {
    const had = memoryThumbs.delete(id);
    return { deleted: had };
  }

  try {
    const app = getAdminApp();
    const db = getFirestore(app);
    await db.collection(AFFILIATE_MEDIA_COLLECTION).doc(id).delete();
    return { deleted: true };
  } catch {
    return { deleted: false };
  }
}

export function __resetAffiliateMediaForTests(): void {
  memoryThumbs.clear();
}
