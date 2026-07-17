import React from 'react';
import EnConstruccion from '../shared/EnConstruccion';

export default function RendimientoScreen({ navigation }) {
  return (
    <EnConstruccion
      navigation={navigation}
      activeKey="RendimientoHome"
      titulo="Rendimiento"
      icono="trending-up-outline"
      mensaje="Indicadores de gestión (dependencia de cultivo, ROI, ranking de trabajadores) se habilitan en la siguiente fase."
    />
  );
}
