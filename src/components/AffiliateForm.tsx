import { useState, useEffect } from 'react';
import { Dialog } from '@headlessui/react';
import { supabase } from '../lib/supabase';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface AffiliateFormProps {
  affiliate?: any;
  onClose: () => void;
}

export function AffiliateForm({ affiliate, onClose }: AffiliateFormProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    status: 'active'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (affiliate) {
      setFormData({
        first_name: affiliate.first_name || '',
        last_name: affiliate.last_name || '',
        email: affiliate.email || '',
        phone: affiliate.phone || '',
        address: affiliate.address || '',
        city: affiliate.city || '',
        state: affiliate.state || '',
        postal_code: affiliate.postal_code || '',
        status: affiliate.status || 'active'
      });
    }
  }, [affiliate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (affiliate) {
        // Update existing affiliate
        const { error } = await supabase
          .from('affiliates')
          .update(formData)
          .eq('id', affiliate.id);
          
        if (error) throw error;
      } else {
        // Create new affiliate
        const { error } = await supabase
          .from('affiliates')
          .insert([formData]);
          
        if (error) throw error;
      }
      onClose();
    } catch (error) {
      console.error('Error saving affiliate:', error);
      setError('Error al guardar el afiliado. Por favor, intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Dialog as="div" className="relative z-10" open={true} onClose={onClose}>
      <div className="fixed inset-0 bg-black bg-opacity-25" />
      
      <div className="fixed inset-0 overflow-y-auto">
        <div className="flex min-h-full items-center justify-center p-4 text-center">
          <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all">
            <div className="flex justify-between items-center mb-4">
              <Dialog.Title as="h3" className="text-lg font-medium leading-6 text-gray-900">
                {affiliate ? 'Editar Afiliado' : 'Nuevo Afiliado'}
              </Dialog.Title>
              <button
                type="button"
                className="text-gray-400 hover:text-gray-500"
                onClick={onClose}
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="first_name" className="block text-sm font-medium text-gray-700">
                    Nombre
                  </label>
                  <input
                    type="text"
                    name="first_name"
                    id="first_name"
                    value={formData.first_name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="last_name" className="block text-sm font-medium text-gray-700">
                    Apellidos
                  </label>
                  <input
                    type="text"
                    name="last_name"
                    id="last_name"
                    value={formData.last_name}
                    onChange={handleChange}
                    required
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    id="email"
                    value={formData.email}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                    Teléfono
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    id="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div className="col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                    Dirección
                  </label>
                  <input
                    type="text"
                    name="address"
                    id="address"
                    value={formData.address}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-gray-700">
                    Ciudad
                  </label>
                  <input
                    type="text"
                    name="city"
                    id="city"
                    value={formData.city}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="block text-sm font-medium text-gray-700">
                    Estado
                  </label>
                  <input
                    type="text"
                    name="state"
                    id="state"
                    value={formData.state}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium text-gray-700">
                    Código Postal
                  </label>
                  <input
                    type="text"
                    name="postal_code"
                    id="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="status" className="block text-sm font-medium text-gray-700">
                    Estado
                  </label>
                  <select
                    name="status"
                    id="status"
                    value={formData.status}
                    onChange={handleChange}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-mc-orange focus:ring-mc-orange sm:text-sm"
                  >
                    <option value="active">Activo</option>
                    <option value="inactive">Inactivo</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2"
                  disabled={loading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded-md border border-transparent bg-mc-orange px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-mc-orange/90 focus:outline-none focus:ring-2 focus:ring-mc-orange focus:ring-offset-2"
                  disabled={loading}
                >
                  {loading ? 'Guardando...' : affiliate ? 'Guardar Cambios' : 'Crear Afiliado'}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </div>
    </Dialog>
  );
}