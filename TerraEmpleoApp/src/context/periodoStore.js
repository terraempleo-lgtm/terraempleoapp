import { useSyncExternalStore } from 'react';

// Fecha de referencia COMPARTIDA entre las pestañas del Cuaderno (Finanzas,
// Nómina, Rendimiento, Balance). Antes cada pantalla tenía su propio
// useState(new Date()) y al cambiar de pestaña se volvía al mes actual —
// el mes/semana elegidos ahora se mantienen hasta que el usuario los cambie
// o cierre la app.

let fechaRef = new Date();
const listeners = new Set();

function emitir() { for (const l of listeners) l(); }

export function getFechaRef() { return fechaRef; }

export function setFechaRef(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return;
  fechaRef = d;
  emitir();
}

// Setea año+mes conservando un día válido (día 1, para evitar overflow de mes).
export function setMesRef(anio, mes /* 1-12 */) {
  setFechaRef(new Date(anio, mes - 1, 1));
}

function suscribir(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

// Hook: devuelve la fecha de referencia global y se re-renderiza al cambiar.
export function useFechaRef() {
  return useSyncExternalStore(suscribir, getFechaRef, getFechaRef);
}

// Lunes de la semana de la fecha de referencia (para Nómina).
export function lunesDe(ref) {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay();
  d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
  return d;
}
