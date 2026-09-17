/**
 * APO-AUDIT-FORENSIC — núcleo append / list (Vercel + Vite).
 */

import {
  appendAuditEvent,
  listAuditEvents,
  type AuditAction,
  type AuditEvent,
  type AuditEventInput,
} from './auditEventStore.js';
import {
  authorizeAdminListBearer,
} from '../api/affiliates/secureListCore.js';
import {
  buildSourceSummary,
  briefUserAgent,
  extractClientIp,
  maskCurp,
} from './auditMask.js';

const ALLOWED_ACTIONS: AuditAction[] = [
  'LOGIN_SUCCESS',
  'LOGIN_FAILURE',
  'LOGOUT',
  'AFFILIATE_CREATE',
  'AFFILIATE_DUPLICATE',
  'ADMIN_AFFILIATE_DELETE',
  'SCREEN_VIEW',
];

export type AuditRequestMeta = {
  headers?: { [k: string]: string | string[] | undefined };
};

export type AuditAppendBody = {
  action?: string;
  outcome?: 'success' | 'failure' | 'denied';
  actorEmail?: string;
  actorRole?: 'admin' | 'brigadista' | 'unknown';
  curp?: string;
  curpMasked?: string;
  blindCurpPrefix?: string;
  affiliateId?: string;
  orgId?: string;
  screen?: string;
  /** Cliente puede mandar UA; IP siempre del server */
  userAgent?: string;
};

function isAction(a: string): a is AuditAction {
  return (ALLOWED_ACTIONS as string[]).includes(a);
}

export function buildAuditFromRequest(
  partial: AuditEventInput,
  meta?: AuditRequestMeta
): AuditEventInput {
  const headers = meta?.headers || {};
  const ip = extractClientIp(headers);
  const uaHeader = headers['user-agent'];
  const ua = Array.isArray(uaHeader) ? uaHeader[0] : uaHeader;
  const uaBrief = briefUserAgent(partial.userAgentBrief || ua || '');
  return {
    ...partial,
    sourceIp: partial.sourceIp || ip || undefined,
    userAgentBrief: uaBrief || partial.userAgentBrief,
    sourceSummary:
      partial.sourceSummary ||
      buildSourceSummary(ip || '', uaBrief || String(ua || '')),
  };
}

/**
 * Append desde handlers internos (secure / delete) — sin auth extra.
 */
export async function recordServerAudit(
  partial: AuditEventInput,
  meta?: AuditRequestMeta
): Promise<void> {
  try {
    const input = buildAuditFromRequest(partial, meta);
    if (partial.curpMasked) {
      input.curpMasked = partial.curpMasked;
    }
    await appendAuditEvent(input);
  } catch (err) {
    console.warn(
      '[audit] append failed',
      err instanceof Error ? err.message : err
    );
  }
}

export async function processAuditAppendRequest(
  body: AuditAppendBody,
  opts: {
    authorizationHeader?: string;
    requireAuth?: boolean;
    allowAnonymousFailure?: boolean;
    meta?: AuditRequestMeta;
  }
): Promise<{ status: number; body: Record<string, unknown> }> {
  const actionRaw = String(body.action || '').trim();
  if (!isAction(actionRaw)) {
    return { status: 400, body: { error: 'action inválida' } };
  }

  const isAuthEvent =
    actionRaw === 'LOGIN_FAILURE' ||
    actionRaw === 'LOGIN_SUCCESS' ||
    actionRaw === 'LOGOUT';
  const needsAuth =
    opts.requireAuth !== false &&
    !(opts.allowAnonymousFailure && isAuthEvent);

  if (needsAuth) {
    if (!process.env.ADMIN_LIST_SECRET?.trim()) {
      // Permitir append de SCREEN/LOGIN con bearer demo; si no hay secret, 500
      return {
        status: 500,
        body: { error: 'ADMIN_LIST_SECRET not configured' },
      };
    }
    // SCREEN_VIEW / LOGIN_SUCCESS / LOGOUT: Bearer Admin O mismo secret
    // Brigadista: usamos Bearer demo compartido en v1 (APO.3 → ID token)
    if (!authorizeAdminListBearer(opts.authorizationHeader)) {
      // También aceptar Bearer = secret para actores campo vía VITE_ADMIN_LIST_BEARER
      return { status: 401, body: { error: 'Unauthorized' } };
    }
  }

  const outcome = body.outcome || (actionRaw === 'LOGIN_FAILURE' ? 'failure' : 'success');
  const curpMasked =
    body.curpMasked ||
    (body.curp ? maskCurp(body.curp) : undefined);

  try {
    const event = await appendAuditEvent(
      buildAuditFromRequest(
        {
          action: actionRaw,
          outcome,
          actorEmail: String(body.actorEmail || 'desconocido').trim(),
          actorRole: body.actorRole || 'unknown',
          curpMasked,
          blindCurpPrefix: body.blindCurpPrefix,
          affiliateId: body.affiliateId,
          orgId: body.orgId,
          screen: body.screen,
          userAgentBrief: briefUserAgent(body.userAgent),
          sourceSummary: '', // filled by buildAuditFromRequest
        },
        opts.meta
      )
    );

    return { status: 201, body: { ok: true, id: event.id, ts: event.ts } };
  } catch (err) {
    console.error(
      '[audit] append error',
      err instanceof Error ? err.message : err
    );
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : 'audit append failed',
      },
    };
  }
}

export async function processAuditListRequest(opts: {
  authorizationHeader?: string;
  limit?: number;
}): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!process.env.ADMIN_LIST_SECRET?.trim()) {
    return {
      status: 500,
      body: { error: 'ADMIN_LIST_SECRET not configured' },
    };
  }
  if (!authorizeAdminListBearer(opts.authorizationHeader)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  try {
    const events = await listAuditEvents({ limit: opts.limit ?? 200 });
    return {
      status: 200,
      body: { ok: true, count: events.length, events },
    };
  } catch (err) {
    return {
      status: 500,
      body: {
        error: err instanceof Error ? err.message : 'audit list error',
      },
    };
  }
}

export type { AuditEvent, AuditAction };
