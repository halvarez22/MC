import React from 'react';
import { Affiliate, User, Document } from '../../types';

interface AffiliateTableProps {
  affiliates: Affiliate[];
  onEdit: (affiliate: Affiliate) => void;
  onViewDetails: (affiliate: Affiliate) => void;
  user: User;
}

const getValidationStatus = (docs: Document[]): { text: string; color: string } => {
  if (!docs || docs.length === 0) {
    return {
      text: 'Incompleto',
      color: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
    };
  }
  if (docs.some((doc) => doc.status === 'rejected')) {
    return {
      text: 'Rechazado',
      color: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
    };
  }
  if (docs.some((doc) => doc.status === 'pending')) {
    return {
      text: 'Pendiente',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200',
    };
  }
  return {
    text: 'Validado',
    color: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200',
  };
};

const AffiliateTable: React.FC<AffiliateTableProps> = ({
  affiliates,
  onEdit,
  onViewDetails,
  user,
}) => {
  if (affiliates.length === 0) {
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 rounded-lg shadow-md dark:shadow-none border border-transparent dark:border-gray-800">
        No se encontraron afiliados que coincidan con la búsqueda.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none md:bg-transparent dark:md:bg-transparent md:shadow-none border border-transparent dark:border-gray-800 md:border-0">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 responsive-table">
        <thead className="bg-primary-lightest dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Nombre
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Contacto
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Ubicación
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Estatus
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Validación Docs
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700 md:bg-transparent">
          {affiliates.map((affiliate) => {
            const validation = getValidationStatus(affiliate.documentation);
            return (
              <tr
                key={affiliate.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer"
                onClick={() => onViewDetails(affiliate)}
              >
                <td data-label="Nombre:" className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {affiliate.fullName}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">ID: {affiliate.id}</div>
                </td>
                <td data-label="Contacto:" className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 dark:text-white">{affiliate.email}</div>
                  <div className="text-sm text-gray-500 dark:text-gray-300">{affiliate.phone}</div>
                </td>
                <td data-label="Ubicación:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                  {affiliate.city}, {affiliate.state}
                </td>
                <td data-label="Estatus:" className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      affiliate.status === 'activo'
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                        : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200'
                    }`}
                  >
                    {affiliate.status}
                  </span>
                </td>
                <td data-label="Validación Docs:" className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${validation.color}`}
                  >
                    {validation.text}
                  </span>
                </td>
                <td data-label="Acciones:" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {user.role === 'admin' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit(affiliate);
                      }}
                      className="text-primary hover:text-primary-dark font-medium"
                    >
                      Editar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default AffiliateTable;
