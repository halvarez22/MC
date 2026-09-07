/**
 * Cifrado de campos — Web Crypto (C.1+) / wrap PIN (C.3).
 * Regla 5 SSD: AES-GCM; unwrap → extractable:false.
 * Persistencia: solo wrappedKey+salt en IndexedDB KeyStore (nunca PIN/DEK clara).
 */

export const FIELD_ENC_VERSION = 1 as const;
export const FIELD_ENC_ALG = 'AES-GCM' as const;
export const PBKDF2_ITERATIONS = 210_000;

export type EncryptedBlob = {
  enc_v: typeof FIELD_ENC_VERSION;
  alg: typeof FIELD_ENC_ALG;
  iv: string;
  ciphertext: string;
  keyId: string;
};

function getSubtle(): SubtleCrypto {
  const c =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== 'undefined'
        ? window.crypto
        : undefined;
  if (!c?.subtle) {
    throw new Error('Web Crypto API (crypto.subtle) no disponible');
  }
  return c.subtle;
}

function getRandomValues(length: number): Uint8Array {
  const c = globalThis.crypto;
  if (!c?.getRandomValues) {
    throw new Error('crypto.getRandomValues no disponible');
  }
  const buf = new Uint8Array(length);
  c.getRandomValues(buf);
  return buf;
}

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

/** Decodifica salt/wrappedKey Base64 → bytes (uso C.3 restore). */
export function bytesFromBase64(b64: string): Uint8Array {
  return fromBase64(b64);
}

function newKeyId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `key_${Date.now()}_${toBase64(getRandomValues(8)).replace(/[/+=]/g, '')}`;
}

/** AES-GCM 256, extractable:false — path principal de cifrado en memoria. */
export async function generateKey(): Promise<{ key: CryptoKey; keyId: string }> {
  const subtle = getSubtle();
  const key = await subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
  return { key, keyId: newKeyId() };
}

/**
 * Llave wrappable (extractable:true) solo para demostrar Opción B (wrap/unwrap con PIN).
 * No usar como llave de sesión permanente en claro.
 */
export async function generateWrappableKey(): Promise<CryptoKey> {
  const subtle = getSubtle();
  return subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt', 'wrapKey', 'unwrapKey']
  );
}

export async function encrypt(
  data: Uint8Array,
  key: CryptoKey,
  keyId: string
): Promise<EncryptedBlob> {
  const subtle = getSubtle();
  const iv = getRandomValues(12);
  const cipherBuf = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data as BufferSource
  );
  return {
    enc_v: FIELD_ENC_VERSION,
    alg: FIELD_ENC_ALG,
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(cipherBuf)),
    keyId,
  };
}

export async function decrypt(blob: EncryptedBlob, key: CryptoKey): Promise<Uint8Array> {
  if (blob.enc_v !== FIELD_ENC_VERSION || blob.alg !== FIELD_ENC_ALG) {
    throw new Error(`Blob de cifrado no soportado: v=${blob.enc_v} alg=${blob.alg}`);
  }
  const subtle = getSubtle();
  const iv = fromBase64(blob.iv);
  const ciphertext = fromBase64(blob.ciphertext);
  const plainBuf = await subtle.decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    key,
    ciphertext as BufferSource
  );
  return new Uint8Array(plainBuf);
}

/** Demuestra que exportKey falla con extractable:false. */
export async function tryExportRawKey(key: CryptoKey): Promise<{ ok: false; error: string }> {
  try {
    await getSubtle().exportKey('raw', key);
    return { ok: false, error: 'INESPERADO: exportKey no debió tener éxito' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: message };
  }
}

/**
 * Opción B — deriva KEK desde PIN (PBKDF2-SHA-256, ≥100k iteraciones).
 * Usages: wrapKey / unwrapKey (AES-KW).
 */
export async function deriveKeyFromPin(
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  if (!pin || pin.length < 4) {
    throw new Error('PIN demasiado corto (mín. 4)');
  }
  if (salt.length < 16) {
    throw new Error('salt debe tener al menos 16 bytes');
  }
  const subtle = getSubtle();
  const enc = new TextEncoder();
  const baseKey = await subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-KW', length: 256 },
    false,
    ['wrapKey', 'unwrapKey']
  );
}

export async function wrapKeyWithPin(
  fieldKey: CryptoKey,
  pin: string,
  salt: Uint8Array
): Promise<{ wrappedKey: string; salt: string }> {
  const kek = await deriveKeyFromPin(pin, salt);
  const wrapped = await getSubtle().wrapKey('raw', fieldKey, kek, 'AES-KW');
  return {
    wrappedKey: toBase64(new Uint8Array(wrapped)),
    salt: toBase64(salt),
  };
}

/** Unwrap → CryptoKey con extractable:false (solo encrypt/decrypt). */
export async function unwrapKeyWithPin(
  wrappedKeyB64: string,
  pin: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const kek = await deriveKeyFromPin(pin, salt);
  const wrapped = fromBase64(wrappedKeyB64);
  return getSubtle().unwrapKey(
    'raw',
    wrapped as BufferSource,
    kek,
    'AES-KW',
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export function randomSalt(byteLength = 16): Uint8Array {
  return getRandomValues(byteLength);
}

/** Guardia de lectura legacy vs EncryptedBlob (Fase C.2). */
export function isEncryptedBlob(value: unknown): value is EncryptedBlob {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.enc_v === FIELD_ENC_VERSION &&
    v.alg === FIELD_ENC_ALG &&
    typeof v.iv === 'string' &&
    typeof v.ciphertext === 'string' &&
    typeof v.keyId === 'string'
  );
}

export async function encryptUtf8(
  text: string,
  key: CryptoKey,
  keyId: string
): Promise<EncryptedBlob> {
  return encrypt(new TextEncoder().encode(text), key, keyId);
}

export async function decryptUtf8(blob: EncryptedBlob, key: CryptoKey): Promise<string> {
  const bytes = await decrypt(blob, key);
  return new TextDecoder().decode(bytes);
}

export const cryptoService = {
  generateKey,
  generateWrappableKey,
  encrypt,
  decrypt,
  encryptUtf8,
  decryptUtf8,
  isEncryptedBlob,
  tryExportRawKey,
  deriveKeyFromPin,
  wrapKeyWithPin,
  unwrapKeyWithPin,
  randomSalt,
  bytesFromBase64,
  PBKDF2_ITERATIONS,
};
