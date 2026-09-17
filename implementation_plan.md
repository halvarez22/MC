# APO-ADMIN-INE-THUMB — Miniatura frontal INE (solo Admin · menú Afiliados)

**Estado:** ✅ **IMPLEMENTADO** (T.0–T.5) + hotfix deploy  
**Alcance:** Solo frontal · Solo Admin · Solo detalle en **Afiliados** · Sin foto en envelope.

**Persistencia v1 (hotfix Vercel):** bytes JPEG en Firestore `affiliate_media` (Admin SDK).  
Sin `firebase-admin/storage` en el bundle (evita fallo *Deploying outputs*). Path lógico sigue en `frontThumbPath` para migración Storage v2.

---

## Entrega

| Capa | Archivos |
|------|----------|
| Config | `services/ineThumbConfig.ts` |
| Thumb | `services/ineThumbService.ts` |
| Store | `services/affiliateMediaStore.ts` (mock \| Firestore `affiliate_media`) |
| Sync | `secureCore` + campo/`useSyncOffline` |
| Read | `GET /api/affiliates/secure-thumb` |
| Delete | `secureDeleteCore` limpia meta |
| UI | `AffiliateDetailView` |
| Rules | `affiliate_media` deny client; `storage.rules` deny (prep v2) |
| Smoke | `npm run smoke:ine-front-thumb:local` |

**Prod:** `FIRESTORE_BACKEND=firestore` + SA (mismo que afiliados). `FIREBASE_STORAGE_BUCKET` opcional en v1.
