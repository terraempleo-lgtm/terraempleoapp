import React from 'react';
import EnConstruccion from '../shared/EnConstruccion';

export default function CafeScreen({ navigation }) {
  return (
    <EnConstruccion
      navigation={navigation}
      activeKey="CafeHome"
      titulo="Café"
      icono="cafe-outline"
      mensaje="Lotes, conversión cereza→pergamino y alertas de merma se habilitan en la siguiente fase."
    />
  );
}
