/**
 * Estado reactivo de bloqueo/setup PIN (C.4).
 * Solo consume APIs públicas de fieldEncryptionSession — no altera crypto C.3.
 */

import { useCallback, useEffect, useState } from 'react';
import { isFieldEncryptionEnabled } from '../services/featureFlags';
import {
  getFieldEncryptionLockState,
  getFieldEncryptionSession,
  initFieldEncryptionLockState,
  InvalidPinError,
  persistSessionKey,
  restoreSessionKey,
} from '../services/fieldEncryptionSession';

export type FieldEncryptionUiState = {
  ready: boolean;
  enabled: boolean;
  needsPinUnlock: boolean;
  needsPinSetup: boolean;
  hasSessionKey: boolean;
};

const initial: FieldEncryptionUiState = {
  ready: false,
  enabled: false,
  needsPinUnlock: false,
  needsPinSetup: false,
  hasSessionKey: false,
};

/** needsPinSetup: cifrado ON y aún no hay wrappedKey. needsPinUnlock: KeyStore + sin DEK en RAM. */
function deriveAfterInit(): FieldEncryptionUiState {
  const enabled = isFieldEncryptionEnabled();
  if (!enabled) {
    return {
      ready: true,
      enabled: false,
      needsPinUnlock: false,
      needsPinSetup: false,
      hasSessionKey: false,
    };
  }
  const lock = getFieldEncryptionLockState();
  const needsPinUnlock = Boolean(lock.needsPinUnlock);
  const needsPinSetup = !lock.hasPersistedKey && !needsPinUnlock;
  return {
    ready: true,
    enabled: true,
    needsPinUnlock,
    needsPinSetup,
    hasSessionKey: lock.hasSessionKey,
  };
}

export function useFieldEncryptionLock() {
  const [state, setState] = useState<FieldEncryptionUiState>(initial);

  const refresh = useCallback(async () => {
    if (!isFieldEncryptionEnabled()) {
      setState({
        ready: true,
        enabled: false,
        needsPinUnlock: false,
        needsPinSetup: false,
        hasSessionKey: false,
      });
      return;
    }
    await initFieldEncryptionLockState();
    setState(deriveAfterInit());
  }, []);

  useEffect(() => {
    refresh().catch((err) => {
      console.warn('[useFieldEncryptionLock] refresh falló:', err);
      setState((s) => ({ ...s, ready: true }));
    });
  }, [refresh]);

  const unlock = useCallback(
    async (pin: string) => {
      await restoreSessionKey(pin);
      await refresh();
    },
    [refresh]
  );

  const setup = useCallback(
    async (pin: string) => {
      const session = await getFieldEncryptionSession();
      if (!session) {
        throw new Error('No se pudo iniciar sesión de cifrado para el setup de PIN');
      }
      await persistSessionKey(pin);
      await refresh();
    },
    [refresh]
  );

  return {
    ...state,
    refresh,
    unlock,
    setup,
  };
}

export { InvalidPinError };
