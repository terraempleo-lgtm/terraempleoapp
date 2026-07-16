import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';

export default function ResumenFincaScreen({ navigation }) {
  const { esPropietario, modoAdminPreview, setModoAdminPreview } = useFinca();
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const res = await cuadernoAPI.dashboard();
      setResumen(res.data?.resumen || res.data);
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></SafeAreaView>;
  }

  const kpis = [
    { label: 'Trabajadores', value: resumen?.trabajadores_contratados ?? 0, icon: 'people-outline' },
    { label: 'Jornadas activas', value: resumen?.jornadas_activas ?? 0, icon: 'today-outline' },
    { label: 'Jornadas pendientes', value: resumen?.jornadas_pendientes ?? 0, icon: 'time-outline' },
    { label: 'Total pagado', value: `$${Number(resumen?.total_pagado || 0).toLocaleString('es-CO')}`, icon: 'cash-outline' },
    { label: 'Kg totales', value: Number(resumen?.total_kg || 0).toFixed(0), icon: 'leaf-outline' },
    { label: '% Asistencia', value: `${resumen?.promedio_asistencia ?? 0}%`, icon: 'checkmark-circle-outline' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text style={styles.title}>Resumen de finca</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Precios')} style={styles.preciosBtn}>
            <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
            <Text style={styles.preciosText}>Precios</Text>
          </TouchableOpacity>
        </View>

        {esPropietario && (
          <View style={styles.modoAdminRow}>
            <View>
              <Text style={styles.modoAdminLabel}>Modo admin (vista de capataz)</Text>
              <Text style={styles.modoAdminHint}>Previsualiza la app como la ve tu capataz, sin perder tus permisos.</Text>
            </View>
            <Switch value={modoAdminPreview} onValueChange={setModoAdminPreview} trackColor={{ true: COLORS.primary }} />
          </View>
        )}

        <View style={styles.grid}>
          {kpis.map(k => (
            <View key={k.label} style={styles.kpiCard}>
              <Ionicons name={k.icon} size={20} color={COLORS.primary} />
              <Text style={styles.kpiValue}>{k.value}</Text>
              <Text style={styles.kpiLabel}>{k.label}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { ...FONTS.title, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  preciosBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, gap: 4 },
  preciosText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  modoAdminRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.lg, ...SHADOWS.sm },
  modoAdminLabel: { fontWeight: '700', color: COLORS.textPrimary },
  modoAdminHint: { fontSize: 11, color: COLORS.textLight, marginTop: 2, maxWidth: 220 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpiCard: { width: '31%', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  kpiValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 6 },
  kpiLabel: { fontSize: 10, color: COLORS.textLight, textAlign: 'center', marginTop: 2 },
});
