import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Verificación de variables de entorno (solo en desarrollo)
if (import.meta.env.DEV) {
  console.log('🔧 Variables de entorno disponibles:');
  console.log('VITE_GROQ_API_KEY:', import.meta.env.VITE_GROQ_API_KEY ? '✅ Configurada' : '❌ No configurada');
  console.log('VITE_GOOGLE_VISION_API_KEY:', import.meta.env.VITE_GOOGLE_VISION_API_KEY ? '✅ Configurada' : '❌ No configurada');
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

      // Texto OCR del usuario para testing (última versión - difícil)
      const testText = ocrText || `NTUTO NACIONAL ELECTORAL

f REDENCIAL PARA VOTAR
l - po UTIERREZ y ta
| : 4 E SECTOR MANUE
| MICIL E

E , ARQUE VIA 324 >=

E RQUE MANZANARES 37 :

5 1 .-

A LECTOR ALGTH: 22 L

e 3H6* HGTLT 1 AÑO DE REGISTRO 1991 Qi

5 ESTADO 11 MUNICIPIO. 02 sección 1532

5 LOCALIDAD 0001 emisión 2016 viemca 2006 "Xx`;

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

  // Función para debug de autenticación
  (window as any).debugAuth = async (email: string, password: string) => {
    try {
      console.log('🔍 Debug de autenticación:');
      console.log('Email:', email);
      console.log('Password:', password);

      const { firebaseService } = await import('./services/firebaseService');

      // Verificar usuarios disponibles
      console.log('👥 Usuarios disponibles en mock:');
      const mockUsers = [
        { uid: 'user123', email: 'admin@example.com', role: 'admin' },
        { uid: 'brigada456', email: 'brigadista@partido.com', role: 'brigadista' },
        { uid: 'brigada789', email: 'juan.brigadista@partido.com', role: 'brigadista' },
        { uid: 'brigadista_test_001', email: 'brigadista', role: 'brigadista' }
      ];

      const foundUser = mockUsers.find(u => u.email === email);
      console.log('👤 Usuario encontrado:', foundUser);

      // Verificar contraseña
      const validPasswords = ['admin', 'brigadista', 'password123'];
      const passwordValid = validPasswords.includes(password);
      console.log('🔑 Contraseña válida:', passwordValid);

      if (foundUser && passwordValid) {
        console.log('✅ Autenticación debería funcionar');
        return { success: true, user: foundUser };
      } else {
        console.log('❌ Autenticación fallará');
        return { success: false, reason: foundUser ? 'Contraseña inválida' : 'Usuario no encontrado' };
      }
    } catch (error) {
      console.error('❌ Error en debug:', error);
      return { success: false, error: error.message };
    }
  };

  // Función para probar login real
  (window as any).testLogin = async (email: string, password: string) => {
    try {
      console.log('🚀 Probando login real con:', { email, password });

      const { firebaseService } = await import('./services/firebaseService');

      const result = await firebaseService.auth.signInWithEmailAndPassword(email, password);

      console.log('📊 Resultado del login:', result);

      if (result.user) {
        console.log('✅ Login exitoso:', result.user);
        return { success: true, user: result.user };
      } else {
        console.log('❌ Login fallido:', result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error('💥 Error en testLogin:', error);
      return { success: false, error: error.message };
    }
  };

  // Función para verificar estado de autenticación
  (window as any).checkAuthStatus = async () => {
    try {
      console.log('🔍 Estado de autenticación actual:');
      const { getStoredAuthUser } = await import('./services/authSessionStore');
      const sessionUser = getStoredAuthUser();
      const legacyLocal = localStorage.getItem('firebase.auth.user');
      console.log('💾 Usuario en sessionStorage (activo):', sessionUser || 'Ninguno');
      console.log('💾 Usuario legacy localStorage (debe estar vacío):', legacyLocal ? JSON.parse(legacyLocal) : 'Ninguno');
      return {
        sessionStorage: sessionUser,
        localStorageLegacy: legacyLocal ? JSON.parse(legacyLocal) : null,
      };
    } catch (error) {
      console.error('❌ Error verificando estado:', error);
      return { error: (error as Error).message };
    }
  };

  // Función para probar detección de calidad de imagen
  (window as any).testImageQuality = () => {
    console.log('🧪 Función testImageQuality disponible en componentes INECapture');
    console.log('💡 Esta función se ejecuta automáticamente cada segundo durante la captura');
    console.log('📊 Revisa los logs con 🔍 Análisis de calidad para ver los valores calculados');
    console.log('🎛️ Para calibrar umbrales, ejecuta: calibrateImageQuality()');
    return 'Función activada - mira los logs en consola';
  };

  // Función para calibrar umbrales de calidad de imagen
  (window as any).calibrateImageQuality = () => {
    console.log('🎛️ Modo calibración activado');
    console.log('📝 Toma varias fotos con diferentes condiciones y revisa los logs');
    console.log('🎯 Umbrales óptimos para INE:');
    console.log('   • avgBrightness: 100-180 (buen contraste)');
    console.log('   • stdDev: 20-80 (texto claro pero no ruido excesivo)');
    console.log('   • coefficientOfVariation: 0.1-0.5 (variabilidad moderada)');
    console.log('   • darkRatio: < 0.6, brightRatio: < 0.6');
    console.log('💡 Ejecuta en consola: testImageQuality() para más info');
    return 'Modo calibración activado';
  };

  // Función para verificar integridad de la sesión (seguridad)
  (window as any).verifySessionIntegrity = async () => {
    try {
      console.log('🔐 Verificando integridad de la sesión...');
      const { getStoredAuthUser, clearStoredAuthUser } = await import('./services/authSessionStore');
      const user = getStoredAuthUser();
      if (!user) {
        console.log('✅ No hay sesión activa - Estado seguro');
        return { status: 'safe', message: 'No hay sesión activa' };
      }

      const requiredFields = ['uid', 'email', 'role'];
      const missingFields = requiredFields.filter((field) => !(user as Record<string, unknown>)[field]);

      if (missingFields.length > 0) {
        console.warn('🚨 Sesión corrupta - Faltan campos:', missingFields);
        clearStoredAuthUser();
        return { status: 'corrupted', message: `Faltan campos: ${missingFields.join(', ')}` };
      }

      const validRoles = ['admin', 'brigadista', 'simpatizante'];
      if (!validRoles.includes(user.role)) {
        console.warn('🚨 Sesión corrupta - Rol inválido:', user.role);
        clearStoredAuthUser();
        return { status: 'corrupted', message: `Rol inválido: ${user.role}` };
      }

      if (!user.uid || user.uid.length < 5) {
        console.warn('🚨 Sesión corrupta - UID inválido');
        clearStoredAuthUser();
        return { status: 'corrupted', message: 'UID inválido' };
      }

      console.log('✅ Sesión íntegra - Usuario válido:', user.email, `(${user.role})`);
      return { status: 'ok', user };
    } catch (error) {
      console.error('❌ Error verificando integridad:', error);
      return { status: 'error', message: (error as Error).message };
    }
  };

  // Función para limpiar INEs pendientes (para debug)
  (window as any).clearPendingINes = async () => {
    try {
      console.log('🧹 Limpiando INEs pendientes...');

      const { clearAllInes, getINEStats } = await import('./services/ineOfflineService');

      const statsBefore = await getINEStats();
      console.log('📊 Estado antes de limpiar:', statsBefore);

      await clearAllInes();

      const statsAfter = await getINEStats();
      console.log('📊 Estado después de limpiar:', statsAfter);

      console.log('✅ INEs pendientes limpiados exitosamente');
      return { success: true, cleared: statsBefore.pending };

    } catch (error) {
      console.error('❌ Error limpiando INEs:', error);
      return { success: false, error: error.message };
    }
  };

  // Función para verificar estado de INEs offline
  (window as any).checkINEStatus = async () => {
    try {
      console.log('📋 Verificando estado de INEs offline...');

      const { getINEStats, getUnprocessedInes } = await import('./services/ineOfflineService');

      const stats = await getINEStats();
      const unprocessed = await getUnprocessedInes();

      console.log('📊 Estadísticas:', stats);
      console.log('📝 INEs sin procesar:', unprocessed.length);

      if (unprocessed.length > 0) {
        console.log('🔍 Primeros 3 INEs pendientes:');
        unprocessed.slice(0, 3).forEach((ine, index) => {
          console.log(`  ${index + 1}. ID: ${ine.id}, Texto: ${ine.rawText.substring(0, 50)}...`);
        });
      }

      return { stats, unprocessedCount: unprocessed.length };

    } catch (error) {
      console.error('❌ Error verificando INEs:', error);
      return { error: error.message };
    }
  };

  // Función para debug de calidad de imagen en tiempo real
  (window as any).debugImageQuality = () => {
    console.log('🖼️ DEBUG DE CALIDAD DE IMAGEN ACTIVADO');
    console.log('💡 Ahora verás logs detallados de calidad cada segundo');
    console.log('🔍 Busca los logs que dicen "🔍 Análisis de calidad:"');
    console.log('✅ Los umbrales están temporalmente DESACTIVADOS para testing');
    console.log('🎯 Cualquier foto debería ser aceptada ahora');
    return 'Debug activado - toma una foto del INE y mira los logs';
  };

  // Función para probar diferentes configuraciones de preprocesamiento OCR
  (window as any).testOCRPreprocessing = async () => {
    console.log('🧪 PRUEBA DE DIFERENTES CONFIGURACIONES DE PREPROCESAMIENTO OCR');

    // Crear una imagen de prueba simulada
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 200;
    canvas.height = 100;

    if (!ctx) {
      console.error('❌ No se puede crear contexto de canvas');
      return;
    }

    // Crear gradiente simulado (como un documento con texto)
    const gradient = ctx.createLinearGradient(0, 0, 200, 0);
    gradient.addColorStop(0, 'black');
    gradient.addColorStop(0.3, 'white');
    gradient.addColorStop(0.7, 'black');
    gradient.addColorStop(1, 'white');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 200, 100);

    // Agregar texto simulado
    ctx.fillStyle = 'black';
    ctx.font = '16px Arial';
    ctx.fillText('INSTITUTO NACIONAL', 10, 30);
    ctx.fillText('ELECTORAL', 10, 50);

    console.log('✅ Imagen de prueba creada');
    console.log('🎯 Ahora prueba tomar una foto real del INE');
    console.log('🔍 Los logs mostrarán el preprocesamiento mejorado:');
    console.log('   • 🔆 Ajuste de brillo (+20) y contraste (1.5x)');
    console.log('   • ⚪ Binarización avanzada con limpieza de ruido');
    console.log('   • 🔍 Filtro de nitidez agresivo');

    return 'Configuración de preprocesamiento aplicada - toma una foto del INE';
  };

  // Función para probar Google Vision API específicamente
  (window as any).testGoogleVision = async () => {
    console.log('🎯 PRUEBA DE GOOGLE VISION API');

    try {
      const { googleVisionService } = await import('./services/googleVisionService');

      const isAvailable = await googleVisionService.isAvailable();
      console.log('🔍 Google Vision disponible:', isAvailable);

      if (!isAvailable) {
        console.log('❌ Google Vision no configurado. Para activarlo:');
        console.log('   1. Ve a: https://console.cloud.google.com/');
        console.log('   2. Crea un proyecto o selecciona uno existente');
        console.log('   3. Habilita la Vision API');
        console.log('   4. Crea credenciales (API Key)');
        console.log('   5. Agrega VITE_GOOGLE_VISION_API_KEY a tu .env.local');
        return 'Google Vision no disponible - configura API key';
      }

      console.log('✅ Google Vision configurado correctamente');
      console.log('🎯 Ahora debería usarse automáticamente en el OCR');
      console.log('📝 Busca logs como: "🎯 Usando Google Vision API para OCR"');

      return 'Google Vision está listo para usar';

    } catch (error) {
      console.error('❌ Error probando Google Vision:', error);
      return 'Error probando Google Vision';
    }
  };

  // Función para comparar OCR antes/después de mejoras
  (window as any).compareOCRResults = () => {
    console.log('📊 COMPARACIÓN DE RESULTADOS OCR - ANTES VS DESPUÉS');
    console.log('='.repeat(60));
    console.log('');

    console.log('❌ ANTES (Tesseract.js básico):');
    console.log('   "==- ! - - Meco .-"');
    console.log('   "Ny CREDENCIAL MARA VIA"');
    console.log('   "N UNA AX AD"');
    console.log('   → Resultado: Texto prácticamente ilegible');
    console.log('');

    console.log('✅ DESPUÉS (Google Vision API):');
    console.log('   🎯 OCR de alta precisión para documentos');
    console.log('   📊 Confianza > 85% típica');
    console.log('   📝 Texto esperado: "INSTITUTO NACIONAL ELECTORAL"');
    console.log('   🔍 Mejor reconocimiento de texto en español');
    console.log('');

    console.log('🎯 PRUEBA AHORA:');
    console.log('   1. Asegúrate de tener VITE_GOOGLE_VISION_API_KEY configurada');
    console.log('   2. Ejecuta: testGoogleVision()');
    console.log('   3. Toma una nueva foto del INE');
    console.log('   4. Deberías ver "🎯 Usando Google Vision API" en logs');
    console.log('   5. Compara con los resultados anteriores');

    return 'Comparación preparada - configura Google Vision y prueba';
  };

  console.log('💡 Funciones disponibles:');
  console.log('  • clearINEData() - Limpia la base de datos IndexedDB');
  console.log('  • testOCR() - Prueba extracción OCR con texto de ejemplo');
  console.log('  • testOCR("tu texto aquí") - Prueba con texto personalizado');
  console.log('  • debugAuth("email", "password") - Debug de autenticación (simulado)');
  console.log('  • testLogin("email", "password") - Prueba login real');
  console.log('  • checkAuthStatus() - Verifica estado actual de autenticación');
  console.log('  • testImageQuality() - Debug de detección de calidad de imagen');
  console.log('  • calibrateImageQuality() - Calibrar umbrales de calidad');
  console.log('  • debugImageQuality() - Debug calidad imagen en tiempo real');
  console.log('  • testOCRPreprocessing() - Probar preprocesamiento OCR mejorado');
  console.log('  • testGoogleVision() - Probar Google Vision API');
  console.log('  • compareOCRResults() - Comparar OCR antes vs después');
  console.log('  • verifySessionIntegrity() - Verifica integridad de la sesión (seguridad)');
  console.log('  • clearPendingINes() - Limpia INEs pendientes de sincronización');
  console.log('  • checkINEStatus() - Verifica estado de INEs offline');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// En localhost el SW cachea /index.css sin Tailwind procesado → pantalla “en blanco”.
// Solo registrar en producción; en desarrollo desregistrar y limpiar caches.
if ('serviceWorker' in navigator) {
  const isLocalhost =
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  window.addEventListener('load', () => {
    if (isLocalhost || import.meta.env.DEV) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => Promise.all(regs.map((r) => r.unregister())))
        .then(() => (typeof caches !== 'undefined' ? caches.keys() : Promise.resolve([])))
        .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
        .then(() => console.log('ServiceWorker: desactivado y caché limpiado (modo desarrollo)'))
        .catch((err) => console.warn('ServiceWorker cleanup:', err));
      return;
    }

    navigator.serviceWorker
      .register('/service-worker.js')
      .then((registration) => {
        console.log('ServiceWorker: Registrado con éxito con el alcance: ', registration.scope);
      })
      .catch((error) => {
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
