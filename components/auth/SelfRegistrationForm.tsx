import React, { useState } from 'react';
import { Affiliate, Document, User, INEStructuredData } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import { offlineService, OfflineRegistration } from '../../services/offlineService';
import { emailService } from '../../services/emailService';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { MEXICAN_STATES, ICONS } from '../../constants';
import INEProcessor from '../ine/INEProcessor';

interface SelfRegistrationFormProps {
  onSuccess: (isOffline: boolean, userRegistered?: boolean) => void;
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
    const [showINEProcessor, setShowINEProcessor] = useState(false);
    const [ineData, setIneData] = useState<INEStructuredData | null>(null);
    const [ineImages, setIneImages] = useState<{ frontal: File; posterior: File } | null>(null);
    const [userRegistered, setUserRegistered] = useState(false);

    const resetForm = () => {
        setFormData(initialFormData);
        setUploadedFiles({});
        setGeolocation(null);
        setError(null);
        setLocationMessage('');
        setIneData(null);
        setIneImages(null);
        setUserRegistered(false);
        setShowINEProcessor(false);
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

    const handleStartINEProcessing = () => {
        setShowINEProcessor(true);
    };

    const handleINEDataExtracted = (data: INEStructuredData, images: { frontal: File; posterior: File }) => {
        setIneData(data);
        setIneImages(images);

        // Auto-llenar el formulario con los datos extraídos del INE
        setFormData(prev => ({
            ...prev,
            fullName: data.nombre_completo || prev.fullName,
            address: data.domicilio || prev.address,
            state: data.estado || prev.state,
            city: data.municipio || prev.city,
            zip: prev.zip, // No tenemos código postal en INE
        }));

        // Auto-llenar los archivos de documentos
        setUploadedFiles({
            'INE Frontal': images.frontal,
            'INE Posterior': images.posterior
        });

        setShowINEProcessor(false);
    };

    const handleCancelINEProcessing = () => {
        setShowINEProcessor(false);
    };

    const sendWelcomeEmail = async (email: string, fullName: string, affiliateId?: string) => {
        return await emailService.sendWelcomeEmail({
            to: email,
            fullName: fullName,
            affiliateId: affiliateId
        });
    };

    const registerUserInApp = async (affiliateData: Affiliate) => {
        try {
            // Crear un usuario en la app con rol de simpatizante
            const userData = {
                email: affiliateData.email,
                role: 'simpatizante' as const,
                fullName: affiliateData.fullName,
                state: affiliateData.state,
                city: affiliateData.city,
                requiresPasswordChange: true, // Requiere cambiar contraseña en primer login
            };

            await firebaseService.createUser(userData);
            setUserRegistered(true);
            return true;
        } catch (error) {
            console.error('Error registrando usuario en la app:', error);
            return false;
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
            let affiliateData: Affiliate;

            if (isFieldMode && !navigator.onLine) {
                // --- MODO OFFLINE ---
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

                // Crear objeto affiliate para el registro de usuario
                affiliateData = {
                    id: offlineReg.id,
                    createdAt: new Date().toISOString(),
                    ...formData,
                    status: 'activo' as const,
                    documentation: documentsWithData.map(doc => ({
                        id: `${doc.type}_${Date.now()}`,
                        type: doc.type,
                        status: 'pending' as const,
                        fileName: doc.fileName
                    })),
                    ineData: ineData ? {
                        name: ineData.nombre_completo || '',
                        address: ineData.domicilio || '',
                        voterId: ineData.clave_elector || '',
                        curp: ineData.curp || '',
                        registrationYear: '',
                        state: ineData.estado || '',
                        municipality: ineData.municipio || '',
                        section: ineData.seccion || '',
                        locality: ineData.localidad || '',
                        emission: ineData.fecha_emision || '',
                        validity: ineData.fecha_vigencia || '',
                        extractedAt: new Date().toISOString(),
                        confidence: 0.8
                    } : undefined,
                    latitude: geolocation?.latitude,
                    longitude: geolocation?.longitude
                };

            } else {
                // --- MODO ONLINE ---
                const documentsToUpload = DOCUMENT_TYPES.map(type => ({
                    type,
                    fileName: uploadedFiles[type]!.name
                    // En una app real, aquí se subiría el archivo a un storage y se obtendría una URL
                }));

                affiliateData = await firebaseService.registerAffiliate(formData, documentsToUpload, geolocation || undefined);
            }

            // Si se proporcionó email, registrar usuario en la app y enviar email
            if (formData.email) {
                const userRegistered = await registerUserInApp(affiliateData);
                if (userRegistered) {
                    // Intentar enviar email de bienvenida (no crítico si falla)
                    try {
                        await sendWelcomeEmail(formData.email, formData.fullName, affiliateData.id);
                        console.log('✅ Email de bienvenida enviado');
                    } catch (emailError) {
                        console.warn('⚠️ No se pudo enviar email de bienvenida, pero el registro fue exitoso:', emailError);
                    }
                } else {
                    console.warn('⚠️ No se pudo registrar usuario en la app, pero el afiliado fue registrado');
                }
            }

            resetForm();
            onSuccess(!navigator.onLine, userRegistered);

        } catch (err: any) {
            setError(err.message || 'Ocurrió un error durante el registro.');
        } finally {
            setIsLoading(false);
        }
    };


    // Mostrar INEProcessor cuando esté activo
    if (showINEProcessor) {
        return (
            <INEProcessor
                onDataExtracted={handleINEDataExtracted}
                onCancel={handleCancelINEProcessing}
            />
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sección de captura de INE */}
            {isFieldMode && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-4">📷 Captura de Credencial de Elector</h3>
                    <p className="text-blue-800 mb-4">
                        Solicita al simpatizante que te permita tomar fotos de ambos lados de su INE.
                        Los datos se extraerán automáticamente mediante OCR.
                    </p>

                    {!ineData ? (
                        <Button
                            type="button"
                            onClick={handleStartINEProcessing}
                            variant="secondary"
                            className="w-full sm:w-auto"
                        >
                            <span className="mr-2">📷</span>
                            Iniciar Captura de INE
                        </Button>
                    ) : (
                        <div className="bg-green-100 border border-green-300 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-green-800">
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                                <span className="font-medium">Datos extraídos exitosamente del INE</span>
                            </div>
                            <p className="text-sm text-green-700 mt-1">
                                Los datos del formulario se han completado automáticamente.
                            </p>
                        </div>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Input id="fullName" name="fullName" label="Nombre Completo" value={formData.fullName} onChange={handleChange} required />
                <Input
                    id="email"
                    name="email"
                    label="Correo Electrónico (Opcional)"
                    type="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="Se usará para crear cuenta en la app y enviar confirmación"
                />
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
                        className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md min-h-[44px]"
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

            {/* Mostrar estado de documentos */}
            <div className="pt-4 border-t">
                <h4 className="text-lg font-medium text-gray-800 mb-4">Estado de Documentos</h4>
                {ineData ? (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <h5 className="font-medium text-green-900 mb-2">✅ Documentos capturados automáticamente</h5>
                        <div className="text-sm text-green-800 space-y-1">
                            <p>• INE Frontal: Capturado</p>
                            <p>• INE Posterior: Capturado</p>
                        </div>
                    </div>
                ) : (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h5 className="font-medium text-yellow-900 mb-2">⚠️ Documentos requeridos</h5>
                        <p className="text-sm text-yellow-800 mb-3">
                            Los documentos se capturarán automáticamente mediante el proceso de OCR arriba.
                        </p>
                        {DOCUMENT_TYPES.map(type => (
                            <p key={type} className="text-sm text-yellow-700">• {type}: Pendiente</p>
                        ))}
                    </div>
                )}
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <div className="flex justify-end pt-4">
                <Button
                    type="submit"
                    isLoading={isLoading}
                    className="w-full md:w-auto"
                    disabled={!ineData && isFieldMode}
                >
                    {isFieldMode ? 'Registrar Afiliado' : 'Enviar Registro'}
                </Button>
            </div>
        </form>
    );
};

export default SelfRegistrationForm;