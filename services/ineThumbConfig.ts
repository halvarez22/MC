/**
 * APO-ADMIN-INE-THUMB — umbrales + validación JPEG (server y cliente).
 * Un solo módulo para que Vercel NFT empaquete el path del thumb sin saltos rotos.
 */

export const INE_FRONT_THUMB_MAX_EDGE_PX = 400;
export const INE_FRONT_THUMB_JPEG_QUALITY = 0.72;
/** Techo duro del JPEG miniatura (bytes binarios, no base64). */
export const INE_FRONT_THUMB_MAX_BYTES = 120_000;

export const AFFILIATE_MEDIA_COLLECTION = 'affiliate_media';

export function buildIneFrontThumbStoragePath(
  orgId: string,
  affiliateId: string
): string {
  const org = orgId.trim().replace(/[/\\]/g, '_') || 'org_unknown';
  const aff = affiliateId.trim().replace(/[/\\]/g, '_') || 'aff_unknown';
  return `orgs/${org}/affiliates/${aff}/ine_front_thumb.jpg`;
}

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
