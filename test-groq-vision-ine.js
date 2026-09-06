/**
 * Spike 2.0 — A/B Groq Vision OCR INE
 *
 * (A) Imagen original redimensionada máx 1024px (compresión ligera)
 * (B) Preprocess agresivo aproximado (gris + threshold / contraste)
 *
 * Uso (Node, server-side — NO browser):
 *   set GROQ_API_KEY=gsk_...   (preferido; SSD)
 *   node test-groq-vision-ine.js --frontal path/a.jpg [--posterior path/b.jpg] \
 *     [--expect-curp XXX] [--expect-name "NOMBRE"]
 *
 * Modelo: GROQ_VISION_MODEL (default qwen/qwen3.6-27b)
 * Escribe: docs/auditoria/spike-2.0-resultados.md
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'qwen/qwen3.6-27b';
const MAX_EDGE = 1024;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.join(__dirname, '.env.local'));
loadEnvFile(path.join(__dirname, '.env'));

function parseArgs(argv) {
  const out = {
    frontal: null,
    posterior: null,
    expectCurp: null,
    expectName: null,
    manifest: null,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--frontal') out.frontal = argv[++i];
    else if (a === '--posterior') out.posterior = argv[++i];
    else if (a === '--expect-curp') out.expectCurp = argv[++i];
    else if (a === '--expect-name') out.expectName = argv[++i];
    else if (a === '--manifest') out.manifest = argv[++i];
  }
  return out;
}

function resolveApiKey() {
  if (process.env.GROQ_API_KEY) return { key: process.env.GROQ_API_KEY, source: 'GROQ_API_KEY' };
  if (process.env.VITE_GROQ_API_KEY) {
    console.warn(
      '⚠️ Spike local usando VITE_GROQ_API_KEY. El proxy de prod SOLO acepta GROQ_API_KEY (SSD).'
    );
    return { key: process.env.VITE_GROQ_API_KEY, source: 'VITE_GROQ_API_KEY (local spike only)' };
  }
  return { key: '', source: 'none' };
}

async function getSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    console.error('Instala sharp: npm i -D sharp');
    process.exit(1);
  }
}

/** Variante A: resize max edge 1024, jpeg q≈0.85 */
async function variantA(sharp, inputPath) {
  const buf = await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  return buf.toString('base64');
}

/** Variante B: preprocess agresivo aproximado (gris + normalización + threshold) */
async function variantB(sharp, inputPath) {
  const buf = await sharp(inputPath)
    .rotate()
    .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
    .greyscale()
    .normalize()
    .linear(1.5, -(128 * 0.5)) // contraste aproximado
    .threshold(110) // umbral fijo cercano al fallback Otsu del servicio
    .jpeg({ quality: 95 })
    .toBuffer();
  return buf.toString('base64');
}

const PROMPT = `Eres un extractor de datos de credenciales INE mexicanas.
Analiza la(s) imagen(es) y devuelve SOLO JSON:
{
  "nombre_completo": string opcional,
  "curp": string opcional,
  "clave_elector": string opcional,
  "fecha_nacimiento": string opcional,
  "domicilio": string opcional,
  "seccion": string opcional,
  "municipio": string opcional,
  "estado": string opcional,
  "localidad": string opcional,
  "raw_ocr_text": string opcional
}
No inventes datos. Solo JSON.`;

