# E2E Zero-PII (D.1)

```bash
npm i
npx playwright install chromium
# Hooks de test: VITE_E2E_HOOKS=true (ya lo setea playwright.config webServer)
npm run test:e2e:zero-pii
```

Flujo: inserta CURP canario → ACK → tombstone → purge → IndexedDB sin CURP ni `data:image`; Object URLs tracked = 0.
