import React, { useState, useEffect, useCallback } from 'react';
import { User } from './types';
import { firebaseService } from './services/firebaseService';
import {
  clearStoredAuthUser,
  getStoredAuthUser,
  setStoredAuthUser,
} from './services/authSessionStore';
import { useSyncOffline } from './hooks/useSyncOffline';
import { useFieldEncryptionLock } from './hooks/useFieldEncryptionLock';
import { clearSessionKeyFromMemory } from './services/fieldEncryptionSession';
import LoginView from './views/LoginView';
import Layout from './components/layout/Layout';
import DashboardView from './views/DashboardView';
import AffiliatesView from './views/AffiliatesView';
import AuditLogView from './views/AuditLogView';
import Spinner from './components/ui/Spinner';
import RegisterView from './views/RegisterView';
import FieldView from './views/FieldView';
import UsersView from './views/UsersView';
import ForcePasswordChangeView from './views/ForcePasswordChangeView';
import INEDataView from './views/INEDataView';
import PinUnlockModal from './components/ui/PinUnlockModal';
import PinSetupModal from './components/ui/PinSetupModal';

export type View = 'dashboard' | 'affiliates' | 'audit' | 'users' | 'ine-data';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useSyncOffline();

  const {
    ready: pinReady,
    needsPinUnlock,
    needsPinSetup,
    unlock,
    setup,
    refresh: refreshPinLock,
  } = useFieldEncryptionLock();

  useEffect(() => {
    const unsubscribe = firebaseService.auth.onAuthStateChanged((currentUser) => {
      console.log('🔐 Estado de autenticación cambiado:', currentUser);
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.role === 'admin') {
          setCurrentView('dashboard');
        } else if (currentUser.role === 'brigadista') {
          console.log('👷 Brigadista autenticado, redirigiendo a modo campo');
        }
      }
      setLoading(false);
    });

    const handleAuthChange = () => {
      const updatedUser = getStoredAuthUser();
      setUser(updatedUser);
      if (updatedUser && updatedUser.role === 'admin') {
        setCurrentView('dashboard');
      }
      if (updatedUser && updatedUser.role === 'brigadista') {
        setCurrentView('dashboard');
      }
    };
    window.addEventListener('authChanged', handleAuthChange);

    console.log('📱 Sincronización delegada al hook useSyncOffline');

    return () => {
      unsubscribe();
      window.removeEventListener('authChanged', handleAuthChange);
    };
  }, []);

  const handleLogout = useCallback(async () => {
    console.log('🚪 Cerrando sesión...');
    try {
      clearStoredAuthUser();
      clearSessionKeyFromMemory();
      await refreshPinLock();

      await firebaseService.auth.signOut();
      setUser(null);
      setAuthView('login');
      setCurrentView('dashboard');

      console.log('✅ Sesión cerrada exitosamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      clearStoredAuthUser();
      clearSessionKeyFromMemory();
      setUser(null);
    }
  }, [refreshPinLock]);

  const handlePasswordChanged = () => {
    if (user) {
      const updatedUser = { ...user, requiresPasswordChange: false };
      setUser(updatedUser);
      setStoredAuthUser(updatedUser);
    }
  };

  const checkUserAccess = (requiredRole?: 'admin' | 'brigadista') => {
    if (!user) return false;
    if (!requiredRole) return true;
    return user.role === requiredRole;
  };

  const renderAdminView = () => {
    if (!checkUserAccess('admin')) {
      console.warn('🚫 Intento de acceso no autorizado a vista de admin');
      return (
        <div className="text-center text-red-600 p-8">
          <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
          <p>No tienes permisos para acceder a esta sección.</p>
        </div>
      );
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'affiliates':
        return <AffiliatesView user={user!} />;
      case 'audit':
        return <AuditLogView />;
      case 'users':
        return <UsersView user={user!} />;
      case 'ine-data':
        return <INEDataView />;
      default:
        return <DashboardView />;
    }
  };

  if (loading || !pinReady) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // --- Enrutamiento basado en Rol y Estado de Contraseña ---
  if (user) {
    if (user.requiresPasswordChange) {
      return (
        <ForcePasswordChangeView
          onPasswordChanged={handlePasswordChanged}
          onLogout={handleLogout}
        />
      );
    }

    // C.4: prioridad PIN sobre el resto de la app autenticada
    if (needsPinUnlock) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
          <PinUnlockModal isOpen onUnlock={unlock} onLogout={handleLogout} />
        </div>
      );
    }

    if (needsPinSetup) {
      return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
          <PinSetupModal isOpen onSetup={setup} onLogout={handleLogout} />
        </div>
      );
    }

    if (user.role === 'brigadista') {
      return <FieldView user={user} onLogout={handleLogout} />;
    }

    if (user.role === 'admin') {
      return (
        <Layout
          user={user}
          onLogout={handleLogout}
          currentView={currentView}
          onNavigate={setCurrentView}
        >
          {renderAdminView()}
        </Layout>
      );
    }
  }

  if (authView === 'register') {
    return <RegisterView onNavigateToLogin={() => setAuthView('login')} />;
  }
  return <LoginView onNavigateToRegister={() => setAuthView('register')} />;
}

export default App;
