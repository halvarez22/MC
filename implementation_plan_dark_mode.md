# Plan — Modo oscuro (UX)

**Estado:** Aprobado por dueño del producto (solicitud explícita)  
**Fecha:** 2026-09-06

## Grafo de impacto

```text
themeService + useTheme
  → ThemeToggle
      → Header (admin)
      → FieldView (brigadista)
      → LoginView
  → class `dark` en <html>
  → Tailwind darkMode: 'class'
  → shells: Layout, Card, Input, Modal, index.css tablas
```

## Decisiones

- Persistencia: `localStorage` clave `mc.theme` (`light` | `dark`)
- Sin hardcoding de preferencia en UI: servicio + hook
- FOUC: script mínimo en `index.html` antes de React
- Default: `light` (marca naranja); el usuario elige

## Fuera de alcance

- No tocar pipeline OCR/Groq
- No refactor masivo de todas las vistas internas; shells + primitivos UI
