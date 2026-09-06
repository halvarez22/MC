// Script para probar la detección de calidad de imagen
// Ejecutar desde consola del navegador con: testQualityDetection()

console.log('🧪 PRUEBA DE DETECCIÓN DE CALIDAD DE IMAGEN - AJUSTE 1');
console.log('==========================================');

function simulateImageQuality(avgBrightness, stdDev, darkRatio, brightRatio) {
    const coefficientOfVariation = avgBrightness > 0 ? (stdDev / avgBrightness) : 0;

    // NUEVOS UMBRALES MÁS PERMISIVOS
    const isBlurred = coefficientOfVariation < 0.05 || stdDev < 10;
    const isTooDark = avgBrightness < 70 || darkRatio > 0.75;
    const isTooBright = avgBrightness > 220 || brightRatio > 0.75;
    const hasDocumentFeatures = stdDev > 15 && stdDev < 120 && coefficientOfVariation > 0.08 && coefficientOfVariation < 0.8;

    // Simular detección de inclinación (gradientes)
    const edgeRatio = 1.2; // Valor simulado normal
    const isTilted = edgeRatio > 1.5 || edgeRatio < 0.7;

    const isWellPositioned = hasDocumentFeatures && !isTilted && !isTooDark && !isTooBright;

    return {
        avgBrightness,
        stdDev,
        coefficientOfVariation,
        darkRatio,
        brightRatio,
        edgeRatio,
        qualityResult: {
            isBlurred,
            isTooDark,
            isTooBright,
            isTilted,
            isWellPositioned
        }
    };
}

// Casos de prueba basados en escenarios reales
const testCases = [
    {
        name: "INE bien tomada (condición ideal)",
        params: [140, 45, 0.25, 0.25] // avgBrightness, stdDev, darkRatio, brightRatio
    },
    {
        name: "INE en ambiente oscuro",
        params: [60, 30, 0.4, 0.1]
    },
    {
        name: "INE con poca luz (debería aceptar ahora)",
        params: [80, 20, 0.5, 0.1]
    },
    {
        name: "INE sobreexpuesta",
        params: [200, 40, 0.1, 0.4]
    },
    {
        name: "INE muy sobreexpuesta (debería aceptar ahora)",
        params: [230, 35, 0.05, 0.6]
    },
    {
        name: "INE ligeramente borrosa (debería aceptar ahora)",
        params: [120, 12, 0.3, 0.2]
    },
    {
        name: "INE muy borrosa (debería rechazar)",
        params: [110, 8, 0.35, 0.25]
    }
];

console.log('📊 RESULTADOS DE PRUEBAS:');
console.log('');

testCases.forEach((testCase, index) => {
    const result = simulateImageQuality(...testCase.params);
    const quality = result.qualityResult;

    console.log(`${index + 1}. ${testCase.name}`);
    console.log(`   📈 avgBrightness: ${result.avgBrightness}, stdDev: ${result.stdDev.toFixed(1)}, coefVar: ${result.coefficientOfVariation.toFixed(3)}`);
    console.log(`   🌑 darkRatio: ${result.darkRatio}, ☀️ brightRatio: ${result.brightRatio}`);
    console.log(`   ✅ Aceptada: ${!quality.isBlurred && !quality.isTooDark && !quality.isTooBright && !quality.isTilted}`);
    console.log(`   ⚠️  Problemas: ${[
        quality.isBlurred ? 'Borrosa' : '',
        quality.isTooDark ? 'Oscura' : '',
        quality.isTooBright ? 'Brillante' : '',
        quality.isTilted ? 'Inclinada' : ''
    ].filter(p => p).join(', ') || 'Ninguno'}`);
    console.log('');
});

// Función global para ejecutar desde consola
window.testQualityDetection = () => {
    console.log('🧪 Ejecutando pruebas de calidad de imagen...');
    // Re-ejecutar el script
    const script = document.createElement('script');
    script.src = 'test-quality-detection.js';
    document.head.appendChild(script);
};

console.log('💡 Para ejecutar esta prueba desde consola: testQualityDetection()');
console.log('🎯 Los umbrales ahora deberían ser más permisivos para condiciones reales de campo');
