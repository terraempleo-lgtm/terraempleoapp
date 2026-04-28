import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../components/animated';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, vacantesAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';

const LIME = '#C8F056';
const LIME_TEXT = '#2A5C00';

const ORDEN_TABS = [
  { key: 'match', label: 'Mejor match', icon: 'flash' },
  { key: 'cercanos', label: 'Cercanos', icon: 'location' },
];

const DISPONIBILIDAD_FILTROS = [
  { key: '', label: 'Todos' },
  { key: 'disponible_inmediatamente', label: 'Disponible ahora' },
  { key: 'tiempo_completo', label: 'Tiempo completo' },
  { key: 'por_dias', label: 'Por días' },
  { key: 'temporada_cosecha', label: 'Temporada' },
  { key: 'fines_semana', label: 'Fines de semana' },
];

const DISPONIBILIDAD_LABELS = {
  tiempo_completo: 'Tiempo completo',
  por_dias: 'Por días',
  temporada_cosecha: 'Temporada / Cosecha',
  fines_semana: 'Fines de semana',
  disponible_inmediatamente: 'Disponible ahora',
};

const EXPERIENCIA_LABELS = {
  sin: 'Sin experiencia',
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: '+10 años',
};

const PROXIMIDAD_CONFIG = {
  mismo_municipio: { label: 'Mismo municipio', color: COLORS.primary, icon: 'location' },
  mismo_departamento: { label: 'Mismo dpto.', color: COLORS.info, icon: 'map' },
  lejano: { label: null, color: null, icon: null },
};

const AVATAR_COLORS = [
  '#C8A882', '#A8B8D0', '#B8C8A0', '#D0A8A8', '#A8C8C8',
  '#C8B8A0', '#B0A8C8', '#C8C0A0', '#A0B8A8', '#C0B0B8',
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function StarRating({ value }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons
          key={i}
          name={i <= Math.round(value) ? 'star' : 'star-outline'}
          size={11}
          color={i <= Math.round(value) ? COLORS.star : COLORS.starEmpty}
        />
      ))}
    </View>
  );
}

