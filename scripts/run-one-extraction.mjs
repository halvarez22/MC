/**
 * Extracción única Groq Vision (mismo prompt/modelo de la app) sobre INE del usuario.
 * Uso: node scripts/run-one-extraction.mjs
 * Env: WAIT_MS (default 90000), GROQ_API_KEY / VITE_GROQ_API_KEY
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function loadEnv() {
  for (const f of ['.env.local', '.env']) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

loadEnv();

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';
const WAIT_MS = Number(process.env.WAIT_MS || 90000);
const FRONTAL = path.join(ROOT, 'fixtures/_local_user_ine/frontal.jpg');
const POSTERIOR = path.join(ROOT, 'fixtures/_local_user_ine/posterior.jpg');
const OUT = path.join(ROOT, 'docs/auditoria/_last-extraction.json');

// Misma semántica que api/groqIneCore.ts (campos de afiliado)
// Exacto a api/groqIneCore.ts → INE_VISION_PROMPT
const APP_PROMPT = `Eres un extractor de datos de credenciales INE mexicanas.
Analiza las imágenes (frontal y, si existe, posterior) y devuelve SOLO un objeto JSON válido con este esquema:
{
  "nombre_completo": string opcional,
  "curp": string opcional (18 caracteres),
  "clave_elector": string opcional (18 caracteres),
  "fecha_nacimiento": string opcional,
  "fecha_emision": string opcional,
  "fecha_vigencia": string opcional,
  "domicilio": string opcional,
  "seccion": string opcional,
  "municipio": string opcional,
  "estado": string opcional,
  "localidad": string opcional,
  "raw_ocr_text": string opcional con texto legible concatenado
}
Reglas: omitir campos no visibles; no inventar; CURP/clave exactos si se leen; solo JSON.`;

const GROUND_TRUTH = {
  nombre_completo: 'ALVAREZ GUTIERREZ HECTOR MANUEL',
  curp: 'AAGH650922HGTLTC04',
  clave_elector: 'ALGTHC65092211H100',
  fecha_nacimiento: '22/09/1965',
  fecha_emision: '2016',
  fecha_vigencia: '2026',
  domicilio: 'C PARQUE VIA 324 COL PARQUE MANZANARES 37510 LEON GTO',
  seccion: '1532',
  municipio: '020',
  estado: '11',
  localidad: '0001',
};

function norm(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function scoreField(key, got, expected) {
  if (expected == null || expected === '') return { key, status: 'skip' };
  const g = String(got ?? '').trim();
  if (!g) return { key, status: 'miss', got: '', expected };
  const ng = norm(g);
  const ne = norm(expected);
  if (ng === ne || ng.includes(ne) || ne.includes(ng)) {
    return { key, status: 'ok', got: g, expected };
  }
  if (key === 'fecha_nacimiento') {
    const digitsG = g.replace(/\D/g, '');
    const digitsE = expected.replace(/\D/g, '');
    if (digitsG === digitsE || digitsG.includes('22091965') || digitsG.includes('19650922')) {
      return { key, status: 'ok', got: g, expected, note: 'formato distinto' };
    }
  }
  if (key === 'fecha_vigencia' || key === 'fecha_emision') {
    if (g.includes(expected) || expected.includes(g.replace(/\D/g, '').slice(-4))) {
      return { key, status: 'ok', got: g, expected };
    }
  }
  if (key === 'domicilio' && ng.length > 10) {
    const tokens = ['PARQUEVIA', '324', 'PARQUEMANZANARES', '37510', 'LEON'];
    const hit = tokens.filter((t) => ng.includes(t)).length;
    if (hit >= 3) return { key, status: 'ok', got: g, expected, note: `parcial ${hit}/5 tokens` };
  }
  if (key === 'estado' && (ng === '11' || ng.includes('GUANAJUATO') || ng === 'GTO')) {
    return { key, status: 'ok', got: g, expected };
  }
  if (key === 'municipio' && (ng.includes('020') || ng.includes('LEON'))) {
    return { key, status: 'ok', got: g, expected };
  }
  return { key, status: 'fail', got: g, expected };
}

async function toB64(filePath) {
  const buf = await sharp(filePath)
    .rotate()
    .resize({ width: 640, height: 640, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return buf.toString('base64');
}

async function main() {
  const apiKey = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY;
  if (!apiKey) {
    console.error('Falta GROQ_API_KEY');
    process.exit(1);
  }
  if (!fs.existsSync(FRONTAL) || !fs.existsSync(POSTERIOR)) {
    console.error('Faltan fixtures/_local_user_ine/{frontal,posterior}.jpg');
    process.exit(1);
  }

  console.log('Modelo:', MODEL);
  if (WAIT_MS > 0) {
    console.log(`Espera ${WAIT_MS}ms (rate limit)…`);
    await new Promise((r) => setTimeout(r, WAIT_MS));
  }

  const frontalB64 = await toB64(FRONTAL);
  const posteriorB64 = await toB64(POSTERIOR);
  console.log('Imágenes OK, bytes b64:', frontalB64.length, posteriorB64.length);

  const started = Date.now();
  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: APP_PROMPT },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frontalB64}` } },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${posteriorB64}` } },
          ],
        },
      ],
      temperature: 0.1,
      max_completion_tokens: 4096,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  const ms = Date.now() - started;
  console.log('HTTP', res.status, 'ms', ms);
  if (!res.ok) {
    console.error(JSON.stringify(data?.error || data).slice(0, 1000));
    process.exit(1);
  }

  const raw = data.choices?.[0]?.message?.content;
  let structured;
  try {
    structured = JSON.parse(raw);
  } catch {
    structured = { parse_error: true, raw };
  }

  const keys = Object.keys(GROUND_TRUTH);
  const rows = keys.map((k) => scoreField(k, structured?.[k], GROUND_TRUTH[k]));
  const scored = rows.filter((r) => r.status !== 'skip');
  const ok = scored.filter((r) => r.status === 'ok').length;
  const pct = scored.length ? (ok / scored.length) * 100 : 0;

  const payload = {
    at: new Date().toISOString(),
    model: MODEL,
    ms,
    usage: data.usage || null,
    score: { ok, total: scored.length, pct },
    rows,
    structured,
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2));
  console.log('Score:', `${ok}/${scored.length}`, `(${pct.toFixed(1)}%)`);
  console.log('Guardado:', OUT);
  for (const r of rows) {
    if (r.status === 'skip') continue;
    console.log(`  [${r.status}] ${r.key}: got="${r.got}" expected="${r.expected}"`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
