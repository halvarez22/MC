# Spike 2.0 — Resultados Groq Vision INE

**Estado:** ⏳ Spike empírico aún sin tasas (≥90% no demostrado)  
**Código Fase 2:** 🟢 Aprobado por auditor (estructura + proxy SSD)  
**Activación `VITE_USE_GROQ_VISION`:** 🟠 **ON en local por override del dueño del producto** (asume riesgo; auditor pedía ≥90% antes)

> Regla 8: este archivo **no** contiene tasas inventadas. Solo se actualizará al correr el script con key e imágenes reales.

---

## Cómo generar este reporte (tú)

1. En [console.groq.com](https://console.groq.com) crea una API key válida.
2. En `.env.local` (o env de sesión):
   ```bash
   GROQ_API_KEY=gsk_tu_key_real
   ```
3. Copia el ejemplo de manifest y añade 5–10 pares INE en `fixtures/` (jpg ignorados por git):
   ```bash
   copy fixtures\manifest.example.json fixtures\manifest.json
   ```
4. Ejecuta batch A/B:
   ```bash
   node test-groq-vision-ine.js --manifest ./fixtures/manifest.json
   ```
5. Pega a Qwen el contenido **generado** de este archivo (se sobrescribe con tasas reales).

Guía: [`fixtures/README.md`](../../fixtures/README.md)

---

## Criterio de aprobación final (auditor)

| Requisito | Umbral |
|---|---|
| CURP + Nombre correctos | ≥ **90%** en la variante ganadora |
| Corpus | ≥ 5–10 INE |
| Ganador A vs B | Documentado aquí para ajustar orquestador |

Tras GO: autorizar `VITE_USE_GROQ_VISION=true` y plan de eliminación de `googleVisionService`.
