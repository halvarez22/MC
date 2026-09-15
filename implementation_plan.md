# APO-DEMO-RESET — Limpieza BD + re-captura cliente + prueba cifrado/lectura Admin

**Estado:** 🟢 **LISTO PARA EJECUCIÓN** (Qwen GO absoluto 2026-09-15 — Opción A)  
**Artefactos:** `scripts/purge-encrypted-affiliates-demo.mjs` · `AffiliateDetailView` solo envelope  
**Siguiente (Usuario):** FASE 0 purga → 2 capturas cliente → FASE 2 Console cifrada → FASE 3 Admin plaintext  

**STOP:** Opción B, D.1, D.2 write, Autocaptura, Groq, rotar KEK, endpoint público purge. Sistema congelado para demo.

---

## 0. Alcance de “todos los datos” (decisión explícita para Qwen)

Hoy el sobre cifrado (`AffiliateData` en `cloudEncryptionService`) persiste **solo**:

`fullName`, `curp`, `email`, `phone`, `address`  
(+ metadatos doc: `created_at`, `org_id`, `blind_curp`, ids de llave — **no** PII).

El OCR INE puede extraer más campos (`sección`, `municipio`, `clave_elector`, etc.) pero **`structuredDataToAffiliatePayload` no los mete al sobre** (`syncAckService.ts`).

| Opción | Qué significa “todos los datos” | ¿Toca D.2 write? | ETA |
|--------|----------------------------------|------------------|-----|
| **A — Recomendada demo** | Todo lo **persistido en el envelope actual** (5 campos) + UI Admin que los muestre completos en lista y detalle | **No** (solo UI/ops) | Bajo |
| **B — Envelope ampliado** | Persistir también campos INE estructurados relevantes en el blob cifrado | **Sí** (schema encrypt + mapper + DTO list) | Medio–alto |

**Propuesta de este plan:** ejecutar **Opción A** para la demo inmediata.  
Opción B queda como **APO-DEMO-B** diferido (requiere GO aparte; reabre capa write D.2b).

**Narrativa correcta al cliente (SSD):**  
“Las claves (`CLOUD_KEK_SECRET`) están en el **servidor**. El Admin **autorizado** recibe plaintext vía proxy. El navegador **nunca** tiene la KEK.”

---

## 1. Grafo de impacto

```text
[FASE 0 — OPS BORRADO]
Firebase Admin / script one-shot
  → delete collection encrypted_affiliates (solo esta colección)
  → verificar count=0 en Console

[FASE 1 — CLIENTE]
2 capturas INE reales → sync ACK
  → POST /api/affiliates/secure
  → org_id = org_default (VITE_SYNC_ORG_ID / fallback)
  → KEK actual (Vercel) → 2 docs ciphertext

[FASE 2 — PRUEBA BD]
Console Firestore → docs con ciphertext/iv/wrapped_dek/blind_curp
  → assert: sin nombre/CURP/email en claro

[FASE 3 — PRUEBA ADMIN APP]
Login admin@example.com
  → GET /api/affiliates/secure-list (Bearer)
  → decrypt server-side
  → Lista + Detalle: fullName, curp, email, phone, address (+ createdAt)
  → assert: count=2, todos los campos del envelope visibles
```

| Capa | Archivos | ¿Cambio en Opción A? |
|------|----------|----------------------|
| Store | `encryptedAffiliateFirebaseStore.ts` | Solo si se añade `purgeEncryptedAffiliatesForDemo` (script/API ops) |
| Write D.2 | `secureCore`, `cloudEncryptionService`, mapper sync | **STOP — no tocar** |
| Read Admin | `secureListCore`, hook, `AffiliatesView`, `AffiliateDetailView` | Posible **mejora UX** detalle (mostrar los 5 campos de forma explícita/completa) |
| OCR / Autocaptura / D.1 purge | — | **STOP** |
| Env | `ADMIN_DEFAULT_ORG_ID`, `CLOUD_KEK_*`, `VITE_SYNC_ORG_ID` | Verificar; allowlist puede reducirse a `org_default` post-limpieza |

