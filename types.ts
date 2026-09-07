// FIX: Added export to make this file a module and defined the necessary types.
export interface User {
  uid: string;
  email: string | null;
  role?: 'admin' | 'brigadista' | 'simpatizante'; // Maintained for application-specific logic
  fullName?: string;
  state?: string;
  city?: string;
  delegation?: string;
  requiresPasswordChange?: boolean;
}

export interface Document {
  id: string;
  type: 'INE Frontal' | 'INE Posterior';
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  fileName?: string;
}

export interface INEData {
  name: string;
  address: string;
  voterId: string;
  curp: string;
  registrationYear: string;
  state: string;
  municipality: string;
  section: string;
  locality: string;
  emission: string;
  validity: string;
  extractedAt: string; // Fecha de extracción OCR
  confidence?: number; // Nivel de confianza del OCR
}

/** Modelo de Credencial para Votar (portal Lista Nominal / proveedores KYC). */
export type IneCredentialModel =
  | 'C'
  | 'D'
  | 'E'
  | 'F'
  | 'G'
  | 'H'
  | 'I'
  | 'J'
  | 'UNKNOWN';

/** Contrato canónico de extracción estructurada INE (salida LLM/OCR pipeline). */
export interface INEStructuredData {
  nombre_completo?: string;
  curp?: string;
  fecha_nacimiento?: string;
  fecha_emision?: string;
  fecha_vigencia?: string;
  domicilio?: string;
  clave_elector?: string;
  seccion?: string;
  municipio?: string;
  estado?: string;
  localidad?: string;
  /** Campos para Lista Nominal (Fase 3+; opcionales hasta extracción MRZ). */
  modelo_credencial?: IneCredentialModel;
  cic?: string;
  id_ciudadano?: string;
  ocr_credencial?: string;
  numero_emision?: string;
}

/** Estatus canónico de validación Lista Nominal (sanitizado; no payload vendor). */
export type ListaNominalStatus =
  | 'valid'
  | 'not_found'
  | 'not_current'
  | 'expired'
  | 'skipped_offline'
  | 'skipped_flag_off'
  | 'error';

export interface ListaNominalResult {
  status: ListaNominalStatus;
  checkedAt: string;
  provider: string;
  rawMessage?: string;
  modelUsed?: IneCredentialModel;
}

/** Query tipada que el cliente envía al proxy SSD (sin API keys). */
export interface ListaNominalQuery {
  modelo: IneCredentialModel;
  cic?: string;
  id_ciudadano?: string;
  ocr_credencial?: string;
  clave_elector?: string;
  numero_emision?: string;
}

export interface Affiliate {
  id: string;
  createdAt: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  status: 'activo' | 'inactivo';
  documentation: Document[];
  ineData?: INEData; // Datos extraídos del INE mediante OCR
  latitude?: number;
  longitude?: number;
}

export interface DashboardMetrics {
  totalAffiliates: number;
  activePercentage: number;
  docsCompletePercentage: number;
  monthlyGrowth: { month: string; count: number }[];
  geoDistribution: { state: string; count: number }[];
  recentAffiliates: Affiliate[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userEmail: string;
  action: string;
  details: string;
}

export interface Notification {
  id: string;
  type: 'new_affiliate' | 'pending_docs';
  message: string;
  timestamp: string;
  read: boolean;
  relatedId: string; // e.g., affiliateId
}

/**
 * Contrato C.3 — material de DEK envuelta con PIN (KeyStore IndexedDB).
 * Nunca incluye el PIN ni la DEK en claro.
 */
export interface KeyPersistenceConfig {
  /** Versión del esquema de persistencia de llaves. */
  version: number;
  /** Identificador de la DEK (coincide con EncryptedBlob.keyId). */
  keyId: string;
  /** Identificador estable del dispositivo / instalación. */
  deviceId: string;
  /** Salt PBKDF2 en Base64. */
  salt: string;
  /** DEK envuelta (AES-KW) en Base64 — nunca la llave en claro. */
  wrappedKey: string;
  /** Iteraciones PBKDF2 usadas al derivar la KEK. */
  pbkdf2Iterations: number;
  /** Si true, la UI debe solicitar PIN antes de unwrap. */
  requiresPin: boolean;
  /** Timestamp ISO de creación / última rotación. */
  createdAt: string;
}