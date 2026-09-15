/**
 * Autocaptura INE — ventana deslizante (APO.1) + mutex.
 */

import { useEffect, useRef, useState } from 'react';
import {
  INE_AUTO_CAPTURE_MIN_GOOD_TICKS,
  INE_AUTO_CAPTURE_WINDOW_SIZE,
  evaluateSlidingWindow,
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
  windowSize?: number;
  minGoodTicks?: number;
};

export function useIneAutoCapture({
  enabled,
  quality,
  onAutoCapture,
  mutex,
  windowSize = INE_AUTO_CAPTURE_WINDOW_SIZE,
  minGoodTicks = INE_AUTO_CAPTURE_MIN_GOOD_TICKS,
}: UseIneAutoCaptureOptions): { goodTicks: number; windowFilled: number } {
  const [goodTicks, setGoodTicks] = useState(0);
  const [windowFilled, setWindowFilled] = useState(0);
  const historyRef = useRef<boolean[]>([]);
  const onAutoCaptureRef = useRef(onAutoCapture);
  onAutoCaptureRef.current = onAutoCapture;
  const firedRef = useRef(false);

  useEffect(() => {
    if (!enabled) {
      historyRef.current = [];
      setGoodTicks(0);
      setWindowFilled(0);
      firedRef.current = false;
      return;
    }

    if (mutex.isLocked() || firedRef.current) return;

    const ready = isIneCaptureReady(quality);
    historyRef.current = [...historyRef.current, ready].slice(-windowSize);
    const { shouldCapture, goodTicks: good, window } = evaluateSlidingWindow(
      historyRef.current,
      windowSize,
      minGoodTicks
    );
    setGoodTicks(good);
    setWindowFilled(window.length);

    if (shouldCapture) {
      if (!mutex.tryLock()) return;
      firedRef.current = true;
      historyRef.current = [];
      setGoodTicks(0);
      setWindowFilled(0);
      onAutoCaptureRef.current();
    }
  }, [enabled, quality, mutex, windowSize, minGoodTicks]);

  return { goodTicks, windowFilled };
}
