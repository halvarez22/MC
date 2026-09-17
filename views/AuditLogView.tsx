import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { AuditLog } from '../types';
import type { AuditAction, AuditEvent } from '../services/auditEventStore';
import { firebaseService } from '../services/firebaseService';
import { listForensicEvents } from '../services/forensicAuditClient';
import { formatAuditActionLabel } from '../services/auditMask';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import AuditLogTable from '../components/audit/AuditLogTable';

const useForensicAudit =
  String(import.meta.env.VITE_USE_FORENSIC_AUDIT ?? 'true').toLowerCase() !==
  'false';

function eventToRow(ev: AuditEvent): AuditLog {
  return {
    id: ev.id,
    timestamp: ev.ts,
    userEmail: ev.actorEmail,
    action: formatAuditActionLabel(ev.action, ev.curpMasked, ev.screen),
    details: ev.sourceSummary,
    sourceSummary: ev.sourceSummary,
    curpMasked: ev.curpMasked,
    screen: ev.screen,
    outcome: ev.outcome,
    actionCode: ev.action,
  };
}

const ACTION_FILTERS: { value: '' | AuditAction; label: string }[] = [
  { value: '', label: 'Todas' },
  { value: 'LOGIN_SUCCESS', label: 'Acceso correcto' },
  { value: 'LOGIN_FAILURE', label: 'Login fallido' },
  { value: 'LOGOUT', label: 'Cierre de sesión' },
  { value: 'AFFILIATE_CREATE', label: 'Afilió' },
  { value: 'AFFILIATE_DUPLICATE', label: 'Duplicado' },
  { value: 'ADMIN_AFFILIATE_DELETE', label: 'Baja' },
  { value: 'SCREEN_VIEW', label: 'Menús' },
];

const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState<'' | AuditAction>('');

  const loadForensic = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const events = await listForensicEvents();
      setLogs(events.map(eventToRow));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron cargar los registros de la bitácora.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (useForensicAudit) {
      void loadForensic();
      return;
    }

    try {
      const unsubscribe = firebaseService.onAuditLogsSnapshot((data) => {
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
  }, [loadForensic]);

  const filtered = useMemo(() => {
    const q = filterUser.trim().toLowerCase();
    return logs.filter((row) => {
      if (q && !row.userEmail.toLowerCase().includes(q)) return false;
      if (filterAction && row.actionCode !== filterAction) return false;
      return true;
    });
  }, [logs, filterUser, filterAction]);

  if (loading) return <Spinner />;

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Bitácora de Auditoría
        </h1>
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <div className="flex gap-3">
          <Button type="button" onClick={() => void loadForensic()}>
            Reintentar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Bitácora de Auditoría
      </h1>

      {useForensicAudit && (
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300 flex-1">
            Usuario
            <input
              type="search"
              value={filterUser}
              onChange={(e) => setFilterUser(e.target.value)}
              placeholder="Filtrar por email…"
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-700 dark:text-gray-300 sm:w-56">
            Acción
            <select
              value={filterAction}
              onChange={(e) =>
                setFilterAction(e.target.value as '' | AuditAction)
              }
              className="rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-gray-900 dark:text-white"
            >
              {ACTION_FILTERS.map((opt) => (
                <option key={opt.label} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <Button type="button" variant="secondary" onClick={() => void loadForensic()}>
            Actualizar
          </Button>
        </div>
      )}

      <AuditLogTable logs={filtered} forensic={useForensicAudit} />
    </div>
  );
};

export default AuditLogView;
