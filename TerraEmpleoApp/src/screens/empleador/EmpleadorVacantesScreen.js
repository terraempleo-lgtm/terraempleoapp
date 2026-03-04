import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';

export default function EmpleadorVacantesScreen({ navigation }) {
  const { user } = useAuth();
  const [vacantes, setVacantes] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

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

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    const unsub = navigation.addListener('focus', cargar);
    return unsub;
  }, [navigation]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>¡Hola, {user?.nombre_completo?.split(' ')[0]}!</Text>
          <Text style={styles.subGreeting}>Gestiona tus vacantes</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={() => navigation.navigate('CrearVacante')}>
          <Ionicons name="add" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={vacantes}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card}
            onPress={() => navigation.navigate('VerPostulaciones', { vacante: item })}
            activeOpacity={0.7}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>{item.titulo}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={[styles.estadoBadge,
                  { backgroundColor: item.estado === 'activa' ? COLORS.success : COLORS.textLight }]}>
                  <Text style={styles.estadoText}>{item.estado}</Text>
                </View>
                {item.estado === 'activa' && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('EditarVacante', { vacante: item })}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="create-outline" size={20} color={COLORS.primary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="people-outline" size={16} color={COLORS.primary} />
              <Text style={styles.cardRowText}>{item.total_postulaciones || 0} postulantes</Text>
            </View>
            <View style={styles.cardRow}>
              <Ionicons name="location-outline" size={16} color={COLORS.textSecondary} />
              <Text style={styles.cardRowText}>{item.municipio}, {item.departamento}</Text>
            </View>
            {item.urgente ? (
              <View style={styles.urgentTag}>
                <Ionicons name="alert-circle" size={12} color={COLORS.urgent} />
                <Text style={styles.urgentTagText}>Urgente</Text>
              </View>
            ) : null}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={60} color={COLORS.textLight} />
            <Text style={styles.emptyText}>No tienes vacantes publicadas</Text>
            <Button title="Crear primera vacante" onPress={() => navigation.navigate('CrearVacante')} size="medium" />
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
  subGreeting: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  addBtn: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
  },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.small },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  cardTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  estadoBadge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  estadoText: { color: COLORS.white, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  cardRowText: { fontSize: 14, color: COLORS.textSecondary },
  urgentTag: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: SPACING.sm },
  urgentTagText: { fontSize: 12, color: COLORS.urgent, fontWeight: '600' },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl * 2, gap: SPACING.md },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});
