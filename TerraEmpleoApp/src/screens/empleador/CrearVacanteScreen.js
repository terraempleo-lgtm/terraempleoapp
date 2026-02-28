import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, SafeAreaView,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, PickerModal } from '../../components/ui';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { vacantesAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

export default function CrearVacanteScreen({ navigation }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cultivosV, setCultivosV] = useState([]);
  const [laboresV, setLaboresV] = useState([]);
  const [tipoPago, setTipoPago] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [vereda, setVereda] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);
  const [errors, setErrors] = useState({});

  const handleCrear = async () => {
    const errs = {};
    if (!titulo.trim()) errs.titulo = 'El título es obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await vacantesAPI.crear({
        titulo,
        descripcion,
        cultivos: cultivosV,
        labores: laboresV,
        tipo_pago: tipoPago || undefined,
        monto_pago: montoPago ? parseFloat(montoPago) : undefined,
        departamento,
        municipio,
        vereda: vereda || undefined,
        urgente,
      });
      Alert.alert('¡Vacante creada!', 'Se realizó el matching automático con trabajadores disponibles.', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al crear la vacante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Nueva Vacante</Text>

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
            <ChipSelector options={TIPO_PAGO_OPTIONS.map(t => t.label)}
              selected={tipoPago ? [TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label] : []}
              onSelectionChange={(sel) => {
                const tp = TIPO_PAGO_OPTIONS.find(t => t.label === sel[sel.length - 1]);
                setTipoPago(tp?.value || '');
              }}
              multiSelect={false} allowCustom={false} />

            <Input label="Monto de pago (COP)" value={montoPago} onChangeText={setMontoPago}
              placeholder="Ej: 50000" keyboardType="numeric" icon="cash-outline" />

            <Text style={styles.sectionLabel}>Ubicación</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Departamento'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickerButton, !departamento && { opacity: 0.5 }]}
              onPress={() => departamento && setShowMunPicker(true)} disabled={!departamento}>
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
              <Switch value={urgente} onValueChange={setUrgente}
                trackColor={{ false: COLORS.border, true: COLORS.urgent }}
                thumbColor={urgente ? '#fff' : '#f4f3f4'} />
            </View>

            <Button title="Publicar Vacante" onPress={handleCrear}
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
  title: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.lg },
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
