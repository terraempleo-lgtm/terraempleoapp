import { useEffect, useState, useCallback, useRef } from 'react';
import * as Network from 'expo-network';
import api from '../services/api';

const listeners = new Set();
let lastKnownState = { isOnline: true, type: 'unknown' };

function notify(state) {
  lastKnownState = state;
  listeners.forEach(fn => fn(state));
}

async function verificarConexionReal() {
  try {
    const net = await Network.getNetworkStateAsync();
    const online = !!(net.isConnected && (net.isInternetReachable !== false));
    notify({ isOnline: online, type: net.type || 'unknown' });
    return online;
  } catch {
    return lastKnownState.isOnline;
  }
}

// Ping ligero al servidor para confirmar reachability cuando lo necesitamos
async function pingServidor(timeoutMs = 4000) {
  try {
    const baseURL = api?.defaults?.baseURL;
    if (!baseURL) return true;
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(`${baseURL}/health`, { method: 'GET', signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

export function useNetworkStatus() {
  const [state, setState] = useState(lastKnownState);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (subscribedRef.current) return;
    subscribedRef.current = true;

    listeners.add(setState);
    // chequeo inicial
    verificarConexionReal();

    // expo-network expone evento de cambio de conectividad solo en algunas
    // plataformas; usamos polling cada 8s como fallback robusto.
    const interval = setInterval(() => { verificarConexionReal(); }, 8000);

    return () => {
      listeners.delete(setState);
      clearInterval(interval);
      subscribedRef.current = false;
    };
  }, []);

  const verificar = useCallback(async () => {
    const ok = await verificarConexionReal();
    if (!ok) return false;
    // doble check con ping si nos importa reachability real
    const reach = await pingServidor();
    if (!reach) notify({ ...lastKnownState, isOnline: false });
    return reach;
  }, []);

  return { isOnline: state.isOnline, type: state.type, verificar };
}

export function getNetworkStateSync() {
  return lastKnownState;
}

export async function refreshNetworkState() {
  return verificarConexionReal();
}
