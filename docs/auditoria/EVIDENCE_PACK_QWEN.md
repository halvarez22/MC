# EVIDENCE PACK — Auditoría Qwen vs Diagnóstico Cursor

Repo: `c:\IA_nubes\MC` · Generado para validación línea por línea · Sin modificar lógica de producto.

## Mapa hallazgo → evidencia (índice rápido)

| Hallazgo | Archivo | Líneas clave |
|---|---|---|
| God-file (preprocess+Tesseract+Vision+Groq+IndexedDB+UI+sync) | INEProcessor.tsx | L2-7 imports; L33 sync; L46-202 pipeline; L75-148 Tesseract; L178 Groq#1; L171 IndexedDB; L219-448 preprocess; L471-492 Groq#2; L567+ UI |
| Contrato roto: INEStructuredData no está en types | types.ts | Solo `INEData` L21-35; NO existe INEStructuredData |
| Import desde types de tipo inexistente | SelfRegistrationForm.tsx | L2 import; L47 state; L103-115 usa nombre_completo |
| Tipo real vive en groqService | groqService.ts | L4-16 export interface INEStructuredData |
| clearAllInes si pending > 5 | useSyncOffline.ts | L137-156 |
| Groq#3 en sync | useSyncOffline.ts | L52-53 processSingleINE |
| Sin mutex / batch 3 paralelo | useSyncOffline.ts | L108-117 |
| Doble mount useSyncOffline | App.tsx L27 + INEProcessor L33 | (App.tsx adjunto al final del índice) |
| window.VITE_GEMINI_API_KEY en bundle | vite.config.ts | L13-16 |
| Prompt hardcodeado + key cliente | groqService.ts | L22 VITE_GROQ; L37-58 prompt; L60 fetch; L116-134 isAvailable sin mutex |
| constants.tsx NO tiene prompts | constants.tsx | Solo LOGO/ICONS/MEXICAN_STATES — hardcoding real está en groqService + umbrales en INEProcessor L244-245 |

### Nota de precisión (corrección para el auditor)
- `constants.tsx` **no** contiene prompts LLM. El hardcoding de prompts está en `services/groqService.ts` (y umbrales OCR en `INEProcessor.tsx` L244-245: brightness=20, contrast=1.5).
- LOC medidas (líneas no vacías aproximadas vía Measure-Object -Line): INEProcessor **945**, types **72**, SelfRegistrationForm **366**, useSyncOffline **160**, vite **27**, groqService **206**, constants **34**.
- Total de líneas físicas de `INEProcessor.tsx` incluyendo vacías/export: **1072** (última línea `export default`).

---

## 1. INEProcessor.tsx

Path: `components\ine\INEProcessor.tsx`

