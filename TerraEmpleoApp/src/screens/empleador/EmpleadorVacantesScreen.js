import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'hoy';
  if (diff === 1) return 'hace 1 día';
  return `hace ${diff} días`;
}

function AvatarStack({ count }) {
  const circles = Math.min(count, 3);
  const extra = count > 3 ? count - 3 : 0;
  return (
    <View style={stackStyles.wrap}>
      {Array.from({ length: circles }).map((_, i) => (
        <View
          key={i}
          style={[stackStyles.circle, { marginLeft: i === 0 ? 0 : -10, zIndex: circles - i }]}
        >
          <Ionicons name="person" size={13} color={COLORS.white} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[stackStyles.circle, stackStyles.extra, { marginLeft: -10 }]}>
          <Text style={stackStyles.extraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: '#90A4AE',
    borderWidth: 2, borderColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  extra: { backgroundColor: '#B0BEC5' },
  extraText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
});

export default function EmpleadorVacantesScreen({ navigation }) {
  const { user } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tabActiva, setTabActiva] = useState('activa');

  const firstName = (user?.nombre_completo || 'Empleador').split(' ')[0];

  const cargar = useCallback(async () => {
    try {
      const res = await vacantesAPI.misVacantes();
      setVacantes(res.data.vacantes || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation]);

  const activas = vacantes.filter(v => v.estado === 'activa');
  const inactivas = vacantes.filter(v => v.estado !== 'activa');
  const lista = tabActiva === 'activa' ? activas : inactivas;

  const renderVacante = ({ item }) => {
    const isActiva = item.estado === 'activa';
    const postulantes = item.total_postulaciones || 0;

    return (
      <TouchableOpacity
        style={[styles.card, !isActiva && styles.cardInactiva]}
        onPress={() => navigation.navigate('DetalleVacanteEmpleador', { vacante: item })}
        activeOpacity={0.88}
      >
        {/* Imagen */}
        <View style={styles.cardImg}>
          {item.foto_portada ? (
            <Image source={{ uri: item.foto_portada }} style={styles.img} resizeMode="cover" />
          ) : (
            <View style={styles.imgPlaceholder}>
              <Ionicons name="leaf" size={28} color={isActiva ? COLORS.primary : COLORS.textLight} />
            </View>
          )}
        </View>

        {/* Contenido */}
        <View style={styles.cardBody}>
          {/* Badge + editar */}
          <View style={styles.cardTopRow}>
            <View style={[styles.estadoBadge, !isActiva && styles.estadoBadgeInactiva]}>
              <Text style={[styles.estadoText, !isActiva && styles.estadoTextInactiva]}>
                {isActiva ? 'Activa' : 'Inactiva'}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => navigation.navigate('EditarVacante', { vacante: item })}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="pencil-outline" size={17} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>

          {/* Título */}
          <Text style={[styles.cardTitle, !isActiva && styles.cardTitleInactiva]} numberOfLines={1}>
            {item.titulo}
          </Text>

          {/* Ubicación */}
          <Text style={styles.cardLocation} numberOfLines={1}>
            {[item.municipio, item.departamento, 'Colombia'].filter(Boolean).join(', ')}
          </Text>

          {/* Postulantes o cubierto */}
          {isActiva ? (
            <View style={styles.postulantesRow}>
              {postulantes > 0 && <AvatarStack count={postulantes} />}
              <Text style={styles.postulantesText}>
                {postulantes} {postulantes === 1 ? 'postulante' : 'postulantes'}
              </Text>
            </View>
          ) : (
            <Text style={styles.cubierto}>Puesto cubierto</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="leaf" size={22} color={COLORS.primary} />
          </View>
          <Text style={styles.headerTitle}>Mis Vacantes</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => navigation.navigate('CrearVacante')}
          activeOpacity={0.85}
        >
          <Ionicons name="add" size={24} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <View style={styles.divider} />

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'activa', label: `Activas (${activas.length})` },
          { key: 'inactiva', label: `Inactivas (${inactivas.length})` },
        ].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={styles.tab}
            onPress={() => setTabActiva(tab.key)}
          >
            <Text style={[styles.tabText, tabActiva === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
            {tabActiva === tab.key && <View style={styles.tabUnderline} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Lista */}
      <FlatList
        data={lista}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={renderVacante}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={56} color={COLORS.border} />
            <Text style={styles.emptyText}>
              {tabActiva === 'activa' ? 'No tienes vacantes activas' : 'No tienes vacantes inactivas'}
            </Text>
            {tabActiva === 'activa' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CrearVacante')}
              >
                <Text style={styles.emptyBtnText}>Crear vacante</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerIcon: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.small,
  },
  divider: { height: 1, backgroundColor: COLORS.borderLight },

  /* Tabs */
  tabs: { flexDirection: 'row', paddingHorizontal: SPACING.md, marginTop: SPACING.sm },
  tab: { marginRight: SPACING.lg, paddingBottom: SPACING.sm, position: 'relative' },
  tabText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  tabUnderline: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: 2, backgroundColor: COLORS.primary, borderRadius: 1,
  },

  /* Lista */
  list: { padding: SPACING.md, paddingBottom: 24 },

  /* Card */
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOWS.small,
    borderWidth: 1, borderColor: COLORS.borderLight,
  },
  cardInactiva: { opacity: 0.75 },

  cardImg: {
    width: 80, height: 80,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
    flexShrink: 0,
  },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: {
    flex: 1, backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },

  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6,
  },
  estadoBadge: {
    backgroundColor: '#e6f7ee',
    paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  estadoBadgeInactiva: { backgroundColor: '#F5F5F5' },
  estadoText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  estadoTextInactiva: { color: COLORS.textSecondary },

  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  cardTitleInactiva: { color: COLORS.textSecondary },
  cardLocation: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 8 },

  postulantesRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  postulantesText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  cubierto: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic' },

  /* Empty */
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.md },
  emptyText: { fontSize: 15, color: COLORS.textSecondary, textAlign: 'center' },
  emptyBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg, paddingVertical: 12,
    borderRadius: RADIUS.full,
  },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
