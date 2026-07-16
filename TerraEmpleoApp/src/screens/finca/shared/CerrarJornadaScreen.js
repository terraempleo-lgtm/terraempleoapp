import React from 'react';
import EnConstruccion from './EnConstruccion';

// El wizard completo de cierre de jornada (labores, trabajadores, pagos en
// vivo, borrador autoguardado) se implementa en la siguiente fase.
export default function CerrarJornadaScreen() {
  return (
    <EnConstruccion
      titulo="Cerrar jornada"
      icono="checkmark-done-circle-outline"
      mensaje="El flujo de cierre de jornada (labores, trabajadores, pagos) se habilita en la siguiente fase."
    />
  );
}