---

## 2. Fases detalladas

### FASE 0 — Purga controlada de BD (ops)

**Objetivo:** colección `encrypted_affiliates` vacía.

**Procedimiento propuesto (elegir uno en GO):**

| Modo | Cómo | Riesgo |
|------|------|--------|
| **0.A Console** | Firebase Console → borrar los 3 docs manualmente | Bajo; auditable visualmente |
| **0.B Script Admin** | Script one-shot `scripts/purge-encrypted-affiliates-demo.mjs` con Admin SA; requiere flag `I_UNDERSTAND=YES` | Bajo si scoped a una colección |

**Reglas:**
- Scope **solo** `encrypted_affiliates` (no tocar Auth users, ni otras colecciones).
- Log: cantidad borrada, projectId, timestamp.
- Evidencia: screenshot Console `No documents` / count 0.
- **Prohibido** borrar desde el browser del Admin UI en esta fase (evita API de delete pública).

**Criterio de salida FASE 0:** Firestore muestra 0 documentos en `encrypted_affiliates`.

---

### FASE 1 — Re-captura cliente (2 registros reales)

**Responsable:** cliente / brigadista en campo.  
**App:** Production actual (`movimiento.vercel.app`) con sync → `org_default` + KEK vigente.

**Checklist pre-captura (ops):**
- [ ] `FIRESTORE_BACKEND=firestore`
- [ ] `CLOUD_KEK_SECRET` / `CLOUD_BLIND_SECRET` estables (**no rotar** entre captura y demo)
- [ ] `VITE_SYNC_ORG_ID=org_default` (o vacío → fallback `org_default`)
- [ ] `ADMIN_DEFAULT_ORG_ID=org_default` (allowlist simple post-limpieza)
- [ ] `VITE_USE_ENCRYPTED_AFFILIATES_ADMIN=true` + Bearer configurado

**Criterio de salida FASE 1:**
- 2 ACK exitosos (2xx o 409).
- Exactamente **2** docs nuevos en Firestore, ambos `org_id == org_default`.
- Smoke API list (Bearer) → `count: 2` y decrypt OK (sin `decrypt skip`).

---

### FASE 2 — Demostración “BD solo cifrada”

**Guion:**
1. Abrir Firebase → `encrypted_affiliates` → seleccionar cada doc.
2. Mostrar campos: `ciphertext`, `iv`, `wrapped_dek`, `blind_curp`, `alg=AES-GCM`, `kek_id`.
3. Buscar (Ctrl+F) nombre/CURP del afiliado en el panel → **no debe aparecer** en claro.

**Criterio de salida:** evidencia screenshot + checklist firmado (cliente/auditor).

**Nota:** Esto **ya lo garantiza** el pipeline D.2b actual si FASE 1 usa el proxy; **no requiere código nuevo** salvo verificación.

---

### FASE 3 — Demostración “Admin lee todo lo persistido”

**Guion:**
1. Login `admin@example.com`.
2. Banner proxy autorizado + `2 registro(s)`.
3. Lista: nombre + CURP visibles (no docId monstruo).
4. Abrir detalle de **cada** afiliado → mostrar **todos** los campos del envelope:
   - Nombre completo  
   - CURP  
   - Email  
   - Teléfono  
   - Dirección  
   - Fecha de registro (`createdAt`)  
5. (Opcional) DevTools → Network → response JSON **sin** `ciphertext`/`iv`/`wrapped_dek`.

**Gap UX actual (Opción A — posible diff tras GO):**
- Detalle ya muestra email/teléfono/CURP/dirección; reforzar labels y evitar `—, —` confusos cuando city/state no vienen del envelope (mostrar solo `address` del sobre, no inventar ciudad/CP).

**Criterio de salida:** cliente ve 2/2 afiliados con los 5+1 campos legibles solo en sesión Admin.

---

## 3. Trabajo de ingeniería (solo tras GO)

