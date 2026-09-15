# APO-OCR-MAP — Precisión CURP/clave + domicilio → formulario Modo Campo

**Estado:** 🟢 **IMPLEMENTADO M.1–M.5 — pendiente auditoría final / merge** (Qwen GO 2026-09-15)  
**Smoke:** `npm run smoke:ine-ocr-map` → **SPIKE PASS** (Héctor: Guanajuato, 37510, city≠020, CURP warning)  
**STOP:** M.6 envelope, D.1, D.2 write, Autocaptura. CURP checksum = warning no bloqueo.

**Objetivo:**  
1. Reducir errores de **CURP** y **clave de elector**.  
2. Que **Dirección / Ciudad / Estado / CP** se rellenen desde el INE sin fricción innecesaria del brigadista (siempre editables como red de seguridad).

**Relación con APO-DEMO-RESET:** Este APO es **post-demo / paralelo**; **no** bloquea el guion cifrado BD↔Admin (Opción A). No ampliar envelope nube aquí salvo GO explícito (ver §4).

---

## 0. Evidencia forense (caso Héctor)

| Campo | INE (foto) | OCR app |
|--------|------------|---------|
| CURP | `AAGH650922HGTLTC04` | `AGMH690922HGTCTL04` |
| Clave elector | `ALGTHC65092211H100` | `ALGTHC6509221H1H00` |
| Domicilio | C PARQUE VIA 324 / COL PARQUE MANZANARES **37510** / **LEÓN, GTO.** | Parcial sin CP/ciudad |
| Municipio / Estado INE | códigos `020` / `11` | Ciudad=`020`, Estado=`Aguascalientes` (default) |

**Causas raíz (código actual):**

1. **CURP/clave:** error de Vision/LLM en lectura; no hay post-validación cruzada (MRZ / dígitos CURP / coherencia fecha). Edición manual solo en `INEProcessor`.  
2. **Ciudad/Estado:** `SelfRegistrationForm.handleINEDataExtracted` mapea `municipio`→`city` y `estado`→`state` **sin normalizar** códigos INE → nombres. El `<select>` exige exactamente un valor de `MEXICAN_STATES`; `"11"` / `"GTO"` no matchean → queda `MEXICAN_STATES[0]` = Aguascalientes.  
3. **CP:** no hay extracción al form (comentario histórico “no tenemos CP”); el CP **sí** está en el domicilio impreso.

---

## 1. Grafo de impacto

```text
INECapture / FieldView
  → INEProcessor (revisión editable)
  → ocrOrchestrator / groqVisionService
  → POST /api/groq-ine → groqIneCore (INE_VISION_PROMPT + modelo)
  → INEStructuredData
  → SelfRegistrationForm.handleINEDataExtracted  ← MAPEO ROTO
       city = municipio (código)
       state = estado (no normalizado)
       zip  = sin tocar
  → (opcional) syncAck structuredDataToAffiliatePayload
       solo address string + curp + name…  ← fuera de scope demo-reset A
```

| Capa | Archivos | Riesgo al tocar |
|------|----------|-----------------|
| Prompt Vision | `api/groqIneCore.ts`, espejo `services/promptTemplates.ts` | Calidad OCR; tokens |
| Post-OCR validación | **nuevo** `services/ineFieldNormalization.ts` (propuesto) | Bajo si puro/puro test |
| Form map | `components/auth/SelfRegistrationForm.tsx` | UX campo |
| Catálogo | `constants.tsx` + **nuevo** mapa código estado/municipio | Datos estáticos |
| UI revisión | `components/ine/INEProcessor.tsx` | Warnings de inconsistencia |
| STOP | Autocaptura umbrales, D.1 purge, D.2 encrypt schema, Admin list | No tocar |

---

## 2. Diseño propuesto (capas)

### APO-OCR-MAP.1 — Contrato de salida Vision (prompt + schema)

Exigir en JSON (parametrizado en prompt central, **sin hardcode en JSX**):

```text
estado_codigo: "11"           // 2 dígitos INE
estado_nombre: "Guanajuato"   // nombre oficial
municipio_codigo: "020"
municipio_nombre: "León"      // o el que corresponda al catálogo
domicilio_lineas: string      // texto completo como en INE
codigo_postal: "37510"        // 5 dígitos si visible en domicilio
curp: 18 chars
clave_elector: 18 chars
```

Reglas prompt:  
- Preferir MRZ/reverso para validar fecha nacimiento vs CURP posiciones 5–10.  
- No inventar; si solo hay código, devolver código y dejar `*_nombre` vacío.  
- CURP/clave: caracteres exactos; advertir ambigüedad O/0, I/1.

**Compat:** mantener `estado` / `municipio` / `domicilio` legacy rellenados (= nombre o código) para no romper callers.

Actualizar `INEStructuredData` en `types.ts` con campos opcionales nuevos.

### APO-OCR-MAP.2 — Normalización determinística (servicio)

Módulo `services/ineFieldNormalization.ts` (anti-God-component):

| Función | Comportamiento |
|---------|----------------|
| `normalizeMexicanState(raw)` | `"11"` / `"GTO"` / `"GUANAJUATO"` → `"Guanajuato"` ∈ `MEXICAN_STATES` |
| `parsePostalCodeFromDomicilio(domicilio)` | Regex `\b\d{5}\b` (p. ej. 37510) |
| `resolveCity(municipioNombre\|codigo, domicilio)` | Preferir nombre; si solo código, intentar parsear ciudad tras CP en domicilio (`LEON, GTO`) |
| `validateCurpChecksum(curp)` | Dígito verificador CURP (algo oficial) → flag `curpValid` |
| `crossCheckCurpDob(curp, fechaNacimiento)` | Coherencia YYMMDD |

