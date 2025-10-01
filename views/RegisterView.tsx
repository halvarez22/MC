import React, { useState } from 'react';
import SelfRegistrationForm from '../components/auth/SelfRegistrationForm';
import { LOGO } from '../constants';

interface RegisterViewProps {
  onNavigateToLogin: () => void;
}

const RegisterView: React.FC<RegisterViewProps> = ({ onNavigateToLogin }) => {
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSuccess = () => {
    setIsSuccess(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
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
              <p className="mt-6 text-center text-sm text-gray-600">
                ¿Ya tienes una cuenta?{' '}
                <button
                  onClick={onNavigateToLogin}
                  className="font-medium text-primary hover:text-primary-dark focus:outline-none focus:underline"
                >
                  Inicia sesión aquí
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default RegisterView;