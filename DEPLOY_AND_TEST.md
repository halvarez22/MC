# 🚀 DESPLIEGUE RÁPIDO Y PRUEBA EN MÓVIL

## ⚡ DESPLIEGUE EN 5 MINUTOS

### 1. Ve a Vercel
```
https://vercel.com
```

### 2. Importa el Proyecto
- **Conecta GitHub** (si no lo has hecho)
- **Busca el repo**: `halvarez22/MC`
- **Importa el proyecto**

### 3. Configura Variables de Entorno
En **Settings > Environment Variables**, agrega:

#### OBLIGATORIAS:
```
VITE_GROQ_API_KEY=tu_api_key_de_groq
```

#### ALTAMENTE RECOMENDADAS:
```
VITE_GOOGLE_VISION_API_KEY=tu_api_key_de_google_vision
```

### 4. ¡Deploy Automático!
Vercel detectará automáticamente:
- ✅ Vite framework
- ✅ Build command: `npm run build`
- ✅ Output: `dist/`
- ✅ SPA routing

**URL resultante:** `https://mc-app.vercel.app` (o similar)

---

## 📱 PRUEBA EN MÓVIL REAL (CRÍTICO)

### 🎯 Por qué probar en móvil:
- Las cámaras de móvil son **diferentes** a webcam de escritorio
- **Condiciones de iluminación** reales afectan enormemente
- **Ángulos y distancias** varían en campo
- **Procesamiento** puede ser más lento en móviles

### 📋 Checklist de Prueba:

#### 1. **Preparación:**
- [ ] Despliega la app en Vercel
- [ ] Accede desde móvil real (Chrome/Safari)
- [ ] Instala como PWA (botón "Añadir a pantalla de inicio")

#### 2. **Pruebas de OCR por Condición:**

##### ☀️ **LUZ SOLAR DIRECTA:**
- [ ] Toma foto de INE bajo sol intenso
- [ ] Verifica si OCR funciona
- [ ] Registra: ¿Texto legible? ¿Datos correctos?

##### ⛅ **DÍA NUBLADO:**
- [ ] Toma foto con luz difusa
- [ ] Compara con resultado anterior
- [ ] Registra precisión

##### 💡 **INTERIOR CON LUZ ARTIFICIAL:**
- [ ] Toma foto en oficina/sala
- [ ] Verifica funcionamiento básico
- [ ] Registra velocidad de procesamiento

##### 🌧️ **CONDICIONES ADVERSAS:**
- [ ] Documento ligeramente mojado
- [ ] Superficie polvorienta
- [ ] Ángulos no perfectos (30°, 45°)

#### 3. **Pruebas de Funcionalidad Completa:**

##### 📷 **FLUJO COMPLETO:**
- [ ] Login como brigadista
- [ ] Captura frontal del INE
- [ ] Captura posterior del INE
- [ ] Revisa texto OCR extraído
- [ ] Corrige si es necesario
- [ ] Verifica datos estructurados
- [ ] Confirma y guarda

##### 🔄 **MODO OFFLINE:**
- [ ] Desactiva internet en móvil
- [ ] Registra afiliado completo
- [ ] Verifica que se guarda localmente
- [ ] Reactiva internet y sincroniza

##### 📊 **DEBUG EN MÓVIL:**
Abre consola en móvil (Chrome DevTools) y ejecuta:
```javascript
// Verificar APIs configuradas
testGoogleVision()
debugImageQuality()

// Verificar estado del sistema
checkINEStatus()
```

---

## 📊 REGISTRO DE RESULTADOS

### 📝 Plantilla de Reporte:

```
CONDICIÓN: [Luz solar / Nublado / Interior / Adversas]
DISPOSITIVO: [Marca y modelo del móvil]
RESULTADO OCR: [Excelente / Bueno / Regular / Malo]
TEXTO LEGIBLE: [Sí/No] - Ejemplo: "INSTITUTO NACIONAL ELECTORAL"
DATOS EXTRAÍDOS: [Nombre: ✅, CURP: ✅, Estado: ❌, etc.]
TIEMPO PROCESAMIENTO: [X segundos]
PROBLEMAS ENCONTRADOS: [Lista específica]
```

### 🎯 Métricas Objetivas:
- **Tasa de éxito OCR**: % de fotos que producen texto legible
- **Precisión de datos**: % de campos correctamente extraídos
- **Velocidad**: Tiempo promedio de procesamiento
- **Facilidad de uso**: Comentarios de usabilidad

---

## 🛠️ SOLUCIÓN DE PROBLEMAS EN MÓVIL

### Si OCR no funciona en móvil:

#### 1. **Verificar APIs:**
```javascript
// En consola del móvil
testGoogleVision() // Debe decir "disponible: true"
```

#### 2. **Problemas de Cámara:**
- Asegúrate de **dar permisos de cámara**
- Prueba diferentes **ángulos y distancias**
- Evita **sombras** sobre el documento

#### 3. **Problemas de Rendimiento:**
- Móviles antiguos pueden ser lentos
- **Google Vision** puede requerir buena conexión
- **Tesseract** funciona offline pero es menos preciso

#### 4. **Debug Avanzado:**
```javascript
// Ver logs detallados
debugImageQuality() // Muestra análisis de calidad en tiempo real

// Ver estado del sistema
checkINEStatus() // Muestra INEs procesadas/pendientes
```

---

## 🎯 PRÓXIMOS PASOS DESPUÉS DE PRUEBAS

### Si los resultados son BUENOS (≥80% éxito):
1. ✅ **La app está lista para producción**
2. 📋 **Configurar brigadistas** con credenciales
3. 📊 **Monitorear métricas** en producción
4. 🚀 **¡Implementar en campo!**

### Si hay problemas específicos:
1. 🔧 **Ajustar umbrales** basados en datos reales
2. 📱 **Optimizar UI** para móviles
3. 🎯 **Mejorar instrucciones** para brigadistas
4. 🔄 **Iterar y mejorar**

---

## 📞 SOPORTE DURANTE PRUEBAS

**Comparte conmigo:**
- 📸 **Capturas de pantalla** de resultados OCR
- 📱 **Modelo del móvil** usado
- ☀️ **Condiciones de luz** durante la prueba
- 🐛 **Logs de error** de consola
- 📊 **Métricas** registradas

**¡Las pruebas en móvil real nos darán el feedback más valioso!** 🚀📱

---

**¿Ya desplegaste la app? ¿Necesitas ayuda con algún paso?**
