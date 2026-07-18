import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS } from '../../../theme';
import { useFinca } from '../../../context/FincaContext';

const ITEMS = [
  { key: 'ResumenFincaHome', label: 'Resumen', icon: 'book-outline' },
  { key: 'FinanzasHome', label: 'Finanzas', icon: 'pulse-outline' },
  { key: 'NominaHome', label: 'Nómina', icon: 'clipboard-outline' },
  { key: 'RendimientoHome', label: 'Rendimiento', icon: 'trending-up-outline' },
  { key: 'JornadasHome', label: 'Jornadas', icon: 'calendar-outline' },
  { key: 'CafeHome', label: 'Café', icon: 'cafe-outline' },
];

// Sub-navegación interna del Cuaderno (equivalente a las pestañas Resumen/
// Jornadas/Nómina/Café/Finanzas/Rendimiento del panel web) — no son tabs de
// la barra inferior, viven dentro de la vista de Cuaderno.
export default function CuadernoTopNav({ navigation, activeKey }) {
  const { esPropietario } = useFinca();
  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {ITEMS.map(it => (
          <TouchableOpacity
            key={it.key}
            onPress={() => navigation.navigate(it.key)}
            style={[styles.pill, activeKey === it.key && styles.pillActive]}
          >
            <Ionicons name={it.icon} size={14} color={activeKey === it.key ? COLORS.white : COLORS.textLight} />
            <Text style={[styles.pillText, activeKey === it.key && styles.pillTextActive]}>{it.label}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={() => navigation.navigate('Precios')} style={styles.pillOutline}>
          <Ionicons name="pricetag-outline" size={14} color={COLORS.primary} />
          <Text style={styles.pillOutlineText}>Precios</Text>
        </TouchableOpacity>
        {esPropietario && (
          <TouchableOpacity onPress={() => navigation.navigate('ConfiguracionFinca')} style={styles.pillOutline}>
            <Ionicons name="settings-outline" size={14} color={COLORS.primary} />
            <Text style={styles.pillOutlineText}>Configurar</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderBottomWidth: 1, borderBottomColor: COLORS.borderLight, backgroundColor: COLORS.background },
  row: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, gap: 8, alignItems: 'center' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: COLORS.borderLight },
  pillActive: { backgroundColor: COLORS.primary },
  pillText: { fontSize: 12, fontWeight: '600', color: COLORS.textLight },
  pillTextActive: { color: COLORS.white },
  pillOutline: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: COLORS.primary },
  pillOutlineText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
});
