/**
 * Smoke local APO-ADMIN-INE-THUMB — mock, sin red.
 * FIRESTORE_BACKEND=mock npx tsx scripts/smoke-ine-front-thumb-local.ts
 */
import { processSecureAffiliateRequest } from '../api/affiliates/secureCore.ts';
import { processSecureAffiliateDeleteRequest } from '../api/affiliates/secureDeleteCore.ts';
import { processSecureThumbRequest } from '../api/affiliates/secureThumbCore.ts';
import { __resetAffiliateMediaForTests } from '../services/affiliateMediaStore.ts';
import {
  isJpegMagic,
  validateIneFrontThumbBase64,
} from '../services/ineThumbService.ts';
import { INE_FRONT_THUMB_MAX_BYTES } from '../services/ineThumbConfig.ts';

const SECRET = process.env.ADMIN_LIST_SECRET || 'smoke-secret-thumb-test';

/** JPEG mínimo válido (>32 bytes, magic FFD8FF). */
const TINY_JPEG_B64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//Z';

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

  __resetAffiliateMediaForTests();

  const v = validateIneFrontThumbBase64(TINY_JPEG_B64);
  assert(v.ok, `validate: ${!v.ok ? v.error : ''}`);
  assert(isJpegMagic(v.bytes), 'magic');
  assert(v.byteLength <= INE_FRONT_THUMB_MAX_BYTES, 'max bytes');

  const curp = 'THUMBTEST0101HDFRR09';
  const create = await processSecureAffiliateRequest(
    {
      orgId: 'org_default',
      payload: {
        fullName: 'Smoke Thumb',
        curp,
        email: 't@b.c',
        phone: '1234567890',
        address: 'x',
      },
      thumbFrontJpegBase64: TINY_JPEG_B64,
    },
    { requireCloudSecrets: true }
  );
  assert(create.status === 201, `create ${create.status}`);
  assert(create.body.thumbSaved === true, 'thumbSaved');
  const affiliateId = String(create.body.affiliateId || '');
  assert(affiliateId, 'affiliateId');

  const denied = await processSecureThumbRequest({
    authorizationHeader: 'Bearer wrong',
    affiliateId,
  });
  assert(denied.status === 401, `expected 401 got ${denied.status}`);

  const thumb = await processSecureThumbRequest({
    authorizationHeader: `Bearer ${SECRET}`,
    affiliateId,
  });
  assert(thumb.status === 200, `thumb ${thumb.status} ${JSON.stringify(thumb.body)}`);
  assert(typeof thumb.body.base64 === 'string', 'base64');

  const del = await processSecureAffiliateDeleteRequest(
    { affiliateId, curp },
    {
      authorizationHeader: `Bearer ${SECRET}`,
      requireCloudSecrets: true,
    }
  );
  assert(del.status === 200 && del.body.deleted, 'delete');

  const gone = await processSecureThumbRequest({
    authorizationHeader: `Bearer ${SECRET}`,
    affiliateId,
  });
  assert(gone.status === 404, `expected 404 after delete got ${gone.status}`);

  console.log('MOCK_SMOKE PASS — ine front thumb (create → get → delete)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
