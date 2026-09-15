/**
 * APO-OCR-MAP M.1 — Normalización determinística de campos INE → formulario.
 * Sin side-effects; usable desde UI y smokes. No bloquea flujos (CURP = warning).
 */

import { MEXICAN_STATES } from '../constants';

/** Códigos INE (2 dígitos) → nombre alineado a MEXICAN_STATES. */
export const INE_STATE_CODE_TO_NAME: Record<string, string> = {
  '01': 'Aguascalientes',
  '02': 'Baja California',
  '03': 'Baja California Sur',
  '04': 'Campeche',
  '05': 'Coahuila',
  '06': 'Colima',
  '07': 'Chiapas',
  '08': 'Chihuahua',
  '09': 'Ciudad de México',
  '10': 'Durango',
  '11': 'Guanajuato',
  '12': 'Guerrero',
  '13': 'Hidalgo',
  '14': 'Jalisco',
  '15': 'México',
  '16': 'Michoacán',
  '17': 'Morelos',
  '18': 'Nayarit',
  '19': 'Nuevo León',
  '20': 'Oaxaca',
  '21': 'Puebla',
  '22': 'Querétaro',
  '23': 'Quintana Roo',
  '24': 'San Luis Potosí',
  '25': 'Sinaloa',
  '26': 'Sonora',
  '27': 'Tabasco',
  '28': 'Tamaulipas',
  '29': 'Tlaxcala',
  '30': 'Veracruz',
  '31': 'Yucatán',
  '32': 'Zacatecas',
};

const STATE_ALIASES: Record<string, string> = {
  GTO: 'Guanajuato',
  GUANAJUATO: 'Guanajuato',
  CDMX: 'Ciudad de México',
  DF: 'Ciudad de México',
  'CIUDAD DE MEXICO': 'Ciudad de México',
  'CIUDAD DE MÉXICO': 'Ciudad de México',
  EDOMEX: 'México',
  MEX: 'México',
  'ESTADO DE MEXICO': 'México',
  'ESTADO DE MÉXICO': 'México',
  NL: 'Nuevo León',
  'NUEVO LEON': 'Nuevo León',
  'NUEVO LEÓN': 'Nuevo León',
  QRO: 'Querétaro',
  QUERETARO: 'Querétaro',
  SLP: 'San Luis Potosí',
  'SAN LUIS POTOSI': 'San Luis Potosí',
  BC: 'Baja California',
  BCS: 'Baja California Sur',
};

function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function findMexicanStateExact(name: string): string | '' {
  const f = fold(name);
  const hit = MEXICAN_STATES.find((st) => fold(st) === f);
  return hit || '';
}

/**
 * Normaliza código INE / abreviatura / nombre → valor de MEXICAN_STATES, o "" si no hay match.
 * Nunca inventa un estado default.
 */
export function normalizeMexicanState(raw: string | undefined | null): string {
  if (raw == null) return '';
  const t = String(raw).trim();
  if (!t) return '';

  const digits = t.replace(/\D/g, '');
  if (/^\d{1,2}$/.test(digits)) {
    const code = digits.padStart(2, '0');
    const byCode = INE_STATE_CODE_TO_NAME[code];
    if (byCode) return byCode;
  }

  const folded = fold(t);
  if (STATE_ALIASES[folded]) return STATE_ALIASES[folded];

  const exact = findMexicanStateExact(t);
  if (exact) return exact;

  // Match parcial (ej. "GTO." ya cubierto; "Guanajuato, México")
  const first = folded.split(/[|,/]/)[0]?.trim() || folded;
  if (STATE_ALIASES[first]) return STATE_ALIASES[first];
  return findMexicanStateExact(first);
}

/** Extrae primer CP mexicano de 5 dígitos en el domicilio. */
export function parsePostalCodeFromDomicilio(domicilio: string | undefined | null): string {
  if (!domicilio) return '';
  const m = String(domicilio).match(/\b(\d{5})\b/);
  return m?.[1] || '';
}

/**
 * Intenta ciudad tras el CP: "... 37510 LEON, GTO." → "León"/"LEON".
 */
export function parseCityFromDomicilio(domicilio: string | undefined | null): string {
  if (!domicilio) return '';
  const m = String(domicilio).match(/\b\d{5}\b\s*[,.]?\s*([^\n,]+)/);
  if (!m?.[1]) return '';
  let city = m[1].trim();
  city = city.replace(/\s*,\s*[A-ZÁÉÍÓÚÑa-záéíóúñ.]{2,12}\s*$/u, '').trim();
  return city;
}

