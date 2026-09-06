/**
 * Servicio de preprocesamiento de imagen para OCR (Canvas / Otsu).
 * Extraído de INEProcessor — Anti-God-Component (Regla 3) + Zero Trust (Regla 5).
 */

export const IMAGE_PREPROCESS_CONFIG = {
  brightness: 20,
  contrast: 1.5,
  jpegQuality: 0.95,
  otsuOffset: 20,
  minThreshold: 90,
  fallbackThreshold: 110,
  noiseNeighborMin: 3,
  otsuClampMin: 50,
  otsuClampMax: 200,
} as const;

export type ImagePreprocessConfig = typeof IMAGE_PREPROCESS_CONFIG;

/** Umbral óptimo Otsu sobre histograma 0–255. */
export const calculateOtsuThreshold = (
  histogram: number[],
  config: Pick<ImagePreprocessConfig, 'otsuClampMin' | 'otsuClampMax'> = IMAGE_PREPROCESS_CONFIG
): number => {
  const total = histogram.reduce((sum, count) => sum + count, 0);
  if (total === 0) return 128;

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let max = 0;
  let threshold = 128;

  for (let i = 1; i < 255; i++) {
    wB += histogram[i];
    if (wB === 0) continue;

    const wF = total - wB;
    if (wF === 0) continue;

    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * Math.pow(mB - mF, 2);

    if (between > max) {
      max = between;
      threshold = i;
    }
  }

  if (max === 0) {
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < 256; i++) {
      weightedSum += i * histogram[i];
      totalWeight += histogram[i];
    }
    threshold = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 128;
  }

  return Math.max(config.otsuClampMin, Math.min(config.otsuClampMax, threshold));
};

/**
 * Preprocesa una imagen para mejorar OCR (brillo, contraste, grises, Otsu, nitidez).
 * Zero Trust: valida File antes de tocar Canvas.
 */
export const preprocessImageForOCR = (
  file: File,
  configOverrides?: Partial<ImagePreprocessConfig>
): Promise<File> => {
  if (!(file instanceof File) || file.size === 0) {
    return Promise.reject(new Error('Archivo inválido'));
  }

  const config = { ...IMAGE_PREPROCESS_CONFIG, ...configOverrides };

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('No se pudo crear contexto de canvas'));
      return;
    }

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const { brightness, contrast } = config;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, data[i] + brightness));
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + brightness));
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + brightness));

        data[i] = Math.min(255, Math.max(0, ((data[i] - 128) * contrast) + 128));
        data[i + 1] = Math.min(255, Math.max(0, ((data[i + 1] - 128) * contrast) + 128));
        data[i + 2] = Math.min(255, Math.max(0, ((data[i + 2] - 128) * contrast) + 128));
      }

      ctx.putImageData(imageData, 0, 0);

      const grayData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const grayPixels = grayData.data;

      for (let i = 0; i < grayPixels.length; i += 4) {
        const gray = Math.round(
          0.299 * grayPixels[i] + 0.587 * grayPixels[i + 1] + 0.114 * grayPixels[i + 2]
        );
        grayPixels[i] = gray;
        grayPixels[i + 1] = gray;
        grayPixels[i + 2] = gray;
      }

      ctx.putImageData(grayData, 0, 0);

      const binaryData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const binaryPixels = binaryData.data;

      const histogram = new Array(256).fill(0);
      for (let i = 0; i < binaryPixels.length; i += 4) {
        histogram[binaryPixels[i]]++;
      }

      let threshold = 128;
      try {
        const otsuThreshold = calculateOtsuThreshold(histogram, config);
        threshold = Math.max(otsuThreshold - config.otsuOffset, config.minThreshold);
      } catch {
        threshold = config.fallbackThreshold;
      }

      for (let i = 0; i < binaryPixels.length; i += 4) {
        const binary = binaryPixels[i] > threshold ? 255 : 0;
        binaryPixels[i] = binary;
        binaryPixels[i + 1] = binary;
        binaryPixels[i + 2] = binary;
      }

      const cleanedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const cleanedPixels = cleanedData.data;

      for (let i = 0; i < cleanedPixels.length; i++) {
        cleanedPixels[i] = binaryPixels[i];
      }

      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          const idx = (y * canvas.width + x) * 4;
          const center = cleanedPixels[idx];

          let sameColorNeighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nIdx = ((y + dy) * canvas.width + (x + dx)) * 4;
              if (cleanedPixels[nIdx] === center) sameColorNeighbors++;
            }
          }

          if (sameColorNeighbors < config.noiseNeighborMin) {
            const newColor = center === 255 ? 0 : 255;
            cleanedPixels[idx] = newColor;
            cleanedPixels[idx + 1] = newColor;
            cleanedPixels[idx + 2] = newColor;
          }
        }
      }

      ctx.putImageData(cleanedData, 0, 0);

      const sharpenedData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const sharpenedPixels = sharpenedData.data;
      const kernel = [
        [-1, -1, -1],
        [-1, 9, -1],
        [-1, -1, -1],
      ];
      const tempData = new Uint8ClampedArray(sharpenedPixels);

      for (let y = 1; y < canvas.height - 1; y++) {
        for (let x = 1; x < canvas.width - 1; x++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelIndex = ((y + ky) * canvas.width + (x + kx)) * 4;
              sum += tempData[pixelIndex] * kernel[ky + 1][kx + 1];
            }
          }

          const pixelIndex = (y * canvas.width + x) * 4;
          const sharpened = Math.min(255, Math.max(0, sum));
          sharpenedPixels[pixelIndex] = sharpened;
          sharpenedPixels[pixelIndex + 1] = sharpened;
          sharpenedPixels[pixelIndex + 2] = sharpened;
        }
      }

      ctx.putImageData(sharpenedData, 0, 0);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], 'processed_ine.jpg', { type: 'image/jpeg' }));
          } else {
            reject(new Error('Error convirtiendo canvas a blob'));
          }
        },
        'image/jpeg',
        config.jpegQuality
      );
    };

    img.onerror = () => reject(new Error('Error cargando imagen'));
    img.src = URL.createObjectURL(file);
  });
};
