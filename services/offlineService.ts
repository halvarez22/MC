import { Affiliate, Document } from '../types';
import type { EncryptedBlob } from './cryptoService';
import { isFieldEncryptionEnabled } from './featureFlags';
import { openString, sealString } from './fieldEncryptionSession';
import { revokeAllTrackedObjectUrls } from './objectUrlRegistry';
import { APP_PURGE_COMPLETE_EVENT } from './purgeEvents';

export type OfflineRegistrationStatus = 'open' | 'pending_purge';

export interface OfflineRegistration {
  id: string;
  formData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'>;
  documents: { type: Document['type']; fileName: string; dataUrl: string }[];
  geolocation?: { latitude: number; longitude: number };
  status?: OfflineRegistrationStatus;
  syncId?: string;
}

type StoredDoc = {
  type: Document['type'];
  fileName: string;
  dataUrl: string | EncryptedBlob;
};

type StoredOfflineRegistration = {
  id: string;
  formData: OfflineRegistration['formData'] & {
    fullName?: string | EncryptedBlob;
    email?: string | EncryptedBlob;
    phone?: string | EncryptedBlob;
    address?: string | EncryptedBlob;
  };
  documents: StoredDoc[];
  geolocation?: { latitude: number; longitude: number };
  fieldEncryption?: boolean;
  status?: OfflineRegistrationStatus;
  syncId?: string;
};

const DB_NAME = 'afiliadosDB';
const STORE_NAME = 'offlineRegistrations';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Error al abrir IndexedDB:', request.error);
        reject('Error al abrir IndexedDB');
      };

      request.onsuccess = (event) => {
        resolve((event.target as IDBOpenDBRequest).result);
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }
  return dbPromise;
};

async function sealRegistration(
  registration: OfflineRegistration
): Promise<StoredOfflineRegistration> {
  if (!isFieldEncryptionEnabled()) {
    return { ...registration, fieldEncryption: false };
  }

  const formData = {
    ...registration.formData,
    fullName: await sealString(registration.formData.fullName || ''),
    email: await sealString(registration.formData.email || ''),
    phone: await sealString(registration.formData.phone || ''),
    address: await sealString(registration.formData.address || ''),
  };

  const documents: StoredDoc[] = [];
  for (const doc of registration.documents) {
    documents.push({
      type: doc.type,
      fileName: doc.fileName,
      dataUrl: await sealString(doc.dataUrl),
    });
  }

  return {
    id: registration.id,
    formData,
    documents,
    geolocation: registration.geolocation,
    fieldEncryption: true,
  };
}

async function openRegistration(
  stored: StoredOfflineRegistration
): Promise<OfflineRegistration> {
  const formData = {
    ...stored.formData,
    fullName: await openString(stored.formData.fullName),
    email: await openString(stored.formData.email),
    phone: await openString(stored.formData.phone),
    address: await openString(stored.formData.address),
  } as OfflineRegistration['formData'];

  const documents = [];
  for (const doc of stored.documents || []) {
    documents.push({
      type: doc.type,
      fileName: doc.fileName,
      dataUrl: await openString(doc.dataUrl),
    });
  }

  return {
    id: stored.id,
    formData,
    documents,
    geolocation: stored.geolocation,
    status: stored.status,
    syncId: stored.syncId,
  };
}

export const offlineService = {
  saveRegistration: async (registration: OfflineRegistration): Promise<void> => {
    // Seal antes de abrir la tx (await invalida transacciones IndexedDB).
    const sealed = await sealRegistration(registration);
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.put(sealed);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject('Fallo al guardar el registro offline.');
    });
  },

  getPendingRegistrations: async (): Promise<OfflineRegistration[]> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        try {
          const stored = request.result as StoredOfflineRegistration[];
          const opened = await Promise.all(
            stored
              .filter((row) => row.status !== 'pending_purge')
              .map(openRegistration)
          );
          resolve(opened);
        } catch (err) {
          reject(err);
        }
      };
      request.onerror = () => reject('Fallo al recuperar registros pendientes.');
    });
  },

  /** D.1 — Tombstone tras ACK. */
  markForLocalPurge: async (id: string, syncId: string): Promise<void> => {
    if (!syncId) throw new Error('markForLocalPurge requiere syncId de ACK válido');
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const row = request.result as StoredOfflineRegistration | undefined;
        if (!row) {
          resolve();
          return;
        }
        row.status = 'pending_purge';
        row.syncId = syncId;
        store.put(row);
      };
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  },

  /** D.1 — delete físico + revoke + evento. */
  executeLocalPurge: async (id: string): Promise<void> => {
    revokeAllTrackedObjectUrls();
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).delete(id);
    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(APP_PURGE_COMPLETE_EVENT, { detail: { registrationId: id } })
      );
    }
  },

  listPendingPurgeIds: async (): Promise<string[]> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        const rows = request.result as StoredOfflineRegistration[];
        resolve(rows.filter((r) => r.status === 'pending_purge').map((r) => r.id));
      };
      request.onerror = () => reject(request.error);
    });
  },

  deleteRegistration: async (id: string): Promise<void> => {
    const db = await getDB();
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    store.delete(id);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(`Fallo al eliminar el registro ${id}.`);
    });
  },
};
