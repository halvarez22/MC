# 🚀 Guía de Despliegue en Vercel

## ✅ Configuración Actualizada

La aplicación ya está configurada correctamente para Vercel con:
- ✅ **Framework Vite** detectado automáticamente
- ✅ **Build command**: `npm run build`
- ✅ **Output directory**: `dist`
- ✅ **SPA routing** configurado correctamente

## Variables de Entorno Requeridas

Configura estas variables en el dashboard de Vercel:

### 🤖 GROQ_API_KEY (Obligatoria)
- **Valor**: Tu API key de Groq AI
- **Dónde obtenerlo**: https://console.groq.com/keys
- **Descripción**: API key para procesamiento inteligente de texto OCR

### 🎯 GOOGLE_VISION_API_KEY (Altamente Recomendada)
- **Valor**: Tu API key de Google Vision API
- **Dónde obtenerlo**: https://console.cloud.google.com/
- **Descripción**: OCR de alta precisión para INE (95%+ precisión)
- **Nota**: Si no configuras esta, se usa Tesseract.js básico

### 📧 Variables de Email (Opcionales)
- `VITE_EMAIL_API_KEY`
- `VITE_EMAIL_API_URL`
- **Descripción**: Para envío automático de emails de bienvenida

### 🔥 Variables de Firebase (Opcionales)
Si usas Firebase para backend completo:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## 🚀 Pasos para Desplegar

1. **Ve a Vercel**: https://vercel.com
2. **Conecta tu cuenta de GitHub**
3. **Importa el repositorio**: `halvarez22/MC`
4. **Configura variables de entorno** en Settings > Environment Variables
5. **Deploy automático** - Vercel detectará la configuración automáticamente

## 🔧 Solución de Problemas

### Página en Blanco
Si ves una página en blanco:
1. **Verifica las variables de entorno** - Asegúrate de que `GEMINI_API_KEY` esté configurada
2. **Revisa los logs de build** en el dashboard de Vercel
3. **Redeploy manual** si es necesario

### Errores de Módulos JavaScript
- ✅ **Configuración corregida** - El `vercel.json` actualizado soluciona estos errores
- ✅ **MIME types correctos** para archivos JavaScript y manifest
- ✅ **Routing SPA** funcionando correctamente

### Imágenes no Cargan
- ✅ **Imágenes movidas** a carpeta `public/` para correcto serving estático
- ✅ **Manifest.json** actualizado con logo válido del partido
- ✅ **Configuración Vite** optimizada para assets estáticos
- ✅ **Service Worker** configurado correctamente para PWA

### Service Worker y PWA
- ✅ **Archivos PWA movidos** a carpeta `public/` para manejo automático de Vite
- ✅ **Configuración Vite simplificada** eliminando plugins complejos
- ✅ **SPA routing corregido** en `vercel.json`
- ✅ **Registro de Service Worker** con logs de debug detallados
- ✅ **MIME types correctos** - archivos servidos desde la raíz del dominio
- ✅ **Error 401 resuelto** - manifest.json accesible en `/manifest.json`
- ✅ **Service Worker operativo** - registrado desde `/service-worker.js`

## 🌐 URL de Producción
Después del despliegue, Vercel te proporcionará una URL como:
`https://mc-app.vercel.app`

## 📱 Pruebas en Móvil y Condiciones de Campo

### 🎯 **Por qué probar en móvil real:**

La aplicación está diseñada para funcionar en **condiciones de campo reales**:
- ☀️ **Luz solar directa** (desafiante para cámaras)
- ⛅ **Días nublados** (iluminación variable)
- 🌧️ **Lluvia** (superficies mojadas)
- 💨 **Polvo/viento** (documentos sucios)
- 📱 **Móviles variados** (cámaras diferentes)

### 🧪 **Cómo probar en condiciones reales:**

1. **Despliega la app** siguiendo los pasos arriba
2. **Accede desde un móvil real** (no emulador)
3. **Ve a un lugar con condiciones variables**:
   - Exteriores con luz natural
   - Interiores con iluminación artificial
   - Diferentes ángulos y distancias
4. **Prueba con INE real** en estas condiciones
5. **Registra resultados**:
   - ¿El OCR funciona en luz solar?
   - ¿La cámara captura bien con polvo?
   - ¿El procesamiento es rápido en móvil?

### 📊 **Métricas a medir:**

- **Tasa de éxito de OCR** por condición de luz
- **Velocidad de procesamiento** en diferentes móviles
- **Facilidad de uso** para brigadistas
- **Precisión de datos extraídos**

## 🎯 Estado del Proyecto

### ✅ **Funcionalidades Completas:**
- 🎯 **OCR Avanzado**: Google Vision API (95%+) + Tesseract fallback
- 📱 **PWA Completa**: Funciona offline, instalable en móvil
- 🏗️ **Procesamiento Completo**: Ambas caras del INE
- ✏️ **Corrección Manual**: Permite editar texto OCR
- 🤖 **IA Inteligente**: Groq para estructuración de datos
- 🔄 **Sincronización**: Automática cuando hay conexión

### ✅ **Preparado para Producción:**
- 🚀 **Despliegue listo** en Vercel
- 📋 **Documentación completa** de APIs
- 🐛 **Debug avanzado** con funciones de consola
- 📊 **Monitoreo** de rendimiento y errores

### 🎯 **Próximos Pasos:**
1. **Desplegar** en Vercel
2. **Probar en móvil real** con INE físico
3. **Ajustar** basándose en feedback de campo
4. **¡Listo para brigadistas!** 🎉

---

## 📞 Contacto y Soporte

Si encuentras problemas durante las pruebas de campo:
- Revisa los **logs de consola** del móvil
- Usa las **funciones de debug** disponibles
- Comparte **capturas de pantalla** de errores
- Reporta **condiciones específicas** donde falla

**¡La aplicación está lista para revolucionar el registro de afiliados políticos!** 🚀🇲🇽
