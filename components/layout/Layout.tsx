import React, { useState, useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import { User, Notification } from '../../types';
import { View } from '../../App';
import { firebaseService } from '../../services/firebaseService';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  currentView: View;
  onNavigate: (view: View) => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, currentView, onNavigate, children }) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const unsubscribe = firebaseService.onNotificationsSnapshot(setNotifications);
    return () => unsubscribe();
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleMarkAllRead = async () => {
    await firebaseService.markAllNotificationsAsRead();
  };
  
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar 
        currentView={currentView} 
        onNavigate={onNavigate} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          user={user} 
          onLogout={onLogout} 
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          unreadCount={unreadCount}
          notifications={notifications}
          onMarkAllRead={handleMarkAllRead}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-light p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
