import React, { useState } from 'react';
import { Affiliate, Document, User } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { offlineService, OfflineRegistration } from '../../services/offlineService';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { MEXICAN_STATES, ICONS } from '../../constants';

interface SelfRegistrationFormProps {
  onSuccess: (isOffline: boolean) => void;
  isFieldMode?: boolean;
  fieldUser?: User;
}

const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


const initialFormData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation' | 'status'> = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: MEXICAN_STATES[0],
    zip: '',
};

const DOCUMENT_TYPES: Document['type'][] = ['INE Frontal', 'INE Posterior'];

const SelfRegistrationForm: React.FC<SelfRegistrationFormProps> = ({ onSuccess, isFieldMode = false, fieldUser }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [uploadedFiles, setUploadedFiles] = useState<Record<string, File | null>>({});
    const [geolocation, setGeolocation] = useState<{latitude: number, longitude: number} | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locationMessage, setLocationMessage] = useState('');

    const resetForm = () => {
        setFormData(initialFormData);
        setUploadedFiles({});
        setGeolocation(null);
        setError(null);
        setLocationMessage('');
    }

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, files } = e.target;
        if (files && files.length > 0) {
            setUploadedFiles(prev => ({ ...prev, [name]: files[0] }));
        }
    };
    
    const handleGetLocation = () => {
        setError(null);
        setLocationMessage('Capturando ubicación...');
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGeolocation({
                        latitude: position.coords.latitude,
                        longitude: position.coords.longitude
                    });
                    setLocationMessage('Ubicación capturada con éxito.');
                },
                (err) => {
                    setError(`Error al obtener la ubicación: ${err.message}`);
                    setGeolocation(null);
                    setLocationMessage('');
                }
            );
        } else {
            setError("La geolocalización no es soportada por este navegador.");
            setLocationMessage('');
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (DOCUMENT_TYPES.some(type => !uploadedFiles[type])) {
            setError('Todos los documentos son requeridos.');
            return;
        }
        
        if (isFieldMode && !geolocation) {
             if (!confirm("No se ha capturado la geolocalización. ¿Deseas continuar de todas formas?")) {
                 return;
             }
        }

        setIsLoading(true);
        
        try {
            if (isFieldMode && !navigator.onLine) {
                // --- MODO OFFLLINE ---
                const documentsWithData = await Promise.all(
                    DOCUMENT_TYPES.map(async type => ({
                        type,
                        fileName: uploadedFiles[type]!.name,
                        dataUrl: await fileToDataUrl(uploadedFiles[type]!)
                    }))
                );
                
                const offlineReg: OfflineRegistration = {
                    id: `offline_${Date.now()}`,
                    formData: formData,
                    documents: documentsWithData,
                    geolocation: geolocation || undefined
                };

                await offlineService.saveRegistration(offlineReg);
                window.dispatchEvent(new CustomEvent('forceOfflineIndicatorUpdate'));
                resetForm();
                onSuccess(true);
            } else {
                // --- MODO ONLINE ---
                const documentsToUpload = DOCUMENT_TYPES.map(type => ({
                    type,
                    fileName: uploadedFiles[type]!.name
                    // En una app real, aquí se subiría el archivo a un storage y se obtendría una URL
                }));
            
                await firebaseService.registerAffiliate(formData, documentsToUpload, geolocation || undefined);
                resetForm();
                onSuccess(false);
            }
        } catch (err: any) {
            setError(err.message || 'Ocurrió un error durante el registro.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input id="fullName" name="fullName" label="Nombre Completo" value={formData.fullName} onChange={handleChange} required />
                <Input id="email" name="email" label="Correo Electrónico" type="email" value={formData.email} onChange={handleChange} required />
                <Input id="phone" name="phone" label="Teléfono" type="tel" value={formData.phone} onChange={handleChange} required />
                <Input id="address" name="address" label="Dirección" value={formData.address} onChange={handleChange} required />
                <Input id="city" name="city" label="Ciudad" value={formData.city} onChange={handleChange} required />
                <div>
                    <label htmlFor="state" className="block text-sm font-medium text-gray-700">Estado</label>
                    <select
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        required
                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md"
                    >
                        {MEXICAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                    </select>
                </div>
                <Input id="zip" name="zip" label="Código Postal" value={formData.zip} onChange={handleChange} required />
            </div>

            {isFieldMode && (
                <div className="pt-4 border-t">
                    <h4 className="text-lg font-medium text-gray-800 mb-2">Geolocalización</h4>
                    <div className="flex items-center gap-4 flex-wrap">
                        <Button type="button" variant="secondary" onClick={handleGetLocation}>
                             <span className="mr-2">{ICONS.gps}</span>
                             Capturar Ubicación Actual
                        </Button>
                        {geolocation && (
                             <div className="text-green-600 font-semibold flex items-center gap-2 text-sm">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="truncate">
                                    {`Lat: ${geolocation.latitude.toFixed(4)}, Lon: ${geolocation.longitude.toFixed(4)}`}
                                </span>
                            </div>
                        )}
                    </div>
                    {locationMessage && <p className={`text-sm mt-2 ${locationMessage.includes('éxito') ? 'text-green-600' : 'text-gray-600'}`}>{locationMessage}</p>}
                </div>
            )}

            <div className="pt-4 border-t">
                <h4 className="text-lg font-medium text-gray-800 mb-4">Carga de Documentos</h4>
                <p className="text-sm text-gray-500 mb-4">Por favor, sube una copia de los siguientes documentos. Serán revisados por un administrador.</p>
                <div className="space-y-4">
                    {DOCUMENT_TYPES.map(type => (
                        <div key={type}>
                            <label className="block text-sm font-medium text-gray-700">
                                {type} <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 flex items-center justify-between p-2 border border-gray-300 rounded-md bg-white">
                                <span className="text-gray-600 text-sm truncate flex-grow">
                                    {uploadedFiles[type]?.name || 'Ningún archivo seleccionado'}
                                </span>
                                <label
                                  htmlFor={type}
                                  className="cursor-pointer ml-4 bg-gray-50 py-1.5 px-3 border border-gray-300 rounded-md shadow-sm text-sm leading-4 font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
                                >
                                  {isFieldMode ? 'Tomar Foto' : 'Seleccionar'}
                                </label>
                            </div>
                            <input
                                id={type}
                                name={type}
                                type="file"
                                accept="image/*"
                                capture="environment"
                                className="sr-only"
                                onChange={handleFileChange}
                                required
                            />
                        </div>
                    ))}
                </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}
            
            <div className="flex justify-end pt-4">
                <Button type="submit" isLoading={isLoading} className="w-full md:w-auto">
                    {isFieldMode ? 'Guardar Afiliado' : 'Enviar Registro'}
                </Button>
            </div>
        </form>
    );
};

export default SelfRegistrationForm;