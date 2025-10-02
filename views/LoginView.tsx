import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

interface LoginViewProps {
  onNavigateToRegister: () => void;
}

const LoginView: React.FC<LoginViewProps> = ({ onNavigateToRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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
              src="/MC Blanco Transparente.png"
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

            <Input 
              id="password" 
              label="Contraseña" 
              type="password" 
              autoComplete="current-password" 
              required 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Iniciar Sesión
              </Button>
            </div>
          </form>
           <p className="mt-6 text-center text-sm text-gray-600">
                ¿Aún no eres afiliado?{' '}
                <button
                  type="button"
                  onClick={onNavigateToRegister}
                  className="font-medium text-primary hover:text-primary-dark focus:outline-none focus:underline"
                >
                  Regístrate aquí
                </button>
              </p>
        </div>
      </div>
    </div>
  );
};

export default LoginView;