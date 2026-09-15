/**
 * D.2b — Sync seguro + purga Zero-PII (2xx y 409).
 * No modifica executeLocalPurge / useDrainPendingPurge.
 */

import { test, expect } from '@playwright/test';

const FIXTURE_CURP = 'GARC800101HDFRRL09';
const DB_NAME = 'INEOfflineDB';
const STORE_NAME = 'pendingInes';

async function seedPending(
  page: import('@playwright/test').Page,
  curp: string
): Promise<string> {
  return page.evaluate(
    async ({ curp: c, dbName, storeName }) => {
      const id = `test_${crypto.randomUUID()}`;
      await new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(dbName, 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(storeName, 'readwrite');
          tx.objectStore(storeName).put({
            id,
            rawText: `CURP ${c}`,
            capturedAt: new Date().toISOString(),
            processed: false,
            status: 'open',
            structuredData: { curp: c, nombre_completo: 'PRUEBA QA' },
            imageDataFrontal: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
            imageDataPosterior: null,
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      });
      return id;
    },
    { curp, dbName: DB_NAME, storeName: STORE_NAME }
  );
}

async function assertIdbClean(
  page: import('@playwright/test').Page,
  id: string
): Promise<void> {
  const leftover = await page.evaluate(
    async ({ id: rowId, dbName, storeName, curp }) => {
      return new Promise<{ exists: boolean; dirty: boolean }>((resolve, reject) => {
        const open = indexedDB.open(dbName, 2);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getReq = store.get(rowId);
          getReq.onsuccess = () => {
            const allReq = store.getAll();
            allReq.onsuccess = () => {
              const haystack = JSON.stringify(allReq.result || []);
              resolve({
                exists: Boolean(getReq.result),
                dirty: haystack.includes(curp) || haystack.includes('data:image'),
              });
            };
            allReq.onerror = () => reject(allReq.error);
          };
          getReq.onerror = () => reject(getReq.error);
        };
      });
    },
    { id, dbName: DB_NAME, storeName: STORE_NAME, curp: FIXTURE_CURP }
  );
  expect(leftover.exists).toBe(false);
  expect(leftover.dirty).toBe(false);
}

test.describe('D.2b secure sync + purge', () => {
  test('2xx ACK → IndexedDB limpio', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__MC_D1__), null, {
      timeout: 15000,
    });

    const pendingId = await seedPending(page, FIXTURE_CURP);

    const result = await page.evaluate(
      async ({ id, curp }) => {
        const api = window.__MC_D1__;
        if (!api) throw new Error('__MC_D1__ no instalado');
        api.createTrackedObjectUrl(new Blob(['x'], { type: 'image/jpeg' }));
        const ack = await api.acknowledgeIneSync({
          curp,
          nombre_completo: 'PRUEBA QA',
          orgId: `e2e_${crypto.randomUUID()}`,
        });
        if (!api.isValidSyncAck(ack)) {
          throw new Error(`ACK inválido: ${JSON.stringify(ack)}`);
        }
        await api.markForLocalPurge(id, ack.syncId);
        await api.executeLocalPurge(id);
        return { status: ack.status, syncId: ack.syncId };
      },
      { id: pendingId, curp: FIXTURE_CURP }
    );

    expect([200, 201]).toContain(result.status);
    expect(result.syncId.length).toBeGreaterThan(0);
    await assertIdbClean(page, pendingId);
  });

  test('409 duplicado → ACK + IndexedDB limpio', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__MC_D1__), null, {
      timeout: 15000,
    });

    const orgId = `e2e_dup_${crypto.randomUUID()}`;
    const payload = {
      curp: FIXTURE_CURP,
      nombre_completo: 'PRUEBA QA',
      orgId,
    };

    // Primera sync (crea)
    await page.evaluate(async (p) => {
      const api = window.__MC_D1__;
      if (!api) throw new Error('__MC_D1__ no instalado');
      const ack = await api.acknowledgeIneSync(p);
      if (!api.isValidSyncAck(ack)) throw new Error(JSON.stringify(ack));
    }, payload);

    const pendingId = await seedPending(page, FIXTURE_CURP);

    const result = await page.evaluate(
      async ({ id, p }) => {
        const api = window.__MC_D1__;
        if (!api) throw new Error('__MC_D1__ no instalado');
        const ack = await api.acknowledgeIneSync(p);
        if (!api.isValidSyncAck(ack)) {
          throw new Error(`ACK inválido: ${JSON.stringify(ack)}`);
        }
        await api.markForLocalPurge(id, ack.syncId);
        await api.executeLocalPurge(id);
        return { status: ack.status, syncId: ack.syncId };
      },
      { id: pendingId, p: payload }
    );

    expect(result.status).toBe(409);
    await assertIdbClean(page, pendingId);
  });

  test('5xx → NO purgar (U-First)', async ({ page }) => {
    await page.route('**/api/affiliates/secure', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'forced_fail' }),
      });
    });

    await page.goto('/');
    await page.waitForFunction(() => Boolean(window.__MC_D1__), null, {
      timeout: 15000,
    });

    const pendingId = await seedPending(page, FIXTURE_CURP);

    const outcome = await page.evaluate(
      async ({ id, curp }) => {
        const api = window.__MC_D1__;
        if (!api) throw new Error('__MC_D1__ no instalado');
        const ack = await api.acknowledgeIneSync({
          curp,
          nombre_completo: 'PRUEBA QA',
        });
        const valid = api.isValidSyncAck(ack);
        if (valid) {
          await api.markForLocalPurge(id, ack.syncId);
          await api.executeLocalPurge(id);
        }
        return { valid, status: ack.status };
      },
      { id: pendingId, curp: FIXTURE_CURP }
    );

    expect(outcome.valid).toBe(false);
    expect(outcome.status).toBe(500);

    const stillThere = await page.evaluate(
      async ({ id, dbName, storeName }) => {
        return new Promise<boolean>((resolve, reject) => {
          const open = indexedDB.open(dbName, 2);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const tx = open.result.transaction(storeName, 'readonly');
            const req = tx.objectStore(storeName).get(id);
            req.onsuccess = () => resolve(Boolean(req.result));
            req.onerror = () => reject(req.error);
          };
        });
      },
      { id: pendingId, dbName: DB_NAME, storeName: STORE_NAME }
    );
    expect(stillThere).toBe(true);
  });
});
