import { showGlobalToast } from '../../../utils/toastService';

// Adapta el toast global de la app a la firma toast.success(msg) / toast.error(msg)
// que usan las pantallas de Cuaderno/Finanzas/Nómina.
export function useToast() {
  return {
    success: (msg) => showGlobalToast('Listo', msg, 'success'),
    error: (msg) => showGlobalToast('Ups', msg, 'error'),
    info: (msg) => showGlobalToast('Info', msg, 'info'),
    warning: (msg) => showGlobalToast('Atención', msg, 'warning'),
  };
}
