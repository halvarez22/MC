# APO-FIELD-PERSIST — Persistencia real Modo Campo + UX post-registro

**Estado:** 🟢 **IMPLEMENTADO F.1 + F.2 + F.3 — pendiente commit/push/deploy**  
**GO:** Qwen 2026-09-15 (GO ABSOLUTO)  
**STOP:** D.1 purge, D.2 schema, Autocaptura, Admin list. Solo `POST /api/affiliates/secure`.

---

## Entregado

### F.1 — Persistencia online
- `SelfRegistrationForm` (isFieldMode + online) → `syncFieldAffiliate` → `acknowledgeIneSync` → `/api/affiliates/secure`
- **201 y 409** = éxito (`isValidSyncAck`)
- CURP: `isCurpPersistable` bloquea vacío/formato; checksum OCR-MAP sigue warning
- Submit con `isLoading` (Button disabled)

### F.2 — UX post-registro
- `FieldView` `phase: 'form' | 'success'`
- Éxito online: “Afiliado guardado y cifrado en el sistema” + **Nueva captura** / **Salir**
- Sin `alert()` nativo

### F.3 — Offline honesto
- IndexedDB + pantalla: “Guardado localmente. Se sincronizará cuando haya conexión.”
- Sin reclamar nube/sistema

### Helpers
- `services/syncAckService.ts`: `fieldFormToSecureSyncInput`, `syncFieldAffiliate`
- `services/ineFieldNormalization.ts`: `isCurpPersistable`

---

## Prerrequisito Vercel
`FIRESTORE_BACKEND=firestore` + SA + `CLOUD_KEK_SECRET` / `CLOUD_BLIND_SECRET` + `ADMIN_DEFAULT_ORG_ID` / `VITE_SYNC_ORG_ID=org_default`

---

## Verificación manual
1. Online + CURP → doc en `encrypted_affiliates`
2. Mismo CURP otra vez → éxito (409) sin error de brigadista
3. Sin CURP → bloqueo con mensaje
4. Offline → mensaje local + Nueva captura / Salir
5. Nueva captura → form limpio
