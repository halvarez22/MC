/**
 * Autocaptura INE: N ticks estables con calidad OK → un solo disparo (mutex).
 */

import { useEffect, useRef, useState } from 'react';
import {
  INE_AUTO_CAPTURE_STABLE_TICKS,
  isIneCaptureReady,
  type IneImageQualityFlags,
} from '../services/ineCaptureQualityConfig';

export type CaptureMutex = {
  tryLock: () => boolean;
  unlock: () => void;
  isLocked: () => boolean;
};

export function createCaptureMutex(): CaptureMutex {
  let locked = false;
  return {
    tryLock(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    unlock(): void {
      locked = false;
    },
    isLocked(): boolean {
      return locked;
    },
  };
}

export type UseIneAutoCaptureOptions = {
  enabled: boolean;
  quality: IneImageQualityFlags;
  onAutoCapture: () => void;
  mutex: CaptureMutex;
  stableTicks?: number;
};

export function useIneAutoCapture({
  enabled,
  quality,
  onAutoCapture,
  mutex,
  stableTicks = INE_AUTO_CAPTURE_STABLE_TICKS,
}: UseIneAutoCaptureOptions): { stableCount: number } {
  const [stableCount, setStableCount] = useState(0);
  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setStableCount(0);
      firedRef.current = false;
      return;
    }

    if (mutex.isLocked() || firedRef.current) return;

    if (isIneCaptureReady(quality)) {
      setStableCount((prev) => prev + 1);
    } else {
      setStableCount(0);
    }
  }, [enabled, quality, mutex]);

  useEffect(() => {
    if (!enabled || firedRef.current || mutex.isLocked()) return;
    if (stableCount < stableTicks) return;

    if (!mutex.tryLock()) return;
    firedRef.current = true;
    setStableCount(0);
    onAutoCaptureRef.current();
  }, [stableCount, stableTicks, enabled, mutex]);

  return { stableCount: Math.min(stableCount, stableTicks) };
}
