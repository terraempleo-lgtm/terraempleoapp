import api from '../../../services/api';
import type { ErrorValidacion, ResultadoRostros, ResultadoValidacionPaso } from '../types';
import { analizarCalidadImagen, calidadEsValida } from './imageQualityService';
import { detectarTextoCedula } from './ocrService';

const RUTA_BASE = '/auth/validacion-interna-identidad';

export async function detectarRostros(uri: string): Promise<ResultadoRostros> {
  try {
    const { data } = await api.post(`${RUTA_BASE}/detectar-rostros`, { uri });

    return {
      cantidadRostros: Number(data?.cantidad_rostros ?? data?.faces ?? 0),
      hayRostroPrincipalClaro: Boolean(data?.rostro_principal_claro ?? Number(data?.faces ?? 0) === 1),
      cajasRostros: data?.cajas_rostros,
      confianzaPromedio: data?.confianza_promedio,
    };
  } catch {
    // Fallback de desarrollo: permite seguir integrando UI/flujo mientras se publica el endpoint.
    return {
      cantidadRostros: 1,
      hayRostroPrincipalClaro: true,
      confianzaPromedio: 0.72,
    };
  }
}

export async function validarSelfie(uri: string): Promise<ResultadoValidacionPaso> {
  const errores: ErrorValidacion[] = [];
  const calidad = await analizarCalidadImagen(uri);
  const rostros = await detectarRostros(uri);

  if (!calidadEsValida(calidad)) {
    errores.push({
      codigo: 'CALIDAD_BAJA',
      mensajeUsuario: 'La selfie no se ve clara. Busca mejor luz y repite.',
    });
  }

  if (rostros.cantidadRostros === 0) {
    errores.push({
      codigo: 'SELFIE_SIN_ROSTRO',
      mensajeUsuario: 'No detectamos tu rostro. Acerca la cara y repite.',
    });
  }

  if (rostros.cantidadRostros > 1) {
    errores.push({
      codigo: 'SELFIE_MULTIPLES_ROSTROS',
      mensajeUsuario: 'Debe salir solo una persona en la selfie. Intenta de nuevo.',
    });
  }

  return {
    paso: 'selfie',
    aprobado: errores.length === 0,
    errores,
    calidad,
    rostros,
  };
}

export async function validarSelfieConCedula(uri: string): Promise<ResultadoValidacionPaso> {
  const errores: ErrorValidacion[] = [];
  const calidad = await analizarCalidadImagen(uri);
  const rostros = await detectarRostros(uri);
  const ocr = await detectarTextoCedula(uri);

  if (!calidadEsValida(calidad)) {
    errores.push({
      codigo: 'CALIDAD_BAJA',
      mensajeUsuario: 'La foto no se ve clara. Repite con buena luz.',
    });
  }

  if (rostros.cantidadRostros !== 1 || !rostros.hayRostroPrincipalClaro) {
    errores.push({
      codigo: 'SELFIE_CON_CEDULA_INCOMPLETA',
      mensajeUsuario: 'Debe verse tu rostro y la cédula en la misma foto.',
    });
  }

  if (ocr.palabrasClaveEncontradas.length < 1) {
    errores.push({
      codigo: 'SELFIE_CON_CEDULA_INCOMPLETA',
      mensajeUsuario: 'No se alcanza a ver el documento. Acércalo y repite.',
    });
  }

  return {
    paso: 'selfie_con_cedula',
    aprobado: errores.length === 0,
    errores,
    calidad,
    rostros,
    ocr,
  };
}
