# APO-FIELD-HANG — Registro se queda “pasmado”

**Estado:** 🟢 **FIX LISTO — pendiente commit/push**  
**Evidencia:** API prod `POST /api/affiliates/secure` → **201 en ~1s**. Hang = cliente (SW + sin timeout + `confirm` geo).

## Fix aplicado

| H | Cambio |
|---|--------|
| H.1 | SW `v3`: no intercepta `/api/` |
| H.2 | `acknowledgeIneSync`: AbortController 25s |
| H.3 | Geo: “Continuar sin ubicación” (sin `confirm` nativo) |
| H.4 | Campo: no espera `createUser`/email post-ACK |

**Tras deploy:** en el iPhone, cierra pestaña o “Actualizar sin contenido” una vez para tomar SW v3.
