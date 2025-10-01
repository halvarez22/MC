import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { MEXICAN_STATES } from '../../constants';

interface UserFormProps {
  user: User | null;
  onFinished: () => void;
  onCancel: () => void;
  adminUser: User;
}

const initialFormData = {
    email: '',
    fullName: '',
    state: MEXICAN_STATES[0],
    city: '',
    delegation: '',
    password: '',
    confirmPassword: '',
    role: 'brigadista' as 'admin' | 'brigadista',
};

type FormErrors = Partial<Record<keyof typeof initialFormData, string>>;

const UserForm: React.FC<UserFormProps> = ({ user, onFinished, onCancel, adminUser }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const isEditMode = !!user;

    useEffect(() => {
        if (isEditMode) {
            setFormData({
                email: user.email || '',
                fullName: user.fullName || '',
                state: user.state || MEXICAN_STATES[0],
                city: user.city || '',
                delegation: user.delegation || '',
                password: '',
                confirmPassword: '',
                role: user.role || 'brigadista',
            });
        } else {
            setFormData(initialFormData);
        }
        setError(null);
        setFormErrors({});
    }, [user]);

    const validateForm = (): boolean => {
        const errors: FormErrors = {};
        if (!formData.email || !/\S+@\S+\.\S+/.test(formData.email)) {
            errors.email = 'Se requiere un correo electrónico válido.';
        }
        if (!formData.fullName.trim()) {
            errors.fullName = 'El nombre completo es requerido.';
        }
        if (!isEditMode && (!formData.password || formData.password.length < 6)) {
             errors.password = 'La contraseña es requerida y debe tener al menos 6 caracteres.';
        }
        if (formData.password && formData.password !== formData.confirmPassword) {
            errors.confirmPassword = 'Las contraseñas no coinciden.';
        }
        setFormErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (formErrors[name as keyof FormErrors]) {
            setFormErrors(prev => ({...prev, [name]: undefined }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const dataToSave: Partial<User> & { password?: string } = {
                email: formData.email,
                role: formData.role,
                fullName: formData.fullName,
                state: formData.state,
                city: formData.city,
                delegation: formData.delegation,
            };

            if (isEditMode) {
                dataToSave.uid = user.uid;
            } else {
                dataToSave.password = formData.password;
            }

            await firebaseService.saveUser(dataToSave, adminUser);
            onFinished();

        } catch (err: any) {
            setError(err.message || 'Ocurrió un error.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input 
                    id="fullName" 
                    name="fullName" 
                    label="Nombre Completo" 
                    type="text" 
                    value={formData.fullName} 
                    onChange={handleChange} 
                    error={formErrors.fullName}
                    required 
                />
                <Input 
                    id="email" 
                    name="email" 
                    label="Correo Electrónico" 
                    type="email" 
                    value={formData.email} 
                    onChange={handleChange} 
                    error={formErrors.email}
                    disabled={isEditMode}
                    required 
                />
                 <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">Estado</label>
                    <select id="state" name="state" value={formData.state} onChange={handleChange} required className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md">
                        {MEXICAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                </div>
                 <Input 
                    id="city" 
                    name="city" 
                    label="Ciudad" 
                    type="text" 
                    value={formData.city} 
                    onChange={handleChange} 
                />
                 <Input 
                    id="delegation" 
                    name="delegation" 
                    label="Delegación / Municipio" 
                    type="text" 
                    value={formData.delegation} 
                    onChange={handleChange}
                />
                 <div>
                    <label htmlFor="role" className="block text-sm font-medium text-gray-700">Rol</label>
                    <select 
                        id="role" 
                        name="role" 
                        value={formData.role} 
                        onChange={handleChange} 
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    >
                        <option value="brigadista">Brigadista</option>
                        <option value="admin">Administrador</option>
                    </select>
                </div>
                 <Input 
                    id="password" 
                    name="password" 
                    label={isEditMode ? 'Nueva Contraseña (opcional)' : 'Contraseña'}
                    type="password" 
                    value={formData.password} 
                    onChange={handleChange}
                    error={formErrors.password}
                    required={!isEditMode}
                />
                <Input 
                    id="confirmPassword" 
                    name="confirmPassword" 
                    label="Confirmar Contraseña" 
                    type="password" 
                    value={formData.confirmPassword} 
                    onChange={handleChange} 
                    error={formErrors.confirmPassword}
                    required={!isEditMode || !!formData.password}
                />
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            
            <div className="flex justify-end space-x-4 pt-4 border-t">
                <Button type="button" variant="secondary" onClick={onCancel} disabled={isLoading}>
                    Cancelar
                </Button>
                <Button type="submit" isLoading={isLoading}>
                    {isEditMode ? 'Guardar Cambios' : 'Crear Usuario'}
                </Button>
            </div>
        </form>
    );
};

export default UserForm;