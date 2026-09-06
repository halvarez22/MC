# implementation_plan.md — Fase 2: OCR/Visión unificada en Groq (sin Gemini / sin Vision de pago)

**Estado:** 🟡 APROBADO CON OBSERVACIONES — Paso 1 en ejecución (Spike 2.0 + Proxy 2.5)  
**Autor:** Cursor Agent  
**Fecha:** 2026-09-04  
**Entrada:** análisis DeepSeek + mandato de negocio “cliente no quiere pagar más tokens” (Gemini / APIs OCR de pago)  
**Prerrequisito:** Fase 0 🟢 y Fase 1 ejecutada (preprocess externalizado, prompts centralizados, idempotencia Opción A)  
**Carta:** `.cursor/rules/industrial-charter.mdc`  
**Auditoría Qwen:** observaciones críticas incorporadas abajo (§0.4). **Paso 1** = Spike + Proxy antes de UI.

> **Nota de nomenclatura:** DeepSeek habla de **Groq** (inferencia cloud, `api.groq.com`). No confundir con **Grok** (xAI). Este plan es **100% Groq**.

---

## 0. Análisis del dictamen DeepSeek vs stack real MC

### 0.1 Qué propone DeepSeek (aceptado parcialmente)

| Propuesta DeepSeek | Veredicto técnico MC |
|---|---|
| Reemplazar Gemini Vision por modelos multimodales Groq | **Aceptado.** `ocrService.ts` (Gemini) ya es legado no cableado; evita reintroducirlo. |
| Usar visión Groq + JSON mode | **Aceptado.** Modelo primario parametrizado (ver §0.4 evidencia forense). |
| Alternativas Llama 3.2 Vision | **No usar:** deprecados en Groq (shutdown 2025-04-14). Ver §0.4. |
| Llamar Vision API vía backend serverless (Vercel) | **Obligatorio desde día 1 (SSD).** Proxy `/api/groq-ine` es prerrequisito; **prohibido** `VITE_GROQ_*` para esta feature. |
| Paquete npm `vision-ocr` | **Rechazado.** Poco control de prompt/schema; viola HRU + Anti-God + MCP readiness. |
| “Sin costo de tokens” absoluto | **Matizado (ver §0.3).** |

### 0.2 Qué NO dice DeepSeek y el plan sí debe cubrir

1. Hoy el OCR vivo **no es Gemini**: es **Google Vision** (`VITE_GOOGLE_VISION_API_KEY`) + fallback **Tesseract.js**, y luego **Groq texto** (`llama3-8b-8192`) para JSON.
2. Migrar a Groq Vision **consolida dos proveedores cloud (Vision + Groq text) en uno**, y elimina la necesidad de Gemini.
3. Offline de campo **exige** conservar Tesseract (o equivalente local): Groq Vision **requiere red**.
4. Fase 1 Opción A (no LLM en captura ansiosa) **sigue vigente**, adaptada a visión.

### 0.3 Justificación de costo (“no pagar más tokens”)

| Proveedor actual / riesgo | Acción |
|---|---|
| Google Cloud Vision | **Sacar del path feliz** → deja de generar factura Vision |
| Gemini (`ocrService`) | **No activar / marcar deprecated** → cero tokens Gemini |
| Groq texto `llama3-8b` post-OCR | **Absorber** en la misma llamada visión+JSON cuando online |
| Groq free tier | Rate limits RPM/TPM; volumen campo moderado suele caber; documentar cola/backoff |

**Ahorro real para el cliente:** deja de pagar **Vision + Gemini**.  
**Gasto residual:** cuota Groq (free generoso / plan developer si escala).  
**Offline:** Tesseract = **$0** tokens.

**Context Economy (Regla 7):** preferir **1 llamada multimodal** (2 imágenes + JSON schema) frente a 2× Vision + 1× chat texto.

### 0.4 Corrección forense de modelos (respuesta a observación Qwen)

Qwen rechazó `qwen/qwen3.6-27b` como “alucinación” y sugirió `llama-3.2-90b-vision` / `qwen2.5-vl-72b`.

**Evidencia oficial Groq (docs live, 2026-09-04):**

