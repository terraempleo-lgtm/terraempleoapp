import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { adminAPI } from '../../services/api';
import { MotiView } from 'moti';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';
import { useAppTheme } from '../../context/ThemeContext';

export default function AdminPostulantesVacanteScreen({ route, navigation }) {
  const { colors, isDark } = useAppTheme();
  const { vacante } = route.params;
  const [postulaciones, setPostulaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cargar = async () => {
    try {
      const { data } = await adminAPI.getPostulantesVacante(vacante.id);
      setPostulaciones(data?.postulaciones || []);
    } catch (err) {
      const msg = err.response?.data?.error || 'No se pudieron cargar los postulantes';
      setPostulaciones([]);
      console.error(msg);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const renderItem = ({ item, index }) => (
    <StaggeredItem index={index}>
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={styles.topRow}>
          <Text style={[styles.nombre, { color: colors.textPrimary }]}>{item.nombre_completo || 'Trabajador'}</Text>
          <View style={styles.estadoBadge}>
            <Text style={styles.estadoText}>{item.estado || 'pendiente'}</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="call-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>{item.celular || 'Sin celular'}</Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>
            {item.municipio || 'Sin municipio'}, {item.departamento || 'Sin departamento'}
          </Text>
        </View>

        <View style={styles.infoRow}>
          <Ionicons name="stats-chart-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.infoText, { color: colors.textMuted }]}>Match: {Math.round(Number(item.puntaje_match || 0))}%</Text>
        </View>

        <AnimatedPressable
          style={[styles.perfilBtn, { backgroundColor: colors.background }]}
          onPress={() => navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: item.trabajador_id })}
          scaleValue={0.93}
          haptic
        >
          <Ionicons name="person-outline" size={15} color={COLORS.primary} />
          <Text style={styles.perfilBtnText}>Ver perfil</Text>
        </AnimatedPressable>
      </View>
    </StaggeredItem>
  );

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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <FadeInView delay={0}>
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>{vacante?.titulo || 'Postulantes'}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>{postulaciones.length} postulante(s)</Text>
        </View>
      </FadeInView>

      <FlatList
        data={postulaciones}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              cargar();
            }}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <FadeInView delay={0}>
              <Text style={[styles.empty, { color: colors.textMuted }]}>Esta vacante no tiene postulantes todavía.</Text>
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
  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  title: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  subtitle: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    ...SHADOWS.small,
  },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nombre: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, flex: 1, marginRight: SPACING.sm },
  estadoBadge: {
    backgroundColor: '#e6f7ee',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  estadoText: { fontSize: 12, fontWeight: '600', color: COLORS.primary, textTransform: 'capitalize' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.xs },
  infoText: { fontSize: 13, color: COLORS.textLight },
  perfilBtn: {
    marginTop: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  perfilBtnText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  empty: { fontSize: 15, color: COLORS.textLight },
});
