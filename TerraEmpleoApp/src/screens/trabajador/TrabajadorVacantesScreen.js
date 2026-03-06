import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  RefreshControl, Image, TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

// Icono según cultivo principal
function getCropIcon(cultivos) {
  const c = (cultivos?.[0]?.cultivo || cultivos?.[0] || '').toLowerCase();
  if (c.includes('café') || c.includes('cafe')) return 'cafe-outline';
  if (c.includes('flor')) return 'flower-outline';
  if (c.includes('maíz') || c.includes('maiz') || c.includes('arroz') || c.includes('trigo')) return 'nutrition-outline';
  if (c.includes('caña') || c.includes('cana')) return 'leaf-outline';
  if (c.includes('maquinaria') || c.includes('mecánica')) return 'construct-outline';
  return 'leaf-outline';
}

// Etiqueta de tipo de pago
function getSalaryLabel(item) {
  const tp = (item.tipo_pago || '').toLowerCase();
  if (tp.includes('jornal')) return 'PAGO POR JORNAL';
  if (tp.includes('mensual')) return 'SALARIO ESTIMADO';
  if (tp.includes('destajo')) return 'PAGO POR DESTAJO';
  return 'SALARIO ESTIMADO';
}

// Formato de número colombiano
function formatCOP(n) {
  if (!n) return null;
  const num = Number(n);
  if (num >= 1_000_000) return `$${(num / 1_000_000).toFixed(1)}M`;
  return `$${num.toLocaleString('es-CO')}`;
}

function getSalaryDisplay(item) {
  const tp = (item.tipo_pago || '').toLowerCase();
  if (tp.includes('jornal') && item.valor_jornal) {
    return `${formatCOP(item.valor_jornal)} /día`;
  }
  if (item.salario_min && item.salario_max) {
    return `${formatCOP(item.salario_min)} - ${formatCOP(item.salario_max)} /mes`;
  }
  if (item.salario_min) return `${formatCOP(item.salario_min)} /mes`;
  if (item.salario) return formatCOP(item.salario);
  return null;
}

// Chip de cultivo con emoji
function CultivoChip({ label }) {
  return (
    <View style={styles.chipGreen}>
      <Ionicons name="leaf" size={11} color={COLORS.primary} />
      <Text style={styles.chipGreenText}>{label}</Text>
    </View>
  );
}

function TipoChip({ label }) {
  return (
    <View style={styles.chipGray}>
      <Ionicons name="time-outline" size={11} color={COLORS.textSecondary} />
      <Text style={styles.chipGrayText}>{label}</Text>
    </View>
  );
}

