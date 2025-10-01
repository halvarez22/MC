import React, { useState, useEffect } from 'react';
import { User } from './types';
import { firebaseService } from './services/firebaseService';
import { offlineService } from './services/offlineService';
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

export type View = 'dashboard' | 'affiliates' | 'audit' | 'users';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  useEffect(() => {
    const unsubscribe = firebaseService.auth.onAuthStateChanged(currentUser => {
      setUser(currentUser);
      if (currentUser && currentUser.role === 'admin') {
        setCurrentView('dashboard');
      }
      setLoading(false);
    });

    const handleAuthChange = () => {
        const userJson = sessionStorage.getItem('firebase.auth.user');
        const updatedUser = userJson ? JSON.parse(userJson) : null;
        setUser(updatedUser);
        if (updatedUser && updatedUser.role === 'admin') {
            setCurrentView('dashboard');
        }
    }
    window.addEventListener('authChanged', handleAuthChange);
    
    // --- Lógica de Sincronización Offline ---
    const handleSync = async () => {
        console.log("Intentando sincronizar registros offline...");
        try {
            const pending = await offlineService.getPendingRegistrations();
            if (pending.length > 0) {
                console.log(`Sincronizando ${pending.length} registros.`);
                for (const reg of pending) {
                    // Mapea los documentos para que coincidan con la firma de la API
                    const documentsForApi = reg.documents.map(({ type, fileName }) => ({ type, fileName }));
                    
                    await firebaseService.registerAffiliate(reg.formData, documentsForApi, reg.geolocation);
                    await offlineService.deleteRegistration(reg.id);
                    console.log(`Registro ${reg.id} sincronizado y eliminado de la cola.`);
                }
                alert(`${pending.length} afiliado(s) guardado(s) localmente han sido sincronizados con éxito.`);
                // Forzar actualización del indicador de pendientes
                window.dispatchEvent(new CustomEvent('forceOfflineIndicatorUpdate'));
            } else {
                 console.log("No hay registros pendientes para sincronizar.");
            }
        } catch (error) {
            console.error("Error durante la sincronización:", error);
            alert("Ocurrió un error al intentar sincronizar los datos. Por favor, revisa la consola.");
        }
    };

    const handleOnline = () => {
      console.log('Conexión recuperada. Iniciando sincronización.');
      handleSync();
    };

    window.addEventListener('online', handleOnline);

    // Sincronización inicial al cargar si hay conexión
    if (navigator.onLine) {
      handleSync();
    }

    return () => {
        unsubscribe();
        window.removeEventListener('authChanged', handleAuthChange);
        window.removeEventListener('online', handleOnline);
    };
  }, []);

  const handleLogout = async () => {
    await firebaseService.auth.signOut();
    setUser(null);
    setAuthView('login');
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

  const renderAdminView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardView />;
      case 'affiliates':
        return <AffiliatesView user={user!} />;
      case 'audit':
        return <AuditLogView />;
      case 'users':
        return <UsersView user={user!} />;
      default:
        return <DashboardView />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-light flex items-center justify-center">
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