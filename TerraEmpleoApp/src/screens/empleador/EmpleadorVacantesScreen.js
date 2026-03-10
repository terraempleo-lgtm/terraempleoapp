import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI, notificacionesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { formatVacancyStartDate } from '../../utils/vacantesFecha';
import { getVacancyPayDisplay } from '../../utils/vacantesPago';

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
          style={[stackStyles.circle, { marginLeft: i === 0 ? 0 : -8, zIndex: circles - i }]}
        >
          <Ionicons name="person" size={11} color={COLORS.white} />
        </View>
      ))}
      {extra > 0 && (
        <View style={[stackStyles.circle, stackStyles.extra, { marginLeft: -8 }]}>
          <Text style={stackStyles.extraText}>+{extra}</Text>
        </View>
      )}
    </View>
  );
}

const stackStyles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary,
    borderWidth: 2, borderColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  extra: { backgroundColor: COLORS.primaryLight },
  extraText: { fontSize: 9, fontWeight: '700', color: COLORS.white },
});

export default function EmpleadorVacantesScreen({ navigation }) {
  const { user } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tabActiva, setTabActiva] = useState('activa');
  const [noLeidas, setNoLeidas] = useState(0);

  const firstName = (user?.nombre_completo || user?.nombre || 'Empleador').split(' ')[0];
  const nombreCompleto = user?.nombre_completo || user?.nombre || firstName;

  const cargarNoLeidas = useCallback(async () => {
    try {
      const res = await notificacionesAPI.contarNoLeidas();
      setNoLeidas(res.data.count || 0);
    } catch (_) {}
  }, []);

  const confirmarEliminar = (item) => {
    Alert.alert(
      'Eliminar vacante',
      `¿Seguro que quieres eliminar "${item.titulo}"? Esta acción no se puede deshacer.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              await vacantesAPI.eliminar(item.id);
              setVacantes((prev) => prev.filter((v) => v.id !== item.id));
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'No se pudo eliminar la vacante');
            }
          },
        },
      ]
    );
  };

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

  useEffect(() => { cargar(); cargarNoLeidas(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      cargar();
      cargarNoLeidas();
    });
    return unsub;
  }, [navigation]);

  const activas = vacantes.filter(v => v.estado === 'activa');
  const inactivas = vacantes.filter(v => v.estado !== 'activa');
  const lista = tabActiva === 'activa' ? activas : inactivas;

  const renderVacante = ({ item }) => {
    const isActiva = item.estado === 'activa';
    const postulantes = item.total_postulaciones || 0;
    const inicioTexto = formatVacancyStartDate(item.fecha_inicio, { fallback: '' });
    const pago = getVacancyPayDisplay(item);

    return (
      <View style={[styles.card, !isActiva && styles.cardInactiva]}>
        {/* Action buttons */}
        <View style={styles.cardActionsOverlay}>
          <TouchableOpacity
            onPress={() => navigation.navigate('EditarVacante', { vacante: item })}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionBtn}
          >
            <Ionicons name="pencil-outline" size={16} color={COLORS.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => confirmarEliminar(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.actionBtn}
          >
            <Ionicons name="trash-outline" size={16} color={COLORS.error} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={styles.cardPressable}
          onPress={() => navigation.navigate('DetalleVacanteEmpleador', { vacante: item })}
          activeOpacity={0.88}
        >
          {/* Image thumbnail */}
          <View style={styles.cardImg}>
            {item.foto_portada ? (
              <Image source={{ uri: item.foto_portada }} style={styles.img} resizeMode="cover" />
            ) : (
              <View style={styles.imgPlaceholder}>
                <Ionicons name="leaf" size={26} color={isActiva ? COLORS.primary : COLORS.textLight} />
              </View>
            )}
            {/* Status dot on image */}
            <View style={[styles.statusDot, { backgroundColor: isActiva ? COLORS.primary : COLORS.textLight }]} />
          </View>

          {/* Content */}
          <View style={styles.cardBody}>
            <View style={styles.cardTopRow}>
              <View style={[styles.estadoBadge, !isActiva && styles.estadoBadgeInactiva]}>
                <View style={[styles.estadoDot, { backgroundColor: isActiva ? COLORS.primary : COLORS.textLight }]} />
                <Text style={[styles.estadoText, !isActiva && styles.estadoTextInactiva]}>
                  {isActiva ? 'Activa' : 'Inactiva'}
                </Text>
              </View>
            </View>

            <Text style={[styles.cardTitle, !isActiva && styles.cardTitleInactiva]} numberOfLines={1}>
              {item.titulo}
            </Text>

            <View style={styles.cardLocationRow}>
              <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
              <Text style={styles.cardLocation} numberOfLines={1}>
                {[item.municipio, item.departamento].filter(Boolean).join(', ') || 'Colombia'}
              </Text>
            </View>

            {inicioTexto ? (
              <View style={styles.startDateBadge}>
                <Ionicons name="calendar-outline" size={12} color={COLORS.primary} />
                <Text style={styles.startDateBadgeText}>Inicio: {inicioTexto}</Text>
              </View>
            ) : null}

            <View style={styles.salaryRow}>
              <Ionicons name="cash-outline" size={13} color={COLORS.primary} />
              <Text style={styles.salaryText} numberOfLines={1}>{pago.valor}</Text>
            </View>

            {/* Footer: postulantes + time */}
            <View style={styles.cardFooter}>
              {isActiva ? (
                <View style={styles.postulantesRow}>
                  {postulantes > 0 && <AvatarStack count={postulantes} />}
                  <Text style={styles.postulantesText}>
                    {postulantes} {postulantes === 1 ? 'postulante' : 'postulantes'}
                  </Text>
                </View>
              ) : (
                <View style={styles.cubiertoWrap}>
                  <Ionicons name="checkmark-circle" size={14} color={COLORS.textLight} />
                  <Text style={styles.cubierto}>Cubierto</Text>
                </View>
              )}
              {item.created_at && (
                <Text style={styles.timeText}>{timeAgo(item.created_at)}</Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Greeting */}
      <View style={styles.greetingSection}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greetingLabel}>Hola, {firstName}</Text>
          <Text style={styles.greetingName}>{nombreCompleto}</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => navigation.navigate('Notificaciones')}
          >
            <Ionicons name="notifications-outline" size={22} color={COLORS.textPrimary} />
            {noLeidas > 0 && (
              <View style={styles.notifBadge}>
                <Text style={styles.notifBadgeText}>{noLeidas > 99 ? '99+' : noLeidas}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="leaf" size={20} color={COLORS.primary} />
          </View>
          <Text style={styles.headerTitle}>Mis Vacantes</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countBadgeText}>{vacantes.length}</Text>
          </View>
        </View>
        <View style={styles.headerRightActions}>
          <TouchableOpacity
            style={styles.postulantesBtn}
            onPress={() => navigation.navigate('MisPostulantes')}
            activeOpacity={0.85}
          >
            <Ionicons name="people-outline" size={18} color={COLORS.primary} />
            <Text style={styles.postulantesBtnText}>Mis postulantes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => navigation.navigate('CrearVacante')}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color={COLORS.white} />
            <Text style={styles.addBtnText}>Nueva</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {[
          { key: 'activa', label: 'Activas', count: activas.length },
          { key: 'inactiva', label: 'Inactivas', count: inactivas.length },
        ].map(tab => {
          const isActive = tabActiva === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setTabActiva(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              <View style={[styles.tabCount, isActive && styles.tabCountActive]}>
                <Text style={[styles.tabCountText, isActive && styles.tabCountTextActive]}>
                  {tab.count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* List */}
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
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={44} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>
              {tabActiva === 'activa' ? 'Sin vacantes activas' : 'Sin vacantes inactivas'}
            </Text>
            <Text style={styles.emptyText}>
              {tabActiva === 'activa'
                ? 'Crea tu primera vacante y empieza a recibir postulantes'
                : 'Las vacantes cerradas aparecerán aquí'}
            </Text>
            {tabActiva === 'activa' && (
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => navigation.navigate('CrearVacante')}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color={COLORS.white} />
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
  container: { flex: 1, backgroundColor: '#F8FAF9' },

  /* Greeting */
  greetingSection: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  greetingLabel: {
    fontSize: 14, color: COLORS.textSecondary, fontWeight: '500',
  },
  greetingName: {
    fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, lineHeight: 28,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  notifBtn: { position: 'relative', padding: 6 },
  notifBadge: {
    position: 'absolute', top: 2, right: 2,
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: COLORS.error,
    borderWidth: 2, borderColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 3,
  },
  notifBadgeText: { fontSize: 10, fontWeight: '700', color: COLORS.white },

  /* Header */
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  headerIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  countBadge: {
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  countBadgeText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: COLORS.white },
  postulantesBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1.2, borderColor: COLORS.primary,
  },
  postulantesBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* Tabs */
  tabs: {
    flexDirection: 'row', gap: SPACING.sm,
    paddingHorizontal: SPACING.lg, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
  },
  tab: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: '#F3F4F6',
  },
  tabActive: { backgroundColor: COLORS.primarySoft },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  tabTextActive: { color: COLORS.primary },
  tabCount: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 7, paddingVertical: 1,
    borderRadius: RADIUS.full,
  },
  tabCountActive: { backgroundColor: COLORS.primary },
  tabCountText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  tabCountTextActive: { color: COLORS.white },

  /* List */
  list: { padding: SPACING.md, paddingBottom: 100 },

  /* Card */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    ...SHADOWS.card,
    overflow: 'hidden',
    position: 'relative',
  },
  cardInactiva: { opacity: 0.7 },
  cardPressable: { flexDirection: 'row', padding: SPACING.md },
  cardActionsOverlay: {
    position: 'absolute', top: SPACING.sm + 2, right: SPACING.sm + 2,
    flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 10,
  },
  actionBtn: {
    width: 30, height: 30, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.small,
  },

  cardImg: {
    width: 76, height: 76,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    marginRight: SPACING.md,
    flexShrink: 0,
    position: 'relative',
  },
  img: { width: '100%', height: '100%' },
  imgPlaceholder: {
    flex: 1, backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  statusDot: {
    position: 'absolute', bottom: 4, right: 4,
    width: 10, height: 10, borderRadius: 5,
    borderWidth: 2, borderColor: COLORS.white,
  },

  cardBody: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row', alignItems: 'center',
    marginBottom: 4, paddingRight: 50,
  },
  estadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primarySoft,
  },
  estadoBadgeInactiva: { backgroundColor: '#F3F4F6' },
  estadoDot: { width: 6, height: 6, borderRadius: 3 },
  estadoText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },
  estadoTextInactiva: { color: COLORS.textSecondary },

  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 3 },
  cardTitleInactiva: { color: COLORS.textSecondary },
  cardLocationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 8 },
  cardLocation: { fontSize: 12, color: COLORS.textSecondary, flex: 1 },
  salaryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  salaryText: { flex: 1, fontSize: 13, color: COLORS.textPrimary, fontWeight: '700' },
  startDateBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
    backgroundColor: COLORS.accent,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  startDateBadgeText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '700',
  },

  cardFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: 6, borderTopWidth: 1, borderTopColor: COLORS.borderLight,
  },
  postulantesRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postulantesText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  cubiertoWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cubierto: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  timeText: { fontSize: 11, color: COLORS.textLight },

  /* Empty */
  empty: { alignItems: 'center', paddingTop: SPACING.xxl, paddingHorizontal: SPACING.xl },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  emptyText: {
    fontSize: 14, color: COLORS.textSecondary, textAlign: 'center',
    lineHeight: 20, marginBottom: SPACING.lg,
  },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg, paddingVertical: 13,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  emptyBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 15 },
});
