import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI, calificacionesAPI } from '../../services/api';
import { StarRating, Button, Input } from '../../components/ui';
import { Ionicons } from '@expo/vector-icons';

export default function VerPostulacionesScreen({ route, navigation }) {
  const { vacante } = route.params;
  const [postulaciones, setPostulaciones] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [calificandoId, setCalificandoId] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [comentario, setComentario] = useState('');

  const cargar = async () => {
    try {
      const res = await vacantesAPI.verPostulaciones(vacante.id);
      setPostulaciones(res.data.postulaciones || []);
    } catch (err) {
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const cambiarEstado = async (postId, estado) => {
    try {
      await vacantesAPI.actualizarPostulacion(postId, estado);
      Alert.alert('Listo', `Postulación ${estado}`);
      cargar();
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error');
    }
  };

  const enviarCalificacion = async (trabajadorId) => {
    if (estrellas === 0) return Alert.alert('Error', 'Selecciona las estrellas');
    try {
      await calificacionesAPI.calificar({
        calificado_id: trabajadorId,
        vacante_id: vacante.id,
        estrellas,
        comentario,
      });
      Alert.alert('¡Listo!', 'Calificación enviada');
      setCalificandoId(null);
      setEstrellas(0);
      setComentario('');
    } catch (err) {
      Alert.alert('Error', 'No se pudo calificar');
    }
  };

  const getEstadoColor = (e) => {
    switch (e) {
      case 'aceptada': return COLORS.success;
      case 'rechazada': return COLORS.error;
      case 'match_auto': return COLORS.info;
      default: return COLORS.warning;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{vacante.titulo}</Text>
        <Text style={styles.headerSub}>{postulaciones.length} postulantes</Text>
      </View>

      <FlatList
        data={postulaciones}
        keyExtractor={(item) => item.id?.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: item.trabajador_id })}
          >
            <View style={styles.cardTop}>
              <View style={styles.avatarCircle}>
                <Ionicons name="person" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.nombre_completo}</Text>
                <Text style={styles.info}>{item.celular}</Text>
                <Text style={styles.info}>{item.municipio}, {item.departamento}</Text>
              </View>
              <View style={[styles.badge, { backgroundColor: getEstadoColor(item.estado) }]}>
                <Text style={styles.badgeText}>{item.estado}</Text>
              </View>
            </View>

            {item.puntaje_match > 0 && (
              <View style={styles.matchRow}>
                <Ionicons name="flash" size={16} color={COLORS.accent} />
                <Text style={styles.matchText}>Match: {Math.round(item.puntaje_match)}%</Text>
              </View>
            )}

            {item.nivel_estudios && (
              <Text style={styles.detail}>Estudios: {item.nivel_estudios}</Text>
            )}
            {item.disponibilidad && (
              <Text style={styles.detail}>Disponibilidad: {item.disponibilidad}</Text>
            )}
            {item.calificacion_promedio > 0 && (
              <View style={styles.ratingRow}>
                <StarRating rating={Math.round(item.calificacion_promedio)} size={16} readonly />
                <Text style={styles.ratingText}>({item.calificacion_promedio})</Text>
              </View>
            )}

            {(item.estado === 'pendiente' || item.estado === 'match_auto') && (
              <View style={styles.actions}>
                <Button title="Aceptar" onPress={() => cambiarEstado(item.id, 'aceptada')}
                  size="small" style={{ flex: 1 }} />
                <Button title="Rechazar" onPress={() => cambiarEstado(item.id, 'rechazada')}
                  variant="danger" size="small" style={{ flex: 1 }} />
              </View>
            )}

            {item.estado === 'aceptada' && calificandoId !== item.trabajador_id && (
              <Button title="Calificar" onPress={() => setCalificandoId(item.trabajador_id)}
                variant="outline" size="small" style={{ marginTop: SPACING.sm }} />
            )}

            {calificandoId === item.trabajador_id && (
              <View style={styles.calificarBox}>
                <Text style={styles.calificarTitle}>Calificar a {item.nombre_completo}</Text>
                <StarRating rating={estrellas} onRate={setEstrellas} size={32} />
                <Input label="Comentario (opcional)" value={comentario}
                  onChangeText={setComentario} placeholder="..." multiline numberOfLines={2} />
                <View style={styles.actions}>
                  <Button title="Enviar" onPress={() => enviarCalificacion(item.trabajador_id)}
                    size="small" style={{ flex: 1 }} />
                  <Button title="Cancelar" onPress={() => setCalificandoId(null)}
                    variant="outline" size="small" style={{ flex: 1 }} />
                </View>
              </View>
            )}
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); cargar(); }} colors={[COLORS.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={50} color={COLORS.textLight} />
            <Text style={styles.emptyText}>Aún no hay postulantes</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { backgroundColor: COLORS.primary, padding: SPACING.lg, paddingTop: SPACING.xl },
  headerTitle: { fontSize: 20, fontWeight: '700', color: COLORS.white },
  headerSub: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  list: { padding: SPACING.md, paddingBottom: 100 },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md, ...SHADOWS.small },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  info: { fontSize: 13, color: COLORS.textSecondary },
  badge: { paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { color: COLORS.white, fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  matchRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.sm },
  matchText: { fontSize: 14, fontWeight: '600', color: COLORS.accent },
  detail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: SPACING.xs },
  ratingText: { fontSize: 13, color: COLORS.textSecondary },
  actions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md },
  calificarBox: { marginTop: SPACING.md, backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md },
  calificarTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  empty: { alignItems: 'center', paddingTop: SPACING.xxl * 2, gap: SPACING.sm },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
});
