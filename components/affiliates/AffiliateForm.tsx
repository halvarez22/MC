// FIX: Implemented the AffiliateForm component and added an export to make it a module.
// FIX: Corrected import statement for React hooks.
import React, { useState, useEffect } from 'react';
import { Affiliate, User, Document } from '../../types';
import { firebaseService } from '../../services/firebaseService';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { MEXICAN_STATES } from '../../constants';
import ConfirmationModal from '../ui/ConfirmationModal';
import INEProcessor from '../ine/INEProcessor';
import { INEData } from '../../services/ocrService';

interface AffiliateFormProps {
  affiliate: Affiliate | null;
  onFinished: () => void;
  onCancel: () => void;
  user: User;
}

const DOCUMENT_TYPES: Document['type'][] = ['INE Frontal', 'INE Posterior'];

const initialFormData: Omit<Affiliate, 'id' | 'createdAt' | 'documentation'> = {
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: MEXICAN_STATES[0],
    zip: '',
    status: 'activo',
};

type FormErrors = Partial<Record<keyof typeof initialFormData | string, string>>;

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';
interface FileUploadState {
  file: File | null;
  status: UploadStatus;
  progress: number;
  error?: string;
}

const CheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
  </svg>
);

const ErrorIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
  </svg>
);


const AffiliateForm: React.FC<AffiliateFormProps> = ({ affiliate, onFinished, onCancel, user }) => {
    const [formData, setFormData] = useState(initialFormData);
    const [documentation, setDocumentation] = useState<Document[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'info' | 'success' | 'error'; text: string } | null>(null);
    const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
    const [rejectionReasonText, setRejectionReasonText] = useState('');
    const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
    const [fileUploads, setFileUploads] = useState<Record<string, FileUploadState>>({});
    const [errors, setErrors] = useState<FormErrors>({});
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [currentStep, setCurrentStep] = useState<'form' | 'ine-capture' | 'documents'>('form');
    const [ineImages, setIneImages] = useState<{ frontal: File; posterior: File } | null>(null);
    const [extractedINEData, setExtractedINEData] = useState<INEData | null>(null);

    useEffect(() => {
        if (affiliate) {
            setFormData({
                fullName: affiliate.fullName,
                email: affiliate.email,
                phone: affiliate.phone,
                address: affiliate.address,
                city: affiliate.city,
                state: affiliate.state,
                zip: affiliate.zip,
                status: affiliate.status,
            });
            setDocumentation(affiliate.documentation || []);
            setFileUploads({});
        } else {
            setFormData(initialFormData);
            setDocumentation([]);
            const initialUploadState: Record<string, FileUploadState> = {};
            DOCUMENT_TYPES.forEach(type => {
                initialUploadState[type] = { file: null, status: 'idle', progress: 0 };
            });
            setFileUploads(initialUploadState);
        }
        setExpandedDocId(null);
        setRejectingDocId(null);
        setRejectionReasonText('');
        setStatusMessage(null);
        setErrors({});
    }, [affiliate]);

    const validateForm = (): FormErrors => {
        const newErrors: FormErrors = {};
        
        Object.keys(formData).forEach(key => {
            const formKey = key as keyof typeof initialFormData;
            if (!formData[formKey] && formKey !== 'status') {
                newErrors[formKey] = 'Este campo es requerido.';
            }
        });

        if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'El formato del correo electrónico es inválido.';
        }
        
        if (!affiliate) { 
            DOCUMENT_TYPES.forEach(type => {
                if (!fileUploads[type]?.file) {
                    newErrors[`file-${type}`] = `El archivo para ${type} es requerido.`;
                }
            });
        }
        
        return newErrors;
    };

    const handleINEDataExtracted = (data: INEData, images: { frontal: File; posterior: File }) => {
        setExtractedINEData(data);
        setIneImages(images);

        // Pre-llenar el formulario con los datos extraídos del INE
        setFormData(prev => ({
            ...prev,
            fullName: data.name || prev.fullName,
            address: data.address || prev.address,
            // Aquí podríamos agregar más campos si coinciden con el formulario
        }));

        setCurrentStep('documents');
    };

    const handleINECancel = () => {
        setCurrentStep('form');
    };

    const handleFormContinue = () => {
        const formErrors = validateForm();
        if (Object.keys(formErrors).length === 0) {
            setCurrentStep('ine-capture');
        } else {
            setErrors(formErrors);
        }
    };

    const handleBackToForm = () => {
        setCurrentStep('form');
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        if (errors[name as keyof FormErrors]) {
            setErrors(prev => ({ ...prev, [name]: undefined }));
        }
    };
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name: type, files } = e.target;
        if (files && files.length > 0) {
            const file = files[0];
            setFileUploads(prev => ({
                ...prev,
                [type]: { file, status: 'idle', progress: 0, error: undefined }
            }));
            const errorKey = `file-${type}`;
            if (errors[errorKey]) {
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[errorKey];
                    return newErrors;
                });
            }
        }
    };

    const handleApproveDocument = (docId: string) => {
        setDocumentation(docs =>
            docs.map(doc =>
                doc.id === docId ? { ...doc, status: 'approved', rejectionReason: undefined } : doc
            )
        );
        setExpandedDocId(null);
    };

    const handleStartRejection = (docId: string) => {
        setRejectingDocId(docId);
        const doc = documentation.find(d => d.id === docId);
        setRejectionReasonText(doc?.rejectionReason || '');
    };

    const handleCancelRejection = () => {
        setRejectingDocId(null);
        setRejectionReasonText('');
    };

    const handleConfirmRejection = () => {
        if (!rejectingDocId || !rejectionReasonText.trim()) return;
        setDocumentation(docs =>
            docs.map(doc =>
                doc.id === rejectingDocId ? { ...doc, status: 'rejected', rejectionReason: rejectionReasonText.trim() } : doc
            )
        );
        handleCancelRejection();
        setExpandedDocId(null);
    };

    const handleToggleExpand = (docId: string) => {
        const isCurrentlyExpanded = expandedDocId === docId;
        setExpandedDocId(isCurrentlyExpanded ? null : docId);
        if (!isCurrentlyExpanded) handleCancelRejection();
    };

    const executeSaveOperation = async () => {
        setIsLoading(true);
        setStatusMessage({ type: 'info', text: 'Guardando afiliado...' });
        
        try {
            if (!user) throw new Error("User not authenticated");

            let dataToSave;
            if (affiliate) {
                 dataToSave = { ...formData, id: affiliate.id, documentation };
            } else {
                const newDocumentation = DOCUMENT_TYPES.map(type => ({
                    id: '', // Service will generate this
                    type: type,
                    status: 'pending' as const,
                    fileName: fileUploads[type]!.file!.name
                }));

                // Agregar documentos del INE si existen
                if (ineImages) {
                    newDocumentation.push({
                        id: '',
                        type: 'INE Frontal',
                        status: 'pending' as const,
                        fileName: ineImages.frontal.name
                    });
                    newDocumentation.push({
                        id: '',
                        type: 'INE Posterior',
                        status: 'pending' as const,
                        fileName: ineImages.posterior.name
                    });
                }

                dataToSave = { ...formData, documentation: newDocumentation };
            }

            await firebaseService.saveAffiliate(dataToSave, user);
            
            setStatusMessage({ type: 'success', text: '¡Afiliado guardado con éxito!' });
            setTimeout(() => onFinished(), 1500);

        } catch (err: any) {
            const errorMessage = err.message || 'Ocurrió un error al guardar el afiliado.';
            setStatusMessage({ type: 'error', text: errorMessage });
            setIsLoading(false);
        }
    };

    const handleUploadAndSave = async () => {
        setIsLoading(true);
        setStatusMessage({ type: 'info', text: 'Subiendo documentos...' });

        const filesToUpload = DOCUMENT_TYPES.filter(type => fileUploads[type]?.file && fileUploads[type]?.status !== 'success');

        const uploadPromises = filesToUpload.map(type => {
            return new Promise<void>((resolve, reject) => {
                setFileUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'uploading', progress: 0, error: undefined } }));

                const interval = setInterval(() => {
                    setFileUploads(prev => {
                        if (prev[type]?.status !== 'uploading') return prev;
                        const currentProgress = prev[type]?.progress || 0;
                        const newProgress = Math.min(currentProgress + 20, 100);
                        return { ...prev, [type]: { ...prev[type], progress: newProgress } };
                    });
                }, 250);

                setTimeout(() => {
                    clearInterval(interval);
                    if (Math.random() > 0.85) { // 15% chance of failure
                        const errorMsg = 'Error de red simulado. Inténtalo de nuevo.';
                        setFileUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'error', error: errorMsg, progress: 0 } }));
                        reject(new Error(`Fallo la subida de ${type}.`));
                    } else {
                        setFileUploads(prev => ({ ...prev, [type]: { ...prev[type], status: 'success', progress: 100 } }));
                        resolve();
                    }
                }, 1500);
            });
        });

        try {
            await Promise.all(uploadPromises);
            await executeSaveOperation();
        } catch (err: any) {
            setStatusMessage({ type: 'error', text: err.message || 'Algunos documentos no se pudieron subir. Revisa los errores y vuelve a intentarlo.' });
            setIsLoading(false);
        }
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setStatusMessage(null);
        
        const validationErrors = validateForm();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            setStatusMessage({ type: 'error', text: 'Por favor, corrige los errores en el formulario.'});
            return;
        }

        if (affiliate) {
            setIsConfirmModalOpen(true);
        } else {
            handleUploadAndSave();
        }
    };
    
    const renderFileUploads = () => (
        <div className="pt-4 border-t">
            <h4 className="text-lg font-medium text-gray-800 mb-4">Carga de Documentos</h4>
            <p className="text-sm text-gray-500 mb-4">Sube una copia de los siguientes documentos. Serán marcados como pendientes para revisión.</p>
            <div className="space-y-4">
                {DOCUMENT_TYPES.map(type => {
                    const { file, status, progress, error } = fileUploads[type] || { file: null, status: 'idle', progress: 0 };
                    const validationError = errors[`file-${type}`];
                    return (
                        <div key={type}>
                            <label className="block text-sm font-medium text-gray-700">
                                {type} <span className="text-red-500">*</span>
                            </label>
                            <div className="mt-1 space-y-2">
                                <div className="flex items-center space-x-4">
                                    <div className={`flex-grow p-2 border rounded-md bg-white min-h-[40px] flex items-center ${validationError || error ? 'border-red-500' : 'border-gray-300'}`}>
                                        <span className="text-gray-600 text-sm truncate">
                                            {file?.name || 'Ningún archivo seleccionado'}
                                        </span>
                                    </div>
                                    <label
                                        htmlFor={`file-${type}`}
                                        className="cursor-pointer bg-gray-50 py-2 px-3 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary whitespace-nowrap"
                                    >
                                        {status === 'error' ? 'Reintentar' : 'Seleccionar'}
                                    </label>
                                </div>
                                
                                {status !== 'idle' && (
                                    <div className="flex items-center space-x-2">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                                            <div
                                                className={`h-2.5 rounded-full transition-all duration-300 ${status === 'success' ? 'bg-green-500' : status === 'error' ? 'bg-red-500' : 'bg-primary'}`}
                                                style={{ width: `${progress}%` }}
                                            ></div>
                                        </div>
                                        <div className="w-12 text-right flex items-center justify-end">
                                            {status === 'success' && <CheckIcon />}
                                            {status === 'error' && <ErrorIcon />}
                                            {status === 'uploading' && <span className="text-sm text-gray-500 font-semibold">{progress}%</span>}
                                        </div>
                                    </div>
                                )}
                                {(validationError || error) && <p className="text-sm text-red-600">{validationError || error}</p>}
                            </div>
                             <input id={`file-${type}`} name={type} type="file" className="sr-only" onChange={handleFileChange} />
                        </div>
                    );
                })}
            </div>
        </div>
    );

    const renderDocumentation = () => (
        <div className="pt-4 border-t">
            <h4 className="text-lg font-medium text-gray-800 mb-4">Documentación</h4>
            {documentation.length > 0 ? (
                <ul className="space-y-3">
                    {documentation.map(doc => {
                        const isExpanded = expandedDocId === doc.id;
                        return (
                        <li key={doc.id} className="border rounded-md transition-shadow hover:shadow-md bg-gray-50 overflow-hidden">
                             <div
                                className={`p-3 flex justify-between items-center flex-wrap gap-2 ${doc.status === 'pending' ? 'cursor-pointer' : ''}`}
                                onClick={() => doc.status === 'pending' && handleToggleExpand(doc.id)}
                            >
                                <div className="flex-1 min-w-[200px]">
                                    <span className="font-semibold text-gray-800">{doc.type}</span>
                                    <span className={`ml-3 px-2 py-1 text-xs font-semibold rounded-full capitalize ${
                                        doc.status === 'approved' ? 'bg-green-100 text-green-800' :
                                        doc.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                                    }`}>{doc.status}</span>
                                    {doc.status === 'rejected' && doc.rejectionReason && (
                                        <p className="text-xs text-red-600 mt-1 italic">Motivo: {doc.rejectionReason}</p>
                                    )}
                                </div>
                                {doc.status === 'pending' && (
                                    <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                )}
                            </div>

                            {isExpanded && (
                                <div className="p-4 bg-white border-t border-gray-200">
                                    {rejectingDocId === doc.id ? (
                                        <div className="space-y-2">
                                            <label htmlFor={`rejection-reason-${doc.id}`} className="block text-sm font-medium text-gray-700">Motivo de Rechazo para "{doc.type}":</label>
                                            <textarea
                                                id={`rejection-reason-${doc.id}`}
                                                value={rejectionReasonText}
                                                onChange={(e) => setRejectionReasonText(e.target.value)}
                                                className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                                                placeholder="Especifique por qué se rechaza el documento..."
                                                rows={2}
                                            />
                                            <div className="flex justify-end space-x-2 pt-2">
                                                <Button type="button" variant="secondary" onClick={handleCancelRejection} className="!py-1">Cancelar</Button>
                                                <Button type="button" variant="danger" onClick={handleConfirmRejection} disabled={!rejectionReasonText.trim()} className="!py-1">Confirmar Rechazo</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex justify-end space-x-2">
                                            <Button type="button" onClick={() => handleApproveDocument(doc.id)} className="!px-3 !py-1 text-xs !bg-green-600 hover:!bg-green-700">Aprobar</Button>
                                            <Button type="button" variant="danger" onClick={() => handleStartRejection(doc.id)} className="!px-3 !py-1 text-xs">Rechazar</Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </li>
                    )})}
                </ul>
            ) : <p className="text-sm text-gray-500">No hay documentos para este afiliado.</p>}
        </div>
    );

    const isCreateMode = !affiliate;
    const areAllFilesSelected = isCreateMode ? DOCUMENT_TYPES.every(type => !!fileUploads[type]?.file) : true;

    // Render different steps based on current step
    if (currentStep === 'ine-capture') {
        return (
            <INEProcessor
                onDataExtracted={handleINEDataExtracted}
                onCancel={handleINECancel}
            />
        );
    }

    return (
        <>
            {/* Step indicator */}
            <div className="mb-6">
                <div className="flex items-center justify-center space-x-4">
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        currentStep === 'form' ? 'bg-primary text-white' :
                        'bg-green-100 text-green-600'
                    }`}>
                        1
                    </div>
                    <div className={`flex-1 h-1 ${
                        currentStep === 'form' ? 'bg-gray-200' : 'bg-green-400'
                    }`} />
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        currentStep === 'ine-capture' ? 'bg-primary text-white' :
                        currentStep === 'form' ? 'bg-gray-200 text-gray-400' :
                        'bg-green-100 text-green-600'
                    }`}>
                        2
                    </div>
                    <div className={`flex-1 h-1 ${
                        currentStep === 'documents' ? 'bg-green-400' : 'bg-gray-200'
                    }`} />
                    <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                        currentStep === 'documents' ? 'bg-primary text-white' : 'bg-gray-200 text-gray-400'
                    }`}>
                        3
                    </div>
                </div>
                <div className="flex justify-between mt-2 text-xs text-gray-500">
                    <span className={currentStep === 'form' ? 'text-primary font-medium' : ''}>Datos Personales</span>
                    <span className={currentStep === 'ine-capture' ? 'text-primary font-medium' : ''}>Captura INE</span>
                    <span className={currentStep === 'documents' ? 'text-primary font-medium' : ''}>Documentos</span>
                </div>
            </div>

            {/* Mostrar datos extraídos del INE si están disponibles */}
            {extractedINEData && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center space-x-2 mb-3">
                        <div className="flex-shrink-0">
                            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h4 className="text-sm font-medium text-green-800">Datos extraídos automáticamente del INE</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                            <span className="font-medium text-gray-700">Nombre:</span>
                            <p className="text-gray-900">{extractedINEData.name}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">CURP:</span>
                            <p className="text-gray-900 font-mono">{extractedINEData.curp}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Clave de Elector:</span>
                            <p className="text-gray-900 font-mono">{extractedINEData.voterId}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Estado:</span>
                            <p className="text-gray-900">{extractedINEData.state}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Municipio:</span>
                            <p className="text-gray-900">{extractedINEData.municipality}</p>
                        </div>
                        <div>
                            <span className="font-medium text-gray-700">Sección:</span>
                            <p className="text-gray-900">{extractedINEData.section}</p>
                        </div>
                    </div>
                    <p className="text-xs text-green-700 mt-3">
                        Los campos del formulario se han completado automáticamente con estos datos. Puedes modificarlos si es necesario.
                    </p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Input id="fullName" name="fullName" label="Nombre Completo" value={formData.fullName} onChange={handleChange} error={errors.fullName} required />
                    <Input id="email" name="email" label="Correo Electrónico" type="email" value={formData.email} onChange={handleChange} error={errors.email} required />
                    <Input id="phone" name="phone" label="Teléfono" type="tel" value={formData.phone} onChange={handleChange} error={errors.phone} required />
                    <Input id="address" name="address" label="Dirección" value={formData.address} onChange={handleChange} error={errors.address} required />
                    <Input id="city" name="city" label="Ciudad" value={formData.city} onChange={handleChange} error={errors.city} required />
                    <div>
                        <label htmlFor="state" className="block text-sm font-medium text-gray-700">Estado</label>
                        <select id="state" name="state" value={formData.state} onChange={handleChange} required className={`mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md min-h-[44px] ${errors.state ? 'border-red-500' : 'border-gray-300'}`}>
                            {MEXICAN_STATES.map(state => <option key={state} value={state}>{state}</option>)}
                        </select>
                         {errors.state && <p className="mt-2 text-sm text-red-600">{errors.state}</p>}
                    </div>
                    <Input id="zip" name="zip" label="Código Postal" value={formData.zip} onChange={handleChange} error={errors.zip} required />
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700">Estatus</label>
                        <select id="status" name="status" value={formData.status} onChange={handleChange} required className="mt-1 block w-full pl-3 pr-10 py-3 text-base border-gray-300 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm rounded-md min-h-[44px]">
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                </div>

                {affiliate ? renderDocumentation() : renderFileUploads()}

                <div className="pt-6 mt-6 border-t">
                     {statusMessage && (
                        <div className={`p-3 rounded-md text-sm flex items-center mb-4 font-medium
                            ${statusMessage.type === 'info' ? 'bg-blue-50 text-blue-700' : ''}
                            ${statusMessage.type === 'success' ? 'bg-green-50 text-green-700' : ''}
                            ${statusMessage.type === 'error' ? 'bg-red-50 text-red-700' : ''}
                        `}>
                            {statusMessage.type === 'info' && (
                                <svg className="animate-spin mr-3 h-5 w-5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {statusMessage.type === 'success' && <CheckIcon />}
                            {statusMessage.type === 'error' && <ErrorIcon />}
                            <span>{statusMessage.text}</span>
                        </div>
                    )}
                    <div className="flex justify-end space-x-4">
                        <Button type="button" variant="secondary" onClick={currentStep === 'documents' ? handleBackToForm : onCancel} disabled={isLoading}>
                            {currentStep === 'documents' ? '← Volver al Formulario' : 'Cancelar'}
                        </Button>
                        {currentStep === 'form' ? (
                            <Button type="button" onClick={handleFormContinue} disabled={isLoading}>
                                📷 Continuar con Captura de INE
                            </Button>
                        ) : (
                            <Button type="submit" isLoading={isLoading} disabled={isLoading || (isCreateMode && !areAllFilesSelected)}>
                                {affiliate ? 'Guardar Cambios' : 'Crear Afiliado'}
                            </Button>
                        )}
                    </div>
                </div>
            </form>

            <ConfirmationModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={() => {
                    setIsConfirmModalOpen(false);
                    executeSaveOperation();
                }}
                title="Confirmar Cambios"
                confirmText="Guardar Cambios"
                isConfirming={isLoading}
            >
                <p>¿Estás seguro de que quieres guardar los cambios realizados a este afiliado?</p>
            </ConfirmationModal>
        </>
    );
};

export default AffiliateForm;