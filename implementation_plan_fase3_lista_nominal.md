# implementation_plan.md — Fase 3: Validación Lista Nominal INE (autenticidad)

**Estado:** 🟢 Fases 3.0–3.3 **CERRADAS** · **PAUSA TÉCNICA APROBADA** (Qwen) — sin 3.4 ni flags ON hasta negocio  
**Autor:** Cursor Agent  
**Fecha:** 2026-09-06  
**Mandato actual:** Pausa. No Hardening persistencia ni activación de flags sin GO del dueño + auditor.  
**Proveedor:** **Datos Non Stop**. Alternativa investigada: **Kiban**.  
**Blindaje Qwen:** timeout proxy **20s**; UX Soft async; ENFORCE opcional; LFPDPPP + key sandbox = bloqueo externo.  
**Carta:** `.cursor/rules/industrial-charter.mdc` (Reglas 1–8)  
**Prerrequisitos:** Fase 0–2 🟢; Spike 3.0 🟢; Fase 3.1–3.3 🟢.  
**Entrada de negocio:** chat Grok + portal `listanominal.ine.mx/scpln/` + docs API Datos Non Stop.

---

## 0. Diagnóstico (evidencia)

### 0.1 Qué pide el negocio

Hoy MC **extrae** datos del INE (OCR / Groq Vision). Eso responde: *“¿qué dice la foto?”*  
El negocio necesita además: *“¿el INE existe y está vigente en la Lista Nominal?”*

Sin esa segunda capa, un documento falso bien fotografiado puede pasar el OCR.

### 0.2 Qué ofrece el INE oficial (forense UX)

