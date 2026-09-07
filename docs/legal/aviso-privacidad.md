# Aviso de Privacidad (LFPDPPP)

Fuente canónica en código: `services/privacyNoticeContent.ts`  
UI completa: `components/legal/PrivacyNoticeBody.tsx`  
Consentimiento resumido in-app: `components/ui/PrivacyConsentModal.tsx` (antes de cámara en `INECapture`).

**Transparencia:** el aviso declara solo tratamientos actuales (OCR/Visión INE, Lista Nominal cuando el flag esté ON, cifrado en reposo Web Crypto con `extractable: false`, eliminación automática de imágenes/rawText post-validación). No declara selfie/liveness/face-match hasta que existan en código.

**Personalizar Responsable** vía `.env` / `.env.local` / Vercel:

```env
VITE_PRIVACY_ORG_NAME=
VITE_PRIVACY_ORG_ADDRESS=
VITE_PRIVACY_ORG_EMAIL=
VITE_PRIVACY_ORG_PHONE=
VITE_PRIVACY_ORG_WEBSITE=
VITE_PRIVACY_UPDATED_AT=7 de septiembre de 2026
```

Recomendación: revisión por abogado especializado en protección de datos en México antes de activar Lista Nominal o cifrado en producción.
