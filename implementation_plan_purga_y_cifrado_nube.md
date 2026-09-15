# Plan: Purga + cifrado nube — CERTIFICADO CERRADO

**Auditoría Qwen:** 🟢 APROBADO Y CERRADO DEFINITIVAMENTE (2026-09-16)  
**Proyecto Firebase:** `movimiento-15317`  
**Promesa:** cero vestigio local post-sync + dump Firestore ilegible sin KMS.

| Fase | Estado |
|------|--------|
| D.1 Purga dispositivo | 🟢 cerrada / bloqueada |
| D.2a Spike cifrado | 🟢 cerrada |
| D.2b Admin SDK + sync + E2E | 🟢 cerrada / apta producción* |

\*Producción requiere ops: `FIREBASE_SERVICE_ACCOUNT_JSON`, rotación `CLOUD_KEK_SECRET` / `CLOUD_BLIND_SECRET` (ver advertencias abajo).

---

## Ops producción (críticos)

1. **`FIREBASE_SERVICE_ACCOUNT_JSON`** (o `GOOGLE_APPLICATION_CREDENTIALS`) en Vercel/server — **nunca** `VITE_*`. Sin esto → fallback mock.
2. Rotación planificada de **`CLOUD_KEK_SECRET`** (`enc_v` permite migración).
3. Rotación de **`BLIND_INDEX_SECRET`** implica re-indexado masivo de `blind_curp`.

## Evidencia E2E

- `e2e/zero-pii-post-ack.spec.ts`
- `e2e/secure-sync-and-purge.spec.ts` (2xx / 409 / 5xx)
- 4 passed (~24s) en cierre de auditoría

## No reabrir sin nuevo GO

- No tocar lógica interna de `executeLocalPurge` / `useDrainPendingPurge` salvo regresión.
- No exponer KEK / blind secret al frontend.
- Blind index: solo igualdad exacta.
