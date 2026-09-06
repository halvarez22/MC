# 🐛 GUÍA DE DEBUG EN PRODUCCIÓN

## 🎯 FLUJO: ERROR EN PRODUCCIÓN → FIX → REDEPLOY

### 📱 CUANDO ENCUENTRES UN ERROR EN MÓVIL

#### 1. **Captura Información del Error**
```javascript
// Abre DevTools en móvil (Chrome: ⋮ > Más herramientas > Herramientas para desarrolladores)

// 1. COPIA LOS LOGS DE CONSOLA
// Busca mensajes de error en rojo
console.log('ERROR ENCONTRADO:', error_details);

// 2. EJECUTA FUNCIONES DE DIAGNÓSTICO
testGoogleVision()        // Estado de APIs
checkINEStatus()          // Estado del sistema
debugImageQuality()       // Análisis de imagen

// 3. CAPTURA PANTALLA
// - Pantalla completa del error
// - Consola de DevTools abierta
// - Información del dispositivo
```

#### 2. **Reporta el Error (Plantilla)**
```
🚨 ERROR REPORTADO

📱 DISPOSITIVO:
- Modelo: [ej: Samsung Galaxy S21]
- SO: [ej: Android 13]
- Navegador: [ej: Chrome 120.0.6099.109]

🌐 CONDICIÓN:
- Ubicación: [ej: Exterior, luz solar]
- Conexión: [ej: 4G / WiFi / Offline]

🐛 ERROR:
- Qué pasó: [Descripción clara]
- Pantalla donde ocurre: [ej: OCR Review]
- Pasos para reproducir: [1. Tomar foto, 2. Procesar, 3. Error]

📊 LOGS:
[Pega aquí los logs de consola]

🖼️ EVIDENCIA:
[Adjunta screenshots del error y consola]
```

---

## 🔧 MI LADO: RESOLVER Y REDEPLOYAR

### **FASE 1: ANÁLISIS (5 min)**
```bash
# 1. Recibo tu reporte
# 2. Reproduzco localmente si es posible
# 3. Identifico la causa del error
```

### **FASE 2: FIX (10-30 min)**
```bash
# Implemento la solución
git add .
git commit -m "fix: [descripción del error]"
git push origin main
```

### **FASE 3: DEPLOY AUTOMÁTICO**
- Vercel detecta el push automáticamente
- Build toma ~2-3 minutos
- Deploy está listo para probar

### **FASE 4: VERIFICACIÓN**
- Te notifico: "✅ Fix desplegado en [URL]"
- Tú pruebas en móvil
- Confirmas que funciona

---

## 📞 CANALES DE COMUNICACIÓN

### **Rápido (Errores Críticos):**
- **WhatsApp/Telegram** con screenshots
- **Llamada** para debug en tiempo real

### **Detallado (Análisis Completo):**
- **GitHub Issues** con template completo
- **Email** con logs adjuntos

### **Monitoreo Continuo:**
- **Dashboard Vercel** para ver errores en producción
- **Analytics** para métricas de uso

---

## 🛠️ HERRAMIENTAS PARA DEBUG EN PRODUCCIÓN

### **En Móvil (Tú):**
```javascript
// FUNCIONES DISPONIBLES EN CONSOLA:

// 1. DIAGNÓSTICO GENERAL
testGoogleVision()     // APIs funcionando?
checkINEStatus()       // Estado del sistema
debugImageQuality()    // Análisis de imagen

// 2. LOGS DETALLADOS
// Abre DevTools > Console
// Copia cualquier error en rojo

// 3. DATOS DEL SISTEMA
console.log('User Agent:', navigator.userAgent);
console.log('Online:', navigator.onLine);
console.log('Screen:', screen.width + 'x' + screen.height);
```

### **En Vercel (Yo):**
- **Logs de Build** - Ver errores de compilación
- **Runtime Logs** - Ver errores en producción
- **Analytics** - Métricas de uso y rendimiento
- **Error Tracking** - Alertas automáticas

---

## 🚨 PROTOCOLO DE ERRORES CRÍTICOS

### **Si la app NO CARGA:**
1. **Tú:** Captura screenshot del error
2. **Tú:** Copia URL exacta y mensaje de error
3. **Comunica:** "App no carga - [screenshot]"
4. **Yo:** Fix inmediato + redeploy en 10 min

### **Si OCR no funciona:**
1. **Tú:** Ejecuta `debugImageQuality()` en consola
2. **Tú:** Toma foto problemática y anota condiciones
3. **Comunica:** "OCR falla en [condición] - logs: [pega logs]"
4. **Yo:** Ajusto algoritmos + redeploy en 15 min

### **Si datos se pierden:**
1. **Tú:** Ejecuta `checkINEStatus()` para ver estado
2. **Comunica:** "Datos perdidos - [estadísticas]"
3. **Yo:** Fix de sincronización + redeploy en 20 min

---

## 📊 SEGUIMIENTO DE FIXES

### **Template de Confirmación:**
```
✅ FIX APLICADO

🐛 ERROR: [Descripción breve]
🔧 SOLUCIÓN: [Qué se cambió]
🚀 DEPLOY: [URL de producción]
🧪 PRUEBA: [Cómo verificar que funciona]

¿Confirma que el fix funciona?
```

### **Métricas de Éxito:**
- **Tiempo promedio de resolución:** < 30 minutos
- **Tasa de fixes exitosos:** > 95%
- **Tiempo de downtime:** Mínimo (deploy automático)

---

## 🎯 ESTRATEGIA DE MONITOREO

### **Semanal:**
- Revisar logs de error en Vercel
- Métricas de uso por brigadista
- Feedback de UX en campo

### **Por Error:**
- Análisis root cause
- Implementación de fix
- Verificación en producción
- Documentación para prevenir futuros

---

## 💡 TIPS PARA REPORTAR ERRORES

### **Buen Reporte:**
```
🚨 ERROR: OCR no funciona en luz solar

📱 iPhone 12, iOS 17, Safari
🌐 Exterior, sol intenso, 4G
🐛 Después de tomar foto, pantalla queda en blanco

LOGS:
[Vision API error: timeout]
[Processing failed at step 3]

SCREENSHOTS:
[adjunto: pantalla_error.jpg]
[adjunto: consola_logs.jpg]
```

### **Mal Reporte:**
```
"No funciona"
```

**¡Con este sistema, podemos resolver problemas en minutos, no días!** 🚀

**¿Listo para el primer deploy y prueba en campo?** 📱✨

