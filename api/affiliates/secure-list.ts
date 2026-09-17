/**
 * APO Admin list — GET /api/affiliates/secure-list
 * Decrypt server-side only. Auth: ADMIN_LIST_SECRET (demo).
 * APO-ADMIN-INE-THUMB: ?affiliateId=&thumb=1 → miniatura (misma función; evita +1 serverless Hobby).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processSecureAffiliateListRequest } from './secureListCore.js';
import { processSecureThumbRequest } from '../../services/secureThumbCore.js';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorizationHeader =
    typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;

  const wantThumb =
    req.query.thumb === '1' ||
    req.query.thumb === 'true' ||
    String(req.query.media || '') === 'thumb';
  const affiliateId =
    typeof req.query.affiliateId === 'string' ? req.query.affiliateId : undefined;

  if (wantThumb) {
    const result = await processSecureThumbRequest({
      authorizationHeader,
      affiliateId,
    });
    return res.status(result.status).json(result.body);
  }

  // TODO(APO.3): Reemplazar ADMIN_LIST_SECRET por validación de Firebase ID Token + Custom Claims
  const result = await processSecureAffiliateListRequest({
    authorizationHeader,
    requireCloudSecrets: isProd(),
  });

  return res.status(result.status).json(result.body);
}
