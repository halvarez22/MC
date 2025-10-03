import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Verificación de variables de entorno (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('🔧 Variables de entorno disponibles:');
  console.log('VITE_GROQ_API_KEY:', import.meta.env.VITE_GROQ_API_KEY ? '✅ Configurada' : '❌ No configurada');
  console.log('VITE_EMAIL_API_KEY:', import.meta.env.VITE_EMAIL_API_KEY ? '✅ Configurada' : '❌ No configurada');
  console.log('VITE_EMAIL_API_URL:', import.meta.env.VITE_EMAIL_API_URL || 'No configurada');

  // Función de utilidad para limpiar IndexedDB (ejecutar desde consola: clearINEData())
  (window as any).clearINEData = async () => {
    try {
      const { clearAllInes } = await import('./services/ineOfflineService');
      await clearAllInes();
      console.log('🗑️ Base de datos INE limpiada exitosamente');
      return '✅ Base de datos limpiada';
    } catch (error) {
      console.error('❌ Error limpiando base de datos:', error);
      return '❌ Error limpiando base de datos';
    }
  };

  // Función para probar extracción OCR con texto específico
  (window as any).testOCR = async (ocrText?: string) => {
    try {
      const { groqService } = await import('./services/groqService');

      // Texto OCR del usuario para testing (última versión)
      const testText = ocrText || `e us
INSTITUTO NACIONAL ELE *
em —— CREDENCIAL PARA VOTAR
LE -
É NONIBRLE "Ea CE NACMNENTI:
—- "ALVAREZ 2209/1965
-  — a GUTIERREZ seo H
| HECTOR MANUEL : y
- , A DOMICILIO
Vf - PARQUE VIA 324
Y * PARQUE MANZANARES 37510
1 - LE TO >
| A LECTOR ALGTHC8509221 1100 LA
, AGH650922+G TL TODA ANO DE REGSTRO 1991 0
: estaDo 11 MUNICIPIO 020 sección 1539
: LOCALIDAD 0001 — masón 2016 wemna 2096 a»`;

      console.log('🧪 Probando extracción OCR con texto:');
      console.log(testText);

      const result = await groqService.processINEText(testText);
      console.log('📊 Resultados de extracción:', result);
      return result;
    } catch (error) {
      console.error('❌ Error probando OCR:', error);
      return null;
    }
  };

  console.log('💡 Funciones disponibles:');
  console.log('  • clearINEData() - Limpia la base de datos IndexedDB');
  console.log('  • testOCR() - Prueba extracción OCR con texto de ejemplo');
  console.log('  • testOCR("tu texto aquí") - Prueba con texto personalizado');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker: Registrado con éxito con el alcance: ', registration.scope);
      })
      .catch(error => {
        console.log('ServiceWorker: Fallo en el registro: ', error);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
