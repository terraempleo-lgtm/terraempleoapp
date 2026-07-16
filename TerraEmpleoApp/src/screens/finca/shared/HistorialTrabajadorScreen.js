import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS, SHADOWS } from '../../../theme';
import { cuadernoAPI } from '../../../services/api';

export default function HistorialTrabajadorScreen({ route, navigation }) {
  const { trabajadorId } = route.params;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [nota, setNota] = useState('');
  const [guardandoNota, setGuardandoNota] = useState(false);

  const cargar = useCallback(async () => {
    try {
      const res = await cuadernoAPI.historialTrabajador(trabajadorId);
      setData(res.data);
    } catch (err) {
      console.error('Error cargando historial:', err);
    } finally {
      setLoading(false);
    }
  }, [trabajadorId]);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const guardarNota = async () => {
    if (!nota.trim()) return;
    setGuardandoNota(true);
    try {
      await cuadernoAPI.crearNota({ trabajador_id: trabajadorId, tipo: 'observacion', nota: nota.trim() });
      setNota('');
      cargar();
    } catch (err) {
      console.error('Error guardando nota:', err);
    } finally {
      setGuardandoNota(false);
    }
  };

  if (loading || !data) {
    return <SafeAreaView style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></SafeAreaView>;
  }

  const { usuario, jornadas = [], notas = [], metricas = {} } = data;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>{usuario?.nombre_completo}</Text>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.kpiRow}>
          <View style={styles.kpiCard}><Text style={styles.kpiValue}>{jornadas.length}</Text><Text style={styles.kpiLabel}>Jornadas</Text></View>
          <View style={styles.kpiCard}><Text style={styles.kpiValue}>{usuario?.calificacion_promedio ? Number(usuario.calificacion_promedio).toFixed(1) : '—'}</Text><Text style={styles.kpiLabel}>Calificación</Text></View>
        </View>

        <Text style={styles.sectionTitle}>Notas internas</Text>
        <Text style={styles.hint}>Solo visibles para dueño y capataz, no para el trabajador.</Text>
        <View style={styles.notaInputRow}>
          <TextInput style={styles.notaInput} placeholder="Agregar observación..." value={nota} onChangeText={setNota} multiline />
          <TouchableOpacity onPress={guardarNota} disabled={guardandoNota} style={styles.notaBtn}>
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
        {notas.map(n => (
          <View key={n.id} style={styles.notaCard}>
            <Text style={styles.notaTexto}>{n.nota}</Text>
            <Text style={styles.notaFecha}>{n.created_at?.slice(0, 10)}</Text>
          </View>
        ))}

        <Text style={styles.sectionTitle}>Jornadas</Text>
        {jornadas.map(j => (
          <TouchableOpacity key={j.asistencia_id} style={styles.jornadaRow} onPress={() => navigation.navigate('DetalleJornada', { jornadaId: j.id })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.jornadaFecha}>{j.fecha?.slice(0, 10)}</Text>
              <Text style={styles.jornadaSub}>{j.asistencia_estado} · {j.cantidad_kg ? `${j.cantidad_kg} kg · ` : ''}${Number(j.pago_total || 0).toLocaleString('es-CO')}</Text>
            </View>
            {j.calif_nivel && <Text style={styles.califBadge}>{j.calif_nivel}</Text>}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  backBtn: { padding: 4, marginRight: 8 },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  kpiRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.lg },
  kpiCard: { flex: 1, backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, alignItems: 'center', ...SHADOWS.sm },
  kpiValue: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  kpiLabel: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  sectionTitle: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary, marginTop: SPACING.lg, marginBottom: 4 },
  hint: { color: COLORS.textLight, fontSize: 12, marginBottom: SPACING.sm },
  notaInputRow: { flexDirection: 'row', gap: 8, marginBottom: SPACING.md },
  notaInput: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 10, backgroundColor: COLORS.white, minHeight: 44 },
  notaBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  notaCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.sm, marginBottom: SPACING.sm },
  notaTexto: { color: COLORS.textPrimary },
  notaFecha: { color: COLORS.textLight, fontSize: 11, marginTop: 4 },
  jornadaRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, borderRadius: RADIUS.md, padding: SPACING.md, marginBottom: SPACING.sm, ...SHADOWS.sm },
  jornadaFecha: { fontWeight: '700', color: COLORS.textPrimary },
  jornadaSub: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
  califBadge: { fontWeight: '800', color: COLORS.primary, fontSize: 16 },
});
