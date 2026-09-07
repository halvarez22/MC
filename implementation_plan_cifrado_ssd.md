# implementation_plan.md — Cifrado en reposo / SSD avanzado (protección ante extracción)

**Estado:** 🟡 **APROBADO CONDICIONALMENTE (Qwen)** — plan refinado con 4 restricciones; **prohibido código** hasta GO forense del documento  
**Autor:** Cursor Agent  
**Fecha:** 2026-09-07 (rev. post-dictamen Qwen)  
**Alcance autorizado al aprobar ejecución:** solo **C.0 → C.1 → C.2** (dispositivo de campo). **C.3+ diferido.**  
**Carta:** `.cursor/rules/industrial-charter.mdc` (Reglas 1–8, énfasis R2 Offline + R5 SSD)  
**Prerrequisitos:** Fases 0–3.3 🟢; Aviso LFPDPPP en App.  

**Promesa de negocio (honesta, acotada):**  
Un atacante que **extrae archivos raw** de IndexedDB (dispositivo apagado / disco clonado / backup de almacenamiento) **no** obtiene CURP, CIC ni fotos legibles.  
**No** prometemos inmunidad si el atacante controla la **memoria RAM** de un dispositivo desbloqueado en uso.

---

## 0. Mensaje para el cliente (no técnico)

| Qué sí | Qué no |
|---|---|
| Candado en los archivos guardados en la tablet | “Imposible hackear al 100%” |
| Si roban la tablet apagada y copian archivos, ven basura ilegible | Protección total si el ladrón usa la tablet desbloqueada mientras alguien trabaja |
| Borramos fotos locales tras sync OK | Que el proveedor LLM/Lista Nominal “no vea nunca nada” (eso es contrato/DPA aparte) |

---

## 1. Diagnóstico (evidencia de código) — sin cambio de hechos

```text
Captura INE / Registro
   ├─► IndexedDB INEOfflineDB     → texto + structured + fotos base64  [EN CLARO] ← prioridad C.2
   ├─► IndexedDB afiliadosDB      → ficha + dataUrl + geo               [EN CLARO] ← prioridad C.2
   ├─► firebaseService (mock)     → Affiliate                           [EN CLARO] ← C.3 diferido
   └─► Proxies HTTPS              → Vision / Lista Nominal
```

---

## 2. Respuestas a las 5 preguntas (directrices Qwen — vinculantes)

| # | Pregunta | Decisión auditor |
|---|---|---|
| 1 | ¿Dónde las llaves? | **C.2 cliente:** Web Crypto API, llave `extractable: false`, por dispositivo/usuario. **C.3 servidor (futuro):** AWS KMS o GCP KMS. |
| 2 | ¿Multi-tenant? | Diseñar asumiendo multi-organización; IndexedDB = llave **por dispositivo/usuario**. |
| 3 | ¿Buscar por CURP? | **SÍ (no negociable)** en nube futura → Blind Index HMAC o cifrado determinista (AES-SIV). En IndexedDB C.2: búsqueda **en memoria** tras descifrar (volumen local pequeño). |
| 4 | ¿Borrar fotos post-sync? | **SÍ.** Tras sync confirmado → `deleteImageData(id)`. |
| 5 | ¿Alcance? | **Solo C.0 + C.1 + C.2.** No mezclar C.3 (BD nube/KMS) ahora. |

---

## 3. Modelo de amenaza C.0 (restricción Qwen #1) — explícito

### 3.1 Protege contra

- Extracción de **archivos raw** / dump de IndexedDB / backup de almacenamiento del dispositivo **sin** sesión activa controlada.  
- Dispositivo robado **apagado** o almacenamiento clonado offline.  
- Lectura casual de DevTools “Export” de object stores en claro (post-migración).

### 3.2 NO protege contra (diligencia debida documentada)

