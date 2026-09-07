import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import { InvalidPinError } from '../../hooks/useFieldEncryptionLock';

export interface PinUnlockModalProps {
  isOpen: boolean;
  onUnlock: (pin: string) => Promise<void>;
  onLogout: () => void;
}

/**
 * Desbloqueo de DEK con PIN (C.4). No modifica crypto C.3.
 */
const PinUnlockModal: React.FC<PinUnlockModalProps> = ({
  isOpen,
  onUnlock,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (pin.length < 4 || pin.length > 6) {
      setError('El PIN debe tener entre 4 y 6 dígitos.');
      return;
    }
    setBusy(true);
    try {
      await onUnlock(pin);
      setPin('');
    } catch (err) {
      if (err instanceof InvalidPinError || (err as Error)?.name === 'InvalidPinError') {
        setError('PIN incorrecto. Inténtalo de nuevo.');
      } else {
        setError('No se pudo desbloquear. Inténtalo de nuevo.');
      }
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onLogout} title="Desbloquear datos del dispositivo">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          Ingresa tu PIN para descifrar los datos guardados en este dispositivo. No cierres
          esta ventana sin desbloquear o cerrar sesión.
        </p>

        <div>
          <label
            htmlFor="pin-unlock"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            PIN
          </label>
          <input
            id="pin-unlock"
            type="password"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••"
            disabled={busy}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        )}

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="secondary" onClick={onLogout} disabled={busy}>
            Cerrar sesión
          </Button>
          <Button type="submit" variant="primary" disabled={busy || pin.length < 4} isLoading={busy}>
            Desbloquear
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PinUnlockModal;
