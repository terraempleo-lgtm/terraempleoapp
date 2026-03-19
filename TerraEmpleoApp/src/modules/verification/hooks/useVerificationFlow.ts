import { useCallback, useMemo, useState } from 'react';
import type {
  ErrorValidacion,
  EstadoVerificacionInterna,
  EvidenciaDocumento,
  PasoVerificacion,
  ResultadoValidacionPaso,
} from '../types';
import {
  enviarDocumentosVerificacionInterna,
  validarCedulaFrente,
  validarSelfie,
  validarSelfieConCedula,
} from '../services';

const PASOS: PasoVerificacion[] = ['cedula_frente', 'selfie', 'selfie_con_cedula', 'revision'];

type TipoDocumento = 'cedulaFrente' | 'selfie' | 'selfieConCedula';

function nowIso(): string {
  return new Date().toISOString();
}

export function useVerificationFlow(usuarioId: number | string) {
  const [estado, setEstado] = useState<EstadoVerificacionInterna>({
    usuarioId,
    pasoActual: 'cedula_frente',
    estadoGeneral: 'en_progreso',
    documentos: {
      cedulaFrente: { estado: 'pendiente' },
      selfie: { estado: 'pendiente' },
      selfieConCedula: { estado: 'pendiente' },
    },
    fechaActualizacion: nowIso(),
  });
  const [cargando, setCargando] = useState(false);

  const pasoIndex = useMemo(() => PASOS.indexOf(estado.pasoActual), [estado.pasoActual]);

  const setDocumento = useCallback(
    (tipo: TipoDocumento, evidencia: EvidenciaDocumento, resultado?: ResultadoValidacionPaso) => {
      setEstado((prev) => ({
        ...prev,
        documentos: {
          ...prev.documentos,
          [tipo]: {
            estado: resultado ? (resultado.aprobado ? 'valido' : 'rechazado') : 'capturado',
            evidencia,
            resultado,
          },
        },
        fechaActualizacion: nowIso(),
      }));
    },
    []
  );

  const capturarCedulaFrente = useCallback(
    (uri: string) => {
      setDocumento('cedulaFrente', {
        tipo: 'cedula_frente',
        uri,
        fechaCaptura: nowIso(),
      });
    },
    [setDocumento]
  );

  const capturarSelfie = useCallback(
    (uri: string) => {
      setDocumento('selfie', {
        tipo: 'selfie',
        uri,
        fechaCaptura: nowIso(),
      });
    },
    [setDocumento]
  );

  const capturarSelfieConCedula = useCallback(
    (uri: string) => {
      setDocumento('selfieConCedula', {
        tipo: 'selfie_con_cedula',
        uri,
        fechaCaptura: nowIso(),
      });
    },
    [setDocumento]
  );

  const validarPasoActual = useCallback(async (): Promise<ResultadoValidacionPaso | null> => {
    setCargando(true);

    try {
      if (estado.pasoActual === 'cedula_frente') {
        const uri = estado.documentos.cedulaFrente.evidencia?.uri;
        if (!uri) {
          const resultadoFalso: ResultadoValidacionPaso = {
            paso: 'cedula_frente',
            aprobado: false,
            errores: [{
              codigo: 'IMAGEN_NO_DOCUMENTO',
              mensajeUsuario: 'Primero toma la foto del frente de la cédula.',
            }],
          };
          setEstado((prev) => ({ ...prev, ultimoErrorGlobal: resultadoFalso.errores[0], fechaActualizacion: nowIso() }));
          return resultadoFalso;
        }

        const resultado = await validarCedulaFrente(uri);
        setDocumento('cedulaFrente', estado.documentos.cedulaFrente.evidencia as EvidenciaDocumento, resultado);
        return resultado;
      }

      if (estado.pasoActual === 'selfie') {
        const uri = estado.documentos.selfie.evidencia?.uri;
        if (!uri) {
          const resultadoFalso: ResultadoValidacionPaso = {
            paso: 'selfie',
            aprobado: false,
            errores: [{
              codigo: 'SELFIE_SIN_ROSTRO',
              mensajeUsuario: 'Primero toma tu selfie.',
            }],
          };
          setEstado((prev) => ({ ...prev, ultimoErrorGlobal: resultadoFalso.errores[0], fechaActualizacion: nowIso() }));
          return resultadoFalso;
        }

        const resultado = await validarSelfie(uri);
        setDocumento('selfie', estado.documentos.selfie.evidencia as EvidenciaDocumento, resultado);
        return resultado;
      }

      if (estado.pasoActual === 'selfie_con_cedula') {
        const uri = estado.documentos.selfieConCedula.evidencia?.uri;
        if (!uri) {
          const resultadoFalso: ResultadoValidacionPaso = {
            paso: 'selfie_con_cedula',
            aprobado: false,
            errores: [{
              codigo: 'SELFIE_CON_CEDULA_INCOMPLETA',
              mensajeUsuario: 'Primero toma la foto sosteniendo la cédula.',
            }],
          };
          setEstado((prev) => ({ ...prev, ultimoErrorGlobal: resultadoFalso.errores[0], fechaActualizacion: nowIso() }));
          return resultadoFalso;
        }

        const resultado = await validarSelfieConCedula(uri);
        setDocumento('selfieConCedula', estado.documentos.selfieConCedula.evidencia as EvidenciaDocumento, resultado);
        return resultado;
      }

      return null;
    } catch (error) {
      const errorGlobal: ErrorValidacion = {
        codigo: 'ERROR_TECNICO',
        mensajeUsuario: 'Tuvimos un problema tecnico. Intenta otra vez en un momento.',
        detalleTecnico: error instanceof Error ? error.message : String(error),
      };
      setEstado((prev) => ({ ...prev, ultimoErrorGlobal: errorGlobal, fechaActualizacion: nowIso() }));

      return {
        paso: estado.pasoActual === 'revision' ? 'selfie_con_cedula' : estado.pasoActual,
        aprobado: false,
        errores: [errorGlobal],
      };
    } finally {
      setCargando(false);
    }
  }, [estado, setDocumento]);

  const avanzarPaso = useCallback(() => {
    setEstado((prev) => {
      const current = PASOS.indexOf(prev.pasoActual);
      const next = PASOS[Math.min(current + 1, PASOS.length - 1)];

      const nuevoEstadoGeneral =
        next === 'revision' ? 'listo_para_revision' : prev.estadoGeneral;

      return {
        ...prev,
        pasoActual: next,
        estadoGeneral: nuevoEstadoGeneral,
        fechaActualizacion: nowIso(),
      };
    });
  }, []);

  const retrocederPaso = useCallback(() => {
    setEstado((prev) => {
      const current = PASOS.indexOf(prev.pasoActual);
      const previous = PASOS[Math.max(current - 1, 0)];

      return {
        ...prev,
        pasoActual: previous,
        fechaActualizacion: nowIso(),
      };
    });
  }, []);

  const enviarParaRevision = useCallback(async () => {
    const cedulaUri = estado.documentos.cedulaFrente.evidencia?.uri;
    const selfieUri = estado.documentos.selfie.evidencia?.uri;
    const selfieCedulaUri = estado.documentos.selfieConCedula.evidencia?.uri;

    if (!cedulaUri || !selfieUri || !selfieCedulaUri) {
      const error: ErrorValidacion = {
        codigo: 'ERROR_TECNICO',
        mensajeUsuario: 'Faltan fotos por completar antes de enviar.',
      };
      setEstado((prev) => ({ ...prev, ultimoErrorGlobal: error, fechaActualizacion: nowIso() }));
      return { ok: false, mensaje: error.mensajeUsuario };
    }

    setCargando(true);
    try {
      const respuesta = await enviarDocumentosVerificacionInterna({
        usuarioId,
        cedulaFrenteUri: cedulaUri,
        selfieUri,
        selfieConCedulaUri: selfieCedulaUri,
      });

      setEstado((prev) => ({
        ...prev,
        estadoGeneral: 'enviado',
        fechaActualizacion: nowIso(),
      }));

      return {
        ok: true,
        mensaje: respuesta.mensaje || 'Documentos enviados para revision',
      };
    } catch (error) {
      const errorGlobal: ErrorValidacion = {
        codigo: 'ERROR_TECNICO',
        mensajeUsuario: 'No se pudo enviar. Revisa tu conexion e intenta de nuevo.',
        detalleTecnico: error instanceof Error ? error.message : String(error),
      };
      setEstado((prev) => ({ ...prev, ultimoErrorGlobal: errorGlobal, fechaActualizacion: nowIso() }));
      return { ok: false, mensaje: errorGlobal.mensajeUsuario };
    } finally {
      setCargando(false);
    }
  }, [estado, usuarioId]);

  return {
    estado,
    cargando,
    pasoIndex,
    pasos: PASOS,
    capturarCedulaFrente,
    capturarSelfie,
    capturarSelfieConCedula,
    validarPasoActual,
    avanzarPaso,
    retrocederPaso,
    enviarParaRevision,
  };
}
