import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Jornadas y Nómina ahora son UNA sola sección con dos vistas: el registro
// del día a día (Jornadas) y la planilla semanal (Nómina). Este conmutador
// vive arriba de ambas pantallas para pasar de una a otra sin salir.

const COLORS = {
  primary: '#008d49', primarySoft: '#e5f6ec',
  ink900: '#171a15', ink500: '#6b7060',
  line: '#e4e6de', lineLight: '#f4f5f0',
};

const VISTAS = [
  { key: 'jornadas', label: 'Jornadas (días)', icon: 'calendar-outline', ruta: 'JornadasHome' },
  { key: 'nomina', label: 'Nómina (planilla)', icon: 'clipboard-outline', ruta: 'NominaHome' },
];

export default function JornadasNominaSwitch({ navigation, active }) {
  return (
    <View style={styles.wrap}>
      {VISTAS.map((v) => {
        const activo = active === v.key;
        return (
          <Pressable
            key={v.key}
            onPress={() => !activo && navigation.navigate(v.ruta)}
            style={[styles.seg, activo && styles.segActivo]}
          >
            <Ionicons name={v.icon} size={14} color={activo ? '#fff' : COLORS.ink500} />
            <Text style={[styles.segText, activo && styles.segTextActivo]}>  {v.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', backgroundColor: COLORS.lineLight, borderRadius: 12,
    padding: 3, marginHorizontal: 16, marginTop: 10,
  },
  seg: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 9, borderRadius: 10,
  },
  segActivo: { backgroundColor: COLORS.primary },
  segText: { fontSize: 12, fontWeight: '700', color: COLORS.ink500 },
  segTextActivo: { color: '#fff' },
});
