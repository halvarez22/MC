/**
 * Test de integración Zero-PII (D.1) — Playwright
 * CURP canario + ACK + purge → IndexedDB sin PII ni data:image
 *
 * Requiere: VITE_E2E_HOOKS=true (hooks en window.__MC_D1__)
 */

import { test, expect } from '@playwright/test';

const FIXTURE_CURP = 'GARC800101HDFRRL09';
const DB_NAME = 'INEOfflineDB';
const STORE_NAME = 'pendingInes';

test.describe('D.1 Zero-PII post-ACK', () => {
  test('tras ACK válido, IndexedDB no retiene CURP ni blobs de imagen', async ({
    page,
  }) => {
    await page.goto('/');

    await page.waitForFunction(() => Boolean(window.__MC_D1__), null, {
      timeout: 15000,
    });

    const pendingId = await page.evaluate(
      async ({ curp, dbName, storeName }) => {
        const id = `test_${crypto.randomUUID()}`;
        await new Promise<void>((resolve, reject) => {
          const open = indexedDB.open(dbName, 2);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(storeName, 'readwrite');
            tx.objectStore(storeName).put({
              id,
              rawText: `CURP ${curp}`,
              capturedAt: new Date().toISOString(),
              processed: false,
              status: 'open',
              structuredData: { curp, nombre_completo: 'PRUEBA QA' },
              imageDataFrontal: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
              imageDataPosterior: null,
            });
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
          };
        });
        return id;
      },
      { curp: FIXTURE_CURP, dbName: DB_NAME, storeName: STORE_NAME }
    );

    // Object URL tracked + ACK + tombstone + purge
    const purgeResult = await page.evaluate(
      async ({ id, curp }) => {
        const api = window.__MC_D1__;
        if (!api) throw new Error('__MC_D1__ no instalado');

        const blob = new Blob(['fake-ine'], { type: 'image/jpeg' });
        api.createTrackedObjectUrl(blob);
        const trackedBefore = api.getTrackedObjectUrlCount();

        const ack = await api.acknowledgeIneSync({
          curp,
          nombre_completo: 'PRUEBA QA',
        });
        if (!api.isValidSyncAck(ack)) {
          throw new Error(`ACK inválido: ${JSON.stringify(ack)}`);
        }

        await api.markForLocalPurge(id, ack.syncId);
        await api.executeLocalPurge(id);

        return {
          trackedBefore,
          trackedAfter: api.getTrackedObjectUrlCount(),
          syncId: ack.syncId,
        };
      },
      { id: pendingId, curp: FIXTURE_CURP }
    );

    expect(purgeResult.trackedBefore).toBeGreaterThan(0);
    expect(purgeResult.trackedAfter).toBe(0);

    const leftover = await page.evaluate(
      async ({ id, dbName, storeName }) => {
        return new Promise<{
          exists: boolean;
          haystack: string;
          anyCurpOrImage: boolean;
        }>((resolve, reject) => {
          const open = indexedDB.open(dbName, 2);
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const db = open.result;
            const tx = db.transaction(storeName, 'readonly');
            const store = tx.objectStore(storeName);
            const getReq = store.get(id);
            getReq.onsuccess = () => {
              const row = getReq.result;
              const allReq = store.getAll();
              allReq.onsuccess = () => {
                const haystack = JSON.stringify(allReq.result || []);
                resolve({
                  exists: Boolean(row),
                  haystack,
                  anyCurpOrImage:
                    haystack.includes('GARC800101HDFRRL09') ||
                    haystack.includes('data:image'),
                });
              };
              allReq.onerror = () => reject(allReq.error);
            };
            getReq.onerror = () => reject(getReq.error);
          };
        });
      },
      { id: pendingId, dbName: DB_NAME, storeName: STORE_NAME }
    );

    expect(leftover.exists).toBe(false);
    expect(leftover.haystack).not.toContain(FIXTURE_CURP);
    expect(leftover.haystack).not.toContain('data:image');
    expect(leftover.anyCurpOrImage).toBe(false);
  });
});
