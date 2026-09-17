/**
 * APO-ADMIN-INE-THUMB — núcleo GET miniatura Admin.
 */

import { authorizeAdminListBearer } from './secureListCore.js';
import { getAffiliateFrontThumb } from '../../services/affiliateMediaStore.js';

export async function processSecureThumbRequest(opts: {
  authorizationHeader?: string;
  affiliateId?: string;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!process.env.ADMIN_LIST_SECRET?.trim()) {
    return {
      status: 500,
      body: { error: 'ADMIN_LIST_SECRET not configured on server' },
    };
  }
  if (!authorizeAdminListBearer(opts.authorizationHeader)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  const affiliateId = String(opts.affiliateId || '').trim();
  if (!affiliateId) {
    return { status: 400, body: { error: 'affiliateId requerido' } };
  }

  const result = await getAffiliateFrontThumb(affiliateId);
  if (result.ok === false) {
    return { status: result.status, body: { error: result.error } };
  }

  const b64 =
    typeof Buffer !== 'undefined'
      ? Buffer.from(result.bytes).toString('base64')
      : '';

  return {
    status: 200,
    body: {
      ok: true,
      affiliateId: result.meta.affiliateId,
      orgId: result.meta.orgId,
      contentType: result.meta.contentType,
      byteLength: result.meta.frontThumbBytes,
      base64: b64,
    },
  };
}
