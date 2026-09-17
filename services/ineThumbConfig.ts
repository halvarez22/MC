/**
 * APO-ADMIN-INE-THUMB — umbrales tipados (cero hardcoding en UI).
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
