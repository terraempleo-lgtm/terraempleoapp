import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';
import CuadernoTopNav from '../shared/CuadernoTopNav';

export default function ResumenFincaScreen({ navigation }) {
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
      <CuadernoTopNav navigation={navigation} activeKey="ResumenFincaHome" />
      {loading ? (
        <ActivityIndicator color={COLORS.primary} size="large" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Cuaderno</Text>
              <Text style={styles.subtitle}>Control de jornadas, asistencia, producción y pagos</Text>
            </View>
          </View>

          <View style={styles.ctaRow}>
            <TouchableOpacity style={styles.ctaOutline} onPress={() => navigation.navigate('JornadasHome')}>
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.ctaOutlineText}>Ver jornadas</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaPrimary} onPress={() => navigation.navigate('CerrarJornada')}>
              <Ionicons name="add" size={16} color={COLORS.white} />
              <Text style={styles.ctaPrimaryText}>Nueva jornada</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {kpis.map(k => (
              <View key={k.label} style={styles.kpiCard}>
                <Ionicons name={k.icon} size={20} color={COLORS.primary} />
                <Text style={styles.kpiValue}>{k.value}</Text>
                <Text style={styles.kpiLabel}>{k.label}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.auditoriaLink} onPress={() => navigation.navigate('Auditoria')}>
            <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textLight} />
            <Text style={styles.auditoriaLinkText}>Ver auditoría de la finca</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  header: { marginBottom: SPACING.lg },
  title: { ...FONTS.title, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  subtitle: { color: COLORS.textLight, fontSize: 13, marginTop: 2 },
  ctaRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  ctaOutline: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: COLORS.primary, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10 },
  ctaOutlineText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  ctaPrimary: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.primary, borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 10 },
  ctaPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpiCard: { width: '31%', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  kpiValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary, marginTop: 6 },
  kpiLabel: { fontSize: 10, color: COLORS.textLight, textAlign: 'center', marginTop: 2 },
  auditoriaLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xl, alignSelf: 'center' },
  auditoriaLinkText: { color: COLORS.textLight, fontSize: 12 },
});
