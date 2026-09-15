# APO — Admin lee afiliados cifrados (demo cliente)

**Estado:** 🟢 **GO APO.1+2 EN CURSO / listo para auditoría** (Qwen 2026-09-15)  
**Condiciones aplicadas:** orgId solo `ADMIN_DEFAULT_ORG_ID` · Bearer `ADMIN_LIST_SECRET` · ESM `.js` · Strangler UI · TODO APO.3

---

## 0. Diagnóstico (evidencia)

| Hecho | Evidencia |
|-------|-----------|
| UI «Gestión de Afiliados» muestra Juan/María/Carlos | `firebaseService` mock en memoria |
| Registros INE/campo «exitosos» van a otra parte | `POST /api/affiliates/secure` → colección `encrypted_affiliates` |
| Decrypt server-side **ya existe** | `decryptAffiliateRecord` en `cloudEncryptionService.ts` |
| **Falta** listar por org + API admin + cablear UI | `encryptedAffiliateFirebaseStore` sin `listByOrg` |

**Causa raíz:** Strangler incompleto — write D.2b listo; read admin aún en mock legacy. **No es bug de filtros.**

---

## 1. Grafo de impacto

```text
[WRITE — NO TOCAR en este APO]
Captura INE → sync → POST /api/affiliates/secure
  → encryptAffiliateRecord (CLOUD_KEK / CLOUD_BLIND)
  → saveEncryptedAffiliateUnique → Firestore encrypted_affiliates

[READ HOY]
App (role=admin) → AffiliatesView → firebaseService.onAffiliatesSnapshot → MOCK

[READ PROPUESTO]
App (role=admin + flag)
  → useEncryptedAffiliatesAdmin
  → GET /api/affiliates/secure-list  (auth admin)
      → listEncryptedByOrg(orgId)
      → decryptAffiliateRecord  (solo server)
      → DTO plaintext mínimo → AffiliateTable
  → UX: loading / error / Reintentar / Volver

[PRUEBA PARALELA DEMO]
Consola Firebase → docs raw = ciphertext (sin nombre/CURP en claro)
```

| Capa | Archivos | Cambio |
|------|----------|--------|
| Store | `services/encryptedAffiliateFirebaseStore.ts` | + `listEncryptedByOrg` |
| Crypto | `services/cloudEncryptionService.ts` | reutilizar decrypt (sin cambiar algoritmo) |
| API | `api/affiliates/secure-list.ts` + core | NUEVO list+decrypt |
| Vite | `vite.config.ts` | proxy local paridad |
| Flag | `services/featureFlags.ts` + `.env.example` | `VITE_USE_ENCRYPTED_AFFILIATES_ADMIN` |
| Hook | `hooks/useEncryptedAffiliatesAdmin.ts` | NUEVO |
| UI | `views/AffiliatesView.tsx` | Strangler condicional |
| Auth API | env `ADMIN_LIST_SECRET` (demo) → luego Firebase claims | gate obligatorio |
| Mapper | util / types | `AffiliateData` → `Affiliate` |

**STOP (no tocar):** D.1 purge, autocaptura, Groq OCR/`groq-ine`, PIN dispositivo (`VITE_USE_FIELD_ENCRYPTION`), exponer KEK al browser.

---

## 2. Modelo de seguridad (SSD / ISO 27034)

```text
Browser ──nunca──► CLOUD_KEK_SECRET / CLOUD_BLIND_SECRET / wrapped_dek
Browser ──auth admin──► API Vercel ──KEK + Admin SDK──► Firestore (ciphertext)
Admin UI ◄── solo plaintext mínimo tras AuthZ ── API
```

| Regla | Aplicación |
|-------|------------|
| Decrypt **solo servidor** | Opción (A). Client-side con `VITE_CLOUD_KEK` = **FORBIDDEN** |
| AuthZ | List solo si credencial admin válida + `orgId` acotado |
| Minimización | Response sin `ciphertext`/`iv`/`wrapped_dek` |
| Multi-tenant | Nunca `listAll` en prod; filtro `org_id == token/org` |
| Demo | Secret parametrizado `ADMIN_LIST_SECRET` (env); upgrade a Firebase ID token + claims en APO.3 |

**Prueba cliente (guion):**

1. Firebase Console → `encrypted_affiliates` → se ve blob cifrado / `blind_curp` (no PII).  
2. App como Admin → «Gestión de Afiliados» → nombre, CURP, etc. legibles.  
3. Sin secret / sin rol admin → API 401/403.

---

## 3. Contratos propuestos

### 3.1 Store

```ts
listEncryptedByOrg(orgId: string, opts?: { limit?: number }): Promise<EncryptedAffiliateRecord[]>
```

- Firestore: `where('org_id','==', orgId).limit(n)` (Admin SDK).  
- Mock: filtrar memory store por `org_id`.

### 3.2 API `GET /api/affiliates/secure-list`

**Headers:** `Authorization: Bearer <ADMIN_LIST_SECRET>` (demo) o Firebase ID token (APO.3).  
**Query:** `orgId` (requerido, sanitizado).

