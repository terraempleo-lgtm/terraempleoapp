import { Platform } from 'react-native';
import { authAPI } from '../services/api';
import { showToast } from './toastService';

const subir = async ({ tipo, uri }) => {
  const formData = new FormData();
  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    formData.append('foto', blob, `${tipo}_${Date.now()}.jpg`);
  } else {
    formData.append('foto', { uri, type: 'image/jpeg', name: `${tipo}_${Date.now()}.jpg` });
  }
  await authAPI.subirFoto(tipo, formData);
};

/**
 * Sube todas las fotos en segundo plano sin bloquear el registro.
 * Si alguna foto obligatoria falla, muestra un toast pidiendo al usuario
 * que complete la verificación desde su perfil.
 */
export function subirFotosRegistro(fotosObligatorias, fotosOpcionales = []) {
  const todas = [
    ...fotosObligatorias.filter(f => f.uri),
    ...fotosOpcionales.filter(f => f.uri),
  ];
  if (todas.length === 0) return;

  Promise.allSettled(todas.map(f => subir(f))).then(results => {
    const fallaronObligatorias = results
      .slice(0, fotosObligatorias.filter(f => f.uri).length)
      .some(r => r.status === 'rejected');

    if (fallaronObligatorias) {
      setTimeout(() => {
        showToast('No se pudieron guardar tus fotos de verificación. Ve a tu perfil para completarlas.', 'warning', 6000);
      }, 1500);
    }
  });
}
