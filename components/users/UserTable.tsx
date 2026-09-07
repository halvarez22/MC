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
    return (
      <div className="text-center py-10 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 rounded-lg shadow-md dark:shadow-none border border-transparent dark:border-gray-800">
        No hay usuarios registrados.
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md dark:shadow-none md:bg-transparent dark:md:bg-transparent md:shadow-none border border-transparent dark:border-gray-800 md:border-0">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 responsive-table">
        <thead className="bg-primary-lightest dark:bg-gray-800">
          <tr>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Nombre Completo
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Ubicación
            </th>
            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-white uppercase tracking-wider">
              Rol
            </th>
            <th scope="col" className="relative px-6 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-transparent divide-y divide-gray-200 dark:divide-gray-700 md:bg-transparent">
          {users.map((user) => (
            <tr key={user.uid} className="hover:bg-gray-50 dark:hover:bg-gray-800/60">
              <td data-label="Nombre:" className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900 dark:text-white">{user.fullName}</div>
                <div className="text-sm text-gray-500 dark:text-gray-300">{user.email}</div>
              </td>
              <td data-label="Ubicación:" className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900 dark:text-white">{user.city || 'N/A'}</div>
                <div className="text-sm text-gray-500 dark:text-gray-300">{user.state || 'N/A'}</div>
              </td>
              <td data-label="Rol:" className="px-6 py-4 whitespace-nowrap">
                <span
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full capitalize ${
                    user.role === 'admin'
                      ? 'bg-primary-lightest text-primary-dark dark:bg-primary/20 dark:text-primary-light'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                  }`}
                >
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
                    className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
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
