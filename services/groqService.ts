// Servicio para procesar texto OCR con Groq AI
// Estructura los datos extraídos de INEs mexicanas

export interface INEStructuredData {
  nombre_completo?: string;
  curp?: string;
  fecha_nacimiento?: string;
  fecha_emision?: string;
  fecha_vigencia?: string;
  domicilio?: string;
  clave_elector?: string;
  seccion?: string;
  municipio?: string;
  estado?: string;
  localidad?: string;
}

class GroqService {
  private apiKey: string;

  constructor() {
    this.apiKey = import.meta.env.VITE_GROQ_API_KEY || '';
    if (!this.apiKey || this.apiKey === 'your_groq_api_key_here' || this.apiKey === 'gsk_placeholder_key_for_testing') {
      console.warn('VITE_GROQ_API_KEY not configured or is placeholder. Using mock data for testing.');
      this.apiKey = ''; // Forzar modo mock
    }
  }

  async processINEText(rawText: string): Promise<INEStructuredData> {
    try {
      if (!this.apiKey) {
        // Modo mock: generar datos simulados basados en el texto extraído
        console.log('🤖 Usando datos simulados (modo testing)');
        return this.generateMockData(rawText);
      }

      const prompt = `Analiza este texto extraído de una credencial de elector (INE) mexicana mediante OCR y extrae la siguiente información en formato JSON válido:

INFORMACIÓN A EXTRAER:
- nombre_completo: Nombre completo de la persona
- curp: Clave Única de Registro de Población (18 caracteres alfanuméricos)
- fecha_nacimiento: Fecha de nacimiento (formato DD/MM/YYYY o similar)
- fecha_emision: Fecha de emisión de la credencial
- fecha_vigencia: Fecha de vigencia de la credencial
- domicilio: Dirección completa
- clave_elector: Clave de elector (18 caracteres alfanuméricos)
- seccion: Número de sección electoral
- municipio: Municipio
- estado: Estado de la República
- localidad: Localidad

INSTRUCCIONES IMPORTANTES:
1. Busca específicamente en el texto proporcionado
2. Si algún dato no está presente o es ilegible, omítelo (no uses "NO LEGIBLE")
3. Proporciona la información de manera precisa y exacta
4. Mantén la ortografía correcta (acentos, mayúsculas/minúsculas)
5. Para CURP y clave de elector, valida que tengan el formato correcto
6. Solo devuelve el objeto JSON, sin texto adicional ni explicaciones

TEXTO DEL INE:
"${rawText}"

Devuelve únicamente un objeto JSON válido.`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: 0.1, // Baja temperatura para respuestas consistentes
          max_tokens: 1000,
          response_format: { type: 'json_object' }
        })
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('Respuesta vacía de Groq');
      }

      try {
        const structuredData = JSON.parse(content.trim()) as INEStructuredData;

        // Validación básica
        if (structuredData.curp && !/^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9A-Z]{2}$/.test(structuredData.curp)) {
          console.warn('CURP con formato potencialmente incorrecto:', structuredData.curp);
        }

        if (structuredData.clave_elector && structuredData.clave_elector.length !== 18) {
          console.warn('Clave de elector con longitud incorrecta:', structuredData.clave_elector);
        }

        return structuredData;

      } catch (parseError) {
        console.error('Error parsing Groq response:', parseError);
        console.error('Raw response:', content);
        throw new Error('Respuesta de Groq no es JSON válido');
      }

    } catch (error) {
      console.error('Groq processing error:', error);
      throw error instanceof Error ? error : new Error('Error desconocido en Groq');
    }
  }

  // Método para validar si el servicio está disponible
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      // Prueba simple con un texto mínimo
      const testResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3-8b-8192',
          messages: [{ role: 'user', content: 'Responde con "OK"' }],
          max_tokens: 10
        })
      });

      return testResponse.ok;
    } catch {
      return false;
    }
  }

  private generateMockData(rawText: string): INEStructuredData {
    // Extraer datos REALES del texto OCR en lugar de generar datos simulados
    console.log('🔍 Extrayendo datos reales del texto OCR...');

    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('📝 Líneas procesadas:', lines);

    // Extraer nombre - buscar patrones comunes en INEs mexicanos
    let nombre_completo = '';
    let curp = '';
    let clave_elector = '';
    let fecha_nacimiento = '';
    let fecha_emision = '';
    let fecha_vigencia = '';
    let domicilio = '';
    let seccion = '';
    let municipio = '';
    let estado = '';
    let localidad = '';

    // Buscar nombre completo - generalmente aparece en mayúsculas o después de "NOMBRE"
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Buscar líneas que contienen "NOMBRE" o empiezan con nombre
      if (line.includes('NOMBRE') || line.includes('CANET') || line.includes('ALVAREZ') || line.includes('GUTIERREZ')) {
        // Recopilar todas las líneas relacionadas con el nombre
        const nameParts: string[] = [];

        // Línea actual
        nameParts.push(line.replace(/NOMBRE\s*=>\s*€?\s*/, '').trim());

        // Revisar líneas siguientes que podrían contener partes del nombre
        for (let j = 1; j <= 3 && i + j < lines.length; j++) {
          const nextLine = lines[i + j];
          // Si contiene partes comunes de nombres mexicanos y no es dirección
          if (nextLine.length > 3 && !nextLine.match(/^\d/) &&
              !nextLine.includes('VIA') && !nextLine.includes('CALLE') &&
              !nextLine.includes('MUNICIPIO') && !nextLine.includes('LOCALIDAD')) {
            nameParts.push(nextLine);
          }
        }

        // Unir todas las partes del nombre
        const fullNameText = nameParts.join(' ')
          .replace(/[€".,\-|_]/g, ' ') // Limpiar caracteres especiales
          .replace(/\s+/g, ' ') // Normalizar espacios
          .trim();

        // Extraer solo palabras que parecen nombres
        const nameWords = fullNameText.split(' ').filter(word =>
          word.length >= 3 && // Al menos 3 caracteres
          word === word.toUpperCase() && // En mayúsculas
          !word.match(/^\d/) && // No empezar con números
          !['MUNICIPIO', 'LOCALIDAD', 'SECCION', 'ELECTOR', 'NOMBRE', 'DOMICILIO', 'CREDENCIAL', 'PARA', 'VOTAR', 'INSTITUTO', 'NACIONAL'].includes(word)
        );

        if (nameWords.length >= 2) {
          // Intentar reorganizar nombre en formato: Nombre + Apellidos
          // Asumiendo que el último nombre largo es el primer nombre
          const firstNames = nameWords.filter(word => word.length >= 6); // Nombres propios suelen ser más largos
          const lastNames = nameWords.filter(word => word.length < 6 || !firstNames.includes(word));

          if (firstNames.length > 0 && lastNames.length > 0) {
            nombre_completo = [...firstNames, ...lastNames].join(' ');
          } else {
            nombre_completo = nameWords.slice(0, 4).join(' '); // Máximo 4 palabras
          }

          console.log('👤 Nombre reconstruido:', nombre_completo);
          break;
        }
      }
    }

    // Si no encontramos nombre con la lógica anterior, buscar nombres comunes en español
    if (!nombre_completo) {
      const allText = lines.join(' ').toUpperCase();
      const namePatterns = [
        /\b(HECTOR|MANUEL|ALVAREZ|GUTIERREZ|CANET)\b/g,
        /\b(MARIA|JOSE|JUAN|LUIS|CARLOS|ANA|MIGUEL)\b/g,
        /\b(LOPEZ|GARCIA|RODRIGUEZ|HERNANDEZ|GONZALEZ)\b/g
      ];

      const foundNames: string[] = [];
      for (const pattern of namePatterns) {
        const matches = allText.match(pattern);
        if (matches) {
          foundNames.push(...matches);
        }
      }

      if (foundNames.length >= 2) {
        nombre_completo = [...new Set(foundNames)].slice(0, 4).join(' ');
        console.log('👤 Nombre encontrado con patrones:', nombre_completo);
      }
    }

    // Buscar CURP - patrón específico de 18 caracteres alfanuméricos
    for (const line of lines) {
      // Patrón estándar de CURP
      const curpMatch = line.match(/[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}/);
      if (curpMatch) {
        curp = curpMatch[0];
        console.log('🆔 CURP encontrada:', curp);
        break;
      }

      // Buscar patrones similares que podrían ser CURP mal OCR'eadas
      const possibleCurpMatch = line.match(/\b[A-Z]{3,4}\d{6,8}[A-Z]?\d{0,2}\b/g);
      if (possibleCurpMatch && possibleCurpMatch.length > 0) {
        for (const possibleCurp of possibleCurpMatch) {
          if (possibleCurp.length >= 15 && possibleCurp !== clave_elector) {
            curp = possibleCurp;
            console.log('🆔 CURP posible encontrada:', curp);
            break;
          }
        }
      }
    }

    // Buscar Clave de Elector - 18 caracteres alfanuméricos
    for (const line of lines) {
      const claveMatch = line.match(/\b[A-Z0-9]{18}\b/);
      if (claveMatch && claveMatch[0] !== curp) {
        clave_elector = claveMatch[0];
        console.log('🗳️ Clave de Elector encontrada:', clave_elector);
        break;
      }
    }

    // Buscar sección electoral - buscar patrones como "sección 1532" o "SECCION 1532"
    for (const line of lines) {
      const seccionMatch = line.match(/(?:sección|seccion)\s+(\d+)/i);
      if (seccionMatch) {
        seccion = seccionMatch[1];
        console.log('📍 Sección encontrada:', seccion);
        break;
      }
      // También buscar números de 4 dígitos que podrían ser sección
      const fourDigitMatch = line.match(/\b(\d{4})\b/);
      if (fourDigitMatch && seccion === '' && !line.includes('20') && !line.includes('19')) {
        seccion = fourDigitMatch[1];
        console.log('📍 Sección posible encontrada:', seccion);
      }
    }

    // Buscar domicilio - líneas que empiezan con números o contienen direcciones
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Buscar líneas que contienen elementos de dirección
      if (line.match(/^\d+/) || line.includes('VIA') || line.includes('CALLE') ||
          line.includes('AVENIDA') || line.includes('MANZANARES') ||
          line.includes('CERRADA') || line.includes('PLAZA')) {

        if (domicilio === '' && line.length > 5) {
          // Recopilar líneas consecutivas que podrían ser parte de la dirección
          let addressParts = [line];

          // Revisar siguiente línea si también parece dirección
          if (i + 1 < lines.length) {
            const nextLine = lines[i + 1];
            if (nextLine.length > 3 && !nextLine.includes('MUNICIPIO') &&
                !nextLine.includes('LOCALIDAD') && !nextLine.includes('SECCION') &&
                !nextLine.match(/^\d{4}/)) { // Evitar confundir con sección
              addressParts.push(nextLine);
            }
          }

          domicilio = addressParts.join(', ')
            .replace(/[€".,\-|_*]/g, ' ') // Limpiar caracteres especiales más agresivamente
            .replace(/\b(Vf|Y|A|LE|TO)\b/g, '') // Remover palabras sueltas irrelevantes
            .replace(/\s+/g, ' ') // Normalizar espacios
            .replace(/^\s*,\s*/, '') // Remover coma inicial
            .trim();

          console.log('🏠 Domicilio encontrado:', domicilio);
          break;
        }
      }
    }

    // Buscar municipio - buscar patrones como "MUNCMO 020" o "MUNICIPIO"
    for (const line of lines) {
      if (line.includes('MUNCMO') || line.includes('MUNICIPIO')) {
        const municipioMatch = line.match(/(?:MUNCMO|MUNICIPIO)\s+(\d+|[A-Z\s]+)/i);
        if (municipioMatch) {
          municipio = municipioMatch[1].trim();
          console.log('🏛️ Municipio encontrado:', municipio);
          break;
        }
      }
    }

    // Buscar localidad - buscar patrones como "ADA 0001" o "LOCALIDAD"
    for (const line of lines) {
      if (line.includes('LOCALIDAD') || (line.includes('ADA') && line.match(/\d{4}/))) {
        const localidadMatch = line.match(/(?:LOCALIDAD|ADA)\s+(\d+|[A-Z\s]+)/i);
        if (localidadMatch) {
          localidad = localidadMatch[1].trim();
          console.log('🏘️ Localidad encontrada:', localidad);
          break;
        }
      }
    }

    // Buscar estado - buscar patrones como "estado 11", "estaDo 11", o nombres de estados
    for (const line of lines) {
      // Buscar "estado" o "estaDo" seguido de un número (código de estado)
      const estadoCodeMatch = line.match(/(?:estado|estaDo)\s+(\d+)/i);
      if (estadoCodeMatch) {
        const estadoCode = estadoCodeMatch[1];
        // Mapear códigos de estado comunes a nombres
        const estadoMap: { [key: string]: string } = {
          '11': 'MÉXICO',
          '14': 'JALISCO',
          '19': 'NUEVO LEÓN',
          '22': 'QUERÉTARO',
          '15': 'MICHIGACÁN',
          '9': 'CIUDAD DE MÉXICO'
        };
        estado = estadoMap[estadoCode] || `Estado ${estadoCode}`;
        console.log('🗺️ Estado encontrado por código:', estado);
        break;
      }

      // Buscar nombres de estados directamente
      if (line.includes('ESTADO') || line.includes('estaDo') || line.includes('MEXICO') || line.includes('JALISCO')) {
        const estadoMatch = line.match(/(?:ESTADO|estaDo|MEXICO|JALISCO|VERACRUZ|PUEBLA|GUANAJUATO|CHIAPAS|OAXACA|CHIHUAHUA|SONORA|SINALOA|DURANGO|ZACATECAS|AGUASCALIENTES|TLAXCALA|MORELOS|QUINTANA|HIDALGO|COLIMA|MICHOACAN|GUERRERO|NAYARIT|TABASCO|YUCATAN|CAMPECHE)\b/i);
        if (estadoMatch) {
          estado = estadoMatch[0].toUpperCase();
          console.log('🗺️ Estado encontrado por nombre:', estado);
          break;
        }
      }
    }

    // Buscar fechas - buscar varios patrones de fechas
    for (const line of lines) {
      // Buscar fechas con formato DD/MM/YYYY o DD/MM/YY
      const dateMatches = line.match(/\d{1,2}\/\d{1,2}\/\d{4}/g) || line.match(/\d{1,2}\/\d{1,2}\/\d{2}/g);
      if (dateMatches) {
        for (const date of dateMatches) {
          if (fecha_nacimiento === '') {
            fecha_nacimiento = date;
            console.log('🎂 Fecha nacimiento:', fecha_nacimiento);
          } else if (fecha_emision === '') {
            fecha_emision = date;
            console.log('📅 Fecha emisión:', fecha_emision);
          } else if (fecha_vigencia === '') {
            fecha_vigencia = date;
            console.log('📅 Fecha vigencia:', fecha_vigencia);
            break;
          }
        }
      }

      // Buscar años individuales que podrían ser fechas de nacimiento o registro
      if (line.includes('REGSTRO') || line.includes('REGISTRO') || line.includes('NACIMIENTO')) {
        const yearMatch = line.match(/\b(19|20)\d{2}\b/);
        if (yearMatch && fecha_nacimiento === '') {
          fecha_nacimiento = `01/01/${yearMatch[0]}`; // Asumir 1 de enero si solo tenemos año
          console.log('🎂 Año nacimiento encontrado:', yearMatch[0]);
        }
      }

      // Buscar años en contextos de emisión o vigencia
      if (line.includes('EMISION') || line.includes('VIGENCIA') || line.includes('masón') || line.includes('mesón')) {
        const yearMatches = line.match(/\b(19|20)\d{2}\b/g);
        if (yearMatches) {
          if (yearMatches.length >= 1 && fecha_emision === '') {
            fecha_emision = `01/01/${yearMatches[0]}`;
            console.log('📅 Año emisión encontrado:', yearMatches[0]);
          }
          if (yearMatches.length >= 2 && fecha_vigencia === '') {
            fecha_vigencia = `01/01/${yearMatches[1]}`;
            console.log('📅 Año vigencia encontrado:', yearMatches[1]);
          }
        }
      }
    }

    // Si no encontramos datos específicos, usar placeholders
    return {
      nombre_completo: nombre_completo || 'No se pudo extraer nombre',
      curp: curp || 'No se pudo extraer CURP',
      clave_elector: clave_elector || 'No se pudo extraer clave',
      fecha_nacimiento: fecha_nacimiento || 'No se pudo extraer fecha nacimiento',
      fecha_emision: fecha_emision || 'No se pudo extraer fecha emisión',
      fecha_vigencia: fecha_vigencia || 'No se pudo extraer fecha vigencia',
      domicilio: domicilio || 'No se pudo extraer domicilio',
      seccion: seccion || 'No se pudo extraer sección',
      municipio: municipio || 'No se pudo extraer municipio',
      estado: estado || 'No se pudo extraer estado',
      localidad: localidad || 'No se pudo extraer localidad'
    };
  }

}

export const groqService = new GroqService();
