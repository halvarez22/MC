/**
 * IndexedDB KeyStore — solo material envuelto (C.3).
 * Nunca PIN ni DEK en claro. Sin UI.
 */

import type { KeyPersistenceConfig } from '../types';
import { PBKDF2_ITERATIONS } from './cryptoService';

const DB_NAME = 'FieldEncryptionKeyDB';
const STORE_NAME = 'KeyStore';
const DB_VERSION = 1;
/** Registro singleton por dispositivo (C.3 sin multi-usuario aún). */
export const KEY_RECORD_ID = 'device_default';

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });

type StoredKeyRecord = KeyPersistenceConfig & { id: string };

export async function loadKeyPersistence(): Promise<KeyPersistenceConfig | null> {
  if (typeof indexedDB === 'undefined') return null;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const request = store.get(KEY_RECORD_ID);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const row = request.result as StoredKeyRecord | undefined;
      if (!row) {
        resolve(null);
        return;
      }
      const { id: _id, ...config } = row;
      resolve(config);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveKeyPersistence(config: KeyPersistenceConfig): Promise<void> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB no disponible para KeyStore');
  }
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const row: StoredKeyRecord = { id: KEY_RECORD_ID, ...config };
  store.put(row);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearKeyPersistence(): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  tx.objectStore(STORE_NAME).delete(KEY_RECORD_ID);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export function buildKeyPersistenceConfig(params: {
  keyId: string;
  saltB64: string;
  wrappedKey: string;
  deviceId: string;
}): KeyPersistenceConfig {
  return {
    version: 1,
    keyId: params.keyId,
    salt: params.saltB64,
    wrappedKey: params.wrappedKey,
    deviceId: params.deviceId,
    pbkdf2Iterations: PBKDF2_ITERATIONS,
    requiresPin: true,
    createdAt: new Date().toISOString(),
  };
}
