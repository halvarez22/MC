/**
 * Smoke forense autocaptura INE (sin DOM / sin React).
 * Ejecutar: npm run smoke:ine-autocapture
 *
 * Cubre: 3 ticks → 1 disparo; tick malo → reset; mutex; predicado blur/ready.
 */

import { createCaptureMutex } from '../hooks/useIneAutoCapture';
import {
  INE_AUTO_CAPTURE_STABLE_TICKS,
  INE_QUALITY_ANALYSIS_INTERVAL_MS,
  isIneCaptureReady,
  simulateAutoCaptureStreak,
} from './ineCaptureQualityConfig';
import { evaluateIneFrameQuality, laplacianVariance } from './ineCaptureQualityAnalyzer';

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

// --- Streak: 3 buenos → fire en índice 2 ---
{
  const r = simulateAutoCaptureStreak([true, true, true]);
  assert(r.firedAt === 2, `esperado fire@2 got ${r.firedAt}`);
}

// --- Tick malo intercalado → reset, no fire antes ---
{
  const r = simulateAutoCaptureStreak([true, true, false, true, true, true]);
  assert(r.resetCount >= 1, 'esperado al menos 1 reset');
  assert(r.firedAt === 5, `fire tras reset en 5, got ${r.firedAt}`);
}

// --- Nunca 3 seguidos → no fire ---
{
  const r = simulateAutoCaptureStreak([true, false, true, false, true]);
  assert(r.firedAt === null, 'no debió disparar');
}

// --- Mutex: segundo tryLock falla ---
{
  const m = createCaptureMutex();
  assert(m.tryLock() === true, 'primer lock');
  assert(m.tryLock() === false, 'segundo lock debe fallar');
  m.unlock();
  assert(m.tryLock() === true, 'lock tras unlock');
}

// --- Predicado ready ---
{
  assert(
    !isIneCaptureReady({
      isBlurred: true,
      isTooDark: false,
      isTooBright: false,
      isTilted: false,
      isWellPositioned: false,
    }),
    'blur debe bloquear'
  );
  assert(
    isIneCaptureReady({
      isBlurred: false,
      isTooDark: false,
      isTooBright: false,
      isTilted: false,
      isWellPositioned: true,
    }),
    'todo OK debe pasar'
  );
}

// --- Laplaciano: imagen plana ≈ blur; con bordes ≈ nítida ---
{
  const w = 32;
  const h = 32;
  const flat = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < flat.length; i += 4) {
    flat[i] = flat[i + 1] = flat[i + 2] = 128;
    flat[i + 3] = 255;
  }
  const flatVar = laplacianVariance(flat, w, h);

  const edged = new Uint8ClampedArray(flat);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? 0 : 255;
      const i = (y * w + x) * 4;
      edged[i] = edged[i + 1] = edged[i + 2] = v;
    }
  }
  const edgeVar = laplacianVariance(edged, w, h);
  assert(edgeVar > flatVar, `edged (${edgeVar}) > flat (${flatVar})`);

  const qFlat = evaluateIneFrameQuality(flat, w, h);
  assert(qFlat.isBlurred === true, 'plano debe marcar blur');
}

console.log(
  JSON.stringify(
    {
      model: 'discrete_ticks',
      intervalMs: INE_QUALITY_ANALYSIS_INTERVAL_MS,
      stableTicks: INE_AUTO_CAPTURE_STABLE_TICKS,
      approxStableMs: INE_AUTO_CAPTURE_STABLE_TICKS * INE_QUALITY_ANALYSIS_INTERVAL_MS,
      blur: 'laplacian_variance_active',
      darkBright: 'active',
    },
    null,
    2
  )
);
console.log('INE_AUTOCAPTURE_SMOKE_PASS');
