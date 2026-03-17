import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ScrollView,
  RefreshControl, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';

export default function AdminUsuariosScreen() {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const load = async () => {
    try {
      setError(null);
      const res = await adminAPI.getUsuarios();
      setUsuarios(res.data);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo conectar al servidor';
      setError(msg);
      console.error('Error cargando usuarios:', err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(() => { setRefreshing(true); load(); }, []);

  const toggleActivo = async (id, activo) => {
    try {
      await adminAPI.updateUsuario(id, { activo: !activo });
      Alert.alert('Listo', !activo ? 'Usuario activado correctamente' : 'Usuario desactivado correctamente');
      load();
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo actualizar el estado del usuario';
      Alert.alert('Error', msg);
    }
  };

  const eliminar = async (id) => {
    try {
      await adminAPI.eliminarUsuario(id);
      await load();
      Alert.alert('Listo', 'Usuario eliminado correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar el usuario';
      Alert.alert('Error', msg);
    }
  };

  const eliminarFinca = async (item) => {
    try {
      await adminAPI.eliminarEmpleador(item.id);
      await load();
      Alert.alert('Listo', 'Empleador y sus datos eliminados correctamente');
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudo eliminar el empleador';
      Alert.alert('Error', msg);
    }
  };

  const roleColor = (r) => r === 'trabajador' ? COLORS.primary : r === 'empleador' ? COLORS.accent : '#6A1B9A';
  const roleLabel = (r) => r === 'trabajador' ? 'Trabajador' : r === 'empleador' ? 'Empleador' : 'Admin';

  const renderItem = ({ item, index }) => (
    <StaggeredItem index={index}>
      <View style={styles.card}>
        <View style={styles.cardTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.nombre_completo}</Text>
            <Text style={styles.celular}>{item.celular}</Text>
          </View>
          <View style={[styles.roleBadge, { backgroundColor: roleColor(item.rol) + '18' }]}>
            <Text style={[styles.roleText, { color: roleColor(item.rol) }]}>{roleLabel(item.rol)}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textLight} />
          <Text style={styles.infoText}>{item.municipio}, {item.departamento}</Text>
        </View>

        <View style={styles.statusRow}>
          <View style={styles.badges}>
            <View style={[styles.statusBadge, { backgroundColor: item.activo ? '#e6f7ee' : '#FFEBEE' }]}>
              <Text style={[styles.statusText, { color: item.activo ? COLORS.primary : COLORS.error }]}>
                {item.activo ? 'Activo' : 'Inactivo'}
              </Text>
            </View>
            <View style={[styles.statusBadge, { backgroundColor: item.verificado_sms ? '#E3F2FD' : '#F3E5F5' }]}>
              <Text style={[styles.statusText, { color: item.verificado_sms ? '#1565C0' : '#7B1FA2' }]}>
                SMS: {item.verificado_sms ? 'Sí' : 'No'}
              </Text>
            </View>
          </View>
          <View style={styles.actions}>
            <AnimatedPressable onPress={() => toggleActivo(item.id, item.activo)} style={styles.actionBtn} scaleValue={0.85} haptic>
              <Ionicons name={item.activo ? 'pause-circle' : 'play-circle'} size={26}
                color={item.activo ? COLORS.accent : COLORS.primary} />
            </AnimatedPressable>
            {item.rol === 'empleador' && (
              <AnimatedPressable onPress={() => eliminarFinca(item)} style={styles.actionBtn} scaleValue={0.85} haptic>
                <Ionicons name="business-outline" size={22} color={COLORS.error} />
              </AnimatedPressable>
            )}
            {item.rol !== 'admin' && (
              <AnimatedPressable onPress={() => eliminar(item.id)} style={styles.actionBtn} scaleValue={0.85} haptic>
                <Ionicons name="trash-outline" size={22} color={COLORS.error} />
              </AnimatedPressable>
            )}
          </View>
        </View>
      </View>
    </StaggeredItem>
  );

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
        data={usuarios}
        keyExtractor={i => String(i.id)}
        renderItem={renderItem}
        contentContainerStyle={{ padding: SPACING.md, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <View style={styles.center}>
            <FadeInView delay={0}>
              <Text style={styles.empty}>No hay usuarios.</Text>
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
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  celular: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  roleBadge: { paddingHorizontal: SPACING.sm + 2, paddingVertical: 3, borderRadius: RADIUS.full },
  roleText: { fontSize: 12, fontWeight: '600' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  infoText: { fontSize: 13, color: COLORS.textLight },
  statusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  badges: { flexDirection: 'row', gap: 6 },
  statusBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  statusText: { fontSize: 11, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: SPACING.sm },
  actionBtn: { padding: 4 },
  empty: { fontSize: 16, color: COLORS.textLight },
});
