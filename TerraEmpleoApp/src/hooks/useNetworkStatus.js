import { useState, useEffect, useCallback, useRef } from 'react';
import { sincronizarCola } from '../utils/postulacionesQueue';

const PING_URL = 'https://api.terrampleo.com/api/health';
const PING_INTERVAL = 15000;
const PING_TIMEOUT = 5000;

async function pingServer() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PING_TIMEOUT);
  try {
    const res = await fetch(PING_URL, { method: 'HEAD', signal: controller.signal });
    return res.ok || res.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const prevOnline = useRef(true);

  const verificar = useCallback(async () => {
    const online = await pingServer();
    setIsOnline(online);
    if (online && !prevOnline.current) {
      sincronizarCola().catch(() => {});
    }
    prevOnline.current = online;
  }, []);

  useEffect(() => {
    verificar();
    const interval = setInterval(verificar, PING_INTERVAL);
    return () => clearInterval(interval);
  }, [verificar]);

  return { isOnline, verificar };
}
