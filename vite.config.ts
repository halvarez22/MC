import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

// Plugin personalizado para copiar archivos estáticos
function copyStaticFiles() {
  return {
    name: 'copy-static-files',
    buildStart() {
      console.log('🔧 Plugin copyStaticFiles: Iniciando copia de archivos estáticos');
    },
    generateBundle() {
      const staticDir = path.resolve(__dirname, 'static');
      const distDir = path.resolve(__dirname, 'dist');

      // Crear directorio static en dist si no existe
      const distStaticDir = path.join(distDir, 'static');
      if (!existsSync(distStaticDir)) {
        mkdirSync(distStaticDir, { recursive: true });
        console.log('📁 Creado directorio dist/static/');
      }

      // Copiar archivos estáticos
      const filesToCopy = ['service-worker.js', 'manifest.json'];
      filesToCopy.forEach(file => {
        const srcPath = path.join(staticDir, file);
        const destPath = path.join(distStaticDir, file);

        if (existsSync(srcPath)) {
          copyFileSync(srcPath, destPath);
          console.log(`✅ Copiado ${file} a dist/static/`);
        } else {
          console.error(`❌ No se encontró ${file} en static/`);
        }
      });
    }
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [react(), copyStaticFiles()],
      server: {
        port: 3000,
        host: '0.0.0.0',
        fs: {
          allow: ['.']
        }
      },
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      publicDir: 'public',
      build: {
        assetsDir: 'assets',
        manifest: false, // Deshabilitar manifest automático de Vite
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => {
              if (assetInfo.name?.endsWith('.png') || assetInfo.name?.endsWith('.jpg') || assetInfo.name?.endsWith('.svg')) {
                return 'images/[name].[hash][extname]';
              }
              return 'assets/[name].[hash][extname]';
            }
          }
        }
      }
    };
});
