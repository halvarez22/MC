/**
 * D.2b — API Vercel: cifrar + Admin Firestore.
 * Lógica en secureCore.ts (también proxy Vite).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  processSecureAffiliateRequest,
  type SecureAffiliateBody,
} from './secureCore';

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

  const result = await processSecureAffiliateRequest(
    (req.body || {}) as SecureAffiliateBody,
    { requireCloudSecrets: isProd() }
  );

  return res.status(result.status).json(result.body);
}
