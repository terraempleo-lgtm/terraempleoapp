import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function AdminDashboardScreen({ navigation }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const res = await adminAPI.getDashboard();
      setStats(res.data);
    } catch (err) {
      console.error(err);
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
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
      >
        <Text style={styles.header}>Panel de Administración</Text>
        <Text style={styles.subtitle}>Resumen general de TerraEmpleo</Text>

        <View style={styles.grid}>
          {cards.map((c, i) => (
            <View key={i} style={styles.card}>
              <View style={[styles.iconWrap, { backgroundColor: c.color + '18' }]}>
                <Ionicons name={c.icon} size={28} color={c.color} />
              </View>
              <Text style={styles.cardValue}>{c.value}</Text>
              <Text style={styles.cardTitle}>{c.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.quickActions}>
          <Text style={styles.sectionTitle}>Acciones Rápidas</Text>
          <QuickAction icon="people-outline" label="Gestionar Usuarios"
            onPress={() => navigation.navigate('AdminUsuarios')} />
          <QuickAction icon="briefcase-outline" label="Ver Todas las Vacantes"
            onPress={() => navigation.navigate('AdminVacantes')} />
          <QuickAction icon="add-circle-outline" label="Crear Vacante (Admin)"
            onPress={() => navigation.navigate('AdminCrearVacante')} />
          <QuickAction icon="eye-outline" label="Vista Previa de Usuarios"
            onPress={() => navigation.navigate('AdminVistas')} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={qaStyles.row} onPress={onPress} activeOpacity={0.8}>
      <View style={qaStyles.left}>
        <Ionicons name={icon} size={22} color={COLORS.primary} />
        <Text style={qaStyles.label}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );
}

const qaStyles = StyleSheet.create({
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  left: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  label: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  content: { padding: SPACING.md, paddingBottom: 100 },
  header: { fontSize: 26, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 14, color: COLORS.textLight, marginTop: 4, marginBottom: SPACING.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  card: {
    width: '48%', backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
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
