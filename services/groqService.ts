// Servicio para procesar texto OCR con Groq AI
// Estructura los datos extraídos de INEs mexicanas

import type { INEStructuredData } from '../types';
import {
  GROQ_CONFIG,
  buildIneExtractionPrompt,
} from './promptTemplates';

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
        console.log('🤖 Usando datos simulados (modo testing)');
        return this.generateMockData(rawText);
      }

      const prompt = buildIneExtractionPrompt(rawText);

      const response = await fetch(GROQ_CONFIG.endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_CONFIG.model,
          messages: [{
            role: 'user',
            content: prompt
          }],
          temperature: GROQ_CONFIG.temperature,
          max_tokens: GROQ_CONFIG.maxTokens,
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

  /**
   * Disponibilidad sin completion de prueba en hot path (Context Economy / idempotencia).
   * Solo valida presencia de API key; evita gasto de tokens en cada sync.
   */
  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey);
  }

  private generateMockData(rawText: string): INEStructuredData {
    // Extraer datos REALES del texto OCR con análisis inteligente
    console.log('🔍 Extrayendo datos reales del texto OCR...');

    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('📝 Líneas procesadas:', lines.length);

    // Usar análisis inteligente en lugar de lógica hardcoded
    const extractedData = this.extractDataIntelligently(lines);

    // Retornar datos validados
    return extractedData;
  }

  private extractDataIntelligently(lines: string[]): INEStructuredData {
    const result: INEStructuredData = {};

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

    console.log('📊 Datos extraídos inteligentemente:', result);
    return result;
  }


}

export const groqService = new GroqService();
