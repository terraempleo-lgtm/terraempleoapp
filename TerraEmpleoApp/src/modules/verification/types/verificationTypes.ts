export type PasoVerificacion = 'cedula_frente' | 'selfie' | 'selfie_con_cedula' | 'revision';

export type EstadoDocumento = 'pendiente' | 'capturado' | 'validando' | 'valido' | 'rechazado';

export interface EvidenciaDocumento {
  tipo: Exclude<PasoVerificacion, 'revision'>;
  uri: string;
  mimeType?: string;
  fileName?: string;
  tamanoBytes?: number;
  fechaCaptura: string;
}

export interface ErrorValidacion {
  codigo:
    | 'IMAGEN_NO_DOCUMENTO'
    | 'OCR_TEXTO_INSUFICIENTE'
    | 'OCR_NUMERO_NO_DETECTADO'
    | 'SELFIE_SIN_ROSTRO'
    | 'SELFIE_MULTIPLES_ROSTROS'
    | 'SELFIE_CON_CEDULA_INCOMPLETA'
    | 'CALIDAD_BAJA'
    | 'ERROR_TECNICO';
  mensajeUsuario: string;
  detalleTecnico?: string;
}

export interface ResultadoCalidadImagen {
  esNitida: boolean;
  tieneBuenaLuz: boolean;
  resolucionMinima: boolean;
  puntajeCalidad: number;
  sugerencia?: string;
}

export interface ResultadoOcrCedula {
  textoDetectado: string;
  palabrasClaveEncontradas: string[];
  numeroDocumentoProbable: string | null;
  confianza: number;
}

export interface ResultadoRostros {
  cantidadRostros: number;
  hayRostroPrincipalClaro: boolean;
  cajasRostros?: Array<{ x: number; y: number; ancho: number; alto: number }>;
  confianzaPromedio?: number;
}

export interface ResultadoValidacionPaso {
  paso: Exclude<PasoVerificacion, 'revision'>;
  aprobado: boolean;
  errores: ErrorValidacion[];
  calidad?: ResultadoCalidadImagen;
  ocr?: ResultadoOcrCedula;
  rostros?: ResultadoRostros;
}

export interface EstadoVerificacionInterna {
  usuarioId: number | string;
  pasoActual: PasoVerificacion;
  estadoGeneral: 'en_progreso' | 'listo_para_revision' | 'enviado';
  documentos: {
    cedulaFrente: {
      estado: EstadoDocumento;
      evidencia?: EvidenciaDocumento;
      resultado?: ResultadoValidacionPaso;
    };
    selfie: {
      estado: EstadoDocumento;
      evidencia?: EvidenciaDocumento;
      resultado?: ResultadoValidacionPaso;
    };
    selfieConCedula: {
      estado: EstadoDocumento;
      evidencia?: EvidenciaDocumento;
      resultado?: ResultadoValidacionPaso;
    };
  };
  ultimoErrorGlobal?: ErrorValidacion;
  fechaActualizacion: string;
}

export interface PayloadEnvioVerificacion {
  usuarioId: number | string;
  cedulaFrenteUri: string;
  selfieUri: string;
  selfieConCedulaUri: string;
}

export interface RespuestaEnvioVerificacion {
  envioId: number | string;
  estado: 'recibido' | 'en_revision';
  mensaje: string;
}

export type VerificationStackParamList = {
  IdFrontCapture: undefined;
  SelfieCapture: undefined;
  SelfieWithIdCapture: undefined;
  VerificationReview: undefined;
};
