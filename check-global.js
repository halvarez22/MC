// Script para verificar que la variable global se está definiendo
// Ejecutar después de que el servidor esté corriendo

setTimeout(() => {
  console.log('🔍 Verificando variable global VITE_GEMINI_API_KEY...');

  const apiKey = (window as any)?.VITE_GEMINI_API_KEY;
  console.log('API Key encontrada:', apiKey ? '✅ Sí' : '❌ No');
  console.log('Valor:', apiKey || 'undefined');

  if (apiKey) {
    console.log('✅ Variable global configurada correctamente');
    console.log('🎉 El OCR debería funcionar ahora!');
  } else {
    console.log('❌ Variable global no encontrada');
    console.log('💡 Reinicia el servidor: npm run dev');
  }
}, 1000);