```tsx
import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import INECapture from './INECapture';
import { groqService, INEStructuredData } from '../../services/groqService';
import { googleVisionService } from '../../services/googleVisionService';
import { savePendingINE } from '../../services/ineOfflineService';
import { useSyncOffline } from '../../hooks/useSyncOffline';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface INEProcessorProps {
  onDataExtracted: (data: INEStructuredData, images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type ProcessorStep = 'capture' | 'processing' | 'ocr_review' | 'ai_processing' | 'review' | 'error';

const INEProcessor: React.FC<INEProcessorProps> = ({ onDataExtracted, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<ProcessorStep>('capture');
  const [images, setImages] = useState<{ frontal: File; posterior: File } | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [correctedText, setCorrectedText] = useState<string>('');
  const [structuredData, setStructuredData] = useState<INEStructuredData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<INEStructuredData | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hook para sincronizaciÃ³n offline
  const { isOnline, syncNow } = useSyncOffline();

  // FunciÃ³n para resetear el estado del procesador INE
  const resetINEProcessor = () => {
    setImages(null);
    setRawText('');
    setCorrectedText('');
    setStructuredData(null);
    setShowErrorModal(false);
    setIsEditing(false);
    setEditedData(null);
  };

  const handleImagesCaptured = async (capturedImages: { frontal: File; posterior: File }) => {
    setImages(capturedImages);
    setCurrentStep('processing');
    setIsProcessing(true);
    setRawText('');
    setStructuredData(null);

    try {
      console.log('ðŸ“· Iniciando procesamiento de INE (frontal + posterior)...');

      // PROCESAR IMAGEN FRONTAL
      console.log('ðŸ› ï¸ Preprocesando imagen frontal...');
      const processedFrontal = await preprocessImageForOCR(capturedImages.frontal);

      // INTENTAR GOOGLE VISION PRIMERO (MUCHO MÃS PRECISO)
      let frontalText = '';
      const visionAvailable = await googleVisionService.isAvailable();

      if (visionAvailable) {
        console.log('ðŸŽ¯ Usando Google Vision API para OCR frontal (alta precisiÃ³n)...');
        try {
          const imageData = await fileToBase64(processedFrontal);
          const visionResult = await googleVisionService.extractText(imageData);
          frontalText = visionResult.text;
          console.log(`âœ… Google Vision frontal completado - Confianza: ${(visionResult.confidence * 100).toFixed(1)}%`);
        } catch (visionError) {
          console.warn('âš ï¸ Google Vision fallÃ³, usando Tesseract como fallback:', visionError.message);
          // Fallback a Tesseract
          console.log('ðŸ”„ Fallback: Usando Tesseract.js para OCR frontal...');
          const { data: { text } } = await Tesseract.recognize(
            processedFrontal,
            'spa',
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  console.log(`OCR frontal progreso: ${(m.progress * 100).toFixed(1)}%`);
                }
              }
            }
          );
          frontalText = text;
        }
      } else {
        console.log('ðŸ“± Google Vision no disponible, usando Tesseract.js para OCR frontal...');
        const { data: { text } } = await Tesseract.recognize(
          processedFrontal,
          'spa',
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`OCR frontal progreso: ${(m.progress * 100).toFixed(1)}%`);
              }
            }
          }
        );
        frontalText = text;
      }

      // PROCESAR IMAGEN POSTERIOR
      console.log('ðŸ› ï¸ Preprocesando imagen posterior...');
      const processedPosterior = await preprocessImageForOCR(capturedImages.posterior);

      // INTENTAR GOOGLE VISION PARA POSTERIOR
      let posteriorText = '';

      if (visionAvailable) {
        console.log('ðŸŽ¯ Usando Google Vision API para OCR posterior...');
        try {
          const imageData = await fileToBase64(processedPosterior);
          const visionResult = await googleVisionService.extractText(imageData);
          posteriorText = visionResult.text;
          console.log(`âœ… Google Vision posterior completado - Confianza: ${(visionResult.confidence * 100).toFixed(1)}%`);
        } catch (visionError) {
          console.warn('âš ï¸ Google Vision posterior fallÃ³, usando Tesseract:', visionError.message);
          // Fallback a Tesseract
          console.log('ðŸ”„ Fallback: Usando Tesseract.js para OCR posterior...');
          const { data: { text } } = await Tesseract.recognize(
            processedPosterior,
            'spa',
            {
              logger: (m) => {
                if (m.status === 'recognizing text') {
                  console.log(`OCR posterior progreso: ${(m.progress * 100).toFixed(1)}%`);
                }
              }
            }
          );
          posteriorText = text;
        }
      } else {
        console.log('ðŸ“± Usando Tesseract.js para OCR posterior...');
        const { data: { text } } = await Tesseract.recognize(
          processedPosterior,
          'spa',
          {
            logger: (m) => {
              if (m.status === 'recognizing text') {
                console.log(`OCR posterior progreso: ${(m.progress * 100).toFixed(1)}%`);
              }
            }
          }
        );
        posteriorText = text;
      }

      // COMBINAR TEXTOS DE AMBAS CARAS
      const combinedText = [
        '=== TEXTO FRONTAL ===',
        frontalText.trim(),
        '',
        '=== TEXTO POSTERIOR ===',
        posteriorText.trim()
      ].join('\n');

      console.log('ðŸ“ Texto combinado extraÃ­do:');
      console.log('Frontal:', frontalText.trim().substring(0, 50) + '...');
      console.log('Posterior:', posteriorText.trim().substring(0, 50) + '...');
      console.log('Total caracteres:', combinedText.length);

      setRawText(combinedText);

      // Convertir imagen a base64 para guardar offline
      const imageData = await fileToBase64(capturedImages.frontal);

      // Guardar siempre en IndexedDB (para offline)
      const savedId = await savePendingINE(combinedText, imageData);
      console.log(`ðŸ’¾ INE guardado offline con ID: ${savedId}`);

      // Procesar con Groq si hay conexiÃ³n
      if (navigator.onLine) {
        console.log('ðŸŒ Procesando con Groq AI...');
        try {
          const structured = await groqService.processINEText(combinedText);
          console.log('âœ… Datos estructurados:', structured);
          setStructuredData(structured);

          // Marcar como procesado en el hook (esto se harÃ¡ automÃ¡ticamente)
          // El hook se encargarÃ¡ de sincronizar cuando sea necesario
        } catch (groqError) {
          console.warn('âš ï¸ Groq fallÃ³, pero el texto crudo estÃ¡ guardado:', groqError);
          // No es error crÃ­tico, el texto crudo ya estÃ¡ guardado
        }
      } else {
        console.log('ðŸ“± Modo offline: INE guardado para procesar despuÃ©s');
      }

      setCurrentStep('ocr_review');

    } catch (error: any) {
      console.error('âŒ Error procesando INE:', error);
      setErrorMessage(error.message || 'Error al procesar las imÃ¡genes del INE');
      setCurrentStep('error');
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Utilidad para convertir File a base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remover el prefijo "data:image/jpeg;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
    });
  };

  // PREPROCESAMIENTO DE IMAGEN PARA MEJORAR OCR
  const preprocessImageForOCR = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('No se pudo crear contexto de canvas'));
        return;
      }

      const img = new Image();
      img.onload = () => {
        // Configurar canvas con dimensiones de la imagen
        canvas.width = img.width;
        canvas.height = img.height;

        // Dibujar imagen original
        ctx.drawImage(img, 0, 0);

        // Obtener datos de imagen
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // 1. MEJORA DE BRILLO Y CONTRASTE (mÃ¡s agresivo para INE)
        console.log('   ðŸ”† Ajustando brillo y contraste (optimizado para INE)...');
        const brightness = 20; // +20 para documentos impresos
        const contrast = 1.5;  // 50% mÃ¡s contraste para texto negro/blanco

        for (let i = 0; i < data.length; i += 4) {
          // Aplicar brillo
          data[i] = Math.min(255, Math.max(0, data[i] + brightness));     // R
          data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness)); // G
          data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness)); // B

          // Aplicar contraste
          data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrast) + 128));
          data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrast) + 128));
          data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrast) + 128));
        }

        // Aplicar cambios
        ctx.putImageData(imageData, 0, 0);

        // 2. CONVERTIR A ESCALA DE GRISES
        console.log('   âš« Convirtiendo a escala de grises...');
        const grayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const grayPixels = grayData.data;

        for (let i = 0; i < grayPixels.length; i += 4) {
          const gray = Math.round(0.299 * grayPixels[i] + 0.587 * grayPixels[i + 1] + 0.114 * grayPixels[i + 2]);
          grayPixels[i] = gray;     // R
          grayPixels[i + 1] = gray; // G
          grayPixels[i + 2] = gray; // B
          // Alpha se mantiene
        }

        ctx.putImageData(grayData, 0, 0);

        // 3. BINARIZACIÃ“N AVANZADA PARA INE
        console.log('   âšª Aplicando binarizaciÃ³n avanzada para documentos...');
        const binaryData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const binaryPixels = binaryData.data;

        // MÃ©todo hÃ­brido: Otsu + umbral fijo agresivo para INE
        const histogram = new Array(256).fill(0);
        for (let i = 0; i < binaryPixels.length; i += 4) {
          histogram[binaryPixels[i]]++;
        }

        let threshold = 128;
        try {
          const otsuThreshold = calculateOtsuThreshold(histogram);
          // Para INE: usar un umbral mÃ¡s agresivo para texto negro sobre blanco
          // INE tÃ­pico tiene pÃ­xeles muy oscuros (texto) y muy claros (fondo)
          threshold = Math.max(otsuThreshold - 20, 90); // MÃ¡s agresivo para texto negro
        } catch (e) {
          console.warn('Error calculando umbral, usando valor conservador');
          threshold = 110; // Umbral conservador pero efectivo para INE
        }

        console.log(`   ðŸ“Š Umbral calculado: ${threshold} (optimizado para INE)`);

        // BINARIZACIÃ“N DOBLE PASADA para mejor calidad
        // Primera pasada: binarizaciÃ³n bÃ¡sica
        for (let i = 0; i < binaryPixels.length; i += 4) {
          const gray = binaryPixels[i];
          const binary = gray > threshold ? 255 : 0;
          binaryPixels[i] = binary;
          binaryPixels[i + 1] = binary;
          binaryPixels[i + 2] = binary;
        }

        // Segunda pasada: limpieza de ruido (eliminar puntos aislados)
        console.log('   ðŸ§¹ Aplicando limpieza de ruido...');
        const cleanedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const cleanedPixels = cleanedData.data;

        // Copiar binarizaciÃ³n inicial
        for (let i = 0; i < cleanedPixels.length; i++) {
          cleanedPixels[i] = binaryPixels[i];
        }

        // Aplicar filtro de mediana simple para reducir ruido
        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            const idx = (y * canvas.width + x) * 4;
            const center = cleanedPixels[idx];

            // Contar pÃ­xeles vecinos del mismo color
            let sameColorNeighbors = 0;
            for (let dy = -1; dy <= 1; dy++) {
              for (let dx = -1; dx <= 1; dx++) {
                if (dx === 0 && dy === 0) continue;
                const nIdx = ((y + dy) * canvas.width + (x + dx)) * 4;
                if (cleanedPixels[nIdx] === center) sameColorNeighbors++;
              }
            }

            // Si menos de 3 vecinos del mismo color, es ruido (cambiar)
            if (sameColorNeighbors < 3) {
              const newColor = center === 255 ? 0 : 255;
              cleanedPixels[idx] = newColor;
              cleanedPixels[idx + 1] = newColor;
              cleanedPixels[idx + 2] = newColor;
            }
          }
        }

        ctx.putImageData(cleanedData, 0, 0);

        // 4. MEJORAR NITIDEZ PARA TEXTO (optimizado para INE)
        console.log('   ðŸ” Aplicando filtro de nitidez avanzado para texto...');
        const sharpenedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const sharpenedPixels = sharpenedData.data;

        // Filtro de nitidez mÃ¡s agresivo para texto (kernel Laplaciano mejorado)
        const kernel = [
          [-1, -1, -1],
          [-1, 9, -1],
          [-1, -1, -1]
        ];

        // Crear copia temporal para el procesamiento
        const tempData = new Uint8ClampedArray(sharpenedPixels);

        for (let y = 1; y < canvas.height - 1; y++) {
          for (let x = 1; x < canvas.width - 1; x++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const pixelIndex = ((y + ky) * canvas.width + (x + kx)) * 4;
                sum += tempData[pixelIndex] * kernel[ky + 1][kx + 1];
              }
            }

            const pixelIndex = (y * canvas.width + x) * 4;
            const sharpened = Math.min(255, Math.max(0, sum));
            sharpenedPixels[pixelIndex] = sharpened;
            sharpenedPixels[pixelIndex + 1] = sharpened;
            sharpenedPixels[pixelIndex + 2] = sharpened;
          }
        }

        ctx.putImageData(sharpenedData, 0, 0);

        // Convertir canvas a File
        canvas.toBlob((blob) => {
          if (blob) {
            const processedFile = new File([blob], 'processed_ine.jpg', { type: 'image/jpeg' });
            console.log('âœ… Imagen preprocesada correctamente');
            resolve(processedFile);
          } else {
            reject(new Error('Error convirtiendo canvas a blob'));
          }
        }, 'image/jpeg', 0.95); // Calidad alta para preservar detalles
      };

      img.onerror = () => reject(new Error('Error cargando imagen'));
      img.src = URL.createObjectURL(file);
    });
  };

  // FunciÃ³n auxiliar para calcular umbral Ã³ptimo usando mÃ©todo Otsu mejorado
  const calculateOtsuThreshold = (histogram: number[]): number => {
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

    // Si no se encontrÃ³ un buen umbral, usar un mÃ©todo mÃ¡s simple
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

  const handleRetryOCR = async () => {
    if (!images) return;

    setCurrentStep('processing');
    setIsProcessing(true);
    setShowErrorModal(false);

    try {
      // Reprocesar la imagen con OCR
      await handleImagesCaptured(images);
    } catch (error) {
      console.error('Error retrying OCR:', error);
      setErrorMessage('Error al reprocesar las imÃ¡genes del INE');
      setCurrentStep('error');
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Procesar el texto corregido con IA
  const handleProcessWithAI = async (textToProcess: string) => {
    setCurrentStep('ai_processing');
    setIsProcessing(true);

    try {
      console.log('ðŸ¤– Procesando texto corregido con Groq AI...');

      const structured = await groqService.processINEText(textToProcess);
      console.log('âœ… Datos estructurados:', structured);
      setStructuredData(structured);

      setCurrentStep('review');

    } catch (error) {
      console.warn('âš ï¸ Error procesando con IA:', error);
      // Si falla la IA, permitir continuar con datos bÃ¡sicos
      setStructuredData(null);
      setCurrentStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar texto OCR (usar sin correcciones)
  const handleConfirmOCRText = () => {
    setCorrectedText(rawText);
    handleProcessWithAI(rawText);
  };

  // Aplicar correcciones y procesar
  const handleApplyCorrections = () => {
    const textToProcess = correctedText.trim() || rawText;
    handleProcessWithAI(textToProcess);
  };

  // Volver a la revisiÃ³n OCR
  const handleBackToOCRReview = () => {
    setCurrentStep('ocr_review');
    setStructuredData(null);
  };

  const handleAcceptData = () => {
    // Usar datos estructurados si existen, sino crear un objeto bÃ¡sico con el texto crudo
    const dataToSend = structuredData || {
      nombre_completo: 'Texto extraÃ­do disponible',
      domicilio: rawText,
      clave_elector: '',
      curp: '',
      fecha_nacimiento: '',
      fecha_emision: '',
      fecha_vigencia: '',
      seccion: '',
      municipio: '',
      estado: '',
      localidad: ''
    };

    if (images) {
      onDataExtracted(dataToSend, images);
    }
  };

  const handleRetryCapture = () => {
    resetINEProcessor();
    setCurrentStep('capture');
  };

  const handleSyncNow = () => {
    syncNow();
  };

  // Funciones para ediciÃ³n manual
  const handleStartEditing = () => {
    setEditedData(structuredData ? { ...structuredData } : null);
    setIsEditing(true);
  };

  const handleSaveEditing = () => {
    if (editedData) {
      setStructuredData(editedData);
      setIsEditing(false);
      console.log('âœ… Datos editados guardados:', editedData);
    }
  };

  const handleCancelEditing = () => {
    setEditedData(null);
    setIsEditing(false);
  };

  const updateEditedField = (field: keyof INEStructuredData, value: string) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value });
    }
  };

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Procesando INE Completo con OCR
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>ðŸ” <strong>Paso 1:</strong> OCR frontal - Nombre, CURP, Domicilio</p>
          <p>ðŸ” <strong>Paso 2:</strong> OCR posterior - Firma, CÃ³digo QR</p>
          {navigator.onLine ? (
            <p>ðŸ¤– <strong>Paso 3:</strong> EstructuraciÃ³n con Groq AI</p>
          ) : (
            <p>ðŸ“± <strong>Modo offline:</strong> Solo OCR local</p>
          )}
          <p className="text-blue-600 font-medium">
            ðŸŽ¯ <strong>OCR Engine:</strong> {googleVisionService.isAvailable() ? 'Google Vision API (Alta PrecisiÃ³n)' : 'Tesseract.js (BÃ¡sico)'}
          </p>
        </div>
        <p className="text-gray-600 mt-3">
          Extrayendo datos de ambas caras de la credencial...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Esto puede tomar mÃ¡s tiempo debido al procesamiento completo
        </p>
      </div>
    </div>
  );

  const renderOCRReview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          ðŸ“ Revisar Texto ExtraÃ­do
        </h3>
        <p className="text-gray-600 mb-4">
          El OCR ha extraÃ­do el siguiente texto. Revisa si es correcto y corrige cualquier error antes de procesar con IA.
        </p>
      </div>

      {/* Vista previa de imÃ¡genes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
        <div className="text-center">
          <h4 className="font-medium text-gray-900 mb-2">INE Frontal</h4>
          <img
            src={URL.createObjectURL(images!.frontal)}
            alt="INE Frontal"
            className="w-full h-32 object-cover rounded-lg border"
          />
        </div>
        <div className="text-center">
          <h4 className="font-medium text-gray-900 mb-2">INE Posterior</h4>
          <img
            src={URL.createObjectURL(images!.posterior)}
            alt="INE Posterior"
            className="w-full h-32 object-cover rounded-lg border"
          />
        </div>
      </div>

      {/* Texto OCR crudo de ambas caras */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">ðŸ“ Texto ExtraÃ­do por OCR (Ambas Caras):</h4>
        <div className="bg-white rounded border p-2 mb-2">
          <div className="text-xs text-gray-500 mb-1">ðŸ’¡ InformaciÃ³n tÃ­pica por cara:</div>
          <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
            <div><strong>Frontal:</strong> Nombre, CURP, Domicilio</div>
            <div><strong>Posterior:</strong> Firma, CÃ³digo QR, Huella</div>
          </div>
        </div>
        <textarea
          value={correctedText || rawText}
          onChange={(e) => setCorrectedText(e.target.value)}
          className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm resize-vertical"
          placeholder="El texto OCR de ambas caras aparecerÃ¡ aquÃ­..."
        />
        <p className="text-xs text-blue-700 mt-2">
          ðŸ’¡ <strong>Tip:</strong> Corrige errores de OCR aquÃ­ antes de enviar a IA. Se procesaron ambas caras del INE para mÃ¡xima precisiÃ³n.
        </p>
      </div>

      {/* InformaciÃ³n sobre el siguiente paso */}
      <div className="bg-green-50 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">ðŸ¤– PrÃ³ximo Paso: Procesamiento con IA</h4>
        <p className="text-green-800 text-sm">
          Una vez que confirmes el texto, la IA analizarÃ¡ el contenido para extraer datos estructurados como nombre, CURP, direcciÃ³n, etc.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={handleRetryCapture} variant="secondary">
          â†» Volver a capturar
        </Button>
        <Button onClick={handleRetryOCR} variant="secondary">
          ðŸ”„ Reprocesar OCR
        </Button>
        <Button onClick={handleConfirmOCRText} className="bg-blue-600 hover:bg-blue-700">
          âœ… Usar texto tal cual
        </Button>
        <Button onClick={handleApplyCorrections} className="bg-green-600 hover:bg-green-700">
          ðŸš€ Aplicar correcciones y procesar
        </Button>
      </div>
    </div>
  );

  const renderAIProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          ðŸ¤– Procesando con Inteligencia Artificial
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>ðŸ“„ <strong>Texto procesado:</strong> InformaciÃ³n de ambas caras del INE</p>
          <p>ðŸ§  <strong>AnÃ¡lisis inteligente:</strong> Extrayendo datos estructurados</p>
          <p>ðŸ“Š <strong>ValidaciÃ³n automÃ¡tica:</strong> Verificando formatos y consistencia</p>
        </div>
        <p className="text-gray-600 mt-3">
          Analizando el texto completo corregido para identificar nombre, CURP, direcciÃ³n, secciÃ³n, etc.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          El procesamiento de ambas caras mejora significativamente la precisiÃ³n
        </p>
      </div>
    </div>
  );

  const renderReview = () => {
    const data = structuredData;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            âœ… Procesamiento Completado
          </h3>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs ${navigator.onLine ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {navigator.onLine ? 'ðŸŒ Online' : 'ðŸ“± Offline'}
            </span>
            <button
              onClick={handleSyncNow}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs hover:bg-blue-200"
            >
              ðŸ”„ Sincronizar ahora
            </button>
          </div>
        </div>

        {/* Vista previa de imÃ¡genes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="text-center">
            <h4 className="font-medium text-gray-900 mb-2">INE Frontal</h4>
            <img
              src={URL.createObjectURL(images!.frontal)}
              alt="INE Frontal"
              className="w-full h-32 object-cover rounded-lg border"
            />
          </div>
          <div className="text-center">
            <h4 className="font-medium text-gray-900 mb-2">INE Posterior</h4>
            <img
              src={URL.createObjectURL(images!.posterior)}
              alt="INE Posterior"
              className="w-full h-32 object-cover rounded-lg border"
            />
          </div>
        </div>

        {/* Texto crudo extraÃ­do de ambas caras */}
        {rawText && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">ðŸ“ Texto ExtraÃ­do (OCR Completo - Ambas Caras):</h4>
            <div className="bg-white rounded border p-2 mb-2">
              <div className="text-xs text-gray-500">âœ… Procesamiento completo del INE realizado</div>
            </div>
            <pre className="text-sm text-blue-800 whitespace-pre-wrap max-h-40 overflow-y-auto bg-white p-2 rounded border">
              {rawText}
            </pre>
          </div>
        )}

        {/* Datos estructurados (solo si existen) */}
        {data && (
          <div className="bg-green-50 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-green-900">ðŸ¤– Datos Estructurados con ValidaciÃ³n:</h4>
              <div className="text-sm">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  ðŸ›¡ï¸ Validado automÃ¡ticamente
                </span>
              </div>
            </div>

            {/* Advertencia sobre revisiÃ³n humana */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>âš ï¸ RevisiÃ³n requerida:</strong> Verifica que los datos sean correctos antes de continuar.
                    Campos con baja confianza (&lt; 60%) necesitan ediciÃ³n manual.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <EditableDataField
                label="Nombre completo"
                value={isEditing && editedData ? editedData.nombre_completo : data.nombre_completo}
                confidence={data.nombre_completo && data.nombre_completo !== 'No se pudo extraer nombre' ? 90 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('nombre_completo', value)}
              />

              <EditableDataField
                label="CURP"
                value={isEditing && editedData ? editedData.curp : data.curp}
                confidence={data.curp && data.curp !== 'No se pudo extraer CURP' ? 95 : 10}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('curp', value)}
                isMonospace={true}
              />

              <EditableDataField
                label="Clave de Elector"
                value={isEditing && editedData ? editedData.clave_elector : data.clave_elector}
                confidence={data.clave_elector && data.clave_elector !== 'No se pudo extraer clave' ? 85 : 15}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('clave_elector', value)}
                isMonospace={true}
              />

              <EditableDataField
                label="Fecha de nacimiento"
                value={isEditing && editedData ? editedData.fecha_nacimiento : data.fecha_nacimiento}
                confidence={data.fecha_nacimiento && data.fecha_nacimiento !== 'No se pudo extraer fecha nacimiento' ? 80 : 25}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('fecha_nacimiento', value)}
              />

              <EditableDataField
                label="Estado"
                value={isEditing && editedData ? editedData.estado : data.estado}
                confidence={data.estado && data.estado !== 'No se pudo extraer estado' ? 85 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('estado', value)}
              />

              <EditableDataField
                label="Municipio"
                value={isEditing && editedData ? editedData.municipio : data.municipio}
                confidence={data.municipio && data.municipio !== 'No se pudo extraer municipio' ? 80 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('municipio', value)}
              />

              <EditableDataField
                label="SecciÃ³n"
                value={isEditing && editedData ? editedData.seccion : data.seccion}
                confidence={data.seccion && data.seccion !== 'No se pudo extraer secciÃ³n' ? 90 : 15}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('seccion', value)}
              />

              <EditableDataField
                label="Localidad"
                value={isEditing && editedData ? editedData.localidad : data.localidad}
                confidence={data.localidad && data.localidad !== 'No se pudo extraer localidad' ? 75 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('localidad', value)}
              />

              <EditableDataField
                label="Fecha de emisiÃ³n"
                value={isEditing && editedData ? editedData.fecha_emision : data.fecha_emision}
                confidence={data.fecha_emision && data.fecha_emision !== 'No se pudo extraer fecha emisiÃ³n' ? 70 : 30}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('fecha_emision', value)}
              />

              <EditableDataField
                label="Fecha de vigencia"
                value={isEditing && editedData ? editedData.fecha_vigencia : data.fecha_vigencia}
                confidence={data.fecha_vigencia && data.fecha_vigencia !== 'No se pudo extraer fecha vigencia' ? 70 : 30}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('fecha_vigencia', value)}
              />

              <EditableDataField
                label="Domicilio"
                value={isEditing && editedData ? editedData.domicilio : data.domicilio}
                confidence={data.domicilio && data.domicilio !== 'No se pudo extraer domicilio' ? 60 : 40}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('domicilio', value)}
                isFullWidth={true}
              />
            </div>
          </div>
        )}

        {!data && rawText && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">âš ï¸ Sin datos estructurados</h4>
            <p className="text-yellow-800 text-sm">
              El texto fue extraÃ­do correctamente, pero no se pudo procesar con Groq AI.
              Puedes continuar con el texto crudo o intentar sincronizar mÃ¡s tarde.
            </p>
          </div>
        )}

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600 mb-3">
            ðŸ’¡ <strong>Â¿Los datos no son correctos?</strong> Puedes editar manualmente los campos o volver a capturar la imagen.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleRetryCapture} variant="secondary">
            â†» Volver a capturar
          </Button>
          <Button onClick={handleRetryOCR} variant="secondary">
            ðŸ”„ Reprocesar OCR
          </Button>

          {isEditing ? (
            <>
              <Button onClick={handleSaveEditing} className="bg-green-600 hover:bg-green-700">
                ðŸ’¾ Guardar cambios
              </Button>
              <Button onClick={handleCancelEditing} variant="outline">
                âŒ Cancelar ediciÃ³n
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleStartEditing} variant="outline">
                âœï¸ Editar datos
              </Button>
              <Button onClick={handleAcceptData} className="bg-green-600 hover:bg-green-700">
                âœ… Confirmar y continuar
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  const renderErrorModal = () => (
    <Modal
      isOpen={showErrorModal}
      onClose={() => setShowErrorModal(false)}
      title="Error en el Procesamiento OCR"
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700">{errorMessage}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button onClick={() => setShowErrorModal(false)} variant="secondary">
            Cerrar
          </Button>
          <Button onClick={handleRetryOCR}>
            ðŸ”„ Reintentar OCR
          </Button>
          <Button onClick={handleRetryCapture}>
            ðŸ“· Volver a capturar
          </Button>
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      {currentStep === 'capture' && (
        <INECapture
          onImagesCaptured={handleImagesCaptured}
          onCancel={onCancel}
        />
      )}

      {currentStep === 'processing' && renderProcessing()}

      {currentStep === 'ocr_review' && renderOCRReview()}

      {currentStep === 'ai_processing' && renderAIProcessing()}

      {currentStep === 'review' && renderReview()}

      {renderErrorModal()}
    </>
  );
};

// Componente para mostrar campos de datos con indicadores de confianza
interface DataFieldProps {
  label: string;
  value: string;
  confidence: number;
  isMonospace?: boolean;
  isFullWidth?: boolean;
}

const DataField: React.FC<DataFieldProps> = ({ label, value, confidence, isMonospace = false, isFullWidth = false }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return 'âœ…';
    if (confidence >= 60) return 'âš ï¸';
    return 'âŒ';
  };

  return (
    <div className={isFullWidth ? 'md:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-gray-700">{label}:</label>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
          {getConfidenceIcon(confidence)} {confidence}%
        </span>
      </div>
      <p className={`text-gray-900 mt-1 ${isMonospace ? 'font-mono' : ''} ${!value || value.startsWith('No se pudo') ? 'text-gray-500 italic' : ''}`}>
        {value || 'No disponible'}
      </p>
    </div>
  );
};

// Componente editable para campos de datos
interface EditableDataFieldProps {
  label: string;
  value: string;
  confidence: number;
  isEditing: boolean;
  onChange: (value: string) => void;
  isMonospace?: boolean;
  isFullWidth?: boolean;
}

const EditableDataField: React.FC<EditableDataFieldProps> = ({
  label,
  value,
  confidence,
  isEditing,
  onChange,
  isMonospace = false,
  isFullWidth = false
}) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return 'âœ…';
    if (confidence >= 60) return 'âš ï¸';
    return 'âŒ';
  };

  return (
    <div className={isFullWidth ? 'md:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-gray-700">{label}:</label>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
          {getConfidenceIcon(confidence)} {confidence}%
        </span>
      </div>

      {isEditing ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isMonospace ? 'font-mono' : ''}`}
          placeholder={`Ingresa ${label.toLowerCase()}`}
        />
      ) : (
        <p className={`text-gray-900 mt-1 ${isMonospace ? 'font-mono' : ''} ${!value || value.startsWith('No se pudo') ? 'text-gray-500 italic' : ''}`}>
          {value || 'No disponible'}
        </p>
      )}
    </div>
  );
};

