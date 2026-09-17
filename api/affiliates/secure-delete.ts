/**
 * APO-ADMIN-BAJA — POST /api/affiliates/secure-delete
 * Hard delete cifrado. Auth: ADMIN_LIST_SECRET (demo).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  processSecureAffiliateDeleteRequest,
  type SecureDeleteBody,
} from './secureDeleteCore.js';

function isProd(): boolean {
  return process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authorizationHeader =
    typeof req.headers.authorization === 'string' ? req.headers.authorization : undefined;

  const result = await processSecureAffiliateDeleteRequest(
    (req.body || {}) as SecureDeleteBody,
    {
      authorizationHeader,
      requireCloudSecrets: isProd(),
    }
  );

  return res.status(result.status).json(result.body);
}
