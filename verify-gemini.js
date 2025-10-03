// Script para verificar que Gemini API funciona correctamente
// Ejecutar con: node verify-gemini.js

async function testGeminiAPI() {
  console.log('🔍 Verificando configuración de Gemini API...\n');

  // Leer el archivo .env.local
  const fs = await import('fs');
  const path = await import('path');

  const envPath = path.join(process.cwd(), '.env.local');

  if (!fs.existsSync(envPath)) {
    console.log('❌ No se encuentra el archivo .env.local');
    console.log('📝 Crea el archivo con: VITE_GEMINI_API_KEY=tu_api_key_aqui\n');
    process.exit(1);
  }

  const envContent = fs.readFileSync(envPath, 'utf8');
  const apiKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);

  if (!apiKeyMatch) {
    console.log('❌ No se encuentra VITE_GEMINI_API_KEY en .env.local');
    console.log('📝 Agrega la línea: VITE_GEMINI_API_KEY=tu_api_key_aqui\n');
    process.exit(1);
  }

  const apiKey = apiKeyMatch[1].trim();

  if (apiKey === 'tu_api_key_aqui' || apiKey === '') {
    console.log('❌ La API key no está configurada correctamente');
    console.log('📝 Reemplaza "tu_api_key_aqui" con tu API key real de Gemini\n');
    process.exit(1);
  }

  console.log('✅ Archivo .env.local encontrado');
  console.log('✅ Variable VITE_GEMINI_API_KEY configurada');
  console.log('✅ API key parece válida');

  // Probar la API
  console.log('\n🚀 Probando conexión con Gemini API...');

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro-vision:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: 'Responde solo con "OK" si puedes leerme correctamente.'
          }]
        }]
      })
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ API de Gemini funcionando correctamente!');
      console.log('📝 Respuesta:', data.candidates[0].content.parts[0].text);
      console.log('\n🎉 ¡Todo está listo! Inicia el servidor con: npm run dev');
    } else {
      console.log('❌ Error en la API de Gemini:', response.status, response.statusText);

      if (response.status === 400) {
        console.log('💡 Posible causa: API key inválida o problema en la solicitud');
      } else if (response.status === 403) {
        console.log('💡 Posible causa: API key no tiene permisos suficientes');
      } else if (response.status === 404) {
        console.log('💡 Posible causa: Endpoint incorrecto o modelo no disponible');
      }

      console.log('🔗 Verifica tu API key en: https://makersuite.google.com/app/apikey');
    }
  } catch (error) {
    console.log('❌ Error de conexión:', error.message);
    console.log('💡 Verifica tu conexión a internet');
  }
}

testGeminiAPI();
