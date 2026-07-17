import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';

const NIVELES = [
  { key: 'bien', label: 'A', color: COLORS.success },
  { key: 'regular', label: 'B', color: COLORS.warning },
  { key: 'mal', label: 'C', color: COLORS.error },
];

export default function DetalleJornadaScreen({ route, navigation }) {
  const { jornadaId } = route.params;
  const [jornada, setJornada] = useState(null);
  const [asistencias, setAsistencias] = useState([]);
  const [loading, setLoading] = useState(true);

  const cargar = useCallback(async () => {
    try {
      const res = await cuadernoAPI.detalleJornada(jornadaId);
      setJornada(res.data?.jornada);
      setAsistencias(res.data?.asistencias || []);
    } catch (err) {
      console.error('Error cargando jornada:', err);
    } finally {
      setLoading(false);
    }
  }, [jornadaId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const calificar = async (asisId, nivel) => {
    try {
      await cuadernoAPI.calificarAsistencia(asisId, { nivel });
      cargar();
    } catch (err) {
      console.error('Error calificando:', err);
    }
  };

  if (loading) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></SafeAreaView>;
  }

  const asistieron = asistencias.filter(a => ['llego', 'llego_tarde'].includes(a.estado)).length;
  const totalPagado = asistencias.reduce((s, a) => s + Number(a.pago_total || 0), 0);
  const totalKg = asistencias.reduce((s, a) => s + Number(a.cantidad_kg || 0), 0);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{jornada?.fecha?.slice(0, 10)}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}><Text style={styles.kpiValue}>{asistieron}/{asistencias.length}</Text><Text style={styles.kpiLabel}>Asistieron</Text></View>
          <View style={styles.kpiCard}><Text style={styles.kpiValue}>{totalKg.toFixed(0)}</Text><Text style={styles.kpiLabel}>Kg totales</Text></View>
          <View style={styles.kpiCard}><Text style={styles.kpiValue}>${totalPagado.toLocaleString('es-CO')}</Text><Text style={styles.kpiLabel}>Total pagado</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Trabajadores</Text>
        {asistencias.map(a => (
          <View key={a.id} style={styles.trabajadorCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.nombre}>{a.trabajador_nombre || a.manual_nombre}</Text>
              <Text style={styles.sub}>
                {a.estado} · {a.cantidad_kg ? `${a.cantidad_kg} kg · ` : ''}${Number(a.pago_total || 0).toLocaleString('es-CO')}
              </Text>
            </View>
            <View style={styles.califRow}>
              {NIVELES.map(n => (
                <TouchableOpacity
                  key={n.key}
                  onPress={() => calificar(a.id, n.key)}
                  style={[styles.califBtn, { borderColor: n.color }, a.calif_nivel === n.key && { backgroundColor: n.color }]}
                >
                  <Text style={[styles.califText, { color: a.calif_nivel === n.key ? COLORS.white : n.color }]}>{n.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  backBtn: { padding: 4, marginRight: 8 },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  kpiRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  kpiCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  kpiValue: { fontSize: 16, fontWeight: '800', color: COLORS.primary },
  kpiLabel: { fontSize: 11, color: COLORS.textLight, textAlign: 'center', marginTop: 4 },
  sectionTitle: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  trabajadorCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  nombre: { fontWeight: '700', color: COLORS.textPrimary },
  sub: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  califRow: { flexDirection: 'row', gap: 6 },
  califBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  califText: { fontWeight: '800', fontSize: 13 },
});
