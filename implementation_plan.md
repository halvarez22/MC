# implementation_plan.md — Auth: exigir login en cada visita

**Diagnóstico:** el mock persistía `firebase.auth.user` en `localStorage` → restauraba `admin` sin LoginView.

**Cambio:** sesión solo en `sessionStorage` (+ limpieza de la clave legacy en `localStorage`).
- Cerrar pestaña / nueva visita → pide login.
- F5 en la misma pestaña → mantiene sesión (U-First en campo).

**Archivos:** `services/authSessionStore.ts` (nuevo), `firebaseService.ts`, `App.tsx`, `index.tsx`.
