// FIX: Added export to make this file a module and defined the necessary types.
export interface User {
  uid: string;
  email: string | null;
  role?: 'admin' | 'brigadista'; // Maintained for application-specific logic
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