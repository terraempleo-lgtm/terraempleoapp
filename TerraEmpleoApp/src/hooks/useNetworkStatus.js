import { useState, useEffect, useCallback } from 'react';
import * as Network from 'expo-network';
import { sincronizarCola } from '../utils/postulacionesQueue';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);

  const verificar = useCallback(async () => {
    try {
      const state = await Network.getNetworkStateAsync();
      const online = state.isConnected !== false;
      setIsOnline(online);
      if (online) {
        // Intentar sincronizar cola de postulaciones pendientes
        sincronizarCola().catch(() => {});
      }
    } catch (_) {
      setIsOnline(true); // si falla la verificación, asumir online
    }
  }, []);

  useEffect(() => {
    verificar();
    // Verificar cada 10 segundos
    const interval = setInterval(verificar, 10000);
    return () => clearInterval(interval);
  }, [verificar]);

  return { isOnline, verificar };
}
