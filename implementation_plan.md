# APO-ADMIN-INE-THUMB — Miniatura frontal INE (solo Admin · menú Afiliados)

**Estado:** ✅ **IMPLEMENTADO** (T.0–T.5)  
**Alcance:** Solo frontal · Solo Admin · Solo detalle en **Afiliados** · Sin foto en envelope.

---

## Entrega

| Capa | Archivos |
|------|----------|
| Config | `services/ineThumbConfig.ts` |
| Thumb | `services/ineThumbService.ts` |
| Store | `services/affiliateMediaStore.ts` (mock \| Storage + `affiliate_media`) |
| Sync | `secureCore` acepta `thumbFrontJpegBase64`; campo + `useSyncOffline` generan thumb pre-ACK |
| Read | `GET /api/affiliates/secure-thumb` + proxy Vite |
| Delete | `secureDeleteCore` limpia Storage/meta |
| UI | `AffiliateDetailView` — bloque “Credencial INE (anverso)” |
| Rules | `firestore.rules` + `storage.rules` deny client |
| Privacy | consentimiento + aviso actualizados |
| Flag | `VITE_USE_INE_FRONT_THUMB` (default ON; `false` oculta UI) |
| Smoke | `npm run smoke:ine-front-thumb:local` |

**STOP respetado:** no posterior; no thumb en Datos INE/lista; no bytes en ciphertext; D.1 purge intacta (upload antes).

---

## Verificación

```bash
npm run smoke:ine-front-thumb:local
```

Prod: configurar `FIREBASE_STORAGE_BUCKET` (y SA) en Vercel; desplegar `storage.rules`.

¿Commit/push? (pedir explícito)
