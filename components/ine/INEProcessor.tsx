import React, { useState, useRef, useEffect } from 'react';
import INECapture from './INECapture';
import ListaNominalStatusBadge from './ListaNominalStatusBadge';
import { groqService } from '../../services/groqService';
import type { INEStructuredData } from '../../types';
import { savePendingINE, markINEAsProcessed } from '../../services/ineOfflineService';
import { extractIneDocument } from '../../services/ocrOrchestrator';
import {
  isGroqVisionEnabled,
  isListaNominalEnforceEnabled,
} from '../../services/featureFlags';
import { buildValidateListaNominalAuditEntry } from '../../services/listaNominalAudit';
import { useListaNominalValidation } from '../../hooks/useListaNominalValidation';
import { FORCE_INE_SYNC_EVENT } from '../../hooks/useSyncOffline';
import Button from '../ui/Button';
import Modal from '../ui/Modal';

interface INEProcessorProps {
  onDataExtracted: (data: INEStructuredData, images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type ProcessorStep = 'capture' | 'processing' | 'ocr_review' | 'ai_processing' | 'review' | 'error';

const INEProcessor: React.FC<INEProcessorProps> = ({ onDataExtracted, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<ProcessorStep>('capture');
  const [images, setImages] = useState<{ frontal: File; posterior: File } | null>(null);
  const [rawText, setRawText] = useState<string>('');
  const [correctedText, setCorrectedText] = useState<string>('');
  const [structuredData, setStructuredData] = useState<INEStructuredData | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<INEStructuredData | null>(null);
  /** ID IndexedDB del pending INE — hilo conductor para markINEAsProcessed. */
  const [pendingIneId, setPendingIneId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const { isValidating: isLnValidating, lnResult, revalidate: revalidateListaNominal } =
    useListaNominalValidation(structuredData);

  const enforceListaNominal = isListaNominalEnforceEnabled();
  const blockConfirmHard =
    enforceListaNominal &&
    !!lnResult &&
    (lnResult.status === 'error' || lnResult.status === 'not_found');

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const resetINEProcessor = () => {
    setImages(null);
    setRawText('');
    setCorrectedText('');
    setStructuredData(null);
    setShowErrorModal(false);
    setIsEditing(false);
    setEditedData(null);
    setPendingIneId(null);
  };

  const handleImagesCaptured = async (capturedImages: { frontal: File; posterior: File }) => {
    setImages(capturedImages);
    setCurrentStep('processing');
    setIsProcessing(true);
    setRawText('');
    setStructuredData(null);

    try {
      console.log('📷 Iniciando procesamiento de INE (frontal + posterior)...');
      console.log(
        `🚩 VITE_USE_GROQ_VISION=${isGroqVisionEnabled() ? 'true' : 'false (legado)'}`
      );

      const result = await extractIneDocument({
        frontal: capturedImages.frontal,
        posterior: capturedImages.posterior,
        online: navigator.onLine,
      });

      setRawText(result.rawText);

      const savedId = await savePendingINE(result.rawText, {
        frontal: result.imageDataFrontal,
        posterior: result.imageDataPosterior,
      });
      setPendingIneId(savedId);
      console.log(`💾 INE guardado offline con ID: ${savedId} mode=${result.mode}`);

      // A′1: Groq Vision one-shot → review estructurado (sin ocr_review online)
      if (result.mode === 'groq_vision' && result.structured) {
        setStructuredData(result.structured);
        await markINEAsProcessed(savedId, result.structured);
        console.log(`🏷️ INE ${savedId} processed=true (visión one-shot)`);
        setCurrentStep('review');
        return;
      }

      // Legado / offline: revisión de texto OCR antes de LLM texto
      console.log('📱 OCR listo — pendiente confirmación de usuario (path legado/offline)');
      setCurrentStep('ocr_review');
    } catch (error: any) {
      console.error('❌ Error procesando INE:', error);
      setErrorMessage(error.message || 'Error al procesar las imágenes del INE');
      setCurrentStep('error');
      setShowErrorModal(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRetryOCR = async () => {
    if (!images || isProcessing) return;

    setCurrentStep('processing');
    setIsProcessing(true);
    setShowErrorModal(false);

    try {
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

  // Única llamada LLM intencional en UX online (Opción A)
  const handleProcessWithAI = async (textToProcess: string) => {
    if (isProcessing) return;

    setCurrentStep('ai_processing');
    setIsProcessing(true);

    try {
      console.log('🤖 Procesando texto corregido con Groq AI...');
      console.log('📎 pendingIneId para idempotencia:', pendingIneId);

      const structured = await groqService.processINEText(textToProcess);
      console.log('✅ Datos estructurados:', structured);
      setStructuredData(structured);

      if (pendingIneId) {
        await markINEAsProcessed(pendingIneId, structured);
        console.log(`🏷️ INE ${pendingIneId} marcada processed=true (anti re-Groq en sync)`);
      } else {
        console.warn('⚠️ Sin pendingIneId — sync podría re-procesar este texto');
      }

      setCurrentStep('review');

    } catch (error) {
      console.warn('⚠️ Error procesando con IA:', error);
      setStructuredData(null);
      setCurrentStep('review');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirmar texto OCR (usar sin correcciones)
  const handleConfirmOCRText = () => {
    setCorrectedText(rawText);
    handleProcessWithAI(rawText);
  };

  // Aplicar correcciones y procesar
  const handleApplyCorrections = () => {
    const textToProcess = correctedText.trim() || rawText;
    handleProcessWithAI(textToProcess);
  };

  // Volver a la revisión OCR
  const handleBackToOCRReview = () => {
    setCurrentStep('ocr_review');
    setStructuredData(null);
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

    // Fase 3.3: preparar audit sin PII (persistencia Firebase = Fase 3.4)
    if (lnResult) {
      const auditPrep = buildValidateListaNominalAuditEntry(lnResult);
      console.info('[AUDIT_PREP]', auditPrep.action, auditPrep.details);
    }

    if (images) {
      onDataExtracted(dataToSend, images);
    }
  };

  const handleRetryCapture = () => {
    resetINEProcessor();
    setCurrentStep('capture');
  };

  const handleSyncNow = () => {
    window.dispatchEvent(new CustomEvent(FORCE_INE_SYNC_EVENT));
  };

  // Funciones para edición manual
  const handleStartEditing = () => {
    setEditedData(structuredData ? { ...structuredData } : null);
    setIsEditing(true);
  };

  const handleSaveEditing = () => {
    if (editedData) {
      setStructuredData(editedData);
      setIsEditing(false);
      console.log('✅ Datos editados guardados:', editedData);
    }
  };

  const handleCancelEditing = () => {
    setEditedData(null);
    setIsEditing(false);
  };

  const updateEditedField = (field: keyof INEStructuredData, value: string) => {
    if (editedData) {
      setEditedData({ ...editedData, [field]: value });
    }
  };

  const renderProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Procesando INE Completo con OCR
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>🔍 <strong>Paso 1:</strong> OCR frontal - Nombre, CURP, Domicilio</p>
          <p>🔍 <strong>Paso 2:</strong> OCR posterior - Firma, Código QR</p>
          <p>💾 <strong>Paso 3:</strong> Persistencia offline / enriquecimiento según flag</p>
          <p className="text-blue-600 font-medium">
            🎯 <strong>Motor:</strong>{' '}
            {isGroqVisionEnabled() && isOnline
              ? 'Groq Vision (proxy /api/groq-ine)'
              : 'Google Vision / Tesseract (legado)'}
          </p>
        </div>
        <p className="text-gray-600 mt-3">
          Extrayendo datos de ambas caras de la credencial...
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Esto puede tomar más tiempo debido al procesamiento completo
        </p>
      </div>
    </div>
  );

  const renderOCRReview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          📝 Revisar Texto Extraído
        </h3>
        <p className="text-gray-600 mb-4">
          El OCR ha extraído el siguiente texto. Revisa si es correcto y corrige cualquier error antes de procesar con IA.
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

      {/* Texto OCR crudo de ambas caras */}
      <div className="bg-blue-50 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 mb-2">📝 Texto Extraído por OCR (Ambas Caras):</h4>
        <div className="bg-white rounded border p-2 mb-2">
          <div className="text-xs text-gray-500 mb-1">💡 Información típica por cara:</div>
          <div className="text-xs text-gray-600 grid grid-cols-2 gap-2">
            <div><strong>Frontal:</strong> Nombre, CURP, Domicilio</div>
            <div><strong>Posterior:</strong> Firma, Código QR, Huella</div>
          </div>
        </div>
        <textarea
          value={correctedText || rawText}
          onChange={(e) => setCorrectedText(e.target.value)}
          className="w-full h-40 p-3 border border-gray-300 rounded-md font-mono text-sm resize-vertical"
          placeholder="El texto OCR de ambas caras aparecerá aquí..."
        />
        <p className="text-xs text-blue-700 mt-2">
          💡 <strong>Tip:</strong> Corrige errores de OCR aquí antes de enviar a IA. Se procesaron ambas caras del INE para máxima precisión.
        </p>
      </div>

      {/* Información sobre el siguiente paso */}
      <div className="bg-green-50 rounded-lg p-4">
        <h4 className="font-semibold text-green-900 mb-2">🤖 Próximo Paso: Procesamiento con IA</h4>
        <p className="text-green-800 text-sm">
          Una vez que confirmes el texto, la IA analizará el contenido para extraer datos estructurados como nombre, CURP, dirección, etc.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Button onClick={handleRetryCapture} variant="secondary" disabled={isProcessing}>
          ↻ Volver a capturar
        </Button>
        <Button onClick={handleRetryOCR} variant="secondary" disabled={isProcessing} isLoading={isProcessing}>
          🔄 Reprocesar OCR
        </Button>
        <Button
          onClick={handleConfirmOCRText}
          className="bg-blue-600 hover:bg-blue-700"
          disabled={isProcessing}
          isLoading={isProcessing}
        >
          ✅ Usar texto tal cual
        </Button>
        <Button
          onClick={handleApplyCorrections}
          className="bg-green-600 hover:bg-green-700"
          disabled={isProcessing}
          isLoading={isProcessing}
        >
          🚀 Aplicar correcciones y procesar
        </Button>
      </div>
    </div>
  );

  const renderAIProcessing = () => (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-6">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          🤖 Procesando con Inteligencia Artificial
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <p>📄 <strong>Texto procesado:</strong> Información de ambas caras del INE</p>
          <p>🧠 <strong>Análisis inteligente:</strong> Extrayendo datos estructurados</p>
          <p>📊 <strong>Validación automática:</strong> Verificando formatos y consistencia</p>
        </div>
        <p className="text-gray-600 mt-3">
          Analizando el texto completo corregido para identificar nombre, CURP, dirección, sección, etc.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          El procesamiento de ambas caras mejora significativamente la precisión
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
            <span className={`px-2 py-1 rounded-full text-xs ${isOnline ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
              {isOnline ? '🌐 Online' : '📱 Offline'}
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

        {/* Texto crudo extraído de ambas caras */}
        {rawText && (
          <div className="bg-blue-50 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">📝 Texto Extraído (OCR Completo - Ambas Caras):</h4>
            <div className="bg-white rounded border p-2 mb-2">
              <div className="text-xs text-gray-500">✅ Procesamiento completo del INE realizado</div>
            </div>
            <pre className="text-sm text-blue-800 whitespace-pre-wrap max-h-40 overflow-y-auto bg-white p-2 rounded border">
              {rawText}
            </pre>
          </div>
        )}

        {/* Datos estructurados (solo si existen) */}
        {data && (
          <div className="bg-green-50 rounded-lg p-6 space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-green-900">🤖 Datos Estructurados con Validación:</h4>
              <div className="text-sm">
                <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  🛡️ Validado automáticamente
                </span>
              </div>
            </div>

            {/* Advertencia sobre revisión humana */}
            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>⚠️ Revisión requerida:</strong> Verifica que los datos sean correctos antes de continuar.
                    Campos con baja confianza (&lt; 60%) necesitan edición manual.
                  </p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <ListaNominalStatusBadge
                isValidating={isLnValidating}
                result={lnResult}
                onRetry={revalidateListaNominal}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <EditableDataField
                label="Nombre completo"
                value={isEditing && editedData ? editedData.nombre_completo : data.nombre_completo}
                confidence={data.nombre_completo && data.nombre_completo !== 'No se pudo extraer nombre' ? 90 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('nombre_completo', value)}
              />

              <EditableDataField
                label="CURP"
                value={isEditing && editedData ? editedData.curp : data.curp}
                confidence={data.curp && data.curp !== 'No se pudo extraer CURP' ? 95 : 10}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('curp', value)}
                isMonospace={true}
              />

              <EditableDataField
                label="Clave de Elector"
                value={isEditing && editedData ? editedData.clave_elector : data.clave_elector}
                confidence={data.clave_elector && data.clave_elector !== 'No se pudo extraer clave' ? 85 : 15}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('clave_elector', value)}
                isMonospace={true}
              />

              {(() => {
                const claveRaw =
                  (isEditing && editedData ? editedData.clave_elector : data.clave_elector) || '';
                const claveLen = claveRaw.replace(/\s/g, '').length;
                if (!claveLen || claveLen === 18) return null;
                return (
                  <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                    ⚠️ Revisa la Clave de Elector, parece tener un error de transposición
                  </div>
                );
              })()}

              <EditableDataField
                label="Fecha de nacimiento"
                value={isEditing && editedData ? editedData.fecha_nacimiento : data.fecha_nacimiento}
                confidence={data.fecha_nacimiento && data.fecha_nacimiento !== 'No se pudo extraer fecha nacimiento' ? 80 : 25}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('fecha_nacimiento', value)}
              />

              <EditableDataField
                label="Estado"
                value={isEditing && editedData ? editedData.estado : data.estado}
                confidence={data.estado && data.estado !== 'No se pudo extraer estado' ? 85 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('estado', value)}
              />

              <EditableDataField
                label="Municipio"
                value={isEditing && editedData ? editedData.municipio : data.municipio}
                confidence={data.municipio && data.municipio !== 'No se pudo extraer municipio' ? 80 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('municipio', value)}
              />

              <EditableDataField
                label="Sección"
                value={isEditing && editedData ? editedData.seccion : data.seccion}
                confidence={data.seccion && data.seccion !== 'No se pudo extraer sección' ? 90 : 15}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('seccion', value)}
              />

              <EditableDataField
                label="Localidad"
                value={isEditing && editedData ? editedData.localidad : data.localidad}
                confidence={data.localidad && data.localidad !== 'No se pudo extraer localidad' ? 75 : 20}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('localidad', value)}
              />

              <EditableDataField
                label="Fecha de emisión"
                value={isEditing && editedData ? editedData.fecha_emision : data.fecha_emision}
                confidence={data.fecha_emision && data.fecha_emision !== 'No se pudo extraer fecha emisión' ? 70 : 30}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('fecha_emision', value)}
              />

              <EditableDataField
                label="Fecha de vigencia"
                value={isEditing && editedData ? editedData.fecha_vigencia : data.fecha_vigencia}
                confidence={data.fecha_vigencia && data.fecha_vigencia !== 'No se pudo extraer fecha vigencia' ? 70 : 30}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('fecha_vigencia', value)}
              />

              <EditableDataField
                label="Domicilio"
                value={isEditing && editedData ? editedData.domicilio : data.domicilio}
                confidence={data.domicilio && data.domicilio !== 'No se pudo extraer domicilio' ? 60 : 40}
                isEditing={isEditing}
                onChange={(value) => updateEditedField('domicilio', value)}
                isFullWidth={true}
              />
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

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <p className="text-sm text-gray-600 mb-3">
            💡 <strong>¿Los datos no son correctos?</strong> Puedes editar manualmente los campos o volver a capturar la imagen.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 justify-center">
          <Button onClick={handleRetryCapture} variant="secondary" disabled={isProcessing}>
            ↻ Volver a capturar
          </Button>
          <Button onClick={handleRetryOCR} variant="secondary" disabled={isProcessing}>
            🔄 Reprocesar OCR
          </Button>

          {isEditing ? (
            <>
              <Button onClick={handleSaveEditing} className="bg-green-600 hover:bg-green-700" disabled={isProcessing}>
                💾 Guardar cambios
              </Button>
              <Button onClick={handleCancelEditing} variant="outline" disabled={isProcessing}>
                ❌ Cancelar edición
              </Button>
            </>
          ) : (
            <>
              <Button onClick={handleStartEditing} variant="outline" disabled={isProcessing}>
                ✏️ Editar datos
              </Button>
              <Button
                onClick={handleAcceptData}
                className="bg-green-600 hover:bg-green-700"
                disabled={isProcessing || blockConfirmHard}
              >
                ✅ Confirmar y continuar
              </Button>
              {blockConfirmHard ? (
                <p className="w-full text-center text-xs text-red-600">
                  Validación Lista Nominal en modo estricto: corrige o reintenta antes de continuar.
                </p>
              ) : null}
            </>
          )}
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

      {currentStep === 'ocr_review' && renderOCRReview()}

      {currentStep === 'ai_processing' && renderAIProcessing()}

      {currentStep === 'review' && renderReview()}

      {renderErrorModal()}
    </>
  );
};

// Componente para mostrar campos de datos con indicadores de confianza
interface DataFieldProps {
  label: string;
  value: string;
  confidence: number;
  isMonospace?: boolean;
  isFullWidth?: boolean;
}

const DataField: React.FC<DataFieldProps> = ({ label, value, confidence, isMonospace = false, isFullWidth = false }) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return '✅';
    if (confidence >= 60) return '⚠️';
    return '❌';
  };

  return (
    <div className={isFullWidth ? 'md:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-gray-700">{label}:</label>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
          {getConfidenceIcon(confidence)} {confidence}%
        </span>
      </div>
      <p className={`text-gray-900 mt-1 ${isMonospace ? 'font-mono' : ''} ${!value || value.startsWith('No se pudo') ? 'text-gray-500 italic' : ''}`}>
        {value || 'No disponible'}
      </p>
    </div>
  );
};

// Componente editable para campos de datos
interface EditableDataFieldProps {
  label: string;
  value: string;
  confidence: number;
  isEditing: boolean;
  onChange: (value: string) => void;
  isMonospace?: boolean;
  isFullWidth?: boolean;
}

const EditableDataField: React.FC<EditableDataFieldProps> = ({
  label,
  value,
  confidence,
  isEditing,
  onChange,
  isMonospace = false,
  isFullWidth = false
}) => {
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'text-green-600 bg-green-100';
    if (confidence >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getConfidenceIcon = (confidence: number) => {
    if (confidence >= 80) return '✅';
    if (confidence >= 60) return '⚠️';
    return '❌';
  };

  return (
    <div className={isFullWidth ? 'md:col-span-2' : ''}>
      <div className="flex items-center justify-between mb-1">
        <label className="font-medium text-gray-700">{label}:</label>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(confidence)}`}>
          {getConfidenceIcon(confidence)} {confidence}%
        </span>
      </div>

      {isEditing ? (
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${isMonospace ? 'font-mono' : ''}`}
          placeholder={`Ingresa ${label.toLowerCase()}`}
        />
      ) : (
        <p className={`text-gray-900 mt-1 ${isMonospace ? 'font-mono' : ''} ${!value || value.startsWith('No se pudo') ? 'text-gray-500 italic' : ''}`}>
          {value || 'No disponible'}
        </p>
      )}
    </div>
  );
};

export default INEProcessor;
