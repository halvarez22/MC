# implementation_plan.md — Fase 0 y Fase 1

**Estado:** PENDIENTE DE APROBACIÓN DEL AUDITOR (Qwen)  
**Autor:** Cursor Agent  
**Fecha:** 2026-09-04  
**Alcance autorizado:** SOLO redacción de este plan. **Prohibido** modificar código de aplicación hasta aprobación explícita.  
**Carta aplicable:** `.cursor/rules/industrial-charter.mdc` (Reglas 1–8)  
**Mandato del auditor:** 5 puntos Fase 0 + 3 puntos Fase 1 (veredicto 2026-09-04)

---

## 0. Diagnóstico de partida (aceptado)

| Score global | ~30/100 |
| Código producción | RECHAZADO |
| Diagnóstico Cursor | APROBADO |

Este plan **no** abre Fase 2+ (proxy backend LLM, universalidad PDF, Vitest CI, etc.). Solo estabiliza contratos/seguridad crítica y arranca el estrangulamiento Anti-God del preprocess.

---

## 1. APO — Grafo de impacto global (Fase 0–1)

```text
types.ts  ←─── fuente única de contratos INE
   │
   ├─► services/groqService.ts          (deja de exportar el tipo; importa desde types)
   ├─► components/ine/INEProcessor.tsx  (import tipo; quita useSyncOffline; extrae preprocess)
   ├─► components/auth/SelfRegistrationForm.tsx  (corrige import roto)
   │
vite.config.ts  ──elimina──► window.VITE_GEMINI_API_KEY
   │
hooks/useSyncOffline.ts  ──elimina──► cleanupOldData / clearAllInes
   │                                    (único mount: App.tsx)
   │
App.tsx  ──conserva──► useSyncOffline()  [ÚNICA instancia]
   │         opcional: listener CustomEvent('forceINESync')
   │
services/imageProcessingService.ts  ◄── NUEVO (Fase 1)
services/promptTemplates.ts         ◄── NUEVO (Fase 1)  [recomendado vs constants.tsx]
```

### 1.1 Efectos secundarios identificados (Zero Regressions)

| Efecto | Archivo | Mitigación en el plan |
|---|---|---|
| `INEProcessor` importa `INEStructuredData` desde `groqService` | `INEProcessor.tsx` L4 | Cambiar import a `types.ts` en el mismo PR de Fase 0 |
| Botón “Sincronizar ahora” usa `syncNow` del hook local | `INEProcessor.tsx` L33, L538–540, L708–713 | Sustituir por `navigator.onLine` + `CustomEvent('forceINESync')` escuchado en `App`/`useSyncOffline` — **sin** segundo mount del hook |
| `clearAllInes` queda exportado pero sin auto-llamada | `ineOfflineService.ts`, helpers en `index.tsx` | Conservar export para herramientas DEV explícitas; **prohibido** invocarlo en flujos de producto |
| `AffiliateForm` tipa callback con `ocrService.INEData` (`name`/`voterId`) vs processor que emite `nombre_completo` | `AffiliateForm.tsx` | **Fuera del mandato Fase 0–1** del auditor; se documenta como deuda bloqueante post-Fase-1 (ver §7). No se “parchea” a medias aquí |
| `ocrService.ts` (Gemini) tiene su propio `INEData` | `services/ocrService.ts` | No se toca en Fase 0–1 (legado no cableado al UI vivo) |
| Consumidores de `window.VITE_GEMINI_API_KEY` | `ocrService` / `index.tsx` (si aplica) | Tras quitar `define`, deben usar solo `import.meta.env.VITE_GEMINI_API_KEY`. Verificar con grep post-cambio |
| Umbrales `brightness`/`contrast` al moverse a servicio | `imageProcessingService` | Parametrizar como constantes tipadas exportadas (cero magic numbers sueltos en UI) |

### 1.2 Archivos que se tocarán (checklist)

