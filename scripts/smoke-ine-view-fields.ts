/** Smoke I.B campos opcionales INE en envelope + list */
import { processSecureAffiliateRequest } from '../api/affiliates/secureCore.ts';
import { processSecureAffiliateListRequest } from '../api/affiliates/secureListCore.ts';
import { processSecureAffiliateDeleteRequest } from '../api/affiliates/secureDeleteCore.ts';

async function main() {
  process.env.FIRESTORE_BACKEND = 'mock';
  process.env.ADMIN_LIST_SECRET = 't';
  process.env.ADMIN_DEFAULT_ORG_ID = 'org_default';
  process.env.CLOUD_KEK_SECRET = '0123456789abcdef0123456789abcdef';
  process.env.CLOUD_BLIND_SECRET = 'blind-smoke-secret-32chars!!!!!!';

  const payload = {
    fullName: 'Hector Test',
    curp: 'INEVIEW0101HDFRR09',
    email: 'a@b.c',
    phone: '1',
    address: 'Calle 1',
    voterId: 'CLAVE123',
    state: 'Guanajuato',
    municipality: 'Leon',
    section: '1532',
  };

  const c = await processSecureAffiliateRequest(
    { orgId: 'org_default', payload },
    { requireCloudSecrets: true }
  );
  console.log('C', c.status);

  const list = await processSecureAffiliateListRequest({
    authorizationHeader: 'Bearer t',
    requireCloudSecrets: true,
  });
  const row = (
    (list.body.affiliates as {
      id: string;
      curp: string;
      voterId?: string;
      state?: string;
      municipality?: string;
      section?: string;
    }[]) || []
  ).find((a) => a.curp === 'INEVIEW0101HDFRR09');

  console.log('ROW', {
    voterId: row?.voterId,
    state: row?.state,
    municipality: row?.municipality,
    section: row?.section,
  });

  if (!row?.voterId || row.state !== 'Guanajuato' || row.section !== '1532') {
    throw new Error('optional INE fields missing in list DTO');
  }

  await processSecureAffiliateDeleteRequest(
    { affiliateId: row.id },
    { authorizationHeader: 'Bearer t', requireCloudSecrets: true }
  );
  console.log('INE_VIEW_SMOKE PASS');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