Portal analizado: [listanominal.ine.mx/scpln/](https://listanominal.ine.mx/scpln/)

| Modelo | Campos de consulta | Vigencia típica (portal) |
|---|---|---|
| E, F, G, H, I, J | **CIC** + **Identificador del Ciudadano** | Vigentes / actuales |
| D | **CIC** + **OCR** | Marcado no vigente en portal (consulta histórica) |
| A, B, C | Clave elector + nº emisión + OCR | Marcado no vigente |

**Hallazgos vinculantes:**

1. El portal es **consulta humana** (formularios + botón “Consultar”), **no** API pública documentada para integradores.
2. **Prohibido** scrapear / automatizar el portal (ToS INE, frágil, riesgo legal, Regla 5 SSD / cumplimiento).
3. App oficial “Valida INE QR” = verificación manual / institucional; **no** es SDK para MC.
4. La industria (KYC México) valida Lista Nominal vía **proveedores autorizados** (ej. Kiban, Veriff, Datos Non Stop y similares): API REST con CIC + idCiudadano / OCR según modelo.

### 0.3 Decisión arquitectónica (para aprobar)

| Opción | Veredicto |
|---|---|
| A. Scraper `listanominal.ine.mx` | 🔴 **RECHAZADA** |
| B. Convenio directo INE (si aplica a partido) | 🟡 Futuro / fuera de Fase 3 demo |
| C. **Proveedor KYC Lista Nominal vía proxy SSD** + feature flag | 🟢 **ELEGIDA** |
| D. Solo heurísticas OCR (CURP checksum, anverso=reverso) | 🟡 **Complemento**, no sustituye padrón |

**Opción C (Strangler Fig):**  
OCR/Visión actual intacto → capa nueva opcional `listaNominalService` detrás de flag → UI muestra badge de verificación. Default flag **OFF** hasta spike empírico (igual que Fase 2).

---

## 1. APO — Grafo de impacto

```text
Captura INE (INECapture)
   → ocrOrchestrator / groqVision (ya extrae JSON)
   → INEStructuredData  ←── AMPLIAR campos CIC / id_ciudadano / ocr_credencial / modelo
   → [NUEVO] listaNominalOrchestrator (online + flag)
         → proxy SSD /api/ine-lista-nominal  (server: API_KEY proveedor)
         → NUNCA scrapear listanominal.ine.mx
   → UI review (INEProcessor / FieldView)
         → badge: vigente | no_vigente | no_encontrada | error | omitida_offline
   → Affiliate.ineData / audit log (resultado + timestamp + providerRef)
   → types.ts + featureFlags + promptTemplates
```

**Zero regressions:**

- Offline / flag OFF → flujo actual sin bloqueo (U-First: Volver / Reintentar / Continuar sin validación con aviso).
- No eliminar Google Vision / Tesseract / Groq Vision en esta fase.
- No hardcodear API keys ni URLs de proveedor en UI (`import.meta.env` / `process.env` server).

---

## 2. Contratos (firmas propuestas)

### 2.1 Extensión `INEStructuredData` (`types.ts`)

```ts
export type IneCredentialModel = 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'UNKNOWN';

export interface INEStructuredData {
  // ...campos actuales...
  modelo_credencial?: IneCredentialModel;
  cic?: string;                 // Código Identificación Credencial
  id_ciudadano?: string;        // Identificador del Ciudadano (E+)
  ocr_credencial?: string;      // cadena OCR (modelos D/C)
  numero_emision?: string;
}

export type ListaNominalStatus =
  | 'valid'
  | 'not_found'
  | 'not_current'
  | 'expired'
  | 'skipped_offline'
  | 'skipped_flag_off'
  | 'error';

export interface ListaNominalResult {
  status: ListaNominalStatus;
  checkedAt: string;            // ISO
  provider: string;             // ej. 'kiban' | 'mock'
  rawMessage?: string;          // sanitizado, sin PII extra
  modelUsed?: IneCredentialModel;
}
```

### 2.2 Proxy SSD (nuevo)

`api/ine-lista-nominal.ts` (+ núcleo compartido si aplica):

- Key **solo** `LISTA_NOMINAL_API_KEY` (o nombre del proveedor) en server — **nunca** `VITE_*`.
- Allowlist de modelos de credencial.
- Rate limit / tamaño body (anti-DoS).
- Timeout corto; idempotencia en cliente (mutex / disable botón).
- Respuesta JSON canónica `ListaNominalResult` (no filtrar JSON crudo del vendor al browser sin sanitizar).

### 2.3 Feature flag

```text
VITE_USE_LISTA_NOMINAL=false   # default OFF (Strangler)
```

Server: credenciales del proveedor en Vercel env.

### 2.4 Prompts / visión (ajuste mínimo)

Ampliar `buildIneVisionExtractionPrompt` / extracción texto para pedir explícitamente del **reverso**:

- `cic`, `id_ciudadano`, `ocr_credencial`, `modelo_credencial`, `numero_emision`

Sin inventar: omitir si no legible (misma regla actual).

---

## 3. UX (U-First)

Tras extracción one-shot / review estructurado:

1. Si online + flag ON + campos mínimos presentes → auto-consulta Lista Nominal (1 intento; botón **Reintentar**).
2. Badge visible:
   - 🟢 Vigente en Lista Nominal  
   - 🟡 No vigente / no es la última  
   - 🔴 No encontrada / inconsistente  
   - ⚪ Omitida (offline o flag OFF) — **no bloquea** guardar afiliado en demo, configurable.
3. Mensajes accionables: Volver | Reintentar | Continuar sin verificación (si política de negocio lo permite).
4. Auditoría: `AuditLog` con acción `VALIDATE_LISTA_NOMINAL` (email usuario, status, sin volcar PII completa en `details`).

**Política de bloqueo (para decidir Qwen/dueño):**

| Modo | Comportamiento |
|---|---|
| **A — Soft (recomendado demo)** | Aviso; permite guardar con `listaNominal.status` |
| **B — Hard** | No permite confirmar afiliado si `not_found` / `error` reintentable |

Plan propone **Soft** por defecto; Hard como flag `VITE_LISTA_NOMINAL_ENFORCE=true`.

---

## 4. Fases de ejecución (Strangler / SQA)

### Fase 3.0 — Spike proveedor (gate empírico, Regla 8)

**Antes de cablear UI:**

1. Elegir **1** proveedor candidato (matriz abajo).
2. Script `scripts/spike-lista-nominal.mjs` con 5–10 fixtures (CIC + idCiudadano de INEs de prueba / consentidos).
3. Reporte `docs/auditoria/spike-3.0-lista-nominal.md` con tasas reales (**cero inventadas**).
4. Umbral propuesto GO: ≥ **90%** coincidencia esperada en set de prueba (análogo Spike 2.0).

| Criterio proveedor | Peso |
|---|---|
| Acceso Lista Nominal MX documentado | Alto |
| Precio / cuota demo | Alto |
| SLA + DPA / LFPDPPP | Alto |
| Campos por modelo C–J | Medio |
| Sandbox | Medio |

**Candidatos a evaluar (no amarre aún):** Kiban, Datos Non Stop, Veriff u otro con cobertura MX.  
Decisión final = dueño + evidencia spike (Qwen valida el reporte).

### Fase 3.1 — Contratos + proxy SSD

- Extender `types.ts`.
- `services/listaNominalService.ts` (cliente → proxy).
- `api/ine-lista-nominal.ts` (adapter proveedor).
- Feature flags.
- Tests unitarios del mapper modelo→payload (sin red).

### Fase 3.2 — Extracción de identificadores

- Ampliar prompt visión / parser.
- Validadores locales: longitud CIC, solo dígitos, no inventar.
- Si faltan CIC/id → status `error` con mensaje “Reverso ilegible / captura de nuevo” (no llamar proveedor en vacío).

### Fase 3.3 — Orquestación + UI

- Hook `useListaNominalValidation` (idempotencia).
- Badge en `INEProcessor` review + opcional en `INEDataView`.
- Soft enforce por default.

### Fase 3.4 — Hardening

- Audit log, métricas simples, documentación deploy (env Vercel).
- Plan de retiro: ninguno del legado OCR; solo flag ON en prod tras GO.

---

## 5. Seguridad (SSD / LFPDPPP)

- PII mínima al proveedor: solo identificadores necesarios por modelo (no enviar imagen completa si el API no lo exige).
- Proxy server-side; logs sin dump de CURP/CIC completos (enmascarar).
- Consentimiento / aviso de privacidad: actualizar copy si se añade validación externa.
- Prohibido almacenar respuesta cruda del vendor con datos no necesarios.

---

## 6. Fuera de alcance (Fase 3)

- Face-match / liveness / deepfake detection (Fase 4+).
- Convenio bilateral directo con INE.
- Scraping del portal o de la app Valida INE QR.
- Sustituir Groq Vision.
- Validación RENAPO CURP (puede ser Fase 3.5 opcional; no bloquear 3.0–3.3).

---

## 7. Criterios de aceptación (auditor)

| # | Criterio | Evidencia |
|---|---|---|
| 1 | Plan aprobado; cero código hasta GO | Este documento |
| 2 | No scraper INE | Diseño proxy + proveedor |
| 3 | Flag OFF por defecto | `VITE_USE_LISTA_NOMINAL` |
| 4 | Spike ≥90% o informe de fallo honesto | `spike-3.0-lista-nominal.md` |
| 5 | UI con Volver/Reintentar; soft no callejón | Capturas |
| 6 | Secrets solo server env | Grep `VITE_` sin keys de Lista Nominal |
| 7 | Build OK; flujo OCR sin flag intacto | `npm run build` + smoke |

---

## 8. Preguntas abiertas para Qwen / dueño

1. ¿Proveedor preferido o mandato de RFP corto (2 vendors)?  
2. ¿Enforce Soft (A) o Hard (B) en producción partido?  
3. ¿Datos de prueba con consentimiento para el spike (PII real en `fixtures/` gitignored)?  
4. ¿Presupuesto mensual max para consultas Lista Nominal?

---

## 9. Resumen ejecutivo (para veredicto)

> MC puede **automatizar** la verificación de autenticidad/vigencia del INE **solo** vía proveedor autorizado de Lista Nominal detrás de un **proxy SSD** y feature flag.  
> El portal `listanominal.ine.mx/scpln/` es referencia de **campos** (CIC + Identificador Ciudadano), **no** el endpoint de integración.  
> Sin spike empírico y sin GO de Qwen: **no hay diffs de producto**.

**Solicitud al auditor:** 🟢 aprobar este plan (o 🟡 con observaciones) para habilitar **solo** Fase 3.0 Spike + selección de proveedor; el cableado UI queda bloqueado hasta el reporte empírico.
