import { Platform } from 'react-native';
import { authAPI } from '../services/api';

/**
 * Sube las fotos de registro de forma síncrona.
 * Lanza un error si alguna foto obligatoria falla.
 * Las fotos opcionales (portafolio, finca) se suben en segundo plano sin bloquear.
 */
export async function subirFotosRegistro(fotosObligatorias, fotosOpcionales = []) {
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

  // Fotos obligatorias: subir en paralelo y lanzar error si alguna falla
  await Promise.all(fotosObligatorias.filter(f => f.uri).map(f => subir(f)));

  // Fotos opcionales: fire-and-forget, no bloquean ni lanzan error
  if (fotosOpcionales.length > 0) {
    Promise.allSettled(fotosOpcionales.filter(f => f.uri).map(f => subir(f))).then(results => {
      results.forEach((r, idx) => {
        if (r.status === 'rejected') {
          console.warn(`Foto opcional ${fotosOpcionales[idx]?.tipo} no se subió:`, r.reason?.message);
        }
      });
    });
  }
}
