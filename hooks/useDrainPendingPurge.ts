/**
 * D.1 — Al arrancar, drena tombstones `pending_purge` (resiliencia post-ACK).
 * Sin UI; solo servicios de purga. Prohibido D.2.
 */

import { useEffect, useRef } from 'react';
import {
  executeLocalPurge,
  listPendingPurgeIds,
} from '../services/ineOfflineService';
import { offlineService } from '../services/offlineService';

export function useDrainPendingPurge(): void {
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    const drain = async () => {
      try {
        const ineIds = await listPendingPurgeIds();
        for (const id of ineIds) {
          try {
            await executeLocalPurge(id);
            console.info(`[D.1] Purga al arranque OK (INE): ${id}`);
          } catch (err) {
            console.warn(`[D.1] Purga al arranque falló (INE ${id}):`, err);
          }
        }

        const regIds = await offlineService.listPendingPurgeIds();
        for (const id of regIds) {
          try {
            await offlineService.executeLocalPurge(id);
            console.info(`[D.1] Purga al arranque OK (ficha): ${id}`);
          } catch (err) {
            console.warn(`[D.1] Purga al arranque falló (ficha ${id}):`, err);
          }
        }
      } catch (err) {
        console.warn('[D.1] Drain pending_purge falló:', err);
      }
    };

    void drain();
  }, []);
}
