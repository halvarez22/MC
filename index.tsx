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
  (window as any).checkAuthStatus = () => {
    try {
      console.log('🔍 Estado de autenticación actual:');

      // Verificar localStorage
      const storedUser = localStorage.getItem('firebase.auth.user');
      console.log('💾 Usuario en localStorage:', storedUser ? JSON.parse(storedUser) : 'Ninguno');

      // Verificar sessionStorage (por si acaso)
      const sessionUser = sessionStorage.getItem('firebase.auth.user');
      console.log('💾 Usuario en sessionStorage:', sessionUser ? JSON.parse(sessionUser) : 'Ninguno');

      return {
        localStorage: storedUser ? JSON.parse(storedUser) : null,
        sessionStorage: sessionUser ? JSON.parse(sessionUser) : null
      };
    } catch (error) {
      console.error('❌ Error verificando estado:', error);
      return { error: error.message };
    }
  };

  console.log('💡 Funciones disponibles:');
  console.log('  • clearINEData() - Limpia la base de datos IndexedDB');
  console.log('  • testOCR() - Prueba extracción OCR con texto de ejemplo');
  console.log('  • testOCR("tu texto aquí") - Prueba con texto personalizado');
  console.log('  • debugAuth("email", "password") - Debug de autenticación (simulado)');
  console.log('  • testLogin("email", "password") - Prueba login real');
  console.log('  • checkAuthStatus() - Verifica estado actual de autenticación');
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
