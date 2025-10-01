import React from 'react';
import { User } from '../../types';

interface UserTableProps {
  users: User[];
  currentUser: User;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, currentUser, onEdit, onDelete }) => {
  if (users.length === 0) {
    return <div className="text-center py-10 bg-white rounded-lg shadow-md">No hay usuarios registrados.</div>;
  }

  return (
    <div className="bg-white rounded-lg shadow-md md:bg-transparent md:shadow-none">
      <table className="min-w-full divide-y divide-gray-200 responsive-table">
        <thead className="bg-primary-lightest">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nombre Completo</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ubicación</th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
            <th scope="col" className="relative px-6 py-3"><span className="sr-only">Acciones</span></th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200 md:bg-transparent">
          {users.map((user) => (
            <tr key={user.uid}>
              <td data-label="Nombre:" className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{user.fullName}</div>
                <div className="text-sm text-gray-500">{user.email}</div>
              </td>
              <td data-label="Ubicación:" className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">{user.city || 'N/A'}</div>
                <div className="text-sm text-gray-500">{user.state || 'N/A'}</div>
              </td>
              <td data-label="Rol:" className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                  user.role === 'admin' ? 'bg-primary-lightest text-primary-dark' : 'bg-gray-100 text-gray-800'
                }`}>
                  {user.role}
                </span>
              </td>
              <td data-label="Acciones:" className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <button 
                  onClick={() => onEdit(user)} 
                  className="text-primary hover:text-primary-dark font-medium mr-4"
                >
                  Editar
                </button>
                {currentUser.uid !== user.uid && (
                   <button 
                    onClick={() => onDelete(user)} 
                    className="text-red-600 hover:text-red-800 font-medium"
                  >
                    Eliminar
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;