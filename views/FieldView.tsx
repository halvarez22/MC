import React, { useState } from 'react';
import { User } from '../types';
import SelfRegistrationForm, {
  FieldPersistResult,
} from '../components/auth/SelfRegistrationForm';
import { LOGO } from '../constants';
import OfflineIndicator from '../components/field/OfflineIndicator';
import ThemeToggle from '../components/ui/ThemeToggle';
import Button from '../components/ui/Button';

interface FieldViewProps {
  user: User;
  onLogout: () => void;
}

type FieldPhase = 'form' | 'success';

const FieldView: React.FC<FieldViewProps> = ({ user, onLogout }) => {
  const [phase, setPhase] = useState<FieldPhase>('form');
  const [lastResult, setLastResult] = useState<FieldPersistResult | null>(null);
  const [formKey, setFormKey] = useState(0);

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

  const handleSuccess = (result: FieldPersistResult) => {
    setLastResult(result);
    setPhase('success');
  };

  const handleNewCapture = () => {
    setLastResult(null);
    setFormKey((k) => k + 1);
    setPhase('form');
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
             {phase === 'success' && lastResult ? (
               <div className="text-center space-y-6 py-4">
                 {lastResult.isOffline ? (
                   <>
                     <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/40">
                       <span className="text-3xl" aria-hidden>💾</span>
                     </div>
                     <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                       Guardado localmente
                     </h2>
                     <p className="text-gray-600 dark:text-gray-300">
                       Se sincronizará cuando haya conexión.
                     </p>
                   </>
                 ) : (
                   <>
                     <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
                       <svg className="h-8 w-8 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                       </svg>
                     </div>
                     <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                       Afiliado guardado y cifrado en el sistema
                     </h2>
                     <p className="text-gray-600 dark:text-gray-300">
                       {lastResult.duplicate
                         ? 'Este CURP ya estaba registrado; los datos permanecen seguros en la bóveda.'
                         : 'Los datos se cifraron y persistieron correctamente.'}
                     </p>
                   </>
                 )}
                 <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                   <Button type="button" onClick={handleNewCapture} className="w-full sm:w-auto">
                     Nueva captura
                   </Button>
                   <Button type="button" variant="secondary" onClick={onLogout} className="w-full sm:w-auto">
                     Salir
                   </Button>
                 </div>
               </div>
             ) : (
               <>
                 <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Nuevo Registro de Afiliado</h2>
                 <p className="text-gray-600 dark:text-gray-300 mb-6">Completa el formulario para registrar un nuevo miembro. La ubicación y las fotos se pueden tomar en el momento.</p>
                 <SelfRegistrationForm
                    key={formKey}
                    onSuccess={handleSuccess}
                    isFieldMode={true}
                    fieldUser={user}
                 />
               </>
             )}
         </div>
      </main>
    </div>
  );
};

export default FieldView;
