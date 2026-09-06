import React, { useState, useEffect } from 'react';
import { User } from './types';
import { firebaseService } from './services/firebaseService';
import { offlineService } from './services/offlineService';
import { useSyncOffline } from './hooks/useSyncOffline';
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

export type View = 'dashboard' | 'affiliates' | 'audit' | 'users' | 'ine-data';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Hook para sincronización offline de INEs
  useSyncOffline();

  useEffect(() => {
    const unsubscribe = firebaseService.auth.onAuthStateChanged(currentUser => {
      console.log('🔐 Estado de autenticación cambiado:', currentUser);
      setUser(currentUser);
      if (currentUser) {
        if (currentUser.role === 'admin') {
          setCurrentView('dashboard');
        } else if (currentUser.role === 'brigadista') {
          // Los brigadistas van directo al modo campo (afiliaciones)
          console.log('👷 Brigadista autenticado, redirigiendo a modo campo');
        }
      }
      setLoading(false);
    });

    const handleAuthChange = () => {
        const userJson = localStorage.getItem('firebase.auth.user');
        const updatedUser = userJson ? JSON.parse(userJson) : null;
        setUser(updatedUser);
        if (updatedUser && updatedUser.role === 'admin') {
            setCurrentView('dashboard');
        }
        if (updatedUser && updatedUser.role === 'brigadista') {
            setCurrentView('dashboard'); // Los brigadistas van directo a afiliaciones
        }
    }
    window.addEventListener('authChanged', handleAuthChange);

    // SINCRONIZACIÓN SIMPLIFICADA - EL HOOK useSyncOffline SE ENCARGARÁ
    console.log("📱 Sincronización delegada al hook useSyncOffline");

    return () => {
        unsubscribe();
        window.removeEventListener('authChanged', handleAuthChange);
    };
  }, []);

  const handleLogout = async () => {
    console.log('🚪 Cerrando sesión...');
    try {
      // Limpiar completamente la sesión
      localStorage.removeItem('firebase.auth.user');
      sessionStorage.clear(); // Por si acaso queda algo

      await firebaseService.auth.signOut();
      setUser(null);
      setAuthView('login');
      setCurrentView('dashboard');

      console.log('✅ Sesión cerrada exitosamente');
    } catch (error) {
      console.error('❌ Error al cerrar sesión:', error);
      // Forzar limpieza aunque haya error
      localStorage.removeItem('firebase.auth.user');
      setUser(null);
    }
  };

  const handlePasswordChanged = () => {
    // Actualiza el estado local del usuario para reflejar el cambio
    // y permitir que la aplicación renderice la vista correcta.
    if (user) {
      const updatedUser = { ...user, requiresPasswordChange: false };
      setUser(updatedUser);
      // También actualiza sessionStorage para persistir el cambio en la sesión
      sessionStorage.setItem('firebase.auth.user', JSON.stringify(updatedUser));
    }
  };

  // Función de seguridad: verificar permisos de acceso
  const checkUserAccess = (requiredRole?: 'admin' | 'brigadista') => {
    if (!user) return false;
    if (!requiredRole) return true; // Si no requiere rol específico, solo autenticación
    return user.role === requiredRole;
  };

  const renderAdminView = () => {
    // Verificación de seguridad: solo admins pueden acceder a estas vistas
    if (!checkUserAccess('admin')) {
      console.warn('🚫 Intento de acceso no autorizado a vista de admin');
      return <div className="text-center text-red-600 p-8">
        <h2 className="text-2xl font-bold mb-4">Acceso Denegado</h2>
        <p>No tienes permisos para acceder a esta sección.</p>
      </div>;
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // --- Enrutamiento basado en Rol y Estado de Contraseña ---
  if (user) {
    // Prioridad 1: Forzar cambio de contraseña si es requerido
    if (user.requiresPasswordChange) {
      return <ForcePasswordChangeView onPasswordChanged={handlePasswordChanged} onLogout={handleLogout} />;
    }

    // Prioridad 2: Enrutamiento basado en Rol
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
  
  // Sin usuario o con rol no válido: Mostrar vistas de autenticación
  if (authView === 'register') {
    return <RegisterView onNavigateToLogin={() => setAuthView('login')} />;
  }
  return <LoginView onNavigateToRegister={() => setAuthView('register')} />;
}

export default App;