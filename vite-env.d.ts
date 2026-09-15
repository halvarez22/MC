/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY: string;
  readonly VITE_FIREBASE_AUTH_DOMAIN: string;
  readonly VITE_FIREBASE_PROJECT_ID: string;
  readonly VITE_FIREBASE_STORAGE_BUCKET: string;
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID: string;
  readonly VITE_FIREBASE_APP_ID: string;
  readonly VITE_USE_ENCRYPTED_AFFILIATES_ADMIN?: string;
  /** Demo only — mismo valor que ADMIN_LIST_SECRET. APO.3 → ID token. */
  readonly VITE_ADMIN_LIST_BEARER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
