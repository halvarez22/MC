/**
 * Núcleo compartido — Lista Nominal (Datos Non Stop).
 * Solo server (Vercel + Vite middleware). Key NUNCA con prefijo VITE_.
 */

import type {
  IneCredentialModel,
  ListaNominalQuery,
  ListaNominalResult,
  ListaNominalStatus,
} from '../types';

export const DEFAULT_DATOS_NONSTOP_BASE_URL = 'https://api.datosnonstop.com';
export const LISTA_NOMINAL_PATH = '/v1/ine/lista-nominal';
export const DEFAULT_TIMEOUT_MS = 20_000;
export const MAX_BODY_BYTES = 8 * 1024;
export const PROVIDER_ID = 'datos-non-stop';

export const ALLOWED_MODELS: readonly IneCredentialModel[] = [
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
] as const;

export type ProxyResult = { status: number; body: Record<string, unknown> };

function digitsOnly(value: string | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

function cleanText(value: string | undefined): string {
  return String(value ?? '').trim().toUpperCase();
}

function sanitizeMessage(msg: unknown): string | undefined {
  if (typeof msg !== 'string') return undefined;
  const t = msg.trim().slice(0, 200);
  return t || undefined;
}

/** Mapea status DNS → contrato canónico (sin filtrar JSON crudo al browser). */
export function mapProviderStatus(providerStatus: unknown): ListaNominalStatus {
  const s = String(providerStatus ?? '')
    .trim()
    .toLowerCase();
  if (s === 'found' || s === 'valid' || s === 'vigente') return 'valid';
  if (s === 'not_found') return 'not_found';
  if (s === 'not_current' || s === 'not_vigente') return 'not_current';
  if (s === 'expired' || s === 'vencido') return 'expired';
  if (s === 'not_valid') return 'error';
  return 'error';
}

export function validateListaNominalQuery(
  query: ListaNominalQuery
): { ok: true; modelo: IneCredentialModel } | { ok: false; error: string } {
  const modelo = String(query?.modelo ?? 'UNKNOWN').toUpperCase() as IneCredentialModel;
  if (!(ALLOWED_MODELS as readonly string[]).includes(modelo)) {
    return { ok: false, error: 'modelo no permitido' };
  }

  const cic = digitsOnly(query.cic);
  const idCiudadano = digitsOnly(query.id_ciudadano);
  const ocr = digitsOnly(query.ocr_credencial);
  const clave = cleanText(query.clave_elector);
  const numEmision = digitsOnly(query.numero_emision);

  if (modelo === 'D') {
    if (cic.length < 8 || ocr.length < 10) {
      return { ok: false, error: 'modelo D requiere cic y ocr_credencial' };
    }
  } else if (modelo === 'C') {
    if (clave.length < 16 || ocr.length < 10) {
      return { ok: false, error: 'modelo C requiere clave_elector y ocr_credencial' };
    }
  } else {
    // E–J: CIC + id ciudadano
    if (cic.length < 8 || idCiudadano.length < 6) {
      return { ok: false, error: `modelo ${modelo} requiere cic e id_ciudadano` };
    }
  }

  return { ok: true, modelo };
}

/** Construye body camelCase del proveedor a partir del contrato MC. */
export function buildProviderPayload(query: ListaNominalQuery): Record<string, string> {
  const modelo = String(query.modelo).toLowerCase();
  const base: Record<string, string> = { modelo };

  if (modelo === 'd') {
    base.cic = digitsOnly(query.cic);
    base.ocr = digitsOnly(query.ocr_credencial);
    return base;
  }
  if (modelo === 'c') {
    base.claveElector = cleanText(query.clave_elector);
    base.numEmision = digitsOnly(query.numero_emision) || '01';
    base.ocr = digitsOnly(query.ocr_credencial);
    return base;
  }
  base.cic = digitsOnly(query.cic);
  base.idCiudadano = digitsOnly(query.id_ciudadano);
  return base;
}

function toCanonicalResult(params: {
  status: ListaNominalStatus;
  modelUsed?: IneCredentialModel;
  rawMessage?: string;
}): ListaNominalResult {
  return {
    status: params.status,
    checkedAt: new Date().toISOString(),
    provider: PROVIDER_ID,
    rawMessage: params.rawMessage,
    modelUsed: params.modelUsed,
  };
}

export async function processListaNominalRequest(params: {
  body: ListaNominalQuery;
  apiKey: string | undefined;
  baseUrl?: string;
  timeoutMs?: number;
  contentLength?: number;
}): Promise<ProxyResult> {
  if (
    typeof params.contentLength === 'number' &&
    Number.isFinite(params.contentLength) &&
    params.contentLength > MAX_BODY_BYTES
  ) {
    return {
      status: 413,
      body: { error: 'Payload too large', maxBytes: MAX_BODY_BYTES },
    };
  }

  if (!params.apiKey) {
    return {
      status: 500,
      body: {
        error:
          'DATOS_NONSTOP_API_KEY not configured on server (SSD: never use VITE_ for this key)',
      },
    };
  }

  const validated = validateListaNominalQuery(params.body || ({} as ListaNominalQuery));
  if (!validated.ok) {
    return { status: 400, body: { error: validated.error } };
  }

  const base = (params.baseUrl || DEFAULT_DATOS_NONSTOP_BASE_URL).replace(/\/$/, '');
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${base}${LISTA_NOMINAL_PATH}`;
  const providerBody = buildProviderPayload({ ...params.body, modelo: validated.modelo });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': params.apiKey,
      },
      body: JSON.stringify(providerBody),
      signal: controller.signal,
    });

    let data: Record<string, unknown> = {};
    try {
      data = (await upstream.json()) as Record<string, unknown>;
    } catch {
      data = {};
    }

    if (!upstream.ok) {
      const result = toCanonicalResult({
        status: 'error',
        modelUsed: validated.modelo,
        rawMessage: sanitizeMessage(data.message) || `upstream HTTP ${upstream.status}`,
      });
      return { status: upstream.status >= 500 ? 502 : upstream.status, body: result as unknown as Record<string, unknown> };
    }

    const result = toCanonicalResult({
      status: mapProviderStatus(data.status),
      modelUsed: validated.modelo,
      rawMessage: sanitizeMessage(data.message),
    });

    // Solo contrato canónico — nunca reenviar data cruda del proveedor
    return { status: 200, body: result as unknown as Record<string, unknown> };
  } catch (err) {
    const aborted = err instanceof Error && err.name === 'AbortError';
    const result = toCanonicalResult({
      status: 'error',
      modelUsed: validated.modelo,
      rawMessage: aborted ? `timeout ${timeoutMs}ms` : 'proxy network error',
    });
    return { status: aborted ? 504 : 500, body: result as unknown as Record<string, unknown> };
  } finally {
    clearTimeout(timer);
  }
}
