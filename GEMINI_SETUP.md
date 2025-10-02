# Configuración de Gemini AI para OCR

## Problema Actual
El sistema OCR requiere una API key de Google Gemini para funcionar correctamente.

## Solución
Sigue estos pasos para configurar la API key:

### 1. Obtener API Key de Gemini
1. Ve a [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Inicia sesión con tu cuenta de Google
3. Crea una nueva API key
4. Copia la API key generada

### 2. Configurar Variables de Entorno
Crea un archivo llamado `.env` en la raíz del proyecto con el siguiente contenido:

```env
# Gemini AI API Key
VITE_GEMINI_API_KEY=tu_api_key_aqui_sin_comillas
```

**Ejemplo:**
```env
VITE_GEMINI_API_KEY=AIzaSyD1234567890abcdefghijklmnopqrstuvw
```

### 3. Reiniciar el Servidor
Después de crear el archivo `.env`, reinicia el servidor de desarrollo:

```bash
# Detener el servidor actual (Ctrl+C)
npm run dev
```

### 4. Verificar Configuración
Una vez configurado correctamente, deberías ver en la consola:
- ✅ Sin mensajes de error sobre API key faltante
- ✅ OCR funcionando correctamente al capturar imágenes del INE

## Notas Importantes
- La API key debe tener el prefijo `VITE_` para que Vite la exponga al cliente
- La API de Gemini es gratuita con límites generosos para desarrollo
- No compartas tu API key en repositorios públicos
- El archivo `.env` ya está incluido en `.gitignore`

## Solución de Problemas
Si aún tienes errores:

1. **Error 400**: Verifica que la API key sea correcta
2. **API key not found**: Asegúrate de que el archivo `.env` esté en la raíz del proyecto
3. **Still not working**: Reinicia el servidor después de crear el archivo `.env`

¿Necesitas ayuda adicional con la configuración?
