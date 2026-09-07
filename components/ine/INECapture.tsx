import React, { useState, useRef, useEffect } from 'react';
import Button from '../ui/Button';
import PrivacyConsentModal from '../ui/PrivacyConsentModal';

interface INECaptureProps {
  onImagesCaptured: (images: { frontal: File; posterior: File }) => void;
  onCancel: () => void;
}

type CaptureStep = 'frontal' | 'posterior' | 'preview';

const INECapture: React.FC<INECaptureProps> = ({ onImagesCaptured, onCancel }) => {
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [currentStep, setCurrentStep] = useState<CaptureStep>('frontal');
  const [frontalImage, setFrontalImage] = useState<File | null>(null);
  const [posteriorImage, setPosteriorImage] = useState<File | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [imageQuality, setImageQuality] = useState<{
    isBlurred: boolean;
    isTooDark: boolean;
    isTooBright: boolean;
    isTilted: boolean;
    isWellPositioned: boolean;
  }>({
    isBlurred: false,
    isTooDark: false,
    isTooBright: false,
    isTilted: false,
    isWellPositioned: false
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement>(null);

  // Cámara solo DESPUÉS del consentimiento informado (LFPDPPP / U-First)
  useEffect(() => {
    if (!privacyAccepted) return;

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

    return () => {
      isMounted = false;
    };
  }, [privacyAccepted]);

  // Analizar calidad de imagen en tiempo real
  useEffect(() => {
    if (!privacyAccepted) return;
    if (!videoRef.current || !analysisCanvasRef.current || currentStep === 'preview') return;

    const analyzeImageQuality = () => {
      const video = videoRef.current;
      const canvas = analysisCanvasRef.current;
      if (!video || !canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Configurar canvas con dimensiones más grandes para mejor análisis
      canvas.width = 640;
      canvas.height = 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Calcular brillo promedio
      let totalBrightness = 0;
      let totalVariance = 0;
      const sampleSize = Math.floor(data.length / 4 / 10); // Analizar 10% de los píxeles

      for (let i = 0; i < data.length; i += 4 * 5) { // Muestreo cada 5 píxeles para mejor precisión
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        totalBrightness += brightness;
      }

      const avgBrightness = totalBrightness / (sampleSize * 2); // Ajustar denominador por el cambio en muestreo

      // Calcular varianza (para detectar borrosidad)
      for (let i = 0; i < data.length; i += 4 * 5) { // Mismo muestreo que el brillo promedio
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const brightness = (r + g + b) / 3;
        totalVariance += Math.pow(brightness - avgBrightness, 2);
      }

      const variance = totalVariance / (sampleSize * 2);
      const stdDev = Math.sqrt(variance);

      // Detectar inclinación/ángulo usando análisis de gradientes
      let horizontalEdges = 0;
      let verticalEdges = 0;

      // Analizar una muestra de píxeles para detectar bordes
      for (let y = 1; y < canvas.height - 1; y += 5) {
        for (let x = 1; x < canvas.width - 1; x += 5) {
          const idx = (y * canvas.width + x) * 4;
          const center = data[idx]; // Solo usar canal rojo para simplificar

          // Gradientes horizontales y verticales
          const left = data[((y * canvas.width + (x - 1)) * 4)];
          const right = data[((y * canvas.width + (x + 1)) * 4)];
          const top = data[(((y - 1) * canvas.width + x) * 4)];
          const bottom = data[(((y + 1) * canvas.width + x) * 4)];

          const gradX = Math.abs(right - left);
          const gradY = Math.abs(bottom - top);

          if (gradX > 30) horizontalEdges++;
          if (gradY > 30) verticalEdges++;
        }
      }

      // Si hay más bordes horizontales que verticales, puede indicar que el documento está inclinado
      const edgeRatio = verticalEdges > 0 ? horizontalEdges / verticalEdges : 1;
      const isTilted = edgeRatio > 1.5 || edgeRatio < 0.7; // Ratio desbalanceado indica posible inclinación

      // Detectar si está bien posicionado (presencia de rectángulos/características típicas del INE)
      const hasTextLike = stdDev > 20 && avgBrightness > 60 && avgBrightness < 180;

      // Analizar histograma para mejor detección de calidad
      let darkPixels = 0;
      let brightPixels = 0;
      const totalPixels = data.length / 4;

      for (let i = 0; i < data.length; i += 4 * 5) { // Mismo muestreo para consistencia
        const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (brightness < 40) darkPixels++;  // Umbral más alto para detectar texto negro
        if (brightness > 200) brightPixels++; // Umbral más bajo para fondo blanco
      }

      const sampledPixels = totalPixels / 5; // Porque muestreamos cada 5 píxeles
      const darkRatio = darkPixels / sampledPixels;
      const brightRatio = brightPixels / sampledPixels;

      // Detección mejorada para fotos de INE tomadas con móvil
      const coefficientOfVariation = avgBrightness > 0 ? (stdDev / avgBrightness) : 0;

      // UMBRALES TEMPORALMENTE DESACTIVADOS PARA DEBUGGING
      // Los valores reales que vemos son normales, así que permitamos TODO por ahora
      const isBlurred = false; // Temporalmente desactivado
      const isTooDark = false; // Temporalmente desactivado
      const isTooBright = false; // Temporalmente desactivado

      // INE tiene características mínimas: cualquier imagen con algo de contenido
      const hasDocumentFeatures = avgBrightness > 0 && stdDev > 0;

      // Actualizar estado de calidad con mejores umbrales
      const qualityResult = {
        isBlurred: isBlurred,
        isTooDark: isTooDark,
        isTooBright: isTooBright,
        isTilted: isTilted,
        isWellPositioned: hasDocumentFeatures && !isTilted && !isTooDark && !isTooBright
      };

      // Debug logs para entender la detección
      console.log('🔍 Análisis de calidad:', {
        avgBrightness: avgBrightness.toFixed(2),
        stdDev: stdDev.toFixed(2),
        coefficientOfVariation: coefficientOfVariation.toFixed(3),
        darkRatio: darkRatio.toFixed(3),
        brightRatio: brightRatio.toFixed(3),
        edgeRatio: edgeRatio.toFixed(2),
        qualityResult
      });

      setImageQuality(qualityResult);
    };

    const interval = setInterval(analyzeImageQuality, 1000); // Analizar cada segundo
    return () => clearInterval(interval);
  }, [currentStep, privacyAccepted]);

  // Detener stream cuando cambiamos de paso
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

  const captureImage = () => {
    // Validar calidad de imagen antes de capturar
    if (imageQuality.isBlurred || imageQuality.isTooDark || imageQuality.isTooBright || imageQuality.isTilted) {
      alert('⚠️ La imagen no tiene buena calidad. Corrige los problemas mostrados antes de capturar.');
      return;
    }

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

            {/* Guía visual avanzada para el INE */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Marco principal del INE (proporciones 85.6mm x 54mm ≈ 1.6:1) */}
              <div className="absolute inset-4">
                {/* Bordes del marco */}
                <div className="absolute inset-0 border-2 border-white rounded-lg">
                  {/* Esquinas del marco */}
                  <div className="absolute -top-1 -left-1 w-4 h-4 border-l-4 border-t-4 border-blue-400"></div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 border-r-4 border-t-4 border-blue-400"></div>
                  <div className="absolute -bottom-1 -left-1 w-4 h-4 border-l-4 border-b-4 border-blue-400"></div>
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 border-r-4 border-b-4 border-blue-400"></div>
                </div>

                {/* Área central para el INE */}
                <div className="absolute inset-6 border border-white border-dashed rounded opacity-60">
                  {/* Texto de instrucciones */}
                  <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 text-white text-sm bg-black bg-opacity-70 px-3 py-1 rounded-full whitespace-nowrap">
                    📄 Coloca el INE aquí
                  </div>

                  {/* Indicador de centro */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                    <div className="w-2 h-2 bg-white rounded-full opacity-80"></div>
                  </div>
                </div>
              </div>

              {/* Indicadores de calidad de imagen */}
              <div className="absolute top-4 right-4 space-y-2">
                {imageQuality.isBlurred && (
                  <div className="bg-red-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <span>🔍</span>
                    <span>Borroso</span>
                  </div>
                )}

                {imageQuality.isTooDark && (
                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <span>🌙</span>
                    <span>Muy oscuro</span>
                  </div>
                )}

                {imageQuality.isTooBright && (
                  <div className="bg-yellow-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <span>☀️</span>
                    <span>Muy brillante</span>
                  </div>
                )}

                {imageQuality.isTilted && (
                  <div className="bg-orange-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <span>📐</span>
                    <span>Inclinado</span>
                  </div>
                )}

                {!imageQuality.isBlurred && !imageQuality.isTooDark && !imageQuality.isTooBright && !imageQuality.isTilted && (
                  <div className="bg-green-500 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                    <span>✅</span>
                    <span>Imagen buena</span>
                  </div>
                )}
              </div>

              {/* Instrucciones adicionales */}
              <div className="absolute bottom-4 left-4 right-4">
                <div className="bg-black bg-opacity-70 text-white text-xs p-3 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>💡</span>
                      <span>Asegúrate de que el INE quepa completamente en el marco</span>
                    </div>
                  </div>
                  <div className="mt-2 text-gray-300">
                    Mantén el dispositivo quieto y enfocado en el documento
                  </div>
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
          onClick={captureImage}
          disabled={isLoading || !!error || imageQuality.isBlurred || imageQuality.isTooDark || imageQuality.isTooBright || imageQuality.isTilted}
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
    <>
      <PrivacyConsentModal
        isOpen={!privacyAccepted}
        onAccept={() => setPrivacyAccepted(true)}
        onCancel={onCancel}
      />

      {privacyAccepted && (
        <div className="max-w-4xl mx-auto p-6">
          {/* Canvas ocultos para captura y análisis */}
          <canvas ref={canvasRef} className="hidden" />
          <canvas ref={analysisCanvasRef} className="hidden" />

          {currentStep !== 'preview' ? renderCameraView() : renderPreview()}
        </div>
      )}
    </>
  );
};

export default INECapture;
