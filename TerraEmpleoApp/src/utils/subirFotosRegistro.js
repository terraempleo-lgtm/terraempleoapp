import { authAPI } from '../services/api';
import { showToast } from './toastService';

async function subirConReintento({ tipo, uri }) {
  try {
    await authAPI.subirFotoIdentidad(tipo, uri);
  } catch (err) {
    // Contexto rural con conectividad intermitente — un reintento evita que
    // un solo timeout se traduzca en una foto de identidad perdida.
    await authAPI.subirFotoIdentidad(tipo, uri);
  }
}

/**
 * Sube todas las fotos en segundo plano sin bloquear el registro.
 * Usa fetch (vía authAPI.subirFotoIdentidad) en vez de axios, que no arma
 * bien el boundary multipart en iOS/Android y hacía que las fotos de
 * identidad nunca llegaran al servidor.
 * Si alguna foto obligatoria falla incluso tras el reintento, muestra un
 * toast pidiendo al usuario que complete la verificación desde su perfil.
 */
export function subirFotosRegistro(fotosObligatorias, fotosOpcionales = []) {
  const obligatorias = fotosObligatorias.filter(f => f.uri);
  const todas = [...obligatorias, ...fotosOpcionales.filter(f => f.uri)];
  if (todas.length === 0) return;

  Promise.allSettled(todas.map(f => subirConReintento(f))).then(results => {
    const fallaronObligatorias = results.slice(0, obligatorias.length).some(r => r.status === 'rejected');

    if (fallaronObligatorias) {
      setTimeout(() => {
        showToast('No se pudieron guardar tus fotos de verificación. Ve a tu perfil para completarlas.', 'warning', 6000);
      }, 1500);
    }
  });
}
