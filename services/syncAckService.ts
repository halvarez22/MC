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
/** Timeout cliente para no dejar el brigadista en spinner infinito (APO-FIELD-HANG). */
const SECURE_SYNC_TIMEOUT_MS = 25_000;

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

/** Mapea extracción INE → payload cifrado (campos mínimos + opcionales INE). */
export function structuredDataToAffiliatePayload(structuredData: unknown): {
  fullName: string;
  curp: string;
  email: string;
  phone: string;
  address: string;
  voterId?: string;
  state?: string;
  municipality?: string;
  section?: string;
  locality?: string;
  registrationYear?: string;
  emission?: string;
  validity?: string;
} {
  const o = asRecord(structuredData);
  const curp = String(o.curp || o.CURP || '').trim().toUpperCase();
  const opt = (v: unknown) => {
    const s = String(v ?? '').trim();
    return s || undefined;
  };
  return {
    fullName: String(o.nombre_completo || o.fullName || o.nombre || 'SIN_NOMBRE').trim(),
    curp,
    email: String(o.email || 'noreply@local.invalid').trim(),
    phone: String(o.phone || o.telefono || '0000000000').trim(),
    address: String(o.address || o.domicilio || o.domicilio_lineas || 'SIN_DOMICILIO').trim(),
    voterId: opt(o.voterId || o.clave_elector),
    state: opt(o.state || o.estado_nombre || o.estado),
    municipality: opt(o.municipality || o.municipio_nombre || o.municipio),
    section: opt(o.section || o.seccion),
    locality: opt(o.locality || o.localidad),
    registrationYear: opt(o.registrationYear || o.anio_registro),
    emission: opt(o.emission || o.fecha_emision),
    validity: opt(o.validity || o.fecha_vigencia),
  };
}

/**
 * APO-FIELD-PERSIST + INE-VIEW: form Modo Campo → payload secure.
 */
export function fieldFormToSecureSyncInput(input: {
  fullName: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  curp?: string;
  orgId?: string;
  voterId?: string;
  municipality?: string;
  section?: string;
  locality?: string;
  registrationYear?: string;
  emission?: string;
  validity?: string;
  /** Estado INE (nombre); si falta, usa state del form */
  ineState?: string;
  actorEmail?: string;
  actorRole?: 'admin' | 'brigadista' | 'unknown';
  /** APO-ADMIN-INE-THUMB */
  thumbFrontJpegBase64?: string;
}): Record<string, unknown> {
  const addressParts = [input.address, input.city, input.state, input.zip]
    .map((p) => String(p || '').trim())
    .filter(Boolean);
  const opt = (v?: string) => {
    const s = String(v ?? '').trim();
    return s || undefined;
  };
  return {
    fullName: String(input.fullName || '').trim(),
    nombre_completo: String(input.fullName || '').trim(),
    curp: String(input.curp || '').trim().toUpperCase(),
    email: String(input.email || '').trim() || 'noreply@local.invalid',
    phone: String(input.phone || '').trim() || '0000000000',
    address: addressParts.join(', ') || 'SIN_DOMICILIO',
    domicilio: addressParts.join(', ') || 'SIN_DOMICILIO',
    ...(input.orgId?.trim() ? { orgId: input.orgId.trim() } : {}),
    ...(opt(input.actorEmail)
      ? { actorEmail: opt(input.actorEmail), actorRole: input.actorRole || 'brigadista' }
      : {}),
    ...(opt(input.thumbFrontJpegBase64)
      ? { thumbFrontJpegBase64: opt(input.thumbFrontJpegBase64) }
      : {}),
    ...(opt(input.voterId) ? { voterId: opt(input.voterId), clave_elector: opt(input.voterId) } : {}),
    ...(opt(input.ineState || input.state)
      ? { state: opt(input.ineState || input.state), estado_nombre: opt(input.ineState || input.state) }
      : {}),
    ...(opt(input.municipality)
      ? { municipality: opt(input.municipality), municipio_nombre: opt(input.municipality) }
      : {}),
    ...(opt(input.section) ? { section: opt(input.section), seccion: opt(input.section) } : {}),
    ...(opt(input.locality) ? { locality: opt(input.locality), localidad: opt(input.locality) } : {}),
    ...(opt(input.registrationYear) ? { registrationYear: opt(input.registrationYear) } : {}),
    ...(opt(input.emission) ? { emission: opt(input.emission), fecha_emision: opt(input.emission) } : {}),
    ...(opt(input.validity) ? { validity: opt(input.validity), fecha_vigencia: opt(input.validity) } : {}),
  };
}

/**
 * Persistencia cifrada desde Modo Campo.
 * 201 y 409 (duplicado) → ACK válido vía isValidSyncAck.
 */
export async function syncFieldAffiliate(
  input: Parameters<typeof fieldFormToSecureSyncInput>[0]
): Promise<SyncAck> {
  return acknowledgeIneSync(fieldFormToSecureSyncInput(input));
}

function resolveOrgId(structuredData: unknown): string {
  const o = asRecord(structuredData);
  if (typeof o.orgId === 'string' && o.orgId.trim()) return o.orgId.trim();
  if (typeof o.org_id === 'string' && o.org_id.trim()) return o.org_id.trim();
  // Demo/prod alineado: NO usar uid como org (fragmentaba registros fuera de org_default).
  const fromEnv =
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.VITE_SYNC_ORG_ID as string | undefined)?.trim()) ||
    '';
  if (fromEnv) return fromEnv;
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

  const o = asRecord(structuredData);
  const actorEmail =
    typeof o.actorEmail === 'string' && o.actorEmail.trim()
      ? o.actorEmail.trim()
      : undefined;
  const actorRole =
    o.actorRole === 'admin' || o.actorRole === 'brigadista' || o.actorRole === 'unknown'
      ? o.actorRole
      : 'brigadista';

  const thumbFrontJpegBase64 =
    typeof o.thumbFrontJpegBase64 === 'string' && o.thumbFrontJpegBase64.trim()
      ? o.thumbFrontJpegBase64.trim()
      : undefined;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SECURE_SYNC_TIMEOUT_MS);

  try {
    const res = await fetch(SECURE_SYNC_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orgId,
        payload,
        ...(actorEmail ? { actorEmail, actorRole } : {}),
        ...(thumbFrontJpegBase64 ? { thumbFrontJpegBase64 } : {}),
      }),
      signal: controller.signal,
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
    if (err instanceof Error && err.name === 'AbortError') {
      return {
        ok: false,
        status: 0,
        error: `Tiempo de espera agotado (${SECURE_SYNC_TIMEOUT_MS / 1000}s). Reintenta.`,
      };
    }
    const message = err instanceof Error ? err.message : 'Error de red';
    return { ok: false, status: 0, error: message };
  } finally {
    clearTimeout(timer);
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
