import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';

interface LoginViewProps {
  onNavigateToRegister: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const { error } = await firebaseService.auth.signInWithEmailAndPassword(email, password);

    if (error) {
      setError(error.message);
    } 
    // No se necesita `onLogin`, el listener onAuthStateChanged en App.tsx se encargará
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-20 w-20 flex items-center justify-center">
            <img
              src="/images/MC Blanco Transparente.png"
              alt="Logo MC Blanco"
              className="w-full h-full object-contain"
            />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Sistema de Gestión
        </h2>
        <p className="mt-2 text-center text-sm text-gray-100">
          Inicia sesión en tu cuenta
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            <Input 
              id="email" 
              label="Correo Electrónico" 
              type="text" 
              autoComplete="username" 
              required 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />

            <div className="relative">
              <Input
                id="password"
                label="Contraseña"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-sm leading-5 mt-6"
                tabIndex={-1}
              >
                {showPassword ? (
                  <svg className="h-5 w-5 text-gray-500 hover:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5 text-gray-500 hover:text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Iniciar Sesión
              </Button>
            </div>
          </form>
           <div className="mt-6 text-center space-y-2">
              <p className="text-sm text-gray-600">
                ¿Aún no eres afiliado?{' '}
                <button
                  type="button"
                  onClick={onNavigateToRegister}
                  className="font-medium text-primary hover:text-primary-dark focus:outline-none focus:underline"
                >
                  Regístrate aquí
                </button>
              </p>
              <p className="text-xs text-gray-500">
                <button
                  type="button"
                  onClick={() => setShowPrivacyModal(true)}
                  className="text-primary hover:text-primary-dark underline focus:outline-none"
                >
                  Conoce nuestro aviso de privacidad
                </button>
              </p>
            </div>
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

export default LoginView;