import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';

function inicioSemana(d = new Date()) {
  const dia = d.getDay(); // 0=domingo
  const diff = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(d);
  lunes.setDate(d.getDate() + diff);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}
function fmt(d) { return d.toISOString().slice(0, 10); }
function hoyStr() { return fmt(new Date()); }

export default function CuadernoAdminScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const confirmarSalir = () => {
    Alert.alert('Cerrar sesión', `¿Salir de la cuenta de ${user?.nombre_completo || 'este usuario'}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive', onPress: signOut },
    ]);
  };

  const cargar = useCallback(async (mostrarSpinner = true) => {
    if (mostrarSpinner) setLoading(true);
    try {
      const lunes = inicioSemana();
      const res = await cuadernoAPI.listarJornadas({ desde: fmt(lunes), hasta: hoyStr() });
      setJornadas(res.data?.jornadas || []);
    } catch (err) {
      console.error('Error cargando jornadas:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const jornadaHoy = jornadas.find(j => j.fecha?.slice(0, 10) === hoyStr());
  const kpis = jornadas.reduce((acc, j) => ({
    jornadas: acc.jornadas + 1,
    kg: acc.kg + Number(j.total_kg || 0),
    pagado: acc.pagado + Number(j.total_pagado || 0),
  }), { jornadas: 0, kg: 0, pagado: 0 });

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(false); }} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Cuaderno</Text>
          <View style={styles.headerBtns}>
            <TouchableOpacity onPress={() => navigation.navigate('Precios')} style={styles.preciosBtn}>
              <Ionicons name="pricetag-outline" size={16} color={COLORS.primary} />
              <Text style={styles.preciosText}>Precios</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={confirmarSalir} style={styles.salirBtn}>
              <Ionicons name="log-out-outline" size={20} color={COLORS.error} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.cta}
          onPress={() => navigation.navigate(jornadaHoy ? 'DetalleJornada' : 'CerrarJornada', jornadaHoy ? { jornadaId: jornadaHoy.id } : { fecha: hoyStr() })}
        >
          <Ionicons name={jornadaHoy ? 'eye-outline' : 'checkmark-done-circle'} size={28} color={COLORS.white} />
          <Text style={styles.ctaText}>{jornadaHoy ? 'Ver la jornada de hoy' : 'Cerrar la jornada de hoy'}</Text>
        </TouchableOpacity>

        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpis.jornadas}</Text>
            <Text style={styles.kpiLabel}>Jornadas esta semana</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>{kpis.kg.toFixed(0)}</Text>
            <Text style={styles.kpiLabel}>Kg recogidos</Text>
          </View>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiValue}>${kpis.pagado.toLocaleString('es-CO')}</Text>
            <Text style={styles.kpiLabel}>Pagado</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Jornadas recientes</Text>
        {jornadas.length === 0 ? (
          <Text style={styles.empty}>Sin jornadas registradas esta semana.</Text>
        ) : jornadas.map(j => (
          <TouchableOpacity key={j.id} style={styles.jornadaRow} onPress={() => navigation.navigate('DetalleJornada', { jornadaId: j.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jornadaFecha}>{j.fecha?.slice(0, 10)}</Text>
              <Text style={styles.jornadaSub}>{j.asistieron || 0}/{j.total_trabajadores || 0} asistieron · {Number(j.total_kg || 0).toFixed(0)} kg</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  scroll: { padding: SPACING.lg, paddingBottom: 120 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.lg },
  title: { ...FONTS.title, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  headerBtns: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  preciosBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, paddingHorizontal: 12, paddingVertical: 8, borderRadius: RADIUS.pill, gap: 4 },
  salirBtn: { padding: 8, backgroundColor: COLORS.errorSoft, borderRadius: RADIUS.pill },
  preciosText: { color: COLORS.primary, fontWeight: '700', fontSize: 13 },
  cta: { backgroundColor: COLORS.primary, borderRadius: RADIUS.lg, padding: SPACING.lg, alignItems: 'center', gap: 8, ...SHADOWS.md },
  ctaText: { color: COLORS.white, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  kpiRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.lg },
  kpiCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  kpiValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  kpiLabel: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 4 },
  sectionTitle: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginTop: SPACING.xl, marginBottom: SPACING.sm },
  empty: { color: COLORS.textLight, fontStyle: 'italic' },
  jornadaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  jornadaFecha: { fontWeight: '700', color: COLORS.textPrimary },
  jornadaSub: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
});
