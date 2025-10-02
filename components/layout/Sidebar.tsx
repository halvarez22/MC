import React from 'react';
import { ICONS } from '../../constants';
import { View } from '../../App';

interface SidebarProps {
  currentView: View;
  onNavigate: (view: View) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

const navItems: { id: View; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: ICONS.dashboard },
  { id: 'affiliates', label: 'Afiliados', icon: ICONS.affiliates },
  { id: 'users', label: 'Usuarios', icon: ICONS.userManagement },
  { id: 'audit', label: 'Bitácora', icon: ICONS.audit },
];

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, isOpen, setIsOpen }) => {
  
  const handleNavigate = (view: View) => {
    onNavigate(view);
    setIsOpen(false); // Close sidebar on navigation in mobile
  }
  
  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 z-30 lg:hidden transition-opacity ${
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setIsOpen(false)}
      ></div>

      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-primary text-white flex-col z-40
                   transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:relative lg:flex
                   ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="h-20 flex items-center justify-center border-b border-primary-dark shrink-0">
          <div className="w-10 h-10 mr-2 flex items-center justify-center">
            <img
              src="/images/MC Negro Transparente.png"
              alt="Logo MC Negro"
              className="w-full h-full object-contain"
            />
          </div>
          <h1 className="text-xl font-bold">Gestión</h1>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center px-4 py-2 rounded-lg transition-colors ${
                currentView === item.id
                  ? 'bg-primary-dark text-white'
                  : 'text-primary-lightest hover:bg-primary-dark hover:text-white'
              }`}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;