### Si GO = Opción A (recomendado)

1. **Ops FASE 0** (Console o script scoped) — sin tocar write crypto.  
2. **APO-DEMO-A.1 (UI):** ajustar `AffiliateDetailView` / mapper para presentar **exactamente** los campos del DTO decrypt (sin placeholders engañosos `—, —` que parezcan datos faltantes cifrados).  
3. **APO-DEMO-A.2 (ops env):** simplificar `ADMIN_DEFAULT_ORG_ID=org_default` post-purga.  
4. **Verificación smoke** documentada (T1–T6 abajo).  
5. Commit/push solo tras evidencia + GO de merge.

### Si GO = Opción B (ampliar envelope)

Plan hijo separado: ampliar `AffiliateData`, mapper OCR→payload, `toDto`, detalle UI, migración N/A (BD vacía tras FASE 0). **Reabre D.2 write** → auditoría Qwen específica obligatoria.

---

## 4. Seguridad / SSD

| Control | Aplicación |
|---------|------------|
| KEK / Blind | Solo `process.env` server; nunca `VITE_CLOUD_*` |
| Delete | No endpoint público de purge; script/Console con confirmación |
| List Admin | Bearer + allowlist org env (sin query org del cliente) |
| Minimización respuesta | DTO sin ciphertext/iv/wrapped_dek/key_id |
| Rotación KEK | **Prohibida** entre FASE 1 y demo |

---

## 5. STOP (inamovible)

- No tocar D.1 purge / Zero-PII device.  
- No tocar autocaptura INE / Groq OCR (salvo que Opción B lo exija y se apruebe).  
- No exponer KEK al frontend.  
- No `listAll` sin filtro `org_id`.  
- No hotfixes: cualquier hallazgo en FASE 1–3 → **actualizar este plan** y nueva aprobación.

---

## 6. Test plan (evidencia)

| ID | Caso | Esperado |
|----|------|----------|
| T0 | Post-purga Console | 0 docs |
| T1 | Tras 2 capturas | 2 docs, `org_id=org_default` |
| T2 | Doc raw | Solo ciphertext; sin PII clara |
| T3 | List sin Bearer | 401 |
| T4 | List Admin | count=2; 5 campos plaintext c/u |
| T5 | Detalle Admin | mismos campos; sin docId como “dato cifrado” |
| T6 | Bundle / Network | sin `CLOUD_KEK`; response sin `wrapped_dek` |

---

## 7. Roles y secuencia temporal

| # | Quién | Acción |
|---|-------|--------|
| 1 | Auditor/Usuario | Aprueba este plan (Opción A o B) |
| 2 | Cursor (tras GO) | FASE 0 + UI A.1 si aplica + env |
| 3 | Cliente | 2 capturas reales |
| 4 | Cursor + Usuario | T1–T6 + guion demo |
| 5 | Usuario | Demo al cliente |

---

## 8. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Borrar colección equivocada | Script/Console scoped + confirmación explícita |
| Rotar KEK otra vez | Freeze de secrets hasta fin de demo |
| Cliente espera campos INE extra no persistidos | Opción A declarada; o GO Opción B |
| Allowlist multi-org con basura vieja | Tras purge → solo `org_default` |

---

## 9. Checklist pre-código (Regla 1)

- [x] Plan con grafo, contratos, riesgos, STOP  
- [x] Opción A vs B explícita  
- [ ] **GO Qwen / usuario:** `GO APO-DEMO-RESET Opción A` \| `GO Opción B` \| `Ajustar: …`  
- [ ] Sin diffs hasta ese GO  

---

## 10. Decisión solicitada

Responder con una:

1. **`GO APO-DEMO-RESET Opción A`** — purga + re-captura + UI detalle fiel al envelope (recomendado).  
2. **`GO APO-DEMO-RESET Opción B`** — además ampliar schema cifrado con más campos INE.  
3. **`Ajustar plan: …`**

**Sin GO → no se borra BD ni se escribe código.**
