/**
 * Config tipada — calidad + autocaptura INE (modelo campo APO).
 *
 * Estabilidad: ventana deslizante WINDOW_SIZE ticks; capturar si
 * goodTicks >= MIN_GOOD_TICKS (tolerancia a 1–2 frames malos).
 */

export type IneImageQualityFlags = {
  isBlurred: boolean;
  isTooDark: boolean;
  isTooBright: boolean;
  isTilted: boolean;
  isWellPositioned: boolean;
};

/** Motivo de rechazo para UX (prioridad: blur > tilt > light). */
export type IneQualityFailReason =
  | 'ok'
  | 'blur'
  | 'tilt'
  | 'dark'
  | 'bright';

export const INE_QUALITY_ANALYSIS_INTERVAL_MS = 350;

/** Ventana deslizante (~1.75s). Captura si ≥ MIN_GOOD buenos en la ventana. */
export const INE_AUTO_CAPTURE_WINDOW_SIZE = 5;
/** 4 de 5: tolera 1 frame malo; evita disparo en patrón T/F/T/F/T (solo 3/5). */
export const INE_AUTO_CAPTURE_MIN_GOOD_TICKS = 4;

/** Tras este tiempo se relajan umbrales (APO.3). */
export const INE_ADAPTIVE_RELAX_AFTER_MS = 3000;

/** Tras este tiempo aparece “Forzar captura” (APO.4). */
export const INE_FORCE_CAPTURE_AFTER_MS = 5000;

export const INE_QUALITY_ANALYSIS_WIDTH = 640;
export const INE_QUALITY_ANALYSIS_HEIGHT = 480;

/** Tilt estricto / relajado. */
export const INE_TILT_EDGE_RATIO_MIN = 0.7;
export const INE_TILT_EDGE_RATIO_MAX = 1.5;
export const INE_TILT_EDGE_RATIO_MIN_RELAXED = 0.6;
export const INE_TILT_EDGE_RATIO_MAX_RELAXED = 1.6;

/** Blur Laplaciano: estricto / relajado (isBlurred si var < umbral). */
export const INE_BLUR_LAPLACIAN_VARIANCE_MIN = 40;
export const INE_BLUR_LAPLACIAN_VARIANCE_MIN_RELAXED = 50;

export const INE_DARK_AVG_BRIGHTNESS_MAX = 55;
export const INE_BRIGHT_AVG_BRIGHTNESS_MIN = 225;

export const INE_CAPTURE_JPEG_QUALITY = 0.9;

export type IneQualityThresholds = {
  blurLaplacianMin: number;
  tiltMin: number;
  tiltMax: number;
  darkAvgMax: number;
  brightAvgMin: number;
};

export function getIneQualityThresholds(timeTryingMs: number): IneQualityThresholds {
  const relax = timeTryingMs >= INE_ADAPTIVE_RELAX_AFTER_MS;
  return {
    blurLaplacianMin: relax
      ? INE_BLUR_LAPLACIAN_VARIANCE_MIN_RELAXED
      : INE_BLUR_LAPLACIAN_VARIANCE_MIN,
    tiltMin: relax ? INE_TILT_EDGE_RATIO_MIN_RELAXED : INE_TILT_EDGE_RATIO_MIN,
    tiltMax: relax ? INE_TILT_EDGE_RATIO_MAX_RELAXED : INE_TILT_EDGE_RATIO_MAX,
    darkAvgMax: INE_DARK_AVG_BRIGHTNESS_MAX,
    brightAvgMin: INE_BRIGHT_AVG_BRIGHTNESS_MIN,
  };
}

export function isIneCaptureReady(q: IneImageQualityFlags): boolean {
  return !q.isBlurred && !q.isTooDark && !q.isTooBright && !q.isTilted;
}

export function getIneQualityFailReason(q: IneImageQualityFlags): IneQualityFailReason {
  if (q.isBlurred) return 'blur';
  if (q.isTilted) return 'tilt';
  if (q.isTooDark) return 'dark';
  if (q.isTooBright) return 'bright';
  return 'ok';
}

export function failReasonLabel(reason: IneQualityFailReason): string {
  switch (reason) {
    case 'blur':
      return 'Borroso — enfoca mejor';
    case 'tilt':
      return 'Inclinado — endereza el INE';
    case 'dark':
      return 'Muy oscuro — ajusta la luz';
    case 'bright':
      return 'Muy claro — evita reflejos';
    default:
      return 'Imagen buena';
  }
}

/**
 * Ventana deslizante: al menos minGood de los últimos windowSize ticks buenos.
 * Requiere ventana llena (length === windowSize) para disparar — evita disparos prematuros.
 */
export function evaluateSlidingWindow(
  history: boolean[],
  windowSize: number = INE_AUTO_CAPTURE_WINDOW_SIZE,
  minGood: number = INE_AUTO_CAPTURE_MIN_GOOD_TICKS
): { shouldCapture: boolean; goodTicks: number; window: boolean[] } {
  const window = history.slice(-windowSize);
  const goodTicks = window.filter(Boolean).length;
  const shouldCapture = window.length >= windowSize && goodTicks >= minGood;
  return { shouldCapture, goodTicks, window };
}

/** @deprecated Prefer evaluateSlidingWindow — mantenido para smoke legacy. */
export function simulateAutoCaptureStreak(
  ticks: boolean[],
  _stableTicks?: number
): { firedAt: number | null; resetCount: number } {
  const history: boolean[] = [];
  let firedAt: number | null = null;
  let resetCount = 0;
  let prevGood = 0;
  for (let i = 0; i < ticks.length; i++) {
    history.push(ticks[i]!);
    const { shouldCapture, goodTicks } = evaluateSlidingWindow(history);
    if (goodTicks < prevGood) resetCount += 1;
    prevGood = goodTicks;
    if (shouldCapture && firedAt === null) {
      firedAt = i;
      break;
    }
  }
  return { firedAt, resetCount };
}
