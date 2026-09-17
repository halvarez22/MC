/**
 * APO-ADMIN-INE-THUMB — generar miniatura frontal (solo navegador / canvas).
 */

import {
  INE_FRONT_THUMB_JPEG_QUALITY,
  INE_FRONT_THUMB_MAX_BYTES,
  INE_FRONT_THUMB_MAX_EDGE_PX,
  decodeBase64ToBytes,
  stripDataUrlToBase64,
  validateIneFrontThumbBase64,
} from './ineThumbConfig.js';

export {
  stripDataUrlToBase64,
  decodeBase64ToBytes,
  isJpegMagic,
  validateIneFrontThumbBase64,
  type ThumbValidation,
} from './ineThumbConfig.js';

/**
 * Redimensiona imagen (data URL, base64 o Blob/File) a miniatura JPEG.
 * Solo navegador (canvas). En Node retorna null.
 */
export async function buildIneFrontThumbBase64(
  source: string | Blob,
  opts?: { maxEdgePx?: number; quality?: number; maxBytes?: number }
): Promise<string | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return null;
  }

  const maxEdge = opts?.maxEdgePx ?? INE_FRONT_THUMB_MAX_EDGE_PX;
  const quality = opts?.quality ?? INE_FRONT_THUMB_JPEG_QUALITY;
  const maxBytes = opts?.maxBytes ?? INE_FRONT_THUMB_MAX_BYTES;

  let blob: Blob;
  if (typeof source === 'string') {
    const raw = source.trim();
    if (raw.startsWith('data:')) {
      const res = await fetch(raw);
      blob = await res.blob();
    } else if (/^[A-Za-z0-9+/=\s]+$/.test(raw) && raw.length > 64) {
      const bytes = decodeBase64ToBytes(raw);
      blob = new Blob([bytes], { type: 'image/jpeg' });
    } else {
      const res = await fetch(raw);
      blob = await res.blob();
    }
  } else {
    blob = source;
  }

  const bitmap = await createImageBitmap(blob);
  try {
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0, w, h);

    let q = quality;
    let dataUrl = canvas.toDataURL('image/jpeg', q);
    let check = validateIneFrontThumbBase64(dataUrl, maxBytes);
    while (check.ok === false && q > 0.4) {
      q -= 0.1;
      dataUrl = canvas.toDataURL('image/jpeg', q);
      check = validateIneFrontThumbBase64(dataUrl, maxBytes);
    }
    if (check.ok === false) return null;
    return stripDataUrlToBase64(dataUrl);
  } finally {
    bitmap.close();
  }
}
