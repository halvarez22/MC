# Benchmark extracción INE — pipeline de la app vs ground truth

**Fecha corrida válida:** 2026-09-06T19:47:34.399Z  
**Alcance:** Solo OCR/Visión Groq (mismo prompt y modelo que `api/groqIneCore.ts`). **Sin** Lista Nominal (tokens DNS agotados).  
**Modelo:** `qwen/qwen3.6-27b`  
**Preprocess:** resize ligero 640px JPEG q=80 (path típico visión)  
**Muestra:** 1 INE real consentido (frontal + posterior; fixtures locales gitignored).  
**Script:** `scripts/run-one-extraction.mjs` → artefacto local gitignored `docs/auditoria/_last-extraction.json`.

> Comparación contra lectura humana. PII **enmascarada** (Regla 5 SSD / mandato Qwen).

---

## Ground truth (humano, enmascarado)

| Campo | Valor |
|---|---|
| Nombre | `J*** P***` |
| CURP | `XXXX000000********` |
| Clave elector | `XXXX************` |
| Nacimiento | `**/09/****` |
| Emisión / Vigencia | 2016 / 2026 |
| Domicilio | `[calle] *** COL [colonia] ***** [ciudad] ***` |
| Sección | `****` |
| Estado / Mun / Loc | `11` / `020` / `0001` |
| CIC (MRZ, para LN) | `141362***` |
| OCR credencial (MRZ) | `153204******` |

---

## Resultado (corrida válida)

| Métrica | Valor |
|---|---|
| Campos OK | **10 / 11** |
| Eficiencia | **90.9%** |
| Latencia Groq | **3.3 s** |
| Tokens | prompt 3821 + completion 1017 = **4838** |

| Campo | ¿OK? | Nota |
|---|---|---|
| nombre_completo | ✅ | Match exacto vs humano |
| curp | ✅ | Match exacto (18 chars) |
| clave_elector | ❌ | 1 transposición de dígitos alrededor de `H` |
| fecha_nacimiento | ✅ | |
| fecha_emision | ✅ | 2016 |
| fecha_vigencia | ✅ | 2026 |
| domicilio | ✅ | Tokens clave OK; puntuación menor |
| seccion | ✅ | |
| municipio | ✅ | |
| estado | ✅ | |
| localidad | ✅ | |

### Error único

La **clave de elector** falló por un dígito desplazado (patrón `…1H110…` vs `…11H10…`). CURP, nombre, fechas, sección y domicilio coincidieron con la lectura humana.

---

## Lista Nominal readiness

El prompt de producto **no pide** `cic` / `ocr_credencial` / `id_ciudadano` en el JSON estructurado.

| Señal | ¿Presente? |
|---|---|
| `cic` en JSON | no |
| `ocr_credencial` en JSON | no |
| Rastro MRZ en `raw_ocr_text` | **sí** — `IDMEX141362***<<153204******…` |

---

## Veredicto

| Pregunta | Respuesta |
|---|---|
| ¿Extrae con eficiencia similar a un humano? | 🟢 **Sí (~91%)** en esta muestra |
| ¿CURP exacto? | 🟢 Sí |
| ¿Clave elector exacta? | 🟡 Casi — 1 transposición |
| ¿Lista Nominal ready? | 🔴 No (falta CIC/OCR en contrato; DNS sin tokens) |

**Conclusión:** el pipeline Groq Vision **sí tiene capacidad** de extraer a nivel cercano al agente. Hueco restante: revisión de clave elector + exponer CIC/OCR del MRZ en Fase 3.x.

---

## Nota privacidad / metodología

- Fixtures en `fixtures/_local_user_ine/` (gitignore).  
- Corridas previas: rate limit 429 / `json_validate_failed`; este reporte solo cuenta HTTP 200 persistida.  
- No se usó API Datos Non Stop en esta prueba.
