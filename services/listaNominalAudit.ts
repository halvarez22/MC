/**
 * Payload de auditoría Lista Nominal (sin PII). Persistencia = Fase 3.4.
 */

import type { ListaNominalResult } from '../types';

export type ListaNominalAuditPrep = {
  action: 'VALIDATE_LISTA_NOMINAL';
  details: string;
};

/** Solo status + provider + checkedAt + modelUsed. Cero CIC/OCR/CURP/nombre. */
export function buildValidateListaNominalAuditEntry(
  result: ListaNominalResult
): ListaNominalAuditPrep {
  return {
    action: 'VALIDATE_LISTA_NOMINAL',
    details: JSON.stringify({
      status: result.status,
      provider: result.provider,
      checkedAt: result.checkedAt,
      modelUsed: result.modelUsed ?? null,
    }),
  };
}
