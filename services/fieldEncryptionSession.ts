/**
 * Sesión de cifrado de campos (C.2 + C.3).
 * DEK en memoria (CryptoKey). Persistencia solo como wrappedKey + salt (AES-KW + PIN).
 * Sin UI de PIN (C.4). Nunca PIN/DEK en localStorage.
 */

import type { KeyPersistenceConfig } from '../types';
import {
  bytesFromBase64,
  decryptUtf8,
  encryptUtf8,
  generateWrappableKey,
  isEncryptedBlob,
  PBKDF2_ITERATIONS,
  randomSalt,
  unwrapKeyWithPin,
  wrapKeyWithPin,
  type EncryptedBlob,
} from './cryptoService';
import { isFieldEncryptionEnabled } from './featureFlags';
import {
  buildKeyPersistenceConfig,
  loadKeyPersistence,
  saveKeyPersistence,
} from './keyPersistenceStore';

let sessionKey: CryptoKey | null = null;
let sessionKeyId: string | null = null;
let deviceIdCache: string | null = null;

/** Estado de bloqueo (C.3) — sin UI; la C.4 lo consumirá. */
let lockState: {
  needsPinUnlock: boolean;
  hasPersistedKey: boolean;
  config: KeyPersistenceConfig | null;
} = {
  needsPinUnlock: false,
  hasPersistedKey: false,
  config: null,
};

export class InvalidPinError extends Error {
  readonly code = 'INVALID_PIN' as const;
  constructor(message = 'PIN incorrecto, intenta de nuevo') {
    super(message);
    this.name = 'InvalidPinError';
  }
}

function newKeyId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `key_${Date.now()}`;
}

function getOrCreateDeviceId(existing?: string | null): string {
  if (existing) {
    deviceIdCache = existing;
    return existing;
  }
  if (deviceIdCache) return deviceIdCache;
  deviceIdCache =
    typeof globalThis.crypto?.randomUUID === 'function'
      ? globalThis.crypto.randomUUID()
      : `dev_${Date.now()}`;
  return deviceIdCache;
}

export function getFieldEncryptionLockState(): {
  needsPinUnlock: boolean;
  hasPersistedKey: boolean;
  config: KeyPersistenceConfig | null;
  hasSessionKey: boolean;
} {
  return {
    ...lockState,
    hasSessionKey: Boolean(sessionKey && sessionKeyId),
  };
}

/**
 * Probe al iniciar la app (sin UI). Si hay wrappedKey y no hay sesión → bloqueado.
 */
export async function initFieldEncryptionLockState(): Promise<
  ReturnType<typeof getFieldEncryptionLockState>
> {
  if (!isFieldEncryptionEnabled()) {
    lockState = { needsPinUnlock: false, hasPersistedKey: false, config: null };
    return getFieldEncryptionLockState();
  }

  const config = await loadKeyPersistence();
  const hasPersistedKey = Boolean(config?.wrappedKey && config?.salt);
  if (config?.deviceId) deviceIdCache = config.deviceId;

  lockState = {
    hasPersistedKey,
    needsPinUnlock: hasPersistedKey && !sessionKey,
    config,
  };
  return getFieldEncryptionLockState();
}

/**
 * Obtiene DEK en memoria. Si hay material persistido y la sesión está vacía,
 * NO genera una DEK nueva (evitar datos huérfanos) — requiere restoreSessionKey.
 */
export async function getFieldEncryptionSession(): Promise<{
  key: CryptoKey;
  keyId: string;
} | null> {
  if (!isFieldEncryptionEnabled()) return null;

  if (sessionKey && sessionKeyId) {
    return { key: sessionKey, keyId: sessionKeyId };
  }

  const config = await loadKeyPersistence();
  if (config?.wrappedKey) {
    lockState = {
      hasPersistedKey: true,
      needsPinUnlock: true,
      config,
    };
    console.warn(
      '[fieldEncryption] DEK bloqueada — llamar restoreSessionKey(pin) (C.4 UI)'
    );
    return null;
  }

  // Primera sesión: DEK wrappable para poder persistSessionKey (AES-KW).
  const key = await generateWrappableKey();
  const keyId = newKeyId();
  sessionKey = key;
  sessionKeyId = keyId;
  lockState = { needsPinUnlock: false, hasPersistedKey: false, config: null };
  return { key, keyId };
}