**Fase 0 (modificar):**
- [ ] `types.ts`
- [ ] `services/groqService.ts`
- [ ] `components/auth/SelfRegistrationForm.tsx`
- [ ] `components/ine/INEProcessor.tsx` (solo: imports tipo + desmontar hook + puente sync)
- [ ] `vite.config.ts`
- [ ] `hooks/useSyncOffline.ts`

**Fase 0 (verificar, no cambiar salvo consumo de window key):**
- [ ] `App.tsx` (conserva único `useSyncOffline`; posible +listener evento)
- [ ] `services/ocrService.ts` / `index.tsx` (grep `window.VITE_GEMINI`)

**Fase 1 (crear):**
- [ ] `services/imageProcessingService.ts`
- [ ] `services/promptTemplates.ts`

**Fase 1 (modificar):**
- [ ] `components/ine/INEProcessor.tsx` (extraer preprocess; consumir prompt vía servicio)
- [ ] `services/groqService.ts` (usar template central; contrato idempotencia)
- [ ] `hooks/useSyncOffline.ts` / `services/ineOfflineService.ts` (flags/mutex según §5)
- [ ] `components/ine/INEProcessor.tsx` (dejar de llamar Groq en captura si se adopta Opción A)

---

## 2. FASE 0 — Estabilización de contratos y seguridad crítica

### Objetivo

Cerrar violaciones **críticas** R5/R2/R8/R6 (wipe) y R1 (doble mount) **sin** rediseñar el pipeline OCR completo.

### Criterio de aceptación Fase 0

1. `INEStructuredData` existe **solo** en `types.ts`.
2. Ningún archivo importa ese tipo desde `groqService`.
3. `SelfRegistrationForm` importa desde `../../types`.
4. `vite.config.ts` **no** contiene `window.VITE_GEMINI_API_KEY`.
5. `useSyncOffline` **no** contiene `cleanupOldData` ni llamada automática a `clearAllInes`.
6. `useSyncOffline(` aparece **una sola vez** en runtime de producto: `App.tsx`.
7. Build TypeScript/Vite pasa (sin nuevos errores de tipo por el contrato).
8. Un brigadista con >5 INEs pendientes **no** pierde datos al montar la app.

---

### Paso 0.1 — Mover `INEStructuredData` a `types.ts`

**Archivo:** `types.ts`  
**Acción:**
- Añadir, junto a `INEData` (dominio persistido/afiliado), la interfaz canónica de extracción LLM:

```ts
/** Contrato canónico de extracción estructurada INE (salida LLM/OCR pipeline). */
export interface INEStructuredData {
  nombre_completo?: string;
  curp?: string;
  fecha_nacimiento?: string;
  fecha_emision?: string;
  fecha_vigencia?: string;
  domicilio?: string;
  clave_elector?: string;
  seccion?: string;
  municipio?: string;
  estado?: string;
  localidad?: string;
}
```

- **No** fusionar aún con `INEData` (campos distintos: `name` vs `nombre_completo`). La unificación total es deuda post-Fase-1 (§7).
- Opcional recomendado en el mismo paso (bajo riesgo): añadir helper tipado `mapStructuredToINEData(s: INEStructuredData): INEData` en `types.ts` o `services/ineMappers.ts` — **solo si** el auditor lo aprueba como parte de 0.1; si no, diferir.

**No tocar:** lógica de negocio, UI, Firebase.

---

### Paso 0.2 — `groqService.ts` deja de ser dueño del tipo

**Archivo:** `services/groqService.ts`  
**Acción:**
- Eliminar `export interface INEStructuredData { ... }` (L4–16 actuales).
- Añadir: `import type { INEStructuredData } from '../types';`
- Mantener firmas `processINEText(...): Promise<INEStructuredData>` sin cambio de comportamiento.
- **No** mover el prompt aún (eso es Fase 1.2).

**Verificación:** grep `export interface INEStructuredData` → 0 resultados fuera de `types.ts`.

---

### Paso 0.3 — Corregir import en `SelfRegistrationForm.tsx`

