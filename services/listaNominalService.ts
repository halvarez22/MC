/**
 * Cliente Lista Nominal → proxy SSD `/api/ine-lista-nominal`.
 * Abort inmediato si VITE_USE_LISTA_NOMINAL !== 'true'.
 * Sin API keys en el browser (Regla 5).
 */

import type {
  IneCredentialModel,
  ListaNominalQuery,
  ListaNominalResult,
  ListaNominalStatus,
} from '../types';
import { isListaNominalEnabled } from './featureFlags';

const PROXY_PATH = '/api/ine-lista-nominal';
const MAX_ATTEMPTS = 2; // 1 intento + 1 reintento
const RETRYABLE = new Set([502, 503, 504]);

let inFlight: Promise<ListaNominalResult> | null = null;

function skipped(status: ListaNominalStatus, rawMessage?: string): ListaNominalResult {
  return {
    status,
    checkedAt: new Date().toISOString(),
    provider: 'none',
    rawMessage,
  };
}

function isListaNominalResult(value: unknown): value is ListaNominalResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.status === 'string' &&
    typeof v.checkedAt === 'string' &&
    typeof v.provider === 'string'
  );
}

async function postOnce(
  query: ListaNominalQuery
): Promise<{ httpStatus: number; result: ListaNominalResult }> {
  const res = await fetch(PROXY_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query),
  });

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (isListaNominalResult(body)) {
    return { httpStatus: res.status, result: body };
  }

  const errMsg =
    body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string'
      ? (body as { error: string }).error
      : `HTTP ${res.status}`;

  return { httpStatus: res.status, result: skipped('error', errMsg) };
}

export type ValidateListaNominalInput = {
  modelo: IneCredentialModel;
  cic?: string;
  ocr_credencial?: string;
  clave_elector?: string;
  id_ciudadano?: string;
  numero_emision?: string;
};

/**
 * Cortafuegos flag → proxy SSD. Flag OFF → skipped_flag_off sin red.
 * Reintento único solo en 502/503/504.
 */
export async function validateListaNominal(
  data: ValidateListaNominalInput
): Promise<ListaNominalResult> {
  if (import.meta.env.VITE_USE_LISTA_NOMINAL !== 'true') {
    return {
      status: 'skipped_flag_off',
      checkedAt: new Date().toISOString(),
      provider: 'none',
    };
  }

  const query: ListaNominalQuery = {
    modelo: data.modelo,
    cic: data.cic,
    ocr_credencial: data.ocr_credencial,
    clave_elector: data.clave_elector,
    id_ciudadano: data.id_ciudadano,
    numero_emision: data.numero_emision,
  };

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return skipped('skipped_offline', 'browser offline');
  }

  if (inFlight) {
    return inFlight;
  }

  inFlight = (async () => {
    let attempt = 0;
    let last = await postOnce(query);
    attempt += 1;
    while (attempt < MAX_ATTEMPTS && RETRYABLE.has(last.httpStatus)) {
      last = await postOnce(query);
      attempt += 1;
    }
    return last.result;
  })();

  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Alias estable; preferir validateListaNominal (contrato auditor). */
export const checkListaNominal = validateListaNominal;

export const listaNominalService = {
  validate: validateListaNominal,
  check: validateListaNominal,
  isEnabled: isListaNominalEnabled,
};
