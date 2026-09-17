/**
 * Smoke APO-ADMIN-BAJA: create → delete → re-create mismo CURP = 201 (no 409).
 * node scripts/smoke-admin-baja.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.E2E_BASE_URL || 'https://movimiento.vercel.app';

const CURP = `BAJA${Date.now().toString().slice(-10)}HDFRRN09`.slice(0, 18).toUpperCase();

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
    out[m[1]] = v;
  }
  return out;
}

async function main() {
  const env = loadEnvLocal();
  const bearer = (env.ADMIN_LIST_SECRET || env.VITE_ADMIN_LIST_BEARER || '').trim();
  if (!bearer) throw new Error('Falta ADMIN_LIST_SECRET en .env.local');

  const payload = {
    fullName: 'SMOKE BAJA REAFILIACION',
    curp: CURP,
    email: 'noreply@local.invalid',
    phone: '0000000000',
    address: 'Smoke baja',
  };

  console.log('CURP fixture:', CURP);

  const create1 = await fetch(`${BASE}/api/affiliates/secure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org_default', payload }),
  });
  const c1 = await create1.json();
  console.log('CREATE1', create1.status, { affiliateId: c1.affiliateId || c1.record?.id, store: c1.store });

  if (![200, 201].includes(create1.status)) {
    throw new Error(`CREATE1 failed ${create1.status}`);
  }

  const list1 = await fetch(`${BASE}/api/affiliates/secure-list`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const l1 = await list1.json();
  const rows1 = Array.isArray(l1.affiliates) ? l1.affiliates : [];
  const row = rows1.find((a) => String(a.curp || '').toUpperCase() === CURP);
  if (!row) throw new Error('Afiliado no aparece en list tras create');
  const docId = row.id;
  console.log('LIST id:', docId);

  const del = await fetch(`${BASE}/api/affiliates/secure-delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ affiliateId: docId }),
  });
  const dbody = await del.json();
  console.log('DELETE', del.status, dbody);
  if (del.status !== 200 || !dbody.deleted) {
    throw new Error('DELETE no eliminó el registro');
  }

  const create2 = await fetch(`${BASE}/api/affiliates/secure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId: 'org_default', payload }),
  });
  const c2 = await create2.json();
  console.log('CREATE2 (reafiliación)', create2.status, {
    affiliateId: c2.affiliateId || c2.record?.id,
    duplicate: c2.duplicate,
  });

  if (create2.status === 409) {
    throw new Error('FAIL: CURP sigue bloqueado tras baja (esperado 201)');
  }
  if (![200, 201].includes(create2.status)) {
    throw new Error(`CREATE2 failed ${create2.status}`);
  }

  // Limpieza: borrar el re-creado
  const list2 = await fetch(`${BASE}/api/affiliates/secure-list`, {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const l2 = await list2.json();
  const rows2 = Array.isArray(l2.affiliates) ? l2.affiliates : [];
  const row2 = rows2.find((a) => String(a.curp || '').toUpperCase() === CURP);
  if (row2) {
    await fetch(`${BASE}/api/affiliates/secure-delete`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${bearer}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ affiliateId: row2.id }),
    });
    console.log('CLEANUP deleted', row2.id);
  }

  console.log('VEREDICTO: PASS — baja libera CURP (reafiliación 201)');
}

main().catch((e) => {
  console.error('SMOKE FAIL:', e);
  process.exit(1);
});