**Archivo:** `components/auth/SelfRegistrationForm.tsx`  
**Acción:**
- L2 ya importa `INEStructuredData` desde `../../types` — tras 0.1 ese import **pasa a ser válido**.
- Confirmar que L47, L103–115 siguen usando `nombre_completo` / `domicilio` / etc. (compatibles con la interfaz movida).
- Sin cambios de UX ni submit.

**Archivo compañero obligatorio:** `components/ine/INEProcessor.tsx`  
- Cambiar L4 de `import { groqService, INEStructuredData } from '...groqService'` a:
  - `import { groqService } from '...groqService'`
  - `import type { INEStructuredData } from '../../types'`

---

### Paso 0.4 — Eliminar fuga `window.VITE_GEMINI_API_KEY`

**Archivo:** `vite.config.ts`  
**Acción:**
- Eliminar por completo el bloque:

```ts
define: {
  'window.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
},
```

- Conservar `loadEnv` solo si sigue siendo necesario para otra cosa; si tras el borrado `env` queda sin uso, limpiar import/uso de `loadEnv` para no dejar dead code.
- **No** introducir proxy backend en esta fase (fuera de mandato). Las keys que ya usan `import.meta.env.VITE_*` en servicios permanecen (patrón cliente aún imperfecto vs SSD ideal, pero el auditor ordenó eliminar la inyección a `window` ahora).

**Verificación post-cambio:**
```text
grep -R "window.VITE_GEMINI" --include="*.ts" --include="*.tsx"
```
→ 0 hits. Si `ocrService`/`index.tsx` leen `window.VITE_GEMINI_API_KEY`, migrarlos a `import.meta.env.VITE_GEMINI_API_KEY` en el mismo paso 0.4.

---

### Paso 0.5 — ELIMINAR `cleanupOldData` / auto-`clearAllInes` (no negociable)

**Archivo:** `hooks/useSyncOffline.ts`  
**Acción:**
- Borrar íntegramente la función interna `cleanupOldData` (aprox. L137–156) y su invocación al montar.
- El `useEffect` de sync debe quedar solo con:
  - sync inicial con delay
  - listener `online`
  - intervalo periódico
  - cleanup de timers/listeners
- **Prohibido** reintroducir umbrales tipo `pending > N` que borren datos.
- `clearAllInes` puede seguir existiendo en `ineOfflineService.ts` para uso **manual/DEV** (`index.tsx` helpers), nunca en el ciclo de vida del hook de producto.

**Criterio:** un dispositivo con 6+ pendientes al abrir la app conserva los 6+.

---

### Paso 0.6 — Desmontar `useSyncOffline` de `INEProcessor` (único mount en App)

**Archivo:** `components/ine/INEProcessor.tsx`  
**Acción:**
1. Eliminar `import { useSyncOffline } ...`
2. Eliminar `const { isOnline, syncNow } = useSyncOffline();`
3. Sustituir indicador online por `navigator.onLine` (o estado local con listener `online`/`offline` **sin** invocar el hook de sync).
4. Botón “Sincronizar ahora”:
   - **Opción recomendada (Zero Regression UX):**  
     `window.dispatchEvent(new CustomEvent('forceINESync'))`
   - **Archivo:** `hooks/useSyncOffline.ts` — añadir en el `useEffect` existente:  
     `window.addEventListener('forceINESync', syncPendingInes)` (+ remove en cleanup).
   - Así `App.tsx` L27 sigue siendo el **único** mount que ejecuta sync/efectos.

**Archivo:** `App.tsx`  
- Conservar `useSyncOffline();` (L27).
- No montar el hook en ningún otro componente.

**Verificación:**
```text
grep -R "useSyncOffline(" --include="*.tsx"
```
→ solo `App.tsx` (definición del hook excluida).

---

### Orden de ejecución Fase 0 (Strangler / capas)

