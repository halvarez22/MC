/**
 * Análisis de frame INE (canvas ImageData) — usable desde UI y smoke.
 */

import {
  INE_BLUR_LAPLACIAN_VARIANCE_MIN,
  INE_BRIGHT_AVG_BRIGHTNESS_MIN,
  INE_DARK_AVG_BRIGHTNESS_MAX,
  INE_TILT_EDGE_RATIO_MAX,
  INE_TILT_EDGE_RATIO_MIN,
  type IneImageQualityFlags,
} from './ineCaptureQualityConfig';

/** Varianza Laplaciano 3×3 simplificado (muestreo) — proxy de nitidez. */
export function laplacianVariance(data: Uint8ClampedArray, width: number, height: number): number {
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  const step = 2;
  for (let y = 1; y < height - 1; y += step) {
    for (let x = 1; x < width - 1; x += step) {
      const i = (y * width + x) * 4;
      const c = data[i]!;
      const l = data[(y * width + (x - 1)) * 4]!;
      const r = data[(y * width + (x + 1)) * 4]!;
      const t = data[((y - 1) * width + x) * 4]!;
      const b = data[((y + 1) * width + x) * 4]!;
      const lap = Math.abs(4 * c - l - r - t - b);
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  if (n === 0) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

export function evaluateIneFrameQuality(
  data: Uint8ClampedArray,
  width: number,
  height: number
): IneImageQualityFlags {
  let totalBrightness = 0;
  let samples = 0;
  for (let i = 0; i < data.length; i += 4 * 5) {
    totalBrightness += (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
    samples += 1;
  }
  const avgBrightness = samples > 0 ? totalBrightness / samples : 0;

  let totalVariance = 0;
  for (let i = 0; i < data.length; i += 4 * 5) {
    const brightness = (data[i]! + data[i + 1]! + data[i + 2]!) / 3;
    totalVariance += Math.pow(brightness - avgBrightness, 2);
  }
  const stdDev = samples > 0 ? Math.sqrt(totalVariance / samples) : 0;

  let horizontalEdges = 0;
  let verticalEdges = 0;
  for (let y = 1; y < height - 1; y += 5) {
    for (let x = 1; x < width - 1; x += 5) {
      const leftPx = data[(y * width + (x - 1)) * 4]!;
      const rightPx = data[(y * width + (x + 1)) * 4]!;
      const topPx = data[((y - 1) * width + x) * 4]!;
      const bottomPx = data[((y + 1) * width + x) * 4]!;
      if (Math.abs(rightPx - leftPx) > 30) horizontalEdges++;
      if (Math.abs(bottomPx - topPx) > 30) verticalEdges++;
    }
  }
  const edgeRatio = verticalEdges > 0 ? horizontalEdges / verticalEdges : 1;
  const isTilted =
    edgeRatio > INE_TILT_EDGE_RATIO_MAX || edgeRatio < INE_TILT_EDGE_RATIO_MIN;

  const lapVar = laplacianVariance(data, width, height);
  const isBlurred = lapVar < INE_BLUR_LAPLACIAN_VARIANCE_MIN;
  const isTooDark = avgBrightness > 0 && avgBrightness < INE_DARK_AVG_BRIGHTNESS_MAX;
  const isTooBright = avgBrightness > INE_BRIGHT_AVG_BRIGHTNESS_MIN;
  const hasDocumentFeatures = avgBrightness > 0 && stdDev > 0;

  return {
    isBlurred,
    isTooDark,
    isTooBright,
    isTilted,
    isWellPositioned: hasDocumentFeatures && !isTilted && !isTooDark && !isTooBright && !isBlurred,
  };
}
