import React from 'react';
import { User } from '../types';
import SelfRegistrationForm from '../components/auth/SelfRegistrationForm';
import { LOGO } from '../constants';
import OfflineIndicator from '../components/field/OfflineIndicator';
import ThemeToggle from '../components/ui/ThemeToggle';

interface FieldViewProps {
  user: User;
  onLogout: () => void;
}

const FieldView: React.FC<FieldViewProps> = ({ user, onLogout }) => {
  if (!user || user.role !== 'brigadista') {
    console.warn('🚫 Intento de acceso no autorizado a modo campo');
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex items-center justify-center">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-lg text-center border border-transparent dark:border-gray-800">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Acceso Denegado</h2>
          <p className="text-gray-600 dark:text-gray-300">Solo los brigadistas tienen acceso a esta sección.</p>
          <button
            onClick={onLogout}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary-dark"
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  const handleSuccess = (isOffline: boolean, userRegistered?: boolean) => {
    if (isOffline) {
        alert('Estás sin conexión. El afiliado se ha guardado localmente y se sincronizará cuando recuperes la conexión.');
    } else {
        if (userRegistered) {
            alert('¡Afiliado registrado exitosamente! Se ha creado una cuenta en la app y enviado un email de bienvenida al simpatizante.');
        } else {
            alert('¡Afiliado registrado exitosamente! Los datos han sido guardados en el sistema.');
        }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 flex flex-col">
      <header className="bg-white dark:bg-gray-900 shadow-md dark:shadow-none dark:border-b dark:border-gray-800 p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
            <div className="w-10 h-10 mr-3 text-primary">{LOGO}</div>
            <div>
                <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">Modo Campo</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
            </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
            <ThemeToggle />
            <OfflineIndicator />
            <button
                onClick={onLogout}
                className="font-medium text-primary hover:text-primary-dark focus:outline-none min-h-[44px] px-2"
            >
                Salir
            </button>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
         <div className="max-w-2xl mx-auto bg-white dark:bg-gray-900 p-4 sm:p-6 rounded-lg shadow-lg dark:shadow-none border border-transparent dark:border-gray-800">
             <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Nuevo Registro de Afiliado</h2>
             <p className="text-gray-600 dark:text-gray-300 mb-6">Completa el formulario para registrar un nuevo miembro. La ubicación y las fotos se pueden tomar en el momento.</p>
             <SelfRegistrationForm 
                onSuccess={handleSuccess} 
                isFieldMode={true} 
                fieldUser={user}
            />
         </div>
      </main>
    </div>
  );
};

export default FieldView;
