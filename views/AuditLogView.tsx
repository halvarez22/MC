import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { firebaseService } from '../services/firebaseService';
import Spinner from '../components/ui/Spinner';
import AuditLogTable from '../components/audit/AuditLogTable';

const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const unsubscribe = firebaseService.onAuditLogsSnapshot(data => {
        setLogs(data);
        setError(null);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError('No se pudieron cargar los registros de la bitácora.');
      console.error(err);
      setLoading(false);
    }
  }, []);

  if (loading) return <Spinner />;
  if (error) return <div className="text-red-500">{error}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Bitácora de Auditoría</h1>
      <AuditLogTable logs={logs} />
    </div>
  );
};

export default AuditLogView;