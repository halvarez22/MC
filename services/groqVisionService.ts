/**
 * Cliente Groq Vision vía proxy SSD `/api/groq-ine`.
 * Nunca envía API keys; nunca llama a api.groq.com desde el browser.
 */

import type { INEStructuredData } from '../types';
import { GROQ_VISION_CLIENT_CONFIG } from './promptTemplates';

export type IneVisionResult = INEStructuredData & {
  raw_ocr_text?: string;
};

function approxDecodedBytes(b64: string): number {
  const clean = b64.replace(/^data:[^;]+;base64,/, '').replace(/\s/g, '');
  return Math.floor((clean.length * 3) / 4);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!(file instanceof File) || file.size === 0) {
      reject(new Error('Archivo inválido'));
      return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] || '');
    };
    reader.onerror = () => reject(reader.error);
  });
}

class GroqVisionService {
  /**
   * Disponibilidad del *path* de producto (flag).
   * La key vive solo en el server; el cliente no puede comprobarla.
   */
  isProxyConfiguredPath(): boolean {
    return true;
  }

  async extractIneFromBase64(
    frontalBase64: string,
    posteriorBase64?: string | null
  ): Promise<IneVisionResult> {
    if (!frontalBase64?.trim()) {
      throw new Error('frontalBase64 requerido');
    }

    const total =
      approxDecodedBytes(frontalBase64) +
      (posteriorBase64 ? approxDecodedBytes(posteriorBase64) : 0);

    if (total > GROQ_VISION_CLIENT_CONFIG.maxCombinedBytes) {
      throw new Error(
        `Imágenes demasiado grandes (${total} bytes > ${GROQ_VISION_CLIENT_CONFIG.maxCombinedBytes})`
      );
    }

    const response = await fetch(GROQ_VISION_CLIENT_CONFIG.proxyPath, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        frontalBase64,
        posteriorBase64: posteriorBase64 || undefined,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data?.error || `Proxy Groq Vision error HTTP ${response.status}`
      );
    }

    const structured = data.structured as IneVisionResult | undefined;
    if (!structured || typeof structured !== 'object') {
      throw new Error('Respuesta del proxy sin structured JSON');
    }

    return structured;
  }

  async extractIneFromFiles(
    frontal: File,
    posterior?: File | null
  ): Promise<IneVisionResult> {
    const frontalBase64 = await fileToBase64(frontal);
    const posteriorBase64 = posterior ? await fileToBase64(posterior) : null;
    return this.extractIneFromBase64(frontalBase64, posteriorBase64);
  }
}

export const groqVisionService = new GroqVisionService();