```text
0.1 types.ts
0.2 groqService.ts (re-wire tipo)
0.3 SelfRegistrationForm (ya válido) + INEProcessor imports
0.4 vite.config (+ consumidores window si existen)
0.5 useSyncOffline (quitar wipe + listener forceINESync)
0.6 INEProcessor (quitar hook; emitir evento)
→ build / smoke manual captura INE offline con >5 pendientes
```

**Gate:** no iniciar Fase 1 hasta smoke de Fase 0 OK **y** re-aprobación del auditor si lo exige.

---

## 3. FASE 1 — Extracción de motores (Anti-God) + prompts + idempotencia

### Objetivo

Reducir `INEProcessor` hacia componente presentacional/orquestador fino; centralizar prompt; **definir e implementar** contrato anti-triple-Groq.

### Criterio de aceptación Fase 1

1. `INEProcessor.tsx` **no** contiene `preprocessImageForOCR`, `calculateOtsuThreshold`, ni kernels Canvas.
2. Existe `services/imageProcessingService.ts` con API clara y umbrales parametrizados.
3. El prompt Groq **no** vive como string literal dentro de `processINEText`; vive en `services/promptTemplates.ts`.
4. En un flujo feliz online (captura → review OCR → confirmar → sync), Groq se invoca **como máximo 1 vez** por `pendingINE.id` (salvo reintento explícito del usuario).
5. Sync **no** re-procesa INEs ya marcadas `processed: true`.
6. No hay segundo mount de `useSyncOffline`.

---

### Paso 1.1 — Crear `services/imageProcessingService.ts`

**Nuevo archivo:** `services/imageProcessingService.ts`

**Mover desde** `INEProcessor.tsx` (aprox. L219–448 + helper Otsu L401–448):
- `preprocessImageForOCR(file: File): Promise<File>`
- `calculateOtsuThreshold(histogram: number[]): number`
- Constantes tipadas (ejemplo de forma; valores actuales a preservar para Zero Regression visual/OCR):

```ts
export const IMAGE_PREPROCESS_CONFIG = {
  brightness: 20,
  contrast: 1.5,
  jpegQuality: 0.95,
  otsuOffset: 20,
  minThreshold: 90,
  fallbackThreshold: 110,
  noiseNeighborMin: 3,
} as const;
```

**API pública mínima:**
```ts
preprocessImageForOCR(file: File, config?: Partial<typeof IMAGE_PREPROCESS_CONFIG>): Promise<File>
```

**Validación de entrada (SSD / Regla 5, mínima en esta fase):**
- Rechazar si `!(file instanceof File)` o `file.size === 0`.
- (MIME estricto puede ser Fase posterior; documentar como follow-up.)

**Cambios en** `INEProcessor.tsx`:
- Eliminar funciones locales movidas.
- `import { preprocessImageForOCR } from '../../services/imageProcessingService'`
- Llamadas en `handleImagesCaptured` inalteradas en semántica.

**Fuera de alcance Fase 1.1:** extraer Tesseract/Vision a `ocrOrchestrator` (eso sería Fase 2+ del roadmap original). El god-file se reduce pero aún orquesta OCR+UI; el auditor pidió **este** corte primero.

---

### Paso 1.2 — Centralizar prompt Groq

**Decisión de diseño (propuesta):** crear `services/promptTemplates.ts`  
**No** meter prompts largos en `constants.tsx` (hoy solo LOGO/ICONS/estados; mezclar prompts LLM viola separación de concerns y ensucia el barrel de UI).

**Nuevo archivo:** `services/promptTemplates.ts`
```ts
export function buildIneExtractionPrompt(rawText: string): string { /* template actual L37-58 */ }
```

**Archivo:** `services/groqService.ts`
- `processINEText` usa `buildIneExtractionPrompt(rawText)`.
- Endpoint/modelo: parametrizar como constantes en el mismo módulo o `promptTemplates` / `llmConfig.ts` mínimo:

```ts
export const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama3-8b-8192',
  temperature: 0.1,
  maxTokens: 1000,
} as const;
```

