/**
 * Sonido de obturador (APO.5) — Web Audio.
 *
 * iOS: AudioContext DEBE crearse/reanudarse en gesto de usuario
 * (aceptar privacidad / iniciar cámara). No crear el contexto
 * solo dentro de la autocaptura automática.
 */

let sharedCtx: AudioContext | null = null;

function getACConstructor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

/**
 * Llamar SOLO desde un click/touch real (p. ej. Aceptar privacidad).
 * Crea el contexto y hace resume() — desbloquea audio en Safari iOS.
 */
export async function unlockShutterAudio(): Promise<void> {
  try {
    const AC = getACConstructor();
    if (!AC) return;
    if (!sharedCtx || sharedCtx.state === 'closed') {
      sharedCtx = new AC();
    }
    if (sharedCtx.state === 'suspended') {
      await sharedCtx.resume();
    }
  } catch {
    /* no bloquear flujo */
  }
}

/** Click corto ~100ms @ 800Hz. Requiere unlockShutterAudio previo en iOS. */
export async function playShutterSound(): Promise<void> {
  try {
    if (!sharedCtx || sharedCtx.state === 'closed') {
      // Sin unlock previo: no crear contexto aquí (iOS lo bloquearía).
      return;
    }
    if (sharedCtx.state === 'suspended') {
      await sharedCtx.resume().catch(() => undefined);
    }
    const ctx = sharedCtx;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 800;
    gain.gain.setValueAtTime(0.28, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  } catch {
    /* silencio — no bloquear captura */
  }
}
