
import React from 'react';
import { Affiliate } from '../../types';

interface RecentAffiliatesProps {
  affiliates: Affiliate[];
}

const RecentAffiliates: React.FC<RecentAffiliatesProps> = ({ affiliates }) => {
  return (
    <div className="overflow-x-auto md:overflow-visible">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 responsive-table">
        <thead className="bg-primary-lightest dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Nombre
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Estado
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Fecha de Registro
            </th>
             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Estatus
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700 md:bg-transparent">
          {affiliates.map((affiliate) => (
            <tr key={affiliate.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td data-label="Nombre:" className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{affiliate.fullName}</div>
                <div className="text-sm text-gray-500 dark:text-gray-300">{affiliate.email}</div>
              </td>
              <td data-label="Estado:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {affiliate.state}
              </td>
              <td data-label="Fecha de Registro:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                {new Date(affiliate.createdAt).toLocaleDateString('es-MX')}
              </td>
              <td data-label="Estatus:" className="px-6 py-4 whitespace-nowrap">
                 <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    affiliate.status === 'activo'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                  }`}>
                  {affiliate.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RecentAffiliates;