- Atacante con acceso a **RAM** de dispositivo **desbloqueado** mientras la app tiene la CryptoKey en uso.  
- Malware/keylogger en el SO del brigadista.  
- Phishing + sesión válida del operador.  
- Compromiso del origen web + XSS que abuse de Web Crypto en el mismo origin (mitigar con CSP/XSS hygiene — fuera de C.2 core).

### 3.3 Por qué no KMS en cada operación IndexedDB

KMS online en cada encrypt/decrypt **rompe offline (Regla 2 HRU)**.  
Por tanto C.2 **no** llama a AWS/GCP KMS en caliente; usa Web Crypto local.

---

## 4. Estrategia de llaves cliente C.1/C.2 (restricción Qwen #2)

### 4.1 Obligatorio

- API: **`crypto.subtle` (Web Crypto API)** únicamente para operaciones de cifrado de campos.  
- Algoritmo de contenido: **AES-GCM** (256).  
- Generación: `crypto.subtle.generateKey(..., extractable: false, ...)`.  
- Persistencia de la llave: vía **`crypto.subtle.exportKey`/`wrapKey` solo si es necesario para sobrevivir reload** — preferir **non-extractable** + almacenamiento en IndexedDB como **CryptoKey** (structured clone de CryptoKey donde el motor lo permita) o **wrap** con una KEK derivada.

### 4.2 Opción de endurecimiento UX (documentada, decisión en C.1 spike)

- **A (mínima):** llave origin-bound generada al primer uso, `extractable: false`.  
- **B (recomendable campo):** derivar KEK con **PBKDF2** (o Argon2 vía WASM si se aprueba) desde **PIN del brigadista** + salt por dispositivo; con esa KEK hacer `wrapKey` de la DEK. Sin PIN no hay unwrap offline.

### 4.3 Prohibido

- Librerías que dejen la llave en **string/hex en variables globales** o `localStorage` en claro.  
- Master key en `VITE_*`.  
- Enviar la DEK al servidor en C.2.

### 4.4 Contrato de blob

```ts
EncryptedBlob {
  enc_v: 1;
  alg: 'AES-GCM';
  iv: base64;
  ciphertext: base64;
  // keyId local (uuid de DEK en keystore IndexedDB)
  keyId: string;
}
```

Flag Strangler: `VITE_USE_FIELD_ENCRYPTION=false` (default).

---

## 5. Búsqueda por CURP — preparación C.3 (restricción Qwen #3)

AES-GCM probabilístico **rompe** `WHERE curp = ?`.

| Capa | Estrategia |
|---|---|
| **C.2 IndexedDB** | Descifrar registros locales en memoria y filtrar (OK para N pequeño). |
| **C.3 Nube (futuro, solo documentar ahora)** | Mantener `curp_blind` = HMAC-SHA256(CURP, blindKey) indexable, **o** cifrado determinista AES-SIV del CURP. El plaintext CURP sigue cifrado por separado (AES-GCM) para lectura. |

C.1/C.2 **no implementan** blind index en servidor; el plan deja el requisito atado para no rediseñar la BD después.

---

## 6. Limpieza post-sync (restricción Qwen #4)

En el flujo `useSyncOffline` / `markINEAsProcessed` (cuando la confirmación de persistencia servidor/mock exitosa esté clara):

1. Sync OK confirmado.  
2. Invocar **`deleteImageData(pendingId)`** — elimina `imageDataFrontal` / `imageDataPosterior` (y equivalentes dataUrl) del store IndexedDB.  
3. Conservar metadatos mínimos necesarios para reintento de texto/structured **solo si** política de negocio lo exige; por defecto **borrar también structured sensible** tras sync OK (definir en C.2: fotos = obligatorio borrar; structured = recomendado).

U-First: si `deleteImageData` falla, log de warning + **Reintentar limpieza**; no bloquear al brigadista en captura nueva.

---

## 7. APO — Grafo (alcance C.0–C.2 únicamente)

```text
C.0  docs amenaza + promesa acotada
C.1  services/cryptoService.ts (Web Crypto, extractable:false)
       + types EncryptedBlob
       + flag OFF
C.2  ineOfflineService + offlineService
       → encrypt at write / decrypt at read
       → migración o invalidación de claros
       → deleteImageData post-sync en useSyncOffline
[STOP]  no firebase real, no KMS servidor, no blind index cloud
```

---

## 8. Fases ejecutable (post-GO del plan)

### C.0 — Documental
- Publicar `docs/auditoria/spike-cifrado-amenazas.md` con §3 de este plan.  
- Alinear texto del Aviso (“cifrado en reposo en dispositivo; límite RAM”).

### C.1 — `cryptoService`
- Solo módulo + tests sintéticos (sin PII real).  
- Spike round-trip ≥90%.  
- Flag `false` en `.env.example`.

### C.2 — IndexedDB
- Cablear stores INE + afiliados offline.  
- `deleteImageData` en path sync exitoso.  
- Dump simulado: CURP/fotos no legibles con flag ON.

### C.3 — Persistencia de Llaves con PIN (Key Wrapping)

**Estado:** 🟢 Implementación lógica (sin UI PIN = C.4)

**Artefactos:**
- `services/keyPersistenceStore.ts` — IndexedDB `KeyStore`
- `services/fieldEncryptionSession.ts` — `persistSessionKey` / `restoreSessionKey` / `initFieldEncryptionLockState` / `InvalidPinError`
- `types.KeyPersistenceConfig` — incluye `deviceId`, `salt`, `wrappedKey`
- `App.tsx` — probe al montar + `clearSessionKeyFromMemory` en logout

**Flujo:**

1. Usuario ingresa PIN (UI = C.4; aquí solo API).
2. Se deriva KEK vía PBKDF2 (210k) — `deriveKeyFromPin`.
3. `wrapKeyWithPin` → `wrappedKey` Base64; salt reutilizado o nuevo.
4. Guardar `KeyPersistenceConfig` en IndexedDB (nunca PIN ni DEK clara).
5. Reload → `needsPinUnlock: true` → `restoreSessionKey(pin)` → unwrap `extractable: false`.
6. PIN incorrecto → `InvalidPinError`.

**Limitación documentada:** tras `restore` la DEK es no extractable; un segundo `persistSessionKey` sobre esa misma instancia puede fallar (cambio de PIN = C.4+). Primera persistencia usa `generateWrappableKey`.

**Prohibido hasta C.4:** pantalla de ingreso de PIN. Flag sigue `false` en `.env.example`.

### C.4 — **FUERA DE ESTE CICLO**
- KMS, multi-tenant DEK cloud, blind index CURP, rotación — nuevo GO.

---

## 9. Criterios de aceptación (GO de implementación C.1–C.2)

- [x] Este documento aprobado forense por Qwen (4 restricciones presentes).  
- [x] Modelo de amenaza §3 explícito (raw sí / RAM no).  
- [x] Web Crypto + `extractable: false` especificado; prohibido key en claro en JS globals.  
- [x] Blind index / AES-SIV documentado para C.3 (no implementado aún).  
- [x] `deleteImageData` / `deleteSensitiveData` en path sync.  
- [x] Alcance limitado a C.0–C.2.  
- [x] C.1 + C.2 implementadas y 🟢 APROBADAS por Qwen.

---

## 10. Estado

**🟢 CICLO C CERRADO (C.0–C.4 APROBADAS DEFINITIVAS — Qwen).**  
**Artefactos C.4:** `PinUnlockModal`, `PinSetupModal`, `useFieldEncryptionLock`, gate en `App.tsx`.  
**Activación:** solo con GO de negocio → `VITE_USE_FIELD_ENCRYPTION=true` (Vercel + local). Default sigue `false`.  
**Negocio:** Aviso LFPDPPP + Key sandbox DNS 🟢.
