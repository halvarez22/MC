/**
 * APO-DEMO-RESET FASE 0 — One-shot purge de encrypted_affiliates.
 *
 * SEGURIDAD:
 * - Colección HARDCODEADA: encrypted_affiliates (no configurable).
 * - Requiere I_UNDERSTAND=YES en el entorno.
 * - Usa FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS.
 *
 * Uso (PowerShell):
 *   $env:I_UNDERSTAND="YES"
 *   # opcional: cargar .env.local antes, o exportar FIREBASE_SERVICE_ACCOUNT_JSON
 *   node scripts/purge-encrypted-affiliates-demo.mjs
 *
 * Alternativa Console: ver comentarios al final / implementation_plan.md
 */

import { readFileSync, existsSync } from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const COLLECTION = 'encrypted_affiliates';
const BATCH_SIZE = 400;

function loadDotEnvLocal() {
  if (!existsSync('.env.local')) return;
  const raw = readFileSync('.env.local', 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
      val = val.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

loadDotEnvLocal();

if (process.env.I_UNDERSTAND !== 'YES') {
  die(
    'Abortado. Para ejecutar: I_UNDERSTAND=YES node scripts/purge-encrypted-affiliates-demo.mjs'
  );
}

const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
if (!json && !process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()) {
  die('Falta FIREBASE_SERVICE_ACCOUNT_JSON o GOOGLE_APPLICATION_CREDENTIALS');
}

let projectId = process.env.FIREBASE_PROJECT_ID || 'movimiento-15317';

if (!getApps().length) {
  if (json) {
    let sa;
    try {
      sa = JSON.parse(json);
    } catch (e) {
      die(`FIREBASE_SERVICE_ACCOUNT_JSON inválido: ${e instanceof Error ? e.message : e}`);
    }
    projectId = sa.project_id || projectId;
    initializeApp({
      credential: cert({
        projectId,
        clientEmail: sa.client_email,
        privateKey: String(sa.private_key || '').replace(/\\n/g, '\n'),
      }),
      projectId,
    });
  } else {
    initializeApp({ projectId });
  }
}

const db = getFirestore();

console.log('=== APO-DEMO-RESET FASE 0 PURGE ===');
console.log('projectId:', projectId);
console.log('collection:', COLLECTION);
console.log('startedAt:', new Date().toISOString());

const snap = await db.collection(COLLECTION).get();
const total = snap.size;
console.log('documentsFound:', total);

if (total === 0) {
  console.log('Nada que borrar. OK.');
  process.exit(0);
}

let deleted = 0;
let batch = db.batch();
let ops = 0;

for (const doc of snap.docs) {
  batch.delete(doc.ref);
  ops += 1;
  deleted += 1;
  if (ops >= BATCH_SIZE) {
    await batch.commit();
    batch = db.batch();
    ops = 0;
  }
}
if (ops > 0) {
  await batch.commit();
}

console.log('documentsDeleted:', deleted);
console.log('finishedAt:', new Date().toISOString());
console.log('OK — verifica en Firebase Console que encrypted_affiliates esté vacío.');

/*
 * Alternativa Firebase Console (sin script):
 * 1. https://console.firebase.google.com/project/movimiento-15317/firestore
 * 2. Colección encrypted_affiliates
 * 3. Seleccionar cada documento → Delete document
 * 4. Confirmar 0 documentos restantes
 */
