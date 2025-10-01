import React, { useState } from 'react';
import { firebaseService } from '../services/firebaseService';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { LOGO } from '../constants';

interface ForcePasswordChangeViewProps {
  onPasswordChanged: () => void;
  onLogout: () => void;
}

const ForcePasswordChangeView: React.FC<ForcePasswordChangeViewProps> = ({ onPasswordChanged, onLogout }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }

    setIsLoading(true);
    try {
      await firebaseService.updateCurrentUserPassword(newPassword);
      onPasswordChanged();
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error al cambiar la contraseña.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-light to-primary flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="mx-auto h-20 w-20 text-white">{LOGO}</div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
          Cambio de Contraseña Requerido
        </h2>
        <p className="mt-2 text-center text-sm text-gray-100">
          Por seguridad, debes cambiar tu contraseña inicial para continuar.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-lg sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              id="new-password"
              label="Nueva Contraseña"
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Input
              id="confirm-password"
              label="Confirmar Nueva Contraseña"
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <div>
              <Button type="submit" className="w-full" isLoading={isLoading}>
                Guardar y Continuar
              </Button>
            </div>
          </form>
          <div className="mt-6 text-center">
            <button
                onClick={onLogout}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 focus:outline-none"
            >
                Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForcePasswordChangeView;