import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { tutorialesAPI } from '../services/api';
import { useAuth } from './AuthContext';

// Claves de los tutoriales de primera vez. Deben existir también en el
// allowlist del backend (controllers/tutorialesController.js). Para agregar
// un tutorial nuevo: sumar la clave en ambos lados y usar
// useTutorialPrimeraVez(TUTORIALES.X) en la pantalla correspondiente.
export const TUTORIALES = {
  CUADERNO: 'cuaderno',
  FINANZAS: 'finanzas',
  NUEVA_JORNADA: 'nueva_jornada',
};

// Cache local POR USUARIO: respaldo offline del estado del servidor.
// - vistos: tutoriales confirmados como vistos en este dispositivo
// - pendientes: vistos localmente pero aún sin sincronizar (sin red)
const cacheKey = (userId) => `terraempleo_tutoriales_v1_${userId}`;

const TutorialContext = createContext(null);

export function TutorialProvider({ children }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  // 'idle' → nadie lo pidió aún | 'cargando' | 'listo' | 'error' (sin red y
  // sin cache: NO se muestra ningún tutorial — mejor omitirlo que repetírselo
  // a alguien que ya lo vio en otro dispositivo).
  const [estado, setEstado] = useState('idle');
  const [vistos, setVistos] = useState(() => new Set());
  const cargandoRef = useRef(false);

  // Cambio de cuenta (login/logout) → resetear: cada usuario tiene su estado.
  useEffect(() => {
    setEstado('idle');
    setVistos(new Set());
    cargandoRef.current = false;
  }, [userId]);

  const leerCache = useCallback(async () => {
    if (!userId) return { vistos: [], pendientes: [] };
    try {
      const raw = await AsyncStorage.getItem(cacheKey(userId));
      const data = raw ? JSON.parse(raw) : {};
      return { vistos: data.vistos || [], pendientes: data.pendientes || [] };
    } catch (_) {
      return { vistos: [], pendientes: [] };
    }
  }, [userId]);

  const escribirCache = useCallback(async (vistosArr, pendientesArr) => {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(cacheKey(userId), JSON.stringify({ vistos: vistosArr, pendientes: pendientesArr }));
    } catch (_) {}
  }, [userId]);

  // Carga perezosa: solo consulta el servidor cuando una pantalla con tutorial
  // lo pide (vía useTutorialPrimeraVez) — los roles sin tutoriales no generan
  // tráfico ni estado.
  const ensureCargado = useCallback(async () => {
    if (!userId || cargandoRef.current || estado === 'listo') return;
    cargandoRef.current = true;
    setEstado('cargando');
    const cache = await leerCache();
    try {
      const res = await tutorialesAPI.vistos();
      const servidor = res.data?.tutoriales || [];
      // Reintentar marcas que quedaron pendientes por falta de red
      const porSincronizar = cache.pendientes.filter((k) => !servidor.includes(k));
      const sinSincronizar = [];
      for (const key of porSincronizar) {
        try { await tutorialesAPI.marcarVisto(key); } catch (_) { sinSincronizar.push(key); }
      }
      // El servidor es la autoridad (más lo pendiente de sincronizar): si un
      // admin resetea tutoriales en la BD, el cache local NO los resucita y
      // el tutorial vuelve a aparecer en todos los dispositivos.
      const todos = new Set([...servidor, ...porSincronizar]);
      setVistos(todos);
      setEstado('listo');
      escribirCache([...todos].filter((k) => !sinSincronizar.includes(k)), sinSincronizar);
    } catch (_) {
      // Sin servidor: el cache local evita repetir un tutorial ya visto en
      // este dispositivo. Sin cache tampoco → 'error' (no se muestra nada) y
      // se permite reintentar en la próxima pantalla.
      const locales = new Set([...cache.vistos, ...cache.pendientes]);
      setVistos(locales);
      setEstado(locales.size > 0 ? 'listo' : 'error');
      cargandoRef.current = false;
    }
  }, [userId, estado, leerCache, escribirCache]);

  const haVisto = useCallback((key) => vistos.has(key), [vistos]);

  // Optimista: se marca en memoria y cache de inmediato (no se vuelve a abrir
  // ni siquiera sin red); el servidor se entera ya o en la próxima carga.
  const marcarVisto = useCallback(async (key) => {
    setVistos((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
    const cache = await leerCache();
    const vistosArr = [...new Set([...cache.vistos, key])];
    try {
      await tutorialesAPI.marcarVisto(key);
      await escribirCache(vistosArr, cache.pendientes.filter((k) => k !== key));
    } catch (_) {
      await escribirCache(vistosArr, [...new Set([...cache.pendientes, key])]);
    }
  }, [leerCache, escribirCache]);

  return (
    <TutorialContext.Provider value={{ estado, haVisto, marcarVisto, ensureCargado }}>
      {children}
    </TutorialContext.Provider>
  );
}

export function useTutoriales() {
  const ctx = useContext(TutorialContext);
  if (!ctx) throw new Error('useTutoriales debe usarse dentro de TutorialProvider');
  return ctx;
}
