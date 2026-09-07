# implementation_plan.md — Aviso de Privacidad LFPDPPP

**Estado:** En ejecución (requisito de negocio post Fase 3.3)  
**Alcance:** Incorporar Aviso de Privacidad en la App (contenido parametrizable + UI de lectura + consentimiento en registro)  
**Prohibido:** Activar `VITE_USE_LISTA_NOMINAL` sin GO explícito del dueño.

---

## APO — Grafo

```text
constants / privacyNoticeContent  ←── texto LFPDPPP (placeholders env)
views/PrivacyNoticeView.tsx       ←── lectura completa
App.tsx                           ←── ruta/pantalla privacy
LoginView + SelfRegistrationForm  ←── enlace + checkbox consentimiento
```

**Zero regressions:** registro sigue funcionando; sin consentimiento no se envía; flags LN intactas.