Catálogo mínimo: mapa **32 estados** código→nombre (INE). Municipios: **fase 1** no requiere catálogo completo 2k+; prioridad parseo de domicilio + estado. Catálogo municipio por estado = **fase 2 opcional**.

### APO-OCR-MAP.3 — Cableado formulario

En `handleINEDataExtracted`:

```text
address ← domicilio (completo)
zip     ← codigo_postal || parsePostalCodeFromDomicilio(domicilio)
state   ← normalizeMexicanState(estado_nombre || estado || estado_codigo)
city    ← municipio_nombre || cityFromDomicilio || (no usar código crudo como city)
```

Si tras normalizar `state` no está en `MEXICAN_STATES` → dejar vacío / pedir selección (mejor que Aguascalientes falso). **Cambiar default** `state: ''` o placeholder “Seleccione estado” en lugar de `MEXICAN_STATES[0]`.

### APO-OCR-MAP.4 — UX revisión OCR (U-First)

En `INEProcessor`:  
- Badge/warning si CURP inválido o incoherente con fecha.  
- Badge si `municipio` parece solo dígitos (“código INE — verificar ciudad”).  
- Mantener **edición manual** + Confirmar (nunca bloquear sin salida).

### APO-OCR-MAP.5 — (Opcional, GO aparte) Envelope nube

Hoy sync solo manda `address` string. Ampliar `AffiliateData` con `city`/`state`/`zip` = **reabre D.2 write** → **fuera** de este APO salvo `GO APO-OCR-MAP + ENVELOPE`.

---

## 3. Fases de entrega

| Fase | Contenido | ETA | Dependencias |
|------|-----------|-----|--------------|
| **M.1** | Catálogo estados + `ineFieldNormalization` + tests unitarios | ~2–3 h | — |
| **M.2** | Prompt/schema Vision + types | ~1–2 h | M.1 opcional |
| **M.3** | `SelfRegistrationForm` map + default state | ~1 h | M.1 |
| **M.4** | Warnings INEProcessor | ~1 h | M.1 |
| **M.5** | Smoke con fixture Héctor (frontal+reverso) + umbral CURP exacto | ~1–2 h | M.2–M.4 |
| **M.6** | Envelope city/state/zip | Diferido | GO aparte |

**Recomendación GO inicial:** **M.1 + M.3 + M.4** primero (gana UX inmediata aunque el modelo siga fallando a veces), luego **M.2 + M.5** (mejora extracción).

---

## 4. Alternativas y trade-offs

| Enfoque | Pros | Contras |
|---------|------|---------|
| Solo prompt (sin normalizer) | Rápido | Sigue rompiendo si el modelo devuelve `"11"` |
| Solo normalizer (sin prompt) | Determinístico; arregla 020→parse domicilio | CURP sigue dependiendo del modelo |
| **Prompt + normalizer (propuesto)** | Defensa en profundidad | Más archivos; hay que versionar prompt en un solo canal |
| Catálogo municipios completo | Ciudad perfecta desde código | Pesado; mantenimiento INE |

---

## 5. Test plan

| ID | Caso | Esperado |
|----|------|----------|
| T1 | `normalizeMexicanState("11")` | Guanajuato |
| T2 | `normalizeMexicanState("GTO")` | Guanajuato |
| T3 | Domicilio con `37510` | zip=`37510` |
| T4 | municipio=`020` + domicilio León | city ≠ `020` (nombre o parseado) |
| T5 | Fixture Héctor Vision | CURP exacto `AAGH650922HGTLTC04` (meta demo; si falla, warning + editable) |
| T6 | Clave exacta | `ALGTHC65092211H100` |
| T7 | Form tras extract | state∈MEXICAN_STATES; zip 5 dígitos; sin default Aguascalientes espurio |
| T8 | Regresión Autocaptura / D.1 / Admin list | Sin cambios de comportamiento |
| T9 | Bundle | Sin secretos; prompts solo vía servicio/config |

---

## 6. STOP (inamovible)

- No tocar umbrales/ventana de **autocaptura**.  
- No tocar D.1 purge / Zero-PII.  
- No tocar D.2 encrypt/decrypt ni Admin secure-list (salvo GO envelope M.6).  
- No hotfixes en `INEProcessor` monstruo sin extraer normalizer a `services/`.  
- No ampliar Opción B de DEMO-RESET por la puerta de atrás.

---

## 7. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Prompt nuevo degrada otros campos | Fixture A/B; flag `VITE_INE_PROMPT_V2` o env `INE_VISION_PROMPT_VERSION` server |
| Municipio código sin catálogo | Parseo domicilio; UI warning |
| CURP nunca 100% | Validación + edición obligatoria si checksum falla |
| God-component | Lógica en `services/ineFieldNormalization.ts` |

---

## 8. Checklist pre-código

- [x] Diagnóstico con evidencia INE real  
- [x] Grafo UI → form → proxy Vision  
- [x] Normalización parametrizada (catálogo/constants)  
- [x] U-First: editar + warnings  
- [ ] **GO Qwen/usuario**

---

## 9. Decisión solicitada

Responder con una:

1. **`GO APO-OCR-MAP M.1+M.3+M.4`** — normalizer + form + warnings (recomendado primero).  
2. **`GO APO-OCR-MAP completo M.1–M.5`** — incluye prompt Vision + smoke Héctor.  
3. **`GO APO-OCR-MAP + M.6 envelope`** — además city/state/zip en cifrado nube (reabre D.2 write).  
4. **`Ajustar plan: …`**

**Sin GO → no hay diffs.**
