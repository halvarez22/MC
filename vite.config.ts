import path from 'path';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import {
  processGroqIneRequest,
  type GroqIneBody,
} from './api/groqIneCore';
import {
  DEFAULT_TIMEOUT_MS,
  processListaNominalRequest,
} from './api/listaNominalCore';
import type { ListaNominalQuery } from './types';

/** Proxy local /api/groq-ine (misma lógica que Vercel) para demos con Vite. */
function localGroqIneProxy(env: Record<string, string>): Plugin {
  return {
    name: 'local-groq-ine-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/groq-ine') {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          const body = (raw ? JSON.parse(raw) : {}) as GroqIneBody;
          const contentLengthHeader = req.headers['content-length'];
          const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;

          const result = await processGroqIneRequest({
            body,
            apiKey: env.GROQ_API_KEY || process.env.GROQ_API_KEY,
            visionModel: env.GROQ_VISION_MODEL || process.env.GROQ_VISION_MODEL,
            contentLength:
              contentLength !== undefined && Number.isFinite(contentLength)
                ? contentLength
                : undefined,
          });

          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Proxy local error';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

/** Proxy local /api/ine-lista-nominal (paridad Vercel; key solo server env). */
function localListaNominalProxy(env: Record<string, string>): Plugin {
  return {
    name: 'local-lista-nominal-proxy',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url !== '/api/ine-lista-nominal') {
          next();
          return;
        }

        if (req.method === 'OPTIONS') {
          res.statusCode = 204;
          res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          res.end();
          return;
        }

        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method not allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          for await (const chunk of req) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          const raw = Buffer.concat(chunks).toString('utf8');
          const body = (raw ? JSON.parse(raw) : {}) as ListaNominalQuery;
          const contentLengthHeader = req.headers['content-length'];
          const contentLength = contentLengthHeader ? Number(contentLengthHeader) : undefined;
          const timeoutEnv = Number(
            env.LISTA_NOMINAL_TIMEOUT_MS ||
              process.env.LISTA_NOMINAL_TIMEOUT_MS ||
              DEFAULT_TIMEOUT_MS
          );

          const result = await processListaNominalRequest({
            body,
            apiKey: env.DATOS_NONSTOP_API_KEY || process.env.DATOS_NONSTOP_API_KEY,
            baseUrl: env.DATOS_NONSTOP_BASE_URL || process.env.DATOS_NONSTOP_BASE_URL,
            timeoutMs: Number.isFinite(timeoutEnv) ? timeoutEnv : DEFAULT_TIMEOUT_MS,
            contentLength:
              contentLength !== undefined && Number.isFinite(contentLength)
                ? contentLength
                : undefined,
          });

          res.statusCode = result.status;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(result.body));
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Proxy local error';
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react(), localGroqIneProxy(env), localListaNominalProxy(env)],
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    // NOTA DE SEGURIDAD (SSD Regla 5):
    // Se eliminó la inyección de VITE_GEMINI_API_KEY en window.
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    publicDir: 'public',
    build: {
      assetsDir: 'assets',
      outDir: 'dist',
    },
  };
});
