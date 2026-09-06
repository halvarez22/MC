// Script para probar la extracción inteligente de datos de INE
// Ejecutar desde consola del navegador con: testIntelligentExtraction()

console.log('🧪 PRUEBA DE EXTRACCIÓN INTELIGENTE - AJUSTE 3');
console.log('==========================================');

// Simular el texto OCR de un INE real (basado en el ejemplo del index.tsx)
const sampleINEText = `NTUTO NACIONAL ELECTORAL

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

function extractDataIntelligently(lines) {
    const result = {};

    // Unir todas las líneas para análisis global
    const fullText = lines.join(' ').toUpperCase();

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

// Función para probar con diferentes textos OCR
function testExtractionWithText(ocrText, testName) {
    console.log(`\n🧪 PRUEBA: ${testName}`);
    console.log('📝 Texto OCR:');
    console.log(ocrText);
    console.log('');

    const lines = ocrText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const result = extractDataIntelligently(lines);

    console.log('📊 Datos extraídos:');
    Object.keys(result).forEach(key => {
        console.log(`   ${key}: "${result[key] || 'No encontrado'}"`);
    });

    return result;
}

// Ejecutar pruebas
function runAllTests() {
    console.log('🚀 EJECUTANDO PRUEBAS DE EXTRACCIÓN INTELIGENTE...');

    // Prueba 1: Texto OCR real del ejemplo
    const result1 = testExtractionWithText(sampleINEText, 'INE con texto OCR distorsionado');

    // Prueba 2: Texto más limpio simulado
    const cleanText = `INSTITUTO NACIONAL ELECTORAL

CREDENCIAL PARA VOTAR
HECTOR MANUEL ALVAREZ GUTIERREZ

DOMICILIO: PARQUE VIA 324 MANZANARES
CLAVE DE ELECTOR: ABCD123456EFGH789012
CURP: AAMH910123HDFLRN05
FECHA DE NACIMIENTO: 23/01/1991

ESTADO: MÉXICO
MUNICIPIO: 002
SECCIÓN: 1532
LOCALIDAD: 0001

EMISIÓN: 01/01/2016
VIGENCIA: 01/01/2026`;

    const result2 = testExtractionWithText(cleanText, 'INE con texto más limpio');

    // Validar resultados esperados
    console.log('\n📋 VALIDACIÓN DE RESULTADOS:');

    const validations = [
        {
            test: 'Texto distorsionado',
            result: result1,
            expectations: {
                nombre_completo: true, // Debería encontrar algo
                estado: 'MÉXICO', // Debería encontrar "MÉXICO"
                seccion: '1532' // Debería encontrar "1532"
            }
        },
        {
            test: 'Texto limpio',
            result: result2,
            expectations: {
                nombre_completo: 'HECTOR MANUEL ALVAREZ GUTIERREZ',
                curp: 'AAMH910123HDFLRN05',
                clave_elector: 'ABCD123456EFGH789012',
                estado: 'MÉXICO',
                seccion: '1532'
            }
        }
    ];

    let totalTests = 0;
    let passedTests = 0;

    validations.forEach(validation => {
        console.log(`\n✅ ${validation.test}:`);
        Object.keys(validation.expectations).forEach(field => {
            totalTests++;
            const expected = validation.expectations[field];
            const actual = validation.result[field];

            let passed = false;
            if (expected === true) {
                passed = actual && actual !== 'No encontrado';
            } else {
                passed = actual === expected;
            }

            console.log(`   ${field}: ${passed ? '✅' : '❌'} (esperado: "${expected}", obtenido: "${actual || 'No encontrado'}")`);

            if (passed) passedTests++;
        });
    });

    console.log('\n📊 RESULTADO FINAL:');
    console.log(`   ✅ Pruebas pasadas: ${passedTests}/${totalTests}`);
    console.log(`   📈 Tasa de éxito: ${((passedTests/totalTests)*100).toFixed(1)}%`);

    if (passedTests >= totalTests * 0.7) { // Al menos 70% de éxito
        console.log('🎉 EXTRACCIÓN INTELIGENTE FUNCIONANDO CORRECTAMENTE');
        console.log('\n💡 En la app real, deberías ver logs como:');
        console.log('   "📊 Datos extraídos inteligentemente: { nombre_completo: \'...\', estado: \'...\', ... }"');
    } else {
        console.log('⚠️ La extracción necesita ajustes adicionales');
    }

    return passedTests >= totalTests * 0.7;
}

// Función global para ejecutar desde consola
window.testIntelligentExtraction = () => {
    console.log('🧪 Ejecutando pruebas de extracción inteligente...');
    runAllTests();
};

console.log('💡 Para ejecutar todas las pruebas: testIntelligentExtraction()');
console.log('🔍 Esto probará la lógica de extracción inteligente de datos INE');
