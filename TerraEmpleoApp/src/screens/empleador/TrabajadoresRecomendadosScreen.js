import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, Alert, ScrollView, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { trabajadoresAPI, vacantesAPI } from '../../services/api';

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

function MatchBadge({ puntaje }) {
  if (!puntaje || puntaje === 0) return null;
  const nivel = puntaje >= 70 ? 'alto' : puntaje >= 40 ? 'medio' : 'bajo';
  const color = nivel === 'alto' ? COLORS.primary : nivel === 'medio' ? COLORS.warning : COLORS.textLight;
  const bg = nivel === 'alto' ? COLORS.primarySoft : nivel === 'medio' ? COLORS.warningSoft : '#F3F4F6';
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

function TrabajadorCard({ item, onVerPerfil, onContactar, enviando }) {
  const prox = PROXIMIDAD_CONFIG[item.proximidad] || PROXIMIDAD_CONFIG.lejano;

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={styles.avatarWrap}>
          {item.foto_selfie ? (
            <Image source={{ uri: item.foto_selfie }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={22} color={COLORS.white} />
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text style={styles.nombre} numberOfLines={1}>{item.nombre_completo}</Text>
          <View style={styles.badgesRow}>
            <MatchBadge puntaje={item.puntaje_match} />
            {prox.label ? (
              <View style={[styles.proxBadge, { backgroundColor: `${prox.color}18` }]}>
                <Ionicons name={prox.icon} size={11} color={prox.color} />
                <Text style={[styles.proxText, { color: prox.color }]}>{prox.label}</Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.ratingCol}>
          <StarRating value={item.calificacion_promedio} />
          <Text style={styles.ratingNum}>{item.calificacion_promedio > 0 ? item.calificacion_promedio.toFixed(1) : '—'}</Text>
        </View>
      </View>

      <View style={styles.skillRow}>
        {(item.cultivos || []).slice(0, 2).map((c, i) => (
          <View key={`c-${i}`} style={styles.skillChip}><Text style={styles.skillText}>{c}</Text></View>
        ))}
        {(item.habilidades || []).slice(0, 2).map((h, i) => (
          <View key={`h-${i}`} style={styles.skillChip}><Text style={styles.skillText}>{h}</Text></View>
        ))}
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.btnContactar} onPress={() => onContactar(item)} disabled={enviando}>
          <Ionicons name={enviando ? 'hourglass-outline' : 'chatbubble-ellipses-outline'} size={14} color={COLORS.white} />
          <Text style={styles.btnContactarText}>{enviando ? 'Enviando...' : 'Contactar'}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.btnPerfil} onPress={() => onVerPerfil(item)}>
          <Ionicons name="person-outline" size={14} color={COLORS.primary} />
          <Text style={styles.btnPerfilText}>Ver perfil</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TrabajadoresRecomendadosScreen({ navigation }) {
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
      Alert.alert('Sin vacante', 'Selecciona una vacante para contactar a este trabajador.');
      return;
    }

    try {
      setEnviandoContactoId(Number(item.id));
      await trabajadoresAPI.contactar(item.id, { vacante_id: vacanteSeleccionadaId });
      Alert.alert('Listo', `Solicitud de contacto enviada a ${item.nombre_completo}.`);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo enviar la solicitud');
    } finally {
      setEnviandoContactoId(null);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.centerWrap}>
          <Ionicons name="sparkles-outline" size={40} color={COLORS.primaryLight} />
          <Text style={styles.loadingText}>Buscando trabajadores para ti...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Para ti</Text>
          <Text style={styles.headerSub}>Trabajadores recomendados por match con tu vacante</Text>
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
              style={[styles.vacanteChip, activa && styles.vacanteChipActive]}
              onPress={() => setVacanteSeleccionadaId(Number(v.id))}
            >
              <Text style={[styles.vacanteChipText, activa && styles.vacanteChipTextActive]} numberOfLines={1}>{v.titulo}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={17} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar trabajador, cultivo, habilidad, zona..."
          placeholderTextColor={COLORS.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={17} color={COLORS.textLight} />
          </TouchableOpacity>
        ) : null}
      </View>

      <View style={styles.filtrosRow}>
        {FILTRO_MATCH.map((f) => {
          const active = filtroMatch === f.key;
          return (
            <TouchableOpacity
              key={`match-${f.key}`}
              style={[styles.filtroChip, active && styles.filtroChipActive]}
              onPress={() => setFiltroMatch(f.key)}
            >
              <Text style={[styles.filtroChipText, active && styles.filtroChipTextActive]}>{f.label}</Text>
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
              style={[styles.filtroChip, active && styles.filtroChipActive]}
              onPress={() => setFiltroProx(f.key)}
            >
              <Text style={[styles.filtroChipText, active && styles.filtroChipTextActive]}>{f.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {vacanteSeleccionada ? (
        <View style={styles.statsCard}>
          <Text style={styles.statsTitle}>{vacanteSeleccionada.titulo}</Text>
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
            <Text style={styles.emptyTitle}>Sin recomendaciones</Text>
            <Text style={styles.emptyText}>No encontramos trabajadores con match para esta vacante por ahora.</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  centerWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.sm },
  loadingText: { fontSize: 15, color: COLORS.textSecondary },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },
  headerSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
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
    borderColor: COLORS.border,
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 7,
    minHeight: 32,
    justifyContent: 'center',
  },
  vacanteChipActive: { backgroundColor: COLORS.primarySoft, borderColor: COLORS.primary },
  vacanteChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  vacanteChipTextActive: { color: COLORS.primary },

  searchWrap: {
    marginHorizontal: SPACING.md,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#F9FAFB',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.textPrimary, padding: 0 },

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
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: COLORS.border,
    minHeight: 32,
    justifyContent: 'center',
  },
  filtroChipActive: {
    backgroundColor: COLORS.primarySoft,
    borderColor: COLORS.primary,
  },
  filtroChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
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
  statsTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  statsSub: { fontSize: 12, color: COLORS.primary, marginTop: 2 },

  list: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  listEmpty: { flexGrow: 1 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
    padding: SPACING.sm,
    ...SHADOWS.card,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
    backgroundColor: COLORS.primaryLight,
  },
  avatar: { width: 46, height: 46 },
  avatarFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#78909C' },

  cardInfo: { flex: 1, gap: 3 },
  nombre: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
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
  ratingNum: { fontSize: 12, fontWeight: '700', color: COLORS.textPrimary },

  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 8 },
  skillChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    maxWidth: 130,
  },
  skillText: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },

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
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  emptyText: { fontSize: 13, color: COLORS.textSecondary, textAlign: 'center' },
});
