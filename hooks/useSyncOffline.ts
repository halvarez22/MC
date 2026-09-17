// Hook para sincronización automática de INEs offline
// Procesa INEs pendientes cuando hay conexión a internet
// ÚNICO mount de producto: App.tsx (no montar en INEProcessor)
// Idempotencia: mutex global de sync + Set de ids in-flight (Regla 6)

import { useEffect, useCallback, useRef } from 'react';
import {
  getUnprocessedInes,
  markINEAsProcessed,
  getINEStats,
  repairCorruptedInes,
  markForLocalPurge,
  executeLocalPurge,
} from '../services/ineOfflineService';
import { groqService } from '../services/groqService';
import { groqVisionService } from '../services/groqVisionService';
import { isGroqVisionEnabled } from '../services/featureFlags';
import {
  acknowledgeIneSync,
  isValidSyncAck,
} from '../services/syncAckService';
import { buildIneFrontThumbBase64 } from '../services/ineThumbService';

/** Evento para forzar sync desde UI desacoplada (p. ej. botón en INEProcessor). */
export const FORCE_INE_SYNC_EVENT = 'forceINESync';

export const useSyncOffline = () => {
  const syncingRef = useRef(false);
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  const processSingleINE = useCallback(async (ine: {
    id: string;
    rawText: string;
    imageData?: string;
    imageDataFrontal?: string | null;
    imageDataPosterior?: string | null;
  }) => {
    if (inFlightIdsRef.current.has(ine.id)) {
      console.log(`⏭️ INE ${ine.id} ya en vuelo — skip`);
      return false;
    }

    inFlightIdsRef.current.add(ine.id);
    try {
      console.log(`Procesando INE ${ine.id}...`);

      let structuredData: unknown;

      const frontal = ine.imageDataFrontal || ine.imageData;
      const posterior = ine.imageDataPosterior;

      if (isGroqVisionEnabled() && frontal) {
        console.log(`🚀 Sync visión proxy para ${ine.id}`);
        structuredData = await groqVisionService.extractIneFromBase64(
          frontal,
          posterior
        );
      } else {
        structuredData = await groqService.processINEText(ine.rawText);
      }

      await markINEAsProcessed(ine.id, structuredData);

      if (navigator.onLine) {
        // D.2b: POST /api/affiliates/secure — ACK 2xx|409 → purga; 5xx/red → no purgar
        let syncPayload: unknown = structuredData;
        if (frontal) {
          try {
            const thumb = await buildIneFrontThumbBase64(frontal);
            if (thumb) {
              syncPayload = {
                ...(structuredData && typeof structuredData === 'object'
                  ? (structuredData as object)
                  : {}),
                thumbFrontJpegBase64: thumb,
              };
            } else {
              console.warn('[sync] miniatura INE: resize null');
            }
          } catch (thumbErr) {
            console.warn('[sync] thumb build skip', thumbErr);
          }
        }
        const ack = await acknowledgeIneSync(syncPayload);
        if (isValidSyncAck(ack)) {
          console.log(
            `✅ INE ${ine.id} ACK ${ack.status} syncId=${ack.syncId} affiliateId=${ack.affiliateId}`
          );
          try {
            await markForLocalPurge(ine.id, ack.syncId);
            await executeLocalPurge(ine.id);
            console.log(`🧹 Purga local completada para ${ine.id}`);
          } catch (cleanErr) {
            console.warn(
              `⚠️ Purga post-ACK falló para ${ine.id} — queda pending_purge:`,
              cleanErr
            );
          }
        } else {
          console.warn(
            `⚠️ INE ${ine.id} sin ACK válido (status=${ack.status}): ${'error' in ack ? ack.error : ''}`
          );
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ Error procesando INE ${ine.id}:`, error);
      return false;
    } finally {
      inFlightIdsRef.current.delete(ine.id);
    }
  }, []);

  const syncPendingInes = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('🔌 Sin conexión, saltando sincronización');
      return;
    }

    if (syncingRef.current) {
      console.log('⏭️ Sync ya en curso — skip (mutex)');
      return;
    }

    syncingRef.current = true;
    try {
      console.log('🔄 Iniciando sincronización de INEs offline...');

      try {
        await repairCorruptedInes();
        console.log('🔧 Registros corruptos reparados');
      } catch (repairError) {
        console.warn('⚠️ No se pudieron reparar registros corruptos:', repairError);
      }

      const unprocessedInes = await getUnprocessedInes();
      console.log(`📋 Encontradas ${unprocessedInes.length} INEs pendientes`);

      if (unprocessedInes.length === 0) {
        console.log('✅ No hay INEs pendientes de procesar');
        return;
      }

      const groqAvailable = await groqService.isAvailable();
      if (!groqAvailable) {
        console.warn('⚠️ Groq no disponible, esperando próxima sincronización');
        return;
      }

      const batchSize = 3;
      let processed = 0;

      for (let i = 0; i < unprocessedInes.length; i += batchSize) {
        const batch = unprocessedInes.slice(i, i + batchSize);
        console.log(`Procesando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(unprocessedInes.length / batchSize)}`);

        const promises = batch.map(processSingleINE);
        const results = await Promise.allSettled(promises);

        processed += results.filter(result => result.status === 'fulfilled' && result.value).length;

        if (i + batchSize < unprocessedInes.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const stats = await getINEStats();
      console.log(`🎉 Sincronización completada: ${processed} procesadas, ${stats.pending} pendientes`);

    } catch (error) {
      console.error('❌ Error en sincronización:', error);
    } finally {
      syncingRef.current = false;
    }
  }, [processSingleINE]);

  useEffect(() => {
    // NOTA (HRU / Cero Regresiones): se eliminó cleanupOldData + clearAllInes automático.

    const initialSyncTimeout = setTimeout(() => {
      console.log('🔄 Sincronización inicial de INEs (con delay)...');
      syncPendingInes();
    }, 3000);

    const handleOnline = () => {
      console.log('🌐 Conexión recuperada, iniciando sincronización...');
      setTimeout(() => syncPendingInes(), 1000);
    };

    const handleForceSync = () => {
      console.log('📡 forceINESync recibido — iniciando sincronización...');
      syncPendingInes();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener(FORCE_INE_SYNC_EVENT, handleForceSync);

    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        console.log('⏰ Sincronización periódica automática...');
        syncPendingInes();
      }
    }, 10 * 60 * 1000);

    return () => {
      clearTimeout(initialSyncTimeout);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener(FORCE_INE_SYNC_EVENT, handleForceSync);
      clearInterval(intervalId);
    };
  }, [syncPendingInes]);

  return {
    syncNow: syncPendingInes,
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : false,
  };
};