function TrabajadorCard({ item, onPress, onContact, loadingContacto, colors, isDark }) {
  const proxConfig = PROXIMIDAD_CONFIG[item.proximidad] || PROXIMIDAD_CONFIG.lejano;
  const dispLabel = DISPONIBILIDAD_LABELS[item.disponibilidad];
  const expLabel = EXPERIENCIA_LABELS[item.anios_experiencia];
  const ubicacion = [item.municipio, item.departamento].filter(Boolean).join(', ');
  const matchNum = Number(item.puntaje_match || 0);
  const matchColor = matchNum >= 70 ? COLORS.primary : matchNum >= 40 ? COLORS.warning : COLORS.textLight;
  const matchBg = matchNum >= 70 ? COLORS.primarySoft : matchNum >= 40 ? COLORS.warningSoft : (isDark ? colors.surface : '#F3F4F6');
  const initials = getInitials(item.nombre_completo);
  const avatarBg = getAvatarColor(item.nombre_completo);

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => onPress(item)}
      scaleValue={0.98}
      haptic={false}
    >
      <View style={styles.cardTop}>
        {/* Avatar with match pill */}
        <View style={styles.avatarWrap}>
          <View style={[styles.avatarCircle, { backgroundColor: avatarBg }]}>
            {item.foto_selfie ? (
              <Image source={{ uri: item.foto_selfie }} style={styles.avatar} />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>
          {matchNum > 0 && (
            <View style={[styles.matchPill, { backgroundColor: matchBg }]}>
              <Ionicons name="flash" size={9} color={matchColor} />
              <Text style={[styles.matchPillText, { color: matchColor }]}>{matchNum}%</Text>
            </View>
          )}
        </View>

        {/* Info principal */}
        <View style={styles.cardInfo}>
          <Text style={[styles.nombre, { color: colors.textPrimary }]} numberOfLines={2}>
            {item.nombre_completo}
          </Text>

          {ubicacion ? (
            <View style={styles.row}>
              <Ionicons name="location-outline" size={12} color={colors.textMuted} />
              <Text style={[styles.ubicacion, { color: colors.textMuted }]} numberOfLines={1}>{ubicacion}</Text>
            </View>
          ) : null}

          {proxConfig.label ? (
            <View style={[styles.proximidadBadge, { backgroundColor: proxConfig.color + '15' }]}>
              <Ionicons name={proxConfig.icon} size={10} color={proxConfig.color} />
              <Text style={[styles.proximidadText, { color: proxConfig.color }]}>
                {proxConfig.label}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Rating */}
        <View style={styles.ratingCol}>
          <StarRating value={item.calificacion_promedio} />
          <Text style={[styles.ratingNum, { color: colors.textPrimary }]}>
            {item.calificacion_promedio > 0 ? item.calificacion_promedio.toFixed(1) : ''}
          </Text>
        </View>
      </View>

      {/* Meta chips */}
      <View style={styles.cardMeta}>
        {dispLabel ? (
          <View style={styles.metaChip}>
            <Ionicons name="time-outline" size={11} color={COLORS.primary} />
            <Text style={styles.metaChipText}>{dispLabel}</Text>
          </View>
        ) : null}
        {expLabel ? (
          <View style={[styles.metaChip, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderWidth: 1, borderColor: colors.border }]}>
            <Ionicons name="briefcase-outline" size={11} color={colors.textSecondary} />
            <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{expLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Skills */}
      {(item.cultivos?.length > 0 || item.habilidades?.length > 0) ? (
        <View style={styles.skillsRow}>
          {(item.cultivos || []).slice(0, 3).map((s, i) => (
            <View key={`c-${i}`} style={[styles.skillChip, { backgroundColor: isDark ? colors.border : '#F3F4F6' }]}>
              <Text style={[styles.skillText, { color: colors.textSecondary }]} numberOfLines={1}>{s}</Text>
            </View>
          ))}
          {(item.habilidades || []).slice(0, 1).map((s, i) => (
            <View key={`h-${i}`} style={[styles.skillChip, { backgroundColor: isDark ? colors.border : '#F3F4F6' }]}>
              <Text style={[styles.skillText, { color: colors.textSecondary }]} numberOfLines={1}>{s}</Text>
            </View>
          ))}
          {(item.cultivos?.length || 0) + (item.habilidades?.length || 0) > 4 ? (
            <View style={styles.skillChipMore}>
              <Text style={styles.skillTextMore}>
                +{(item.cultivos?.length || 0) + (item.habilidades?.length || 0) - 4}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* CTA */}
      <View style={styles.cardFooter}>
        <AnimatedPressable
          style={[styles.btnContactar, loadingContacto && { opacity: 0.7 }]}
          onPress={() => onContact(item)}
          disabled={loadingContacto}
          scaleValue={0.96}
          haptic
        >
          <Ionicons name={loadingContacto ? 'hourglass-outline' : 'chatbubble-ellipses-outline'} size={14} color={COLORS.white} />
          <Text style={styles.btnContactarText}>{loadingContacto ? 'Enviando...' : 'Contactar'}</Text>
        </AnimatedPressable>
        <AnimatedPressable style={styles.btnPerfil} onPress={() => onPress(item)} scaleValue={0.96} haptic>
          <Ionicons name="person-outline" size={14} color={COLORS.primary} />
          <Text style={styles.btnPerfilText}>Ver perfil</Text>
        </AnimatedPressable>
      </View>
    </AnimatedPressable>
  );
}

export default function BuscarTrabajadoresScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [trabajadores, setTrabajadores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enviandoContactoId, setEnviandoContactoId] = useState(null);
  const [vacanteContacto, setVacanteContacto] = useState(null);
  const [orden, setOrden] = useState('match');
  const [disponibilidad, setDisponibilidad] = useState('');
  const [search, setSearch] = useState('');

  const cargar = useCallback(async (ord = orden, disp = disponibilidad) => {
    try {
      const params = { orden: ord };
      if (disp) params.disponibilidad = disp;
      const res = await trabajadoresAPI.listar(params);
      setTrabajadores(res.data?.trabajadores || []);
    } catch (err) {
      console.error('Error cargando trabajadores:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orden, disponibilidad]);

  const cargarVacanteContacto = useCallback(async () => {
    try {
      const res = await vacantesAPI.misVacantes();
      const vacantes = res.data?.vacantes || [];
      const activa = vacantes.find((v) => v.estado === 'activa') || vacantes[0] || null;
      setVacanteContacto(activa ? { id: Number(activa.id), titulo: activa.titulo } : null);
    } catch (_) {
      setVacanteContacto(null);
    }
  }, []);

  useEffect(() => {
    cargar();
    cargarVacanteContacto();
  }, []);

  const onOrden = (key) => {
    setOrden(key);
    cargar(key, disponibilidad);
  };

  const onDisponibilidad = (key) => {
    setDisponibilidad(key);
    cargar(orden, key);
  };

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trabajadores;
    return trabajadores.filter((t) =>
      t.nombre_completo?.toLowerCase().includes(q) ||
      t.municipio?.toLowerCase().includes(q) ||
      t.departamento?.toLowerCase().includes(q) ||
      t.habilidades?.some((h) => h.toLowerCase().includes(q)) ||
      t.cultivos?.some((c) => c.toLowerCase().includes(q))
    );
  }, [trabajadores, search]);

  const irPerfil = (item) => {
    navigation.navigate('PerfilPublicoTrabajador', {
      trabajador_id: item.id,
      vacante_id: vacanteContacto?.id,
    });
  };

  const solicitarContacto = async (item) => {
    if (!vacanteContacto?.id) {
      showAlert('Sin vacante', 'Primero crea o activa una vacante para poder contactar trabajadores.');
      return;
    }
    try {
      setEnviandoContactoId(Number(item.id));
      const res = await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteContacto.id });
      const estado = res?.data?.estado;
      const chatId = Number(res?.data?.chat_id || 0);

      if (estado === 'aceptada' && chatId) {
        showAlert('Listo', 'Este trabajador ya aceptó contacto. Te llevamos al chat.');
        navigation.navigate('Mensajes', {
          screen: 'ChatDetalle',
          params: {
            chat: {
              id: chatId,
              otro_nombre: item.nombre_completo,
              otro_foto: item.foto_selfie,
              vacante_titulo: vacanteContacto.titulo,
            },
          },
        });
        return;
      }
      if (estado === 'contacto_solicitado') {
        showAlert('En espera', `${item.nombre_completo} debe aceptar para habilitar el chat.`);
        return;
      }
      showAlert('Listo', `Se envió solicitud de contacto a ${item.nombre_completo}.`);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud de contacto');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  const ListHeader = (
    <View>
      {/* App header bar */}
      <View style={[styles.appBar, { backgroundColor: colors.surface }]}>
        <View style={styles.appBarLogo}>
          <View style={styles.appBarLogoIcon}>
            <Text style={styles.appBarLogoLetter}>T</Text>
          </View>
          <Text style={[styles.appBarLogoText, { color: colors.textPrimary }]}>TerraEmpleo</Text>
        </View>
        <TouchableOpacity style={[styles.appBarIconBtn, { backgroundColor: isDark ? colors.border : '#F3F4F6' }]}>
          <Ionicons name="headset-outline" size={20} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Title row */}
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>Trabajadores</Text>
        <View style={styles.subtitleRow}>
          <View style={styles.greenDot} />
          <Text style={[styles.subtitleText, { color: COLORS.primary }]}>
            {filtrados.length} disponible{filtrados.length !== 1 ? 's' : ''}
          </Text>
          <Text style={[styles.subtitleSep, { color: colors.textMuted }]}> · </Text>
          <Text style={[styles.subtitleMuted, { color: colors.textMuted }]}>Talento cerca de ti</Text>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F5F5F5', borderColor: isDark ? colors.border : '#EBEBEB' }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar talentos o habilidades..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.filterBtn}>
          <Ionicons name="options-outline" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* Sort + map row */}
      <View style={styles.ordenRow}>
        {ORDEN_TABS.map((t) => {
          const active = orden === t.key;
          const isMatch = t.key === 'match';
          return (
            <AnimatedPressable
              key={t.key}
              scaleValue={0.96}
              haptic
              style={[
                styles.ordenTab,
                active && isMatch ? { backgroundColor: LIME, borderColor: LIME } :
                active ? { backgroundColor: COLORS.primary, borderColor: COLORS.primary } :
                { backgroundColor: isDark ? colors.surface : COLORS.white, borderColor: isDark ? colors.border : '#E0E0E0' },
              ]}
              onPress={() => onOrden(t.key)}
            >
              <Ionicons
                name={t.icon}
                size={14}
                color={active ? (isMatch ? LIME_TEXT : COLORS.white) : colors.textSecondary}
              />
              <Text style={[
                styles.ordenTabText,
                { color: active ? (isMatch ? LIME_TEXT : COLORS.white) : colors.textSecondary },
              ]}>
                {t.label}
              </Text>
            </AnimatedPressable>
          );
        })}
        <AnimatedPressable
          style={[styles.mapCircleBtn, { backgroundColor: COLORS.primary }]}
          onPress={() => navigation.navigate('TrabajadoresMapa', { search })}
          scaleValue={0.95}
          haptic
        >
          <Ionicons name="map-outline" size={18} color={COLORS.white} />
        </AnimatedPressable>
      </View>

      {/* Disponibilidad chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.dispScrollView}
        contentContainerStyle={styles.dispRow}
      >
        {DISPONIBILIDAD_FILTROS.map((f, index) => {
          const active = disponibilidad === f.key;
          return (
            <AnimatedPressable
              key={f.key}
              scaleValue={0.95}
              style={[
                styles.dispChip,
                {
                  backgroundColor: active ? (isDark ? COLORS.primary : COLORS.white) : (isDark ? colors.surface : COLORS.WHITE),
                  borderColor: active ? COLORS.primary : (isDark ? colors.border : '#DEDEDE'),
                  marginLeft: index === 0 ? SPACING.md : 0,
                  marginRight: index === DISPONIBILIDAD_FILTROS.length - 1 ? SPACING.md : 0,
                },
              ]}
              onPress={() => onDisponibilidad(f.key)}
            >
              <Text style={[
                styles.dispChipText,
                { color: active ? COLORS.primary : colors.textSecondary, fontWeight: active ? '700' : '500' },
              ]}>
                {f.label}
              </Text>
            </AnimatedPressable>
          );
        })}
      </ScrollView>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
        <View style={styles.centerWrap}>
          <Ionicons name="people-outline" size={40} color={COLORS.primaryLight} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Buscando trabajadores...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
      <FlatList
        data={filtrados}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TrabajadorCard
            item={item}
            onPress={irPerfil}
            onContact={solicitarContacto}
            loadingContacto={Number(enviandoContactoId) === Number(item.id)}
            colors={colors}
            isDark={isDark}
          />
        )}
        ListHeaderComponent={ListHeader}
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
            <Ionicons name="people-outline" size={44} color={COLORS.primaryLight} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin resultados</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              Prueba cambiando los filtros o el orden de búsqueda.
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: { fontSize: 15 },

  /* App bar */
  appBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xs,
  },
  appBarLogo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  appBarLogoIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  appBarLogoLetter: { color: COLORS.white, fontSize: 16, fontWeight: '800' },
  appBarLogoText: { fontSize: 16, fontWeight: '700' },
  appBarIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Title */
  titleRow: {
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
    paddingBottom: 12,
  },
  screenTitle: { fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 3 },
  greenDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginRight: 5,
  },
  subtitleText: { fontSize: 13, fontWeight: '600' },
  subtitleSep: { fontSize: 13 },
  subtitleMuted: { fontSize: 13 },

  /* Search */
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: 10,
  },
  searchWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0, height: 20 },
  filterBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#1A1A1A',
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Sort row */
  ordenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: SPACING.md,
    marginBottom: 10,
  },
  ordenTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  ordenTabText: { fontSize: 13, fontWeight: '700' },
  mapCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* Disponibilidad */
  dispScrollView: { flexGrow: 0, marginBottom: 12 },
  dispRow: {
    gap: 8,
    paddingVertical: 2,
    alignItems: 'center',
  },
  dispChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  dispChipText: { fontSize: 13 },

  /* List */
  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg },

  /* Card */
  card: {
    borderRadius: 16,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  avatarWrap: { alignItems: 'center', gap: 4, flexShrink: 0 },
  avatarCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarInitials: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  matchPillText: { fontSize: 10, fontWeight: '800' },

  cardInfo: { flex: 1, gap: 3 },
  nombre: { fontSize: 15, fontWeight: '700', lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ubicacion: { fontSize: 12, flex: 1 },

  proximidadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  proximidadText: { fontSize: 11, fontWeight: '600' },

  ratingCol: { alignItems: 'center', gap: 2 },
  ratingNum: { fontSize: 12, fontWeight: '700' },

  cardMeta: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
    flexWrap: 'wrap',
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },

  skillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    maxWidth: 130,
  },
  skillText: { fontSize: 11, fontWeight: '500' },
  skillChipMore: {
    backgroundColor: '#1A1A1A',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  skillTextMore: { fontSize: 11, color: COLORS.white, fontWeight: '700' },

  cardFooter: { marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' },
  btnContactar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  btnContactarText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  btnPerfil: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
  },
  btnPerfilText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  empty: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
