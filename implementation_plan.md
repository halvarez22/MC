# APO-ADMIN-INE-VIEW — Pantalla «Datos INE» + envelope enriquecido

**Estado:** 🟢 **IMPLEMENTADO I.A + I.B — pendiente commit/push**  
**GO:** Usuario 2026-09-17 (ambos juntos)

## Entregado

### I.A — Strangler UI
- `INEDataView` → `useEncryptedAffiliatesAdmin` cuando flag ON
- KPIs honestos: Con CURP / Con clave elector / Registros
- Error + **Reintentar**; banner proxy demo
- Flag OFF: mock legacy intacto

### I.B — Envelope opcional
- `AffiliateData`: `voterId`, `state`, `municipality`, `section`, `locality`, `registrationYear`, `emission`, `validity` (opcionales)
- Campo online: `syncFieldAffiliate` envía campos desde OCR
- `secure-list` DTO + `mapToAffiliate` rellenan `ineData`
- Dual-read: registros viejos → N/A en campos nuevos

## Nota producto
Afiliados **ya** en bóveda (solo 5 campos) aparecerán con CURP/nombre/domicilio; clave/sección = N/A hasta **nueva captura** post-deploy.

## STOP
D.1, foto INE, Baja — no rotos.
