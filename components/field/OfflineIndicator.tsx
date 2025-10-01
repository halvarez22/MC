import React, { useState, useEffect } from 'react';
import { offlineService } from '../../services/offlineService';

const OfflineIndicator: React.FC = () => {
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [pendingCount, setPendingCount] = useState(0);

    const updatePendingCount = async () => {
        const pending = await offlineService.getPendingRegistrations();
        setPendingCount(pending.length);
    };

    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Actualiza el contador periódicamente y en cambios de estado
        updatePendingCount();
        const interval = setInterval(updatePendingCount, 5000); // Check every 5 seconds

        // Escucha un evento personalizado para forzar la actualización del contador
        const handleForceUpdate = () => updatePendingCount();
        window.addEventListener('forceOfflineIndicatorUpdate', handleForceUpdate);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            window.removeEventListener('forceOfflineIndicatorUpdate', handleForceUpdate);
            clearInterval(interval);
        };
    }, []);

    const bgColor = isOnline ? 'bg-green-100' : 'bg-yellow-100';
    const textColor = isOnline ? 'text-green-800' : 'text-yellow-800';
    const ringColor = isOnline ? 'ring-green-500' : 'ring-yellow-500';
    const dotColor = isOnline ? 'bg-green-500' : 'bg-yellow-500';

    return (
        <div className="flex items-center space-x-4">
            {pendingCount > 0 && (
                <div className="text-sm font-medium text-gray-600">
                    <span className="font-bold">{pendingCount}</span> pendiente{pendingCount > 1 ? 's' : ''}
                </div>
            )}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-semibold ${bgColor} ${textColor}`}>
                <span className={`h-2 w-2 rounded-full ${dotColor}`}></span>
                <span>{isOnline ? 'En Línea' : 'Sin Conexión'}</span>
            </div>
        </div>
    );
};

export default OfflineIndicator;