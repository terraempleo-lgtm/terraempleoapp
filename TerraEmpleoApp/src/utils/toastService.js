import { useRef, useCallback } from 'react';

let globalToastRef = null;

export function useToast() {
  const ref = useRef(null);

  const show = useCallback((title, message = '', type = 'info') => {
    const currentRef = ref.current || globalToastRef;
    if (currentRef?.show) {
      // Update state first
      currentRef.setConfig?.({ title, message, type });
      currentRef.show();
    }
  }, []);

  return {
    ref,
    success: (title, message = '') => show(title, message, 'success'),
    error: (title, message = '') => show(title, message, 'error'),
    warning: (title, message = '') => show(title, message, 'warning'),
    info: (title, message = '') => show(title, message, 'info'),
    show,
  };
}

export function setGlobalToastRef(ref) {
  globalToastRef = ref;
}

// Mostrar toast desde código no-React (utilidades, servicios). Si el ref
// global aún no está registrado (app cargando), se ignora silenciosamente.
export function showGlobalToast(title, message = '', type = 'info') {
  if (!globalToastRef?.show) return;
  globalToastRef.setConfig?.({ title, message, type });
  globalToastRef.show();
}

