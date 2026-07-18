import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, FONTS } from '../../../theme';
import { fincaAPI } from '../../../services/api';
import { useFinca } from '../../../context/FincaContext';

export default function PreciosScreen({ navigation }) {
  const { activeFinca, recargarFincas } = useFinca();
  const [precioJornal, setPrecioJornal] = useState('');
  const [precioKilo, setPrecioKilo] = useState('');
  const [precioAlimentacion, setPrecioAlimentacion] = useState('');
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (activeFinca) {
      setPrecioJornal(activeFinca.precio_jornal_default != null ? String(activeFinca.precio_jornal_default) : '');
      setPrecioKilo(activeFinca.precio_kilo_default != null ? String(activeFinca.precio_kilo_default) : '');
      setPrecioAlimentacion(activeFinca.precio_alimentacion != null ? String(activeFinca.precio_alimentacion) : '');
    }
  }, [activeFinca]);

  const guardar = async () => {
    if (!activeFinca) return;
    setGuardando(true);
    try {
      await fincaAPI.actualizar(activeFinca.id, {
        precio_jornal_default: precioJornal ? Number(precioJornal) : null,
        precio_kilo_default: precioKilo ? Number(precioKilo) : null,
        precio_alimentacion: precioAlimentacion ? Number(precioAlimentacion) : null,
      });
      await recargarFincas();
      navigation.goBack();
    } catch (err) {
      console.error('Error guardando precios:', err);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>Precios de la finca</Text>
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={styles.form}>
          <Text style={styles.hint}>Estos valores se precargan automáticamente al cerrar una jornada.</Text>
          <Text style={styles.label}>Precio jornal (día completo)</Text>
          <TextInput placeholderTextColor={COLORS.textLight} style={styles.input} keyboardType="numeric" value={precioJornal} onChangeText={setPrecioJornal} placeholder="Ej: 60000" />
          <Text style={styles.label}>Precio por kilo</Text>
          <TextInput placeholderTextColor={COLORS.textLight} style={styles.input} keyboardType="numeric" value={precioKilo} onChangeText={setPrecioKilo} placeholder="Ej: 1500" />
          <Text style={styles.label}>Precio alimentación (descuento)</Text>
          <TextInput placeholderTextColor={COLORS.textLight} style={styles.input} keyboardType="numeric" value={precioAlimentacion} onChangeText={setPrecioAlimentacion} placeholder="Ej: 8000" />
          <TouchableOpacity style={styles.saveBtn} onPress={guardar} disabled={guardando}>
            {guardando ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.saveText}>Guardar precios</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md },
  backBtn: { padding: 4, marginRight: 8 },
  title: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: COLORS.textPrimary },
  form: { padding: SPACING.lg },
  hint: { color: COLORS.textLight, marginBottom: SPACING.lg, fontSize: 13 },
  label: { color: COLORS.textPrimary, fontWeight: '600', marginBottom: 6, marginTop: SPACING.md },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, padding: 12, fontSize: 16, color: COLORS.textPrimary, backgroundColor: COLORS.white },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: RADIUS.md, padding: 16, alignItems: 'center', marginTop: SPACING.xl },
  saveText: { color: COLORS.white, fontWeight: '700', fontSize: 16 },
});
