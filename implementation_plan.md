# implementation_plan.md — Fix 404 assets en Vercel (SW stale)

**Síntoma:** `index-*.js` / `index-*.css` → 404 tras redeploy.  
**Causa:** `service-worker.js` precacheaba `/` e `index.html` (cache-first). El HTML viejo pide hashes que ya no existen en `/assets/`.

**Fix:**
1. Bump cache → `afiliados-cache-v2`; no precachear el shell HTML.
2. Navegación/document → network-first.
3. `vercel.json`: `Cache-Control: no-cache` para `/`, `index.html` y `service-worker.js`.
