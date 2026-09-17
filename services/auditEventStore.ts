/**
 * APO-AUDIT-FORENSIC — store append-only (mock | Firestore Admin).
 * Solo backend / API. Rules: deny client.
 */

import { initializeApp, getApps, cert, applicationDefault, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export const AUDIT_EVENTS_COLLECTION = 'audit_events';

export type AuditAction =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILURE'
  | 'LOGOUT'
  | 'AFFILIATE_CREATE'
  | 'AFFILIATE_DUPLICATE'
  | 'ADMIN_AFFILIATE_DELETE'
  | 'SCREEN_VIEW';

export type AuditEvent = {
  id: string;
  ts: string;
  actorEmail: string;
  actorRole?: 'admin' | 'brigadista' | 'unknown';
  action: AuditAction;
  outcome: 'success' | 'failure' | 'denied';
  sourceIp?: string;
  sourceSummary: string;
  userAgentBrief?: string;
  curpMasked?: string;
  blindCurpPrefix?: string;
  affiliateId?: string;
  orgId?: string;
  screen?: string;
};

export type AuditEventInput = Omit<AuditEvent, 'id' | 'ts'> & {
  id?: string;
  ts?: string;
};

const memoryEvents: AuditEvent[] = [];

function useRealFirestore(): boolean {
  if ((process.env.FIRESTORE_BACKEND || 'mock').toLowerCase() !== 'firestore') {
    return false;
  }
  if (
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim()
  ) {
    return true;
  }
  return false;
}

let adminApp: App | null = null;

function getAdminApp(): App {
  if (adminApp) return adminApp;
  const existing = getApps().find((a) => a.name === 'mc-audit');
  if (existing) {
    adminApp = existing;
    return existing;
  }
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const sa = JSON.parse(json) as {
      project_id?: string;
      client_email: string;
      private_key: string;
    };
    adminApp = initializeApp(
      {
        credential: cert({
          projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID,
          clientEmail: sa.client_email,
          privateKey: sa.private_key.replace(/\\n/g, '\n'),
        }),
        projectId: sa.project_id || process.env.FIREBASE_PROJECT_ID,
      },
      'mc-audit'
    );
    return adminApp;
  }
  adminApp = initializeApp(
    {
      credential: applicationDefault(),
      projectId: process.env.FIREBASE_PROJECT_ID || 'movimiento-15317',
    },
    'mc-audit'
  );
  return adminApp;
}

function getDb(): Firestore {
  return getFirestore(getAdminApp());
}

function newId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `aud_${globalThis.crypto.randomUUID()}`;
  }
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function appendAuditEvent(input: AuditEventInput): Promise<AuditEvent> {
  const event: AuditEvent = {
    id: input.id || newId(),
    ts: input.ts || new Date().toISOString(),
    actorEmail: String(input.actorEmail || 'desconocido').trim() || 'desconocido',
    actorRole: input.actorRole || 'unknown',
    action: input.action,
    outcome: input.outcome,
    sourceIp: input.sourceIp,
    sourceSummary: String(input.sourceSummary || 'origen desconocido').trim(),
    userAgentBrief: input.userAgentBrief,
    curpMasked: input.curpMasked,
    blindCurpPrefix: input.blindCurpPrefix,
    affiliateId: input.affiliateId,
    orgId: input.orgId,
    screen: input.screen,
  };

  if (!useRealFirestore()) {
    memoryEvents.unshift(event);
    if (memoryEvents.length > 2000) memoryEvents.length = 2000;
    return event;
  }

  const db = getDb();
  await db.collection(AUDIT_EVENTS_COLLECTION).doc(event.id).set(event);
  return event;
}

export async function listAuditEvents(opts?: {
  limit?: number;
}): Promise<AuditEvent[]> {
  const limit = Math.min(Math.max(1, opts?.limit ?? 200), 500);

  if (!useRealFirestore()) {
    return memoryEvents.slice(0, limit);
  }

  const db = getDb();
  const snap = await db
    .collection(AUDIT_EVENTS_COLLECTION)
    .orderBy('ts', 'desc')
    .limit(limit)
    .get();

  return snap.docs.map((d) => d.data() as AuditEvent);
}

export function __resetAuditStoreForTests(): void {
  memoryEvents.length = 0;
}
