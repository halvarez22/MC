/**
 * APO-ADMIN-BAJA — Hard delete afiliado cifrado (libera CURP para reafiliación).
 */

import {
  authorizeAdminListBearer,
  resolveAdminListOrgIds,
} from './secureListCore.js';
import {
  deleteEncryptedById,
  ensureAdminWritePossible,
} from '../../services/encryptedAffiliateFirebaseStore.js';

export type SecureDeleteBody = {
  affiliateId?: string;
  /** Para bitácora enmascarada (Admin ya lo ve en claro) */
  curp?: string;
  actorEmail?: string;
};

export type SecureDeleteResult = {
  status: number;
  body: Record<string, unknown>;
};

export async function processSecureAffiliateDeleteRequest(
  body: SecureDeleteBody,
  opts: {
    authorizationHeader?: string;
    requireCloudSecrets?: boolean;
    auditMeta?: { headers?: { [k: string]: string | string[] | undefined } };
  }
): Promise<SecureDeleteResult> {
  if (!process.env.ADMIN_LIST_SECRET?.trim()) {
    return {
      status: 500,
      body: { error: 'ADMIN_LIST_SECRET not configured on server' },
    };
  }

  if (!authorizeAdminListBearer(opts.authorizationHeader)) {
    return { status: 401, body: { error: 'Unauthorized' } };
  }

  if (opts.requireCloudSecrets) {
    if (!process.env.CLOUD_KEK_SECRET?.trim()) {
      return { status: 500, body: { error: 'CLOUD_KEK_SECRET requerido en producción' } };
    }
    if (!process.env.CLOUD_BLIND_SECRET?.trim()) {
      return { status: 500, body: { error: 'CLOUD_BLIND_SECRET requerido en producción' } };
    }
  }

  const affiliateId =
    typeof body.affiliateId === 'string' ? body.affiliateId.trim() : '';
  if (!affiliateId) {
    return { status: 400, body: { error: 'affiliateId requerido' } };
  }

  const storeReady = await ensureAdminWritePossible();
  if (!storeReady.ok) {
    return { status: 500, body: { error: storeReady.detail } };
  }

  const allowedOrgIds = resolveAdminListOrgIds();
  const actorEmail =
    typeof body.actorEmail === 'string' && body.actorEmail.trim()
      ? body.actorEmail.trim()
      : 'admin@desconocido';

  try {
    const result = await deleteEncryptedById(affiliateId, { allowedOrgIds });

    const { maskCurp } = await import('../../services/auditMask.js');
    const { recordServerAudit } = await import('../../services/auditApiCore.js');
    await recordServerAudit(
      {
        action: 'ADMIN_AFFILIATE_DELETE',
        outcome: 'success',
        actorEmail,
        actorRole: 'admin',
        curpMasked: body.curp ? maskCurp(body.curp) : undefined,
        blindCurpPrefix: result.blindCurpPrefix,
        affiliateId: result.affiliateId,
        orgId: result.orgId,
        sourceSummary: '',
      },
      opts.auditMeta
    );

    console.info('[secure-delete]', {
      affiliateId: result.affiliateId,
      deleted: result.deleted,
      orgId: result.orgId || null,
      blindCurpPrefix: result.blindCurpPrefix || null,
      store: storeReady.mode,
      at: new Date().toISOString(),
    });

    return {
      status: 200,
      body: {
        ok: true,
        deleted: result.deleted,
        affiliateId: result.affiliateId,
        orgId: result.orgId || null,
        blindCurpPrefix: result.blindCurpPrefix || null,
        store: storeReady.mode,
        note: result.deleted
          ? 'Registro eliminado; el CURP puede reafiliarse'
          : 'Registro no encontrado (idempotente)',
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'error al eliminar';
    if (message.includes('allowlist')) {
      return { status: 403, body: { error: message } };
    }
    return { status: 500, body: { error: message } };
  }
}
