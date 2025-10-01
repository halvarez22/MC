
import React from 'react';
import { Affiliate } from '../../types';

interface RecentAffiliatesProps {
  affiliates: Affiliate[];
}

const RecentAffiliates: React.FC<RecentAffiliatesProps> = ({ affiliates }) => {
  return (
    <div className="overflow-x-auto md:overflow-visible">
      <table className="min-w-full divide-y divide-gray-200 responsive-table">
        <thead className="bg-primary-lightest">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nombre
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estado
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Fecha de Registro
            </th>
             <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Estatus
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 md:bg-transparent">
          {affiliates.map((affiliate) => (
            <tr key={affiliate.id} className="hover:bg-gray-50">
              <td data-label="Nombre:" className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{affiliate.fullName}</div>
                <div className="text-sm text-gray-500">{affiliate.email}</div>
              </td>
              <td data-label="Estado:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {affiliate.state}
              </td>
              <td data-label="Fecha de Registro:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {new Date(affiliate.createdAt).toLocaleDateString('es-MX')}
              </td>
              <td data-label="Estatus:" className="px-6 py-4 whitespace-nowrap">
                 <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    affiliate.status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
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