import { Affiliate, Document } from '../types';
import type { EncryptedBlob } from './cryptoService';
import { isFieldEncryptionEnabled } from './featureFlags';
import { openString, sealString } from './fieldEncryptionSession';

export interface OfflineRegistration {
  id: string;
  formData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'>;
  documents: { type: Document['type']; fileName: string; dataUrl: string }[];
  geolocation?: { latitude: number; longitude: number };
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
          const opened = await Promise.all(stored.map(openRegistration));
          resolve(opened);
        } catch (err) {
          reject(err);
        }
      };
      request.onerror = () => reject('Fallo al recuperar registros pendientes.');
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
