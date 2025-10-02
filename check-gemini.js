import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 Verificando configuración de Gemini API...');

const envPath = path.join(process.cwd(), '.env.local');

if (!fs.existsSync(envPath)) {
    console.log('❌ No se encuentra el archivo .env.local');
    console.log('📝 Crea el archivo .env.local en la raíz del proyecto');
    process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const apiKeyMatch = envContent.match(/VITE_GEMINI_API_KEY=(.+)/);

if (!apiKeyMatch) {
    console.log('❌ No se encuentra VITE_GEMINI_API_KEY en .env.local');
    console.log('📝 Agrega: VITE_GEMINI_API_KEY=tu_api_key_aqui');
    process.exit(1);
}

const apiKey = apiKeyMatch[1].trim();

if (apiKey === 'tu_api_key_aqui' || apiKey === '') {
    console.log('❌ La API key no está configurada correctamente');
    console.log('📝 Reemplaza "tu_api_key_aqui" con tu API key real de Gemini');
    process.exit(1);
}

if (apiKey.length < 20) {
    console.log('❌ La API key parece ser demasiado corta');
    console.log('📝 Verifica que sea una API key válida de Google Gemini');
    process.exit(1);
}

console.log('✅ Archivo .env.local encontrado');
console.log('✅ Variable VITE_GEMINI_API_KEY configurada');
console.log('✅ API key parece válida (longitud correcta)');
console.log('');
console.log('🎉 ¡Configuración correcta! El OCR debería funcionar.');
console.log('🚀 Inicia el servidor con: npm run dev');
