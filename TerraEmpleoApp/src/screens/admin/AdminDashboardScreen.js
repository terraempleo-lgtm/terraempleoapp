import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl,
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
          <Ionicons name="leaf" size={48} color={colors.primary} />
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
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        >
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', ...ANIMATION.spring.gentle }}
          >
            <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted} />
          </MotiView>
          <FadeInView delay={100}>
            <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>{error}</Text>
          </FadeInView>
          <FadeInView delay={200}>
            <AnimatedPressable
              onPress={() => { setLoading(true); load(); }}
              style={{ marginTop: SPACING.lg, backgroundColor: colors.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md }}
              scaleValue={0.95}
              haptic
            >
              <Text style={{ color: COLORS.white, fontWeight: '600' }}>Reintentar</Text>
            </AnimatedPressable>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const statCards = [
    {
      title: 'Usuarios',
      value: (stats?.trabajadores || 0) + (stats?.empleadores || 0),
      icon: 'people',
      color: colors.primary,
      softColor: isDark ? 'rgba(61,208,143,0.15)' : COLORS.primarySoft,
      borderColor: colors.primary,
    },
    {
      title: 'Vacantes',
      value: stats?.vacantes_activas || 0,
      label: 'activas',
      icon: 'briefcase',
      color: colors.warning,
      softColor: isDark ? 'rgba(251,191,36,0.12)' : COLORS.warningSoft,
      borderColor: colors.warning,
    },
    {
      title: 'Postulaciones',
      value: stats?.postulaciones || 0,
      icon: 'document-text',
      color: colors.primary,
      softColor: isDark ? 'rgba(59,130,246,0.12)' : COLORS.infoSoft,
      borderColor: COLORS.info,
      textColor: COLORS.info,
    },
    {
      title: 'Calificaciones',
      value: stats?.calificaciones || 0,
      icon: 'star',
      color: COLORS.star ?? colors.warning,
      softColor: isDark ? 'rgba(245,158,11,0.12)' : '#FFFBEB',
      borderColor: COLORS.star ?? colors.warning,
      textColor: '#B45309',
    },
  ];
  const anchoTarjeta = columnas === 1 ? '100%' : columnas === 2 ? '48%' : '31%';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        <FadeInView delay={0}>
          <View style={styles.pageHeader}>
            <View style={[styles.pageIconWrap, { backgroundColor: isDark ? 'rgba(61,208,143,0.15)' : COLORS.primarySoft }]}>
              <Ionicons name="shield-checkmark" size={22} color={colors.primary} />
            </View>
            <View>
              <Text style={[styles.header, { color: colors.textPrimary }]}>Panel Admin</Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>Resumen general de TerraEmpleo</Text>
            </View>
          </View>
        </FadeInView>

        <View style={[styles.grid, columnas > 1 && { justifyContent: 'space-between' }]}>
          {statCards.map((c, i) => (
            <MotiView
              key={i}
              from={{ opacity: 0, translateY: 20, scale: 0.92 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              transition={{ type: 'spring', ...ANIMATION.spring.gentle, delay: i * 80 }}
              style={[styles.cardWrap, { width: anchoTarjeta }]}
            >
              <View style={[
                styles.statCard,
                { backgroundColor: colors.surface, borderLeftColor: c.borderColor },
                isDark && { borderColor: colors.border, borderWidth: 1 },
              ]}>
                <View style={[styles.statIconWrap, { backgroundColor: c.softColor }]}>
                  <Ionicons name={c.icon} size={20} color={c.textColor || c.color} />
                </View>
                <MotiView
                  from={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', ...ANIMATION.spring.bouncy, delay: 220 + i * 50 }}
                >
                  <Text style={[styles.statValue, { color: c.textColor || c.color }]}>{c.value}</Text>
                </MotiView>
                <Text style={[styles.statTitle, { color: colors.textMuted }]}>{c.title}</Text>
                {c.label ? (
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>{c.label}</Text>
                ) : null}
              </View>
            </MotiView>
          ))}
        </View>

        {/* Secondary stats row */}
        <StaggeredItem index={4}>
          <View style={[styles.secondaryRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <SecondaryStatItem
              icon="person-add-outline"
              label="Trabajadores"
              value={stats?.trabajadores || 0}
              color={colors.primary}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SecondaryStatItem
              icon="business-outline"
              label="Empleadores"
              value={stats?.empleadores || 0}
              color={colors.warning}
              colors={colors}
            />
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <SecondaryStatItem
              icon="layers-outline"
              label="Vacantes totales"
              value={stats?.vacantes_total || 0}
              color={COLORS.info}
              colors={colors}
            />
          </View>
        </StaggeredItem>

        {/* Quick actions */}
        <StaggeredItem index={5}>
          <View style={[styles.quickActions, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.sectionHeaderRow}>
              <Ionicons name="flash" size={18} color={colors.primary} />
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Acciones Rápidas</Text>
            </View>
            <QuickAction
              icon="people-outline"
              label="Gestionar Usuarios"
              description="Ver, activar y revisar cuentas"
              onPress={() => navigation.navigate('AdminUsuarios')}
              colors={colors}
              isDark={isDark}
            />
            <QuickAction
              icon="briefcase-outline"
              label="Ver Todas las Vacantes"
              description="Administrar ofertas de empleo"
              onPress={() => navigation.navigate('AdminVacantes')}
              colors={colors}
              isDark={isDark}
            />
          </View>
        </StaggeredItem>
      </ScrollView>
    </SafeAreaView>
  );
}

function SecondaryStatItem({ icon, label, value, color, colors }) {
  return (
    <View style={styles.secStatItem}>
      <Ionicons name={icon} size={16} color={color} />
      <Text style={[styles.secStatValue, { color: colors.textPrimary }]}>{value}</Text>
      <Text style={[styles.secStatLabel, { color: colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function QuickAction({ icon, label, description, onPress, colors, isDark }) {
  return (
    <AnimatedPressable
      style={[qaStyles.row, { borderBottomColor: colors.border }]}
      onPress={onPress}
      scaleValue={0.98}
      haptic={false}
    >
      <View style={[qaStyles.iconBox, { backgroundColor: isDark ? 'rgba(61,208,143,0.13)' : COLORS.primarySoft }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={qaStyles.textBlock}>
        <Text style={[qaStyles.label, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[qaStyles.desc, { color: colors.textMuted }]}>{description}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </AnimatedPressable>
  );
}

const qaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textBlock: { flex: 1 },
  label: { fontSize: 15, fontWeight: '700' },
  desc: { fontSize: 12, marginTop: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, paddingBottom: 100 },

  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  pageIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 13, marginTop: 1 },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.sm },
  cardWrap: { width: '48%' },
  statCard: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderLeftWidth: 4,
    ...SHADOWS.small,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  statValue: { fontSize: 34, fontWeight: '900', lineHeight: 38 },
  statTitle: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  statLabel: { fontSize: 11, marginTop: 1 },

  secondaryRow: {
    flexDirection: 'row',
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  secStatItem: { flex: 1, alignItems: 'center', gap: 3 },
  secStatValue: { fontSize: 20, fontWeight: '800' },
  secStatLabel: { fontSize: 11, fontWeight: '500', textAlign: 'center' },
  divider: { width: 1, marginVertical: 4 },

  quickActions: {
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.xs,
    borderWidth: 1,
    ...SHADOWS.small,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700' },
});
