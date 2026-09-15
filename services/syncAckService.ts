/**
 * Contrato ACK de sincronización (D.1 + D.2b).
 * Prohibido tratar un `true` ciego como confirmación.
 * D.2b: POST /api/affiliates/secure (cifrado + Admin Firestore en servidor).
 */

export type SyncAckSuccess = {
  ok: true;
  status: number;
  syncId: string;
  affiliateId: string;
};

export type SyncAckFailure = {
  ok: false;
  status: number;
  error: string;
};

export type SyncAck = SyncAckSuccess | SyncAckFailure;

const SECURE_SYNC_PATH = '/api/affiliates/secure';

function newId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}_${globalThis.crypto.randomUUID()}`;
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type StructuredLike = Record<string, unknown>;

function asRecord(data: unknown): StructuredLike {
  return data && typeof data === 'object' ? (data as StructuredLike) : {};
}

/** Mapea extracción INE → payload cifrado (campos mínimos no vacíos). */
export function structuredDataToAffiliatePayload(structuredData: unknown): {
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
} {
  const o = asRecord(structuredData);
  const curp = String(o.curp || o.CURP || '').trim();
  return {
    fullName: String(o.nombre_completo || o.fullName || o.nombre || 'SIN_NOMBRE').trim(),
    curp,
    email: String(o.email || 'noreply@local.invalid').trim(),
    phone: String(o.phone || o.telefono || '0000000000').trim(),
    address: String(o.address || o.domicilio || 'SIN_DOMICILIO').trim(),
  };
}

function resolveOrgId(structuredData: unknown): string {
  const o = asRecord(structuredData);
  if (typeof o.orgId === 'string' && o.orgId.trim()) return o.orgId.trim();
  if (typeof o.org_id === 'string' && o.org_id.trim()) return o.org_id.trim();
  try {
    const raw = sessionStorage.getItem('supabase.auth.user');
    if (raw) {
      const u = JSON.parse(raw) as { uid?: string; orgId?: string };
      if (u.orgId) return String(u.orgId);
      if (u.uid) return String(u.uid);
    }
  } catch {
    /* ignore */
  }
  return 'org_default';
}

/**
 * Confirma recepción en backend seguro (cifrado + Firestore Admin).
 * 2xx o 409 → ACK válido (purga). 5xx / red → fallo (no purgar).
 */
export async function acknowledgeIneSync(structuredData: unknown): Promise<SyncAck> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { ok: false, status: 0, error: 'Sin conexión — ACK no emitido' };
  }

  if (structuredData == null) {
    return { ok: false, status: 400, error: 'Payload vacío — ACK rechazado' };
  }

  if (typeof structuredData === 'object' && Object.keys(structuredData as object).length === 0) {
    return { ok: false, status: 400, error: 'Payload sin campos — ACK rechazado' };
  }

  const payload = structuredDataToAffiliatePayload(structuredData);
  if (!payload.curp) {
    return { ok: false, status: 400, error: 'CURP ausente — ACK rechazado' };
  }

  const orgId = resolveOrgId(structuredData);

  try {
    const res = await fetch(SECURE_SYNC_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orgId, payload }),
    });

    let body: {
      syncId?: string;
      affiliateId?: string;
      error?: string;
      record?: { id?: string };
    } = {};
    try {
      body = (await res.json()) as typeof body;
    } catch {
      /* empty */
    }

    // 409 duplicado = ACK exitoso (ya en nube) → purga local
    if (res.status === 409) {
      return {
        ok: true,
        status: 409,
        syncId: body.syncId || newId('sync'),
        affiliateId: body.affiliateId || body.record?.id || newId('aff'),
      };
    }

    if (res.status >= 200 && res.status < 300) {
      return {
        ok: true,
        status: res.status,
        syncId: body.syncId || newId('sync'),
        affiliateId: body.affiliateId || body.record?.id || newId('aff'),
      };
    }

    return {
      ok: false,
      status: res.status,
      error: body.error || `ACK rechazado HTTP ${res.status}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de red';
    return { ok: false, status: 0, error: message };
  }
}

/** 2xx o 409 (duplicado) con syncId + affiliateId. */
export function isValidSyncAck(ack: SyncAck): ack is SyncAckSuccess {
  if (!ack.ok) return false;
  const statusOk =
    (ack.status >= 200 && ack.status < 300) || ack.status === 409;
  return (
    statusOk &&
    typeof ack.syncId === 'string' &&
    ack.syncId.length > 0 &&
    typeof ack.affiliateId === 'string' &&
    ack.affiliateId.length > 0
  );
}
