import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { useAppTheme } from '../../context/ThemeContext';
import { useDisenoResponsive } from '../../hooks/useDisenoResponsive';

export default function AdminDashboardScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const { contenedorMaxAncho, columnas } = useDisenoResponsive();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setError(null);
      const res = await adminAPI.getDashboard();
      setStats(res.data);
    } catch (err) {
      console.error('Error cargando dashboard:', err);
      setError(err.response?.data?.error || 'No se pudo conectar al servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, []);

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <MotiView
          from={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 800 }}
        >
          <Ionicons name="leaf" size={48} color={COLORS.primary} />
        </MotiView>
      </View>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { justifyContent: 'center', alignItems: 'center', flex: 1 },
            { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
          ]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', ...ANIMATION.spring.gentle }}
          >
            <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          </MotiView>
          <FadeInView delay={100}>
            <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>{error}</Text>
          </FadeInView>
          <FadeInView delay={200}>
            <AnimatedPressable onPress={() => { setLoading(true); load(); }} style={{ marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md }} scaleValue={0.95} haptic>
              <Text style={{ color: COLORS.white, fontWeight: '600' }}>Reintentar</Text>
            </AnimatedPressable>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const cards = [
    { title: 'Trabajadores', value: stats?.trabajadores || 0, icon: 'people', color: COLORS.primary },
    { title: 'Empleadores', value: stats?.empleadores || 0, icon: 'business', color: COLORS.accent },
    { title: 'Vacantes Activas', value: stats?.vacantes_activas || 0, icon: 'briefcase', color: '#1565C0' },
    { title: 'Vacantes Totales', value: stats?.vacantes_total || 0, icon: 'layers', color: '#6A1B9A' },
    { title: 'Postulaciones', value: stats?.postulaciones || 0, icon: 'document-text', color: '#00838F' },
    { title: 'Calificaciones', value: stats?.calificaciones || 0, icon: 'star', color: '#EF6C00' },
  ];
  const anchoTarjeta = columnas === 1 ? '100%' : columnas === 2 ? '48%' : '31%';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <FadeInView delay={0}>
          <Text style={[styles.header, { color: colors.textPrimary }]}>Panel de Administración</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Resumen general de TerraEmpleo</Text>
        </FadeInView>

        <View style={[styles.grid, columnas > 1 && { justifyContent: 'space-between' }]}>
          {cards.map((c, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, translateY: 20, scale: 0.9 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 80 }}
              style={[styles.cardWrap, { width: anchoTarjeta }]}
            >
              <View style={[styles.card, { backgroundColor: colors.surface }]}>
                <View style={[styles.iconWrap, { backgroundColor: c.color + '18' }]}>
                  <Ionicons name={c.icon} size={28} color={c.color} />
                </View>
                <MotiView
                  from={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 200 + i * 50 }}
                >
                  <Text style={[styles.cardValue, { color: colors.textPrimary }]}>{c.value}</Text>
                </MotiView>
                <Text style={[styles.cardTitle, { color: colors.textMuted }]}>{c.title}</Text>
              </View>
            </MotiView>
          ))}
        </View>

        <StaggeredItem index={6}>
          <View style={[styles.quickActions, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Acciones Rápidas</Text>
            <QuickAction icon="people-outline" label="Gestionar Usuarios"
              onPress={() => navigation.navigate('AdminUsuarios')} colors={colors} />
            <QuickAction icon="briefcase-outline" label="Ver Todas las Vacantes"
              onPress={() => navigation.navigate('AdminVacantes')} colors={colors} />
            <QuickAction icon="add-circle-outline" label="Crear Vacante (Admin)"
              onPress={() => navigation.navigate('AdminCrearVacante')} colors={colors} />
            <QuickAction icon="eye-outline" label="Vista Previa de Usuarios"
              onPress={() => navigation.navigate('AdminVistas')} colors={colors} />
          </View>
        </StaggeredItem>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress, colors }) {
  return (
    <AnimatedPressable style={[qaStyles.row, { borderBottomColor: colors.border }]} onPress={onPress} scaleValue={0.98} haptic={false}>
      <View style={qaStyles.left}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
        <Text style={[qaStyles.label, { color: colors.textPrimary }]}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
    </AnimatedPressable>
  );
}

const qaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  label: { fontSize: 16, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, paddingBottom: 100 },
  header: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4, marginBottom: SPACING.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  cardWrap: { width: '48%' },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, ...SHADOWS.small,
  },
  iconWrap: {
    width: 48, height: 48, borderRadius: RADIUS.md,
    justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.sm,
  },
  cardValue: { fontSize: 28, fontWeight: '700', color: COLORS.textPrimary },
  cardTitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  quickActions: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.lg, ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
});
