import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, PickerModal } from '../../components/ui';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { vacantesAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function EditarVacanteScreen({ navigation, route }) {
  const { vacante } = route.params;

  const [titulo, setTitulo] = useState(vacante.titulo || '');
  const [descripcion, setDescripcion] = useState(vacante.descripcion || '');
  const [cultivosV, setCultivosV] = useState(vacante.cultivos?.map(c => c.cultivo) || []);
  const [laboresV, setLaboresV] = useState(vacante.labores?.map(l => l.labor) || []);
  const [tipoPago, setTipoPago] = useState(vacante.tipo_pago || '');
  const [montoPago, setMontoPago] = useState(vacante.monto_pago ? String(vacante.monto_pago) : '');
  const [departamento, setDepartamento] = useState(vacante.departamento || '');
  const [municipio, setMunicipio] = useState(vacante.municipio || '');
  const [vereda, setVereda] = useState(vacante.vereda || '');
  const [urgente, setUrgente] = useState(!!vacante.urgente);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  const handleGuardar = async () => {
    if (!titulo.trim()) {
      setErrors({ titulo: 'El título es obligatorio' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await vacantesAPI.actualizar(vacante.id, {
        titulo,
        descripcion: descripcion || null,
        cultivos: cultivosV,
        labores: laboresV,
        tipo_pago: tipoPago || null,
        monto_pago: montoPago ? parseFloat(montoPago) : null,
        departamento: departamento || null,
        municipio: municipio || null,
        vereda: vereda || null,
        urgente,
      });
      Alert.alert('Éxito', 'Vacante actualizada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al actualizar la vacante';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>

            <Input label="Título de la vacante" value={titulo} onChangeText={setTitulo}
              placeholder="Ej: Recolector de café" icon="briefcase-outline"
              required error={errors.titulo} />

            <Input label="Descripción" value={descripcion} onChangeText={setDescripcion}
              placeholder="Describe el trabajo..." multiline numberOfLines={4} />

            <ChipSelector label="Cultivo relacionado" options={CULTIVOS}
              selected={cultivosV} onSelectionChange={setCultivosV}
              allowCustom customLabel="+ Otro" />

            <ChipSelector label="Tipo de labor" options={LABORES}
              selected={laboresV} onSelectionChange={setLaboresV}
              allowCustom customLabel="+ Otra" />

            <Text style={styles.sectionLabel}>Tipo de pago</Text>
            <ChipSelector
              options={TIPO_PAGO_OPTIONS.map(t => t.label)}
              selected={tipoPago ? [TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label].filter(Boolean) : []}
              onSelectionChange={(sel) => {
                const tp = TIPO_PAGO_OPTIONS.find(t => t.label === sel[sel.length - 1]);
                setTipoPago(tp?.value || '');
              }}
              multiSelect={false}
              allowCustom={false}
            />

            <Input label="Monto de pago (COP)" value={montoPago} onChangeText={setMontoPago}
              placeholder="Ej: 50000" keyboardType="numeric" icon="cash-outline" />

            <Text style={styles.sectionLabel}>Ubicación</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Departamento'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerButton, !departamento && { opacity: 0.5 }]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
            >
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Municipio'}
              </Text>
            </TouchableOpacity>
            <Input label="Vereda (opcional)" value={vereda} onChangeText={setVereda} placeholder="Vereda" />

            <View style={styles.urgentRow}>
              <View>
                <Text style={styles.urgentLabel}>¿Es urgente?</Text>
                <Text style={styles.urgentDesc}>Se destacará en las búsquedas</Text>
              </View>
              <Switch value={!!urgente} onValueChange={setUrgente}
                trackColor={{ false: COLORS.border, true: COLORS.urgent }}
                thumbColor={urgente ? '#fff' : '#f4f3f4'} />
            </View>

            <Button title="Guardar cambios" onPress={handleGuardar}
              loading={loading} size="large" style={{ marginTop: SPACING.lg }} />
          </View>

          <PickerModal visible={showDeptPicker} onClose={() => setShowDeptPicker(false)}
            title="Departamento" options={DEPARTAMENTOS} selectedValue={departamento}
            onSelect={(v) => { setDepartamento(v); setMunicipio(''); }} />
          <PickerModal visible={showMunPicker} onClose={() => setShowMunPicker(false)}
            title="Municipio" options={getMunicipios(departamento)} selectedValue={municipio}
            onSelect={setMunicipio} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.medium },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginTop: SPACING.md, marginBottom: SPACING.sm },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  urgentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.urgentBg, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md,
  },
  urgentLabel: { fontSize: 16, fontWeight: '600', color: COLORS.urgent },
  urgentDesc: { fontSize: 13, color: COLORS.textSecondary },
});
