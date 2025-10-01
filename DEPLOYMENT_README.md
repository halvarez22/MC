# 🚀 Guía de Despliegue en Vercel

## Variables de Entorno Requeridas

Para desplegar correctamente la aplicación en Vercel, configura estas variables de entorno:

### 1. GEMINI_API_KEY
- **Valor**: Tu API key de Gemini AI
- **Dónde obtenerlo**: https://aistudio.google.com/app/apikey
- **Descripción**: API key para funcionalidades de IA

### 2. Variables de Firebase (Opcionales)
Si usas Firebase, configura estas variables en Vercel:
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`

## Pasos para Desplegar

1. **Conecta tu repositorio de GitHub a Vercel**
2. **Configura las variables de entorno** en el dashboard de Vercel
3. **Haz deploy** - Vercel detectará automáticamente la configuración

## URL de Producción
Después del despliegue, Vercel te proporcionará una URL como:
`https://mc-app.vercel.app`

¡La aplicación estará lista para que el equipo de campo la evalúe! 🎯
