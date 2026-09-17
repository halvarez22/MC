/**
 * Cliente forense — append eventos (login, pantallas).
 * No importa cloudEncryption / Admin SDK.
 */

import type { AuditAction, AuditEvent } from './auditEventStore';

const APPEND_PATH = '/api/audit/append';
const LIST_PATH = '/api/audit/list';

export async function appendForensicEvent(input: {
  action: AuditAction;
  outcome?: 'success' | 'failure' | 'denied';
  actorEmail: string;
  actorRole?: 'admin' | 'brigadista' | 'unknown';
  curp?: string;
  screen?: string;
  affiliateId?: string;
  orgId?: string;
  /** Si false, no envía Bearer (eventos de auth) */
  requireBearer?: boolean;
}): Promise<void> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const authFree =
      input.action === 'LOGIN_FAILURE' ||
      input.action === 'LOGIN_SUCCESS' ||
      input.action === 'LOGOUT';
    const needBearer = input.requireBearer !== false && !authFree;
    if (needBearer) {
      const bearer = (import.meta.env.VITE_ADMIN_LIST_BEARER as string | undefined)?.trim();
      if (!bearer) return;
      headers.Authorization = `Bearer ${bearer}`;
    }

    await fetch(APPEND_PATH, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: input.action,
        outcome: input.outcome || (input.action === 'LOGIN_FAILURE' ? 'failure' : 'success'),
        actorEmail: input.actorEmail,
        actorRole: input.actorRole || 'unknown',
        curp: input.curp,
        screen: input.screen,
        affiliateId: input.affiliateId,
        orgId: input.orgId,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      }),
    });
  } catch {
    /* no bloquear UX */
  }
}

export async function listForensicEvents(limit = 200): Promise<AuditEvent[]> {
  const bearer = (import.meta.env.VITE_ADMIN_LIST_BEARER as string | undefined)?.trim();
  if (!bearer) {
    throw new Error('Falta VITE_ADMIN_LIST_BEARER para leer la bitácora.');
  }
  const res = await fetch(`${LIST_PATH}?limit=${encodeURIComponent(String(limit))}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${bearer}`,
    },
  });
  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    events?: AuditEvent[];
  };
  if (!res.ok) {
    throw new Error(data.error || `Error ${res.status} al listar bitácora`);
  }
  return Array.isArray(data.events) ? data.events : [];
}

export function viewToAuditScreen(
  view: string,
  role?: string
): string | null {
  if (role === 'brigadista') return 'field.home';
  switch (view) {
    case 'dashboard':
      return 'admin.dashboard';
    case 'affiliates':
      return 'admin.affiliates';
    case 'audit':
      return 'admin.audit';
    case 'users':
      return 'admin.users';
    case 'ine-data':
      return 'admin.ine_data';
    default:
      return null;
  }
}
