import React, { useState } from 'react';
import Modal from './Modal';
import Button from './Button';
import PrivacyNoticeBody from '../legal/PrivacyNoticeBody';

export interface PrivacyConsentModalProps {
  isOpen: boolean;
  onAccept: () => void;
  onCancel: () => void;
}

/**
 * Consentimiento informado in-app (resumen + checkbox).
 * El aviso legal completo se abre bajo demanda (U-First / LFPDPPP).
 */
const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({
  isOpen,
  onAccept,
  onCancel,
}) => {
  const [checked, setChecked] = useState(false);
  const [showFullNotice, setShowFullNotice] = useState(false);

  if (!isOpen) return null;

  return (
    <>
      <Modal isOpen={isOpen && !showFullNotice} onClose={onCancel} title="Protección de tus datos">
        <div className="space-y-5">
          <p className="text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
            Para proteger tu información, tus datos se cifran en este dispositivo (cuando la
            función de cifrado en reposo esté activa) y las fotos de tu INE se eliminan
            automáticamente tras la validación exitosa. Al continuar, aceptas nuestro{' '}
            <button
              type="button"
              onClick={() => setShowFullNotice(true)}
              className="text-primary hover:text-primary-dark underline font-medium"
            >
              Aviso de Privacidad
            </button>
            .
          </p>

          <label className="flex items-start gap-3 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
            />
            <span>He leído y acepto el Aviso de Privacidad</span>
          </label>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="secondary" onClick={onCancel}>
              Volver
            </Button>
            <Button type="button" variant="primary" onClick={onAccept} disabled={!checked}>
              Continuar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={showFullNotice}
        onClose={() => setShowFullNotice(false)}
        title="Aviso de Privacidad (LFPDPPP)"
      >
        <PrivacyNoticeBody />
        <div className="flex justify-end pt-4 mt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="primary" onClick={() => setShowFullNotice(false)}>
            Cerrar
          </Button>
        </div>
      </Modal>
    </>
  );
};

export default PrivacyConsentModal;
