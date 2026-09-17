/**
 * APO-ADMIN-INE-THUMB — leer miniatura frontal (solo Admin Bearer).
 */

const THUMB_PATH = '/api/affiliates/secure-list';

export function isIneFrontThumbUiEnabled(): boolean {
  return (
    String(import.meta.env.VITE_USE_INE_FRONT_THUMB ?? 'true').toLowerCase() !==
    'false'
  );
}

export async function fetchAffiliateFrontThumb(
  affiliateId: string
): Promise<
  | { ok: true; dataUrl: string; byteLength: number }
  | { ok: false; error: string; status?: number }
> {
  const id = affiliateId.trim();
  if (!id) return { ok: false, error: 'affiliateId requerido' };

  const bearer = (import.meta.env.VITE_ADMIN_LIST_BEARER as string | undefined)?.trim();
  if (!bearer) {
    return { ok: false, error: 'Falta VITE_ADMIN_LIST_BEARER' };
  }

  try {
    const res = await fetch(
      `${THUMB_PATH}?thumb=1&affiliateId=${encodeURIComponent(id)}`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${bearer}`,
        },
      }
    );
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      base64?: string;
      contentType?: string;
      byteLength?: number;
    };
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: data.error || `Error ${res.status}`,
      };
    }
    if (!data.base64) {
      return { ok: false, error: 'Respuesta sin imagen' };
    }
    const ct = data.contentType || 'image/jpeg';
    return {
      ok: true,
      dataUrl: `data:${ct};base64,${data.base64}`,
      byteLength: data.byteLength || 0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Error de red',
    };
  }
}
