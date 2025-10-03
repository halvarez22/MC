#!/usr/bin/env node

// Script para configurar las APIs necesarias para el OCR
// Ejecutar con: node setup-apis.js

console.log('🚀 Configuración de APIs para OCR de INEs');
console.log('=' .repeat(50));

console.log('\n📋 APIs necesarias:');
console.log('1. Groq AI (para estructuración de texto)');
console.log('2. Google Gemini (opcional, para respaldo)');

console.log('\n🔑 Paso 1: Obtener API Key de Groq');
console.log('   1. Ve a: https://console.groq.com/');
console.log('   2. Regístrate y crea una API Key');
console.log('   3. Copia la clave');

console.log('\n🔑 Paso 2: Configurar archivo .env.local');
console.log('   Crea el archivo .env.local en la raíz del proyecto:');

console.log(`
# .env.local
VITE_GROQ_API_KEY=tu_clave_de_groq_aqui
VITE_GEMINI_API_KEY=tu_clave_de_gemini_aqui  # opcional
`);

console.log('\n⚙️ Paso 3: Reiniciar el servidor');
console.log('   npm run dev');

console.log('\n✅ Paso 4: Verificar funcionamiento');
console.log('   Abre la app → Afiliados → Crear Nuevo → Capturar INE');
console.log('   Deberías ver el procesamiento con Tesseract + Groq');

console.log('\n🎯 Características del sistema:');
console.log('   ✅ OCR offline con Tesseract.js');
console.log('   ✅ Estructuración con Groq AI (si hay internet)');
console.log('   ✅ Sincronización automática offline');
console.log('   ✅ Compatible con PWA y móviles');

console.log('\n💡 Notas importantes:');
console.log('   - Tesseract funciona 100% offline');
console.log('   - Groq procesa datos cuando hay conexión');
console.log('   - Los datos se guardan localmente si no hay internet');
console.log('   - Se sincronizan automáticamente al recuperar conexión');

console.log('\n🔗 Enlaces útiles:');
console.log('   Groq Console: https://console.groq.com/');
console.log('   Documentación Tesseract: https://tesseract.projectnaptha.com/');
console.log('   Documentación Groq: https://console.groq.com/docs');

console.log('\n' + '='.repeat(50));
console.log('¡Configura tus APIs y comienza a escanear INEs! 📱📷');
