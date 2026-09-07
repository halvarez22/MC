/**
 * Proxy SSD (Regla 5) — Lista Nominal INE (Datos Non Stop).
 * API key SOLO process.env.DATOS_NONSTOP_API_KEY — nunca VITE_.
 * Deploy: Vercel Serverless Function en /api/ine-lista-nominal
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  DEFAULT_TIMEOUT_MS,
  MAX_BODY_BYTES,
  processListaNominalRequest,
} from './listaNominalCore';
import type { ListaNominalQuery } from '../types';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const contentLengthHeader = req.headers['content-length'];
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

  const timeoutMs = Number(process.env.LISTA_NOMINAL_TIMEOUT_MS || DEFAULT_TIMEOUT_MS);

  const result = await processListaNominalRequest({
    body: (req.body || {}) as ListaNominalQuery,
    apiKey: process.env.DATOS_NONSTOP_API_KEY,
    baseUrl: process.env.DATOS_NONSTOP_BASE_URL,
    timeoutMs: Number.isFinite(timeoutMs) ? timeoutMs : DEFAULT_TIMEOUT_MS,
    contentLength:
      contentLength !== undefined && Number.isFinite(contentLength) ? contentLength : undefined,
  });

  if (result.status === 413 && result.body.error === 'Payload too large') {
    result.body.maxBytes = MAX_BODY_BYTES;
  }

  return res.status(result.status).json(result.body);
}
