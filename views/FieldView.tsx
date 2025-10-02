import React from 'react';
import { User } from '../types';
import SelfRegistrationForm from '../components/auth/SelfRegistrationForm';
import { LOGO } from '../constants';
import OfflineIndicator from '../components/field/OfflineIndicator';

interface FieldViewProps {
  user: User;
  onLogout: () => void;
}

const FieldView: React.FC<FieldViewProps> = ({ user, onLogout }) => {
  const handleSuccess = (isOffline: boolean) => {
    if (isOffline) {
        alert('Estás sin conexión. El afiliado se ha guardado localmente y se sincronizará cuando recuperes la conexión.');
    } else {
        alert('¡Afiliado registrado y sincronizado con éxito!');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      <header className="bg-white shadow-md p-4 flex justify-between items-center sticky top-0 z-10">
        <div className="flex items-center">
            <div className="w-10 h-10 mr-3 text-primary">{LOGO}</div>
            <div>
                <h1 className="text-lg font-bold text-gray-800">Modo Campo</h1>
                <p className="text-sm text-gray-500">{user.email}</p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <OfflineIndicator />
            <button
                onClick={onLogout}
                className="font-medium text-primary hover:text-primary-dark focus:outline-none"
            >
                Salir
            </button>
        </div>
      </header>

      <main className="flex-grow p-4 sm:p-6 lg:p-8">
         <div className="max-w-2xl mx-auto bg-white p-4 sm:p-6 rounded-lg shadow-lg">
             <h2 className="text-2xl font-bold text-gray-900 mb-2">Nuevo Registro de Afiliado</h2>
             <p className="text-gray-600 mb-6">Completa el formulario para registrar un nuevo miembro. La ubicación y las fotos se pueden tomar en el momento.</p>
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