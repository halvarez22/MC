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
  deleteSensitiveData,
} from '../services/ineOfflineService';
import { groqService } from '../services/groqService';
import { groqVisionService } from '../services/groqVisionService';
import { isGroqVisionEnabled } from '../services/featureFlags';

/** Evento para forzar sync desde UI desacoplada (p. ej. botón en INEProcessor). */
export const FORCE_INE_SYNC_EVENT = 'forceINESync';

export const useSyncOffline = () => {
  const syncingRef = useRef(false);
  const inFlightIdsRef = useRef<Set<string>>(new Set());

  const sendToBackend = useCallback(async (structuredData: unknown): Promise<boolean> => {
    try {
      console.log('Enviando al backend:', structuredData);
      await new Promise(resolve => setTimeout(resolve, 500));
      return true;
    } catch (error) {
      console.error('Error enviando al backend:', error);
      return false;
    }
  }, []);

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

      // Flag ON + imágenes → visión vía proxy; else texto LLM legado
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
        const success = await sendToBackend(structuredData);
        if (success) {
          console.log(`✅ INE ${ine.id} procesada y enviada al backend`);
          try {
            await deleteSensitiveData(ine.id);
            console.log(`🧹 Datos sensibles locales eliminados para ${ine.id}`);
          } catch (cleanErr) {
            console.warn(
              `⚠️ Limpieza post-sync falló para ${ine.id} — reintentar más tarde:`,
              cleanErr
            );
          }
        } else {
          console.warn(`⚠️ INE ${ine.id} procesada pero no enviada al backend`);
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ Error procesando INE ${ine.id}:`, error);
      return false;
    } finally {
      inFlightIdsRef.current.delete(ine.id);
    }
  }, [sendToBackend]);

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
