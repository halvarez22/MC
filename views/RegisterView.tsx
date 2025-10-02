import React, { useState } from 'react';
import SelfRegistrationForm from '../components/auth/SelfRegistrationForm';
import Modal from '../components/ui/Modal';
import { LOGO } from '../constants';

interface RegisterViewProps {
  onNavigateToLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onNavigateToLogin }) => {
  const [isSuccess, setIsSuccess] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const handleSuccess = () => {
    setIsSuccess(true);
  };

  const handleShowPrivacy = () => {
    setShowPrivacyModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Botón de cerrar en la esquina superior */}
      <div className="absolute top-4 left-4 sm:top-6 sm:left-6">
        <button
          onClick={onNavigateToLogin}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/20 hover:bg-white/30 text-white transition-colors"
          aria-label="Cerrar y volver al login"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-20 w-20 text-white">{LOGO}</div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          {isSuccess ? '¡Registro Exitoso!' : 'Formulario de Auto-Registro'}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-2xl">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          {isSuccess ? (
            <div className="text-center">
              <p className="text-gray-600">
                Gracias por registrarte. Tu solicitud ha sido enviada y será revisada por un administrador. Recibirás una notificación por correo electrónico una vez que sea procesada.
              </p>
              <button
                onClick={onNavigateToLogin}
                className="mt-6 inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
              >
                Volver al Inicio de Sesión
              </button>
            </div>
          ) : (
            <>
              <SelfRegistrationForm onSuccess={handleSuccess} />
              <div className="mt-6 text-center space-y-4">
                <p className="text-xs text-gray-500">
                  Al registrarte, aceptas nuestro{' '}
                  <button
                    onClick={handleShowPrivacy}
                    className="text-primary hover:text-primary-dark underline focus:outline-none"
                  >
                    aviso de privacidad
                  </button>
                </p>
                <div>
                  <p className="text-sm text-gray-600 mb-3">
                    ¿Ya tienes una cuenta?
                  </p>
                  <button
                    onClick={onNavigateToLogin}
                    className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors"
                  >
                    ← Volver al Inicio de Sesión
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Modal de Aviso de Privacidad */}
      <Modal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
        title="PROTECCIÓN Y USO DE DATOS PERSONALES"
      >
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-700 leading-relaxed">
            Los datos personales recabados serán protegidos, incorporados y tratados en el Sistema de Datos Personales correspondiente, de conformidad con lo dispuesto por la Ley Federal de Transparencia y Acceso a la Información Pública Gubernamental y demás disposiciones aplicables.
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default RegisterView;