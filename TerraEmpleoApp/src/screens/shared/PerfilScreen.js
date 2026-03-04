import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, StarRating } from '../../components/ui';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const LABELS_EXPERIENCIA = {
  sin_experiencia: 'Sin experiencia',
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: 'Más de 10 años',
};

const LABELS_DISPONIBILIDAD = {
  tiempo_completo: 'Tiempo completo',
  por_dias: 'Por días',
  por_temporada: 'Por temporada / cosecha',
  fines_semana: 'Fines de semana',
  inmediato: 'Disponible inmediatamente',
};

const LABELS_ESTUDIOS = {
  sin_estudios: 'Sin estudios',
  bachiller: 'Bachiller',
  tecnico: 'Técnico / Tecnólogo',
  universitario: 'Universitario',
};

const LABELS_PAGO = {
  jornal: 'Jornal (diario)',
  semanal: 'Semanal',
  quincenal: 'Quincenal',
  mensual: 'Mensual',
  destajo: 'Por tarea / destajo',
};

export default function PerfilScreen() {
  const { user, signOut } = useAuth();
  const [perfil, setPerfil] = useState(null);
  const [userData, setUserData] = useState(null);

  useEffect(() => {
    loadPerfil();
  }, []);

  const loadPerfil = async () => {
    try {
      const res = await authAPI.getPerfil();
      setUserData(res.data.user);
      setPerfil(res.data.perfil);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Estás seguro?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sí, salir', onPress: signOut, style: 'destructive' },
    ]);
  };

  const u = userData || user;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            {u?.foto_selfie && u.foto_selfie.startsWith('http') ? (
              <Image
                source={{ uri: u.foto_selfie }}
                style={{ width: 88, height: 88, borderRadius: 44 }}
              />
            ) : (
              <Ionicons name="person" size={48} color={COLORS.white} />
            )}
          </View>
          <Text style={styles.name}>{u?.nombre_completo}</Text>
          <Text style={styles.role}>
            {u?.rol === 'trabajador' ? 'Trabajador' : u?.rol === 'empleador' ? 'Empleador' : 'Admin'}
          </Text>
          {u?.calificacion_promedio > 0 && (
            <View style={styles.ratingRow}>
              <StarRating rating={Math.round(parseFloat(u.calificacion_promedio))} size={20} readonly />
              <Text style={styles.ratingText}>({u.calificacion_promedio})</Text>
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          <InfoItem icon="call-outline" label="Celular" value={u?.celular} />
          {u?.correo && <InfoItem icon="mail-outline" label="Correo" value={u.correo} />}
          <InfoItem icon="location-outline" label="Ubicación"
            value={`${u?.municipio || ''}, ${u?.departamento || ''}`} />
          <InfoItem icon="shield-checkmark-outline" label="Verificado"
            value={u?.verificado_sms ? 'Sí' : 'No'} />
        </View>

        {perfil && u?.rol === 'trabajador' && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Perfil Trabajador</Text>
            {perfil.nivel_estudios && (
              <InfoItem icon="school-outline" label="Estudios"
                value={LABELS_ESTUDIOS[perfil.nivel_estudios] || perfil.nivel_estudios} />
            )}
            {perfil.titulo_estudio && (
              <InfoItem icon="ribbon-outline" label="Título" value={perfil.titulo_estudio} />
            )}
            {perfil.anios_experiencia && (
              <InfoItem icon="time-outline" label="Experiencia"
                value={LABELS_EXPERIENCIA[perfil.anios_experiencia] || perfil.anios_experiencia} />
            )}
            {perfil.disponibilidad && (
              <InfoItem icon="calendar-outline" label="Disponibilidad"
                value={LABELS_DISPONIBILIDAD[perfil.disponibilidad] || perfil.disponibilidad} />
            )}
            {perfil.habilidades?.length > 0 && (
              <View style={styles.chipsSection}>
                <Text style={styles.chipLabel}>Habilidades:</Text>
                <View style={styles.chipsRow}>
                  {perfil.habilidades.map((h, i) => (
                    <View key={i} style={styles.chip}>
                      <Text style={styles.chipText}>{h.habilidad}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
            {perfil.cultivos?.length > 0 && (
              <View style={styles.chipsSection}>
                <Text style={styles.chipLabel}>Cultivos:</Text>
                <View style={styles.chipsRow}>
                  {perfil.cultivos.map((c, i) => (
                    <View key={i} style={[styles.chip, { backgroundColor: COLORS.accentLight }]}>
                      <Text style={[styles.chipText, { color: COLORS.accent }]}>{c.cultivo}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {perfil && u?.rol === 'empleador' && (
          <View style={styles.infoCard}>
            <Text style={styles.sectionTitle}>Perfil Empleador</Text>
            <InfoItem icon="business-outline" label="Finca/Empresa" value={perfil.nombre_empresa_finca} />
            {perfil.tipo_pago && (
              <InfoItem icon="cash-outline" label="Tipo pago"
                value={LABELS_PAGO[perfil.tipo_pago] || perfil.tipo_pago} />
            )}
            <InfoItem icon="home-outline" label="Alojamiento" value={perfil.ofrece_alojamiento ? 'Sí' : 'No'} />
            <InfoItem icon="restaurant-outline" label="Alimentación" value={perfil.ofrece_alimentacion ? 'Sí' : 'No'} />
          </View>
        )}

        <Button title="Cerrar Sesión" onPress={handleLogout} variant="danger" size="large"
          style={{ marginTop: SPACING.lg }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <View style={infoStyles.row}>
      <Ionicons name={icon} size={20} color={COLORS.primary} />
      <View style={{ flex: 1 }}>
        <Text style={infoStyles.label}>{label}</Text>
        <Text style={infoStyles.value}>{value || 'N/A'}</Text>
      </View>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { fontSize: 12, color: COLORS.textLight, fontWeight: '500' },
  value: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 100 },
  headerCard: {
    backgroundColor: COLORS.primary, borderRadius: RADIUS.lg,
    padding: SPACING.xl, alignItems: 'center', ...SHADOWS.medium,
  },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  name: { fontSize: 22, fontWeight: '700', color: COLORS.white },
  role: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, textTransform: 'capitalize' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.sm },
  ratingText: { color: 'rgba(255,255,255,0.8)', fontSize: 14 },
  infoCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginTop: SPACING.md, ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  chipsSection: { marginTop: SPACING.md },
  chipLabel: { fontSize: 13, color: COLORS.textLight, fontWeight: '500', marginBottom: SPACING.xs },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: COLORS.primarySoft, paddingHorizontal: SPACING.sm + 4, paddingVertical: 4, borderRadius: RADIUS.full },
  chipText: { fontSize: 13, color: COLORS.primary, fontWeight: '500' },
});