export default INEProcessor;
```

---

## 2. types.ts

Path: `types.ts`

```ts
// FIX: Added export to make this file a module and defined the necessary types.
export interface User {
  uid: string;
  email: string | null;
  role?: 'admin' | 'brigadista' | 'simpatizante'; // Maintained for application-specific logic
  fullName?: string;
  state?: string;
  city?: string;
  delegation?: string;
  requiresPasswordChange?: boolean;
}

export interface Document {
  id: string;
  type: 'INE Frontal' | 'INE Posterior';
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  fileName?: string;
}

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
  extractedAt: string; // Fecha de extracciÃ³n OCR
  confidence?: number; // Nivel de confianza del OCR
}

export interface Affiliate {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: 'activo' | 'inactivo';
  documentation: Document[];
  ineData?: INEData; // Datos extraÃ­dos del INE mediante OCR
  latitude?: number;
  longitude?: number;
}

export interface DashboardMetrics {
  totalAffiliates: number;
  activePercentage: number;
  docsCompletePercentage: number;
  monthlyGrowth: { month: string; count: number }[];
  geoDistribution: { state: string; count: number }[];
  recentAffiliates: Affiliate[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
}

export interface Notification {
  id: string;
  type: 'new_affiliate' | 'pending_docs';
  message: string;
  timestamp: string;
  read: boolean;
  relatedId: string; // e.g., affiliateId
}
```

---

## 3. SelfRegistrationForm.tsx

Path: `components\auth\SelfRegistrationForm.tsx`

```tsx
import React, { useState } from 'react';
import { Affiliate, Document, User, INEStructuredData } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { offlineService, OfflineRegistration } from '../../services/offlineService';
import { emailService } from '../../services/emailService';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { MEXICAN_STATES, ICONS } from '../../constants';
import INEProcessor from '../ine/INEProcessor';

interface SelfRegistrationFormProps {
  onSuccess: (isOffline: boolean, userRegistered?: boolean) => void;
  isFieldMode?: boolean;
  fieldUser?: User;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


const initialFormData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'> = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: MEXICAN_STATES[0],
    zip: '',
};

const DOCUMENT_TYPES: Document['type'][] = ['INE Frontal', 'INE Posterior'];

const SelfRegistrationForm: React.FC<SelfRegistrationFormProps> = ({ onSuccess, isFieldMode = false, fieldUser }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({});
    const [geolocation, setGeolocation] = useState<{latitude: number, longitude: number} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationMessage, setLocationMessage] = useState('');
    const [showINEProcessor, setShowINEProcessor] = useState(false);
    const [ineData, setIneData] = useState<INEStructuredData | null>(null);
    const [ineImages, setIneImages] = useState<{ frontal: File; posterior: File } | null>(null);
    const [userRegistered, setUserRegistered] = useState(false);

