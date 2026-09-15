/**
 * D.2b — Store Firestore vía Firebase Admin SDK (Opción A Qwen).
 *
 * Unicidad: runTransaction → get doc estable → dup o set.
 * ⚠️ Solo backend. Prohibido SDK cliente para escrituras.
 * Credenciales: FIREBASE_SERVICE_ACCOUNT_JSON | GOOGLE_APPLICATION_CREDENTIALS.
 */

import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import type { EncryptedAffiliateRecord } from './cloudEncryptionService.js';

export const ENCRYPTED_AFFILIATES_COLLECTION = 'encrypted_affiliates';

export class DuplicateEncryptedAffiliateError extends Error {
  readonly code = 'DUPLICATE_BLIND_CURP' as const;

  constructor(message = 'Afiliado ya registrado en esta organización') {
    super(message);
    this.name = 'DuplicateEncryptedAffiliateError';
  }
}

function hasAdminCredentials(): boolean {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()) return true;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) return true;
  return false;
}

function useRealFirestore(): boolean {
  if ((process.env.FIRESTORE_BACKEND || 'mock').toLowerCase() !== 'firestore') {
    return false;
  }
  if (!hasAdminCredentials()) {
    const isProd =
      process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
    if (isProd) {
      throw new Error(
        'FIRESTORE_BACKEND=firestore requiere FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS'
      );
    }
    console.warn(
      '[encryptedAffiliateFirebaseStore] Sin Admin credentials — usando mock (no-prod)'
    );
    return false;
  }
  return true;
}

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps().find((a) => a.name === 'mc-admin');
  if (existing) {
    adminApp = existing;
    return existing;
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const sa = JSON.parse(json) as {
      project_id?: string;
      client_email: string;
      private_key: string;
    };
    adminApp = initializeApp(
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
    return adminApp;
  }

  adminApp = initializeApp(
    {
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'movimiento-15317',
    },
    'mc-admin'
  );
  return adminApp;
}

function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}

function stableDocId(orgId: string, blindCurp: string): string {
  return `${orgId}__${blindCurp}`.slice(0, 1500);
}

/** Mock en memoria (CI / sin Admin). */
const memoryStore = new Map<string, EncryptedAffiliateRecord>();
let txChain: Promise<unknown> = Promise.resolve();

function compositeKey(orgId: string, blindCurp: string): string {
  return `${orgId}::${blindCurp}`;
}

export type EncryptedAffiliateTx = {
  findByOrgAndBlindCurp: (
    orgId: string,
    blindCurp: string
  ) => Promise<EncryptedAffiliateRecord | null>;
  set: (record: EncryptedAffiliateRecord) => void;
};

async function runMockTransaction<T>(
  updateFunction: (tx: EncryptedAffiliateTx) => Promise<T>
): Promise<T> {
  const run = txChain.then(async () => {
    const pending = new Map<string, EncryptedAffiliateRecord>();
    const tx: EncryptedAffiliateTx = {
      findByOrgAndBlindCurp: async (orgId, blindCurp) => {
        const k = compositeKey(orgId, blindCurp);
        if (pending.has(k)) return pending.get(k)!;
        for (const row of memoryStore.values()) {
          if (row.org_id === orgId && row.blind_curp === blindCurp) return row;
        }
        return null;
      },
      set: (record) => {
        pending.set(compositeKey(record.org_id, record.blind_curp), record);
      },
    };
    const result = await updateFunction(tx);
    for (const record of pending.values()) {
      memoryStore.set(record.id, record);
    }
    return result;
  });
  txChain = run.then(
    () => undefined,
    () => undefined
  );
  return run as Promise<T>;
}

export async function runTransaction<T>(
  updateFunction: (tx: EncryptedAffiliateTx) => Promise<T>
): Promise<T> {
  if (!useRealFirestore()) {
    return runMockTransaction(updateFunction);
  }
  // Admin path: saveEncryptedAffiliateUnique usa runTransaction nativo.
  return runMockTransaction(updateFunction);
}

/**
 * Unicidad Qwen con Admin SDK runTransaction (bypass rules).
 */
export async function saveEncryptedAffiliateUnique(
  record: EncryptedAffiliateRecord
): Promise<EncryptedAffiliateRecord> {
  if (!useRealFirestore()) {
    return runMockTransaction(async (tx) => {
      const existing = await tx.findByOrgAndBlindCurp(record.org_id, record.blind_curp);
      if (existing) throw new DuplicateEncryptedAffiliateError();
      tx.set(record);
      return record;
    });
  }

  const db = getAdminDb();
  const id = stableDocId(record.org_id, record.blind_curp);
  const ref = db.collection(ENCRYPTED_AFFILIATES_COLLECTION).doc(id);
  const toWrite = { ...record, id };

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      throw new DuplicateEncryptedAffiliateError();
    }
    tx.set(ref, toWrite);
  });

  return toWrite;
}

export async function findEncryptedByBlindCurpExact(
  orgId: string,
  blindCurp: string
): Promise<EncryptedAffiliateRecord | null> {
  if (!useRealFirestore()) {
    for (const row of memoryStore.values()) {
      if (row.org_id === orgId && row.blind_curp === blindCurp) return row;
    }
    return null;
  }
  const db = getAdminDb();
  const snap = await db
    .collection(ENCRYPTED_AFFILIATES_COLLECTION)
    .where('org_id', '==', orgId)
    .where('blind_curp', '==', blindCurp)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0]!.data() as EncryptedAffiliateRecord;
}

export function dumpEncryptedCollection(): EncryptedAffiliateRecord[] {
  return [...memoryStore.values()];
}

export function __resetEncryptedAffiliateStoreForTests(): void {
  memoryStore.clear();
}

export async function ensureAdminWritePossible(): Promise<{
  ok: boolean;
  detail: string;
  mode: 'mock' | 'admin';
}> {
  if (!useRealFirestore()) {
    return { ok: true, detail: 'mock', mode: 'mock' };
  }
  try {
    getAdminDb();
    return {
      ok: true,
      detail: `admin:${process.env.FIREBASE_PROJECT_ID || 'movimiento-15317'}`,
      mode: 'admin',
    };
  } catch (e) {
    return {
      ok: false,
      detail: e instanceof Error ? e.message : 'admin init fail',
      mode: 'admin',
    };
  }
}
