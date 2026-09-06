import fs from 'fs';

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    let v = m[2].trim().replace(/^["']|["']$/g, '');
    if (!process.env[m[1]]) process.env[m[1]] = v;
  }
}

loadEnv('.env.local');
loadEnv('.env');

const key = process.env.GROQ_API_KEY || process.env.VITE_GROQ_API_KEY || '';
if (!key || key.includes('placeholder')) {
  console.log('NO_KEY_OR_PLACEHOLDER');
  process.exit(0);
}

const r = await fetch('https://api.groq.com/openai/v1/models', {
  headers: { Authorization: `Bearer ${key}` },
});
const j = await r.json();
console.log('status', r.status);
const ids = (j.data || []).map((x) => x.id);
const visionish = ids.filter((id) => /vision|qwen3|llama-3\.2|vl|scout/i.test(id)).sort();
console.log('visionish_count', visionish.length);
visionish.forEach((id) => console.log(' -', id));
const want = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
  'llama-3.2-90b-vision-preview',
  'llama-3.2-11b-vision-preview',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];
for (const w of want) {
  console.log(w, ids.includes(w) ? 'YES' : 'NO');
}