async function callGroqVision({ apiKey, model, frontalB64, posteriorB64 }) {
  const content = [
    { type: 'text', text: PROMPT },
    { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${frontalB64}` } },
  ];
  if (posteriorB64) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/jpeg;base64,${posteriorB64}` },
    });
  }

  const res = await fetch(GROQ_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.1,
      max_completion_tokens: 2000,
      response_format: { type: 'json_object' },
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${JSON.stringify(data?.error || data)}`);
  }
  const raw = data.choices?.[0]?.message?.content;
  let structured = null;
  try {
    structured = JSON.parse(raw);
  } catch {
    structured = { parse_error: true, raw };
  }
  return { structured, usage: data.usage || null, raw };
}

function score(structured, expectCurp, expectName) {
  const curp = (structured?.curp || '').toUpperCase().replace(/\s/g, '');
  const name = (structured?.nombre_completo || '').toUpperCase();
  const curpOk = expectCurp
    ? curp === expectCurp.toUpperCase().replace(/\s/g, '')
    : /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]{2}$/.test(curp);
  const nameOk = expectName
    ? name.includes(expectName.toUpperCase()) || expectName.toUpperCase().includes(name)
    : Boolean(name && name.length > 5 && !name.includes('NO SE'));
  return {
    curpPresent: Boolean(curp),
    curpOk,
    namePresent: Boolean(name),
    nameOk,
    curp,
    name,
  };
}

function writeReport(reportPath, report) {
  const samplesTable = (report.samples || [])
    .map(
      (s) =>
        `| ${s.id} | ${s.scoreA.curpOk && s.scoreA.nameOk ? '✅' : '❌'} | ${s.scoreB.curpOk && s.scoreB.nameOk ? '✅' : '❌'} | \`${s.scoreA.curp || '—'}\` | \`${s.scoreA.name || '—'}\` |`
    )
    .join('\n');

  const md = `# Spike 2.0 — Resultados Groq Vision INE

**Fecha:** ${new Date().toISOString()}  
**Modelo:** \`${report.model}\`  
**Key source:** ${report.keySource}  
**n muestras:** ${report.n}

## Metodología A/B

| Variante | Descripción |
|---|---|
| **A** | Original rotada EXIF, resize max ${MAX_EDGE}px, JPEG q=85 |
| **B** | Igual resize + greyscale + normalize + linear contraste + threshold(110) ≈ preprocess agresivo |

## Resumen agregado (gate ≥90%)

| Métrica | Variante A | Variante B |
|---|---:|---:|
| CURP ok | ${report.agg.aCurpPct}% (${report.agg.aCurpOk}/${report.n}) | ${report.agg.bCurpPct}% (${report.agg.bCurpOk}/${report.n}) |
| Nombre ok | ${report.agg.aNamePct}% (${report.agg.aNameOk}/${report.n}) | ${report.agg.bNamePct}% (${report.agg.bNameOk}/${report.n}) |
| CURP+Nombre ok | ${report.agg.aBothPct}% (${report.agg.aBothOk}/${report.n}) | ${report.agg.bBothPct}% (${report.agg.bBothOk}/${report.n}) |

## Por muestra

| ID | A OK | B OK | CURP (A) | Nombre (A) |
|---|---|---|---|---|
${samplesTable || '| — | — | — | — | — |'}

## Veredicto

${report.verdict}

## Gate go/no-go

- Umbral negocio: **≥90%** CURP+Nombre en la variante ganadora.
- Activar \`VITE_USE_GROQ_VISION=true\` y deprecar Google Vision **solo** si este umbral se cumple.

## Evidencia de modelo

Docs oficiales Groq Vision: \`qwen/qwen3.6-27b\` / \`qwen/qwen3.8-27b\`.  
Llama 3.2 Vision preview: **deprecated** (2025-04-14).
`;

  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, md, 'utf8');
  console.log(`\n📄 Reporte: ${reportPath}`);
}

async function runOneSample({ sharp, apiKey, model, id, frontal, posterior, expectCurp, expectName }) {
  const aFrontal = await variantA(sharp, frontal);
  const aPosterior = posterior ? await variantA(sharp, posterior) : null;
  const bFrontal = await variantB(sharp, frontal);
  const bPosterior = posterior ? await variantB(sharp, posterior) : null;

  const resA = await callGroqVision({
    apiKey,
    model,
    frontalB64: aFrontal,
    posteriorB64: aPosterior,
  });
  const resB = await callGroqVision({
    apiKey,
    model,
    frontalB64: bFrontal,
    posteriorB64: bPosterior,
  });

  return {
    id,
    frontal,
    posterior,
    scoreA: score(resA.structured, expectCurp, expectName),
    scoreB: score(resB.structured, expectCurp, expectName),
    structuredA: resA.structured,
    structuredB: resB.structured,
  };
}

function pct(ok, n) {
  return n === 0 ? 0 : Math.round((ok / n) * 1000) / 10;
}

