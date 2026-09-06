// Servicio de sincronización offline para INEs procesadas con OCR
// Usa IndexedDB para almacenar datos sin conexión
// DB_VERSION 2: imageDataFrontal + imageDataPosterior (migración graceful)

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

      // Migración v1 → v2: registros solo con imageData (frontal legacy)
      if (oldVersion < 2 && tx) {
        const store = tx.objectStore(STORE_NAME);
        const cursorReq = store.openCursor();
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) return;
          const value = cursor.value as PendingINE;
          const next: PendingINE = {
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

/** Guardar INE sin procesar (acepta legacy string frontal u objeto ambas caras). */
export const savePendingINE = async (
  rawText: string,
  imageDataOrOpts?: string | PendingINEImages
): Promise<string> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const images = normalizeImages(imageDataOrOpts);

  const id = crypto.randomUUID();
  const ine: PendingINE = {
    id,
    rawText,
    capturedAt: new Date().toISOString(),
    processed: false,
    imageData: images.frontal || undefined,
    imageDataFrontal: images.frontal,
    imageDataPosterior: images.posterior,
  };

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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const getUnprocessedInes = async (): Promise<PendingINE[]> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const allInes = request.result as PendingINE[];
      const unprocessed = allInes.filter((ine) => ine.processed !== true);
      resolve(unprocessed);
    };
    request.onerror = () => reject(request.error);
  });
};

export const markINEAsProcessed = async (
  id: string,
  structuredData: unknown
): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const request = store.get(id);
  request.onsuccess = () => {
    const ine = request.result as PendingINE;
    if (ine) {
      ine.processed = true;
      ine.structuredData = structuredData;
      store.put(ine);
    }
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
      const allInes = request.result as PendingINE[];
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
  const all = await getPendingInes();
  const processed = all.filter((ine) => ine.processed).length;
  const pending = all.length - processed;

  return {
    total: all.length,
    processed,
    pending,
  };
};
