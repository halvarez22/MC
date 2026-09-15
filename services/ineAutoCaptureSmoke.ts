/**
 * Smoke APO — ventana 5/4 + mutex + umbrales.
 * npm run smoke:ine-autocapture
 *
 * [T,F,T,T,T] → 4/5 → dispara
 * [T,F,T,F,T] → 3/5 → NO dispara
 */

import { createCaptureMutex } from '../hooks/useIneAutoCapture';
import {
  INE_AUTO_CAPTURE_MIN_GOOD_TICKS,
  INE_AUTO_CAPTURE_WINDOW_SIZE,
  INE_FORCE_CAPTURE_AFTER_MS,
  INE_ADAPTIVE_RELAX_AFTER_MS,
  INE_QUALITY_ANALYSIS_INTERVAL_MS,
  evaluateSlidingWindow,
  getIneQualityFailReason,
  getIneQualityThresholds,
  isIneCaptureReady,
} from './ineCaptureQualityConfig';
import { evaluateIneFrameQuality, laplacianVariance } from './ineCaptureQualityAnalyzer';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// APO.1 — [T,F,T,T,T] → dispara (4 buenos)
{
  const r = evaluateSlidingWindow([true, false, true, true, true]);
  assert(r.shouldCapture === true, '4/5 debe capturar');
  assert(r.goodTicks === 4, `good=4 got ${r.goodTicks}`);
}

// APO.1 — [T,F,T,F,T] → NO dispara (solo 3 buenos)
{
  const r = evaluateSlidingWindow([true, false, true, false, true]);
  assert(r.shouldCapture === false, '3/5 NO debe capturar');
  assert(r.goodTicks === 3, 'good=3');
}

// Ventana incompleta (<5) → no dispara aunque haya 4 true
{
  const r = evaluateSlidingWindow([true, true, true, true]);
  assert(r.shouldCapture === false, 'ventana incompleta no dispara');
}

// Mutex
{
  const m = createCaptureMutex();
  assert(m.tryLock() && !m.tryLock(), 'mutex');
  m.unlock();
}

// Fail reason + blur
{
  assert(
    getIneQualityFailReason({
      isBlurred: true,
      isTooDark: false,
      isTooBright: false,
      isTilted: true,
      isWellPositioned: false,
    }) === 'blur',
    'prioridad blur'
  );
  assert(
    !isIneCaptureReady({
      isBlurred: true,
      isTooDark: false,
      isTooBright: false,
      isTilted: false,
      isWellPositioned: false,
    }),
    'blur bloquea'
  );
}

// APO.3 — umbrales tras 3s
{
  const strict = getIneQualityThresholds(0);
  const relax = getIneQualityThresholds(INE_ADAPTIVE_RELAX_AFTER_MS + 1);
  assert(relax.blurLaplacianMin > strict.blurLaplacianMin, 'blur relajado @3s');
  assert(INE_ADAPTIVE_RELAX_AFTER_MS === 3000, 'const 3s');
  assert(INE_FORCE_CAPTURE_AFTER_MS === 5000, 'const 5s forzar');
}

// Laplaciano
{
  const w = 32;
  const h = 32;
  const flat = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < flat.length; i += 4) {
    flat[i] = flat[i + 1] = flat[i + 2] = 128;
    flat[i + 3] = 255;
  }
  const edged = new Uint8ClampedArray(flat);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? 0 : 255;
      const i = (y * w + x) * 4;
      edged[i] = edged[i + 1] = edged[i + 2] = v;
    }
  }
  assert(laplacianVariance(edged, w, h) > laplacianVariance(flat, w, h), 'edge>flat');
  assert(evaluateIneFrameQuality(flat, w, h).isBlurred === true, 'plano blur');
}

console.log(
  JSON.stringify(
    {
      model: 'sliding_window',
      windowSize: INE_AUTO_CAPTURE_WINDOW_SIZE,
      minGood: INE_AUTO_CAPTURE_MIN_GOOD_TICKS,
      intervalMs: INE_QUALITY_ANALYSIS_INTERVAL_MS,
      adaptiveRelaxMs: INE_ADAPTIVE_RELAX_AFTER_MS,
      forceCaptureMs: INE_FORCE_CAPTURE_AFTER_MS,
    },
    null,
    2
  )
);
console.log('INE_AUTOCAPTURE_SMOKE_PASS');
