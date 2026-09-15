/**
 * D.2a SPIKE AISLADO — Envelope encryption + Blind Index CURP.
 *
 * ⚠️ NO importar desde App.tsx, useSyncOffline, ineOfflineService ni UI.
 * Store objetivo (D.2b): Firebase / Firestore (pivote cliente; unicidad vía runTransaction).
 *
 * Blind index: HMAC-SHA256(CURP). SOLO igualdad exacta (`=`).
 * NO soporta búsquedas parciales (`LIKE '%…%'`).
 *
 * KEK: simulación local (CLOUD_KEK_SECRET / default de spike).
 * Producción: sustituir wrap/unwrap por AWS KMS / GCP KMS.
 *
 * Ejecutar: npx --yes tsx services/cloudEncryptionSpike.ts
 */

export const CLOUD_ENC_VERSION = 1 as const;
export const CLOUD_ENC_ALG = 'AES-GCM' as const;
export const BLIND_INDEX_NOTE =
  'Blind index CURP = HMAC-SHA256; SOLO match exacto (WHERE blind_curp = $1). NO LIKE parcial.';

export type AffiliateSensitivePayload = {
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
};

/** Fila simulada en Postgres tras cifrado (lo que vería un dump). */
export type CloudEncryptedRow = {
  id: string;
  enc_v: typeof CLOUD_ENC_VERSION;
  alg: typeof CLOUD_ENC_ALG;
  iv: string;
  ciphertext: string;
  wrappedDek: string;
  keyId: string;
  /** HMAC-SHA256 hex — solo igualdad exacta */
  blindCurp: string;
  createdAt: string;
  orgId: string;
};

export type CloudDecryptResult = {
  payload: AffiliateSensitivePayload;
  keyId: string;
};

function getSubtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) {
    throw new Error('Web Crypto API no disponible (Node ≥19 o navegador moderno)');
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

function toHex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function normalizeCurp(curp: string): string {
  return curp.trim().toUpperCase();
}

function newId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}`;
}

/**
 * Abstracción KMS — D.2b: sustituir LocalAesKwKms por AwsKms / GcpKms
 * sin reescribir encryptAffiliateForCloud / decryptAffiliateFromCloud.
 */
export interface KeyManagementService {
  /** Identificador de la KEK (rotación / auditoría). */
  readonly kekId: string;
  wrapKey(dek: CryptoKey): Promise<Uint8Array>;
  unwrapKey(wrappedDek: Uint8Array): Promise<CryptoKey>;
}

/** KEK local (spike). En prod: implementar KeyManagementService con AWS/GCP KMS. */
export async function importLocalKek(
  secret: string = process.env.CLOUD_KEK_SECRET || 'spike-local-kek-not-for-production-32b!'
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const material = new TextEncoder().encode(secret.padEnd(32, '0').slice(0, 32));
  return subtle.importKey('raw', material, { name: 'AES-KW', length: 256 }, false, [
    'wrapKey',
    'unwrapKey',
  ]);
}

export class LocalAesKwKms implements KeyManagementService {
  constructor(
    private readonly kek: CryptoKey,
    readonly kekId: string = 'local-kek-spike'
  ) {}

  async wrapKey(dek: CryptoKey): Promise<Uint8Array> {
    const wrapped = await getSubtle().wrapKey('raw', dek, this.kek, 'AES-KW');
    return new Uint8Array(wrapped);
  }

  async unwrapKey(wrappedDek: Uint8Array): Promise<CryptoKey> {
    return getSubtle().unwrapKey(
      'raw',
      wrappedDek as BufferSource,
      this.kek,
      'AES-KW',
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
}

export async function createLocalKms(
  secret?: string,
  kekId = 'local-kek-spike'
): Promise<KeyManagementService> {
  return new LocalAesKwKms(await importLocalKek(secret), kekId);
}

/** Blind index — SOLO match exacto. Ver BLIND_INDEX_NOTE. */
export async function computeBlindCurp(
  curp: string,
  secret: string = process.env.CLOUD_BLIND_SECRET || 'spike-blind-hmac-not-for-production'
): Promise<string> {
  const subtle = getSubtle();
  const key = await subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  // Normalización obligatoria ANTES del HMAC (trim + upper).
  const sig = await subtle.sign('HMAC', key, new TextEncoder().encode(normalizeCurp(curp)));
  return toHex(new Uint8Array(sig));
}

async function generateDek(): Promise<CryptoKey> {
  return getSubtle().generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt',
    'wrapKey',
    'unwrapKey',
  ]);
}

export type EncryptCloudOpts = {
  orgId?: string;
  /** Preferido: KMS abstracto (Local / AWS / GCP). */
  kms?: KeyManagementService;
  /** @deprecated Preferir opts.kms — compat spike temprano. */
  kek?: CryptoKey;
  blindSecret?: string;
};

async function resolveKms(opts?: EncryptCloudOpts): Promise<KeyManagementService> {
  if (opts?.kms) return opts.kms;
  if (opts?.kek) return new LocalAesKwKms(opts.kek);
  return createLocalKms();
}

/**
 * Cifra payload de afiliado (envelope) + blind index CURP.
 */
export async function encryptAffiliateForCloud(
  payload: AffiliateSensitivePayload,
  opts?: EncryptCloudOpts
): Promise<CloudEncryptedRow> {
  const kms = await resolveKms(opts);
  const dek = await generateDek();
  const keyId = newId('dek');
  // IV único y aleatorio por cifrado (AES-GCM exige nonce no reutilizado).
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(payload));

  const cipherBuf = await getSubtle().encrypt({ name: 'AES-GCM', iv }, dek, plain);
  const wrapped = await kms.wrapKey(dek);

  const blindCurp = await computeBlindCurp(payload.curp, opts?.blindSecret);

  return {
    id: newId('aff'),
    enc_v: CLOUD_ENC_VERSION,
    alg: CLOUD_ENC_ALG,
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(cipherBuf)),
    wrappedDek: toB64(wrapped),
    keyId,
    blindCurp,
    createdAt: new Date().toISOString(),
    orgId: opts?.orgId || 'org_spike',
  };
}

export async function decryptAffiliateFromCloud(
  row: CloudEncryptedRow,
  opts?: { kms?: KeyManagementService; kek?: CryptoKey }
): Promise<CloudDecryptResult> {
  if (row.enc_v !== CLOUD_ENC_VERSION || row.alg !== CLOUD_ENC_ALG) {
    throw new Error(`Versión/alg no soportada: ${row.enc_v}/${row.alg}`);
  }
  const kms = await resolveKms(opts);
  const dek = await kms.unwrapKey(fromB64(row.wrappedDek));
  const iv = fromB64(row.iv);
  const ciphertext = fromB64(row.ciphertext);
  const plainBuf = await getSubtle().decrypt(
    { name: 'AES-GCM', iv: iv as BufferSource },
    dek,
    ciphertext as BufferSource
  );
  const payload = JSON.parse(new TextDecoder().decode(plainBuf)) as AffiliateSensitivePayload;
  return { payload, keyId: row.keyId };
}

/** Simula SELECT * dump: el auditor busca PII en claro. */
export function simulateDatabaseDump(row: CloudEncryptedRow): string {
  return JSON.stringify(row, null, 2);
}

export function dumpContainsPlainPii(
  dump: string,
  canaries: string[]
): { leak: boolean; found: string[] } {
  const found = canaries.filter((c) => c && dump.includes(c));
  return { leak: found.length > 0, found };
}

/** Lookup por igualdad exacta de blind index (modelo SQL: WHERE blind_curp = $1). */
export function findByBlindCurpExact(
  rows: CloudEncryptedRow[],
  blindCurp: string
): CloudEncryptedRow | undefined {
  // Exact equality only — intentionally no fuzzy/partial match.
  return rows.find((r) => r.blindCurp === blindCurp);
}

async function runSpikeCli(): Promise<void> {
  console.log('=== D.2a Spike: Envelope + Blind Index (aislado) ===');
  console.log(BLIND_INDEX_NOTE);

  const canary: AffiliateSensitivePayload = {
    fullName: 'JUAN PEREZ GARCIA',
    curp: 'GARC800101HDFRRL09',
    email: 'juan.canario@example.com',
    phone: '5512345678',
    address: 'CALLE FALSA 123, CDMX',
  };

  const row = await encryptAffiliateForCloud(canary);
  const dump = simulateDatabaseDump(row);
  console.log('\n--- DUMP SIMULADO (fila Postgres) ---\n');
  console.log(dump);

  const piiCheck = dumpContainsPlainPii(dump, [
    canary.curp,
    canary.fullName,
    canary.email,
    canary.phone,
    'CALLE FALSA',
  ]);
  console.log('\n--- Zero-PII en dump ---');
  console.log(piiCheck.leak ? `FAIL fugas: ${piiCheck.found.join(', ')}` : 'PASS: sin PII en claro');

  const decrypted = await decryptAffiliateFromCloud(row);
  console.log('\n--- Descifrado ---');
  console.log(JSON.stringify(decrypted.payload, null, 2));

  const blind = await computeBlindCurp(canary.curp);
  const blindLower = await computeBlindCurp('  garc800101hdfrrl09  ');
  const hit = findByBlindCurpExact([row], blind);
  const miss = findByBlindCurpExact([row], await computeBlindCurp('XXXX000000XXXXXX00'));
  console.log('\n--- Blind index (solo =) ---');
  console.log('match exacto CURP canario:', hit ? 'HIT' : 'MISS');
  console.log('CURP distinta:', miss ? 'HIT (inesperado)' : 'MISS (ok)');
  console.log(
    'normalización trim+upper:',
    blind === blindLower ? 'PASS (mismo HMAC)' : 'FAIL'
  );

  const row2 = await encryptAffiliateForCloud(canary);
  console.log('\n--- IV aleatorio por cifrado ---');
  console.log(
    'IVs distintos:',
    row.iv !== row2.iv ? 'PASS' : 'FAIL (IV reutilizado)'
  );

  const okDecrypt =
    decrypted.payload.curp === canary.curp &&
    decrypted.payload.fullName === canary.fullName;
  const okNorm = blind === blindLower;
  const okIv = row.iv !== row2.iv;
  if (piiCheck.leak || !okDecrypt || !hit || miss || !okNorm || !okIv) {
    console.error('\nSPIKE FAIL');
    process.exitCode = 1;
    return;
  }
  console.log('\nSPIKE PASS');
}

const isMain =
  typeof process !== 'undefined' &&
  process.argv[1] &&
  (process.argv[1].endsWith('cloudEncryptionSpike.ts') ||
    process.argv[1].includes('cloudEncryptionSpike'));

if (isMain) {
  runSpikeCli().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