    const resetForm = () => {
        setFormData(initialFormData);
        setUploadedFiles({});
        setGeolocation(null);
        setError(null);
        setLocationMessage('');
        setIneData(null);
        setIneImages(null);
        setUserRegistered(false);
        setShowINEProcessor(false);
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files } = e.target;
        if (files && files.length > 0) {
            setUploadedFiles(prev => ({ ...prev, [name]: files[0] }));
        }
    };
    
    const handleGetLocation = () => {
        setError(null);
        setLocationMessage('Capturando ubicaciÃ³n...');
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGeolocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                    setLocationMessage('UbicaciÃ³n capturada con Ã©xito.');
                },
                (err) => {
                    setError(`Error al obtener la ubicaciÃ³n: ${err.message}`);
                    setGeolocation(null);
                    setLocationMessage('');
                }
            );
        } else {
            setError("La geolocalizaciÃ³n no es soportada por este navegador.");
            setLocationMessage('');
        }
    };

    const handleStartINEProcessing = () => {
        setShowINEProcessor(true);
    };

    const handleINEDataExtracted = (data: INEStructuredData, images: { frontal: File; posterior: File }) => {
        setIneData(data);
        setIneImages(images);

        // Auto-llenar el formulario con los datos extraÃ­dos del INE
        setFormData(prev => ({
            ...prev,
            fullName: data.nombre_completo || prev.fullName,
            address: data.domicilio || prev.address,
            state: data.estado || prev.state,
            city: data.municipio || prev.city,
            zip: prev.zip, // No tenemos cÃ³digo postal en INE
        }));

        // Auto-llenar los archivos de documentos
        setUploadedFiles({
            'INE Frontal': images.frontal,
            'INE Posterior': images.posterior
        });

        setShowINEProcessor(false);
    };

    const handleCancelINEProcessing = () => {
        setShowINEProcessor(false);
    };

    const sendWelcomeEmail = async (email: string, fullName: string, affiliateId?: string) => {
        return await emailService.sendWelcomeEmail({
            to: email,
            fullName: fullName,
            affiliateId: affiliateId
        });
    };

    const registerUserInApp = async (affiliateData: Affiliate) => {
        try {
            // Crear un usuario en la app con rol de simpatizante
            const userData = {
                email: affiliateData.email,
                role: 'simpatizante' as const,
                fullName: affiliateData.fullName,
                state: affiliateData.state,
                city: affiliateData.city,
                requiresPasswordChange: true, // Requiere cambiar contraseÃ±a en primer login
            };

            await firebaseService.createUser(userData);
            setUserRegistered(true);
            return true;
        } catch (error) {
            console.error('Error registrando usuario en la app:', error);
            return false;
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (DOCUMENT_TYPES.some(type => !uploadedFiles[type])) {
            setError('Todos los documentos son requeridos.');
            return;
        }

        if (isFieldMode && !geolocation) {
             if (!confirm("No se ha capturado la geolocalizaciÃ³n. Â¿Deseas continuar de todas formas?")) {
                 return;
             }
        }

        setIsLoading(true);

        try {
            let affiliateData: Affiliate;

            if (isFieldMode && !navigator.onLine) {
                // --- MODO OFFLINE ---
                const documentsWithData = await Promise.all(
                    DOCUMENT_TYPES.map(async type => ({
                        type,
                        fileName: uploadedFiles[type]!.name,
                        dataUrl: await fileToDataUrl(uploadedFiles[type]!)
                    }))
                );

                const offlineReg: OfflineRegistration = {
                    id: `offline_${Date.now()}`,
                    formData: formData,
                    documents: documentsWithData,
                    geolocation: geolocation || undefined
                };

                await offlineService.saveRegistration(offlineReg);
                window.dispatchEvent(new CustomEvent('forceOfflineIndicatorUpdate'));

                // Crear objeto affiliate para el registro de usuario
                affiliateData = {
                    id: offlineReg.id,
                    createdAt: new Date().toISOString(),
                    ...formData,
                    status: 'activo' as const,
                    documentation: documentsWithData.map(doc => ({
                        id: `${doc.type}_${Date.now()}`,
                        type: doc.type,
                        status: 'pending' as const,
                        fileName: doc.fileName
                    })),
                    ineData: ineData ? {
                        name: ineData.nombre_completo || '',
                        address: ineData.domicilio || '',
                        voterId: ineData.clave_elector || '',
                        curp: ineData.curp || '',
                        registrationYear: '',
                        state: ineData.estado || '',
                        municipality: ineData.municipio || '',
                        section: ineData.seccion || '',
                        locality: ineData.localidad || '',
                        emission: ineData.fecha_emision || '',
                        validity: ineData.fecha_vigencia || '',
                        extractedAt: new Date().toISOString(),
                        confidence: 0.8
                    } : undefined,
                    latitude: geolocation?.latitude,
                    longitude: geolocation?.longitude
                };

            } else {
                // --- MODO ONLINE ---
                const documentsToUpload = DOCUMENT_TYPES.map(type => ({
                    type,
                    fileName: uploadedFiles[type]!.name
                    // En una app real, aquÃ­ se subirÃ­a el archivo a un storage y se obtendrÃ­a una URL
                }));

                affiliateData = await firebaseService.registerAffiliate(formData, documentsToUpload, geolocation || undefined);
            }

            // Si se proporcionÃ³ email, registrar usuario en la app y enviar email
            if (formData.email) {
                const userRegistered = await registerUserInApp(affiliateData);
                if (userRegistered) {
                    // Intentar enviar email de bienvenida (no crÃ­tico si falla)
                    try {
                        await sendWelcomeEmail(formData.email, formData.fullName, affiliateData.id);
                        console.log('âœ… Email de bienvenida enviado');
                    } catch (emailError) {
                        console.warn('âš ï¸ No se pudo enviar email de bienvenida, pero el registro fue exitoso:', emailError);
                    }
                } else {
                    console.warn('âš ï¸ No se pudo registrar usuario en la app, pero el afiliado fue registrado');
                }
            }

            resetForm();
            onSuccess(!navigator.onLine, userRegistered);

        } catch (err: any) {
            setError(err.message || 'OcurriÃ³ un error durante el registro.');
        } finally {
            setIsLoading(false);
        }
    };


    // Mostrar INEProcessor cuando estÃ© activo
    if (showINEProcessor) {
        return (
            <INEProcessor
                onDataExtracted={handleINEDataExtracted}
                onCancel={handleCancelINEProcessing}
            />
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* SecciÃ³n de captura de INE */}
            {isFieldMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">ðŸ“· Captura de Credencial de Elector</h3>
                    <p className="text-blue-800 mb-4">
                        Solicita al simpatizante que te permita tomar fotos de ambos lados de su INE.
                        Los datos se extraerÃ¡n automÃ¡ticamente mediante OCR.
                    </p>

                    {!ineData ? (
                        <Button
                            type="button"
                            onClick={handleStartINEProcessing}
                            variant="secondary"
                            className="w-full sm:w-auto"
                        >
                            <span className="mr-2">ðŸ“·</span>
                            Iniciar Captura de INE
                        </Button>
                    ) : (
                        <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-800">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">Datos extraÃ­dos exitosamente del INE</span>
                            </div>
                            <p className="text-sm text-green-700 mt-1">
                                Los datos del formulario se han completado automÃ¡ticamente.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input id="fullName" name="fullName" label="Nombre Completo" value={formData.fullName} onChange={handleChange} required />
                <Input
                    id="email"
                    name="email"
                    label="Correo ElectrÃ³nico (Opcional)"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Se usarÃ¡ para crear cuenta en la app y enviar confirmaciÃ³n"
                />
                <Input id="phone" name="phone" label="TelÃ©fono" type="tel" value={formData.phone} onChange={handleChange} required />
                <Input id="address" name="address" label="DirecciÃ³n" value={formData.address} onChange={handleChange} required />
                <Input id="city" name="city" label="Ciudad" value={formData.city} onChange={handleChange} required />
                <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">Estado</label>
                    <select
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md min-h-[44px]"
                    >
                        {MEXICAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                </div>
                <Input id="zip" name="zip" label="CÃ³digo Postal" value={formData.zip} onChange={handleChange} required />
            </div>

            {isFieldMode && (
                <div className="pt-4 border-t">
                    <h4 className="text-lg font-medium text-gray-800 mb-2">GeolocalizaciÃ³n</h4>
                    <div className="flex items-center gap-4 flex-wrap">
                        <Button type="button" variant="secondary" onClick={handleGetLocation}>
                             <span className="mr-2">{ICONS.gps}</span>
                             Capturar UbicaciÃ³n Actual
                        </Button>
                        {geolocation && (
                             <div className="text-green-600 font-semibold flex items-center gap-2 text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="truncate">
                                    {`Lat: ${geolocation.latitude.toFixed(4)}, Lon: ${geolocation.longitude.toFixed(4)}`}
                                </span>
                            </div>
                        )}
                    </div>
                    {locationMessage && <p className={`text-sm mt-2 ${locationMessage.includes('Ã©xito') ? 'text-green-600' : 'text-gray-600'}`}>{locationMessage}</p>}
                </div>
            )}

            {/* Mostrar estado de documentos */}
            <div className="pt-4 border-t">
                <h4 className="text-lg font-medium text-gray-800 mb-4">Estado de Documentos</h4>
                {ineData ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-medium text-green-900 mb-2">âœ… Documentos capturados automÃ¡ticamente</h5>
                        <div className="text-sm text-green-800 space-y-1">
                            <p>â€¢ INE Frontal: Capturado</p>
                            <p>â€¢ INE Posterior: Capturado</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 className="font-medium text-yellow-900 mb-2">âš ï¸ Documentos requeridos</h5>
                        <p className="text-sm text-yellow-800 mb-3">
                            Los documentos se capturarÃ¡n automÃ¡ticamente mediante el proceso de OCR arriba.
                        </p>
                        {DOCUMENT_TYPES.map(type => (
                            <p key={type} className="text-sm text-yellow-700">â€¢ {type}: Pendiente</p>
                        ))}
                    </div>
                )}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <div className="flex justify-end pt-4">
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full md:w-auto"
                    disabled={!ineData && isFieldMode}
                >
                    {isFieldMode ? 'Registrar Afiliado' : 'Enviar Registro'}
                </Button>
            </div>
        </form>
    );
};

export default SelfRegistrationForm;
```

---

## 4. useSyncOffline.ts

Path: `hooks\useSyncOffline.ts`

```ts
// Hook para sincronizaciÃ³n automÃ¡tica de INEs offline
// Procesa INEs pendientes cuando hay conexiÃ³n a internet

import { useEffect, useCallback } from 'react';
import {
  getUnprocessedInes,
  markINEAsProcessed,
  getINEStats,
  repairCorruptedInes
} from '../services/ineOfflineService';
import { groqService } from '../services/groqService';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  processedCount: number;
  lastSync?: Date;
  error?: string;
}

export const useSyncOffline = () => {
  // FunciÃ³n para enviar datos al backend (adaptar segÃºn tu API)
  const sendToBackend = useCallback(async (structuredData: any): Promise<boolean> => {
    try {
      // AquÃ­ puedes integrar con tu servicio de Firebase o API
      // Por ahora solo simulamos el envÃ­o
      console.log('Enviando al backend:', structuredData);

      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 500));

      // AquÃ­ irÃ­a tu llamada real al backend
      // const response = await fetch('/api/submit-ine', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(structuredData)
      // });
      // return response.ok;

      return true; // Simular Ã©xito
    } catch (error) {
      console.error('Error enviando al backend:', error);
      return false;
    }
  }, []);

  // Procesar una INE individual
  const processSingleINE = useCallback(async (ine: any) => {
    try {
      console.log(`Procesando INE ${ine.id}...`);

      // Procesar con Groq
      const structuredData = await groqService.processINEText(ine.rawText);

      // Marcar como procesada en local
      await markINEAsProcessed(ine.id, structuredData);

      // Enviar al backend si hay conexiÃ³n
      if (navigator.onLine) {
        const success = await sendToBackend(structuredData);
        if (success) {
          console.log(`âœ… INE ${ine.id} procesada y enviada al backend`);
        } else {
          console.warn(`âš ï¸ INE ${ine.id} procesada pero no enviada al backend`);
        }
      }

      return true;
    } catch (error) {
      console.error(`âŒ Error procesando INE ${ine.id}:`, error);
      return false;
    }
  }, [sendToBackend]);

  // Sincronizar todas las INEs pendientes
  const syncPendingInes = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('ðŸ”Œ Sin conexiÃ³n, saltando sincronizaciÃ³n');
      return;
    }

    try {
      console.log('ðŸ”„ Iniciando sincronizaciÃ³n de INEs offline...');

      // Primero, intentar reparar registros corruptos
      try {
        await repairCorruptedInes();
        console.log('ðŸ”§ Registros corruptos reparados');
      } catch (repairError) {
        console.warn('âš ï¸ No se pudieron reparar registros corruptos:', repairError);
      }

      const unprocessedInes = await getUnprocessedInes();
      console.log(`ðŸ“‹ Encontradas ${unprocessedInes.length} INEs pendientes`);

      if (unprocessedInes.length === 0) {
        console.log('âœ… No hay INEs pendientes de procesar');
        return;
      }

      // Verificar que Groq estÃ© disponible
      const groqAvailable = await groqService.isAvailable();
      if (!groqAvailable) {
        console.warn('âš ï¸ Groq no disponible, esperando prÃ³xima sincronizaciÃ³n');
        return;
      }

      // Procesar INEs en lotes para no sobrecargar
      const batchSize = 3;
      let processed = 0;

      for (let i = 0; i < unprocessedInes.length; i += batchSize) {
        const batch = unprocessedInes.slice(i, i + batchSize);
        console.log(`Procesando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(unprocessedInes.length/batchSize)}`);

        const promises = batch.map(processSingleINE);
        const results = await Promise.allSettled(promises);

        processed += results.filter(result => result.status === 'fulfilled' && result.value).length;

        // PequeÃ±o delay entre lotes
        if (i + batchSize < unprocessedInes.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const stats = await getINEStats();
      console.log(`ðŸŽ‰ SincronizaciÃ³n completada: ${processed} procesadas, ${stats.pending} pendientes`);

    } catch (error) {
      console.error('âŒ Error en sincronizaciÃ³n:', error);
    }
  }, [processSingleINE]);

  // Configurar sincronizaciÃ³n automÃ¡tica
  useEffect(() => {
    // LIMPIAR DATOS ANTIGUOS AL INICIO (una sola vez)
    const cleanupOldData = async () => {
      try {
        console.log('ðŸ§¹ Verificando datos antiguos de INE...');
        const { getINEStats } = await import('../services/ineOfflineService');
        const stats = await getINEStats();

        if (stats.pending > 5) {
          console.log(`âš ï¸ Muchos INEs pendientes (${stats.pending}), limpiando para mejor rendimiento...`);
          const { clearAllInes } = await import('../services/ineOfflineService');
          await clearAllInes();
          console.log('âœ… Datos antiguos limpiados');
        }
      } catch (error) {
        console.warn('No se pudieron limpiar datos antiguos:', error);
      }
    };

    // Ejecutar limpieza inmediata
    cleanupOldData();

    // DELAY PARA NO BLOQUEAR EL RENDERIZADO INICIAL
    const initialSyncTimeout = setTimeout(() => {
      console.log('ðŸ”„ SincronizaciÃ³n inicial de INEs (con delay)...');
      syncPendingInes();
    }, 3000); // 3 segundos de delay (mÃ¡s tiempo)

    // Sincronizar cuando se recupera la conexiÃ³n
    const handleOnline = () => {
      console.log('ðŸŒ ConexiÃ³n recuperada, iniciando sincronizaciÃ³n...');
      // Delay pequeÃ±o para asegurar que la conexiÃ³n estÃ© estable
      setTimeout(() => syncPendingInes(), 1000);
    };

    window.addEventListener('online', handleOnline);

    // Sincronizar periÃ³dicamente (cada 10 minutos, no 5) si hay conexiÃ³n
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        console.log('â° SincronizaciÃ³n periÃ³dica automÃ¡tica...');
        syncPendingInes();
      }
    }, 10 * 60 * 1000); // 10 minutos (menos agresivo)

    return () => {
      clearTimeout(initialSyncTimeout);
      window.removeEventListener('online', handleOnline);
      clearInterval(intervalId);
    };
  }, [syncPendingInes]);

  // Retornar estado y funciones Ãºtiles
  return {
    syncNow: syncPendingInes,
    isOnline: navigator.onLine,
  };
};
```

---

## 5. vite.config.ts

Path: `vite.config.ts`

```ts
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react()],
      server: {
        port: 3000,
        host: '0.0.0.0'
      },
      define: {
        // Hacer disponible la API key globalmente en el navegador
        'window.VITE_GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      publicDir: 'public',
      build: {
        assetsDir: 'assets',
        outDir: 'dist'
      }
    };
});
```

---

## 6. groqService.ts

Path: `services\groqService.ts`

```ts
// Servicio para procesar texto OCR con Groq AI
// Estructura los datos extraÃ­dos de INEs mexicanas

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
        // Modo mock: generar datos simulados basados en el texto extraÃ­do
        console.log('ðŸ¤– Usando datos simulados (modo testing)');
        return this.generateMockData(rawText);
      }

      const prompt = `Extrae informaciÃ³n de esta credencial INE mexicana. Devuelve solo JSON:

TEXTO OCR: "${rawText}"

FORMATO REQUERIDO:
{
  "nombre_completo": "NOMBRE COMPLETO",
  "curp": "CURP_18_CARACTERES",
  "clave_elector": "CLAVE_18_CARACTERES",
  "fecha_nacimiento": "DD/MM/YYYY",
  "estado": "NOMBRE_ESTADO",
  "municipio": "NOMBRE_MUNICIPIO",
  "seccion": "NUMERO",
  "domicilio": "DIRECCION_COMPLETA"
}

INSTRUCCIONES:
- Extrae solo datos presentes en el texto
- CURP y clave deben tener exactamente 18 caracteres
- Si no encuentras un dato, omÃ­telo del JSON
- MantÃ©n formato y ortografÃ­a exacta
- Solo devuelve el objeto JSON, nada mÃ¡s`;

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
        throw new Error('Respuesta vacÃ­a de Groq');
      }

      try {
        const structuredData = JSON.parse(content.trim()) as INEStructuredData;

        // ValidaciÃ³n bÃ¡sica
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
        throw new Error('Respuesta de Groq no es JSON vÃ¡lido');
      }

    } catch (error) {
      console.error('Groq processing error:', error);
      throw error instanceof Error ? error : new Error('Error desconocido en Groq');
    }
  }

  // MÃ©todo para validar si el servicio estÃ¡ disponible
  async isAvailable(): Promise<boolean> {
    try {
      if (!this.apiKey) return false;

      // Prueba simple con un texto mÃ­nimo
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
    // Extraer datos REALES del texto OCR con anÃ¡lisis inteligente
    console.log('ðŸ” Extrayendo datos reales del texto OCR...');

    const lines = rawText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    console.log('ðŸ“ LÃ­neas procesadas:', lines.length);

    // Usar anÃ¡lisis inteligente en lugar de lÃ³gica hardcoded
    const extractedData = this.extractDataIntelligently(lines);

    // Retornar datos validados
    return extractedData;
  }

  private extractDataIntelligently(lines: string[]): INEStructuredData {
    const result: INEStructuredData = {};

    // Unir todas las lÃ­neas para anÃ¡lisis global
    const fullText = lines.join(' ').toUpperCase();

    // PATRÃ“N 1: CURP - 18 caracteres alfanumÃ©ricos con estructura especÃ­fica
    const curpPattern = /[A-Z]{4}\d{6}[HM][A-Z]{5}\d{2}/g;
    const curpMatch = fullText.match(curpPattern);
    if (curpMatch && curpMatch[0].length === 18) {
      result.curp = curpMatch[0];
    }

    // PATRÃ“N 2: CLAVE DE ELECTOR - 18 caracteres alfanumÃ©ricos
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

    // PATRÃ“N 3: NOMBRE COMPLETO - buscar lÃ­neas que parezcan nombres
    for (const line of lines) {
      // Buscar lÃ­neas con mÃºltiples palabras que parezcan nombres
      if (line.split(' ').length >= 2 &&
          line.length > 10 &&
          line.length < 50 &&
          !line.includes('DOMICILIO') &&
          !line.includes('SECCIÃ“N') &&
          !line.includes('MUNICIPIO') &&
          !/\d{4}/.test(line)) { // Evitar lÃ­neas con aÃ±os

        // Verificar que no sea una direcciÃ³n (no contener nÃºmeros de calle tÃ­picos)
        if (!/\b\d{1,4}\s/.test(line) && !line.includes('VIA') && !line.includes('CALLE')) {
          result.nombre_completo = line.trim();
          break;
        }
      }
    }

    // PATRÃ“N 4: FECHAS - buscar formatos DD/MM/YYYY o DD-MM-YYYY
    const datePattern = /\b\d{1,2}[-\/]\d{1,2}[-\/]\d{4}\b/g;
    const dateMatches = fullText.match(datePattern);
    if (dateMatches && dateMatches.length > 0) {
      result.fecha_nacimiento = dateMatches[0];
    }

    // PATRÃ“N 5: SECCIÃ“N ELECTORAL
    const seccionPattern = /(?:SECCIÃ“N|SECCION)\s*(\d+)/i;
    const seccionMatch = fullText.match(seccionPattern);
    if (seccionMatch) {
      result.seccion = seccionMatch[1];
    }

    // PATRÃ“N 6: ESTADO - buscar nombres de estados mexicanos
    const estadosMexicanos = [
      'AGUASCALIENTES', 'BAJA CALIFORNIA', 'BAJA CALIFORNIA SUR', 'CAMPECHE',
      'CHIAPAS', 'CHIHUAHUA', 'CIUDAD DE MÃ‰XICO', 'COAHUILA', 'COLIMA',
      'DURANGO', 'GUANAJUATO', 'GUERRERO', 'HIDALGO', 'JALISCO', 'MÃ‰XICO',
      'MICHOACÃN', 'MORELOS', 'NAYARIT', 'NUEVO LEÃ“N', 'OAXACA', 'PUEBLA',
      'QUERÃ‰TARO', 'QUINTANA ROO', 'SAN LUIS POTOSÃ', 'SINALOA', 'SONORA',
      'TABASCO', 'TAMAULIPAS', 'TLAXCALA', 'VERACRUZ', 'YUCATÃN', 'ZACATECAS'
    ];

    for (const estado of estadosMexicanos) {
      if (fullText.includes(estado)) {
        result.estado = estado;
        break;
      }
    }

    // PATRÃ“N 7: DOMICILIO - buscar lÃ­neas que contengan direcciones
    for (const line of lines) {
      if ((line.includes('VIA') || line.includes('CALLE') || line.includes('AVENIDA') ||
           /\b\d{1,4}\s/.test(line)) && line.length > 15) {
        result.domicilio = line.trim();
        break;
      }
    }

    console.log('ðŸ“Š Datos extraÃ­dos inteligentemente:', result);
    return result;
  }


}

