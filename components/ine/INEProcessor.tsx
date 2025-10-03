import React, { useState, useRef } from 'react';
import Tesseract from 'tesseract.js';
import INECapture from './INECapture';
import { groqService, INEStructuredData } from '../../services/groqService';
import { savePendingINE } from '../../services/ineOfflineService';
import { useSyncOffline } from '../../hooks/useSyncOffline';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface INEProcessorProps {
  onDataExtracted: (data: INEStructuredData, images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type ProcessorStep = 'capture' | 'processing' | 'review' | 'error';

const INEProcessor: React.FC<INEProcessorProps> = ({ onDataExtracted, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<ProcessorStep>('capture');
  const [images, setImages] = useState<{ frontal: File; posterior: File } | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [structuredData, setStructuredData] = useState<INEStructuredData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Hook para sincronización offline
  const { isOnline, syncNow } = useSyncOffline();

  const handleImagesCaptured = async (capturedImages: { frontal: File; posterior: File }) => {
    setImages(capturedImages);
    setCurrentStep('processing');
    setIsProcessing(true);
    setRawText('');
    setStructuredData(null);

    try {
      console.log('📷 Iniciando procesamiento de INE...');

      // OCR local con Tesseract.js
      console.log('🔍 Extrayendo texto con Tesseract.js...');
      const { data: { text } } = await Tesseract.recognize(
        capturedImages.frontal,
        'spa', // español
        {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              console.log(`OCR progreso: ${(m.progress * 100).toFixed(1)}%`);
            }
          }
        }
      );

      const cleanText = text.trim();
      console.log('📝 Texto extraído:', cleanText.substring(0, 100) + '...');
      setRawText(cleanText);

      // Convertir imagen a base64 para guardar offline
      const imageData = await fileToBase64(capturedImages.frontal);

      // Guardar siempre en IndexedDB (para offline)
      const savedId = await savePendingINE(cleanText, imageData);
      console.log(`💾 INE guardado offline con ID: ${savedId}`);

      // Procesar con Groq si hay conexión
      if (navigator.onLine) {
        console.log('🌐 Procesando con Groq AI...');
        try {
          const structured = await groqService.processINEText(cleanText);
          console.log('✅ Datos estructurados:', structured);
          setStructuredData(structured);

          // Marcar como procesado en el hook (esto se hará automáticamente)
          // El hook se encargará de sincronizar cuando sea necesario
        } catch (groqError) {
          console.warn('⚠️ Groq falló, pero el texto crudo está guardado:', groqError);
          // No es error crítico, el texto crudo ya está guardado
        }
      } else {
        console.log('📱 Modo offline: INE guardado para procesar después');
      }

      setCurrentStep('review');

    } catch (error: any) {
      console.error('❌ Error procesando INE:', error);
      setErrorMessage(error.message || 'Error al procesar las imágenes del INE');
      setCurrentStep('error');
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Utilidad para convertir File a base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remover el prefijo "data:image/jpeg;base64,"
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(reader.error);
    });
  };

  const handleRetryOCR = async () => {
    if (!images) return;

    setCurrentStep('processing');
    setIsProcessing(true);
    setShowErrorModal(false);

    try {
      // Reprocesar la imagen con OCR
      await handleImagesCaptured(images);
    } catch (error) {
      console.error('Error retrying OCR:', error);
      setErrorMessage('Error al reprocesar las imágenes del INE');
      setCurrentStep('error');
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAcceptData = () => {
    // Usar datos estructurados si existen, sino crear un objeto básico con el texto crudo
    const dataToSend = structuredData || {
      nombre_completo: 'Texto extraído disponible',
      domicilio: rawText,
      clave_elector: '',
      curp: '',
      fecha_nacimiento: '',
      fecha_emision: '',
      fecha_vigencia: '',
      seccion: '',
      municipio: '',
      estado: '',
      localidad: ''
    };

    if (images) {
      onDataExtracted(dataToSend, images);
    }
  };

  const handleRetryCapture = () => {
    setCurrentStep('capture');
    setImages(null);
    setRawText('');
    setStructuredData(null);
    setShowErrorModal(false);
  };

  const handleSyncNow = () => {
    syncNow();
  };

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Procesando INE con OCR
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>🔍 <strong>Paso 1:</strong> OCR local con Tesseract.js</p>
          {navigator.onLine ? (
            <p>🤖 <strong>Paso 2:</strong> Estructuración con Groq AI</p>
          ) : (
            <p>📱 <strong>Modo offline:</strong> Solo OCR local</p>
          )}
        </div>
        <p className="text-gray-600 mt-3">
          Extrayendo datos de la credencial de elector...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Esto puede tomar unos segundos
        </p>
      </div>
    </div>
  );

  const renderReview = () => {
    const data = structuredData;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            ✅ Procesamiento Completado
          </h3>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className={`px-2 py-1 rounded-full text-xs ${navigator.onLine ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {navigator.onLine ? '🌐 Online' : '📱 Offline'}
            </span>
            <button
              onClick={handleSyncNow}
              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs hover:bg-blue-200"
            >
              🔄 Sincronizar ahora
            </button>
          </div>
        </div>

        {/* Vista previa de imágenes */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-md mx-auto">
          <div className="text-center">
            <h4 className="font-medium text-gray-900 mb-2">INE Frontal</h4>
            <img
              src={URL.createObjectURL(images!.frontal)}
              alt="INE Frontal"
              className="w-full h-32 object-cover rounded-lg border"
            />
          </div>
          <div className="text-center">
            <h4 className="font-medium text-gray-900 mb-2">INE Posterior</h4>
            <img
              src={URL.createObjectURL(images!.posterior)}
              alt="INE Posterior"
              className="w-full h-32 object-cover rounded-lg border"
            />
          </div>
        </div>

        {/* Texto crudo extraído */}
        {rawText && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">📝 Texto Extraído (OCR):</h4>
            <pre className="text-sm text-blue-800 whitespace-pre-wrap max-h-32 overflow-y-auto bg-white p-2 rounded border">
              {rawText}
            </pre>
          </div>
        )}

        {/* Datos estructurados (solo si existen) */}
        {data && (
          <div className="bg-green-50 rounded-lg p-6 space-y-4">
            <h4 className="font-semibold text-green-900 mb-4">🤖 Datos Estructurados (Groq AI):</h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="font-medium text-gray-700">Nombre completo:</label>
                <p className="text-gray-900 mt-1">{data.nombre_completo || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">CURP:</label>
                <p className="text-gray-900 mt-1 font-mono">{data.curp || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Clave de Elector:</label>
                <p className="text-gray-900 mt-1 font-mono">{data.clave_elector || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Fecha de nacimiento:</label>
                <p className="text-gray-900 mt-1">{data.fecha_nacimiento || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Estado:</label>
                <p className="text-gray-900 mt-1">{data.estado || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Municipio:</label>
                <p className="text-gray-900 mt-1">{data.municipio || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Sección:</label>
                <p className="text-gray-900 mt-1">{data.seccion || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Localidad:</label>
                <p className="text-gray-900 mt-1">{data.localidad || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Fecha de emisión:</label>
                <p className="text-gray-900 mt-1">{data.fecha_emision || 'No disponible'}</p>
              </div>

              <div>
                <label className="font-medium text-gray-700">Fecha de vigencia:</label>
                <p className="text-gray-900 mt-1">{data.fecha_vigencia || 'No disponible'}</p>
              </div>

              <div className="md:col-span-2">
                <label className="font-medium text-gray-700">Domicilio:</label>
                <p className="text-gray-900 mt-1">{data.domicilio || 'No disponible'}</p>
              </div>
            </div>
          </div>
        )}

        {!data && rawText && (
          <div className="bg-yellow-50 rounded-lg p-4">
            <h4 className="font-semibold text-yellow-900 mb-2">⚠️ Sin datos estructurados</h4>
            <p className="text-yellow-800 text-sm">
              El texto fue extraído correctamente, pero no se pudo procesar con Groq AI.
              Puedes continuar con el texto crudo o intentar sincronizar más tarde.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleRetryCapture} variant="secondary">
            ↻ Volver a capturar
          </Button>
          <Button onClick={handleRetryOCR} variant="secondary">
            🔄 Reprocesar OCR
          </Button>
          <Button onClick={handleAcceptData}>
            ✅ Usar estos datos
          </Button>
        </div>
      </div>
    );
  };

  const renderErrorModal = () => (
    <Modal
      isOpen={showErrorModal}
      onClose={() => setShowErrorModal(false)}
      title="Error en el Procesamiento OCR"
    >
      <div className="space-y-4">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <svg className="h-6 w-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div>
            <p className="text-sm text-gray-700">{errorMessage}</p>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button onClick={() => setShowErrorModal(false)} variant="secondary">
            Cerrar
          </Button>
          <Button onClick={handleRetryOCR}>
            🔄 Reintentar OCR
          </Button>
          <Button onClick={handleRetryCapture}>
            📷 Volver a capturar
          </Button>
        </div>
      </div>
    </Modal>
  );

  return (
    <>
      {currentStep === 'capture' && (
        <INECapture
          onImagesCaptured={handleImagesCaptured}
          onCancel={onCancel}
        />
      )}

      {currentStep === 'processing' && renderProcessing()}

      {currentStep === 'review' && renderReview()}

      {renderErrorModal()}
    </>
  );
};

export default INEProcessor;