(Hardcoding de URL/modelo sigue siendo deuda HRU menor vs prompt embebido; centralizar ya cumple el mandato del auditor.)

---

### Paso 1.3 — Contrato de idempotencia (anti triple-Groq) — PROPUESTA FORMAL

#### Problema actual (verificado)

| # | Momento | Dónde |
|---|---|---|
| 1 | Tras OCR si `navigator.onLine` | `INEProcessor` ~L175–178 |
| 2 | Usuario confirma texto | `handleProcessWithAI` ~L478 |
| 3 | Sync de pendientes `processed: false` | `useSyncOffline` ~L53 |

Sin mutex; `savePendingINE` siempre deja `processed: false` → el sync **siempre** puede re-llamar Groq aunque (1) o (2) ya hayan tenido éxito.

#### Solución propuesta: **Opción A — Single Intentional LLM Call (recomendada)**

Principio: **una sola transición de usuario** dispara Groq; la captura solo hace OCR + persistencia raw.

```text
Captura/OCR
  → preprocess + Vision|Tesseract
  → savePendingINE(raw, image)  // processed: false
  → NO llamar groqService aquí     ← elimina llamada #1
  → step: ocr_review

Usuario: "Usar texto" | "Aplicar correcciones"
  → handleProcessWithAI
  → mutex por pendingId (ref/Map in-flight)
  → groqService.processINEText      ← ÚNICA llamada feliz
  → markINEAsProcessed(id, structured)
  → step: review

Sync (App / forceINESync)
  → getUnprocessedInes() solo processed === false
  → si id en inFlight → skip
  → processSingleINE → Groq solo para rezagados offline
  → markINEAsProcessed
```

**Resultado:**
- Online con usuario que confirma texto: **1× Groq**.
- Offline luego online sin confirmación en sesión: sync hace **1× Groq** (legítimo).
- Nunca 1+2+3 sobre el mismo texto en la misma sesión feliz.

#### Complementos obligatorios (misma Fase 1.3)

1. **Marcar procesado tras éxito en UI**  
   Hoy tras Groq en captura/review **no** se llama `markINEAsProcessed`. Habrá que:
   - Conservar `savedId` en estado de `INEProcessor` al hacer `savePendingINE`.
   - Tras Groq exitoso en `handleProcessWithAI`, invocar `markINEAsProcessed(savedId, structured)`.

2. **Mutex de sync** en `useSyncOffline`:
   - `let syncing = false` (ref) al inicio de `syncPendingInes`; early-return si ya syncing.
   - `Set<string> inFlightIds` por `ine.id` dentro de `processSingleINE`.

3. **Botones AI** en `ocr_review`: `disabled={isProcessing}` (cierre U-First + idempotencia UI).

4. **`isAvailable()`:** deja de hacer completion real de prueba en el hot path de sync (o cachear resultado 5–10 min). Propuesta mínima: health-check por presencia de key + HEAD/opcional; si se mantiene fetch de prueba, **no** invocarlo en cada sync, solo al boot una vez.

#### Alternativa rechazada para esta fase

