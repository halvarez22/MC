/**
 * D.2b — Servicio de cifrado en nube (SOLO server-side).
 *
 * ⚠️ Importar únicamente desde api/ (p. ej. api/affiliates/secure.ts).
 * ⚠️ PROHIBIDO en App.tsx, components/, hooks/ o cualquier bundle Vite.
 * ⚠️ CLOUD_KEK_SECRET / CLOUD_BLIND_SECRET: solo process.env — nunca VITE_*.
 *
 * Store: Firebase/Firestore (ver encryptedAffiliateFirebaseStore).
 * Usa KeyManagementService (DI): LocalAesKwKms hoy; AWS/GCP KMS mañana.
 *
 * Blind index: HMAC-SHA256(CURP normalizado). SOLO igualdad exacta (`=`).
 * NO LIKE parcial.
 */

import {
  type KeyManagementService,
  createLocalKms,
  computeBlindCurp,
  CLOUD_ENC_VERSION,
  CLOUD_ENC_ALG,
  BLIND_INDEX_NOTE,
} from './cloudEncryptionSpike';

export { type KeyManagementService, BLIND_INDEX_NOTE };

export type AffiliateData = {
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
};

/** Documento alineado a la colección Firestore encrypted_affiliates. */
export type EncryptedAffiliateRecord = {
  id: string;
  org_id: string;
  blind_curp: string;
  ciphertext: string;
  iv: string;
  wrapped_dek: string;
  key_id: string;
  kek_id: string;
  enc_v: number;
  alg: string;
  created_at: string;
  updated_at: string;
};

export type CloudEncryptionOpts = {
  kms?: KeyManagementService;
  blindSecret?: string;
};

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API no disponible (Node ≥19 o runtime server moderno)');
  }
  return c.subtle;
}

function toB64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function newUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  throw new Error('crypto.randomUUID no disponible');
}

function assertAffiliateData(payload: AffiliateData): void {
  if (!payload || typeof payload !== 'object') {
    throw new Error('payload inválido');
  }
  const required: (keyof AffiliateData)[] = ['fullName', 'curp', 'email', 'phone', 'address'];
  for (const k of required) {
    if (typeof payload[k] !== 'string' || !payload[k].trim()) {
      throw new Error(`Campo requerido vacío: ${k}`);
    }
  }
}

async function generateDek(): Promise<CryptoKey> {
  return getSubtle().generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
    'wrapKey',
    'unwrapKey',
  ]);
}

async function resolveKms(opts?: CloudEncryptionOpts): Promise<KeyManagementService> {
  return opts?.kms ?? createLocalKms();
}

/**
 * Cifra payload JSON como un único blob (envelope) + blind_curp normalizado.
 */
export async function encryptAffiliateRecord(
  payload: AffiliateData,
  orgId: string,
  opts?: CloudEncryptionOpts
): Promise<EncryptedAffiliateRecord> {
  assertAffiliateData(payload);
  if (!orgId?.trim()) throw new Error('orgId requerido');

  const kms = await resolveKms(opts);
  const dek = await generateDek();
  const keyId = `dek_${newUuid()}`;
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(payload));

  const cipherBuf = await getSubtle().encrypt({ name: 'AES-GCM', iv }, dek, plain);
  const wrapped = await kms.wrapKey(dek);
  const blindCurp = await computeBlindCurp(payload.curp, opts?.blindSecret);

  const now = new Date().toISOString();
  return {
    id: newUuid(),
    org_id: orgId.trim(),
    blind_curp: blindCurp,
    ciphertext: toB64(new Uint8Array(cipherBuf)),
    iv: toB64(iv),
    wrapped_dek: toB64(wrapped),
    key_id: keyId,
    kek_id: kms.kekId,
    enc_v: CLOUD_ENC_VERSION,
    alg: CLOUD_ENC_ALG,
    created_at: now,
    updated_at: now,
  };
}

export async function decryptAffiliateRecord(
  record: EncryptedAffiliateRecord,
  opts?: CloudEncryptionOpts
): Promise<AffiliateData> {
  if (!record?.ciphertext || !record?.iv || !record?.wrapped_dek) {
    throw new Error('registro cifrado incompleto');
  }
  if (record.enc_v !== CLOUD_ENC_VERSION || record.alg !== CLOUD_ENC_ALG) {
    throw new Error(`Versión/alg no soportada: ${record.enc_v}/${record.alg}`);
  }

  const kms = await resolveKms(opts);
  const dek = await kms.unwrapKey(fromB64(record.wrapped_dek));
  const plainBuf = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: fromB64(record.iv) as BufferSource },
    dek,
    fromB64(record.ciphertext) as BufferSource
  );
  const payload = JSON.parse(new TextDecoder().decode(plainBuf)) as AffiliateData;
  assertAffiliateData(payload);
  return payload;
}

/**
 * Lookup por igualdad exacta de blind_curp (modelo SQL: WHERE org_id = $1 AND blind_curp = $2).
 * Prohibido LIKE / partial match.
 */
export function findEncryptedByBlindCurpExact(
  rows: EncryptedAffiliateRecord[],
  orgId: string,
  blindCurp: string
): EncryptedAffiliateRecord | undefined {
  return rows.find((r) => r.org_id === orgId && r.blind_curp === blindCurp);
}
