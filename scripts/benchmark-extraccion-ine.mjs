/**
 * Benchmark extracción INE: mismo prompt/modelo que el proxy de la app
 * (api/groqIneCore.ts) vs ground truth de una muestra real.
 *
 * No llama Lista Nominal (sin tokens DNS).
 *
 *   node scripts/benchmark-extraccion-ine.mjs
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[m[1]]) process.env[m[1]] = val;
  }
}
loadEnvFile(path.join(ROOT, '.env.local'));

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = process.env.GROQ_VISION_MODEL || 'qwen/qwen3.6-27b';
const MAX_EDGE = Number(process.env.BENCH_MAX_EDGE || 768);
const ONLY = (process.env.BENCH_ONLY || '').toUpperCase(); // 'A' | 'B' | ''
const INITIAL_WAIT_MS = Number(process.env.BENCH_WAIT_MS || 70000);

/** Prompt idéntico al proxy de producción (groqIneCore.ts). */
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

/** Ground truth (lectura humana de la imagen del usuario). */
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
  // Campos clave para Lista Nominal (aún no en prompt de app)
  cic: '141362602',
  ocr_credencial: '1532041362785',
};

const FRONTAL = path.join(ROOT, 'fixtures', '_local_user_ine', 'frontal.jpg');
const POSTERIOR = path.join(ROOT, 'fixtures', '_local_user_ine', 'posterior.jpg');

function norm(s) {
  return String(s || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]/g, '');
}

function scoreField(key, got, expected) {
  const g = String(got || '').trim();
  const e = String(expected || '').trim();
  if (!e) return { key, status: 'skip', got: g, expected: e };
  if (!g) return { key, status: 'missing', got: g, expected: e };

  if (key === 'nombre_completo') {
    const ng = norm(g);
    const ne = norm(e);
    const ok = ng.includes(ne) || ne.includes(ng) || 
      (ng.includes('ALVAREZ') && ng.includes('GUTIERREZ') && ng.includes('HECTOR'));
    return { key, status: ok ? 'ok' : 'mismatch', got: g, expected: e };
  }
  if (key === 'domicilio') {
    const ng = norm(g);
    const tokens = ['PARQUE', 'VIA', '324', 'MANZANARES', '37510', 'LEON'];
    const hits = tokens.filter((t) => ng.includes(t)).length;
    return { key, status: hits >= 4 ? 'ok' : 'mismatch', got: g, expected: e, hits };
  }
  if (key === 'fecha_nacimiento') {
    const ok = norm(g).includes('22091965') || norm(g).includes('19650922') || g.includes('22/09/1965');
    return { key, status: ok ? 'ok' : 'mismatch', got: g, expected: e };
  }
  if (key === 'fecha_emision' || key === 'fecha_vigencia') {
    const ok = norm(g).includes(norm(e));
    return { key, status: ok ? 'ok' : 'mismatch', got: g, expected: e };
  }
  if (key === 'municipio' || key === 'estado' || key === 'localidad' || key === 'seccion') {
    const ok = norm(g).includes(norm(e)) || norm(e).includes(norm(g));
    return { key, status: ok ? 'ok' : 'mismatch', got: g, expected: e };
  }
  // exactos: curp, clave
  const ok = norm(g) === norm(e);
  return { key, status: ok ? 'ok' : 'mismatch', got: g, expected: e };
}

async function variantA(inputPath) {
  const buf = await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return buf.toString('base64');
}

async function variantB(inputPath) {
  const buf = await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .normalize()
    .linear(1.5, -(128 * 0.5))
    .threshold(110)
    .jpeg({ quality: 95 })
    .toBuffer();
  return buf.toString('base64');
}

async function callVision(apiKey, frontalB64, posteriorB64) {
  const content = [
    { type: 'text', text: APP_PROMPT },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frontalB64}` } },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${posteriorB64}` } },
  ];
  const started = Date.now();
  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_completion_tokens: 8000,
      response_format: { type: 'json_object' },
    }),
  });
  const data = await res.json();
  const ms = Date.now() - started;
  if (!res.ok) throw new Error(`Groq ${res.status}: ${JSON.stringify(data?.error || data)}`);
  const raw = data.choices?.[0]?.message?.content;
  let structured;
  try {
    structured = JSON.parse(raw);
  } catch {
    structured = { parse_error: true, raw };
  }
  return { structured, usage: data.usage || null, ms };
}

