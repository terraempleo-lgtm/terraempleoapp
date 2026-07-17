import React from 'react';
import EnConstruccion from '../shared/EnConstruccion';

export default function FinanzasScreen({ navigation }) {
  return (
    <EnConstruccion
      navigation={navigation}
      activeKey="FinanzasHome"
      titulo="Finanzas"
      icono="wallet-outline"
      mensaje="El tablero mensual de ingresos, gastos y cierre de periodo se habilita en la siguiente fase."
    />
  );
}
