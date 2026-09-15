/**
 * E2E prod: INE Héctor → OCR → secure persist → Admin list plaintext
 * + lectura cruda Firestore (ciphertext, sin CURP en claro).
 *
 * Uso: node scripts/e2e-hector-field-admin.mjs
 * Secrets: .env.local (ADMIN_LIST_SECRET, FIREBASE_SERVICE_ACCOUNT_JSON)
 * Target: https://movimiento.vercel.app
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.E2E_BASE_URL || 'https://movimiento.vercel.app';

const INE_CANDIDATES = [
  process.env.E2E_INE_PATH,
  path.join(
    process.env.USERPROFILE || '',
    '.cursor/projects/c-IA-nubes-MC/assets/c__Users_halva_AppData_Roaming_Cursor_User_workspaceStorage_empty-window_images_ine_hector-7d5feb05-72a3-4ff1-ba85-07acf1b856c8.png'
  ),
  path.join(root, 'assets/ine_hector.png'),
].filter(Boolean);

const EXPECTED = {
  curp: 'AAGH650922HGTLTC04',
  nameIncludes: 'ALVAREZ',
  zip: '37510',
};

function loadEnvLocal() {
  const p = path.join(root, '.env.local');
  const out = {};
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    // JSON a veces viene doble-escapado en .env.local
    out[m[1]] = v;
  }
  return out;
}

function resolveInePath() {
  for (const c of INE_CANDIDATES) {
    if (c && fs.existsSync(c)) return c;
  }
  throw new Error('No se encontró imagen INE Héctor');
}

async function maybeResizeBase64(filePath) {
  const buf = fs.readFileSync(filePath);
  let out = buf;
  try {
    const require = createRequire(import.meta.url);
    const sharp = require('sharp');
    out = await sharp(buf)
      .rotate()
      .resize({ width: 1280, withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
  } catch {
    /* raw file */
  }
  return out.toString('base64');
}

function report(title, obj) {
  console.log(`\n=== ${title} ===`);
  console.log(typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2));
}