export default function TrabajadorVacantesScreen({ navigation }) {
  const { user } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [vacantesPostuladas, setVacantesPostuladas] = useState(new Set());
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const firstName = (user?.nombre_completo || 'Usuario').split(' ')[0];

  const cargarVacantes = useCallback(async () => {
    try {
      const [vacantesRes, postulacionesRes] = await Promise.all([
        vacantesAPI.listar(),
        vacantesAPI.misPostulaciones(),
      ]);

      setVacantes(vacantesRes.data.vacantes || []);
      const idsPostuladas = new Set(
        (postulacionesRes.data.postulaciones || []).map((postulacion) => Number(postulacion.vacante_id))
      );
      setVacantesPostuladas(idsPostuladas);
    } catch (err) {
      console.error('Error cargando vacantes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { cargarVacantes(); }, [cargarVacantes]);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargarVacantes);
    return unsub;
  }, [navigation, cargarVacantes]);

  const onRefresh = () => { setRefreshing(true); cargarVacantes(); };

  const manejarPostulacionRapida = async (item) => {
    try {
      await vacantesAPI.postularse({ vacante_id: item.id });
      setVacantesPostuladas((prev) => {
        const next = new Set(prev);
        next.add(Number(item.id));
        return next;
      });
      Alert.alert('Listo', 'Te has postulado exitosamente a esta vacante.');
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setVacantesPostuladas((prev) => {
          const next = new Set(prev);
          next.add(Number(item.id));
          return next;
        });
        Alert.alert('Aviso', 'Ya estás postulado a esta vacante');
        return;
      }

      const msg = err.response?.data?.error || 'Error al postularse';
      Alert.alert('Error', msg);
    }
  };

  const filtered = search.trim()
    ? vacantes.filter(v =>
        v.titulo?.toLowerCase().includes(search.toLowerCase()) ||
        v.departamento?.toLowerCase().includes(search.toLowerCase()) ||
        v.nombre_empresa_finca?.toLowerCase().includes(search.toLowerCase())
      )
    : vacantes;

  const renderVacante = ({ item }) => {
    const salaryDisplay = getSalaryDisplay(item);
    const cropIcon = getCropIcon(item.cultivos);
    const cultivos = (item.cultivos || []).slice(0, 2).map(c => c.cultivo || c);
    const labores = (item.labores || []).slice(0, 1).map(l => l.labor || l);
    const yaPostulado = vacantesPostuladas.has(Number(item.id));

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('DetalleVacante', { vacante: item })}
        activeOpacity={0.92}
      >
        {/* Imagen de la finca */}
        <View style={styles.cardImageWrap}>
          {item.foto_portada ? (
            <Image
              source={{ uri: item.foto_portada }}
              style={styles.cardImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.cardImagePlaceholder}>
              <Ionicons name="image-outline" size={36} color="#C8CFC8" />
            </View>
          )}
        </View>

        {/* Cuerpo de la tarjeta */}
        <View style={styles.cardBody}>
          {/* Icono + título + urgente */}
          <View style={styles.titleRow}>
            <View style={styles.cropIconCircle}>
              <Ionicons name={cropIcon} size={18} color={COLORS.primary} />
            </View>
            <View style={styles.titleInfo}>
              <Text style={styles.cardTitle} numberOfLines={1}>{item.titulo}</Text>
              {item.nombre_empresa_finca && (
                <Text style={styles.cardFarm} numberOfLines={1}>
                  {item.nombre_empresa_finca}
                </Text>
              )}
            </View>
            {item.urgente && (
              <View style={styles.urgentBadge}>
                <Text style={styles.urgentText}>URGENTE</Text>
              </View>
            )}
          </View>

          {/* Ubicación */}
          <View style={styles.locRow}>
            <Ionicons name="location" size={14} color={COLORS.primary} />
            <Text style={styles.locText}>
              {[item.municipio, item.departamento].filter(Boolean).join(', ') || 'Sin ubicación'}
            </Text>
          </View>

          {/* Chips */}
          {(cultivos.length > 0 || labores.length > 0 || item.tipo_pago) && (
            <View style={styles.chipsRow}>
              {cultivos.map((c, i) => <CultivoChip key={i} label={c} />)}
              {labores.map((l, i) => <TipoChip key={i} label={l} />)}
              {!labores.length && item.tipo_pago && <TipoChip label={item.tipo_pago} />}
            </View>
          )}

          {/* Separador */}
          <View style={styles.divider} />

          {/* Salario + botón */}
          <View style={styles.bottomRow}>
            <View>
              <Text style={styles.salaryLabel}>{getSalaryLabel(item)}</Text>
              {salaryDisplay ? (
                <Text style={styles.salaryValue}>{salaryDisplay}</Text>
              ) : (
                <Text style={styles.salaryNA}>A convenir</Text>
              )}
            </View>
            <TouchableOpacity
              style={[styles.postBtn, yaPostulado && styles.postBtnDisabled]}
              onPress={(e) => {
                if (e?.stopPropagation) {
                  e.stopPropagation();
                }
                if (!yaPostulado) {
                  manejarPostulacionRapida(item);
                }
              }}
              disabled={yaPostulado}
              activeOpacity={0.8}
            >
              <Text style={[styles.postBtnText, yaPostulado && styles.postBtnTextDisabled]}>
                {yaPostulado ? 'Ya postulado' : 'Postularse'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const ListHeader = (
    <View>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.avatarWrap}>
            {user?.foto_selfie ? (
              <Image source={{ uri: user.foto_selfie }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={20} color={COLORS.primary} />
            )}
          </View>
          <View>
            <Text style={styles.holaText}>HOLA, {firstName.toUpperCase()}</Text>
            <Text style={styles.appName}>TerraEmpleo</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notifBtn}>
          <Ionicons name="notifications" size={24} color={COLORS.textPrimary} />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </View>

      {/* Buscador */}
      <View style={styles.searchWrap}>
        <Ionicons name="search" size={18} color={COLORS.textLight} />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar vacantes de campo..."
          placeholderTextColor={COLORS.textLight}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filtros */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersContent}
      >
        <TouchableOpacity style={styles.filterPrimary}>
          <Ionicons name="options-outline" size={15} color={COLORS.white} />
          <Text style={styles.filterPrimaryText}>Filtros</Text>
        </TouchableOpacity>
        {['Cultivo', 'Ubicación', 'Pago'].map(f => (
          <TouchableOpacity key={f} style={styles.filterChip}>
            <Text style={styles.filterChipText}>{f}</Text>
            <Ionicons name="chevron-down" size={13} color={COLORS.textSecondary} />
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Sección header */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Para ti</Text>
        <TouchableOpacity>
          <Text style={styles.seeAll}>Ver todas</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <FlatList
        data={filtered}
        renderItem={renderVacante}
        keyExtractor={(item) => item.id?.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          !loading && (
            <View style={styles.empty}>
              <Ionicons name="briefcase-outline" size={56} color={COLORS.border} />
              <Text style={styles.emptyText}>No hay vacantes disponibles</Text>
              <Text style={styles.emptySubText}>Desliza hacia abajo para actualizar</Text>
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F4F6F4' },

  /* Header */
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
    backgroundColor: '#F4F6F4',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatarWrap: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.primaryLight,
    overflow: 'hidden',
  },
  avatarImg: { width: 46, height: 46, borderRadius: 23 },
  holaText: { fontSize: 11, fontWeight: '600', color: COLORS.textSecondary, letterSpacing: 0.5 },
  appName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  notifBtn: { position: 'relative', padding: 4 },
  notifDot: {
    position: 'absolute', top: 4, right: 4,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#E53935',
    borderWidth: 1.5, borderColor: '#F4F6F4',
  },

  /* Buscador */
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: SPACING.sm,
    ...SHADOWS.small,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, padding: 0 },

  /* Filtros */
  filtersScroll: { marginBottom: SPACING.sm },
  filtersContent: { paddingHorizontal: SPACING.md, gap: SPACING.sm, flexDirection: 'row' },
  filterPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  filterPrimaryText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  filterChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md, paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.border,
  },
  filterChipText: { color: COLORS.textSecondary, fontSize: 14 },

  /* Sección */
  sectionHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  seeAll: { fontSize: 14, fontWeight: '600', color: COLORS.primary },

  /* Lista */
  list: { paddingHorizontal: SPACING.md, paddingBottom: 20 },

  /* Card */
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    overflow: 'hidden',
    ...SHADOWS.medium,
  },
  cardImageWrap: { width: '100%', height: 170 },
  cardImage: { width: '100%', height: '100%' },
  cardImagePlaceholder: {
    flex: 1, backgroundColor: '#E8ECE8',
    justifyContent: 'center', alignItems: 'center',
  },

  /* Card body */
  cardBody: { padding: SPACING.md },

  titleRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: SPACING.sm, marginBottom: 8,
  },
  cropIconCircle: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0,
  },
  titleInfo: { flex: 1 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  cardFarm: { fontSize: 13, color: COLORS.textSecondary, fontStyle: 'italic', marginTop: 1 },

  urgentBadge: {
    backgroundColor: '#FFEBEE',
    borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
    alignSelf: 'flex-start', flexShrink: 0,
  },
  urgentText: { fontSize: 11, fontWeight: '700', color: '#C62828', letterSpacing: 0.3 },

  /* Ubicación */
  locRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginBottom: SPACING.sm,
  },
  locText: { fontSize: 13, color: COLORS.textSecondary },

  /* Chips */
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: SPACING.sm },
  chipGreen: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  chipGreenText: { fontSize: 12, color: COLORS.primary, fontWeight: '600' },
  chipGray: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#F0F0F0',
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  chipGrayText: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '500' },

  /* Divider */
  divider: { height: 1, backgroundColor: COLORS.borderLight, marginBottom: SPACING.sm },

  /* Salario + botón */
  bottomRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  salaryLabel: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5, marginBottom: 2 },
  salaryValue: { fontSize: 16, fontWeight: '800', color: COLORS.textPrimary },
  salaryNA: { fontSize: 14, color: COLORS.textSecondary, fontStyle: 'italic' },
  postBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  postBtnDisabled: {
    backgroundColor: '#C4C4C4',
  },
  postBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  postBtnTextDisabled: { color: '#6E6E6E' },

  /* Empty */
  empty: { alignItems: 'center', paddingTop: 60, gap: SPACING.sm },
  emptyText: { fontSize: 16, fontWeight: '600', color: COLORS.textSecondary },
  emptySubText: { fontSize: 13, color: COLORS.textLight },
});
