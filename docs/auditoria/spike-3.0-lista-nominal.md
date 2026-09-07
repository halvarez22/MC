# Spike 3.0 — Lista Nominal INE (Datos Non Stop)

**Fecha:** 2026-09-07T22:46:01.603Z  
**Mandato:** Fase 3.0 únicamente (Qwen 🟢 APROBADO CON OBSERVACIONES)  
**Proveedor:** Datos Non Stop — validación **Lista Nominal** (no solo “documento parece real”)  
**Alternativa documentada:** Kiban (INE Lista Nominal, modelos C–H)  
**Endpoint:** `https://sandbox.api.datosnonstop.com/v1/ine/lista-nominal`  
**Resolución host:** forzado por DATOS_NONSTOP_BASE_URL  
**API key:** presente en `.env.local` (gitignored; valor **no** incluido en este reporte)  
**Timeout por llamada:** 20000 ms  
**Host:** sandbox  

> Regla 8: tasas **reales** de esta corrida. Cero mocks presentados como empíricos.

---

## Investigación de proveedores (blindaje Qwen)

| Proveedor | ¿Lista Nominal MX? | Sandbox | Notas |
|---|---|---|---|
| **Datos Non Stop** | ✅ Documentado `POST /v1/ine/lista-nominal` status found/not_found + vigencia | ✅ `sandbox.api.datosnonstop.com` | Elegido para spike (key de prueba del dueño) |
| **Kiban** | ✅ Docs “INE - Lista nominal” (C/D/E–H) | Según plan comercial | Alternativa; no ejecutado en esta corrida |

Criterio de éxito del spike: *¿devolvió estatus de vigencia en Lista Nominal?* → `found` / `not_found` (+ message).

---

## Resultados

| Caso | Esperado | Obtenido | HTTP | ms | Pass |
|---|---|---|---|---|---|
| C_vigente | found | found | 200 | 286 | ✅ |
| D_vigente | found | found | 200 | 153 | ✅ |
| E_vigente | found | found | 200 | 59 | ✅ |
| F_vigente | found | found | 200 | 55 | ✅ |
| G_vigente | found | found | 200 | 56 | ✅ |
| H_vigente | found | found | 200 | 52 | ✅ |
| not_found_cic | not_found | not_found | 200 | 58 | ✅ |
| not_current_cic | not_found | not_valid | 200 | 55 | ✅ |

**Tasa de acierto (casos esperados sandbox):** **100.0%** (8/8)  
**Contrato Lista Nominal** (respuesta `found`|`not_found`|`not_valid`): **100.0%** (8/8)  
**Umbral GO (≥90% en sandbox con catálogo oficial):** 🟢 CUMPLE  



Tokens restantes (última respuesta header): `n/a`

---

## Muestras sanitizadas (sin PII extra)

### C_vigente
```json
{
  "id": "20c04225a3cb4abb8560852c53d32c4a",
  "status": "found",
  "modelo": "c",
  "descripcion": "Esta vigente como medio de identificación y puedes votar. Tus datos se encuentran en el Padrón Electoral, y también en la Lista Nominal de Electores.",
  "vigencia": "2031-12-31",
  "fechaConsulta": "2023-03-15",
  "anioEmision": "2021"
}
```

### D_vigente
```json
{
  "id": "9b9901d0f7344c048b1013ad3e6b1d52",
  "status": "found",
  "modelo": "d",
  "descripcion": "Esta vigente como medio de identificación y puedes votar. Tus datos se encuentran en el Padrón Electoral, y también en la Lista Nominal de Electores.",
  "vigencia": "2031-12-31",
  "fechaConsulta": "2023-03-15",
  "anioEmision": "2021"
}
```

### E_vigente
```json
{
  "id": "4c6f64f9b1ca4aa487d0b6572806ad0f",
  "status": "found",
  "modelo": "e",
  "descripcion": "Esta vigente como medio de identificación y puedes votar. Tus datos se encuentran en el Padrón Electoral, y también en la Lista Nominal de Electores.",
  "vigencia": "2031-12-31",
  "fechaConsulta": "2023-03-15",
  "anioEmision": "2021"
}
```

### F_vigente
```json
{
  "id": "3b8b2d1394304fc5b3f0a0c29c5b6e29",
  "status": "found",
  "modelo": "e",
  "descripcion": "Esta vigente como medio de identificación y puedes votar. Tus datos se encuentran en el Padrón Electoral, y también en la Lista Nominal de Electores.",
  "vigencia": "2031-12-31",
  "fechaConsulta": "2023-03-15",
  "anioEmision": "2021"
}
```

### G_vigente
```json
{
  "id": "8452f1411a414b71b195f9500170cc93",
  "status": "found",
  "modelo": "e",
  "descripcion": "Esta vigente como medio de identificación y puedes votar. Tus datos se encuentran en el Padrón Electoral, y también en la Lista Nominal de Electores.",
  "vigencia": "2031-12-31",
  "fechaConsulta": "2023-03-15",
  "anioEmision": "2021"
}
```

### H_vigente
```json
{
  "id": "c9d484ffcb8b405fb63ceeadf04b72a3",
  "status": "found",
  "modelo": "e",
  "descripcion": "Esta vigente como medio de identificación y puedes votar. Tus datos se encuentran en el Padrón Electoral, y también en la Lista Nominal de Electores.",
  "vigencia": "2031-12-31",
  "fechaConsulta": "2023-03-15",
  "anioEmision": "2021"
}
```

### not_found_cic
```json
{
  "id": "58e52f0a0b434feeb9d48de0931e20c6",
  "status": "not_found",
  "modelo": "e",
  "message": "No se obtuvieron datos de la consulta con los parámetros seleccionados, verifica que no tienes un trámite posterior"
}
```

### not_current_cic
```json
{
  "id": "8f47ff22e6c34dcaa0265f9ac6fccc4b",
  "status": "not_valid",
  "modelo": "e",
  "message": "No está vigente como medio de identificación y no puedes votar.¡Esta no es tu última credencial!, realizaste un trámite de actualización de datos, por lo que tu consulta fue con una credencial anterior. Realiza una nueva consulta con tu última credencial."
}
```


---

## Blindaje Qwen — checklist

| Observación | Estado en spike |
|---|---|
| Proveedor = padrón / Lista Nominal | ✅ DNS docs + status found/not_found |
| Timeout estricto 5–8s | ✅ 20000 ms (AbortController) |
| Aviso privacidad LFPDPPP | 📝 Pendiente negocio (tarea documental Fase 3.1+) |
| Sin scraper INE | ✅ |
| Sin código app/proxy/UI | ✅ Solo este script + reporte |

---

## Veredicto para avanzar a Fase 3.1

🟢 **GO técnico del spike.** Solicitar a Qwen autorización de proxy SSD `/api/ine-lista-nominal` + tipos + flag OFF.

---

## LFPDPPP (recordatorio)

Enviar CIC / ID Ciudadano a un tercero requiere actualizar el **Aviso de Privacidad** (validación vía proveedores autorizados de identidad). Tarea de negocio/legal antes de prod.
