/**
 * Config tipada — calidad + autocaptura INE (Regla 2 HRU).
 *
 * Estabilidad = N ticks consecutivos × INE_QUALITY_ANALYSIS_INTERVAL_MS
 * (NO es ventana deslizante STABLE_MS independiente).
 * Empírico móvil: 3 × 350ms ≈ 1.05s — equilibra CPU/batería vs espera.
 */

export type IneImageQualityFlags = {
  isBlurred: boolean;
  isTooDark: boolean;
  isTooBright: boolean;
  isTilted: boolean;
  isWellPositioned: boolean;
};

/** Intervalo del análisis en vivo (ms). 350ms: ~3 FPS análisis, viable en mid-range. */
export const INE_QUALITY_ANALYSIS_INTERVAL_MS = 350;

/**
 * Ticks consecutivos con calidad OK antes de autocapturar.
 * Modelo: contador discreto (no ventana temporal deslizante).
 * 3 × 350ms ≈ 1.05s de estabilización.
 */
export const INE_AUTO_CAPTURE_STABLE_TICKS = 3;

export const INE_QUALITY_ANALYSIS_WIDTH = 640;
export const INE_QUALITY_ANALYSIS_HEIGHT = 480;

/** Inclinación: ratio bordes H/V fuera de rango → isTilted. */
export const INE_TILT_EDGE_RATIO_MIN = 0.7;
export const INE_TILT_EDGE_RATIO_MAX = 1.5;

/**
 * Blur: varianza del Laplaciano (submuestreo). Por debajo = borroso.
 * Umbral empírico para canvas 640×480 con muestreo; calibrable vía config.
 */
export const INE_BLUR_LAPLACIAN_VARIANCE_MIN = 40;

/**
 * Luz (reactivada con umbrales históricos conservadores del módulo de debug).
 * Evita autocaptura en oscuridad/sobreexposición extrema.
 */
export const INE_DARK_AVG_BRIGHTNESS_MAX = 55;
export const INE_BRIGHT_AVG_BRIGHTNESS_MIN = 225;

export const INE_CAPTURE_JPEG_QUALITY = 0.9;

export function isIneCaptureReady(q: IneImageQualityFlags): boolean {
  return !q.isBlurred && !q.isTooDark && !q.isTooBright && !q.isTilted;
}

/**
 * Simula estabilización discreta (smoke / unit sin React).
 * ticks[i]=true → frame bueno. Devuelve índice del disparo o null.
 */
export function simulateAutoCaptureStreak(
  ticks: boolean[],
  stableTicks: number = INE_AUTO_CAPTURE_STABLE_TICKS
): { firedAt: number | null; resetCount: number } {
  let streak = 0;
  let firedAt: number | null = null;
  let resetCount = 0;
  for (let i = 0; i < ticks.length; i++) {
    if (ticks[i]) {
      streak += 1;
      if (streak >= stableTicks && firedAt === null) {
        firedAt = i;
        break;
      }
    } else {
      if (streak > 0) resetCount += 1;
      streak = 0;
    }
  }
  return { firedAt, resetCount };
}
