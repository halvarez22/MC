/**
 * Orquestación Lista Nominal — async, no bloqueante (U-First / Fase 3.3).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { INEStructuredData, ListaNominalResult } from '../types';
import { isListaNominalEnabled } from '../services/featureFlags';
import { validateListaNominal } from '../services/listaNominalService';
import { buildListaNominalInputFromStructured } from '../services/listaNominalQuery';

function skippedFlagOff(): ListaNominalResult {
  return {
    status: 'skipped_flag_off',
    checkedAt: new Date().toISOString(),
    provider: 'none',
  };
}

function insufficientIds(): ListaNominalResult {
  return {
    status: 'error',
    checkedAt: new Date().toISOString(),
    provider: 'none',
    rawMessage: 'Identificadores insuficientes para Lista Nominal (cic/ocr/clave)',
  };
}

export function useListaNominalValidation(data: INEStructuredData | null | undefined) {
  const [isValidating, setIsValidating] = useState(false);
  const [lnResult, setLnResult] = useState<ListaNominalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runIdRef = useRef(0);

  const runValidation = useCallback(async (payload: INEStructuredData) => {
    const runId = ++runIdRef.current;

    if (!isListaNominalEnabled()) {
      setIsValidating(false);
      setError(null);
      setLnResult(skippedFlagOff());
      return;
    }

    const input = buildListaNominalInputFromStructured(payload);
    if (!input) {
      setIsValidating(false);
      setError(null);
      setLnResult(insufficientIds());
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const result = await validateListaNominal(input);
      if (runId !== runIdRef.current) return;
      setLnResult(result);
      if (result.status === 'error' && result.rawMessage) {
        setError(result.rawMessage);
      }
    } catch (err) {
      if (runId !== runIdRef.current) return;
      const message = err instanceof Error ? err.message : 'Error de validación Lista Nominal';
      setError(message);
      setLnResult({
        status: 'error',
        checkedAt: new Date().toISOString(),
        provider: 'none',
        rawMessage: message,
      });
    } finally {
      if (runId === runIdRef.current) {
        setIsValidating(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!data) {
      setLnResult(null);
      setError(null);
      setIsValidating(false);
      return;
    }

    // Fire-and-forget: no bloquea la UI de review (latencia 8–16s)
    void runValidation(data);
  }, [
    data,
    data?.cic,
    data?.ocr_credencial,
    data?.clave_elector,
    data?.id_ciudadano,
    data?.numero_emision,
    data?.modelo_credencial,
    runValidation,
  ]);

  const revalidate = useCallback(() => {
    if (data) void runValidation(data);
  }, [data, runValidation]);

  return { isValidating, lnResult, error, revalidate };
}
