import React, { useState, useEffect, useRef } from 'react';
import { User, Notification } from '../../types';
import { ICONS } from '../../constants';
import NotificationPanel from '../notifications/NotificationPanel';

interface HeaderProps {
  user: User;
  onLogout: () => void;
  onToggleSidebar: () => void;
  unreadCount: number;
  notifications: Notification[];
  onMarkAllRead: () => void;
}

const Header: React.FC<HeaderProps> = ({ user, onLogout, onToggleSidebar, unreadCount, notifications, onMarkAllRead }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-20 bg-white shadow-md flex items-center justify-between lg:justify-end px-4 sm:px-6 lg:px-8 shrink-0 z-20">
      <div className="flex items-center space-x-4">
        <div className="w-10 h-10 flex items-center justify-center">
          <img
            src="/images/MC Naranja Transparente.png"
            alt="Logo MC Naranja"
            className="w-full h-full object-contain"
          />
        </div>
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-md text-gray-500 hover:text-gray-800 hover:bg-gray-100 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label="Abrir menú"
        >
          {ICONS.menu}
        </button>
      </div>
      <div className="flex items-center space-x-4">
        <div ref={panelRef} className="relative">
          <button
            onClick={() => setIsNotificationsOpen(prev => !prev)}
            className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center relative"
            aria-label="Ver notificaciones"
          >
            {ICONS.bell}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-5 w-5 bg-primary-dark items-center justify-center text-xs text-white font-bold">
                  {unreadCount}
                </span>
              </span>
            )}
          </button>
          {isNotificationsOpen && (
            <NotificationPanel
              notifications={notifications}
              onMarkAllRead={() => {
                onMarkAllRead();
                setIsNotificationsOpen(false);
              }}
            />
          )}
        </div>

        <div className="w-px h-8 bg-gray-200" aria-hidden="true"></div>

        <div className="text-right">
          <p className="font-semibold text-gray-800">{user.email || 'Usuario'}</p>
          <p className="text-sm text-primary font-semibold capitalize">{user.role}</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 rounded-full text-gray-500 hover:bg-red-100 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
          aria-label="Cerrar sesión"
        >
          {ICONS.logout}
        </button>
      </div>
    </header>
  );
};

export default Header;
