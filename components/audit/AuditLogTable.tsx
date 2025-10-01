import React from 'react';
import { AuditLog } from '../../types';

interface AuditLogTableProps {
  logs: AuditLog[];
}

const AuditLogTable: React.FC<AuditLogTableProps> = ({ logs }) => {
  if (logs.length === 0) {
    return <div className="text-center py-10 bg-white rounded-lg shadow-md">No hay registros en la bitácora.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md md:bg-transparent md:shadow-none">
      <table className="min-w-full divide-y divide-gray-200 responsive-table">
        <thead className="bg-primary-lightest">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Usuario
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Acción
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Detalles
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 md:bg-transparent">
          {logs.map((log) => (
            <tr key={log.id} className="hover:bg-gray-50">
              <td data-label="Usuario:" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{log.userEmail}</td>
              <td data-label="Acción:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.action}</td>
              <td data-label="Detalles:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{log.details}</td>
              <td data-label="Fecha:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(log.timestamp).toLocaleString('es-MX')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditLogTable;