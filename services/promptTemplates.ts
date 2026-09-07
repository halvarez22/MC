/**
 * Templates y configuración LLM (capa servicios — no UI constants).
 * Centraliza prompts para Context Economy / MCP readiness (Regla 7) y HRU (Regla 2).
 */

export const GROQ_CONFIG = {
  endpoint: 'https://api.groq.com/openai/v1/chat/completions',
  model: 'llama3-8b-8192',
  temperature: 0.1,
  maxTokens: 1000,
  healthCheckMaxTokens: 10,
} as const;

/** Config visión — el modelo real lo fija el proxy server-side (GROQ_VISION_MODEL). */
export const GROQ_VISION_CLIENT_CONFIG = {
  /** Endpoint proxy SSD (nunca api.groq.com desde el browser). */
  proxyPath: '/api/groq-ine',
  maxCombinedBytes: 5 * 1024 * 1024,
} as const;

/** Prompt de extracción estructurada INE a partir de texto OCR. */
export function buildIneExtractionPrompt(rawText: string): string {
  return `Extrae información de esta credencial INE mexicana. Devuelve solo JSON:

TEXTO OCR: "${rawText}"

FORMATO REQUERIDO:
{
  "nombre_completo": "NOMBRE COMPLETO",
  "curp": "CURP_18_CARACTERES",
  "clave_elector": "CLAVE_18_CARACTERES",
  "fecha_nacimiento": "DD/MM/YYYY",
  "estado": "NOMBRE_ESTADO",
  "municipio": "NOMBRE_MUNICIPIO",
  "seccion": "NUMERO",
  "domicilio": "DIRECCION_COMPLETA"
}

INSTRUCCIONES:
- Extrae solo datos presentes en el texto
- CURP y clave deben tener exactamente 18 caracteres
- Si no encuentras un dato, omítelo del JSON
- Mantén formato y ortografía exacta
- Solo devuelve el objeto JSON, nada más`;
}

/**
 * Prompt visión one-shot (espejo del proxy `api/groqIneCore.ts` → INE_VISION_PROMPT).
 * El proxy usa su copia server-side; este export documenta el contrato para tests/spike.
 */
export function buildIneVisionExtractionPrompt(): string {
  return `Eres un extractor de datos de credenciales INE mexicanas.
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
  "cic": string opcional (9 dígitos),
  "ocr_credencial": string opcional (13 dígitos),
  "raw_ocr_text": string opcional con texto legible concatenado
}
Analiza el reverso de la credencial. Si existe una línea de lectura mecánica (MRZ) que comienza con "IDMEX", extrae los 9 dígitos siguientes como "cic" y los 13 dígitos siguientes al símbolo "<<" como "ocr_credencial". Si no son legibles, omítelos (no inventes datos).
Reglas: omitir campos no visibles; no inventar; CURP/clave exactos si se leen; solo JSON.`;
}

/** Prompt mínimo de health-check (evitar en hot path de sync; preferir isAvailable por key). */
export function buildGroqHealthCheckPrompt(): string {
  return 'Responde con "OK"';
}
