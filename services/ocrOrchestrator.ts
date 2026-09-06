/**
 * Orquestador OCR INE (Tool MCP-like).
 * Feature flag: VITE_USE_GROQ_VISION=true → Groq Vision one-shot vía proxy.
 * Default false → Google Vision + Tesseract (comportamiento legado intacto).
 */

import Tesseract from 'tesseract.js';
import type { INEStructuredData } from '../types';
import { isGroqVisionEnabled } from './featureFlags';
import { googleVisionService } from './googleVisionService';
import { groqVisionService, fileToBase64 } from './groqVisionService';
import { preprocessImageForOCR } from './imageProcessingService';

export type OcrOrchestratorResult = {
  mode: 'groq_vision' | 'legacy_ocr';
  rawText: string;
  structured: INEStructuredData | null;
  imageDataFrontal: string;
  imageDataPosterior: string;
};

async function ocrSideWithLegacy(processed: File): Promise<string> {
  const visionAvailable = await googleVisionService.isAvailable();

  if (visionAvailable) {
    try {
      const imageData = await fileToBase64(processed);
      const visionResult = await googleVisionService.extractText(imageData);
      return visionResult.text;
    } catch (visionError: unknown) {
      const msg = visionError instanceof Error ? visionError.message : String(visionError);
      console.warn('⚠️ Google Vision falló, Tesseract fallback:', msg);
    }
  }

  const {
    data: { text },
  } = await Tesseract.recognize(processed, 'spa', {
    logger: (m) => {
      if (m.status === 'recognizing text') {
        console.log(`OCR progreso: ${(m.progress * 100).toFixed(1)}%`);
      }
    },
  });
  return text;
}

async function extractLegacy(
  frontal: File,
  posterior: File
): Promise<OcrOrchestratorResult> {
  const processedFrontal = await preprocessImageForOCR(frontal);
  const processedPosterior = await preprocessImageForOCR(posterior);

  const frontalText = await ocrSideWithLegacy(processedFrontal);
  const posteriorText = await ocrSideWithLegacy(processedPosterior);

  const rawText = [
    '=== TEXTO FRONTAL ===',
    frontalText.trim(),
    '',
    '=== TEXTO POSTERIOR ===',
    posteriorText.trim(),
  ].join('\n');

  const imageDataFrontal = await fileToBase64(frontal);
  const imageDataPosterior = await fileToBase64(posterior);

  return {
    mode: 'legacy_ocr',
    rawText,
    structured: null,
    imageDataFrontal,
    imageDataPosterior,
  };
}

async function extractGroqVision(
  frontal: File,
  posterior: File
): Promise<OcrOrchestratorResult> {
  const imageDataFrontal = await fileToBase64(frontal);
  const imageDataPosterior = await fileToBase64(posterior);

  const structured = await groqVisionService.extractIneFromBase64(
    imageDataFrontal,
    imageDataPosterior
  );

  const rawText =
    structured.raw_ocr_text ||
    [
      structured.nombre_completo,
      structured.curp,
      structured.clave_elector,
      structured.domicilio,
    ]
      .filter(Boolean)
      .join('\n');

  return {
    mode: 'groq_vision',
    rawText,
    structured,
    imageDataFrontal,
    imageDataPosterior,
  };
}

/**
 * Extrae datos INE según flag + conectividad.
 * - Flag ON + online → Groq Vision proxy (A′1)
 * - Else → legado Vision/Tesseract
 */
export async function extractIneDocument(params: {
  frontal: File;
  posterior: File;
  online?: boolean;
}): Promise<OcrOrchestratorResult> {
  const online = params.online ?? (typeof navigator !== 'undefined' ? navigator.onLine : false);

  if (isGroqVisionEnabled() && online) {
    console.log('🚀 ocrOrchestrator: Groq Vision (feature flag ON)');
    return extractGroqVision(params.frontal, params.posterior);
  }

  console.log('📎 ocrOrchestrator: legado Google Vision / Tesseract');
  return extractLegacy(params.frontal, params.posterior);
}
