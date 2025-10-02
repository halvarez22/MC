// Script de prueba para verificar la API key de Gemini
// Ejecutar con: node test-gemini.js

const API_KEY = process.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
    console.error('❌ ERROR: VITE_GEMINI_API_KEY no encontrada');
    console.log('Asegúrate de tener el archivo .env.local con tu API key');
    process.exit(1);
}

console.log('🔍 Probando API key de Gemini...');

fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${API_KEY}`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
    },
    body: JSON.stringify({
        contents: [{
            parts: [{
                text: 'Responde solo con "OK" si puedes leerme.'
            }]
        }]
    })
})
.then(response => {
    if (response.ok) {
        return response.json();
    } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
})
.then(data => {
    console.log('✅ API key operativa!');
    console.log('📝 Respuesta de Gemini:', data.candidates[0].content.parts[0].text);
    console.log('🎉 ¡El OCR debería funcionar correctamente!');
})
.catch(error => {
    console.error('❌ Error con la API key:', error.message);
    console.log('💡 Verifica que tu API key sea correcta en .env.local');
    console.log('🔗 Obtén tu key en: https://makersuite.google.com/app/apikey');
});
