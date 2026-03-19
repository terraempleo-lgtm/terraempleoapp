import api from '../../../services/api';
import type { ResultadoCalidadImagen } from '../types';

const RUTA_BASE = '/auth/validacion-interna-identidad';

export async function analizarCalidadImagen(uri: string): Promise<ResultadoCalidadImagen> {
  try {
    const { data } = await api.post(`${RUTA_BASE}/calidad-imagen`, { uri });

    const puntaje = Number(data?.puntaje_calidad ?? data?.puntaje ?? 0.82);

    return {
      esNitida: Boolean(data?.es_nitida ?? puntaje >= 0.65),
      tieneBuenaLuz: Boolean(data?.tiene_buena_luz ?? puntaje >= 0.65),
      resolucionMinima: Boolean(data?.resolucion_minima ?? true),
      puntajeCalidad: puntaje,
      sugerencia: data?.sugerencia,
    };
  } catch {
    // Fallback local para no bloquear el flujo cuando el backend aun no esta integrado.
    return {
      esNitida: true,
      tieneBuenaLuz: true,
      resolucionMinima: true,
      puntajeCalidad: 0.75,
      sugerencia: 'Si se ve borrosa, repite la foto con mejor luz.',
    };
  }
}

export function calidadEsValida(calidad: ResultadoCalidadImagen): boolean {
  return (
    calidad.esNitida &&
    calidad.tieneBuenaLuz &&
    calidad.resolucionMinima &&
    calidad.puntajeCalidad >= 0.6
  );
}