**Opción B** — Mantener Groq en captura (#1) y saltar #2 si ya hay `structuredData`: sigue permitiendo race con sync (#3) si no se marca `processed` a tiempo. Inferior a Opción A.

#### Contrato explícito (para el auditor)

| Campo | Valor |
|---|---|
| Clave de idempotencia | `PendingINE.id` |
| Estado terminal LLM | `processed === true` + `structuredData` persistido |
| Disparador LLM en UX online | Solo confirmación de texto OCR |
| Disparador LLM en background | Solo sync de `processed === false` |
| Reintento usuario | “Reprocesar OCR” / “Aplicar correcciones” de nuevo → permitido; debe reutilizar mismo `id` o crear nuevo registro conscientemente (definir: **reutilizar `savedId`** y sobrescribir structured) |
| Prohibido | Llamar Groq en `handleImagesCaptured` cuando el siguiente paso es `ocr_review` |

---

### Orden de ejecución Fase 1

```text
1.1 imageProcessingService + cablear INEProcessor
1.2 promptTemplates + GROQ_CONFIG + cablear groqService
1.3 Idempotencia Opción A:
    - quitar Groq de handleImagesCaptured
    - savedId + markINEAsProcessed en handleProcessWithAI
    - mutex sync + disabled botones
    - suavizar isAvailable
→ smoke: 1 INE online = 1 request Groq en Network tab
→ smoke: offline captura ×6, reopen app = 6 pendientes intactos, sync procesa sin wipe
```

---

## 4. Qué NO se hace en Fase 0–1 (límites explícitos)

- Proxy backend para keys Groq/Vision/Gemini (SSD completo).
- Sanitización/anonimización PII antes de LLM.
- Extracción de Tesseract/Vision a orquestador MCP-like.
- Universalidad PDF/texto.
- Vitest/CI.
- Unificar `INEData` ↔ `INEStructuredData` ↔ `ocrService.INEData`.
- Reparar `AffiliateForm` mismatch de campos (`name` vs `nombre_completo`).
- Refactor de `firebaseService` mock / auth passwords.
- Reactivar umbrales de calidad en `INECapture` (hotfix `false`).

Estos quedan para fases posteriores **con nuevo** `implementation_plan` y aprobación.

---

## 5. Plan de verificación (sin automatizar aún)

| ID | Prueba manual | Fase | Resultado esperado |
|---|---|---|---|
| T0.1 | `tsc` / `npm run build` | 0 | OK, sin error de módulo `INEStructuredData` |
| T0.2 | grep `window.VITE_GEMINI` | 0 | 0 hits |
| T0.3 | grep `useSyncOffline(` en tsx | 0 | solo `App.tsx` |
| T0.4 | Sembrar 6 pendientes IndexedDB; recargar | 0 | siguen 6; no clear |
| T1.1 | Captura online + confirmar texto; DevTools Network | 1 | 1× `chat/completions` Groq |
| T1.2 | Tras confirmar, forzar sync | 1 | 0× Groq adicional (ya processed) |
| T1.3 | Offline captura; luego online sync | 1 | 1× Groq por pendiente |
| T1.4 | Doble click “Aplicar correcciones” | 1 | segunda llamada bloqueada / no duplica |

---

## 6. Rollback

- Cada paso Fase 0 es un commit atómico reversible.
- Fase 1.1: si OCR degrada, revertir solo el move y reinstalar funciones en el componente (valores de config idénticos mitigan riesgo).
- Fase 1.3 Opción A: si se necesita Groq “eager” otra vez, reintroducir llamada en captura **solo** junto con `markINEAsProcessed` inmediato (nunca sin flag).

---

## 7. Deuda explícita post-Fase-1 (no autorizada aún)

1. **AffiliateForm** usa `ocrService.INEData` (`name`, `voterId`) mientras `INEProcessor` emite `INEStructuredData` — bug funcional latente.
2. Mapper canónico único `INEStructuredData → INEData`.
3. `ocrOrchestrator` (Vision→Tesseract) fuera de UI.
4. Proxy keys + sanitización PII.
5. Eliminar o estrangular `ocrService` Gemini legado.
6. Reactivar calidad de captura parametrizada.

---

## 8. Solicitud al Auditor (Qwen)

Se solicita **APROBAR / RECHAZAR / AJUSTAR** este plan antes de cualquier diff de aplicación.

Preguntas concretas que requieren decisión del auditor:

1. ¿Se aprueba **Opción A** de idempotencia (quitar Groq de la captura)?  
2. ¿Prompt en `services/promptTemplates.ts` (recomendado) o forzar `constants.tsx`?  
3. ¿Incluir en Fase 0 el mapper `mapStructuredToINEData` o diferirlo?  
4. ¿El puente `CustomEvent('forceINESync')` es aceptable para el botón “Sincronizar ahora”?

**Compromiso:** cero líneas de código de producto hasta respuesta de aprobación.
