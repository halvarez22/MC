// Script para probar el flujo de corrección manual de OCR
// Simula el nuevo paso de revisión de texto OCR

console.log('🧪 PRUEBA DEL FLUJO DE CORRECCIÓN MANUAL OCR - AJUSTE 4');
console.log('====================================================');

// Simular el texto OCR distorsionado del ejemplo
const rawOCRText = `NTUTO NACIONAL ELECTORAL

f REDENCIAL PARA VOTAR
l - po UTIERREZ y ta
|| : 4 E SECTOR MANUE
|| MICIL E

E , ARQUE VIA 324 >=

E RQUE MANZANARES 37 :

5 1 .-

A LECTOR ALGTH: 22 L

e 3H6* HGTLT 1 AÑO DE REGISTRO 1991 Qi

5 ESTADO 11 MUNICIPIO. 02 sección 1532

5 LOCALIDAD 0001 emisión 2016 viemca 2006 "Xx`;

const correctedTextExample = `INSTITUTO NACIONAL ELECTORAL

CREDENCIAL PARA VOTAR
HECTOR MANUEL ALVAREZ GUTIERREZ

DOMICILIO: PARQUE VIA 324 MANZANARES
CLAVE DE ELECTOR: ABCD123456EFGH789012
CURP: AAMH910123HDFLRN05
AÑO DE REGISTRO 1991

ESTADO 11 MUNICIPIO 02 SECCIÓN 1532
LOCALIDAD 0001 EMISIÓN 2016 VIGENCIA 2026`;

// Función que simula el procesamiento inteligente del texto corregido
function simulateIntelligentExtraction(text) {
    const result = {};

    // Unir todas las líneas para análisis global
    const fullText = text.split('\n').join(' ').toUpperCase();

    // PATRÓN 1: CURP - 18 caracteres alfanuméricos con estructura específica
    const curpPattern = /[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}/g;
    const curpMatch = fullText.match(curpPattern);
    if (curpMatch && curpMatch[0].length === 18) {
      result.curp = curpMatch[0];
    }

    // PATRÓN 2: CLAVE DE ELECTOR - 18 caracteres alfanuméricos
    const clavePattern = /\b[A-Z0-9]{18}\b/g;
    const claveMatches = fullText.match(clavePattern);
    if (claveMatches) {
      // Filtrar posibles claves de elector (excluir CURP ya encontrada)
      const possibleClaves = claveMatches.filter(clave =>
        !result.curp || clave !== result.curp
      );
      if (possibleClaves.length > 0) {
        result.clave_elector = possibleClaves[0];
      }
    }

    // PATRÓN 3: NOMBRE COMPLETO - buscar líneas que parezcan nombres
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    for (const line of lines) {
      // Buscar líneas con múltiples palabras que parezcan nombres
      if (line.split(' ').length >= 2 &&
          line.length > 10 &&
          line.length < 50 &&
          !line.includes('DOMICILIO') &&
          !line.includes('SECCIÓN') &&
          !line.includes('MUNICIPIO') &&
          !/\d{4}/.test(line)) { // Evitar líneas con años

        // Verificar que no sea una dirección (no contener números de calle típicos)
        if (!/\b\d{1,4}\s/.test(line) && !line.includes('VIA') && !line.includes('CALLE')) {
          result.nombre_completo = line.trim();
          break;
        }
      }
    }

    // PATRÓN 4: FECHAS - buscar formatos DD/MM/YYYY o DD-MM-YYYY
    const datePattern = /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\b/g;
    const dateMatches = fullText.match(datePattern);
    if (dateMatches && dateMatches.length > 0) {
      result.fecha_nacimiento = dateMatches[0];
    }

    // PATRÓN 5: SECCIÓN ELECTORAL
    const seccionPattern = /(?:SECCIÓN|SECCION)\s*(\d+)/i;
    const seccionMatch = fullText.match(seccionPattern);
    if (seccionMatch) {
      result.seccion = seccionMatch[1];
    }

    // PATRÓN 6: ESTADO - buscar nombres de estados mexicanos
    const estadosMexicanos = [
      'AGUASCALIENTES', 'BAJA CALIFORNIA', 'BAJA CALIFORNIA SUR', 'CAMPECHE',
      'CHIAPAS', 'CHIHUAHUA', 'CIUDAD DE MÉXICO', 'COAHUILA', 'COLIMA',
      'DURANGO', 'GUANAJUATO', 'GUERRERO', 'HIDALGO', 'JALISCO', 'MÉXICO',
      'MICHOACÁN', 'MORELOS', 'NAYARIT', 'NUEVO LEÓN', 'OAXACA', 'PUEBLA',
      'QUERÉTARO', 'QUINTANA ROO', 'SAN LUIS POTOSÍ', 'SINALOA', 'SONORA',
      'TABASCO', 'TAMAULIPAS', 'TLAXCALA', 'VERACRUZ', 'YUCATÁN', 'ZACATECAS'
    ];

    for (const estado of estadosMexicanos) {
      if (fullText.includes(estado)) {
        result.estado = estado;
        break;
      }
    }

    // PATRÓN 7: DOMICILIO - buscar líneas que contengan direcciones
    for (const line of lines) {
      if ((line.includes('VIA') || line.includes('CALLE') || line.includes('AVENIDA') ||
           /\b\d{1,4}\s/.test(line)) && line.length > 15) {
        result.domicilio = line.trim();
        break;
      }
    }

    return result;
}

