/**
 * Hooks mínimos para e2e Zero-PII (solo DEV o VITE_E2E_HOOKS=true).
 */

import {
  executeLocalPurge,
  markForLocalPurge,
} from './ineOfflineService';
import {
  acknowledgeIneSync,
  isValidSyncAck,
} from './syncAckService';
import {
  createTrackedObjectUrl,
  getTrackedObjectUrlCount,
  revokeAllTrackedObjectUrls,
} from './objectUrlRegistry';

export type McD1TestApi = {
  markForLocalPurge: typeof markForLocalPurge;
  executeLocalPurge: typeof executeLocalPurge;
  acknowledgeIneSync: typeof acknowledgeIneSync;
  isValidSyncAck: typeof isValidSyncAck;
  createTrackedObjectUrl: typeof createTrackedObjectUrl;
  getTrackedObjectUrlCount: typeof getTrackedObjectUrlCount;
  revokeAllTrackedObjectUrls: typeof revokeAllTrackedObjectUrls;
};

declare global {
  interface Window {
    __MC_D1__?: McD1TestApi;
  }
}

export function installD1E2eHooks(): void {
  if (typeof window === 'undefined') return;
  const allow =
    import.meta.env.DEV === true || import.meta.env.VITE_E2E_HOOKS === 'true';
  if (!allow) return;

  window.__MC_D1__ = {
    markForLocalPurge,
    executeLocalPurge,
    acknowledgeIneSync,
    isValidSyncAck,
    createTrackedObjectUrl,
    getTrackedObjectUrlCount,
    revokeAllTrackedObjectUrls,
  };
}
