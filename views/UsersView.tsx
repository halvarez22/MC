import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { firebaseService } from '../services/firebaseService';
import Spinner from '../components/ui/Spinner';
import Button from '../components/ui/Button';
import Modal from '../components/ui/Modal';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import UserTable from '../components/users/UserTable';
import UserForm from '../components/users/UserForm';

interface UsersViewProps {
  user: User;
}

const UsersView: React.FC<UsersViewProps> = ({ user }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  
  useEffect(() => {
    const unsubscribe = firebaseService.onUsersSnapshot(data => {
      setUsers(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleOpenModalForCreate = () => {
    setSelectedUser(null);
    setIsModalOpen(true);
  };
  
  const handleOpenModalForEdit = (userToEdit: User) => {
    setSelectedUser(userToEdit);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedUser(null);
  };

  const handleDeleteRequest = (userToDelete: User) => {
    setUserToDelete(userToDelete);
  };
  
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;
    try {
      await firebaseService.deleteUser(userToDelete.uid, user);
      setUserToDelete(null); // Close confirmation modal
    } catch (err: any) {
      alert(err.message); // Show error to user
    }
  };

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <h1 className="text-3xl font-bold text-gray-900">Gestión de Usuarios</h1>
        <Button onClick={handleOpenModalForCreate}>
          + Nuevo Usuario
        </Button>
      </div>

      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        <UserTable 
          users={users} 
          currentUser={user}
          onEdit={handleOpenModalForEdit} 
          onDelete={handleDeleteRequest} 
        />
      )}

      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title={selectedUser ? 'Editar Usuario' : 'Nuevo Usuario'}
      >
        <UserForm
          user={selectedUser}
          onFinished={handleCloseModal}
          onCancel={handleCloseModal}
          adminUser={user}
        />
      </Modal>

      <ConfirmationModal
        isOpen={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Confirmar Eliminación"
        confirmText="Sí, Eliminar"
        isConfirming={false} // You can add loading state here if needed
      >
        <p>
          ¿Estás seguro de que quieres eliminar al usuario <strong>{userToDelete?.email}</strong>? 
          Esta acción no se puede deshacer.
        </p>
      </ConfirmationModal>

    </div>
  );
};

export default UsersView;