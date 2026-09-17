/**
 * APO-AUDIT-FORENSIC — GET /api/audit/list (solo Admin)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { processAuditListRequest } from './auditCore.js';

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

  const limitRaw = typeof req.query?.limit === 'string' ? Number(req.query.limit) : undefined;
  const result = await processAuditListRequest({
    authorizationHeader,
    limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
  });
  return res.status(result.status).json(result.body);
}