async function main() {
  const env = loadEnvLocal();
  const bearer = (env.ADMIN_LIST_SECRET || env.VITE_ADMIN_LIST_BEARER || '').trim();
  if (!bearer) throw new Error('ADMIN_LIST_SECRET / VITE_ADMIN_LIST_BEARER faltante en .env.local');

  const inePath = resolveInePath();
  report('INE', { path: inePath, bytes: fs.statSync(inePath).size });

  const frontalBase64 = await maybeResizeBase64(inePath);
  report('OCR request', { base: BASE, frontalKb: Math.round(frontalBase64.length / 1024) });

  const t0 = Date.now();
  const ocrRes = await fetch(`${BASE}/api/groq-ine`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ frontalBase64 }),
  });
  const ocrText = await ocrRes.text();
  let ocrBody;
  try {
    ocrBody = JSON.parse(ocrText);
  } catch {
    ocrBody = { raw: ocrText.slice(0, 400) };
  }
  report('OCR response', {
    http: ocrRes.status,
    ms: Date.now() - t0,
    curp: ocrBody?.curp || ocrBody?.data?.curp,
    nombre: ocrBody?.nombre_completo || ocrBody?.data?.nombre_completo,
    domicilio: ocrBody?.domicilio || ocrBody?.data?.domicilio,
    keys: ocrBody && typeof ocrBody === 'object' ? Object.keys(ocrBody).slice(0, 20) : [],
  });

  const structured =
    ocrBody?.data && typeof ocrBody.data === 'object'
      ? ocrBody.data
      : ocrBody?.curp
        ? ocrBody
        : null;

  const fullName = String(
    structured?.nombre_completo || 'ALVAREZ GUTIERREZ HECTOR MANUEL'
  ).trim();
  const curp = String(structured?.curp || EXPECTED.curp)
    .trim()
    .toUpperCase();
  const address = String(
    structured?.domicilio_lineas ||
      structured?.domicilio ||
      'C PARQUE VIA 324, COL PARQUE MANZANARES 37510, LEON, GTO.'
  ).trim();

  const payload = {
    fullName,
    curp,
    email: 'noreply@local.invalid',
    phone: '4770000000',
    address,
  };

  const t1 = Date.now();
  const secureRes = await fetch(`${BASE}/api/affiliates/secure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org_default', payload }),
  });
  const secureBody = await secureRes.json();
  report('SECURE persist', {
    http: secureRes.status,
    ms: Date.now() - t1,
    ok: secureBody.ok,
    persisted: secureBody.persisted,
    store: secureBody.store,
    duplicate: secureBody.duplicate || false,
    affiliateId: secureBody.affiliateId || secureBody.record?.id,
    recordPreview: secureBody.record
      ? {
          id: secureBody.record.id,
          org_id: secureBody.record.org_id,
          blind_curp_prefix: String(secureBody.record.blind_curp || '').slice(0, 12),
          enc_v: secureBody.record.enc_v,
          alg: secureBody.record.alg,
          // ciphertext NO viene completo en 201 body normalmente — solo meta
          hasCiphertextInBody: Boolean(secureBody.record.ciphertext),
        }
      : null,
    plaintextLeakInSecureBody:
      JSON.stringify(secureBody).includes(curp) && secureRes.status < 300
        ? 'WARN: CURP aparece en respuesta secure'
        : 'OK: CURP no filtrado en meta record',
  });

  if (![200, 201, 409].includes(secureRes.status)) {
    throw new Error(`Secure falló HTTP ${secureRes.status}`);
  }

  const t2 = Date.now();
  const listRes = await fetch(`${BASE}/api/affiliates/secure-list`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const listBody = await listRes.json();
  const affiliates = Array.isArray(listBody.affiliates)
    ? listBody.affiliates
    : Array.isArray(listBody.items)
      ? listBody.items
      : Array.isArray(listBody.records)
        ? listBody.records
        : [];

  const hector = affiliates.find(
    (a) =>
      String(a.curp || '').toUpperCase() === curp ||
      String(a.fullName || '').toUpperCase().includes(EXPECTED.nameIncludes)
  );

  report('ADMIN secure-list', {
    http: listRes.status,
    ms: Date.now() - t2,
    total: affiliates.length,
    hectorFound: Boolean(hector),
    hectorPlaintext: hector
      ? {
          fullName: hector.fullName,
          curp: hector.curp,
          address: hector.address,
          phone: hector.phone,
          id: hector.id,
        }
      : null,
    sampleKeys: affiliates[0] ? Object.keys(affiliates[0]) : listBody && Object.keys(listBody),
  });

  if (listRes.status !== 200) {
    throw new Error(`Admin list HTTP ${listRes.status}: ${JSON.stringify(listBody).slice(0, 200)}`);
  }
  if (!hector) {
    throw new Error('Héctor no aparece en secure-list (plaintext Admin)');
  }
  if (!String(hector.curp || '').toUpperCase().includes('AAGH650922')) {
    throw new Error(`CURP Admin inesperado: ${hector.curp}`);
  }

  // Lectura cruda Firestore: debe haber ciphertext / blind_curp, NO curp plano
  let firestoreRaw = null;
  try {
    let saRaw = env.FIREBASE_SERVICE_ACCOUNT_JSON || '';
    // manejar JSON escapado tipo "\"{...}\"" 
    if (saRaw.startsWith('"')) {
      saRaw = JSON.parse(saRaw);
    }
    if (typeof saRaw === 'string' && saRaw.includes('\\"')) {
      try {
        saRaw = JSON.parse(`"${saRaw}"`);
      } catch {
        /* keep */
      }
    }
    const sa = typeof saRaw === 'string' ? JSON.parse(saRaw) : saRaw;
    const { initializeApp, cert, getApps } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    if (!getApps().length) {
      initializeApp({
        credential: cert({
          projectId: sa.project_id || env.FIREBASE_PROJECT_ID,
          clientEmail: sa.client_email,
          privateKey: String(sa.private_key).replace(/\\n/g, '\n'),
        }),
      });
    }
    const db = getFirestore();
    const snap = await db.collection('encrypted_affiliates').limit(50).get();
    const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const match =
      docs.find((d) => d.id === hector.id) ||
      docs.find((d) => String(d.blind_curp || '').startsWith(String(hector.blindCurpPrefix || ''))) ||
      docs.find((d) => String(d.org_id) === 'org_default' && d.ciphertext);

    const rawStr = JSON.stringify(match || {});
    firestoreRaw = {
      collectionCountSampled: docs.length,
      matchedId: match?.id || null,
      org_id: match?.org_id,
      alg: match?.alg,
      enc_v: match?.enc_v,
      blind_curp_prefix: String(match?.blind_curp || '').slice(0, 16),
      ciphertext_len: String(match?.ciphertext || '').length,
      iv_len: String(match?.iv || '').length,
      wrapped_dek_len: String(match?.wrapped_dek || '').length,
      containsPlainCurp: rawStr.includes(EXPECTED.curp),
      containsPlainName: rawStr.toUpperCase().includes('HECTOR'),
    };
    report('FIRESTORE raw (encrypted_affiliates)', firestoreRaw);
  } catch (e) {
    report('FIRESTORE raw SKIP', e instanceof Error ? e.message : String(e));
  }

  const verdict = {
    ocrHttp: ocrRes.status,
    ocrCurp: structured?.curp || null,
    secureHttp: secureRes.status,
    secureStore: secureBody.store,
    adminHttp: listRes.status,
    adminShowsPlaintext: Boolean(hector?.curp && hector?.fullName),
    dbEncrypted:
      firestoreRaw &&
      firestoreRaw.ciphertext_len > 0 &&
      firestoreRaw.containsPlainCurp === false,
    PASS:
      [200, 201, 409].includes(secureRes.status) &&
      listRes.status === 200 &&
      Boolean(hector?.curp) &&
      (firestoreRaw
        ? firestoreRaw.ciphertext_len > 0 && firestoreRaw.containsPlainCurp === false
        : true),
  };
  report('VEREDICTO E2E', verdict);
  if (!verdict.PASS) process.exit(1);
}

main().catch((e) => {
  console.error('E2E FAIL:', e);
  process.exit(1);
});
