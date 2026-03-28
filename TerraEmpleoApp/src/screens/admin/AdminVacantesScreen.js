import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  RefreshControl, Alert, TouchableOpacity, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { showAlert } from '../../utils/alertService';

const LABELS_PAGO = {
  jornal: 'Jornal (diario)', semanal: 'Semanal',
  quincenal: 'Quincenal', mensual: 'Mensual', destajo: 'Por tarea / destajo',
};

export default function AdminVacantesScreen({ navigation }) {
  const [vacantes, setVacantes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setError(null);
      const res = await adminAPI.getVacantes();
      setVacantes(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo conectar al servidor';
      setError(msg);
      console.error('Error cargando vacantes:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const cambiarEstado = async (item) => {
    const siguienteEstado = item.estado === 'activa' ? 'pausada' : 'activa';
    try {
      await adminAPI.updateVacante(item.id, { estado: siguienteEstado });
      showAlert('Listo', `Vacante ${siguienteEstado === 'activa' ? 'activada' : 'pausada'} correctamente`);
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo actualizar el estado de la vacante';
      showAlert('Error', msg);
    }
  };

  const verPostulantes = (item) => {
    navigation.navigate('AdminVerPostulantes', { vacante: item });
  };

  const abrirDetalleVacante = (item) => {
    navigation.navigate('AdminDetalleVacante', { vacante: item });
  };

  const abrirDetalleEmpleador = (item) => {
    if (!item?.id) return;
    navigation.navigate('PerfilPublicoEmpleador', { vacante_id: item.id });
  };

  const eliminar = async (vacante) => {
    const ok = Platform.OS === 'web'
      ? window.confirm(`¿Eliminar la vacante "${vacante.titulo}"?`)
      : await new Promise(resolve => showAlert(
          'Confirmar eliminación',
          `¿Estás seguro de que deseas eliminar la vacante "${vacante.titulo}"?`,
          [{ text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
           { text: 'Eliminar', style: 'destructive', onPress: () => resolve(true) }]
        ));
    if (!ok) return;
    try {
      await adminAPI.eliminarVacante(vacante.id);
      await load();
      showAlert('Listo', 'Vacante eliminada correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar la vacante';
      showAlert('Error', msg);
    }
  };

  const estadoColor = (e) => {
    if (e === 'activa') return { bg: '#e6f7ee', fg: COLORS.primary };
    if (e === 'cerrada') return { bg: '#FFEBEE', fg: COLORS.error };
    return { bg: '#FFF3E0', fg: COLORS.accent };
  };

  const renderItem = ({ item, index }) => {
    const ec = estadoColor(item.estado);
    const fechaTexto = item?.created_at
      ? new Date(item.created_at).toLocaleDateString('es-CO')
      : 'Sin fecha';
    return (
      <StaggeredItem index={index}>
        <AnimatedPressable style={styles.card} onPress={() => abrirDetalleVacante(item)} scaleValue={0.99} haptic={false}>
          <View style={styles.cardTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.titulo}>{item.titulo}</Text>
              <TouchableOpacity
                onPress={() => abrirDetalleEmpleador(item)}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.empresaLink}>{item.nombre_empresa_finca || 'Sin nombre'}</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.estadoBadge, { backgroundColor: ec.bg }]}>
              <Text style={[styles.estadoText, { color: ec.fg }]}>{item.estado}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.infoText}>{item.municipio}, {item.departamento}</Text>
          </View>
          <View style={styles.infoRow}>
            <Ionicons name="cash-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.infoText}>
              ${item.salario_ofrecido ? Number(item.salario_ofrecido).toLocaleString() : 'N/A'} - {LABELS_PAGO[item.tipo_pago] || item.tipo_pago || 'N/A'}
            </Text>
          </View>

          {item.urgente ? (
            <View style={[styles.urgenteBadge]}>
              <Ionicons name="alert-circle" size={14} color={COLORS.error} />
              <Text style={styles.urgenteText}>Urgente</Text>
            </View>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.fecha}>{fechaTexto}</Text>
            <View style={styles.actions}>
              <AnimatedPressable onPress={() => verPostulantes(item)} style={styles.actionBtn} scaleValue={0.9} haptic hapticStyle="light">
                <Ionicons name="people-outline" size={16} color={COLORS.primary} />
                <Text style={[styles.actionText, { color: COLORS.primary }]}>Ver postulantes</Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => cambiarEstado(item)} style={styles.actionBtn} scaleValue={0.9} haptic hapticStyle="light">
                <Ionicons
                  name={item.estado === 'activa' ? 'pause-circle-outline' : 'play-circle-outline'}
                  size={16}
                  color={item.estado === 'activa' ? COLORS.accent : COLORS.primary}
                />
                <Text style={[styles.actionText, { color: item.estado === 'activa' ? COLORS.accent : COLORS.primary }]}>
                  {item.estado === 'activa' ? 'Pausar' : 'Activar'}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable onPress={() => eliminar(item)} style={styles.actionBtn} scaleValue={0.9} haptic hapticStyle="light">
                <Ionicons name="trash-outline" size={16} color={COLORS.error} />
                <Text style={[styles.actionText, { color: COLORS.error }]}>Eliminar</Text>
              </AnimatedPressable>
            </View>
          </View>
        </AnimatedPressable>
      </StaggeredItem>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
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
      <SafeAreaView style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.center, { flex: 1 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        >
          <MotiView
            from={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', ...ANIMATION.spring.gentle }}
          >
            <Ionicons name="cloud-offline-outline" size={48} color={COLORS.textLight} />
          </MotiView>
          <FadeInView delay={100}>
            <Text style={{ fontSize: 16, color: COLORS.textLight, marginTop: SPACING.md, textAlign: 'center' }}>{error}</Text>
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

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={vacantes}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <FadeInView delay={0}>
              <Text style={styles.empty}>No hay vacantes.</Text>
            </FadeInView>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: SPACING.xl },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.sm, ...SHADOWS.small,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  titulo: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  empresa: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  empresaLink: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 2,
    textDecorationLine: 'underline',
    fontWeight: '600',
    alignSelf: 'flex-start',
  },
  estadoBadge: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 3, borderRadius: RADIUS.full },
  estadoText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs },
  infoText: { fontSize: 13, color: COLORS.textLight },
  urgenteBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: SPACING.sm, backgroundColor: '#FFEBEE',
    paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  urgenteText: { fontSize: 12, fontWeight: '600', color: COLORS.error },
  footer: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  fecha: { fontSize: 12, color: COLORS.textLight },
  actions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
  },
  actionText: { fontSize: 11, fontWeight: '600' },
  empty: { fontSize: 16, color: COLORS.textLight },
});
