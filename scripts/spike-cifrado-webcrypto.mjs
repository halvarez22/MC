/**
 * Spike C.1 — Web Crypto AES-GCM + extractable:false + wrap con PIN (PBKDF2).
 * Sin PII real. Uso: node scripts/spike-cifrado-webcrypto.mjs
 */

import {
  decryptUtf8,
  encryptUtf8,
  generateKey,
  generateWrappableKey,
  PBKDF2_ITERATIONS,
  tryExportRawKey,
  unwrapKeyWithPin,
  wrapKeyWithPin,
  randomSalt,
} from '../services/cryptoService.ts';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'docs', 'auditoria', 'spike-cifrado-amenazas.md');

const DUMMY_CURP = 'CURP_DE_PRUEBA_123';
const DUMMY_FOTO = 'FOTO_BASE64_DUMMY';

async function main() {
  const results = [];

  // 1) Llave no extraíble
  const { key, keyId } = await generateKey();
  results.push({ step: 'generateKey', pass: !!key, keyId, extractable: false });

  const exportAttempt = await tryExportRawKey(key);
  const exportBlocked =
    exportAttempt.error.length > 0 &&
    !exportAttempt.error.includes('INESPERADO');
  results.push({
    step: 'exportKey_blocked',
    pass: exportBlocked,
    detail: exportAttempt.error.slice(0, 120),
  });

  // 2) Cifrar / descifrar dummy
  const blobCurp = await encryptUtf8(DUMMY_CURP, key, keyId);
  const blobFoto = await encryptUtf8(DUMMY_FOTO, key, keyId);
  const roundCurp = await decryptUtf8(blobCurp, key);
  const roundFoto = await decryptUtf8(blobFoto, key);
  results.push({
    step: 'roundtrip_curp',
    pass: roundCurp === DUMMY_CURP,
    ciphertext_sample: blobCurp.ciphertext.slice(0, 24) + '…',
  });
  results.push({
    step: 'roundtrip_foto',
    pass: roundFoto === DUMMY_FOTO,
    ciphertext_sample: blobFoto.ciphertext.slice(0, 24) + '…',
  });

  // 3) Opción B: wrap/unwrap con PIN
  const wrappable = await generateWrappableKey();
  const salt = randomSalt(16);
  const pin = '1234';
  const wrapped = await wrapKeyWithPin(wrappable, pin, salt);
  const unwrapped = await unwrapKeyWithPin(wrapped.wrappedKey, pin, salt);
  const blobAfterUnwrap = await encryptUtf8(DUMMY_CURP, unwrapped, keyId + '-unwrapped');
  const plainAfter = await decryptUtf8(blobAfterUnwrap, unwrapped);
  const exportUnwrapped = await tryExportRawKey(unwrapped);
  results.push({
    step: 'pbkdf2_wrap_unwrap',
    pass: plainAfter === DUMMY_CURP,
    iterations: PBKDF2_ITERATIONS,
    wrapped_sample: wrapped.wrappedKey.slice(0, 24) + '…',
  });
  results.push({
    step: 'unwrapped_key_not_exportable',
    pass: exportUnwrapped.error.length > 0 && !exportUnwrapped.error.includes('INESPERADO'),
    detail: exportUnwrapped.error.slice(0, 120),
  });

  const allPass = results.every((r) => r.pass);
  const pct = (results.filter((r) => r.pass).length / results.length) * 100;

  const md = `# Spike Cifrado SSD — Amenazas y Web Crypto (Fase C.1)

**Fecha:** ${new Date().toISOString()}  
**Mandato:** Solo C.1 (cryptoService + spike). Sin IndexedDB / UI.  
**API:** \`crypto.subtle\` (Web Crypto)  
**Algoritmo contenido:** AES-256-GCM  
**PBKDF2:** SHA-256, **${PBKDF2_ITERATIONS}** iteraciones  

> Regla 8: resultados **reales** de esta corrida. Dummy strings únicamente (cero PII).

---

## Modelo de amenaza (resumen)

| Escenario | ¿Protege C.1/C.2? |
|---|---|
| Extracción de archivos raw / dump IndexedDB (dispositivo apagado) | 🟢 Objetivo (datos cifrados) |
| Acceso a RAM en dispositivo desbloqueado en uso | 🔴 No (diligencia debida documentada) |
| exportKey de llave de sesión \`extractable: false\` | 🟢 Bloqueado por el motor |

---

## Resultados del spike

| Paso | Pass | Detalle |
|---|---|---|
${results
  .map(
    (r) =>
      `| ${r.step} | ${r.pass ? '✅' : '❌'} | ${JSON.stringify(
        Object.fromEntries(
          Object.entries(r).filter(([k]) => k !== 'step' && k !== 'pass')
        )
      ).slice(0, 160)} |`
  )
  .join('\n')}

**Tasa:** **${pct.toFixed(0)}%** (${results.filter((r) => r.pass).length}/${results.length})  
**Veredicto spike:** ${allPass ? '🟢 GO técnico C.1' : '🔴 FALLÓ'}

---

## Ciclo demostrado

1. \`generateKey()\` → AES-GCM 256, \`extractable: false\`
2. \`encryptUtf8("CURP_DE_PRUEBA_123")\` / \`FOTO_BASE64_DUMMY\` → \`EncryptedBlob\`
3. \`exportKey('raw')\` → **falla** (llave no extraíble)
4. \`decryptUtf8\` → plaintext original
5. Opción B: \`generateWrappableKey\` → \`wrapKeyWithPin\` (PBKDF2) → \`unwrapKeyWithPin\` (\`extractable: false\`) → round-trip OK

### Nota de diseño (wrap vs extractable)

\`wrapKey\` exige que la llave a envolver sea exportable en el momento del wrap. Por eso el spike:
- Path sesión: \`generateKey\` **no** exportable (cifrado en memoria).
- Path PIN: generar wrappable → wrap inmediato → unwrap como **no** exportable.

---

## Configuración

\`VITE_USE_FIELD_ENCRYPTION=false\` en \`.env.example\` (Strangler; sin cablear stores).

## Siguiente (prohibido hasta GO C.2)

- Persistir llave / blobs en IndexedDB  
- \`deleteImageData\` post-sync  
- UI / PIN de brigadista  

---

## LFPDPPP

Actualizar Aviso: cifrado en reposo en dispositivos con llaves no extraíbles (Web Crypto); límite: no cubre acceso a memoria en dispositivo desbloqueado.
`;

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, md, 'utf8');
  console.log(JSON.stringify({ allPass, pct, results }, null, 2));
  console.log('Reporte:', REPORT);
  process.exit(allPass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
