# Spike Cifrado SSD — Amenazas y Web Crypto (Fase C.1)

**Fecha:** 2026-09-07T22:13:02.816Z  
**Mandato:** Solo C.1 (cryptoService + spike). Sin IndexedDB / UI.  
**API:** `crypto.subtle` (Web Crypto)  
**Algoritmo contenido:** AES-256-GCM  
**PBKDF2:** SHA-256, **210000** iteraciones  

> Regla 8: resultados **reales** de esta corrida. Dummy strings únicamente (cero PII).

---

## Modelo de amenaza (resumen)

| Escenario | ¿Protege C.1/C.2? |
|---|---|
| Extracción de archivos raw / dump IndexedDB (dispositivo apagado) | 🟢 Objetivo (datos cifrados) |
| Acceso a RAM en dispositivo desbloqueado en uso | 🔴 No (diligencia debida documentada) |
| exportKey de llave de sesión `extractable: false` | 🟢 Bloqueado por el motor |

---

## Resultados del spike

| Paso | Pass | Detalle |
|---|---|---|
| generateKey | ✅ | {"keyId":"33784ed9-bd25-41ad-a1b9-e9a2dc2a75d9","extractable":false} |
| exportKey_blocked | ✅ | {"detail":"key is not extractable"} |
| roundtrip_curp | ✅ | {"ciphertext_sample":"zjNYtKFAFxrXImK6K4/T2BfT…"} |
| roundtrip_foto | ✅ | {"ciphertext_sample":"I/ADJLNWD9clUaQpdjMQoagh…"} |
| pbkdf2_wrap_unwrap | ✅ | {"iterations":210000,"wrapped_sample":"RJHtYH5bXKoxAjvlIZCVk1hS…"} |
| unwrapped_key_not_exportable | ✅ | {"detail":"key is not extractable"} |

**Tasa:** **100%** (6/6)  
**Veredicto spike:** 🟢 GO técnico C.1

---

## Ciclo demostrado

1. `generateKey()` → AES-GCM 256, `extractable: false`
2. `encryptUtf8("CURP_DE_PRUEBA_123")` / `FOTO_BASE64_DUMMY` → `EncryptedBlob`
3. `exportKey('raw')` → **falla** (llave no extraíble)
4. `decryptUtf8` → plaintext original
5. Opción B: `generateWrappableKey` → `wrapKeyWithPin` (PBKDF2) → `unwrapKeyWithPin` (`extractable: false`) → round-trip OK

### Nota de diseño (wrap vs extractable)

`wrapKey` exige que la llave a envolver sea exportable en el momento del wrap. Por eso el spike:
- Path sesión: `generateKey` **no** exportable (cifrado en memoria).
- Path PIN: generar wrappable → wrap inmediato → unwrap como **no** exportable.

---

## Configuración

`VITE_USE_FIELD_ENCRYPTION=false` en `.env.example` (Strangler; sin cablear stores).

## Siguiente (prohibido hasta GO C.2)

- Persistir llave / blobs en IndexedDB  
- `deleteImageData` post-sync  
- UI / PIN de brigadista  

---

## LFPDPPP

Actualizar Aviso: cifrado en reposo en dispositivos con llaves no extraíbles (Web Crypto); límite: no cubre acceso a memoria en dispositivo desbloqueado.
