# APO-ADMIN-BAJA — Baja / eliminación de afiliados (Admin)

**Estado:** 🟢 **IMPLEMENTADO B.1–B.3 (+ B.4 rules)** — pendiente commit/push/deploy  
**Decisión:** Hard delete → CURP **reafiliable** (no 409 tras baja).  
**Smoke local:** `npm run smoke:admin-baja:local` → **MOCK_SMOKE PASS**  
**Smoke prod (tras deploy):** `npm run smoke:admin-baja`

## Entregado

| Fase | Qué |
|------|-----|
| B.1 | `deleteEncryptedById` + `POST /api/affiliates/secure-delete` + proxy Vite |
| B.2 | `removeAffiliate` en hook + **Dar de baja** en detalle + modal U-First |
| B.3 | Smoke local create→delete→create=201; script prod listo |
| B.4 | `firestore.rules`: `allow delete: if false` (solo Admin SDK) |

## UX
- Detalle Admin → **Dar de baja** → confirma (CURP quedará libre) → lista
- Sin “Editar” legacy en modo cifrado
- Cancelar / Reintentar / Volver

## STOP respetados
D.1 IndexedDB, Autocaptura, foto INE — no tocados.
