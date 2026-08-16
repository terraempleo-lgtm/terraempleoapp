import { useCallback, useEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useTutoriales } from '../context/TutorialContext';

/**
 * Controla un tutorial de primera vez para la pantalla que lo llama.
 *
 * El tutorial solo se abre cuando TODO esto se cumple:
 *  - `habilitado` (permiso extra opcional de la pantalla; el permiso base ya
 *    lo garantiza la navegación: la pantalla solo se monta para roles con acceso)
 *  - la pantalla está enfocada y terminó de cargar (`listo`)
 *  - el estado por-usuario llegó del servidor/cache ('listo') y NO está visto
 *
 * Mientras se consulta el estado no se muestra nada (sin "flash"), y el ref
 * `lanzadoRef` evita que se abra dos veces por re-renders o cambios de foco.
 *
 * Uso:
 *   const { mostrar, finalizar, saltar } = useTutorialPrimeraVez(TUTORIALES.CUADERNO, { listo: !loading });
 *   <TutorialOverlay visible={mostrar} steps={pasos} onFinish={finalizar} onSkip={saltar} />
 */
export default function useTutorialPrimeraVez(key, { listo = true, habilitado = true } = {}) {
  const { estado, haVisto, marcarVisto, ensureCargado } = useTutoriales();
  const isFocused = useIsFocused();
  const [mostrar, setMostrar] = useState(false);
  const lanzadoRef = useRef(false);

  useEffect(() => {
    if (habilitado && isFocused) ensureCargado();
  }, [habilitado, isFocused, ensureCargado]);

  useEffect(() => {
    if (!habilitado || !listo || !isFocused || mostrar || lanzadoRef.current) return;
    if (estado !== 'listo' || haVisto(key)) return;
    // Pequeña espera para que el layout se asiente antes de medir elementos
    const t = setTimeout(() => {
      lanzadoRef.current = true;
      setMostrar(true);
    }, 650);
    return () => clearTimeout(t);
  }, [habilitado, listo, isFocused, mostrar, estado, key, haVisto]);

  // Finalizar y saltar cuentan como "visto": no se vuelve a mostrar nunca.
  const cerrar = useCallback(() => {
    setMostrar(false);
    marcarVisto(key);
  }, [key, marcarVisto]);

  return { mostrar, finalizar: cerrar, saltar: cerrar };
}
