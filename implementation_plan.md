# APO-AUDIT-FORENSIC — Bitácora forense (accesos + gestiones)

**Estado:** ✅ **IMPLEMENTADO** (A.1–A.6)  
**Alcance:** Solo visible para **Admin**. Afiliados en bóveda siguen cifrados; la bitácora es rastro de movimientos, no padrón.

---

## 0. Intención del cliente (cerrada)

| Requisito | Acuerdo |
|-----------|---------|
| Quién / desde dónde / hora | **Sí** |
| Login fallido | **Sí** + origen del intento |
| Afilió / baja | Detalle con **CURP enmascarado** (no nombre/domicilio) |
| Menús de la app | Registrar entrada a pantallas relevantes |
| Quién ve la bitácora | **Solo Admin** |
| CURP en BD afiliados | Sigue **cifrado** en `encrypted_affiliates` |

---

## 1. Entrega

| Capa | Archivos |
|------|----------|
| Mask | `services/auditMask.ts` |
| Store | `services/auditEventStore.ts` (`audit_events`, mock\|Firestore) |
| API | `api/audit/append.ts`, `api/audit/list.ts`, `api/audit/auditCore.ts` |
| Server hooks | `secureCore.ts`, `secureDeleteCore.ts` → `recordServerAudit` |
| Cliente | `services/forensicAuditClient.ts` — Login / logout / SCREEN_VIEW |
| UI | `AuditLogView` + `AuditLogTable` (Usuario / Desde dónde / Hora / Acción) |
| Proxy Vite | `/api/audit/append`, `/api/audit/list` |
| Rules | `firestore.rules` — `audit_events` deny all client |
| Flag | `VITE_USE_FORENSIC_AUDIT` (default ON; `false` → mock legacy) |
| Smoke | `npm run smoke:audit-forensic:local` |

**Auth append:** LOGIN_* / LOGOUT anónimos acotados; SCREEN_VIEW y list con Bearer `ADMIN_LIST_SECRET`.

---

## 2. CURP enmascarado

`maskCurp('AAGH650922HGTLTC04')` → `AAGH********TC04` — solo `curpMasked` en eventos.

---

## 3. Verificación

```bash
npm run smoke:audit-forensic:local
```

Esperado: LOGIN_FAILURE con IP en `sourceSummary`, AFFILIATE_CREATE con CURP enmascarado, SCREEN_VIEW, list 200 / 401 sin Bearer.

**Hotfix prod (2026-09-17):** `POST /api/audit/append` → `FUNCTION_INVOCATION_FAILED` porque Firestore Admin rechaza campos `undefined` en el documento. Fix: `omitUndefined` antes de `set` + try/catch en append.

**STOP:** D.1 IndexedDB, foto INE, no ampliar envelope afiliado para audit.

---

## 4. Checklist carta industrial

- [x] Intención + CURP enmascarado acordados  
- [x] Grafo API → store → UI  
- [x] Mínimo PII (sin nombre/domicilio)  
- [x] GO implementación A.1–A.6  
- [x] UI Admin-only + Reintentar en error de carga  
- [x] Debounce pantallas (400 ms)  
- [x] Validación en capa servicio  
