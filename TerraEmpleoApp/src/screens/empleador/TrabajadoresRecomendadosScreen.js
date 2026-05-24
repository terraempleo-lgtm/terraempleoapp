import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, Alert, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { AnimatedPressable } from '../../components/animated';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { trabajadoresAPI, vacantesAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';
import { useAppTheme } from '../../context/ThemeContext';

const PROXIMIDAD_CONFIG = {
  mismo_municipio: { label: 'Mismo municipio', color: COLORS.primary, icon: 'location' },
  mismo_departamento: { label: 'Mismo dpto.', color: COLORS.info, icon: 'map' },
  lejano: { label: null, color: null, icon: null },
};

const FILTRO_MATCH = [
  { key: 'todos', label: 'Todos' },
  { key: 'alto', label: 'Match alto' },
  { key: 'medio', label: 'Match medio' },
];

const FILTRO_PROX = [
  { key: 'todos', label: 'Todas zonas' },
  { key: 'mismo_municipio', label: 'Mismo municipio' },
  { key: 'mismo_departamento', label: 'Mismo departamento' },
];

function MatchBadge({ puntaje, colors, isDark }) {
  if (!puntaje || puntaje === 0) return null;
  const nivel = puntaje >= 70 ? 'alto' : puntaje >= 40 ? 'medio' : 'bajo';
  const color = nivel === 'alto' ? COLORS.primary : nivel === 'medio' ? COLORS.warning : COLORS.textLight;
  const bg = nivel === 'alto' ? COLORS.primarySoft : nivel === 'medio' ? COLORS.warningSoft : (isDark ? colors.surface : '#F3F4F6');
  const label = nivel === 'alto' ? 'Match alto' : nivel === 'medio' ? 'Match medio' : 'Match base';
  return (
    <View style={[styles.matchBadge, { backgroundColor: bg }]}>
      <Ionicons name="flash" size={11} color={color} />
      <Text style={[styles.matchText, { color }]}>{label}</Text>
    </View>
  );
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

function TrabajadorCard({ item, onVerPerfil, onContactar, enviando, colors, isDark }) {
  const prox = PROXIMIDAD_CONFIG[item.proximidad] || PROXIMIDAD_CONFIG.lejano;
  const matchNum = Number(item.puntaje_match || 0);
  const matchNivel = matchNum >= 70 ? 'alto' : matchNum >= 40 ? 'medio' : 'base';
  const matchColor = matchNivel === 'alto' ? COLORS.primary : matchNivel === 'medio' ? COLORS.warning : COLORS.textLight;
  const matchBg = matchNivel === 'alto' ? COLORS.primarySoft : matchNivel === 'medio' ? COLORS.warningSoft : (isDark ? colors.surface : '#F3F4F6');

  return (
    <AnimatedPressable
      style={[styles.card, { backgroundColor: colors.surface }]}
      onPress={() => onVerPerfil(item)}
      scaleValue={0.98}
      haptic={false}
    >
      <View style={styles.cardTop}>
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

        <View style={styles.cardInfo}>
          <Text style={[styles.nombre, { color: colors.textPrimary }]} numberOfLines={1}>
            {item.nombre_completo}
          </Text>
          {(item.municipio || item.departamento) ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-outline" size={11} color={colors.textMuted} />
              <Text style={[styles.locationText, { color: colors.textMuted }]} numberOfLines={1}>
                {[item.municipio, item.departamento].filter(Boolean).join(', ')}
              </Text>
            </View>
          ) : null}
          <View style={styles.badgesRow}>
            {prox.label ? (
              <View style={[styles.proxBadge, { backgroundColor: `${prox.color}15` }]}>
                <Ionicons name={prox.icon} size={10} color={prox.color} />
                <Text style={[styles.proxText, { color: prox.color }]}>{prox.label}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.ratingCol}>
          <StarRating value={item.calificacion_promedio} />
          <Text style={[styles.ratingNum, { color: colors.textPrimary }]}>
            {item.calificacion_promedio > 0 ? item.calificacion_promedio.toFixed(1) : '—'}
          </Text>
        </View>
      </View>

      {((item.cultivos?.length || 0) + (item.habilidades?.length || 0)) > 0 && (
        <View style={styles.skillRow}>
          {(item.cultivos || []).slice(0, 2).map((c, i) => (
            <View key={`c-${i}`} style={[styles.skillChip, styles.cultivoChip, { borderColor: `${COLORS.primary}35` }]}>
              <Text style={[styles.skillText, { color: COLORS.primary }]}>{c}</Text>
            </View>
          ))}
          {(item.habilidades || []).slice(0, 2).map((h, i) => (
            <View key={`h-${i}`} style={[styles.skillChip, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={[styles.skillText, { color: colors.textSecondary }]}>{h}</Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.actionsRow}>
        <AnimatedPressable
          style={[styles.btnContactar, enviando && { opacity: 0.7 }]}
          onPress={() => onContactar(item)}
          disabled={enviando}
          scaleValue={0.96}
          haptic
        >
          <Ionicons name={enviando ? 'hourglass-outline' : 'chatbubble-ellipses-outline'} size={14} color={COLORS.white} />
          <Text style={styles.btnContactarText}>{enviando ? 'Enviando...' : 'Contactar'}</Text>
        </AnimatedPressable>
        <AnimatedPressable
          style={styles.btnPerfil}
          onPress={() => onVerPerfil(item)}
          scaleValue={0.96}
          haptic
        >
          <Ionicons name="person-outline" size={14} color={COLORS.primary} />
          <Text style={styles.btnPerfilText}>Ver perfil</Text>
        </AnimatedPressable>
      </View>
    </AnimatedPressable>
  );
}

export default function TrabajadoresRecomendadosScreen({ navigation }) {
  const { colors, isDark } = useAppTheme();
  const [vacantes, setVacantes] = useState([]);
  const [vacanteSeleccionadaId, setVacanteSeleccionadaId] = useState(null);
  const [recomendados, setRecomendados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [enviandoContactoId, setEnviandoContactoId] = useState(null);
  const [search, setSearch] = useState('');
  const [filtroMatch, setFiltroMatch] = useState('todos');
  const [filtroProx, setFiltroProx] = useState('todos');

  const vacanteSeleccionada = useMemo(
    () => vacantes.find((v) => Number(v.id) === Number(vacanteSeleccionadaId)) || null,
    [vacantes, vacanteSeleccionadaId]
  );

  const recomendadosFiltrados = useMemo(() => {
    const q = search.trim().toLowerCase();

    return [...recomendados]
      .filter((t) => {
        if (!q) return true;
        return (
          String(t.nombre_completo || '').toLowerCase().includes(q) ||
          String(t.municipio || '').toLowerCase().includes(q) ||
          String(t.departamento || '').toLowerCase().includes(q) ||
          (t.habilidades || []).some((h) => String(h).toLowerCase().includes(q)) ||
          (t.cultivos || []).some((c) => String(c).toLowerCase().includes(q))
        );
      })
      .filter((t) => {
        const match = Number(t.puntaje_match || 0);
        if (filtroMatch === 'alto') return match >= 70;
        if (filtroMatch === 'medio') return match >= 40;
        return true;
      })
      .filter((t) => {
        if (filtroProx === 'todos') return true;
        return t.proximidad === filtroProx;
      })
      .sort((a, b) => {
        const matchDiff = Number(b.puntaje_match || 0) - Number(a.puntaje_match || 0);
        if (matchDiff !== 0) return matchDiff;
        return Number(b.calificacion_promedio || 0) - Number(a.calificacion_promedio || 0);
      });
  }, [recomendados, search, filtroMatch, filtroProx]);

  const cargarVacantes = useCallback(async () => {
    const res = await vacantesAPI.misVacantes();
    const lista = res.data?.vacantes || [];
    setVacantes(lista);

    if (!vacanteSeleccionadaId) {
      const activa = lista.find((v) => v.estado === 'activa') || lista[0] || null;
      setVacanteSeleccionadaId(activa ? Number(activa.id) : null);
    }

    return lista;
  }, [vacanteSeleccionadaId]);

  const cargarRecomendados = useCallback(async (vacanteId) => {
    if (!vacanteId) {
      setRecomendados([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const res = await trabajadoresAPI.recomendados({ vacante_id: vacanteId });
      setRecomendados(res.data?.recomendados || []);
    } catch (err) {
      console.error('Error cargando recomendados:', err);
      setRecomendados([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const cargar = useCallback(async () => {
    try {
      const listaVacantes = await cargarVacantes();
      const vacanteId = vacanteSeleccionadaId || Number((listaVacantes.find((v) => v.estado === 'activa') || listaVacantes[0])?.id);
      await cargarRecomendados(vacanteId);
    } catch (err) {
      console.error('Error cargando para ti:', err);
      setLoading(false);
      setRefreshing(false);
    }
  }, [cargarVacantes, cargarRecomendados, vacanteSeleccionadaId]);

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (vacanteSeleccionadaId) {
      cargarRecomendados(vacanteSeleccionadaId);
    }
  }, [vacanteSeleccionadaId, cargarRecomendados]);

  const verPerfil = (item) => {
    navigation.navigate('PerfilPublicoTrabajador', {
      trabajador_id: item.id,
      vacante_id: vacanteSeleccionadaId,
    });
  };

  const contactar = async (item) => {
    if (!vacanteSeleccionadaId) {
      showAlert('Sin vacante', 'Selecciona una vacante para contactar a este trabajador.');
      return;
    }

    try {
      setEnviandoContactoId(Number(item.id));
      const res = await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteSeleccionadaId });
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
            },
          },
        });
        return;
      }

      if (estado === 'contacto_solicitado') {
        showAlert('En espera', `${item.nombre_completo} debe aceptar para habilitar el chat.`);
        return;
      }

      showAlert('Listo', `Solicitud de contacto enviada a ${item.nombre_completo}.`);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
        <View style={styles.centerWrap}>
          <Ionicons name="sparkles-outline" size={40} color={COLORS.primaryLight} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Buscando trabajadores para ti...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Para ti</Text>
          <Text style={[styles.headerSub, { color: colors.textSecondary }]}>Trabajadores recomendados por match con tu vacante</Text>
        </View>
        <View style={styles.headerIcon}>
          <Ionicons name="sparkles" size={22} color={COLORS.primary} />
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.vacantesRow}>
        {vacantes.map((v) => {
          const activa = Number(v.id) === Number(vacanteSeleccionadaId);
          return (
            <TouchableOpacity
              key={String(v.id)}
              style={[styles.vacanteChip, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: colors.border }, activa && styles.vacanteChipActive]}
              onPress={() => setVacanteSeleccionadaId(Number(v.id))}
            >
              <Text style={[styles.vacanteChipText, { color: colors.textSecondary }, activa && styles.vacanteChipTextActive]} numberOfLines={1}>{v.titulo}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }]}>
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar trabajador, cultivo, habilidad, zona..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={colors.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filtrosRow}>
        {FILTRO_MATCH.map((f) => {
          const active = filtroMatch === f.key;
          return (
            <TouchableOpacity
              key={`match-${f.key}`}
              style={[styles.filtroChip, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: colors.border }, active && styles.filtroChipActive]}
              onPress={() => setFiltroMatch(f.key)}
            >
              <Text style={[styles.filtroChipText, { color: colors.textSecondary }, active && styles.filtroChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.filtrosRowBottom}>
        {FILTRO_PROX.map((f) => {
          const active = filtroProx === f.key;
          return (
            <TouchableOpacity
              key={`prox-${f.key}`}
              style={[styles.filtroChip, { backgroundColor: isDark ? colors.surface : '#F3F4F6', borderColor: colors.border }, active && styles.filtroChipActive]}
              onPress={() => setFiltroProx(f.key)}
            >
              <Text style={[styles.filtroChipText, { color: colors.textSecondary }, active && styles.filtroChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {vacanteSeleccionada ? (
        <View style={styles.statsCard}>
          <Text style={[styles.statsTitle, { color: colors.textPrimary }]}>{vacanteSeleccionada.titulo}</Text>
          <Text style={styles.statsSub}>{recomendadosFiltrados.length} trabajador(es) en resultados</Text>
        </View>
      ) : null}

      <FlatList
        data={recomendadosFiltrados}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TrabajadorCard
            item={item}
            onVerPerfil={verPerfil}
            onContactar={contactar}
            enviando={Number(enviandoContactoId) === Number(item.id)}
            colors={colors}
            isDark={isDark}
          />
        )}
        contentContainerStyle={[styles.list, recomendadosFiltrados.length === 0 && styles.listEmpty]}
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
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Sin recomendaciones</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No encontramos trabajadores con match para esta vacante por ahora.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  loadingText: { fontSize: 15 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 22, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 2 },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  vacantesRow: {
    paddingHorizontal: SPACING.md,
    gap: 8,
    paddingBottom: 6,
    alignItems: 'center',
    minHeight: 38,
  },
  vacanteChip: {
    maxWidth: 220,
    alignSelf: 'flex-start',
    borderRadius: RADIUS.full,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 32,
    justifyContent: 'center',
  },
  vacanteChipActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  vacanteChipText: { fontSize: 12, fontWeight: '600' },
  vacanteChipTextActive: { color: COLORS.primary },

  searchWrap: {
    marginHorizontal: SPACING.md,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },

  filtrosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: 6,
    paddingBottom: 2,
  },
  filtrosRowBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: SPACING.md,
    gap: 6,
    paddingBottom: 6,
  },
  filtroChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    minHeight: 32,
    justifyContent: 'center',
  },
  filtroChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  filtroChipText: { fontSize: 12, fontWeight: '600' },
  filtroChipTextActive: { color: COLORS.primary },

  statsCard: {
    marginHorizontal: SPACING.md,
    marginBottom: 6,
    marginTop: 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primarySoft,
    borderWidth: 1,
    borderColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  statsTitle: { fontSize: 13, fontWeight: '700' },
  statsSub: { fontSize: 12, color: COLORS.primary, marginTop: 2 },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  listEmpty: { flexGrow: 1 },
  card: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  avatarWrap: { alignItems: 'center', gap: 4 },
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
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  locationText: { fontSize: 11, fontWeight: '500', flex: 1 },
  cultivoChip: { backgroundColor: COLORS.primarySoft, borderWidth: 1 },

  cardInfo: { flex: 1, gap: 3 },
  nombre: { fontSize: 16, fontWeight: '700' },
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

  proxBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  proxText: { fontSize: 11, fontWeight: '600' },

  ratingCol: { alignItems: 'center', gap: 2 },
  ratingNum: { fontSize: 12, fontWeight: '700' },

  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  skillChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    maxWidth: 130,
  },
  skillText: { fontSize: 11, fontWeight: '500' },

  actionsRow: { marginTop: 8, flexDirection: 'row', gap: 8, alignItems: 'center' },
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
    paddingTop: SPACING.md,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.xs,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700' },
  emptyText: { fontSize: 13, textAlign: 'center' },
});
