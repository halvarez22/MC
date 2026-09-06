/**
 * Núcleo compartido del proxy Groq Vision INE (Vercel + Vite dev).
 * La API key solo se lee de process.env / env inyectado — nunca del browser.
 */

export const GROQ_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';
export const MAX_COMBINED_BASE64_BYTES = 5 * 1024 * 1024;
export const MAX_CONTENT_LENGTH_BYTES = MAX_COMBINED_BASE64_BYTES + 512 * 1024;
export const DEFAULT_VISION_MODEL = 'qwen/qwen3.6-27b';
export const ALLOWED_VISION_MODELS = ['qwen/qwen3.6-27b', 'qwen/qwen3.8-27b'] as const;

export const INE_VISION_PROMPT = `Eres un extractor de datos de credenciales INE mexicanas.
Analiza las imágenes (frontal y, si existe, posterior) y devuelve SOLO un objeto JSON válido con este esquema:
{
  "nombre_completo": string opcional,
  "curp": string opcional (18 caracteres),
  "clave_elector": string opcional (18 caracteres),
  "fecha_nacimiento": string opcional,
  "fecha_emision": string opcional,
  "fecha_vigencia": string opcional,
  "domicilio": string opcional,
  "seccion": string opcional,
  "municipio": string opcional,
  "estado": string opcional,
  "localidad": string opcional,
  "raw_ocr_text": string opcional con texto legible concatenado
}
Reglas: omitir campos no visibles; no inventar; CURP/clave exactos si se leen; solo JSON.`;

export type GroqIneBody = {
  frontalBase64?: string;
  posteriorBase64?: string;
};

export type ProxyResult = { status: number; body: Record<string, unknown> };

function stripDataUrl(b64: string): string {
  const idx = b64.indexOf(',');
  if (b64.startsWith('data:') && idx !== -1) return b64.slice(idx + 1);
  return b64;
}

export function approxDecodedBytes(b64: string): number {
  const clean = stripDataUrl(b64).replace(/\s/g, '');
  return Math.floor((clean.length * 3) / 4);
}

function buildDataUrl(b64: string): string {
  if (b64.startsWith('data:')) return b64;
  return `data:image/jpeg;base64,${b64}`;
}

export async function processGroqIneRequest(params: {
  body: GroqIneBody;
  apiKey: string | undefined;
  visionModel?: string;
  contentLength?: number;
}): Promise<ProxyResult> {
  if (
    typeof params.contentLength === 'number' &&
    Number.isFinite(params.contentLength) &&
    params.contentLength > MAX_CONTENT_LENGTH_BYTES
  ) {
    return {
      status: 413,
      body: {
        error: 'Payload too large (Content-Length)',
        maxBytes: MAX_COMBINED_BASE64_BYTES,
        contentLength: params.contentLength,
      },
    };
  }

  if (!params.apiKey) {
    return {
      status: 500,
      body: {
        error: 'GROQ_API_KEY not configured on server (SSD: never use VITE_ for this key)',
      },
    };
  }

  const frontal =
    typeof params.body.frontalBase64 === 'string' ? params.body.frontalBase64.trim() : '';
  const posterior =
    typeof params.body.posteriorBase64 === 'string' ? params.body.posteriorBase64.trim() : '';

  if (!frontal) {
    return { status: 400, body: { error: 'frontalBase64 is required' } };
  }

  const totalBytes =
    approxDecodedBytes(frontal) + (posterior ? approxDecodedBytes(posterior) : 0);

  if (totalBytes > MAX_COMBINED_BASE64_BYTES) {
    return {
      status: 413,
      body: {
        error: 'Payload too large',
        maxBytes: MAX_COMBINED_BASE64_BYTES,
        receivedApproxBytes: totalBytes,
      },
    };
  }

  const envModel = params.visionModel?.trim();
  const model =
    envModel && (ALLOWED_VISION_MODELS as readonly string[]).includes(envModel)
      ? envModel
      : DEFAULT_VISION_MODEL;

  if (!(ALLOWED_VISION_MODELS as readonly string[]).includes(model)) {
    return { status: 400, body: { error: 'Model not allowed', model } };
  }

  const content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  > = [
    { type: 'text', text: INE_VISION_PROMPT },
    { type: 'image_url', image_url: { url: buildDataUrl(frontal) } },
  ];

  if (posterior) {
    content.push({ type: 'image_url', image_url: { url: buildDataUrl(posterior) } });
  }

  try {
    const groqRes = await fetch(GROQ_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${params.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content }],
        temperature: 0.1,
        max_completion_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
    });

    const data = await groqRes.json();

    if (!groqRes.ok) {
      return {
        status: groqRes.status,
        body: {
          error: 'Groq upstream error',
          status: groqRes.status,
          details: data?.error || data,
        },
      };
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw || typeof raw !== 'string') {
      return { status: 502, body: { error: 'Empty Groq response' } };
    }

    let structured: unknown;
    try {
      structured = JSON.parse(raw);
    } catch {
      return { status: 502, body: { error: 'Groq response is not valid JSON', raw } };
    }

    return {
      status: 200,
      body: {
        model,
        structured,
        usage: data.usage || null,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown proxy error';
    return { status: 500, body: { error: message } };
  }
}