export const groqService = new GroqService();
```

---

## 7. constants.tsx

Path: `constants.tsx`

```tsx
// FIX: Implemented the constants file, exporting LOGO, ICONS, and MEXICAN_STATES to resolve multiple module import errors across the application.
import React from 'react';

export const LOGO = (
  <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export const ICONS = {
  dashboard: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M9 4v16M15 4v16" /></svg>,
  affiliates: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4a4 4 0 100 8 4 4 0 000-8z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 20v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.88 18.09A5.966 5.966 0 0018 16a5.966 5.966 0 00-2.88 2.09" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 8a3 3 0 100-6 3 3 0 000 6z" />
  </svg>,
  audit: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  userManagement: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  menu: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" /></svg>,
  bell: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6 6 0 10-12 0v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>,
  logout: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>,
  users: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 21a6 6 0 00-9-5.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-3-5.197m0 0A4 4 0 0012 4.354m0 5.292a4 4 0 010-5.292" /></svg>,
  active: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  docs: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
  gps: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  ineData: <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" /></svg>,
};

export const MEXICAN_STATES = [
  'Aguascalientes', 'Baja California', 'Baja California Sur', 'Campeche', 'Chiapas',
  'Chihuahua', 'Coahuila', 'Colima', 'Durango', 'Guanajuato', 'Guerrero',
  'Hidalgo', 'Jalisco', 'MÃ©xico', 'MichoacÃ¡n', 'Morelos', 'Nayarit', 'Nuevo LeÃ³n',
  'Oaxaca', 'Puebla', 'QuerÃ©taro', 'Quintana Roo', 'San Luis PotosÃ­', 'Sinaloa',
  'Sonora', 'Tabasco', 'Tamaulipas', 'Tlaxcala', 'Veracruz', 'YucatÃ¡n', 'Zacatecas',
  'Ciudad de MÃ©xico'
].sort();
```

---

## 8. App.tsx (evidencia doble mount useSyncOffline)

Path: `App.tsx`

```tsx
import React, { useState, useEffect } from 'react';
import { User } from './types';
import { firebaseService } from './services/firebaseService';
import { offlineService } from './services/offlineService';
import { useSyncOffline } from './hooks/useSyncOffline';
import LoginView from './views/LoginView';
import Layout from './components/layout/Layout';
import DashboardView from './views/DashboardView';
import AffiliatesView from './views/AffiliatesView';
import AuditLogView from './views/AuditLogView';
import Spinner from './components/ui/Spinner';
import RegisterView from './views/RegisterView';
import FieldView from './views/FieldView';
import UsersView from './views/UsersView';
import ForcePasswordChangeView from './views/ForcePasswordChangeView';
import INEDataView from './views/INEDataView';

export type View = 'dashboard' | 'affiliates' | 'audit' | 'users' | 'ine-data';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Hook para sincronizaciÃ³n offline de INEs
  useSyncOffline();

  useEffect(() => {
    const unsubscribe = firebaseService.auth.onAuthStateChanged(currentUser => {
      console.log('ðŸ” Estado de autenticaciÃ³n cambiado:', currentUser);
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.role === 'admin') {
          setCurrentView('dashboard');
        } else if (currentUser.role === 'brigadista') {
          // Los brigadistas van directo al modo campo (afiliaciones)
          console.log('ðŸ‘· Brigadista autenticado, redirigiendo a modo campo');
        }
      }
      setLoading(false);
    });

    const handleAuthChange = () => {
        const userJson = localStorage.getItem('firebase.auth.user');
        const updatedUser = userJson ? JSON.parse(userJson) : null;
        setUser(updatedUser);
        if (updatedUser && updatedUser.role === 'admin') {
            setCurrentView('dashboard');
        }
        if (updatedUser && updatedUser.role === 'brigadista') {
            setCurrentView('dashboard'); // Los brigadistas van directo a afiliaciones
        }
    }
    window.addEventListener('authChanged', handleAuthChange);

    // SINCRONIZACIÃ“N SIMPLIFICADA - EL HOOK useSyncOffline SE ENCARGARÃ
    console.log("ðŸ“± SincronizaciÃ³n delegada al hook useSyncOffline");

    return () => {
        unsubscribe();
        window.removeEventListener('authChanged', handleAuthChange);
    };
  }, []);

  const handleLogout = async () => {
    console.log('ðŸšª Cerrando sesiÃ³n...');
    try {
      // Limpiar completamente la sesiÃ³n
      localStorage.removeItem('firebase.auth.user');
      sessionStorage.clear(); // Por si acaso queda algo

      await firebaseService.auth.signOut();
      setUser(null);
      setAuthView('login');
      setCurrentView('dashboard');

      console.log('âœ… SesiÃ³n cerrada exitosamente');
    } catch (error) {
      console.error('âŒ Error al cerrar sesiÃ³n:', error);
      // Forzar limpieza aunque haya error
      localStorage.removeItem('firebase.auth.user');
      setUser(null);
    }
  };

  const handlePasswordChanged = () => {
    // Actualiza el estado local del usuario para reflejar el cambio
    // y permitir que la aplicaciÃ³n renderice la vista correcta.
    if (user) {
      const updatedUser = { ...user, requiresPasswordChange: false };
      setUser(updatedUser);
      // TambiÃ©n actualiza sessionStorage para persistir el cambio en la sesiÃ³n
      sessionStorage.setItem('firebase.auth.user', JSON.stringify(updatedUser));
    }
  };

  // FunciÃ³n de seguridad: verificar permisos de acceso
  const checkUserAccess = (requiredRole?: 'admin' | 'brigadista') => {
    if (!user) return false;
    if (!requiredRole) return true; // Si no requiere rol especÃ­fico, solo autenticaciÃ³n
    return user.role === requiredRole;
  };

  const renderAdminView = () => {
    // VerificaciÃ³n de seguridad: solo admins pueden acceder a estas vistas
    if (!checkUserAccess('admin')) {
      console.warn('ðŸš« Intento de acceso no autorizado a vista de admin');
      return <div className="text-center text-red-600 p-8">
        <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
        <p>No tienes permisos para acceder a esta secciÃ³n.</p>
      </div>;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'affiliates':
        return <AffiliatesView user={user!} />;
      case 'audit':
        return <AuditLogView />;
      case 'users':
        return <UsersView user={user!} />;
      case 'ine-data':
        return <INEDataView />;
      default:
        return <DashboardView />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // --- Enrutamiento basado en Rol y Estado de ContraseÃ±a ---
  if (user) {
    // Prioridad 1: Forzar cambio de contraseÃ±a si es requerido
    if (user.requiresPasswordChange) {
      return <ForcePasswordChangeView onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />;
    }

    // Prioridad 2: Enrutamiento basado en Rol
    if (user.role === 'brigadista') {
      return <FieldView user={user} onLogout={handleLogout} />;
    }
    
    if (user.role === 'admin') {
      return (
        <Layout
          user={user}
          onLogout={handleLogout}
          currentView={currentView}
          onNavigate={setCurrentView}
        >
          {renderAdminView()}
        </Layout>
      );
    }
  }
  
  // Sin usuario o con rol no vÃ¡lido: Mostrar vistas de autenticaciÃ³n
  if (authView === 'register') {
    return <RegisterView onNavigateToLogin={() => setAuthView('login')} />;
  }
  return <LoginView onNavigateToRegister={() => setAuthView('register')} />;
}

export default App;
```

---

## 9. Reporte canvas (texto completo)

### Veredicto
Cumplimiento global estimado **30/100**.

### Scores por regla
1. APO / Planning: **10** — Incumple
2. HRU: **25** — Incumple
3. Anti-God: **20** — Incumple
4. U-First: **62** — Parcial
5. SSD Seguridad: **38** — Incumple
6. SQA / Strangler: **15** — Incumple
7. MCP Readiness: **25** — Incumple
8. Contratos: **45** — Parcial

### Matriz (hallazgo clave)
- R1: Sin implementation_plan.md; hotfixes (calidad OFF, sync wipe)
- R2: Prompts/umbrales hardcodeados; solo JPEG cámara; sin PDF/texto unificado
- R3: INEProcessor mezcla preprocess + Tesseract + Vision + Groq + UI
- R4: Buenos Volver/Reintentar en INE; callejones en processing/AI y sync
- R5: VITE_* keys en bundle; PII a LLM sin sanitizar; mock passwords
- R6: Sin vitest/jest; hasta 3× Groq por INE; ocrService Gemini legado
- R7: Tesseract/preprocess en UI; prompts no centralizados; sin Tools PDF
- R8: INEStructuredData importado desde types pero no existe allí

### Riesgos SSD
- Alta: API keys LLM/OCR en cliente (VITE_*)
- Alta: PII INE a terceros sin sanitizar
- Alta: clearAllInes si pending > 5
- Alta: Auth mock + localStorage
- Media: Sin validación File/MIME/tamaño
- Media: IndexedDB base64 sin cifrado

### Idempotencia — 3× Groq
1. Captura online → processINEText (INEProcessor ~L178)
2. Botón Usar texto / Aplicar correcciones → handleProcessWithAI (~L478)
3. Sync useSyncOffline → processSingleINE (~L53)
Plus: App.tsx + INEProcessor montan useSyncOffline dos veces.

### Roadmap a 100%
0 APO · 1 Contratos · 2 Extraer motores · 3 Config/prompts · 4 SSD proxy · 5 Idempotencia · 6 Universalidad · 7 SQA · 8 U-First cierre