// Ejecutar pruebas de comparación
function runCorrectionFlowTests() {
    console.log('🚀 PRUEBAS DEL FLUJO DE CORRECCIÓN MANUAL');
    console.log('');

    // Prueba 1: Texto OCR sin corrección
    console.log('📝 PRUEBA 1: Texto OCR original (sin corrección)');
    console.log('Texto procesado:', rawOCRText.substring(0, 100) + '...');
    const resultRaw = simulateIntelligentExtraction(rawOCRText);
    console.log('Datos extraídos:', resultRaw);
    console.log('');

    // Prueba 2: Texto OCR corregido manualmente
    console.log('✏️ PRUEBA 2: Texto OCR corregido manualmente');
    console.log('Texto procesado:', correctedTextExample.substring(0, 100) + '...');
    const resultCorrected = simulateIntelligentExtraction(correctedTextExample);
    console.log('Datos extraídos:', resultCorrected);
    console.log('');

    // Comparación de resultados
    console.log('📊 COMPARACIÓN DE RESULTADOS:');
    console.log('='.repeat(50));

    const fields = ['nombre_completo', 'curp', 'clave_elector', 'estado', 'seccion', 'domicilio'];

    let rawScore = 0;
    let correctedScore = 0;

    fields.forEach(field => {
        const rawValue = resultRaw[field] || 'No encontrado';
        const correctedValue = resultCorrected[field] || 'No encontrado';
        const improved = rawValue !== correctedValue && correctedValue !== 'No encontrado';

        if (rawValue !== 'No encontrado') rawScore++;
        if (correctedValue !== 'No encontrado') correctedScore++;

        console.log(`${field}:`);
        console.log(`  Original: ${rawValue}`);
        console.log(`  Corregido: ${correctedValue}`);
        console.log(`  ✅ Mejoró: ${improved ? 'SÍ' : 'NO'}`);
        console.log('');
    });

    console.log('📈 PUNTAJE FINAL:');
    console.log(`   Texto original: ${rawScore}/${fields.length} campos encontrados`);
    console.log(`   Texto corregido: ${correctedScore}/${fields.length} campos encontrados`);
    console.log(`   📊 Mejora: ${correctedScore - rawScore > 0 ? '+' + (correctedScore - rawScore) : (correctedScore - rawScore)} campos`);

    const improvement = correctedScore - rawScore;
    if (improvement > 0) {
        console.log('');
        console.log('🎉 ÉXITO: La corrección manual mejora significativamente la extracción de datos');
        console.log('');
        console.log('💡 CONCLUSIONES:');
        console.log('   • El flujo de corrección manual es efectivo');
        console.log('   • Los usuarios pueden corregir errores de OCR');
        console.log('   • La IA funciona mucho mejor con texto limpio');
        console.log('   • Se mejora la precisión de extracción de datos');
    } else {
        console.log('');
        console.log('⚠️ ATENCIÓN: La corrección no mostró mejora significativa en esta simulación');
        console.log('   (Puede deberse a que la lógica de simulación es básica)');
    }

    return improvement > 0;
}

// Función global para ejecutar desde consola
window.testOCRCorrectionFlow = () => {
    console.log('🧪 Ejecutando pruebas del flujo de corrección manual OCR...');
    runCorrectionFlowTests();
};

console.log('💡 Para ejecutar todas las pruebas: testOCRCorrectionFlow()');
console.log('🔍 Esto probará la efectividad del nuevo paso de corrección manual');

// Ejecutar automáticamente para mostrar resultados
console.log('');
runCorrectionFlowTests();
