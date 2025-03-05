import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Auth } from './components/Auth';
import { Session } from '@supabase/supabase-js';
import { AffiliatesList } from './components/AffiliatesList';
import { Dashboard } from './components/Dashboard';
import { Reports } from './components/Reports';
import { Documentation } from './components/Documentation';
import { HomeIcon, UserGroupIcon, ChartBarIcon, DocumentTextIcon } from '@heroicons/react/24/outline';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  if (!session) {
    return <Auth />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white shadow">
          <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-900">
              Movimiento Ciudadano - Gestión de Afiliados
            </h1>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session.user.email}
              </span>
              <button
                onClick={() => supabase.auth.signOut()}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-mc-orange hover:bg-mc-orange/90"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </header>
        <div className="flex">
          {/* Sidebar Navigation */}
          <div className="w-64 bg-white shadow-md h-[calc(100vh-80px)] p-4">
            <nav className="space-y-2">
              <NavLink to="/" icon={<HomeIcon className="h-5 w-5" />} label="Dashboard" />
              <NavLink to="/affiliates" icon={<UserGroupIcon className="h-5 w-5" />} label="Afiliados" />
              <NavLink to="/documentation" icon={<DocumentTextIcon className="h-5 w-5" />} label="Documentación" />
              <NavLink to="/reports" icon={<ChartBarIcon className="h-5 w-5" />} label="Reportes" />
            </nav>
          </div>
          
          {/* Main Content */}
          <main className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/affiliates" element={<AffiliatesList />} />
                <Route path="/documentation" element={<Documentation />} />
                <Route path="/reports" element={<Reports />} />
              </Routes>
            </div>
          </main>
        </div>
      </div>
    </Router>
  );
}

interface NavLinkProps {
  to: string;
  icon: React.ReactNode;
  label: string;
}

function NavLink({ to, icon, label }: NavLinkProps) {
  const isActive = window.location.pathname === to || 
    (to !== '/' && window.location.pathname.startsWith(to));
  
  return (
    <a 
      href={to}
      className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
        isActive 
          ? 'bg-mc-orange/10 text-mc-orange' 
          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      <span className="mr-3">{icon}</span>
      {label}
    </a>
  );
}

export default App;