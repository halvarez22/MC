/**
 * APO-ADMIN-INE-THUMB — metadata + Storage (Admin SDK) | mock memoria.
 * Prohibido SDK Storage cliente.
 */

import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import {
  AFFILIATE_MEDIA_COLLECTION,
  buildIneFrontThumbStoragePath,
} from './ineThumbConfig.js';
import { validateIneFrontThumbBase64 } from './ineThumbService.js';

export type AffiliateMediaMeta = {
  affiliateId: string;
  orgId: string;
  frontThumbPath: string;
  frontThumbBytes: number;
  contentType: 'image/jpeg';
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
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET ||
          process.env.VITE_FIREBASE_STORAGE_BUCKET,
      },
      'mc-admin'
    );
  }

  return initializeApp(
    {
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'movimiento-15317',
      storageBucket:
        process.env.FIREBASE_STORAGE_BUCKET ||
        process.env.VITE_FIREBASE_STORAGE_BUCKET,
    },
    'mc-admin'
  );
}

function resolveBucketName(): string {
  return (
    process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
    process.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() ||
    ''
  );
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

  const path = buildIneFrontThumbStoragePath(orgId, affiliateId);
  const now = new Date().toISOString();
  const meta: AffiliateMediaMeta = {
    affiliateId,
    orgId,
    frontThumbPath: path,
    frontThumbBytes: validated.byteLength,
    contentType: 'image/jpeg',
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
    const bucketName = resolveBucketName();
    if (!bucketName) {
      return { ok: false, error: 'FIREBASE_STORAGE_BUCKET no configurado' };
    }
    const bucket = getStorage(app).bucket(bucketName);
    const file = bucket.file(path);
    await file.save(Buffer.from(validated.bytes), {
      contentType: 'image/jpeg',
      resumable: false,
      metadata: {
        cacheControl: 'private, max-age=3600',
        metadata: { orgId, affiliateId, kind: 'ine_front_thumb' },
      },
    });

    const db = getFirestore(app);
    const ref = db.collection(AFFILIATE_MEDIA_COLLECTION).doc(affiliateId);
    const existing = await ref.get();
    if (existing.exists) {
      meta.createdAt = String(existing.data()?.createdAt || now);
    }
    await ref.set(meta, { merge: true });
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
    const bucketName = resolveBucketName();
    if (!bucketName) {
      return { ok: false, status: 500, error: 'FIREBASE_STORAGE_BUCKET no configurado' };
    }
    const [buf] = await getStorage(app).bucket(bucketName).file(meta.frontThumbPath).download();
    return { ok: true, meta, bytes: new Uint8Array(buf) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'error leyendo thumb';
    if (/no such object|Not Found|404/i.test(msg)) {
      return { ok: false, status: 404, error: 'Sin miniatura' };
    }
    return { ok: false, status: 500, error: msg };
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
    const ref = db.collection(AFFILIATE_MEDIA_COLLECTION).doc(id);
    const snap = await ref.get();
    const path = snap.exists
      ? String((snap.data() as AffiliateMediaMeta).frontThumbPath || '')
      : '';
    const bucketName = resolveBucketName();
    if (path && bucketName) {
      try {
        await getStorage(app).bucket(bucketName).file(path).delete({ ignoreNotFound: true });
      } catch {
        /* ignore */
      }
    }
    await ref.delete().catch(() => undefined);
    return { deleted: true };
  } catch {
    return { deleted: false };
  }
}

export function __resetAffiliateMediaForTests(): void {
  memoryThumbs.clear();
}
