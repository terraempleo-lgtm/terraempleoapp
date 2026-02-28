import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, SafeAreaView } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, StarRating } from '../../components/ui';
import { vacantesAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function DetalleVacanteScreen({ route, navigation }) {
  const { vacante } = route.params;
  const { user } = useAuth();
  const [mensaje, setMensaje] = useState('');
  const [loading, setLoading] = useState(false);
  const [postulado, setPostulado] = useState(false);

  const handlePostularse = async () => {
    setLoading(true);
    try {
      await vacantesAPI.postularse({ vacante_id: vacante.id, mensaje });
      setPostulado(true);
      Alert.alert('¡Listo!', 'Te has postulado exitosamente a esta vacante.');
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al postularse';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          {vacante.urgente ? (
            <View style={styles.urgentBadge}>
              <Ionicons name="alert-circle" size={14} color={COLORS.white} />
              <Text style={styles.urgentText}>URGENTE</Text>
            </View>
          ) : null}

          <Text style={styles.title}>{vacante.titulo}</Text>

          {vacante.nombre_empresa_finca && (
            <InfoRow icon="business-outline" text={vacante.nombre_empresa_finca} />
          )}
          <InfoRow icon="person-outline" text={`Publicada por: ${vacante.nombre_empleador || 'Empleador'}`} />
          <InfoRow icon="location-outline" text={`${vacante.municipio || ''}, ${vacante.departamento || ''}`} />
          {vacante.tipo_pago && <InfoRow icon="cash-outline" text={`Pago: ${vacante.tipo_pago}`} />}

          {vacante.ofrece_alojamiento !== undefined && (
            <InfoRow icon="home-outline"
              text={`Alojamiento: ${vacante.ofrece_alojamiento ? 'Sí' : 'No'}`} />
          )}
          {vacante.ofrece_alimentacion !== undefined && (
            <InfoRow icon="restaurant-outline"
              text={`Alimentación: ${vacante.ofrece_alimentacion ? 'Sí' : 'No'}`} />
          )}

          {vacante.descripcion && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Descripción</Text>
              <Text style={styles.description}>{vacante.descripcion}</Text>
            </View>
          )}

          {vacante.cultivos && vacante.cultivos.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Cultivos</Text>
              <View style={styles.chipsRow}>
                {vacante.cultivos.map((c, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{c.cultivo || c}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {vacante.labores && vacante.labores.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Labores requeridas</Text>
              <View style={styles.chipsRow}>
                {vacante.labores.map((l, i) => (
                  <View key={i} style={[styles.chip, { backgroundColor: COLORS.accentLight }]}>
                    <Text style={[styles.chipText, { color: COLORS.accent }]}>{l.labor || l}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {user?.rol === 'trabajador' && !postulado && (
          <View style={styles.applyCard}>
            <Text style={styles.applyTitle}>¿Te interesa?</Text>
            <Input
              label="Mensaje (opcional)"
              value={mensaje}
              onChangeText={setMensaje}
              placeholder="Escribe un mensaje al empleador..."
              multiline
              numberOfLines={3}
            />
            <Button title="Postularme" onPress={handlePostularse}
              loading={loading} size="large" />
          </View>
        )}

        {postulado && (
          <View style={[styles.applyCard, { backgroundColor: COLORS.primarySoft }]}>
            <Ionicons name="checkmark-circle" size={40} color={COLORS.success} />
            <Text style={styles.appliedText}>¡Ya te postulaste!</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ icon, text }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={18} color={COLORS.primary} />
      <Text style={infoStyles.text}>{text}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  text: { fontSize: 15, color: COLORS.textSecondary, flex: 1 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.medium },
  urgentBadge: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.urgent,
    alignSelf: 'flex-start', paddingHorizontal: SPACING.sm, paddingVertical: 3,
    borderRadius: RADIUS.full, gap: 4, marginBottom: SPACING.sm,
  },
  urgentText: { color: COLORS.white, fontSize: 11, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.md },
  section: { marginTop: SPACING.lg },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  description: { fontSize: 15, color: COLORS.textSecondary, lineHeight: 22 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.primarySoft, paddingHorizontal: SPACING.sm + 4, paddingVertical: 5, borderRadius: RADIUS.full },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
  applyCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg,
    marginTop: SPACING.md, ...SHADOWS.medium, alignItems: 'center',
  },
  applyTitle: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md, alignSelf: 'flex-start' },
  appliedText: { fontSize: 18, fontWeight: '600', color: COLORS.success, marginTop: SPACING.sm },
});
