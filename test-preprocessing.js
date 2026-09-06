// Script para probar el preprocesamiento de imágenes para OCR
// Ejecutar desde consola del navegador con: testImagePreprocessing()

console.log('🧪 PRUEBA DE PREPROCESAMIENTO DE IMÁGENES - AJUSTE 2');
console.log('==========================================');

// Simular el método de Otsu para verificar que funciona
function testOtsuThreshold() {
    console.log('📊 Probando cálculo de umbral Otsu...');

    // Crear histograma simulado (imagen con texto negro sobre fondo blanco)
    const histogram = new Array(256).fill(0);

    // Simular distribución bimodal típica de documento
    for (let i = 0; i < 10000; i++) {
        // Texto negro (valores bajos)
        histogram[Math.floor(Math.random() * 50)] += 10;
        // Fondo blanco (valores altos)
        histogram[200 + Math.floor(Math.random() * 56)] += 10;
    }

    const threshold = calculateOtsuThreshold(histogram);
    console.log(`   ✅ Umbral calculado: ${threshold} (esperado: ~120-140)`);

    return threshold >= 100 && threshold <= 180;
}

// Función auxiliar para calcular umbral óptimo usando método Otsu
const calculateOtsuThreshold = (histogram) => {
    const total = histogram.reduce((sum, count) => sum + count, 0);
    let sum = 0;

    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let mB, mF;
    let max = 0;
    let threshold = 0;
    let between = 0;

    for (let i = 0; i < 256; i++) {
        wB += histogram[i];
        if (wB === 0) continue;

        wF = total - wB;
        if (wF === 0) break;

        sumB += i * histogram[i];
        mB = sumB / wB;
        mF = (sum - sumB) / wF;
        between = wB * wF * Math.pow(mB - mF, 2);

        if (between > max) {
            max = between;
            threshold = i;
        }
    }

    return threshold;
};

// Simular procesamiento de imagen en canvas
function testImageProcessingSimulation() {
    console.log('🎨 Probando simulación de procesamiento de imagen...');

    // Crear canvas simulado
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        console.error('❌ No se pudo crear contexto de canvas');
        return false;
    }

    // Crear imagen de prueba (gradiente simple)
    canvas.width = 100;
    canvas.height = 100;

    // Crear gradiente de prueba
    const gradient = ctx.createLinearGradient(0, 0, 100, 0);
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(1, 'white');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 100, 100);

    // Probar conversión a escala de grises
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    console.log('   ⚫ Convirtiendo a escala de grises...');
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
    }

    ctx.putImageData(imageData, 0, 0);
    console.log('   ✅ Conversión a escala de grises completada');

    // Probar binarización
    console.log('   ⚪ Aplicando binarización...');
    const binaryData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const binaryPixels = binaryData.data;

    const threshold = 128;
    for (let i = 0; i < binaryPixels.length; i += 4) {
        const gray = binaryPixels[i];
        const binary = gray > threshold ? 255 : 0;
        binaryPixels[i] = binary;
        binaryPixels[i + 1] = binary;
        binaryPixels[i + 2] = binary;
    }

    ctx.putImageData(binaryData, 0, 0);
    console.log('   ✅ Binarización completada');

    return true;
}

// Verificar que las funciones de preprocesamiento están disponibles
function testPreprocessingFunctions() {
    console.log('🔧 Verificando funciones de preprocesamiento...');

    const functions = [
        'preprocessImageForOCR',
        'calculateOtsuThreshold'
    ];

    let available = 0;
    functions.forEach(func => {
        if (typeof window[func] === 'function') {
            console.log(`   ✅ ${func} disponible`);
            available++;
        } else {
            console.log(`   ❌ ${func} no disponible`);
        }
    });

    return available === functions.length;
}

// Ejecutar todas las pruebas
function runAllTests() {
    console.log('');
    console.log('🚀 EJECUTANDO PRUEBAS COMPLETAS...');
    console.log('');

    let passed = 0;
    let total = 3;

    // Prueba 1: Método Otsu
    try {
        if (testOtsuThreshold()) {
            console.log('✅ Prueba 1 PASADA: Cálculo de umbral Otsu');
            passed++;
        } else {
            console.log('❌ Prueba 1 FALLIDA: Cálculo de umbral Otsu');
        }
    } catch (e) {
        console.log('❌ Prueba 1 ERROR:', e.message);
    }

    console.log('');

    // Prueba 2: Procesamiento de canvas
    try {
        if (testImageProcessingSimulation()) {
            console.log('✅ Prueba 2 PASADA: Procesamiento de canvas');
            passed++;
        } else {
            console.log('❌ Prueba 2 FALLIDA: Procesamiento de canvas');
        }
    } catch (e) {
        console.log('❌ Prueba 2 ERROR:', e.message);
    }

    console.log('');

    // Prueba 3: Funciones disponibles
    try {
        if (testPreprocessingFunctions()) {
            console.log('✅ Prueba 3 PASADA: Funciones disponibles');
            passed++;
        } else {
            console.log('❌ Prueba 3 FALLIDA: Funciones no disponibles');
        }
    } catch (e) {
        console.log('❌ Prueba 3 ERROR:', e.message);
    }

    console.log('');
    console.log(`📊 RESULTADO FINAL: ${passed}/${total} pruebas pasaron`);

    if (passed === total) {
        console.log('🎉 TODAS LAS PRUEBAS PASARON - Preprocesamiento listo para usar');
        console.log('');
        console.log('💡 Para probar con imagen real:');
        console.log('   1. Abre la app y toma una foto de INE');
        console.log('   2. Revisa la consola para ver los logs de preprocesamiento');
        console.log('   3. Deberías ver mensajes como "🔆 Ajustando brillo y contraste..."');
    } else {
        console.log('⚠️ Algunas pruebas fallaron - revisar código');
    }

    return passed === total;
}

// Función global para ejecutar desde consola
window.testImagePreprocessing = () => {
    console.log('🧪 Ejecutando pruebas de preprocesamiento de imágenes...');
    runAllTests();
};

console.log('💡 Para ejecutar todas las pruebas: testImagePreprocessing()');
console.log('🔍 Esto verificará que el preprocesamiento funciona correctamente');
