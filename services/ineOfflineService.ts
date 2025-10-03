// Servicio de sincronización offline para INEs procesadas con OCR
// Usa IndexedDB para almacenar datos sin conexión

interface PendingINE {
  id: string;
  rawText: string;
  capturedAt: string;
  processed?: boolean;
  structuredData?: any;
  imageData?: string; // Base64 de la imagen
}

const DB_NAME = 'INEOfflineDB';
const STORE_NAME = 'pendingInes';
const DB_VERSION = 1;

// Abrir base de datos
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        // Crear índices para búsquedas eficientes
        store.createIndex('processed', 'processed', { unique: false });
        store.createIndex('capturedAt', 'capturedAt', { unique: false });
      }
    };
  });
};

// Guardar INE sin procesar
export const savePendingINE = async (rawText: string, imageData?: string): Promise<string> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);

  const id = crypto.randomUUID();
  const ine: PendingINE = {
    id,
    rawText,
    capturedAt: new Date().toISOString(),
    processed: false,
    imageData
  };

  store.add(ine);

  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve(id);
    transaction.onerror = () => reject(transaction.error);
  });
};

// Obtener todas las INEs pendientes
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

// Obtener INEs no procesadas
export const getUnprocessedInes = async (): Promise<PendingINE[]> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readonly');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const allInes = request.result as PendingINE[];
      // Filtrar manualmente las INEs no procesadas (incluyendo undefined)
      const unprocessed = allInes.filter(ine => ine.processed !== true);
      resolve(unprocessed);
    };
    request.onerror = () => reject(request.error);
  });
};

// Marcar INE como procesada
export const markINEAsProcessed = async (id: string, structuredData: any): Promise<void> => {
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

// Eliminar INE procesada (cuando ya se envió al backend)
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

// Limpiar todas las INEs (útil para testing)
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

// Reparar registros corruptos (útil para migración)
export const repairCorruptedInes = async (): Promise<void> => {
  const db = await openDB();
  const transaction = db.transaction(STORE_NAME, 'readwrite');
  const store = transaction.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const allInes = request.result as PendingINE[];

      // Reparar cada registro que tenga processed undefined
      allInes.forEach(ine => {
        if (ine.processed === undefined) {
          ine.processed = false; // Establecer como no procesado por defecto
          store.put(ine);
        }
      });

      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Obtener estadísticas
export const getINEStats = async (): Promise<{
  total: number;
  processed: number;
  pending: number;
}> => {
  const all = await getPendingInes();
  const processed = all.filter(ine => ine.processed).length;
  const pending = all.length - processed;

  return {
    total: all.length,
    processed,
    pending
  };
};
