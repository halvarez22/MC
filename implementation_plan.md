# implementation_plan.md — APO-OCR HTTP 500 forense

**Dictamen (evidencia cruda Vercel Logs):** NO es key faltante como causa del 500 actual.

```
ERR_MODULE_NOT_FOUND: Cannot find module '/var/task/api/groqIneCore'
imported from /var/task/api/groq-ine.js
x-vercel-error: FUNCTION_INVOCATION_FAILED
```

Con `"type": "module"` en `package.json`, Node ESM exige extensión en imports relativos.  
El proxy cae **antes** de leer `GROQ_API_KEY` → body `text/plain` genérico (coincide con UI).

## Acciones (solo proxy; D.1/D.2/autocaptura intocados)

1. Imports ESM con `.js`: `groq-ine`, `ine-lista-nominal`, `affiliates/secure`
2. Default modelo → `qwen/qwen3.8-27b` (3.6 → 404 en cuenta demo)
3. Env ya en Vercel Production: `GROQ_API_KEY` (demo) + `GROQ_VISION_MODEL=qwen/qwen3.8-27b`
4. Redeploy + smoke POST `/api/groq-ine` → 400 (falta frontal), no 500 MODULE_NOT_FOUND

## STOP

Sin compresión frontend, sin tocar D.1/D.2/autocaptura.
