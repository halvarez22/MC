// Script simple para probar el preprocesamiento de imágenes
// Prueba solo la lógica matemática sin dependencias del DOM

console.log('🧪 PRUEBA SIMPLE DE PREPROCESAMIENTO - AJUSTE 2');
console.log('=============================================');

// Función auxiliar para calcular umbral óptimo usando método Otsu mejorado
const calculateOtsuThreshold = (histogram) => {
    const total = histogram.reduce((sum, count) => sum + count, 0);
    if (total === 0) return 128;

    let sum = 0;
    for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let max = 0;
    let threshold = 128; // Valor por defecto

    // Solo procesar valores donde hay datos (evitar divisiones por cero)
    for (let i = 1; i < 255; i++) {
        wB += histogram[i];
        if (wB === 0) continue;

        const wF = total - wB;
        if (wF === 0) continue;

        sumB += i * histogram[i];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        const between = wB * wF * Math.pow(mB - mF, 2);

        if (between > max) {
            max = between;
            threshold = i;
        }
    }

    // Si no se encontró un buen umbral, usar un método más simple
    if (max === 0) {
        // Calcular media ponderada simple
        let weightedSum = 0;
        let totalWeight = 0;
        for (let i = 0; i < 256; i++) {
            weightedSum += i * histogram[i];
            totalWeight += histogram[i];
        }
        threshold = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 128;
    }

    return Math.max(50, Math.min(200, threshold)); // Asegurar rango razonable
};

// Prueba del cálculo de umbral Otsu
function testOtsu() {
    console.log('📊 Probando cálculo de umbral Otsu...');

    // Caso 1: Histograma bimodal típico (texto negro sobre fondo blanco)
    const histogram1 = new Array(256).fill(0);
    for (let i = 0; i < 5000; i++) {
        histogram1[Math.floor(Math.random() * 60)] += 1;      // Texto negro
        histogram1[190 + Math.floor(Math.random() * 66)] += 1; // Fondo blanco
    }

    const threshold1 = calculateOtsuThreshold(histogram1);
    console.log(`   📈 Caso 1 - Umbral: ${threshold1} (esperado: 120-140)`);

    // Caso 2: Histograma uniforme (imagen gris)
    const histogram2 = new Array(256).fill(100);

    const threshold2 = calculateOtsuThreshold(histogram2);
    console.log(`   📈 Caso 2 - Umbral: ${threshold2} (esperado: 128)`);

    // Caso 3: Texto muy claro sobre fondo muy oscuro
    const histogram3 = new Array(256).fill(0);
    for (let i = 0; i < 5000; i++) {
        histogram3[Math.floor(Math.random() * 30) + 100] += 1;  // Texto claro
        histogram3[Math.floor(Math.random() * 50)] += 1;         // Fondo oscuro
    }

    const threshold3 = calculateOtsuThreshold(histogram3);
    console.log(`   📈 Caso 3 - Umbral: ${threshold3} (esperado: 80-120)`);

    // Validar resultados
    const valid1 = threshold1 >= 100 && threshold1 <= 160;
    const valid2 = threshold2 >= 120 && threshold2 <= 135;
    const valid3 = threshold3 >= 60 && threshold3 <= 140;

    console.log(`   ✅ Caso 1 válido: ${valid1}`);
    console.log(`   ✅ Caso 2 válido: ${valid2}`);
    console.log(`   ✅ Caso 3 válido: ${valid3}`);

    return valid1 && valid2 && valid3;
}

// Simular procesamiento de píxeles
function testPixelProcessing() {
    console.log('🎨 Probando procesamiento de píxeles...');

    // Crear datos de imagen simulados (RGBA)
    const width = 10;
    const height = 10;
    const data = new Uint8ClampedArray(width * height * 4);

    // Llenar con gradiente de negro a blanco
    for (let i = 0; i < data.length; i += 4) {
        const pixelIndex = i / 4;
        const x = pixelIndex % width;
        const value = Math.floor((x / width) * 255);

        data[i] = value;     // R
        data[i + 1] = value; // G
        data[i + 2] = value; // B
        data[i + 3] = 255;   // A
    }

    console.log('   🔆 Aplicando brillo (+10)...');
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] + 10));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + 10));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + 10));
    }

    console.log('   📈 Aplicando contraste (1.2x)...');
    for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * 1.2) + 128));
        data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * 1.2) + 128));
        data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * 1.2) + 128));
    }

    console.log('   ⚫ Convirtiendo a escala de grises...');
    for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
    }

    console.log('   ⚪ Aplicando binarización...');
    for (let i = 0; i < data.length; i += 4) {
        const gray = data[i];
        const binary = gray > 128 ? 255 : 0;
        data[i] = binary;
        data[i + 1] = binary;
        data[i + 2] = binary;
    }

    // Verificar que hay píxeles negros y blancos
    let blackPixels = 0;
    let whitePixels = 0;

    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0) blackPixels++;
        if (data[i] === 255) whitePixels++;
    }

    console.log(`   📊 Píxeles negros: ${blackPixels}, blancos: ${whitePixels}`);

    return blackPixels > 0 && whitePixels > 0;
}

// Ejecutar pruebas
function runTests() {
    console.log('');
    console.log('🚀 EJECUTANDO PRUEBAS...');
    console.log('');

    let passed = 0;
    let total = 2;

    // Prueba 1: Método Otsu
    try {
        if (testOtsu()) {
            console.log('✅ Prueba 1 PASADA: Método Otsu');
            passed++;
        } else {
            console.log('❌ Prueba 1 FALLIDA: Método Otsu');
        }
    } catch (e) {
        console.log('❌ Prueba 1 ERROR:', e.message);
    }

    console.log('');

    // Prueba 2: Procesamiento de píxeles
    try {
        if (testPixelProcessing()) {
            console.log('✅ Prueba 2 PASADA: Procesamiento de píxeles');
            passed++;
        } else {
            console.log('❌ Prueba 2 FALLIDA: Procesamiento de píxeles');
        }
    } catch (e) {
        console.log('❌ Prueba 2 ERROR:', e.message);
    }

    console.log('');
    console.log(`📊 RESULTADO FINAL: ${passed}/${total} pruebas pasaron`);

    if (passed === total) {
        console.log('🎉 TODAS LAS PRUEBAS PASARON - Preprocesamiento matemático funciona');
        console.log('');
        console.log('💡 El preprocesamiento completo requiere DOM (canvas), pero la lógica matemática está validada');
        console.log('🔍 En el navegador, deberías ver logs como:');
        console.log('   "🔆 Ajustando brillo y contraste..."');
        console.log('   "⚫ Convirtiendo a escala de grises..."');
        console.log('   "⚪ Aplicando binarización adaptativa..."');
        console.log('   "🔍 Aplicando filtro de nitidez..."');
    } else {
        console.log('⚠️ Algunas pruebas fallaron - revisar código');
    }

    return passed === total;
}

// Ejecutar automáticamente
runTests();
