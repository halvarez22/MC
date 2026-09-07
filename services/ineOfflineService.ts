// Servicio de sincronización offline para INEs procesadas con OCR
// Usa IndexedDB para almacenar datos sin conexión
// DB_VERSION 2: imageDataFrontal + imageDataPosterior (migración graceful)
// C.2: encrypt-at-write / decrypt-at-read detrás de VITE_USE_FIELD_ENCRYPTION

import type { EncryptedBlob } from './cryptoService';
import { isFieldEncryptionEnabled } from './featureFlags';
import { openJson, openString, sealJson, sealString } from './fieldEncryptionSession';

/** Forma pública (siempre plaintext hacia la app). */
export interface PendingINE {
  id: string;
  rawText: string;
  capturedAt: string;
  processed?: boolean;
  structuredData?: unknown;
  /** @deprecated usar imageDataFrontal */
  imageData?: string;
  imageDataFrontal?: string | null;
  imageDataPosterior?: string | null;
}

/** Forma en IndexedDB (puede contener EncryptedBlob si flag ON). */
type StoredPendingINE = {
  id: string;
  rawText: string | EncryptedBlob;
  capturedAt: string;
  processed?: boolean;
  structuredData?: unknown;
  imageData?: string | EncryptedBlob;
  imageDataFrontal?: string | EncryptedBlob | null;
  imageDataPosterior?: string | EncryptedBlob | null;
  fieldEncryption?: boolean;
};

export type PendingINEImages = {
  frontal?: string | null;
  posterior?: string | null;
};

const DB_NAME = 'INEOfflineDB';
const STORE_NAME = 'pendingInes';
const DB_VERSION = 2;

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      const tx = (event.target as IDBOpenDBRequest).transaction;
      const oldVersion = event.oldVersion;

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('processed', 'processed', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }

      if (oldVersion < 2 && tx) {
        const store = tx.objectStore(STORE_NAME);
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const value = cursor.value as StoredPendingINE;
          const next: StoredPendingINE = {
            ...value,
            imageDataFrontal: value.imageDataFrontal ?? value.imageData ?? null,
            imageDataPosterior: value.imageDataPosterior ?? null,
          };
          cursor.update(next);
          cursor.continue();
        };
      }
    };
  });
};

function normalizeImages(
  imageDataOrOpts?: string | PendingINEImages
): { frontal: string | null; posterior: string | null } {
  if (!imageDataOrOpts) return { frontal: null, posterior: null };
  if (typeof imageDataOrOpts === 'string') {
    return { frontal: imageDataOrOpts, posterior: null };
  }
  return {
    frontal: imageDataOrOpts.frontal ?? null,
    posterior: imageDataOrOpts.posterior ?? null,
  };
}

async function decryptPending(stored: StoredPendingINE): Promise<PendingINE> {
  const rawText = await openString(stored.rawText);
  const imageDataFrontal = stored.imageDataFrontal
    ? await openString(stored.imageDataFrontal)
    : stored.imageData
      ? await openString(stored.imageData)
      : null;
  const imageDataPosterior = stored.imageDataPosterior
    ? await openString(stored.imageDataPosterior)
    : null;
  const structuredData = await openJson(stored.structuredData);

  return {
    id: stored.id,
    rawText,
    capturedAt: stored.capturedAt,
    processed: stored.processed,
    structuredData: structuredData ?? undefined,
    imageData: imageDataFrontal || undefined,
    imageDataFrontal: imageDataFrontal || null,
    imageDataPosterior: imageDataPosterior || null,
  };
}

/** Guardar INE sin procesar (acepta legacy string frontal u objeto ambas caras). */
export const savePendingINE = async (
  rawText: string,
  imageDataOrOpts?: string | PendingINEImages
): Promise<string> => {
  const images = normalizeImages(imageDataOrOpts);
  const id = crypto.randomUUID();

  // Seal antes de abrir la tx (await invalida transacciones IndexedDB).
  const sealedRaw = await sealString(rawText);
  const sealedFrontal = images.frontal ? await sealString(images.frontal) : null;
  const sealedPosterior = images.posterior ? await sealString(images.posterior) : null;

  const ine: StoredPendingINE = {
    id,
    rawText: sealedRaw,
    capturedAt: new Date().toISOString(),
    processed: false,
    imageData: sealedFrontal || undefined,
    imageDataFrontal: sealedFrontal,
    imageDataPosterior: sealedPosterior,
    fieldEncryption: isFieldEncryptionEnabled(),
  };

  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.add(ine);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(id);
    transaction.onerror = () => reject(transaction.error);
  });
};

export const getPendingInes = async (): Promise<PendingINE[]> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = async () => {
      try {
        const stored = request.result as StoredPendingINE[];
        const decrypted = await Promise.all(stored.map(decryptPending));
        resolve(decrypted);
      } catch (err) {
        reject(err);
      }
    };
    request.onerror = () => reject(request.error);
  });
};

export const getUnprocessedInes = async (): Promise<PendingINE[]> => {
  const all = await getPendingInes();
  return all.filter((ine) => ine.processed !== true);
};

export const markINEAsProcessed = async (
  id: string,
  structuredData: unknown
): Promise<void> => {
  // Cifrar ANTES de abrir la tx (IndexedDB no admite await dentro de onsuccess).
  const sealedStructured = await sealJson(structuredData);
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const request = store.get(id);
  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const ine = request.result as StoredPendingINE | undefined;
      if (!ine) return;
      ine.processed = true;
      ine.structuredData = sealedStructured;
      ine.fieldEncryption = isFieldEncryptionEnabled() || Boolean(ine.fieldEncryption);
      store.put(ine);
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

/**
 * Limpieza post-sync (C.2): elimina fotos y rawText; conserva metadatos mínimos.
 * U-First: el caller debe capturar errores y no bloquear al usuario.
 */
export const deleteSensitiveData = async (id: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const request = store.get(id);
  request.onsuccess = () => {
    const ine = request.result as StoredPendingINE | undefined;
    if (!ine) return;
    ine.rawText = '';
    ine.imageData = undefined;
    ine.imageDataFrontal = null;
    ine.imageDataPosterior = null;
    // structuredData: se conserva cifrado/claro para auditoría local mínima
    store.put(ine);
  };

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const deleteProcessedINE = async (id: string): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.delete(id);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const clearAllInes = async (): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  store.clear();

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
};

export const repairCorruptedInes = async (): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const allInes = request.result as StoredPendingINE[];
      allInes.forEach((ine) => {
        let dirty = false;
        if (ine.processed === undefined) {
          ine.processed = false;
          dirty = true;
        }
        if (ine.imageDataFrontal == null && ine.imageData) {
          ine.imageDataFrontal = ine.imageData;
          dirty = true;
        }
        if (ine.imageDataPosterior === undefined) {
          ine.imageDataPosterior = null;
          dirty = true;
        }
        if (dirty) store.put(ine);
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

export const getINEStats = async (): Promise<{
  total: number;
  processed: number;
  pending: number;
}> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const all = request.result as StoredPendingINE[];
      const processed = all.filter((ine) => ine.processed).length;
      resolve({
        total: all.length,
        processed,
        pending: all.length - processed,
      });
    };
    request.onerror = () => reject(request.error);
  });
};
