import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, TextInput, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI, chatsAPI } from '../../services/api';
import { AnimatedPressable } from '../../components/animated';

const TABS = [
  { key: 'todos', label: 'Todos', icon: 'people' },
  { key: 'nuevos', label: 'Nuevos', icon: 'flash' },
  { key: 'pendientes', label: 'Pendientes', icon: 'time' },
  { key: 'aceptados', label: 'Aceptados', icon: 'checkmark-circle' },
  { key: 'rechazados', label: 'Rechazados', icon: 'close-circle' },
];

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor((Date.now() - new Date(dateStr)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Hace 1 día';
  return `Hace ${diff} días`;
}

function normalizarEstado(estado) {
  if (estado === 'match_auto') return 'nuevo';
  if (estado === 'aceptada') return 'aceptado';
  if (estado === 'rechazada') return 'rechazado';
  return 'pendiente';
}

function getEstadoConfig(estadoNormalizado) {
  switch (estadoNormalizado) {
    case 'nuevo':
      return { label: 'Nuevo', icon: 'flash', color: COLORS.info, bg: COLORS.infoSoft };
    case 'aceptado':
      return { label: 'Aceptado', icon: 'checkmark-circle', color: COLORS.primary, bg: COLORS.primarySoft };
    case 'rechazado':
      return { label: 'Rechazado', icon: 'close-circle', color: COLORS.error, bg: COLORS.errorSoft };
    default:
      return { label: 'Pendiente', icon: 'time', color: COLORS.warning, bg: COLORS.warningSoft };
  }
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function MisPostulantesScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [postulantes, setPostulantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState('todos');
  const [search, setSearch] = useState('');

  const cargar = useCallback(async () => {
    try {
      const [misVacantesRes, chatsRes] = await Promise.all([
        vacantesAPI.misVacantes(),
        chatsAPI.misChats(),
      ]);

      const vacantes = misVacantesRes.data?.vacantes || [];
      const chats = chatsRes.data?.chats || [];

      const chatMap = new Map();
      chats.forEach((c) => {
        const key = `${Number(c.vacante_id)}-${Number(c.otro_usuario_id)}`;
        chatMap.set(key, c);
      });

      const postulacionesPorVacante = await Promise.all(
        vacantes.map(async (vacante) => {
          try {
            const res = await vacantesAPI.verPostulaciones(vacante.id);
            const lista = res.data?.postulaciones || [];
            return lista.map((p) => {
              const estadoNormalizado = normalizarEstado(p.estado);
              const chatKey = `${Number(vacante.id)}-${Number(p.trabajador_id)}`;
              const chat = chatMap.get(chatKey);

              return {
                ...p,
                estado_normalizado: estadoNormalizado,
                vacante,
                vacante_titulo: vacante.titulo,
                finca_nombre: vacante.nombre_empresa_finca || 'Mi finca',
                chat_id: chat?.id || null,
                chat_data: chat || null,
              };
            });
          } catch (_) {
            return [];
          }
        })
      );

      const plana = postulacionesPorVacante.flat();
      plana.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setPostulantes(plana);
    } catch (err) {
      console.error('Error cargando Mis Postulantes:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const filtered = useMemo(() => {
    return postulantes
      .filter((p) => {
        if (tab === 'todos') return true;
        if (tab === 'nuevos') return p.estado_normalizado === 'nuevo';
        if (tab === 'pendientes') return p.estado_normalizado === 'pendiente';
        if (tab === 'aceptados') return p.estado_normalizado === 'aceptado';
        if (tab === 'rechazados') return p.estado_normalizado === 'rechazado';
        return true;
      })
      .filter((p) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        const nombre = (p.nombre_completo || '').toLowerCase();
        const vacante = (p.vacante_titulo || '').toLowerCase();
        return nombre.includes(q) || vacante.includes(q);
      });
  }, [postulantes, tab, search]);

  const counts = useMemo(() => ({
    total: postulantes.length,
    nuevos: postulantes.filter((p) => p.estado_normalizado === 'nuevo').length,
    pendientes: postulantes.filter((p) => p.estado_normalizado === 'pendiente').length,
    aceptados: postulantes.filter((p) => p.estado_normalizado === 'aceptado').length,
    rechazados: postulantes.filter((p) => p.estado_normalizado === 'rechazado').length,
  }), [postulantes]);

  const getTabCount = (key) => {
    switch (key) {
      case 'todos': return counts.total;
      case 'nuevos': return counts.nuevos;
      case 'pendientes': return counts.pendientes;
      case 'aceptados': return counts.aceptados;
      case 'rechazados': return counts.rechazados;
      default: return 0;
    }
  };

  const irPerfil = (item) => {
    navigation.navigate('PerfilPublicoTrabajador', {
      trabajador_id: item.trabajador_id,
      vacante_id: item.vacante?.id,
      postulacion_estado: item.estado,
    });
  };

  const irVacante = (item) => {
    navigation.navigate('DetalleVacanteEmpleador', { vacante: item.vacante });
  };

  const irPostulacion = (item) => {
    navigation.navigate('VerPostulaciones', { vacante: item.vacante });
  };

  const irChat = (item) => {
    if (!item.chat_data) return;
    navigation.navigate('Mensajes', {
      screen: 'ChatDetalle',
      params: { chat: item.chat_data },
    });
  };

  const renderItem = ({ item }) => {
    const estado = getEstadoConfig(item.estado_normalizado);
    const matchPct = Math.round(item.puntaje_match || 0);
    const initials = getInitials(item.nombre_completo);

    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        {/* Left accent bar */}
        <View style={[styles.statusBar, { backgroundColor: estado.color }]} />

        <View style={styles.cardBody}>
          {/* Top row: avatar + name + badge */}
          <View style={styles.topRow}>
            <AnimatedPressable onPress={() => irPerfil(item)}>
              <View style={[styles.avatarWrap, { backgroundColor: COLORS.primarySoft }]}>
                {item.foto_selfie ? (
                  <Image source={{ uri: item.foto_selfie }} style={styles.avatar} />
                ) : (
                  <Text style={[styles.avatarInitials, { color: COLORS.primary }]}>{initials}</Text>
                )}
              </View>
            </AnimatedPressable>

            <View style={styles.mainInfo}>
              <Text style={[styles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>
                {item.nombre_completo || 'Postulante'}
              </Text>
              {/* Vacante chip */}
              <View style={[styles.vacanteChip, { backgroundColor: isDark ? colors.surface : COLORS.primarySoft, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}>
                <Ionicons name="briefcase-outline" size={11} color={COLORS.primary} />
                <Text style={styles.vacanteChipText} numberOfLines={1}>{item.vacante_titulo || 'Vacante'}</Text>
              </View>
              <Text style={[styles.finca, { color: colors.textSecondary }]} numberOfLines={1}>
                {item.finca_nombre}
              </Text>
            </View>

            <View style={[styles.estadoBadge, { backgroundColor: estado.bg }]}>
              <Ionicons name={estado.icon} size={12} color={estado.color} />
              <Text style={[styles.estadoText, { color: estado.color }]}>{estado.label}</Text>
            </View>
          </View>

          {/* Meta row: date + match */}
          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.textSecondary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
            </View>
            {matchPct > 0 && (
              <View style={[styles.matchPill, { backgroundColor: COLORS.primarySoft }]}>
                <Ionicons name="flash" size={12} color={COLORS.primary} />
                <Text style={[styles.matchPillText, { color: COLORS.primary }]}>{matchPct}% match</Text>
              </View>
            )}
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />

          {/* Action buttons */}
          <View style={styles.actionsRow}>
            <AnimatedPressable
              style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}
              onPress={() => irPerfil(item)}
            >
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Perfil</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}
              onPress={() => irVacante(item)}
            >
              <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Vacante</Text>
            </AnimatedPressable>

            <AnimatedPressable
              style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : COLORS.borderLight, borderWidth: isDark ? 1 : 0, borderColor: colors.border }]}
              onPress={() => irPostulacion(item)}
            >
              <Ionicons name="reader-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Postulación</Text>
            </AnimatedPressable>
          </View>

          {item.chat_id ? (
            <AnimatedPressable style={styles.btnChat} onPress={() => irChat(item)}>
              <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.primary} />
              <Text style={styles.btnChatText}>Ir al chat</Text>
            </AnimatedPressable>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      {/* Header */}
      <View style={[styles.header, { borderColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mis Postulantes</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Panel rápido de reclutamiento</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: colors.textPrimary }]}>{counts.total}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: COLORS.info }]}>{counts.nuevos}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Nuevos</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.statNum, { color: COLORS.primary }]}>{counts.aceptados}</Text>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aceptados</Text>
        </View>
      </View>

      {/* Tabs — horizontal scrollable pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScroll}
        style={styles.tabsContainer}
      >
        {TABS.map((t) => {
          const active = tab === t.key;
          const count = getTabCount(t.key);
          return (
            <AnimatedPressable
              key={t.key}
              style={[
                styles.tabPill,
                { backgroundColor: active ? COLORS.primary : colors.surface },
                !active && { borderWidth: 1, borderColor: colors.border },
              ]}
              onPress={() => setTab(t.key)}
            >
              <Ionicons name={t.icon} size={13} color={active ? COLORS.white : colors.textSecondary} />
              <Text style={[styles.tabPillText, { color: active ? COLORS.white : colors.textSecondary }]}>
                {t.label}
              </Text>
              {count > 0 && (
                <View style={[styles.tabCount, { backgroundColor: active ? 'rgba(255,255,255,0.25)' : COLORS.primarySoft }]}>
                  <Text style={[styles.tabCountText, { color: active ? COLORS.white : COLORS.primary }]}>
                    {count}
                  </Text>
                </View>
              )}
            </AnimatedPressable>
          );
        })}
      </ScrollView>

      {/* Search with icon */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar por trabajador o vacante..."
          placeholderTextColor={colors.textSecondary}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <AnimatedPressable onPress={() => setSearch('')} haptic={false}>
            <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
          </AnimatedPressable>
        )}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
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
            <View style={[styles.emptyIconWrap, { backgroundColor: COLORS.primarySoft }]}>
              <Ionicons name="people-outline" size={44} color={COLORS.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin postulantes por ahora</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Cuando lleguen postulaciones aparecerán aquí con acceso rápido.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Header */
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerSub: { fontSize: 13, marginTop: 2 },

  /* Stats */
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  statCard: {
    flex: 1,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    ...SHADOWS.small,
  },
  statNum: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },

  /* Tabs — horizontal scrollable pills */
  tabsContainer: { paddingHorizontal: SPACING.lg, marginBottom: SPACING.sm },
  tabsScroll: { gap: SPACING.sm, paddingRight: SPACING.sm },
  tabPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 13, paddingVertical: 8,
    borderRadius: RADIUS.full,
    ...SHADOWS.small,
  },
  tabPillText: { fontSize: 12, fontWeight: '600' },
  tabCount: {
    paddingHorizontal: 6, paddingVertical: 1,
    borderRadius: RADIUS.full,
    minWidth: 20, alignItems: 'center',
  },
  tabCountText: { fontSize: 11, fontWeight: '700' },

  /* Search */
  searchWrap: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 11,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  /* List */
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },

  /* Card */
  card: {
    flexDirection: 'row',
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  statusBar: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.md },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  avatarWrap: {
    width: 54, height: 54, borderRadius: 27,
    overflow: 'hidden', flexShrink: 0,
    justifyContent: 'center', alignItems: 'center',
  },
  avatar: { width: 54, height: 54, borderRadius: 27 },
  avatarInitials: { fontSize: 18, fontWeight: '800' },
  mainInfo: { flex: 1, minWidth: 0 },
  nombre: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  vacanteChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    marginBottom: 2,
    maxWidth: '100%',
  },
  vacanteChipText: { fontSize: 11, fontWeight: '700', color: COLORS.primary, flexShrink: 1 },
  finca: { fontSize: 12, marginTop: 1 },

  estadoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 5,
    borderRadius: RADIUS.full,
    flexShrink: 0,
  },
  estadoText: { fontSize: 11, fontWeight: '700' },

  /* Meta row */
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm, flexWrap: 'wrap' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12 },
  matchPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  matchPillText: { fontSize: 12, fontWeight: '700' },

  divider: { height: 1, marginBottom: SPACING.sm },

  /* Actions */
  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  btnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  btnOutlineText: { fontSize: 12, fontWeight: '600' },
  btnChat: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.5, borderColor: COLORS.primary,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  btnChatText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  /* Empty */
  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginBottom: SPACING.xs },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
});
