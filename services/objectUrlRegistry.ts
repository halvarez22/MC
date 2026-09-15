/**
 * Registro de Object URLs (D.1).
 * executeLocalPurge revoca todos los tracked para no dejar blobs en memoria.
 * El cableado de createObjectURL en UI usa createTrackedObjectUrl / useTrackedObjectUrl.
 */

const tracked = new Set<string>();

export function trackObjectUrl(url: string): string {
  tracked.add(url);
  return url;
}

export function createTrackedObjectUrl(blob: Blob | MediaSource): string {
  const url = URL.createObjectURL(blob);
  return trackObjectUrl(url);
}

export function revokeTrackedObjectUrl(url: string): void {
  if (!tracked.has(url)) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
    return;
  }
  try {
    URL.revokeObjectURL(url);
  } catch {
    /* ignore */
  }
  tracked.delete(url);
}

export function revokeAllTrackedObjectUrls(): void {
  for (const url of tracked) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      /* ignore */
    }
  }
  tracked.clear();
}

export function getTrackedObjectUrlCount(): number {
  return tracked.size;
}