**200:**

```json
{
  "ok": true,
  "orgId": "org_default",
  "count": 2,
  "affiliates": [
    {
      "id": "uuid",
      "fullName": "...",
      "curp": "...",
      "email": "...",
      "phone": "...",
      "address": "...",
      "createdAt": "ISO",
      "blindCurpPrefix": "350ffa57…"
    }
  ]
}
```

**Errores:** 401 sin auth · 403 org/role · 400 orgId · 500 secrets/Firestore · UI siempre **Reintentar + Volver**.

### 3.3 Flag Strangler

```text
VITE_USE_ENCRYPTED_AFFILIATES_ADMIN=true   → lista vía API decrypt
=false (default legacy)                    → mock firebaseService (cero regresión)
```

### 3.4 Alineación `orgId`

Write sync usa `resolveOrgId()` → suele caer en **`org_default`**.  
List admin debe usar **el mismo org** (env `VITE_ADMIN_ORG_ID` / `ADMIN_DEFAULT_ORG_ID`, default `org_default`) para que la demo muestre los 2 registros.

---

## 4. Fases

### APO.1 — Store + API (sin UI grande) — ETA ~1.5–2 h

1. `listEncryptedByOrg` (Admin + mock).  
2. Core `processSecureAffiliateListRequest` + handler Vercel + proxy Vite.  
3. Auth mínima: `ADMIN_LIST_SECRET` en Vercel Production.  
4. Smoke: POST secure → list → plaintext; dump raw ≠ plaintext.  
5. ESM imports `.js` (mismo patrón que fix OCR).

### APO.2 — UI Admin Strangler — ETA ~1–1.5 h

1. Flag + hook `useEncryptedAffiliatesAdmin`.  
2. Cablear `AffiliatesView` (loading / empty / error / Reintentar).  
3. Mapper a `Affiliate` (campos no cifrados → "—" / placeholders explícitos).  
4. Banner discreto: «Datos desencriptados vía proxy autorizado».  
5. **No** reabrir write `saveAffiliate` hacia ciphertext en este APO.

### APO.3 — Auth real + higiene demo — ETA posterior / post-banderazo cliente

1. Firebase Auth + custom claims `role=admin`, `org_id`.  
2. Validar ID token en API (retirar secret compartido).  
3. Checklist demo + opcional E2E admin list.  
4. Retirar `firestore.rules.demo` `read:true` cuando el cliente lo indique.

---

## 5. Variables Vercel (añadir en GO)

| Variable | Ámbito | Notas |
|----------|--------|-------|
| `ADMIN_LIST_SECRET` | Server Secret | Bearer demo; rotar post-demo |
| `ADMIN_DEFAULT_ORG_ID` | Config | default `org_default` |
| `VITE_USE_ENCRYPTED_AFFILIATES_ADMIN` | Build | `true` para demo |
| `VITE_ADMIN_ORG_ID` | Build | mismo org que sync |
| Ya existentes | — | `CLOUD_KEK_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FIRESTORE_BACKEND=firestore` |

---

## 6. Test plan

| ID | Caso | Esperado |
|----|------|----------|
| T1 | Doc en Firestore raw | Solo ciphertext / blind / iv / wrapped_dek |
| T2 | List sin Bearer | 401 |
| T3 | List admin org correcta | 200 + N afiliados en claro |
| T4 | Org distinta | 0 docs o 403 |
| T5 | Bundle cliente | Sin `CLOUD_KEK` / `CLOUD_BLIND` |
| T6 | Flag OFF | UI = mock legacy |
| T7 | Flag ON + red caída | Mensaje + Reintentar + Volver |
| T8 | E2E D.1 / secure sync existentes | Siguen verdes |
| T9 | Demo dual pantalla | Console cifrado vs Admin legible |

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| PII visible en Network tab del Admin | Esperado para rol admin; HTTPS; no logs de body; sesión corta |
| Secret demo débil | Solo hasta APO.3; no hardcode en repo |
| orgId desalineado → lista vacía | Parametrizar mismo `org_default` write/read |
| God-component en AffiliatesView | Lógica en hook/servicio; UI solo estados |

---

## 8. Checklist pre-código (Regla 1)

- [x] `implementation_plan.md` con grafo y riesgos  
- [x] Firmas/contratos documentados  
- [x] Sin hardcoding de KEK/prompts  
- [x] UI con Reintentar/Volver (APO.2)  
- [x] Validación en capa servicio/API  
- [x] Idempotencia list (GET)  
- [x] Extracción a hook/servicio (anti-God)  
- [ ] **GO explícito del usuario/auditor** ← bloqueante

---

## 9. Decisión solicitada

**¿Apruebas GO para ejecutar APO.1 → APO.2** (demo cliente: BD cifrada + Admin lee en claro)?

- APO.3 (Firebase Auth claims reales) queda **diferido** hasta banderazo / keys del cliente, salvo que indiques lo contrario.

**Respuesta esperada:** `GO APO.1+2` | `GO solo APO.1` | `Ajustar plan: …`
