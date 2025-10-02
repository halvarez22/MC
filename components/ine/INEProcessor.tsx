import React, { useState } from 'react';
import INECapture from './INECapture';
import { ocrService, INEData, OCRResult } from '../../services/ocrService';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface INEProcessorProps {
  onDataExtracted: (data: INEData, images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type ProcessorStep = 'capture' | 'processing' | 'review' | 'error';

const INEProcessor: React.FC<INEProcessorProps> = ({ onDataExtracted, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<ProcessorStep>('capture');
  const [images, setImages] = useState<{ frontal: File; posterior: File } | null>(null);
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleImagesCaptured = async (capturedImages: { frontal: File; posterior: File }) => {
    setImages(capturedImages);
    setCurrentStep('processing');
    setIsProcessing(true);

    try {
      const result = await ocrService.processINEImages(capturedImages.frontal, capturedImages.posterior);

      if (result.success && result.data) {
        setOcrResult(result);
        setCurrentStep('review');
      } else {
        setOcrResult(result);
        setErrorMessage(result.error || 'Error desconocido en el procesamiento OCR');
        setCurrentStep('error');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error processing INE:', error);
      setErrorMessage('Error al procesar las imágenes del INE');
      setCurrentStep('error');
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryOCR = async () => {
    if (!images) return;

    setCurrentStep('processing');
    setIsProcessing(true);
    setShowErrorModal(false);

    try {
      const result = await ocrService.processINEImages(images.frontal, images.posterior);

      if (result.success && result.data) {
        setOcrResult(result);
        setCurrentStep('review');
      } else {
        setOcrResult(result);
        setErrorMessage(result.error || 'Error desconocido en el procesamiento OCR');
        setCurrentStep('error');
        setShowErrorModal(true);
      }
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
    if (ocrResult?.success && ocrResult.data && images) {
      onDataExtracted(ocrResult.data, images);
    }
  };

  const handleRetryCapture = () => {
    setCurrentStep('capture');
    setImages(null);
    setOcrResult(null);
    setShowErrorModal(false);
  };

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Procesando INE con OCR
        </h3>
        <p className="text-gray-600">
          Extrayendo datos de la credencial de elector...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Esto puede tomar unos segundos
        </p>
      </div>
    </div>
  );

  const renderReview = () => {
    if (!ocrResult?.success || !ocrResult.data) return null;

    const data = ocrResult.data;

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            ✅ Datos Extraídos del INE
          </h3>
          <p className="text-gray-600">
            Revisa la información extraída y confirma que es correcta
          </p>
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

        {/* Datos extraídos */}
        <div className="bg-gray-50 rounded-lg p-6 space-y-4">
          <h4 className="font-semibold text-gray-900 mb-4">Información Extraída:</h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <label className="font-medium text-gray-700">Nombre:</label>
              <p className="text-gray-900 mt-1">{data.name || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">CURP:</label>
              <p className="text-gray-900 mt-1 font-mono">{data.curp || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Clave de Elector:</label>
              <p className="text-gray-900 mt-1 font-mono">{data.voterId || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Estado:</label>
              <p className="text-gray-900 mt-1">{data.state || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Municipio:</label>
              <p className="text-gray-900 mt-1">{data.municipality || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Sección:</label>
              <p className="text-gray-900 mt-1">{data.section || 'No disponible'}</p>
            </div>

            <div className="md:col-span-2">
              <label className="font-medium text-gray-700">Domicilio:</label>
              <p className="text-gray-900 mt-1">{data.address || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Año de Registro:</label>
              <p className="text-gray-900 mt-1">{data.registrationYear || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Localidad:</label>
              <p className="text-gray-900 mt-1">{data.locality || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Emisión:</label>
              <p className="text-gray-900 mt-1">{data.emission || 'No disponible'}</p>
            </div>

            <div>
              <label className="font-medium text-gray-700">Vigencia:</label>
              <p className="text-gray-900 mt-1">{data.validity || 'No disponible'}</p>
            </div>
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Button onClick={handleRetryCapture} variant="secondary">
            ↻ Volver a capturar
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