async function main() {
  const args = parseArgs(process.argv);
  const { key, source } = resolveApiKey();
  const model = process.env.GROQ_VISION_MODEL || DEFAULT_MODEL;
  const reportPath = path.join(__dirname, 'docs', 'auditoria', 'spike-2.0-resultados.md');
  const fixturesDir = path.join(__dirname, 'fixtures');

  let jobs = [];
  if (args.manifest) {
    const manifestPath = path.resolve(args.manifest);
    const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const base = path.dirname(manifestPath);
    jobs = items.map((item) => ({
      id: item.id || path.basename(item.frontal, path.extname(item.frontal)),
      frontal: path.join(base, item.frontal),
      posterior: item.posterior ? path.join(base, item.posterior) : null,
      expectCurp: item.expectCurp || null,
      expectName: item.expectName || null,
    }));
  } else if (args.frontal) {
    jobs = [
      {
        id: 'single',
        frontal: path.resolve(args.frontal),
        posterior: args.posterior ? path.resolve(args.posterior) : null,
        expectCurp: args.expectCurp,
        expectName: args.expectName,
      },
    ];
  } else {
    const stub = `# Spike 2.0 — Resultados Groq Vision INE

**Estado:** ⏳ PENDIENTE — ejecución empírica del usuario (Regla 8: cero datos falsificados)

## Cómo ejecutar

\`\`\`bash
set GROQ_API_KEY=gsk_xxx
copy fixtures\\manifest.example.json fixtures\\manifest.json
# edita manifest + añade jpgs en fixtures/
node test-groq-vision-ine.js --manifest ./fixtures/manifest.json
\`\`\`

O una muestra:

\`\`\`bash
node test-groq-vision-ine.js --frontal ./fixtures/ine01_frontal.jpg --posterior ./fixtures/ine01_posterior.jpg --expect-curp "XXXX..." --expect-name "APELLIDO"
\`\`\`

Ver: \`fixtures/README.md\`
`;
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, stub, 'utf8');
    console.error('Falta --frontal o --manifest. Stub escrito en docs/auditoria/spike-2.0-resultados.md');
    process.exit(2);
  }

  if (!key || key.includes('placeholder') || key === 'your_groq_api_key_here') {
    console.error('Configura GROQ_API_KEY real (no placeholder)');
    process.exit(2);
  }

  const sharp = await getSharp();
  console.log(`Modelo: ${model} | Key: ${source} | Jobs: ${jobs.length}`);

  const samples = [];
  for (const job of jobs) {
    if (!fs.existsSync(job.frontal)) {
      console.error(`No existe frontal: ${job.frontal}`);
      process.exit(2);
    }
    console.log(`\n=== ${job.id} ===`);
    const sample = await runOneSample({ sharp, apiKey: key, model, ...job });
    samples.push(sample);
    console.log('A', sample.scoreA);
    console.log('B', sample.scoreB);
  }

  const n = samples.length;
  const aCurpOk = samples.filter((s) => s.scoreA.curpOk).length;
  const aNameOk = samples.filter((s) => s.scoreA.nameOk).length;
  const aBothOk = samples.filter((s) => s.scoreA.curpOk && s.scoreA.nameOk).length;
  const bCurpOk = samples.filter((s) => s.scoreB.curpOk).length;
  const bNameOk = samples.filter((s) => s.scoreB.nameOk).length;
  const bBothOk = samples.filter((s) => s.scoreB.curpOk && s.scoreB.nameOk).length;

  const agg = {
    aCurpOk,
    aNameOk,
    aBothOk,
    bCurpOk,
    bNameOk,
    bBothOk,
    aCurpPct: pct(aCurpOk, n),
    aNamePct: pct(aNameOk, n),
    aBothPct: pct(aBothOk, n),
    bCurpPct: pct(bCurpOk, n),
    bNamePct: pct(bNameOk, n),
    bBothPct: pct(bBothOk, n),
  };

  let verdict;
  if (agg.aBothPct >= 90 || agg.bBothPct >= 90) {
    const winner = agg.aBothPct >= agg.bBothPct ? 'A' : 'B';
    verdict = `**GO:** Variante **${winner}** alcanza ≥90% CURP+Nombre (${winner === 'A' ? agg.aBothPct : agg.bBothPct}%). Listo para proponer \`VITE_USE_GROQ_VISION=true\` al auditor.`;
  } else if (agg.aBothPct > agg.bBothPct) {
    verdict = `**NO-GO aún.** Gana A (${agg.aBothPct}%) vs B (${agg.bBothPct}%), pero <90%. Mejorar fotos/prompt o ampliar corpus.`;
  } else if (agg.bBothPct > agg.aBothPct) {
    verdict = `**NO-GO aún.** Gana B (${agg.bBothPct}%) vs A (${agg.aBothPct}%), pero <90%.`;
  } else {
    verdict = `**NO-GO.** Empate/bajo rendimiento A=${agg.aBothPct}% B=${agg.bBothPct}%. No activar flag.`;
  }

  writeReport(reportPath, {
    model,
    keySource: source,
    n,
    samples,
    agg,
    verdict,
  });

  console.log('\n' + verdict);
  console.log(`Fixtures dir: ${fixturesDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
