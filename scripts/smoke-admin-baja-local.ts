/**
 * Smoke local (mock) APO-ADMIN-BAJA — sin red.
 * FIRESTORE_BACKEND=mock npx tsx scripts/smoke-admin-baja-local.ts
 */
import { processSecureAffiliateRequest } from '../api/affiliates/secureCore.ts';
import { processSecureAffiliateDeleteRequest } from '../api/affiliates/secureDeleteCore.ts';
import { processSecureAffiliateListRequest } from '../api/affiliates/secureListCore.ts';

const SECRET = process.env.ADMIN_LIST_SECRET || 'smoke-secret-baja-test';
const curp = 'SMOKEBAJA0101HDFRR09';

async function main() {
  process.env.FIRESTORE_BACKEND = process.env.FIRESTORE_BACKEND || 'mock';
  process.env.ADMIN_LIST_SECRET = SECRET;
  process.env.ADMIN_DEFAULT_ORG_ID = process.env.ADMIN_DEFAULT_ORG_ID || 'org_default';
  process.env.CLOUD_KEK_SECRET =
    process.env.CLOUD_KEK_SECRET || '0123456789abcdef0123456789abcdef';
  process.env.CLOUD_BLIND_SECRET =
    process.env.CLOUD_BLIND_SECRET || 'blind-smoke-secret-32chars!!!!!!';

  const payload = {
    fullName: 'Smoke Baja',
    curp,
    email: 'a@b.c',
    phone: '1234567890',
    address: 'x',
  };

  const c1 = await processSecureAffiliateRequest(
    { orgId: 'org_default', payload },
    { requireCloudSecrets: true }
  );
  console.log('C1', c1.status, c1.body.record?.id || c1.body.affiliateId);

  const list = await processSecureAffiliateListRequest({
    authorizationHeader: `Bearer ${SECRET}`,
    requireCloudSecrets: true,
  });
  const rows = (list.body.affiliates as { id: string; curp: string }[]) || [];
  const row = rows.find((r) => r.curp === curp);
  console.log('LIST', list.status, !!row, row?.id);
  if (!row) throw new Error('not in list');

  const del = await processSecureAffiliateDeleteRequest(
    { affiliateId: row.id },
    { authorizationHeader: `Bearer ${SECRET}`, requireCloudSecrets: true }
  );
  console.log('DEL', del.status, del.body.deleted);
  if (del.status !== 200 || !del.body.deleted) throw new Error('delete failed');

  const c2 = await processSecureAffiliateRequest(
    { orgId: 'org_default', payload },
    { requireCloudSecrets: true }
  );
  console.log('C2', c2.status, 'duplicate=', c2.body.duplicate);
  if (c2.status === 409) throw new Error('CURP still blocked');
  if (c2.status !== 201) throw new Error(`recreate ${c2.status}`);

  const list2 = await processSecureAffiliateListRequest({
    authorizationHeader: `Bearer ${SECRET}`,
    requireCloudSecrets: true,
  });
  const row2 = ((list2.body.affiliates as { id: string; curp: string }[]) || []).find(
    (r) => r.curp === curp
  );
  if (row2) {
    await processSecureAffiliateDeleteRequest(
      { affiliateId: row2.id },
      { authorizationHeader: `Bearer ${SECRET}`, requireCloudSecrets: true }
    );
  }

  console.log('MOCK_SMOKE PASS — baja libera CURP');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
