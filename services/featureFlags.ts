/**
 * Feature flags de producto.
 * Vite solo expone al cliente variables con prefijo VITE_ (no es un secreto).
 * Default: false → path legado / capas nuevas OFF (Strangler Fig).
 */
export function isGroqVisionEnabled(): boolean {
  return import.meta.env.VITE_USE_GROQ_VISION === 'true';
}

/** Lista Nominal vía proxy SSD. Default OFF hasta GO de orquestación/UI (Fase 3.3). */
export function isListaNominalEnabled(): boolean {
  return import.meta.env.VITE_USE_LISTA_NOMINAL === 'true';
}

/** Soft vs Hard: si true, bloquea Confirmar ante error|not_found. Default Soft (false). */
export function isListaNominalEnforceEnabled(): boolean {
  return import.meta.env.VITE_LISTA_NOMINAL_ENFORCE === 'true';
}
