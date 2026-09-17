/**
 * APO-AUDIT-FORENSIC — POST /api/audit/append
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  processAuditAppendRequest,
  type AuditAppendBody,
} from './auditCore.js';

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

  const body = (req.body || {}) as AuditAppendBody;
  const allowAnonymousFailure =
    body.action === 'LOGIN_FAILURE' ||
    body.action === 'LOGIN_SUCCESS' ||
    body.action === 'LOGOUT';

  const result = await processAuditAppendRequest(body, {
    authorizationHeader,
    allowAnonymousFailure,
    meta: { headers: req.headers as { [k: string]: string | string[] | undefined } },
  });

  return res.status(result.status).json(result.body);
}
