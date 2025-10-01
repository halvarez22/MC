// FIX: Created the AffiliateTable component and added export to make it a module.
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
        return { text: 'Incompleto', color: 'bg-gray-100 text-gray-800' };
    }
    if (docs.some(doc => doc.status === 'rejected')) {
        return { text: 'Rechazado', color: 'bg-red-100 text-red-800' };
    }
    if (docs.some(doc => doc.status === 'pending')) {
        return { text: 'Pendiente', color: 'bg-yellow-100 text-yellow-800' };
    }
    // If we are here, all existing docs are approved.
    return { text: 'Validado', color: 'bg-green-100 text-green-800' };
};


const AffiliateTable: React.FC<AffiliateTableProps> = ({ affiliates, onEdit, onViewDetails, user }) => {
    if (affiliates.length === 0) {
        return <div className="text-center py-10 bg-white rounded-lg shadow-md">No se encontraron afiliados que coincidan con la búsqueda.</div>;
    }

  return (
    <div className="bg-white rounded-lg shadow-md md:bg-transparent md:shadow-none">
        <table className="min-w-full divide-y divide-gray-200 responsive-table">
        <thead className="bg-primary-lightest">
            <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contacto</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estatus</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Validación Docs</th>
                <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
            </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 md:bg-transparent">
            {affiliates.map((affiliate) => {
                const validation = getValidationStatus(affiliate.documentation);
                return (
                    <tr key={affiliate.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onViewDetails(affiliate)}>
                        <td data-label="Nombre:" className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{affiliate.fullName}</div>
                            <div className="text-sm text-gray-500">ID: {affiliate.id}</div>
                        </td>
                        <td data-label="Contacto:" className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">{affiliate.email}</div>
                            <div className="text-sm text-gray-500">{affiliate.phone}</div>
                        </td>
                        <td data-label="Ubicación:" className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {affiliate.city}, {affiliate.state}
                        </td>
                        <td data-label="Estatus:" className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            affiliate.status === 'activo' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {affiliate.status}
                        </span>
                        </td>
                        <td data-label="Validación Docs:" className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${validation.color}`}>
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
                )
            })}
        </tbody>
        </table>
    </div>
  );
};

export default AffiliateTable;