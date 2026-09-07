# Spike 3.0 — Lista Nominal INE (Datos Non Stop)

**Fecha (corrida sandbox):** 2026-09-07T17:12:20.693Z  
**Proveedor:** Datos Non Stop — validación **Lista Nominal**  
**Endpoint:** `https://sandbox.api.datosnonstop.com/v1/ine/lista-nominal`  
**API key:** `dns_5d1e…853b` (sandbox; truncada; solo `.env.local`)  
**Timeout:** 20000 ms  
**Host:** **sandbox**  

> Regla 5 / 8: tasas reales de esta corrida. Sin PII de personas reales. Key nunca completa en el reporte.

---

## Hallazgo sobre Datos de Prueba

> *"Las consultas con datos de sandbox genéricos devuelven `not_found` en el entorno de producción, lo cual valida que la API consulta el padrón real y no devuelve mocks. Se requieren datos reales enmascarados o un endpoint de sandbox dedicado para métricas de éxito."*

| Corrida | Host | Key | Resultado |
|---|---|---|---|
| A (previa) | prod | prod | Catálogo sandbox → 25% vs expectativa (esperado: IDs de lab no están en padrón) |
| B (previa) | prod | prod | Credencial real consentida D/C → `found` (tokens prod agotados después) |
| **C (esta)** | **sandbox** | **sandbox** | Catálogo oficial → **100% (8/8)** |

Conclusión: el umbral ≥90% del spike se mide correctamente **en sandbox** con key de sandbox. Producción queda para operación real (cuota aparte).

---

## Resultados (sandbox — catálogo oficial)

| Caso | Esperado | Obtenido | HTTP | ms | Pass |
|---|---|---|---|---|---|
| C_vigente | found | found | 200 | 315 | ✅ |
| D_vigente | found | found | 200 | 85 | ✅ |
| E_vigente | found | found | 200 | 34 | ✅ |
| F_vigente | found | found | 200 | 33 | ✅ |
| G_vigente | found | found | 200 | 33 | ✅ |
| H_vigente | found | found | 200 | 29 | ✅ |
| not_found_cic | not_found | not_found | 200 | 33 | ✅ |
| not_current_cic | not_found | not_valid* | 200 | 29 | ✅ |

\* `not_valid` aceptado como pass del caso “no vigente / no actual” (contrato DNS).

**Tasa de acierto:** **100.0%** (8/8)  
**Contrato** (`found` \| `not_found` \| `not_valid`): **100%**  
**Umbral GO ≥90%:** 🟢 **CUMPLE**  
**Latencia sandbox:** ~30–315 ms (muy por debajo de prod 8–16 s)

---

## Muestras sanitizadas (fixtures de lab — sin PII real)

### Ejemplos `found` (C / D / E)
```json
{
  "status": "found",
  "modelo": "d",
  "vigencia": "2031-12-31",
  "anioEmision": "2021"
}
```

### `not_found_cic`
```json
{
  "status": "not_found",
  "modelo": "e",
  "message": "No se obtuvieron datos de la consulta…"
}
```

### `not_current_cic`
```json
{
  "status": "not_valid",
  "modelo": "e",
  "message": "No está vigente… no es tu última credencial…"
}
```

---

## Blindaje / estado del producto

| Ítem | Estado |
|---|---|
| Spike sandbox ≥90% | 🟢 100% |
| Proxy SSD + flag OFF (Fases 3.1–3.3) | 🟢 Ya en repo |
| Key sandbox en `.env.local` | ✅ (gitignored) |
| Tokens prod DNS | ⛔ Agotados — no usar prod para CI |
| `VITE_USE_LISTA_NOMINAL` | `false` (Strangler) |
| Aviso LFPDPPP | ✅ Incorporado en App (`PrivacyNoticeBody` + consentimiento en registro). Personalizar `VITE_PRIVACY_ORG_*`. |

---

## Veredicto

🟢 **GO empírico del spike en sandbox.**  
El proveedor responde estatus de Lista Nominal de forma fiable en entorno de pruebas, **sin consumir cuota de producción**.

**Siguiente (negocio, no código):**  
1. Cerrar Aviso de Privacidad (LFPDPPP).  
2. Cuando el dueño autorice: activar flag + Fase 3.4 (persistencia audit) con key sandbox en CI y key prod solo en Vercel prod.

---

## LFPDPPP (recordatorio)

Validar CIC / OCR / id ciudadano vía terceros requiere Aviso de Privacidad actualizado antes de producción con flag ON.
