/**
 * APO-OCR-MAP M.5 — Smoke Caso Héctor (OCR degradado → normalizer).
 * Ejecutar: npm run smoke:ine-ocr-map
 */
import {
  mapIneStructuredToFormAddress,
  normalizeMexicanState,
  parsePostalCodeFromDomicilio,
  validateCurpChecksum,
  looksLikeIneMunicipioCode,
} from './ineFieldNormalization';

const HECTOR_GROUND_TRUTH = {
  curp: 'AAGH650922HGTLTC04',
  clave: 'ALGTHC65092211H100',
  domicilio:
    'C PARQUE VIA 324 COL PARQUE MANZANARES 37510 LEON, GTO.',
};

/** Simula salida OCR degradada del caso de campo. */
const HECTOR_DEGRADED_OCR = {
  nombre_completo: 'ALVAREZ GUTIERREZ HECTOR MANUEL',
  curp: 'AGMH690922HGTCTL04',
  clave_elector: 'ALGTHC6509221H1H00',
  fecha_nacimiento: '22/09/1965',
  domicilio: 'C PARQUE VIA 324 COL. PARQUE MANZ',
  domicilio_lineas:
    'C PARQUE VIA 324 COL PARQUE MANZANARES 37510 LEON, GTO.',
  municipio: '020',
  municipio_codigo: '020',
  estado: '11',
  estado_codigo: '11',
};

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log('  OK:', msg);
}

function main() {
  console.log('=== APO-OCR-MAP smoke Caso Héctor ===');

  assert(normalizeMexicanState('11') === 'Guanajuato', 'código 11 → Guanajuato');
  assert(normalizeMexicanState('GTO') === 'Guanajuato', 'alias GTO → Guanajuato');
  assert(
    parsePostalCodeFromDomicilio(HECTOR_GROUND_TRUTH.domicilio) === '37510',
    'CP 37510 desde domicilio'
  );

  const curpBad = validateCurpChecksum(HECTOR_DEGRADED_OCR.curp);
  assert(!curpBad.isValid, `CURP degradado inválido (${curpBad.reason})`);

  const curpGood = validateCurpChecksum(HECTOR_GROUND_TRUTH.curp);
  assert(curpGood.isValid, 'CURP ground-truth válido (checksum)');

  assert(looksLikeIneMunicipioCode('020') === true, '020 es código municipio');

  const mapped = mapIneStructuredToFormAddress(HECTOR_DEGRADED_OCR);
  assert(mapped.state === 'Guanajuato', `state=${mapped.state}`);
  assert(mapped.zip === '37510', `zip=${mapped.zip}`);
  assert(mapped.city !== '020' && mapped.city.length > 0, `city="${mapped.city}" (no código)`);
  assert(!/^\d+$/.test(mapped.city), 'city no es solo dígitos');

  console.log('Mapped form fields:', mapped);
  console.log('SPIKE PASS — Caso Héctor normalizer');
}

main();
