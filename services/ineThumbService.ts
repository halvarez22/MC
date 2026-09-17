/**
 * APO-ADMIN-INE-THUMB — generar / validar miniatura frontal.
 * Cliente: canvas. Servidor: solo validación de tamaño + magic JPEG.
 */

import {
  INE_FRONT_THUMB_JPEG_QUALITY,
  INE_FRONT_THUMB_MAX_BYTES,
  INE_FRONT_THUMB_MAX_EDGE_PX,
} from './ineThumbConfig';

export function stripDataUrlToBase64(input: string): string {
  const s = String(input || '').trim();
  const m = /^data:image\/[a-zA-Z0-9.+-]+;base64,(.+)$/i.exec(s);
  return m ? m[1]! : s.replace(/\s+/g, '');
}

export function decodeBase64ToBytes(b64: string): Uint8Array {
  const clean = stripDataUrlToBase64(b64);
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(clean, 'base64'));
  }
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function isJpegMagic(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  );
}

export type ThumbValidation =
  | { ok: true; bytes: Uint8Array; byteLength: number }
  | { ok: false; error: string };

export function validateIneFrontThumbBase64(
  input: string | undefined | null,
  maxBytes = INE_FRONT_THUMB_MAX_BYTES
): ThumbValidation {
  if (input == null || !String(input).trim()) {
    return { ok: false, error: 'thumb vacío' };
  }
  let bytes: Uint8Array;
  try {
    bytes = decodeBase64ToBytes(String(input));
  } catch {
    return { ok: false, error: 'base64 inválido' };
  }
  if (bytes.byteLength < 32) {
    return { ok: false, error: 'thumb demasiado pequeño' };
  }
  if (bytes.byteLength > maxBytes) {
    return {
      ok: false,
      error: `thumb excede ${maxBytes} bytes (${bytes.byteLength})`,
    };
  }
  if (!isJpegMagic(bytes)) {
    return { ok: false, error: 'se espera JPEG' };
  }
  return { ok: true, bytes, byteLength: bytes.byteLength };
}

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
    // Si aún grande, bajar calidad
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