export function looksLikeIneMunicipioCode(raw: string | undefined | null): boolean {
  if (raw == null) return false;
  return /^\d{2,3}$/.test(String(raw).trim());
}

/**
 * Ciudad para el form: nunca un código crudo tipo "020".
 */
export function resolveCityForForm(opts: {
  municipioNombre?: string | null;
  municipio?: string | null;
  domicilio?: string | null;
}): string {
  const nombre = (opts.municipioNombre || '').trim();
  if (nombre && !looksLikeIneMunicipioCode(nombre)) return nombre;

  const mun = (opts.municipio || '').trim();
  if (mun && !looksLikeIneMunicipioCode(mun)) return mun;

  const fromDom = parseCityFromDomicilio(opts.domicilio);
  if (fromDom) return fromDom;

  return '';
}

export type CurpValidation = {
  isValid: boolean;
  reason?: string;
};

const CURP_DICT = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';

function curpCheckDigit(base17: string): string {
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const ch = base17.charAt(i).toUpperCase();
    const idx = CURP_DICT.indexOf(ch);
    const val = idx >= 0 ? idx : 0;
    sum += val * (18 - i);
  }
  const mod = sum % 10;
  const digit = mod === 0 ? 0 : 10 - mod;
  return String(digit);
}

/**
 * Validación CURP (longitud + charset + dígito verificador).
 * Checksum = WARNING no bloqueante en UI de revisión.
 */
export function validateCurpChecksum(curp: string | undefined | null): CurpValidation {
  if (curp == null || !String(curp).trim()) {
    return { isValid: false, reason: 'CURP vacío' };
  }
  const c = String(curp).trim().toUpperCase().replace(/\s+/g, '');
  if (c.length !== 18) {
    return { isValid: false, reason: `Longitud ${c.length} (se esperan 18)` };
  }
  if (!/^[A-Z0-9Ñ]{18}$/.test(c)) {
    return { isValid: false, reason: 'Caracteres no válidos en CURP' };
  }
  const expected = curpCheckDigit(c.slice(0, 17));
  if (c.charAt(17) !== expected) {
    return {
      isValid: false,
      reason: 'El dígito verificador del CURP no coincide (revisa OCR)',
    };
  }
  return { isValid: true };
}

/**
 * CURP mínimo para persistencia cifrada (formato).
 * Bloquea vacío / longitud / charset. El dígito verificador NO bloquea (OCR-MAP).
 */
export function isCurpPersistable(curp: string | undefined | null): CurpValidation {
  if (curp == null || !String(curp).trim()) {
    return { isValid: false, reason: 'CURP vacío' };
  }
  const c = String(curp).trim().toUpperCase().replace(/\s+/g, '');
  if (c.length !== 18) {
    return { isValid: false, reason: `Longitud ${c.length} (se esperan 18)` };
  }
  if (!/^[A-Z0-9Ñ]{18}$/.test(c)) {
    return { isValid: false, reason: 'Caracteres no válidos en CURP' };
  }
  return { isValid: true };
}

export type IneFormAddressFields = {
  address: string;
  city: string;
  state: string;
  zip: string;
};

/** Mapeo OCR estructurado → campos de SelfRegistrationForm (sin defaults engañosos). */
export function mapIneStructuredToFormAddress(data: {
  domicilio?: string;
  domicilio_lineas?: string;
  codigo_postal?: string;
  estado?: string;
  estado_codigo?: string;
  estado_nombre?: string;
  municipio?: string;
  municipio_codigo?: string;
  municipio_nombre?: string;
}): IneFormAddressFields {
  const address = (data.domicilio_lineas || data.domicilio || '').trim();
  const zip =
    (data.codigo_postal || '').trim().replace(/\D/g, '').slice(0, 5) ||
    parsePostalCodeFromDomicilio(address);
  const state = normalizeMexicanState(
    data.estado_nombre || data.estado || data.estado_codigo || ''
  );
  const city = resolveCityForForm({
    municipioNombre: data.municipio_nombre,
    municipio: data.municipio || data.municipio_codigo,
    domicilio: address,
  });
  return { address, city, state, zip };
}
