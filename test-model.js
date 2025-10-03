// Script simple para verificar que el modelo existe
// Ejecutar: node test-model.js

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando que el modelo gemini-1.0-pro-vision existe...');

const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
  console.log('❌ No se encuentra el archivo .env.local');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);

if (!apiKeyMatch) {
  console.log('❌ No se encuentra VITE_GEMINI_API_KEY en .env.local');
  process.exit(1);
}

const apiKey = apiKeyMatch[1].trim();

// Verificar que el modelo existe (sin enviar imagen, solo metadata)
console.log('Probando gemini-1.0-pro-vision...');
fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro-vision?key=${apiKey}`)
  .then(response => {
    if (response.ok) {
      console.log('✅ Modelo gemini-1.0-pro-vision existe y es accesible');
      console.log('🎉 ¡El modelo está disponible para OCR!');
      return response.json();
    } else {
      console.log(`❌ gemini-1.0-pro-vision: Error ${response.status}: ${response.statusText}`);
      console.log('Probando gemini-1.0-pro...');
      return fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro?key=${apiKey}`)
        .then(response2 => {
          if (response2.ok) {
            console.log('✅ Modelo gemini-1.0-pro existe y es accesible');
            console.log('❌ Pero NO tiene visión - no sirve para OCR');
            console.log('💡 Necesitas habilitar Generative Language API en Google Cloud Console');
            return response2.json();
          } else {
            console.log(`❌ gemini-1.0-pro: Error ${response2.status}: ${response2.statusText}`);
            console.log('💡 API key no tiene acceso o Generative Language API no está habilitada');
            throw new Error(`API Error: ${response2.status}`);
          }
        });
    }
  })
  .then(data => {
    if (data) {
      console.log('📋 Información del modelo:', {
        name: data.name,
        description: data.description,
        version: data.version
      });
    }
  })
  .catch(error => {
    console.log('❌ Error de conexión:', error.message);
  });
