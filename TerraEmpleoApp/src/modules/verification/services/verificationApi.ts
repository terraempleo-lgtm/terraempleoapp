import api from '../../../services/api';
import type { PayloadEnvioVerificacion, RespuestaEnvioVerificacion } from '../types';

const RUTA_BASE = '/auth/validacion-interna-identidad';

async function uriToBlob(uri: string): Promise<Blob> {
  const response = await fetch(uri);
  return response.blob();
}

export async function enviarDocumentosVerificacionInterna(
  payload: PayloadEnvioVerificacion
): Promise<RespuestaEnvioVerificacion> {
  const formData = new FormData();

  formData.append('usuario_id', String(payload.usuarioId));

  const cedulaBlob = await uriToBlob(payload.cedulaFrenteUri);
  formData.append('cedula_frente', cedulaBlob, `cedula_frente_${Date.now()}.jpg`);

  const selfieBlob = await uriToBlob(payload.selfieUri);
  formData.append('selfie', selfieBlob, `selfie_${Date.now()}.jpg`);

  const selfieCedulaBlob = await uriToBlob(payload.selfieConCedulaUri);
  formData.append('selfie_con_cedula', selfieCedulaBlob, `selfie_con_cedula_${Date.now()}.jpg`);

  const { data } = await api.post(`${RUTA_BASE}/enviar`, formData, {
    transformRequest: [(requestData) => requestData],
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return {
    envioId: data?.envio_id ?? data?.id ?? `tmp-${Date.now()}`,
    estado: data?.estado ?? 'recibido',
    mensaje: data?.message ?? 'Documentos enviados para revision',
  };
}
