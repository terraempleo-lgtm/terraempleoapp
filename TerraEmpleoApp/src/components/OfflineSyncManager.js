import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { syncAll, flushOutbox } from '../db/sync';

/**
 * Monta listeners globales para sincronizar cache local con el servidor:
 * - Al volver a foreground (AppState 'active')
 * - Al recuperar conexión (isOnline pasa de false a true)
 * - Periódicamente cada 5 min mientras la app esté activa
 *
 * Se renderiza dentro de AuthProvider para que solo corra con usuario logueado.
 */
export default function OfflineSyncManager() {
  const { user } = useAuth();
  const { isOnline } = useNetworkStatus();
  const lastSyncRef = useRef(0);
  const prevOnlineRef = useRef(isOnline);
  const appStateRef = useRef(AppState.currentState);

  const trySync = (motivo) => {
    if (!user) return;
    const now = Date.now();
    // dedup: no sincronizar dos veces dentro de 8s
    if (now - lastSyncRef.current < 8000) return;
    lastSyncRef.current = now;
    syncAll().catch(() => {});
    flushOutbox().catch(() => {});
  };

  // Sync inicial al login
  useEffect(() => {
    if (user) trySync('login');
  }, [user]);

  // Sync cuando vuelve a foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const prev = appStateRef.current;
      appStateRef.current = next;
      if (prev.match(/inactive|background/) && next === 'active') {
        trySync('foreground');
      }
    });
    return () => sub.remove();
  }, [user]);

  // Sync cuando recupera internet
  useEffect(() => {
    if (prevOnlineRef.current === false && isOnline === true) {
      trySync('online-recovered');
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline]);

  // Periódico cada 5 min
  useEffect(() => {
    if (!user) return;
    const id = setInterval(() => { trySync('periodic'); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [user]);

  return null;
}
