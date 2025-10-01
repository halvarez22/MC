import { Affiliate, Document } from '../types';

export interface OfflineRegistration {
    id: string; // timestamp based id
    formData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'>;
    documents: { type: Document['type']; fileName: string; dataUrl: string }[];
    geolocation?: { latitude: number, longitude: number };
}

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

export const offlineService = {
    saveRegistration: async (registration: OfflineRegistration): Promise<void> => {
        const db = await getDB();
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        store.put(registration);
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
            request.onsuccess = () => resolve(request.result);
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
