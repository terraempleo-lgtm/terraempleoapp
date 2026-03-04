import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function TrabajadorVacantesScreen({ navigation }) {
  const { user } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const cargarVacantes = useCallback(async () => {
    try {
      const res = await vacantesAPI.listar();
      setVacantes(res.data.vacantes || []);
    } catch (err) {
      console.error('Error cargando vacantes:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    cargarVacantes();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', cargarVacantes);
    return unsubscribe;
  }, [navigation]);

  const onRefresh = () => {
    setRefreshing(true);
    cargarVacantes();
  };

  const renderVacante = ({ item }) => (
    <TouchableOpacity
      style={[styles.card, item.urgente && styles.cardUrgent]}
      onPress={() => navigation.navigate('DetalleVacante', { vacante: item })}
      activeOpacity={0.7}
    >
      {item.foto_portada ? (
        <Image source={{ uri: item.foto_portada }} style={styles.cardThumb} resizeMode="cover" />
      ) : null}

      <View style={styles.cardBody}>
      {item.urgente ? (
        <View style={styles.urgentBadge}>
          <Ionicons name="alert-circle" size={14} color={COLORS.white} />
          <Text style={styles.urgentText}>URGENTE</Text>
        </View>
      ) : null}

      <Text style={styles.cardTitle}>{item.titulo}</Text>

      {item.nombre_empresa_finca && (
        <View style={styles.cardRow}>
          <Ionicons name="business-outline" size={16} color={COLORS.textSecondary} />
          <Text style={styles.cardRowText}>{item.nombre_empresa_finca}</Text>
        </View>
      )}

      <View style={styles.cardRow}>
        <Ionicons name="location-outline" size={16} color={COLORS.primary} />
        <Text style={styles.cardRowText}>
          {item.municipio ? `${item.municipio}, ` : ''}{item.departamento || 'Sin ubicación'}
        </Text>
      </View>

      {item.tipo_pago && (
        <View style={styles.cardRow}>
          <Ionicons name="cash-outline" size={16} color={COLORS.accent} />
          <Text style={styles.cardRowText}>Pago: {item.tipo_pago}</Text>
        </View>
      )}

      <View style={styles.chipsRow}>
        {(item.cultivos || []).slice(0, 3).map((c, i) => (
          <View key={i} style={styles.miniChip}>
            <Text style={styles.miniChipText}>{c.cultivo || c}</Text>
          </View>
        ))}
        {(item.labores || []).slice(0, 2).map((l, i) => (
          <View key={`l${i}`} style={[styles.miniChip, { backgroundColor: COLORS.accentLight }]}>
            <Text style={[styles.miniChipText, { color: COLORS.accent }]}>{l.labor || l}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.cardDate}>
        {new Date(item.created_at).toLocaleDateString('es-CO')}
      </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>¡Hola, {user?.nombre_completo?.split(' ')[0]}!</Text>
          <Text style={styles.subGreeting}>Encuentra trabajo cerca de ti</Text>
        </View>
        <View style={styles.avatarCircle}>
          <Ionicons name="person" size={24} color={COLORS.white} />
        </View>
      </View>

      <FlatList
        data={vacantes}
        renderItem={renderVacante}
        keyExtractor={(item) => item.id?.toString()}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="briefcase-outline" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No hay vacantes disponibles aún</Text>
            <Text style={styles.emptySubText}>Desliza hacia abajo para actualizar</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.xl,
  },
  greeting: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  subGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  avatarCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    marginBottom: SPACING.md, ...SHADOWS.medium, overflow: 'hidden',
  },
  cardThumb: { width: '100%', height: 140 },
  cardBody: { padding: SPACING.md },
  cardUrgent: { borderLeftWidth: 4, borderLeftColor: COLORS.urgent },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.urgent,
    alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full, gap: 4, marginBottom: SPACING.sm,
  },
  urgentText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  cardTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: 4 },
  cardRowText: { fontSize: 14, color: COLORS.textSecondary },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: SPACING.sm },
  miniChip: {
    backgroundColor: COLORS.primarySoft, paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  miniChipText: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  cardDate: { fontSize: 12, color: COLORS.textLight, marginTop: SPACING.sm, textAlign: 'right' },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl * 2, gap: SPACING.sm },
  emptyText: { fontSize: 18, fontWeight: '600', color: COLORS.textSecondary },
  emptySubText: { fontSize: 14, color: COLORS.textLight },
});
