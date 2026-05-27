import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  RefreshControl, Alert, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { useAppTheme } from '../../context/ThemeContext';

const MODALIDAD_LABELS = {
  presencial: 'Presencial',
  remoto: 'Remoto',
  mixto: 'Mixto',
  por_proyecto: 'Por proyecto',
};

export default function AdminServiciosScreen() {
  const { colors } = useAppTheme();
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setError(null);
      const res = await adminAPI.getServicios();
      setServicios(res.data.servicios || []);
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo conectar al servidor');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const toggleArchivar = async (item) => {
    const nuevoEstado = !item.activo;
    try {
      await adminAPI.updateServicio(item.id, { activo: nuevoEstado ? 1 : 0 });
      setServicios(prev => prev.map(s => s.id === item.id ? { ...s, activo: nuevoEstado } : s));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar el servicio');
    }
  };

  const eliminar = async (item) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`¿Eliminar el servicio "${item.titulo}"?`)
      : await new Promise(resolve => Alert.alert(
          'Confirmar eliminación',
          `¿Eliminar el servicio "${item.titulo}" de ${item.nombre_completo}?`,
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) },
          ]
        ));
    if (!ok) return;
    try {
      await adminAPI.deleteServicio(item.id);
      setServicios(prev => prev.filter(s => s.id !== item.id));
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo eliminar el servicio');
    }
  };

  const renderItem = ({ item, index }) => {
    const fecha = item.created_at
      ? new Date(item.created_at).toLocaleDateString('es-CO')
      : 'Sin fecha';
    const activo = Boolean(item.activo);
    const precio = item.precio_desde
      ? `$${Number(item.precio_desde).toLocaleString('es-CO')}${item.precio_hasta ? ` - $${Number(item.precio_hasta).toLocaleString('es-CO')}` : '+'}`
      : null;

    return (
      <StaggeredItem index={index}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.titulo, { color: colors.textPrimary }]} numberOfLines={2}>{item.titulo}</Text>
              <Text style={[styles.especialista, { color: colors.textSecondary }]}>{item.nombre_completo}</Text>
            </View>
            <View style={[styles.estadoBadge, { backgroundColor: activo ? '#e6f7ee' : '#f5f5f5' }]}>
              <Text style={[styles.estadoText, { color: activo ? COLORS.primary : colors.textMuted }]}>
                {activo ? 'Activo' : 'Archivado'}
              </Text>
            </View>
          </View>

          {item.descripcion ? (
            <Text style={[styles.descripcion, { color: colors.textSecondary }]} numberOfLines={2}>
              {item.descripcion}
            </Text>
          ) : null}

          <View style={styles.metaRow}>
            {item.modalidad ? (
              <View style={styles.chip}>
                <Ionicons name="briefcase-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.chipText, { color: colors.textMuted }]}>
                  {MODALIDAD_LABELS[item.modalidad] || item.modalidad}
                </Text>
              </View>
            ) : null}
            {precio ? (
              <View style={styles.chip}>
                <Ionicons name="cash-outline" size={12} color={colors.textMuted} />
                <Text style={[styles.chipText, { color: colors.textMuted }]}>{precio}</Text>
              </View>
            ) : null}
          </View>

          <View style={[styles.footer, { borderTopColor: colors.border }]}>
            <Text style={[styles.fecha, { color: colors.textMuted }]}>{fecha}</Text>
            <View style={styles.actions}>
              <AnimatedPressable
                onPress={() => toggleArchivar(item)}
                style={[styles.actionBtn, { backgroundColor: colors.background }]}
                scaleValue={0.9} haptic hapticStyle="light"
              >
                <Ionicons
                  name={activo ? 'archive-outline' : 'refresh-outline'}
                  size={16}
                  color={activo ? COLORS.accent : COLORS.primary}
                />
                <Text style={[styles.actionText, { color: activo ? COLORS.accent : COLORS.primary }]}>
                  {activo ? 'Archivar' : 'Restaurar'}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => eliminar(item)}
                style={[styles.actionBtn, { backgroundColor: colors.background }]}
                scaleValue={0.9} haptic hapticStyle="light"
              >
                <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                <Text style={[styles.actionText, { color: COLORS.error }]}>Eliminar</Text>
              </AnimatedPressable>
            </View>
          </View>
        </View>
      </StaggeredItem>
    );
  };

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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <ScrollView
          contentContainerStyle={[styles.center, { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <Ionicons name="cloud-offline-outline" size={48} color={colors.textMuted} />
          <FadeInView delay={100}>
            <Text style={{ fontSize: 16, color: colors.textMuted, marginTop: SPACING.md, textAlign: 'center' }}>{error}</Text>
          </FadeInView>
          <FadeInView delay={200}>
            <AnimatedPressable
              onPress={() => { setLoading(true); load(); }}
              style={{ marginTop: SPACING.lg, backgroundColor: COLORS.primary, paddingHorizontal: SPACING.xl, paddingVertical: SPACING.sm, borderRadius: RADIUS.md }}
              scaleValue={0.95} haptic
            >
              <Text style={{ color: '#fff', fontWeight: '600' }}>Reintentar</Text>
            </AnimatedPressable>
          </FadeInView>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <FlatList
        data={servicios}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={
          <FadeInView delay={0}>
            <Text style={[styles.header, { color: colors.textPrimary }]}>
              Servicios de especialistas{servicios.length ? ` (${servicios.length})` : ''}
            </Text>
          </FadeInView>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Ionicons name="cube-outline" size={48} color={colors.textMuted} />
            <FadeInView delay={100}>
              <Text style={[styles.empty, { color: colors.textMuted }]}>No hay servicios.</Text>
            </FadeInView>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  header: { fontSize: 20, fontWeight: '700', marginBottom: SPACING.md },
  card: {
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo: { fontSize: 15, fontWeight: '700', flex: 1 },
  especialista: { fontSize: 13, marginTop: 2 },
  descripcion: { fontSize: 13, marginTop: SPACING.xs },
  estadoBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  estadoText: { fontSize: 12, fontWeight: '600' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f0f0f0', paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  chipText: { fontSize: 12 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1 },
  fecha: { fontSize: 12 },
  actions: { flexDirection: 'row', gap: SPACING.xs },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 6, borderRadius: RADIUS.md },
  actionText: { fontSize: 12, fontWeight: '600' },
  empty: { fontSize: 15, marginTop: SPACING.md },
});
