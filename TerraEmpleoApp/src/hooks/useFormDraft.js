import { useEffect, useRef, useCallback } from 'react';
import { saveDraft, loadDraft, clearDraft, formatTiempoRelativo } from '../utils/formDrafts';
import { showGlobalToast } from '../utils/toastService';

/**
 * Hook que persiste automáticamente un formulario en AsyncStorage y lo restaura
 * al volver. Auto-save con debounce. Filtra campos sensibles (passwords, OTPs)
 * y URIs locales que pueden invalidarse.
 *
 * Uso:
 *   const onRestore = useCallback((d) => {
 *     if (d.titulo) setTitulo(d.titulo);
 *     if (d.descripcion) setDescripcion(d.descripcion);
 *     // ...
 *   }, []);
 *   const { clearDraft } = useFormDraft('CrearVacante', {
 *     data: { titulo, descripcion, ... },
 *     onRestore,
 *     excludeFields: ['campoX'],
 *   });
 *   // al éxito: await clearDraft();
 */
export function useFormDraft(key, {
  data,
  onRestore,
  excludeFields = [],
  ttlDays = 7,
  debounceMs = 1500,
  toastMessage = 'Borrador restaurado',
  showToast = true,
  enabled = true,
} = {}) {
  const restoredRef = useRef(false);
  const timerRef = useRef(null);
  const onRestoreRef = useRef(onRestore);
  onRestoreRef.current = onRestore;

  // Restaurar una sola vez al montar
  useEffect(() => {
    if (!enabled || !key || restoredRef.current) return;
    restoredRef.current = true;
    (async () => {
      const draft = await loadDraft(key);
      if (!draft) return;
      try {
        onRestoreRef.current?.(draft.data);
      } catch (e) {
        console.warn('useFormDraft: onRestore falló, descartando draft:', e?.message);
        await clearDraft(key);
        return;
      }
      if (showToast) {
        try { showGlobalToast(toastMessage, formatTiempoRelativo(draft.savedAt), 'info'); } catch {}
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Auto-save debounced cuando cambia `data`
  useEffect(() => {
    if (!enabled || !key) return;
    if (!restoredRef.current) return; // esperar al restore inicial
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      saveDraft(key, data, { excludeFields, ttlDays }).catch(() => {});
    }, debounceMs);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(data), key, enabled]);

  const clearDraftFn = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await clearDraft(key);
  }, [key]);

  const saveNow = useCallback(async () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    await saveDraft(key, data, { excludeFields, ttlDays });
  }, [key, data, excludeFields, ttlDays]);

  return { clearDraft: clearDraftFn, saveNow };
}

export default useFormDraft;