/** Limpia DEK de RAM (p. ej. logout). Conserva wrappedKey en IndexedDB. */
export function clearSessionKeyFromMemory(): void {
  sessionKey = null;
  sessionKeyId = null;
  if (lockState.hasPersistedKey || lockState.config) {
    lockState = {
      ...lockState,
      needsPinUnlock: true,
    };
  }
}

/**
 * Envuelve la DEK de sesión con PIN y guarda { salt, wrappedKey } en KeyStore.
 * No almacena el PIN.
 */
export async function persistSessionKey(pin: string): Promise<KeyPersistenceConfig> {
  if (!isFieldEncryptionEnabled()) {
    throw new Error('Cifrado de campos desactivado (VITE_USE_FIELD_ENCRYPTION)');
  }
  if (!pin || pin.length < 4) {
    throw new Error('PIN demasiado corto (mín. 4)');
  }

  let key = sessionKey;
  let keyId = sessionKeyId;
  if (!key || !keyId) {
    const session = await getFieldEncryptionSession();
    if (!session) {
      throw new Error(
        'No hay DEK en sesión y el almacén está bloqueado — restoreSessionKey primero'
      );
    }
    key = session.key;
    keyId = session.keyId;
  }

  const existing = await loadKeyPersistence();
  const saltBytes = existing?.salt
    ? bytesFromBase64(existing.salt)
    : randomSalt(16);
  const deviceId = getOrCreateDeviceId(existing?.deviceId);

  let wrapped: { wrappedKey: string; salt: string };
  try {
    wrapped = await wrapKeyWithPin(key, pin, saltBytes);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `No se pudo envolver la DEK (¿llave no extractable tras restore?). ${msg}`
    );
  }

  const config = buildKeyPersistenceConfig({
    keyId,
    saltB64: wrapped.salt,
    wrappedKey: wrapped.wrappedKey,
    deviceId,
  });

  await saveKeyPersistence(config);
  lockState = {
    needsPinUnlock: false,
    hasPersistedKey: true,
    config,
  };
  return config;
}

/**
 * Recupera DEK desde KeyStore con PIN → CryptoKey extractable:false.
 * PIN incorrecto → InvalidPinError (U-First).
 */
export async function restoreSessionKey(pin: string): Promise<{
  key: CryptoKey;
  keyId: string;
}> {
  if (!isFieldEncryptionEnabled()) {
    throw new Error('Cifrado de campos desactivado (VITE_USE_FIELD_ENCRYPTION)');
  }
  if (!pin || pin.length < 4) {
    throw new InvalidPinError('PIN demasiado corto (mín. 4)');
  }

  const config = await loadKeyPersistence();
  if (!config?.wrappedKey || !config.salt) {
    throw new Error('No hay llave persistida en KeyStore — llamar persistSessionKey primero');
  }

  const saltBytes = bytesFromBase64(config.salt);
  let key: CryptoKey;
  try {
    key = await unwrapKeyWithPin(config.wrappedKey, pin, saltBytes);
  } catch {
    throw new InvalidPinError();
  }

  if (key.extractable) {
    throw new Error('INESPERADO: DEK unwrap debe ser extractable:false');
  }

  sessionKey = key;
  sessionKeyId = config.keyId;
  deviceIdCache = config.deviceId;
  lockState = {
    needsPinUnlock: false,
    hasPersistedKey: true,
    config,
  };

  return { key, keyId: config.keyId };
}

export async function sealString(plain: string): Promise<string | EncryptedBlob> {
  const session = await getFieldEncryptionSession();
  if (!session) return plain;
  return encryptUtf8(plain, session.key, session.keyId);
}

export async function openString(value: unknown): Promise<string> {
  if (typeof value === 'string') return value;
  if (!isEncryptedBlob(value)) {
    if (value == null) return '';
    return String(value);
  }
  const session = await getFieldEncryptionSession();
  if (!session) {
    console.warn('[fieldEncryption] Blob cifrado sin sesión/flag — no se puede descifrar');
    return '';
  }
  try {
    return await decryptUtf8(value, session.key);
  } catch (err) {
    console.warn('[fieldEncryption] Fallo al descifrar (¿otra sesión/llave?):', err);
    return '';
  }
}

export async function sealJson(value: unknown): Promise<unknown> {
  if (value == null) return value;
  const session = await getFieldEncryptionSession();
  if (!session) return value;
  return encryptUtf8(JSON.stringify(value), session.key, session.keyId);
}

export async function openJson(value: unknown): Promise<unknown> {
  if (!isEncryptedBlob(value)) return value;
  const text = await openString(value);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Re-export para callers / tests. */
export { PBKDF2_ITERATIONS };
