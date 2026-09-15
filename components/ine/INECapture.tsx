import React, { useState, useRef, useEffect, useCallback } from 'react';
import Button from '../ui/Button';
import PrivacyConsentModal from '../ui/PrivacyConsentModal';
import { useTrackedObjectUrl } from '../../hooks/useTrackedObjectUrl';
import {
  createCaptureMutex,
  useIneAutoCapture,
} from '../../hooks/useIneAutoCapture';
import {
  INE_AUTO_CAPTURE_STABLE_TICKS,
  INE_CAPTURE_JPEG_QUALITY,
  INE_QUALITY_ANALYSIS_HEIGHT,
  INE_QUALITY_ANALYSIS_INTERVAL_MS,
  INE_QUALITY_ANALYSIS_WIDTH,
  isIneCaptureReady,
  type IneImageQualityFlags,
} from '../../services/ineCaptureQualityConfig';
import { evaluateIneFrameQuality } from '../../services/ineCaptureQualityAnalyzer';

interface INECaptureProps {
  onImagesCaptured: (images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type CaptureStep = 'frontal' | 'posterior' | 'preview';

const INITIAL_QUALITY: IneImageQualityFlags = {
  isBlurred: false,
  isTooDark: false,
  isTooBright: false,
  isTilted: false,
  isWellPositioned: false,
};

const INECapture: React.FC<INECaptureProps> = ({ onImagesCaptured, onCancel }) => {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [currentStep, setCurrentStep] = useState<CaptureStep>('frontal');
  const [frontalImage, setFrontalImage] = useState<File | null>(null);
  const [posteriorImage, setPosteriorImage] = useState<File | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string>('');
  const [imageQuality, setImageQuality] = useState<IneImageQualityFlags>(INITIAL_QUALITY);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mutexRef = useRef(createCaptureMutex());
  const currentStepRef = useRef(currentStep);
  currentStepRef.current = currentStep;

  const frontalPreviewUrl = useTrackedObjectUrl(frontalImage);
  const posteriorPreviewUrl = useTrackedObjectUrl(posteriorImage);

  const stopStream = useCallback(() => {
    const s = streamRef.current;
    if (s) {
      s.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setStream(null);
    }
  }, []);

  // Cámara: reinicia en frontal / posterior (y retake). Se detiene en preview.
  useEffect(() => {
    if (!privacyAccepted) return;

    const needsCamera = currentStep === 'frontal' || currentStep === 'posterior';
    if (!needsCamera) {
      stopStream();
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      try {
        setIsLoading(true);
        setError('');
        setImageQuality(INITIAL_QUALITY);
        mutexRef.current.unlock();

        stopStream();

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        });

        if (!isMounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          try {
            await videoRef.current.play();
          } catch (playError) {
            console.warn('Error playing video:', playError);
            setTimeout(() => {
              if (videoRef.current && isMounted) {
                videoRef.current.play().catch(console.warn);
              }
            }, 100);
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        if (isMounted) {
          setError('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    startCamera();

    return () => {
      isMounted = false;
    };
  }, [privacyAccepted, currentStep, stopStream]);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Análisis de calidad en vivo
  useEffect(() => {
    if (!privacyAccepted) return;
    if (currentStep === 'preview' || isCapturing) return;

    const analyzeImageQuality = () => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = INE_QUALITY_ANALYSIS_WIDTH;
      canvas.height = INE_QUALITY_ANALYSIS_HEIGHT;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setImageQuality(
        evaluateIneFrameQuality(imageData.data, canvas.width, canvas.height)
      );
    };

    const interval = setInterval(analyzeImageQuality, INE_QUALITY_ANALYSIS_INTERVAL_MS);
    analyzeImageQuality();
    return () => clearInterval(interval);
  }, [currentStep, privacyAccepted, isCapturing]);

  const captureImage = useCallback(() => {
    if (!isIneCaptureReady(imageQuality)) {
      alert('La imagen no tiene buena calidad. Corrige los problemas mostrados antes de capturar.');
      mutexRef.current.unlock();
      return;
    }

    if (!videoRef.current || !canvasRef.current) {
      mutexRef.current.unlock();
      return;
    }

    // Mutex compartido auto/manual
    if (!mutexRef.current.isLocked() && !mutexRef.current.tryLock()) {
      return;
    }

    setIsCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) {
      mutexRef.current.unlock();
      setIsCapturing(false);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const step = currentStepRef.current;

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          mutexRef.current.unlock();
          setIsCapturing(false);
          return;
        }

        const fileName = step === 'frontal' ? 'ine_frontal.jpg' : 'ine_posterior.jpg';
        const file = new File([blob], fileName, { type: 'image/jpeg' });

        if (step === 'frontal') {
          setFrontalImage(file);
          setCurrentStep('posterior');
        } else if (step === 'posterior') {
          setPosteriorImage(file);
          setCurrentStep('preview');
        }

        setIsCapturing(false);
        // El efecto de cámara detiene/reinicia el stream al cambiar currentStep
      },
      'image/jpeg',
      INE_CAPTURE_JPEG_QUALITY
    );
  }, [imageQuality]);

  const autoCaptureEnabled =
    privacyAccepted &&
    (currentStep === 'frontal' || currentStep === 'posterior') &&
    !isLoading &&
    !error &&
    !isCapturing;

  const { stableCount } = useIneAutoCapture({
    enabled: autoCaptureEnabled,
    quality: imageQuality,
    onAutoCapture: captureImage,
    mutex: mutexRef.current,
  });

  const retakeImage = (type: 'frontal' | 'posterior') => {
    mutexRef.current.unlock();
    setIsCapturing(false);
    if (type === 'frontal') {
      setFrontalImage(null);
      setCurrentStep('frontal');
    } else {
      setPosteriorImage(null);
      setCurrentStep('posterior');
    }
  };

  const handleComplete = () => {
    if (frontalImage && posteriorImage) {
      onImagesCaptured({
        frontal: frontalImage,
        posterior: posteriorImage,
      });
    }
  };

  const qualityOk = isIneCaptureReady(imageQuality);

  const renderCameraView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {currentStep === 'frontal' ? 'Capturar INE - Lado Frontal' : 'Capturar INE - Lado Posterior'}
        </h3>
        <p className="text-gray-600">
          Mantén el INE estable dentro del marco — la foto se toma sola
        </p>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden max-w-md mx-auto">
        {error ? (
          <div className="p-8 text-center text-white">
            <p className="mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <video ref={videoRef} className="w-full h-auto" playsInline muted />

            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-4">
                <div className="absolute inset-0 border-2 border-white rounded-lg">
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-l-4 border-t-4 border-blue-400" />
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-r-4 border-t-4 border-blue-400" />
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-l-4 border-b-4 border-blue-400" />
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-r-4 border-b-4 border-blue-400" />
                </div>
                <div className="absolute inset-6 border border-white border-dashed rounded opacity-60">
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded-full whitespace-nowrap">
                    Coloca el INE aquí
                  </div>
                </div>
              </div>

              <div className="absolute top-4 right-4 space-y-2">
                {imageQuality.isBlurred && (
                  <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full">Borroso</div>
                )}
                {imageQuality.isTooDark && (
                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                    Muy oscuro
                  </div>
                )}
                {imageQuality.isTooBright && (
                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                    Muy brillante
                  </div>
                )}
                {imageQuality.isTilted && (
                  <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full">
                    Inclinado
                  </div>
                )}
                {qualityOk && !isCapturing && (
                  <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                    {stableCount > 0
                      ? `Estable ${stableCount}/${INE_AUTO_CAPTURE_STABLE_TICKS}`
                      : 'Imagen buena'}
                  </div>
                )}
                {isCapturing && (
                  <div className="bg-blue-500 text-white text-xs px-2 py-1 rounded-full">
                    Capturando…
                  </div>
                )}
              </div>

              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black bg-opacity-70 text-white text-xs p-3 rounded-lg">
                  No toques la pantalla: al estabilizar el ángulo se captura automáticamente.
                  Puedes usar Capturar solo si el auto no dispara.
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-4 justify-center">
        <Button onClick={onCancel} variant="secondary">
          Cancelar
        </Button>
        <Button
          onClick={() => {
            if (!mutexRef.current.tryLock()) return;
            captureImage();
          }}
          disabled={
            isLoading || !!error || isCapturing || !qualityOk
          }
          className="min-w-[120px]"
        >
          Capturar
        </Button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Verificar Imágenes del INE</h3>
        <p className="text-gray-600">Revisa que ambas imágenes sean legibles antes de continuar</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 text-center">INE - Frontal</h4>
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/3]">
            {frontalPreviewUrl && (
              <img
                src={frontalPreviewUrl}
                alt="INE Frontal"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <Button onClick={() => retakeImage('frontal')} variant="secondary" className="w-full">
            Volver a tomar
          </Button>
        </div>

        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 text-center">INE - Posterior</h4>
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/3]">
            {posteriorPreviewUrl && (
              <img
                src={posteriorPreviewUrl}
                alt="INE Posterior"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <Button onClick={() => retakeImage('posterior')} variant="secondary" className="w-full">
            Volver a tomar
          </Button>
        </div>
      </div>

      <div className="flex gap-4 justify-center">
        <Button onClick={onCancel} variant="secondary">
          Cancelar
        </Button>
        <Button
          onClick={handleComplete}
          disabled={!frontalImage || !posteriorImage}
          className="min-w-[140px]"
        >
          Continuar con OCR
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <PrivacyConsentModal
        isOpen={!privacyAccepted}
        onAccept={() => setPrivacyAccepted(true)}
        onCancel={onCancel}
      />

      {privacyAccepted && (
        <div className="max-w-4xl mx-auto p-6">
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={analysisCanvasRef} className="hidden" />
          {currentStep !== 'preview' ? renderCameraView() : renderPreview()}
        </div>
      )}
    </>
  );
};

export default INECapture;
