import React, { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';

interface INECaptureProps {
  onImagesCaptured: (images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type CaptureStep = 'frontal' | 'posterior' | 'preview';

const INECapture: React.FC<INECaptureProps> = ({ onImagesCaptured, onCancel }) => {
  const [currentStep, setCurrentStep] = useState<CaptureStep>('frontal');
  const [frontalImage, setFrontalImage] = useState<File | null>(null);
  const [posteriorImage, setPosteriorImage] = useState<File | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Acceder a la cámara cuando el componente se monta
  useEffect(() => {
    let isMounted = true;

    const startCamera = async () => {
      try {
        setIsLoading(true);
        setError('');

        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'environment', // Usar cámara trasera
            width: { ideal: 1920 },
            height: { ideal: 1080 }
          }
        });

        // Solo actualizar el estado si el componente sigue montado
        if (isMounted) {
          setStream(mediaStream);

          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            // Usar una promesa para manejar el play()
            try {
              await videoRef.current.play();
            } catch (playError) {
              console.warn('Error playing video:', playError);
              // Intentar play() nuevamente después de un breve delay
              setTimeout(() => {
                if (videoRef.current && isMounted) {
                  videoRef.current.play().catch(console.warn);
                }
              }, 100);
            }
          }
        }
      } catch (err) {
        console.error('Error accessing camera:', err);
        if (isMounted) {
          setError('No se pudo acceder a la cámara. Asegúrate de dar permisos.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    startCamera();

    // Limpiar stream cuando el componente se desmonta
    return () => {
      isMounted = false;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // Detener stream cuando cambiamos de paso
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const captureImage = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Configurar canvas con las dimensiones del video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Dibujar el frame actual del video en el canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convertir a blob y crear archivo
    canvas.toBlob((blob) => {
      if (blob) {
        const fileName = currentStep === 'frontal' ? 'ine_frontal.jpg' : 'ine_posterior.jpg';
        const file = new File([blob], fileName, { type: 'image/jpeg' });

        if (currentStep === 'frontal') {
          setFrontalImage(file);
          setCurrentStep('posterior');
        } else if (currentStep === 'posterior') {
          setPosteriorImage(file);
          setCurrentStep('preview');
        }

        // Detener la cámara después de capturar
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }
    }, 'image/jpeg', 0.9);
  };

  const retakeImage = (type: 'frontal' | 'posterior') => {
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
        posterior: posteriorImage
      });
    }
  };

  const renderCameraView = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          {currentStep === 'frontal' ? 'Capturar INE - Lado Frontal' : 'Capturar INE - Lado Posterior'}
        </h3>
        <p className="text-gray-600">
          {currentStep === 'frontal'
            ? 'Coloca el frente del INE dentro del marco y presiona "Capturar"'
            : 'Ahora gira el INE y captura el lado posterior'
          }
        </p>
      </div>

      <div className="relative bg-black rounded-lg overflow-hidden max-w-md mx-auto">
        {error ? (
          <div className="p-8 text-center text-white">
            <div className="text-red-400 mb-4">⚠️</div>
            <p>{error}</p>
            <Button onClick={() => window.location.reload()} className="mt-4">
              Reintentar
            </Button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-auto"
              playsInline
              muted
            />
            {/* Guía visual para el INE */}
            <div className="absolute inset-4 border-2 border-white border-dashed rounded-lg pointer-events-none">
              <div className="absolute top-2 left-2 text-white text-sm bg-black bg-opacity-50 px-2 py-1 rounded">
                Centra el INE aquí
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
          onClick={captureImage}
          disabled={isLoading || !!error}
          className="min-w-[120px]"
        >
          📸 Capturar
        </Button>
      </div>
    </div>
  );

  const renderPreview = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Verificar Imágenes del INE
        </h3>
        <p className="text-gray-600">
          Revisa que ambas imágenes sean legibles antes de continuar
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Imagen frontal */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 text-center">INE - Frontal</h4>
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/3]">
            {frontalImage && (
              <img
                src={URL.createObjectURL(frontalImage)}
                alt="INE Frontal"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <Button
            onClick={() => retakeImage('frontal')}
            variant="secondary"
            className="w-full"
          >
            ↻ Volver a tomar
          </Button>
        </div>

        {/* Imagen posterior */}
        <div className="space-y-3">
          <h4 className="font-medium text-gray-900 text-center">INE - Posterior</h4>
          <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-[4/3]">
            {posteriorImage && (
              <img
                src={URL.createObjectURL(posteriorImage)}
                alt="INE Posterior"
                className="w-full h-full object-cover"
              />
            )}
          </div>
          <Button
            onClick={() => retakeImage('posterior')}
            variant="secondary"
            className="w-full"
          >
            ↻ Volver a tomar
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
          ✅ Continuar con OCR
        </Button>
      </div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Canvas oculto para captura */}
      <canvas ref={canvasRef} className="hidden" />

      {currentStep !== 'preview' ? renderCameraView() : renderPreview()}
    </div>
  );
};

export default INECapture;
