import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl,
  TouchableOpacity, Image, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';

export default function MisPostulacionesScreen({ navigation }) {
  const [postulaciones, setPostulaciones] = useState([]);
  const [fotosVacante, setFotosVacante] = useState({});
  const [refreshing, setRefreshing] = useState(false);
  const [filtro, setFiltro] = useState('todas');

  const cargar = useCallback(async () => {
    try {
      const res = await vacantesAPI.misPostulaciones();
      const lista = res.data?.postulaciones || [];
      setPostulaciones(lista);

      const idsVacantes = Array.from(new Set(
        lista.map((p) => Number(p.vacante_id || p.id)).filter((id) => Number.isFinite(id))
      ));

      if (idsVacantes.length === 0) {
        setFotosVacante({});
        return;
      }

      const detalles = await Promise.all(idsVacantes.map(async (id) => {
        try {
          const detalle = await vacantesAPI.detalle(id);
          return { id, foto: detalle.data?.vacante?.foto_portada || null };
        } catch (_) {
          return { id, foto: null };
        }
      }));

      const mapa = {};
      detalles.forEach((d) => { mapa[d.id] = d.foto; });
      setFotosVacante(mapa);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation, cargar]);

  const handlePostulacionClick = async (postulacion) => {
    try {
      const vacanteId = postulacion.vacante_id || postulacion.id;
      if (!vacanteId) return;

      const res = await vacantesAPI.detalle(vacanteId);
      const vacante = res.data?.vacante || { id: vacanteId };

      navigation.navigate('Vacantes', {
        screen: 'DetalleVacante',
        params: { vacante },
      });
    } catch (err) {
      console.error('Error abriendo detalle de vacante:', err);
    }
  };

  const formatDateRelative = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffDias = Math.floor((now - d) / (1000 * 60 * 60 * 24));

    if (diffDias === 0) return 'Hoy';
    if (diffDias === 1) return 'Hace 1 día';
    if (diffDias < 7) return `Hace ${diffDias} días`;

    const semanas = Math.floor(diffDias / 7);
    if (semanas === 1) return 'Hace 1 semana';
    if (semanas <= 4) return `Hace ${semanas} semanas`;

    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
  };

  const getEstado = (estado) => {
    if (estado === 'aceptada') {
      return { label: 'ACEPTADA', bg: '#DCEFE4', color: COLORS.primary };
    }
    if (estado === 'rechazada') {
      return { label: 'RECHAZADA', bg: COLORS.errorSoft, color: COLORS.error };
    }
    return { label: 'PENDIENTE', bg: '#FEF3C7', color: '#D97706' };
  };

  const counts = useMemo(() => ({
    todas: postulaciones.length,
    pendiente: postulaciones.filter((p) => p.estado === 'pendiente' || p.estado === 'match_auto').length,
    aceptada: postulaciones.filter((p) => p.estado === 'aceptada').length,
    rechazada: postulaciones.filter((p) => p.estado === 'rechazada').length,
  }), [postulaciones]);

  const chips = [
    { key: 'todas', label: `Todas (${counts.todas})` },
    { key: 'pendiente', label: `Pendiente (${counts.pendiente})` },
    { key: 'aceptada', label: `Aceptadas (${counts.aceptada})` },
    { key: 'rechazada', label: `Rechazadas (${counts.rechazada})` },
  ];

  const dataFiltrada = postulaciones.filter((p) => {
    if (filtro === 'todas') return true;
    if (filtro === 'pendiente') return p.estado === 'pendiente' || p.estado === 'match_auto';
    if (filtro === 'aceptada') return p.estado === 'aceptada';
    if (filtro === 'rechazada') return p.estado === 'rechazada';
    return true;
  });

  const renderItem = ({ item }) => {
    const estado = getEstado(item.estado);
    const vacanteId = Number(item.vacante_id || item.id);
    const foto = fotosVacante[vacanteId] || null;
    const esAceptada = item.estado === 'aceptada';

    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => handlePostulacionClick(item)}>
        <View style={styles.cardMain}>
          <View style={styles.imageWrap}>
            {foto ? (
              <Image source={{ uri: foto }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={styles.imagePlaceholder}>
                <Ionicons name="image-outline" size={20} color={COLORS.primaryLight} />
              </View>
            )}
          </View>

          <View style={styles.cardInfo}>
            <View style={styles.cardTopRow}>
              <View style={[styles.estadoPill, { backgroundColor: estado.bg }]}> 
                <Text style={[styles.estadoPillText, { color: estado.color }]}>{estado.label}</Text>
              </View>
              <Text style={styles.fechaText}>{formatDateRelative(item.created_at)}</Text>
            </View>

            <Text style={styles.vacanteTitle} numberOfLines={2}>{item.titulo}</Text>

            <Text style={styles.empresaText} numberOfLines={1}>
              {item.nombre_empresa_finca || 'Finca sin nombre'}
            </Text>

            <View style={styles.locationRow}>
              <Ionicons name="location-sharp" size={13} color={COLORS.textLight} />
              <Text style={styles.locationText} numberOfLines={2}>
                {[item.municipio, item.departamento].filter(Boolean).join(', ') || 'Ubicación por confirmar'}
              </Text>
            </View>
          </View>
        </View>

        {esAceptada ? (
          <View style={styles.okBox}>
            <Ionicons name="information-circle" size={16} color={COLORS.primary} style={{ marginTop: 1 }} />
            <Text style={styles.okBoxText}>
              ¡Felicidades! Tu postulación fue aceptada. Espera que el empleador se comunique contigo pronto.
            </Text>
          </View>
        ) : null}

        <View style={styles.cardFooter}>
          <TouchableOpacity style={styles.detailBtn} onPress={() => handlePostulacionClick(item)}>
            <Text style={styles.detailBtnText}>Ver detalle</Text>
            <Ionicons name="chevron-forward" size={16} color={COLORS.primary} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.headerRow}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Vacantes'))}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mis Postulaciones</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsRow}
        style={{ flexGrow: 0 }}
      >
        {chips.map((chip) => {
          const activo = filtro === chip.key;
          return (
            <TouchableOpacity
              key={chip.key}
              style={[styles.filterChip, activo && styles.filterChipActive]}
              onPress={() => setFiltro(chip.key)}
              activeOpacity={0.85}
            >
              <View style={[styles.filterDot, activo && styles.filterDotActive]} />
              <Text style={[styles.filterText, activo && styles.filterTextActive]}>{chip.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={dataFiltrada}
        keyExtractor={(item) => String(item.id)}
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
            <View style={styles.emptyIconWrap}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.primaryLight} />
            </View>
            <Text style={styles.emptyTitle}>Sin postulaciones</Text>
            <Text style={styles.emptyText}>No hay postulaciones en este filtro por ahora.</Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() => navigation.navigate('Vacantes')}
              activeOpacity={0.85}
            >
              <Ionicons name="search-outline" size={18} color={COLORS.white} />
              <Text style={styles.emptyBtnText}>Explorar vacantes</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F5' },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingTop: 6,
    paddingBottom: 8,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EEF4EF',
    borderWidth: 1,
    borderColor: '#D4E3D8',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.textPrimary,
    letterSpacing: 0.2,
  },
  headerSpacer: { width: 40 },

  chipsRow: {
    paddingHorizontal: SPACING.lg,
    gap: 6,
    paddingBottom: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: '#D9E2DD',
    ...SHADOWS.small,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EAB308',
  },
  filterDotActive: { backgroundColor: COLORS.white },
  filterText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#3D4A45',
  },
  filterTextActive: { color: COLORS.white },

  list: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 88,
    paddingTop: 2,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#DEE7E2',
    overflow: 'hidden',
    ...SHADOWS.small,
  },
  cardMain: {
    flexDirection: 'row',
    gap: SPACING.sm,
    paddingHorizontal: 12,
    paddingTop: 11,
    paddingBottom: 9,
  },

  imageWrap: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#EAF2ED',
    flexShrink: 0,
  },
  image: { width: 64, height: 64, borderRadius: 14 },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  cardInfo: { flex: 1 },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  estadoPill: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  estadoPillText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  fechaText: {
    fontSize: 11,
    color: '#94A099',
    fontWeight: '500',
  },

  vacanteTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.textPrimary,
    lineHeight: 21,
    marginBottom: 1,
  },
  empresaText: {
    fontSize: 13,
    color: '#55635D',
    fontWeight: '600',
  },
  locationRow: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    flex: 1,
    fontSize: 12,
    color: '#74837C',
    fontWeight: '500',
    lineHeight: 16,
  },

  okBox: {
    marginHorizontal: 12,
    marginBottom: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BDE2C9',
    backgroundColor: '#ECF7F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  okBoxText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.primary,
    lineHeight: 16,
    fontWeight: '500',
  },

  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: '#EDF1EF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: 'flex-end',
  },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
  },
  detailBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 0.1,
  },

  empty: {
    alignItems: 'center',
    paddingTop: SPACING.xxl * 2,
    paddingHorizontal: SPACING.xl,
  },
  emptyIconWrap: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptyText: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  emptyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    borderRadius: RADIUS.full,
    ...SHADOWS.button,
  },
  emptyBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
