export interface INEData {
  name: string;
  address: string;
  voterId: string;
  curp: string;
  registrationYear: string;
  state: string;
  municipality: string;
  section: string;
  locality: string;
  emission: string;
  validity: string;
}

export interface OCRResult {
  success: boolean;
  data?: INEData;
  error?: string;
  confidence?: number;
}

class OCRService {
  private apiKey: string;

  constructor() {
    // Acceder a la variable global definida por Vite
    this.apiKey = (window as any)?.VITE_GEMINI_API_KEY || '';

    if (!this.apiKey) {
      console.warn('VITE_GEMINI_API_KEY not found. Make sure .env.local file exists with the correct API key');
    }
  }

  async extractINEData(imageFile: File): Promise<OCRResult> {
    try {
      // Validar que tengamos la API key
      if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here' || this.apiKey === '') {
        return {
          success: false,
          error: 'API key de Gemini no configurada. Crea un archivo .env con VITE_GEMINI_API_KEY=tu_api_key'
        };
      }

      // Convertir la imagen a base64
      const base64Image = await this.fileToBase64(imageFile);

      // Preparar el prompt para Gemini
      const prompt = `
Analiza esta imagen de una credencial de elector (INE) mexicana y extrae la siguiente información:

INFORMACIÓN A EXTRAER:
- NOMBRE: Nombre completo de la persona
- DOMICILIO: Dirección completa
- CLAVE DE ELECTOR: Número de elector
- CURP: Clave Única de Registro de Población
- AÑO DE REGISTRO: Año en que se registró
- ESTADO: Estado de la República
- MUNICIPIO: Municipio
- SECCIÓN: Número de sección electoral
- LOCALIDAD: Localidad
- EMISIÓN: Fecha de emisión
- VIGENCIA: Fecha de vigencia

INSTRUCCIONES:
1. Busca específicamente en el lado FRONTAL de la credencial
2. Si algún dato no está visible o legible, indica "NO LEGIBLE"
3. Proporciona la información de manera precisa y exacta
4. Si hay algún carácter especial o acento, mantén la ortografía correcta
5. Para las fechas, usa el formato DD/MM/YYYY si está disponible

Devuelve la información en formato JSON con las siguientes claves:
{
  "name": "NOMBRE COMPLETO",
  "address": "DOMICILIO COMPLETO",
  "voterId": "CLAVE DE ELECTOR",
  "curp": "CURP",
  "registrationYear": "AÑO DE REGISTRO",
  "state": "ESTADO",
  "municipality": "MUNICIPIO",
  "section": "SECCIÓN",
  "locality": "LOCALIDAD",
  "emission": "FECHA DE EMISIÓN",
  "validity": "FECHA DE VIGENCIA"
}

IMPORTANTE: Solo devuelve el objeto JSON, sin texto adicional.
`;

      // Llamar a la API de Gemini con modelo de visión
      const response = await fetch(`https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro-vision:generateContent?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mimeType: 'image/jpeg',
                  data: base64Image.split(',')[1] // Remover el prefijo data:image/jpeg;base64,
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            topK: 32,
            topP: 1,
            maxOutputTokens: 2048,
          }
        })
      });

      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      const result = await response.json();

      if (!result.candidates || result.candidates.length === 0) {
        return {
          success: false,
          error: 'No se pudo procesar la imagen'
        };
      }

      const text = result.candidates[0].content.parts[0].text;

      try {
        // Intentar parsear el JSON de la respuesta
        const extractedData = JSON.parse(text.trim());

        // Validar que todos los campos requeridos estén presentes
        const requiredFields: (keyof INEData)[] = [
          'name', 'address', 'voterId', 'curp', 'registrationYear',
          'state', 'municipality', 'section', 'locality', 'emission', 'validity'
        ];

        const missingFields = requiredFields.filter(field => !extractedData[field]);

        if (missingFields.length > 0) {
          return {
            success: false,
            error: `Campos faltantes: ${missingFields.join(', ')}`
          };
        }

        return {
          success: true,
          data: extractedData as INEData,
          confidence: 0.85 // Gemini no proporciona confianza específica, usamos un valor estimado
        };

      } catch (parseError) {
        console.error('Error parsing OCR result:', parseError);
        return {
          success: false,
          error: 'Error al procesar la respuesta del OCR'
        };
      }

    } catch (error) {
      console.error('OCR processing error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error desconocido en el procesamiento OCR'
      };
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }

  // Método para procesar ambas imágenes del INE
  async processINEImages(frontalImage: File, posteriorImage: File): Promise<OCRResult> {
    try {
      // Procesar solo la imagen frontal (contiene los datos que necesitamos)
      const result = await this.extractINEData(frontalImage);

      if (!result.success) {
        return result;
      }

      // Aquí podríamos validar algunos datos básicos si es necesario
      // Por ejemplo, verificar que el CURP tenga el formato correcto
      if (result.data && result.data.curp) {
        const curpRegex = /^[A-Z]{4}[0-9]{6}[A-Z]{6}[0-9A-Z]{2}$/;
        if (!curpRegex.test(result.data.curp.replace(/\s/g, ''))) {
          console.warn('CURP con formato potencialmente incorrecto:', result.data.curp);
        }
      }

      return result;

    } catch (error) {
      console.error('Error processing INE images:', error);
      return {
        success: false,
        error: 'Error al procesar las imágenes del INE'
      };
    }
  }
}

export const ocrService = new OCRService();
