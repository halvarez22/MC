import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';

export interface PinSetupModalProps {
  isOpen: boolean;
  onSetup: (pin: string) => Promise<void>;
  onLogout: () => void;
}

/**
 * Primer uso: crear PIN 4–6 dígitos y persistSessionKey (C.4).
 */
const PinSetupModal: React.FC<PinSetupModalProps> = ({
  isOpen,
  onSetup,
  onLogout,
}) => {
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
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
    if (pin !== confirm) {
      setError('Los PIN no coinciden. Inténtalo de nuevo.');
      return;
    }
    setBusy(true);
    try {
      await onSetup(pin);
      setPin('');
      setConfirm('');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar el PIN.';
      setError(msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onLogout} title="Protege tus datos en este dispositivo">
      <form onSubmit={handleSubmit} className="space-y-5">
        <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">
          Crea un PIN de 4 a 6 dígitos para cifrar la información sensible guardada en este
          dispositivo. Lo necesitarás tras cerrar la app o recargar la página.
        </p>

        <div>
          <label
            htmlFor="pin-setup"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            Nuevo PIN
          </label>
          <input
            id="pin-setup"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
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

        <div>
          <label
            htmlFor="pin-setup-confirm"
            className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1"
          >
            Confirmar PIN
          </label>
          <input
            id="pin-setup-confirm"
            type="password"
            inputMode="numeric"
            autoComplete="new-password"
            pattern="[0-9]*"
            maxLength={6}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value.replace(/\D/g, '').slice(0, 6))}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100 tracking-widest text-center text-lg focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="••••"
            disabled={busy}
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
          <Button
            type="submit"
            variant="primary"
            disabled={busy || pin.length < 4 || confirm.length < 4}
            isLoading={busy}
          >
            Guardar PIN
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default PinSetupModal;
