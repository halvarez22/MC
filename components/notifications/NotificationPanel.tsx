import React from 'react';
import { Notification } from '../../types';
import { ICONS } from '../../constants';

const timeSince = (dateString: string): string => {
  const date = new Date(dateString);
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  let interval = seconds / 31536000;
  if (interval > 1) return `hace ${Math.floor(interval)} años`;
  
  interval = seconds / 2592000;
  if (interval > 1) return `hace ${Math.floor(interval)} meses`;
  
  interval = seconds / 86400;
  if (interval > 1) return `hace ${Math.floor(interval)} días`;
  
  interval = seconds / 3600;
  if (interval > 1) return `hace ${Math.floor(interval)} horas`;
  
  interval = seconds / 60;
  if (interval > 1) return `hace ${Math.floor(interval)} min`;
  
  return `hace ${Math.floor(seconds)} seg`;
};


interface NotificationPanelProps {
  notifications: Notification[];
  onMarkAllRead: () => void;
}

const NotificationPanel: React.FC<NotificationPanelProps> = ({ notifications, onMarkAllRead }) => {
  
  const getIconForType = (type: Notification['type']) => {
    switch(type) {
        case 'new_affiliate':
            return <div className="text-blue-500">{React.cloneElement(ICONS.affiliates, { className: "h-5 w-5"})}</div>;
        case 'pending_docs':
            return <div className="text-yellow-600">{React.cloneElement(ICONS.docs, { className: "h-5 w-5"})}</div>;
        default:
            return null;
    }
  }

  return (
    <div className="absolute top-full right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] sm:w-96 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden">
      <div className="p-3 flex justify-between items-center border-b">
        <h3 className="font-semibold text-gray-800">Notificaciones</h3>
        {notifications.some(n => !n.read) && (
            <button 
                onClick={onMarkAllRead}
                className="text-sm font-medium text-primary hover:text-primary-dark"
            >
            Marcar todo como leído
            </button>
        )}
      </div>
      <div className="max-h-96 overflow-y-auto">
        {notifications.length > 0 ? (
          <ul>
            {notifications.map((notification) => (
              <li key={notification.id} className="border-b last:border-b-0 hover:bg-gray-50">
                <a href="#" className="block p-3">
                  <div className="flex items-start space-x-3">
                    {!notification.read && <span className="flex-shrink-0 mt-1.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true"></span>}
                    <div className={`flex-shrink-0 ${notification.read ? 'ml-5' : ''}`}>
                      {getIconForType(notification.type)}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-gray-700">{notification.message}</p>
                      <p className="text-xs text-gray-500 mt-1">{timeSince(notification.timestamp)}</p>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-center py-10 px-4">
            <p className="text-gray-500">No tienes notificaciones nuevas.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationPanel;