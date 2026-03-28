import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { vacantesAPI, chatsAPI } from '../../services/api';

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
  if (diff === 1) return 'Hace 1 dia';
  return `Hace ${diff} dias`;
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

    return (
      <View style={[styles.card, { backgroundColor: colors.surface }]}>
        <View style={[styles.statusBar, { backgroundColor: estado.color }]} />

        <View style={styles.cardBody}>
          <View style={styles.topRow}>
            <View style={[styles.avatarWrap, { backgroundColor: isDark ? colors.surface : '#B0BEC5' }]}>
              {item.foto_selfie ? (
                <Image source={{ uri: item.foto_selfie }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarFallback}><Ionicons name="person" size={20} color={COLORS.white} /></View>
              )}
            </View>

            <View style={styles.mainInfo}>
              <Text style={[styles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>{item.nombre_completo || 'Postulante'}</Text>
              <Text style={[styles.vacante, { color: colors.textSecondary }]} numberOfLines={1}>{item.vacante_titulo || 'Vacante'}</Text>
              <Text style={[styles.finca, { color: colors.textMuted }]} numberOfLines={1}>{item.finca_nombre}</Text>
            </View>

            <View style={[styles.estadoBadge, { backgroundColor: estado.bg }]}>
              <Ionicons name={estado.icon} size={12} color={estado.color} />
              <Text style={[styles.estadoText, { color: estado.color }]}>{estado.label}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>{timeAgo(item.created_at)}</Text>
            </View>
            {matchPct > 0 ? (
              <View style={styles.metaItem}>
                <Ionicons name="flash-outline" size={13} color={COLORS.primary} />
                <Text style={[styles.metaText, { color: COLORS.primary, fontWeight: '700' }]}>{matchPct}% match</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]} onPress={() => irPerfil(item)}>
              <Ionicons name="person-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Ver perfil</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]} onPress={() => irVacante(item)}>
              <Ionicons name="briefcase-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Ver vacante</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.btnOutline, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }]} onPress={() => irPostulacion(item)}>
              <Ionicons name="reader-outline" size={14} color={colors.textSecondary} />
              <Text style={[styles.btnOutlineText, { color: colors.textSecondary }]}>Ver postulacion</Text>
            </TouchableOpacity>
          </View>

          {item.chat_id ? (
            <TouchableOpacity style={styles.btnChat} onPress={() => irChat(item)}>
              <Ionicons name="chatbubble-ellipses" size={14} color={COLORS.primary} />
              <Text style={styles.btnChatText}>Ir al chat</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Mis Postulantes</Text>
        <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Panel rapido de reclutamiento</Text>
      </View>

      <View style={styles.statsRow}>
        <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}><Text style={[styles.statNum, { color: colors.textPrimary }]}>{counts.total}</Text><Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total</Text></View>
        <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}><Text style={[styles.statNum, { color: COLORS.info }]}>{counts.nuevos}</Text><Text style={[styles.statLabel, { color: colors.textSecondary }]}>Nuevos</Text></View>
        <View style={[styles.statCard, { backgroundColor: isDark ? colors.surface : '#F8FAF9', borderColor: colors.border }]}><Text style={[styles.statNum, { color: COLORS.primary }]}>{counts.aceptados}</Text><Text style={[styles.statLabel, { color: colors.textSecondary }]}>Aceptados</Text></View>
      </View>

      <View style={styles.tabsRow}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity key={t.key} style={[styles.tab, { backgroundColor: isDark ? colors.surface : '#F3F4F6' }, active && styles.tabActive]} onPress={() => setTab(t.key)}>
              <Ionicons name={t.icon} size={13} color={active ? COLORS.white : colors.textSecondary} />
              <Text style={[styles.tabText, { color: colors.textSecondary }, active && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar por trabajador o vacante..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.id}-${index}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); cargar(); }}
            colors={[COLORS.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={48} color={COLORS.primaryLight} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin postulantes por ahora</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>Cuando lleguen postulaciones apareceran aqui con acceso rapido.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },

  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#F8FAF9',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderLight,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
  },
  statNum: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  statLabel: { fontSize: 11, color: COLORS.textSecondary, marginTop: 2 },

  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  tabActive: { backgroundColor: COLORS.primary },
  tabText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  tabTextActive: { color: COLORS.white },

  searchWrap: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0 },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xl },
  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  statusBar: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.md },

  topRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarWrap: { width: 54, height: 54, borderRadius: 16, overflow: 'hidden', backgroundColor: '#B0BEC5' },
  avatar: { width: 54, height: 54, borderRadius: 16 },
  avatarFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  mainInfo: { flex: 1 },
  nombre: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  vacante: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary, marginTop: 2 },
  finca: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },

  estadoBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  estadoText: { fontSize: 11, fontWeight: '700' },

  metaRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginTop: SPACING.sm },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontSize: 12, color: COLORS.textSecondary },

  actionsRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
    flexWrap: 'wrap',
  },
  btnOutline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  btnOutlineText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600' },
  btnChat: {
    marginTop: SPACING.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.2,
    borderColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  btnChatText: { fontSize: 12, color: COLORS.primary, fontWeight: '700' },

  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl,
    paddingHorizontal: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary },
  emptyText: { fontSize: 14, color: COLORS.textSecondary, textAlign: 'center' },
});
