/**
 * Proxy SSD (Regla 5) — Groq Vision INE one-shot.
 * La API key NUNCA viaja al browser: solo GROQ_API_KEY (server).
 * Deploy: Vercel Serverless Function en /api/groq-ine
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  MAX_COMBINED_BASE64_BYTES,
  processGroqIneRequest,
  type GroqIneBody,
} from './groqIneCore';

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

  const result = await processGroqIneRequest({
    body: (req.body || {}) as GroqIneBody,
    apiKey: process.env.GROQ_API_KEY,
    visionModel: process.env.GROQ_VISION_MODEL,
    contentLength:
      contentLength !== undefined && Number.isFinite(contentLength) ? contentLength : undefined,
  });

  // Exponer maxBytes en 413 Content-Length (contrato forense previo)
  if (result.status === 413 && result.body.error === 'Payload too large (Content-Length)') {
    result.body.maxBytes = MAX_COMBINED_BASE64_BYTES;
  }

  return res.status(result.status).json(result.body);
}