function evaluate(structured) {
  const keys = [
    'nombre_completo',
    'curp',
    'clave_elector',
    'fecha_nacimiento',
    'fecha_emision',
    'fecha_vigencia',
    'domicilio',
    'seccion',
    'municipio',
    'estado',
    'localidad',
  ];
  const rows = keys.map((k) => scoreField(k, structured?.[k], GROUND_TRUTH[k]));
  const scored = rows.filter((r) => r.status !== 'skip');
  const ok = scored.filter((r) => r.status === 'ok').length;
  return {
    rows,
    ok,
    total: scored.length,
    pct: scored.length ? (ok / scored.length) * 100 : 0,
  };
}

function checkListaNominalReadiness(structured) {
  const text = JSON.stringify(structured || {}).toUpperCase();
  return {
    cicInJson: Boolean(structured?.cic),
    ocrInJson: Boolean(structured?.ocr_credencial || structured?.ocr),
    cicInRaw: text.includes('141362602'),
    mrzHint: text.includes('IDMEX') || text.includes('1532041362785'),
  };
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

  console.log('Modelo (app):', MODEL);
  console.log('Frontal:', FRONTAL);
  console.log('Posterior:', POSTERIOR);
  if (INITIAL_WAIT_MS > 0) {
    console.log(`Espera inicial ${INITIAL_WAIT_MS}ms (rate limit)…`);
    await new Promise((r) => setTimeout(r, INITIAL_WAIT_MS));
  }

  const results = {};
  const variants = [
    ['A_ligero', variantA],
    ['B_agresivo', variantB],
  ].filter(([label]) => {
    if (ONLY === 'A') return label.startsWith('A');
    if (ONLY === 'B') return label.startsWith('B');
    return true;
  });
  for (let i = 0; i < variants.length; i++) {
    const [label, prep] = variants[i];
    if (i > 0) {
      console.log('Esperando 55s por rate limit Groq…');
      await new Promise((r) => setTimeout(r, 55000));
    }
    console.log(`\n→ Variante ${label}…`);
    try {
      const f = await prep(FRONTAL);
      const p = await prep(POSTERIOR);
      const out = await callVision(apiKey, f, p);
      const ev = evaluate(out.structured);
      const ln = checkListaNominalReadiness(out.structured);
      results[label] = { ...out, ev, ln };
      console.log(
        `  ${ev.ok}/${ev.total} campos OK (${ev.pct.toFixed(1)}%) en ${out.ms}ms`
      );
    } catch (err) {
      console.error(`  FALLÓ ${label}:`, err instanceof Error ? err.message : err);
      results[label] = {
        structured: { error: String(err instanceof Error ? err.message : err) },
        usage: null,
        ms: 0,
        ev: {
          rows: Object.keys(GROUND_TRUTH)
            .filter((k) => !['cic', 'ocr_credencial'].includes(k))
            .map((k) => ({
              key: k,
              status: 'missing',
              got: '',
              expected: GROUND_TRUTH[k],
            })),
          ok: 0,
          total: 11,
          pct: 0,
        },
        ln: { cicInJson: false, ocrInJson: false, cicInRaw: false, mrzHint: false },
        failed: true,
      };
    }
  }

  const ranked = Object.entries(results)
    .filter(([, v]) => !v.failed)
    .sort((a, b) => b[1].ev.pct - a[1].ev.pct);
  const best = ranked[0]?.[0] || 'A_ligero';
  const bestEv = results[best].ev;

  const reportPath = path.join(
    ROOT,
    'docs',
    'auditoria',
    'extraccion-ine-benchmark-usuario.md'
  );

  const tableFor = (label) =>
    results[label].ev.rows
      .map(
        (r) =>
          `| ${r.key} | \`${r.expected}\` | \`${(r.got || '—').toString().slice(0, 60)}\` | ${
            r.status === 'ok' ? '✅' : r.status === 'missing' ? '⬜' : '❌'
          } |`
      )
      .join('\n');

  const md = `# Benchmark extracción INE — pipeline de la app vs ground truth

**Fecha:** ${new Date().toISOString()}  
**Alcance:** Solo OCR/Visión Groq (mismo prompt que \`api/groqIneCore.ts\`). **Sin** Lista Nominal (tokens DNS agotados).  
**Modelo:** \`${MODEL}\`  
**Muestra:** 1 INE real (frontal + posterior recortados de captura del usuario; PII no versionada en git).  

> Comparación contra lectura humana de la imagen (agente). Objetivo: medir si la app extrae con eficiencia similar.

---

## Ground truth (humano)

| Campo | Valor |
|---|---|
| Nombre | ALVAREZ GUTIERREZ HECTOR MANUEL |
| CURP | AAGH650922HGTLTC04 |
| Clave elector | ALGTHC65092211H100 |
| Nacimiento | 22/09/1965 |
| Emisión / Vigencia | 2016 / 2026 |
| Sección | 1532 |
| Estado / Mun / Loc | 11 / 020 / 0001 |
| CIC (MRZ, para LN) | 141362602 |
| OCR credencial (MRZ) | 1532041362785 |

---

## Resultados por variante (preprocess de la app)

| Variante | Campos OK | % | Latencia | Tokens (si aplica) |
|---|---:|---:|---:|---|
| **A** resize ligero (path visión típico) | ${results.A_ligero.ev.ok}/${results.A_ligero.ev.total} | ${results.A_ligero.ev.pct.toFixed(1)}% | ${results.A_ligero.ms} ms | ${JSON.stringify(results.A_ligero.usage)} |
| **B** preprocess agresivo | ${results.B_agresivo.ev.ok}/${results.B_agresivo.ev.total} | ${results.B_agresivo.ev.pct.toFixed(1)}% | ${results.B_agresivo.ms} ms | ${JSON.stringify(results.B_agresivo.usage)} |

**Ganadora:** **${best}** (${bestEv.pct.toFixed(1)}%)

---

## Detalle — Variante A (ligero)

| Campo | Esperado | Extraído | ¿OK? |
|---|---|---|---|
${tableFor('A_ligero')}

\`\`\`json
${JSON.stringify(results.A_ligero.structured, null, 2)}
\`\`\`

---

## Detalle — Variante B (agresivo)

| Campo | Esperado | Extraído | ¿OK? |
|---|---|---|---|
${tableFor('B_agresivo')}

\`\`\`json
${JSON.stringify(results.B_agresivo.structured, null, 2)}
\`\`\`

---

## Listos para Lista Nominal (hueco de producto)

El prompt actual de la app **no pide** \`cic\` / \`ocr_credencial\` / \`id_ciudadano\`.  
Chequeo incidental en la salida:

| Variante | cic en JSON | ocr en JSON | rastro MRZ/CIC en texto |
|---|---|---|---|
| A | ${results.A_ligero.ln.cicInJson ? 'sí' : 'no'} | ${results.A_ligero.ln.ocrInJson ? 'sí' : 'no'} | ${results.A_ligero.ln.cicInRaw || results.A_ligero.ln.mrzHint ? 'sí' : 'no'} |
| B | ${results.B_agresivo.ln.cicInJson ? 'sí' : 'no'} | ${results.B_agresivo.ln.ocrInJson ? 'sí' : 'no'} | ${results.B_agresivo.ln.cicInRaw || results.B_agresivo.ln.mrzHint ? 'sí' : 'no'} |

Sin esos campos, aunque el OCR del frente sea excelente, **no se puede armar** la llamada DNS modelo D/E automáticamente.

---

## Veredicto

| Pregunta | Respuesta |
|---|---|
| ¿La app puede extraer CURP/nombre/clave como un humano? | ${bestEv.pct >= 80 ? '🟢 Sí, con buena eficiencia en esta muestra' : bestEv.pct >= 50 ? '🟡 Parcial' : '🔴 Débil'} (${bestEv.pct.toFixed(1)}% campos del contrato actual) |
| ¿CURP exacto? | A: ${results.A_ligero.ev.rows.find((r) => r.key === 'curp')?.status} / B: ${results.B_agresivo.ev.rows.find((r) => r.key === 'curp')?.status} |
| ¿Clave elector exacta? | A: ${results.A_ligero.ev.rows.find((r) => r.key === 'clave_elector')?.status} / B: ${results.B_agresivo.ev.rows.find((r) => r.key === 'clave_elector')?.status} |
| ¿Lista Nominal ready? | 🔴 Aún no (prompt sin CIC/OCR/id_ciudadano) |

**Recomendación:** mantener Variante **${best.startsWith('A') ? 'A' : 'B'}** en orquestador; en Fase 3.1 ampliar prompt/contrato para CIC+OCR del reverso antes de gastar tokens DNS.

---

## Nota privacidad

Fixtures en \`fixtures/_local_user_ine/\` están gitignored (\`fixtures/*\`). Este reporte omite la imagen y no republica PII innecesaria más allá de campos ya usados en la prueba.
`;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log('\n📄', reportPath);
  console.log(`Veredicto: ${best} @ ${bestEv.pct.toFixed(1)}%`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
