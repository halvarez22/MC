/**
 * @deprecated Preferir `ocrOrchestrator` + feature flag `VITE_USE_GROQ_VISION`.
 * Path legado: Google Cloud Vision OCR. No eliminar hasta go/no-go spike ≥90%.
 * Key en cliente vía VITE_* — deuda SSD conocida.
 */
// Servicio de OCR usando Google Vision API
// Más preciso que Tesseract para documentos impresos

export interface VisionOCRResult {
  text: string;
  confidence: number;
  language: string;
}

class GoogleVisionService {
  private apiKey: string;
  private readonly apiUrl = 'https://vision.googleapis.com/v1/images:annotate';

  constructor() {
    this.apiKey = import.meta.env.VITE_GOOGLE_VISION_API_KEY || '';
    if (!this.apiKey || this.apiKey === 'your_google_vision_api_key') {
      console.warn('VITE_GOOGLE_VISION_API_KEY not configured. Google Vision OCR disabled.');
      this.apiKey = '';
    }
  }

  async isAvailable(): Promise<boolean> {
    return this.apiKey !== '';
  }

  async extractText(imageBase64: string): Promise<VisionOCRResult> {
    if (!this.apiKey) {
      throw new Error('Google Vision API key not configured');
    }

    try {
      console.log('🔍 Procesando imagen con Google Vision API...');

      const requestBody = {
        requests: [{
          image: {
            content: imageBase64
          },
          features: [{
            type: 'TEXT_DETECTION',
            maxResults: 1
          }],
          imageContext: {
            languageHints: ['es'], // Español para documentos mexicanos
            textDetectionParams: {
              enableTextDetectionConfidenceScore: true
            }
          }
        }]
      };

      const response = await fetch(`${this.apiUrl}?key=${this.apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`Google Vision API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data = await response.json();

      if (!data.responses || data.responses.length === 0) {
        throw new Error('No response from Google Vision API');
      }

      const result = data.responses[0];

      if (!result.textAnnotations || result.textAnnotations.length === 0) {
        console.warn('⚠️ Google Vision no detectó texto en la imagen');
        return {
          text: '',
          confidence: 0,
          language: 'es'
        };
      }

      // Extraer el texto completo
      const fullText = result.textAnnotations[0].description;

      // Calcular confianza promedio (si está disponible)
      let avgConfidence = 0.8; // Valor por defecto alto para Vision API

      if (result.textAnnotations.length > 1) {
        // Calcular confianza promedio de todas las anotaciones
        const confidences = result.textAnnotations
          .slice(1) // Skip first annotation (full text)
          .map((annotation: any) => annotation.confidence || 0)
          .filter((confidence: number) => confidence > 0);

        if (confidences.length > 0) {
          avgConfidence = confidences.reduce((sum: number, conf: number) => sum + conf, 0) / confidences.length;
        }
      }

      console.log(`✅ Google Vision completado - Confianza: ${(avgConfidence * 100).toFixed(1)}%`);
      console.log(`📝 Texto extraído (${fullText.length} caracteres)`);

      return {
        text: fullText.trim(),
        confidence: avgConfidence,
        language: result.textAnnotations[0].locale || 'es'
      };

    } catch (error) {
      console.error('❌ Error en Google Vision API:', error);
      throw error;
    }
  }

  // Método alternativo usando OCR.space (gratuito, sin API key)
  async extractTextWithOCRspace(imageBase64: string): Promise<VisionOCRResult> {
    try {
      console.log('🔍 Procesando imagen con OCR.space (alternativo)...');

      const formData = new FormData();
      formData.append('base64Image', `data:image/jpeg;base64,${imageBase64}`);
      formData.append('language', 'spa'); // Español
      formData.append('isOverlayRequired', 'false');
      formData.append('isCreateSearchablePdf', 'false');
      formData.append('isSearchablePdfHideTextLayer', 'true');

      const response = await fetch('https://api.ocr.space/parse/image', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error(`OCR.space API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.IsErroredOnProcessing) {
        throw new Error(`OCR.space processing error: ${data.ErrorMessage?.join(', ') || 'Unknown error'}`);
      }

      if (!data.ParsedResults || data.ParsedResults.length === 0) {
        throw new Error('No results from OCR.space');
      }

      const result = data.ParsedResults[0];
      const text = result.ParsedText || '';
      const confidence = parseFloat(result.TextOverlay?.HasOverlay ? '0.85' : '0.7'); // Estimación

      console.log(`✅ OCR.space completado - Confianza estimada: ${(confidence * 100).toFixed(1)}%`);
      console.log(`📝 Texto extraído (${text.length} caracteres)`);

      return {
        text: text.trim(),
        confidence: confidence,
        language: 'es'
      };

    } catch (error) {
      console.error('❌ Error en OCR.space:', error);
      throw error;
    }
  }
}

export const googleVisionService = new GoogleVisionService();
