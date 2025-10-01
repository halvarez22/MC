# 🚀 Guía de Despliegue en Vercel

## ✅ Configuración Actualizada

La aplicación ya está configurada correctamente para Vercel con:
- ✅ **Framework Vite** detectado automáticamente
- ✅ **Build command**: `npm run build`
- ✅ **Output directory**: `dist`
- ✅ **SPA routing** configurado correctamente

## Variables de Entorno Requeridas

Configura estas variables en el dashboard de Vercel:

### 🔑 GEMINI_API_KEY (Obligatoria)
- **Valor**: Tu API key de Gemini AI
- **Dónde obtenerlo**: https://aistudio.google.com/app/apikey
- **Descripción**: API key para funcionalidades de IA

### 🔥 Variables de Firebase (Opcionales)
Si usas Firebase, configura estas variables:
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

## 🌐 URL de Producción
Después del despliegue, Vercel te proporcionará una URL como:
`https://mc-app.vercel.app`

## 🎯 Estado del Proyecto
- ✅ **Código listo** para producción
- ✅ **Configuración Vercel** actualizada y probada
- ✅ **Repositorio**: https://github.com/halvarez22/MC
- ✅ **Último commit**: Configuración SPA corregida

¡La aplicación estará lista para evaluación del equipo de campo! 🎉
