/**
 * Feature flags de producto.
 * Vite solo expone al cliente variables con prefijo VITE_ (no es un secreto).
 * Default: false → path legado Google Vision + Tesseract.
 */
export function isGroqVisionEnabled(): boolean {
  return import.meta.env.VITE_USE_GROQ_VISION === 'true';
}
