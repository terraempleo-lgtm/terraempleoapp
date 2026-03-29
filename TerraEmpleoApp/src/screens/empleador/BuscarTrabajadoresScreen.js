import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, TextInput, Image, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../components/animated';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, vacantesAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';

const ORDEN_TABS = [
  { key: 'match', label: 'Mejor match', icon: 'flash' },
  { key: 'cercanos', label: 'Más cercanos', icon: 'location' },
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

function MatchBadge({ puntaje }) {
  if (!puntaje || puntaje === 0) return null;
  const color = puntaje >= 70 ? COLORS.primary : puntaje >= 40 ? COLORS.warning : COLORS.textLight;
  const bg = puntaje >= 70 ? COLORS.primarySoft : puntaje >= 40 ? COLORS.warningSoft : '#F3F4F6';
  return (
    <View style={[styles.matchBadge, { backgroundColor: bg }]}>
      <Ionicons name="flash" size={11} color={color} />
      <Text style={[styles.matchText, { color }]}>{puntaje}% match</Text>
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
          <View style={styles.avatarCircle}>
            {item.foto_selfie ? (
              <Image source={{ uri: item.foto_selfie }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: isDark ? '#2E4A3E' : COLORS.primarySoft }]}>
                <Ionicons name="person" size={26} color={COLORS.primary} />
              </View>
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
          <Text style={[styles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>
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
            {item.calificacion_promedio > 0
              ? item.calificacion_promedio.toFixed(1)
              : '—'}
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
            <Ionicons name="ribbon-outline" size={11} color={colors.textSecondary} />
            <Text style={[styles.metaChipText, { color: colors.textSecondary }]}>{expLabel}</Text>
          </View>
        ) : null}
      </View>

      {/* Skills */}
      {(item.cultivos?.length > 0 || item.habilidades?.length > 0) ? (
        <View style={styles.skillsRow}>
          {(item.cultivos || []).slice(0, 2).map((s, i) => (
            <View key={`c-${i}`} style={[styles.skillChip, styles.cultivoChip, { borderColor: `${COLORS.primary}35` }]}>
              <Text style={[styles.skillText, { color: COLORS.primary }]} numberOfLines={1}>{s}</Text>
            </View>
          ))}
          {(item.habilidades || []).slice(0, 2).map((s, i) => (
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
          <Text style={styles.btnPerfilText}>Ver perfil completo</Text>
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
      await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteContacto.id });
      showAlert('Listo', `Se envió solicitud de contacto a ${item.nombre_completo}.`);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud de contacto');
    } finally {
      setEnviandoContactoId(null);
    }
  };

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
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Trabajadores</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>
            {filtrados.length} disponible{filtrados.length !== 1 ? 's' : ''}
          </Text>
          {vacanteContacto?.titulo ? (
            <Text style={styles.headerVacante} numberOfLines={1}>Vacante para contactar: {vacanteContacto.titulo}</Text>
          ) : null}
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="people" size={24} color={COLORS.primary} />
        </View>
      </View>

      {/* Controles de Búsqueda y Filtros */}
      <View style={{ paddingHorizontal: SPACING.md, marginBottom: 12 }}>
        {/* Barra de Búsqueda Rediseñada */}
        <View style={[
          styles.searchWrap,
          { backgroundColor: isDark ? colors.surface : COLORS.background, borderColor: isDark ? colors.border : '#E5E7EB' }
        ]}>
          <Ionicons name="search" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.textPrimary }]}
            placeholder="Buscar talentos o habilidades..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : (
            <View style={styles.searchFilterIconBadge}>
              <Ionicons name="options-outline" size={16} color={COLORS.primary} />
            </View>
          )}
        </View>

        {/* Tabs de Orden (Mejor Match vs. Cercanos) Rediseñados */}
        <View style={styles.ordenRow}>
          {ORDEN_TABS.map((t) => {
            const active = orden === t.key;
            return (
              <AnimatedPressable
                key={t.key}
                scaleValue={0.96}
                haptic
                style={[
                  styles.ordenTab,
                  { backgroundColor: active ? COLORS.primary : (isDark ? colors.border : '#F3F4F6') }
                ]}
                onPress={() => onOrden(t.key)}
              >
                <Ionicons
                  name={t.icon}
                  size={15}
                  color={active ? COLORS.white : colors.textSecondary}
                />
                <Text style={[
                  styles.ordenTabText,
                  { color: active ? COLORS.white : colors.textSecondary }
                ]}>
                  {t.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </View>
      </View>

      {/* Filtro de Disponibilidad - Rediseñado y Responsive */}
      <View>
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
                    backgroundColor: active ? COLORS.primarySoft : (isDark ? colors.surface : '#FFFFFF'),
                    borderColor: active ? COLORS.primary : (isDark ? colors.border : '#E5E7EB'),
                    marginLeft: index === 0 ? SPACING.md : 0,
                    marginRight: index === DISPONIBILIDAD_FILTROS.length - 1 ? SPACING.md : 0,
                  }
                ]}
                onPress={() => onDisponibilidad(f.key)}
              >
                <Text style={[
                  styles.dispChipText,
                  { color: active ? COLORS.primaryDark : colors.textSecondary }
                ]}>
                  {f.label}
                </Text>
              </AnimatedPressable>
            );
          })}
        </ScrollView>
      </View>

      {/* Lista */}
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
  container: { flex: 1, backgroundColor: COLORS.white },

  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  loadingText: { fontSize: 15, color: COLORS.textSecondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  headerVacante: { fontSize: 11, color: COLORS.primary, marginTop: 2, maxWidth: 220 },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    marginBottom: 10,
    ...SHADOWS.light,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.textPrimary, padding: 0, height: 22 },
  searchFilterIconBadge: {
    backgroundColor: COLORS.primarySoft,
    padding: 4,
    borderRadius: RADIUS.md,
  },

  ordenRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  ordenTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.lg,
    backgroundColor: '#F3F4F6',
    ...SHADOWS.light,
  },
  ordenTabText: { fontSize: 13, fontWeight: '700' },

  dispScrollView: {
    flexGrow: 0,
    marginBottom: 12,
  },
  dispRow: {
    gap: 10,
    paddingVertical: 4,
    alignItems: 'center',
  },
  dispChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    ...SHADOWS.light,
  },
  dispChipText: { fontSize: 13, fontWeight: '700' },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
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
    backgroundColor: COLORS.primarySoft,
  },
  avatar: { width: 58, height: 58, borderRadius: 29 },
  avatarFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  matchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  matchPillText: { fontSize: 10, fontWeight: '800' },
  cultivoChip: { backgroundColor: COLORS.primarySoft, borderWidth: 1 },

  cardInfo: { flex: 1, gap: 3 },
  nombre: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  row: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ubicacion: { fontSize: 12, color: COLORS.textLight, flex: 1 },
  badgesRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap', marginTop: 2 },

  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  matchText: { fontSize: 11, fontWeight: '700' },

  proximidadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  proximidadText: { fontSize: 11, fontWeight: '600' },

  ratingCol: { alignItems: 'center', gap: 2 },
  ratingNum: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },

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
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    maxWidth: 130,
  },
  skillText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  skillChipMore: {
    backgroundColor: COLORS.borderLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  skillTextMore: { fontSize: 11, color: COLORS.textLight, fontWeight: '600' },

  cardFooter: { marginTop: 6, flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  btnContactar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    borderWidth: 1.2,
    borderColor: COLORS.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  btnContactarText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  btnPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1.2,
    borderColor: COLORS.primary,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  btnPerfilText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },

  empty: {
    alignItems: 'center',
    paddingTop: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