| Fuente | Hallazgo |
|---|---|
| [console.groq.com/docs/vision](https://console.groq.com/docs/vision) | Modelos visión vigentes: **`qwen/qwen3.6-27b`** (hasta 5 imgs, JSON mode) y **`qwen/qwen3.8-27b`** (hasta 3 imgs) |
| [console.groq.com/docs/deprecations](https://console.groq.com/docs/deprecations) | `llama-3.2-11b-vision-preview` y `llama-3.2-90b-vision-preview` — **shutdown 2025-04-14** |
| Catálogo models | `qwen2.5-vl-72b` **no** aparece como modelo vision activo en docs Vision actuales |

**Decisión vinculante del plan (parametrizada, no hardcode en UI):**

```text
GROQ_VISION_MODEL (server-only, default) = qwen/qwen3.6-27b
GROQ_VISION_MODEL_FALLBACK              = qwen/qwen3.8-27b
```

Prohibido usar modelos Llama 3.2 Vision deprecados.  
Prohibido `VITE_GROQ_VISION_MODEL` en cliente para esta feature (SSD): el modelo se elige **solo en el proxy** vía env server `GROQ_VISION_MODEL`.

---

## 1. Decisión arquitectónica recomendada (para aprobar)

### Opción elegida: **Groq Vision JSON one-shot (online) + Tesseract offline**

```text
ONLINE (happy path) — UX A′1 APROBADA:
  Captura frontal+posterior (JPEG)
    → persist pending (imágenes)
    → usuario confirma preview
    → POST /api/groq-ine  (proxy SSD; NUNCA fetch directo a Groq desde browser)
         model: GROQ_VISION_MODEL (default qwen/qwen3.6-27b)
         response_format: json_object
         content: [prompt, image_url frontal, image_url posterior]
    → INEStructuredData → review estructurado (sin ocr_review de texto online)
    → markINEAsProcessed(pendingId)

OFFLINE:
  Captura → preprocess (actual) → Tesseract spa
    → ocr_review (texto crudo) ← único lugar de texto crudo
  Sync online:
    Preferir POST /api/groq-ine con imágenes guardadas
    Fallback: texto LLM solo si no hay imágenes

### Alternativas evaluadas y descartadas (por ahora)

| Alt | Motivo de descarte |
|---|---|
| Solo Tesseract siempre | Calidad insuficiente para INE vs multimodal; cliente ya tiene Groq |
| Mantener Google Vision + Groq text | Sigue costo Vision; no cumple mandato “no más tokens de pago OCR” |
| Gemini Vision | Cliente no quiere; además ya hay fuga histórica de keys Gemini |
| npm `vision-ocr` | Caja negra; no auditable |
| Python serverless como en el ejemplo DeepSeek | Stack MC = Vite/React/Vercel JS; proxy será **TypeScript** (`api/`), no Python |

---

## 2. APO — Grafo de impacto (Fase 2)

```text
promptTemplates.ts  ──+── GROQ_VISION_CONFIG + buildIneVisionPrompt()
                      │
groqService.ts      ──┼── extend: extractIneFromImages()  OR  nuevo groqVisionService.ts
                      │      (recomendado: groqVisionService.ts — SRP / Anti-God)
ineOfflineService   ──┼── guardar base64 frontal+posterior (hoy solo frontal)
INEProcessor.tsx    ──┼── orquestar: online→vision; offline→tesseract; sin googleVision
googleVisionService ──┼── strangler: dejar de importar en UI; deprecated
ocrService.ts (Gemini) ── deprecated documentado / no cablear
useSyncOffline      ──┼── sync: vision-from-images si hay imageData; else text LLM
api/groq-ine.ts (Vercel) ── FASE 2B (SSD): proxy key server-side
```

### Efectos secundarios (Zero Regressions)

| Riesgo | Mitigación |
|---|---|
| Rate limit Groq free | Cola, backoff, UI “Reintentar”; batch sync ≤1–2 RPM consciente |
| Calidad OCR peor/mejor que Vision | **Gate A/B** con N imágenes INE reales antes de apagar Vision en prod |
| Preprocess binarizado empeora multimodal | A/B: original vs preprocess ligero (solo resize/compress) |
| IndexedDB sin posterior | Extender schema `imageDataPosterior` (migración IndexedDB v2) |
| Doble gasto: visión + texto | Prohibido encadenar ambos en happy path online |
| Idempotencia rota | Conservar Opción A adaptada: 1 visión JSON / pendingId; mutex sync |
| Key en cliente | 2B: mover a `GROQ_API_KEY` server-only vía `/api/groq-ine` |

---

## 3. Plan por sub-fases (Strangler Fig — Regla 6)

### Fase 2.0 — Spike de validación (sin merge a prod)

**Objetivo:** demostrar que `qwen/qwen3.6-27b` extrae texto/campos INE aceptables.

1. Script/manual Playground Groq o `test-groq-vision-ine.js` (dev only) con 5–10 fotos reales anonimizadas.
2. Métricas: campos críticos presentes (CURP 18, nombre, clave elector) vs ground truth humano.
3. Comparar: (a) imagen original, (b) preprocess actual agresivo.
4. **Criterio go/no-go:** ≥ umbral acordado con negocio (propuesta: ≥90% CURP correcto en set de prueba).

**Sin esto → no se apaga Google Vision en producción.**

---

### Fase 2.1 — Contrato + prompts + servicio (capa inferior)

**Crear/extender:**

1. `services/promptTemplates.ts`
   - `GROQ_VISION_CONFIG = { model: 'qwen/qwen3.6-27b', temperature: 0.1, maxTokens, endpoint }`
   - `buildIneVisionExtractionPrompt()` → pide **JSON** `INEStructuredData` + opcional `raw_ocr_text`
   - Mantener `GROQ_CONFIG` texto para fallback sync sin imágenes
2. `services/groqVisionService.ts` (nuevo, SRP)
   - `isAvailable(): boolean` → key presente (sin health-check de tokens)
   - `extractIneFromImages(frontalBase64, posteriorBase64): Promise<INEStructuredData & { raw_ocr_text?: string }>`
   - Validación entrada: strings no vacíos, tamaño ≤ límite modelo (~20MB / política interna más estricta p.ej. 4MB/cara)
   - 1 request, 2 `image_url` data-URLs, `response_format: json_object`
3. **No** usar paquete `vision-ocr`.

**Modelo de respaldo parametrizado:** `qwen/qwen3.8-27b` vía env **server-only** `GROQ_VISION_MODEL` (HRU + SSD; sin `VITE_`).

---

### Fase 2.2 — Orquestador OCR (reemplazo de Google Vision en path)

**Archivo nuevo recomendado:** `services/ocrOrchestrator.ts` (MCP-like Tool)

```text
extractIneDocument({ frontal, posterior, online })
  if online && groqVision.isAvailable()
    → groqVision.extractIneFromImages
  else
    → preprocess + Tesseract ambas caras → { rawText, structured: null }
```

**`INEProcessor.tsx`:**
- Dejar de importar `googleVisionService` y `Tesseract` directo (delegar al orquestador).
- Online happy path: tras captura → (persist pending) → **no** auto-visión ansiosa si se mantiene Opción A humana; **o** visión tras confirmación de preview de fotos (ver §3.3).
- Offline: Tesseract + `ocr_review` como hoy.

**`googleVisionService.ts`:** marcar `@deprecated`; dejar de usar en UI.  
**`ocrService.ts` (Gemini):** marcar `@deprecated`; no cablear.

---

### Fase 3.3 — Idempotencia adaptada (Opción A′ Vision)

DeepSeek no redefine UX; nosotros sí:

| Momento | Llamadas Groq Vision |
|---|---|
| Captura / preprocess | **0** |
| Usuario confirma fotos o texto (online) | **1** one-shot JSON |
| Sync de `processed=false` con imágenes | **1** vision (si hay base64); else 1 text LLM |
| Tras `markINEAsProcessed` | **0** |

UI: `disabled={isProcessing}`; mutex sync existente.

**Decisión UX (Auditor Qwen): A′1 APROBADA** — online one-shot → review estructurado; texto crudo solo offline.

---

### Fase 2.4 — Persistencia de ambas caras

`ineOfflineService` DB_VERSION 2:
- `imageDataFrontal`, `imageDataPosterior` (o `images: { frontal, posterior }`)
- `onupgradeneeded`: registros antiguos con solo `imageData` → mapear a `imageDataFrontal`; `imageDataPosterior = null` (sync no falla; usa fallback texto)

---

### Fase 2.5 — SSD Proxy (PRERREQUISITO Paso 1 — YA EN EJECUCIÓN)

**No negociable:**

1. `api/groq-ine.ts` con `GROQ_API_KEY` server-only (sin `VITE_`).
2. Cliente **siempre** → `/api/groq-ine`; nunca `api.groq.com` desde browser para visión.
3. Validación: payload base64 combinado ≤ **5 MB** → HTTP 413.
4. Modelo: `GROQ_VISION_MODEL` (default `qwen/qwen3.6-27b`).
5. Spike 2.0 A/B en paralelo: (A) original máx 1024px vs (B) preprocess agresivo → `docs/auditoria/spike-2.0-resultados.md`.

**Strangler staging con VITE_GROQ para visión: PROHIBIDO.**

---

## 4. Qué se elimina / reduce (mandato costo)

| Componente | Acción Fase 2 |
|---|---|
| Gemini (`ocrService`) | Deprecated; no tokens |
| Google Vision en happy path | Removido tras go/no-go 2.0 |
| Groq text post-OCR online | Removido (absorbido por visión JSON) |
| Groq text | Solo fallback sync sin imagen / mock |
| Tesseract | Conservado offline |
| OCR.space (método muerto) | No activar |

---

## 5. Criterios de aceptación Fase 2

1. Online: **≤1** request Groq Vision por INE confirmada; **0** Gemini; **0** Google Vision.
2. Offline: OCR usable con Tesseract; datos no se borran; sync enriquece con visión o texto.
3. Prompt/modelo visión en `promptTemplates` / config tipada (cero hardcode en JSX).
4. `INEProcessor` no importa Tesseract ni Vision directamente.
5. Build OK; smoke T2.* (abajo).
6. Sin `vision-ocr` npm.
7. Documento A/B del spike 2.0 archivado en `docs/auditoria/`.

---

## 6. Plan de pruebas

| ID | Prueba | Esperado |
|---|---|---|
| T2.0 | Spike 5–10 INE reales | Métrica go/no-go documentada |
| T2.1 | Online 1 INE, Network tab | 1× `chat/completions` modelo Qwen visión |
| T2.2 | Sin `VITE_GOOGLE_VISION_API_KEY` | Path no intenta Vision |
| T2.3 | Offline airplane mode | Tesseract + pending; reopen online sync 1× |
| T2.4 | Doble click confirmar | 2ª llamada bloqueada |
| T2.5 | Imagen vacía / no File | Error validación servicio |
| T2.6 (post-2.5) | Bundle prod | No contiene `gsk_` / GROQ server key |

---

## 7. Decisiones del Auditor (Qwen) — cerradas

| # | Decisión | Veredicto |
|---|---|---|
| 1 | Modelos | Usar catálogo **vivo** Groq Vision: primary `qwen/qwen3.6-27b`, fallback `qwen/qwen3.8-27b`. Llama 3.2 Vision **deprecado**. Parametrizar `GROQ_VISION_MODEL` server-only. Evidencia §0.4. |
| 2 | UX | **A′1** aprobada |
| 3 | Spike 2.0 gate ≥90% | **Obligatorio** antes de apagar Google Vision |
| 4 | Proxy 2.5 | **Prerrequisito** (Paso 1); prohibido VITE_ para visión |
| 5 | Preprocess | **A/B en spike**: (A) original≤1024px vs (B) preprocess agresivo |

---

## 8. Orden de ejecución (Paso 1 en curso)

```text
PASO 1 (ahora):
  2.5 Proxy api/groq-ine.ts + validación 5MB
  2.0 Spike test-groq-vision-ine.js + spike-2.0-resultados.md
  → DETENER; auditoría Qwen

PASO 2 (solo tras 🟢 Paso 1):
  2.1 → 2.2 → 2.3 → 2.4
  → DETENER; evidencia; luego apagar Vision en prod si go/no-go
```

---

## 9. Justificación ejecutiva (para negocio + Qwen)

1. **Costo:** elimina Gemini y Google Vision del path; concentra inferencia en Groq (ya usado) + Tesseract gratis offline.  
2. **Arquitectura:** un proveedor multimodal + JSON mode reduce latencia y llamadas (Context Economy).  
3. **Carta industrial:** proxy SSD desde día 1, prompts centralizados, Strangler, idempotencia A′1, Tesseract offline.  
4. **Riesgo controlado:** spike empírico antes de cortar Vision.  
5. **Modelos:** alineados a docs oficiales Groq Vision 2026 (no catálogo obsoleto Llama 3.2 Vision).

---

## 10. Estado de código

- **Paso 1 autorizado:** Proxy + Spike.  
- **Fases 2.1–2.4:** prohibidas hasta aprobación del Paso 1.