import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Fecha de referencia COMPARTIDA entre las pestañas del Cuaderno (Finanzas,
// Nómina, Rendimiento, Balance). Antes cada pantalla tenía su propio
// useState(new Date()) y al cambiar de pestaña se volvía al mes actual —
// el mes/semana elegidos ahora se mantienen hasta que el usuario los cambie
// o cierre la app.
//
// "Congelar" además persiste esa fecha en disco (AsyncStorage): si está
// congelada, cerrar y volver a abrir la app NO la devuelve al mes actual —
// sin congelar, cada apertura de la app arranca en el mes de hoy, igual que
// antes.

const CONGELADO_KEY = 'cuaderno_periodo_congelado_v1';
const FECHA_KEY = 'cuaderno_periodo_fecha_v1';

let fechaRef = new Date();
let congelado = false;
const listeners = new Set();

function emitir() { for (const l of listeners) l(); }

(async () => {
  try {
    const [c, f] = await Promise.all([
      AsyncStorage.getItem(CONGELADO_KEY),
      AsyncStorage.getItem(FECHA_KEY),
    ]);
    if (c === '1') {
      congelado = true;
      if (f) {
        const d = new Date(f);
        if (!Number.isNaN(d.getTime())) fechaRef = d;
      }
      emitir();
    }
  } catch { /* no-op */ }
})();

export function getFechaRef() { return fechaRef; }
export function getCongelado() { return congelado; }

export function setFechaRef(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return;
  fechaRef = d;
  if (congelado) AsyncStorage.setItem(FECHA_KEY, d.toISOString()).catch(() => {});
  emitir();
}

// Setea año+mes conservando un día válido (día 1, para evitar overflow de mes).
export function setMesRef(anio, mes /* 1-12 */) {
  setFechaRef(new Date(anio, mes - 1, 1));
}

export function toggleCongelado() {
  congelado = !congelado;
  AsyncStorage.setItem(CONGELADO_KEY, congelado ? '1' : '0').catch(() => {});
  if (congelado) AsyncStorage.setItem(FECHA_KEY, fechaRef.toISOString()).catch(() => {});
  emitir();
}

function suscribir(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Hook: devuelve la fecha de referencia global y se re-renderiza al cambiar.
export function useFechaRef() {
  return useSyncExternalStore(suscribir, getFechaRef, getFechaRef);
}

// Hook: true si el mes/fecha está congelado.
export function useCongelado() {
  return useSyncExternalStore(suscribir, getCongelado, getCongelado);
}

// Lunes de la semana de la fecha de referencia (para Nómina).
export function lunesDe(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}
