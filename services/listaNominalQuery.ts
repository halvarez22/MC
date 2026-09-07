/**
 * Construye query Lista Nominal desde extracción estructurada (sin PII extra).
 */

import type { INEStructuredData, IneCredentialModel } from '../types';
import type { ValidateListaNominalInput } from './listaNominalService';

function digits(value: string | undefined): string {
  return String(value ?? '').replace(/\D/g, '');
}

function inferModelo(data: INEStructuredData): IneCredentialModel | null {
  if (data.modelo_credencial && data.modelo_credencial !== 'UNKNOWN') {
    return data.modelo_credencial;
  }
  const cic = digits(data.cic);
  const ocr = digits(data.ocr_credencial);
  const id = digits(data.id_ciudadano);
  const clave = String(data.clave_elector ?? '').trim();

  if (cic.length >= 8 && ocr.length >= 12) return 'D';
  if (clave.length >= 16 && ocr.length >= 12) return 'C';
  if (cic.length >= 8 && id.length >= 6) return 'E';
  return null;
}

/** null si faltan identificadores mínimos para consultar el padrón. */
export function buildListaNominalInputFromStructured(
  data: INEStructuredData
): ValidateListaNominalInput | null {
  const modelo = inferModelo(data);
  if (!modelo) return null;

  return {
    modelo,
    cic: data.cic,
    ocr_credencial: data.ocr_credencial,
    clave_elector: data.clave_elector,
    id_ciudadano: data.id_ciudadano,
    numero_emision: data.numero_emision,
  };
}
