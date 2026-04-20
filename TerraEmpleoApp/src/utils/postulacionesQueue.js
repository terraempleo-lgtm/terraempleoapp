import AsyncStorage from '@react-native-async-storage/async-storage';
import { vacantesAPI } from '../services/api';

const KEY = 'postulaciones_queue_v1';

export async function encolarPostulacion(vacanteId, mensaje = null) {
  try {
    const existing = await leerCola();
    const yaEnCola = existing.some((p) => Number(p.vacante_id) === Number(vacanteId));
    if (yaEnCola) return;
    const nueva = { vacante_id: vacanteId, mensaje, enqueued_at: Date.now() };
    await AsyncStorage.setItem(KEY, JSON.stringify([...existing, nueva]));
  } catch (_) {}
}

export async function leerCola() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function sincronizarCola() {
  const cola = await leerCola();
  if (cola.length === 0) return { enviadas: 0 };

  const exitosas = [];
  for (const item of cola) {
    try {
      await vacantesAPI.postularse({ vacante_id: item.vacante_id, mensaje: item.mensaje });
      exitosas.push(item.vacante_id);
    } catch (err) {
      const status = err.response?.status;
      // 409 = ya postulado → se puede limpiar igual
      if (status === 409) exitosas.push(item.vacante_id);
    }
  }

  const restantes = cola.filter((p) => !exitosas.includes(p.vacante_id));
  await AsyncStorage.setItem(KEY, JSON.stringify(restantes));
  return { enviadas: exitosas.length };
}

export async function estaEnCola(vacanteId) {
  const cola = await leerCola();
  return cola.some((p) => Number(p.vacante_id) === Number(vacanteId));
}
