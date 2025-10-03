// Hook para sincronización automática de INEs offline
// Procesa INEs pendientes cuando hay conexión a internet

import { useEffect, useCallback } from 'react';
import {
  getUnprocessedInes,
  markINEAsProcessed,
  getINEStats,
  repairCorruptedInes
} from '../services/ineOfflineService';
import { groqService } from '../services/groqService';

interface SyncStatus {
  isOnline: boolean;
  pendingCount: number;
  processedCount: number;
  lastSync?: Date;
  error?: string;
}

export const useSyncOffline = () => {
  // Función para enviar datos al backend (adaptar según tu API)
  const sendToBackend = useCallback(async (structuredData: any): Promise<boolean> => {
    try {
      // Aquí puedes integrar con tu servicio de Firebase o API
      // Por ahora solo simulamos el envío
      console.log('Enviando al backend:', structuredData);

      // Simular delay de red
      await new Promise(resolve => setTimeout(resolve, 500));

      // Aquí iría tu llamada real al backend
      // const response = await fetch('/api/submit-ine', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(structuredData)
      // });
      // return response.ok;

      return true; // Simular éxito
    } catch (error) {
      console.error('Error enviando al backend:', error);
      return false;
    }
  }, []);

  // Procesar una INE individual
  const processSingleINE = useCallback(async (ine: any) => {
    try {
      console.log(`Procesando INE ${ine.id}...`);

      // Procesar con Groq
      const structuredData = await groqService.processINEText(ine.rawText);

      // Marcar como procesada en local
      await markINEAsProcessed(ine.id, structuredData);

      // Enviar al backend si hay conexión
      if (navigator.onLine) {
        const success = await sendToBackend(structuredData);
        if (success) {
          console.log(`✅ INE ${ine.id} procesada y enviada al backend`);
        } else {
          console.warn(`⚠️ INE ${ine.id} procesada pero no enviada al backend`);
        }
      }

      return true;
    } catch (error) {
      console.error(`❌ Error procesando INE ${ine.id}:`, error);
      return false;
    }
  }, [sendToBackend]);

  // Sincronizar todas las INEs pendientes
  const syncPendingInes = useCallback(async () => {
    if (!navigator.onLine) {
      console.log('🔌 Sin conexión, saltando sincronización');
      return;
    }

    try {
      console.log('🔄 Iniciando sincronización de INEs offline...');

      // Primero, intentar reparar registros corruptos
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

      // Verificar que Groq esté disponible
      const groqAvailable = await groqService.isAvailable();
      if (!groqAvailable) {
        console.warn('⚠️ Groq no disponible, esperando próxima sincronización');
        return;
      }

      // Procesar INEs en lotes para no sobrecargar
      const batchSize = 3;
      let processed = 0;

      for (let i = 0; i < unprocessedInes.length; i += batchSize) {
        const batch = unprocessedInes.slice(i, i + batchSize);
        console.log(`Procesando lote ${Math.floor(i/batchSize) + 1}/${Math.ceil(unprocessedInes.length/batchSize)}`);

        const promises = batch.map(processSingleINE);
        const results = await Promise.allSettled(promises);

        processed += results.filter(result => result.status === 'fulfilled' && result.value).length;

        // Pequeño delay entre lotes
        if (i + batchSize < unprocessedInes.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const stats = await getINEStats();
      console.log(`🎉 Sincronización completada: ${processed} procesadas, ${stats.pending} pendientes`);

    } catch (error) {
      console.error('❌ Error en sincronización:', error);
    }
  }, [processSingleINE]);

  // Configurar sincronización automática
  useEffect(() => {
    // Sincronizar al montar el componente
    syncPendingInes();

    // Sincronizar cuando se recupera la conexión
    const handleOnline = () => {
      console.log('🌐 Conexión recuperada, iniciando sincronización...');
      syncPendingInes();
    };

    window.addEventListener('online', handleOnline);

    // Sincronizar periódicamente (cada 5 minutos) si hay conexión
    const intervalId = setInterval(() => {
      if (navigator.onLine) {
        syncPendingInes();
      }
    }, 5 * 60 * 1000); // 5 minutos

    return () => {
      window.removeEventListener('online', handleOnline);
      clearInterval(intervalId);
    };
  }, [syncPendingInes]);

  // Retornar estado y funciones útiles
  return {
    syncNow: syncPendingInes,
    isOnline: navigator.onLine,
  };
};
