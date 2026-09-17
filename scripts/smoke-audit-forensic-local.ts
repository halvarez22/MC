/**
 * Smoke local APO-AUDIT-FORENSIC — sin red.
 * FIRESTORE_BACKEND=mock npx tsx scripts/smoke-audit-forensic-local.ts
 */
import { processAuditAppendRequest, processAuditListRequest } from '../api/audit/auditCore.ts';
import { processSecureAffiliateRequest } from '../api/affiliates/secureCore.ts';
import { __resetAuditStoreForTests, type AuditEvent } from '../services/auditEventStore.ts';
import { formatAuditActionLabel, maskCurp } from '../services/auditMask.ts';

const SECRET = process.env.ADMIN_LIST_SECRET || 'smoke-secret-audit-test';
const CURP = 'AAGH650922HGTLTC04';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  process.env.FIRESTORE_BACKEND = process.env.FIRESTORE_BACKEND || 'mock';
  process.env.ADMIN_LIST_SECRET = SECRET;
  process.env.ADMIN_DEFAULT_ORG_ID = process.env.ADMIN_DEFAULT_ORG_ID || 'org_default';
  process.env.CLOUD_KEK_SECRET =
    process.env.CLOUD_KEK_SECRET || '0123456789abcdef0123456789abcdef';
  process.env.CLOUD_BLIND_SECRET =
    process.env.CLOUD_BLIND_SECRET || 'blind-smoke-secret-32chars!!!!!!';

  __resetAuditStoreForTests();

  const masked = maskCurp(CURP);
  assert(masked === 'AAGH********TC04', `maskCurp got ${masked}`);

  const fail = await processAuditAppendRequest(
    {
      action: 'LOGIN_FAILURE',
      actorEmail: 'bad@example.com',
      outcome: 'failure',
    },
    {
      allowAnonymousFailure: true,
      meta: {
        headers: {
          'x-forwarded-for': '189.1.2.3',
          'user-agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
        },
      },
    }
  );
  assert(fail.status === 201, `LOGIN_FAILURE ${fail.status}`);

  const screen = await processAuditAppendRequest(
    {
      action: 'SCREEN_VIEW',
      actorEmail: 'admin@example.com',
      actorRole: 'admin',
      screen: 'admin.ine_data',
    },
    {
      authorizationHeader: `Bearer ${SECRET}`,
      meta: { headers: { 'user-agent': 'Chrome/120' } },
    }
  );
  assert(screen.status === 201, `SCREEN_VIEW ${screen.status}`);

  const create = await processSecureAffiliateRequest(
    {
      orgId: 'org_default',
      payload: {
        fullName: 'Smoke Audit',
        curp: CURP,
        email: 'a@b.c',
        phone: '1234567890',
        address: 'x',
      },
      actorEmail: 'brig@example.com',
      actorRole: 'brigadista',
    },
    {
      requireCloudSecrets: true,
      auditMeta: {
        headers: {
          'x-forwarded-for': '10.0.0.9',
          'user-agent': 'Android',
        },
      },
    }
  );
  assert(create.status === 201 || create.status === 409, `secure ${create.status}`);

  const list = await processAuditListRequest({
    authorizationHeader: `Bearer ${SECRET}`,
    limit: 50,
  });
  assert(list.status === 200, `list ${list.status}`);
  const events = (list.body.events as AuditEvent[]) || [];
  assert(events.length >= 2, `expected events, got ${events.length}`);

  const loginFail = events.find((e) => e.action === 'LOGIN_FAILURE');
  assert(loginFail, 'missing LOGIN_FAILURE');
  assert(
    (loginFail.sourceSummary || '').includes('189.1.2.3'),
    `sourceSummary=${loginFail.sourceSummary}`
  );

  const createEv = events.find((e) => e.action === 'AFFILIATE_CREATE');
  if (create.status === 201) {
    assert(createEv, 'missing AFFILIATE_CREATE');
    assert(createEv.curpMasked === masked, `curpMasked=${createEv.curpMasked}`);
    const label = formatAuditActionLabel(
      createEv.action,
      createEv.curpMasked,
      createEv.screen
    );
    assert(label.includes(masked), `label=${label}`);
    assert(!label.includes(CURP.slice(4, 12)), 'full CURP leaked in label');
  }

  const menu = events.find(
    (e) => e.action === 'SCREEN_VIEW' && e.screen === 'admin.ine_data'
  );
  assert(menu, 'missing SCREEN_VIEW admin.ine_data');

  const denied = await processAuditListRequest({
    authorizationHeader: 'Bearer wrong',
  });
  assert(denied.status === 401, `expected 401 got ${denied.status}`);

  console.log('MOCK_SMOKE PASS — audit forensic (fail login + create + screen + list)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
