/**
 * APO Admin list — GET /api/affiliates/secure-list
 * Decrypt server-side only. Auth: ADMIN_LIST_SECRET (demo).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processSecureAffiliateListRequest } from './secureListCore.js';

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

  // TODO(APO.3): Reemplazar ADMIN_LIST_SECRET por validación de Firebase ID Token + Custom Claims
  const authorizationHeader =
    typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;

  const result = await processSecureAffiliateListRequest({
    authorizationHeader,
    requireCloudSecrets: isProd(),
  });

  return res.status(result.status).json(result.body);
}
