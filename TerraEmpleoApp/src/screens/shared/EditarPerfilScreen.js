import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, PickerModal } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import {
  CULTIVOS, LABORES, NIVELES_ESTUDIO, TITULOS_SUGERIDOS,
  EXPERIENCIA_OPTIONS, DISPONIBILIDAD_OPTIONS, TIPO_PAGO_OPTIONS,
} from '../../data/options';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

export default function EditarPerfilScreen({ navigation, route }) {
  const { updateUser, user } = useAuth();
  const { userData: initUser, perfil: initPerfil } = route.params || {};
  const rol = user?.rol;

  // Campos comunes
  const [nombre, setNombre] = useState(initUser?.nombre_completo || '');
  const [departamento, setDepartamento] = useState(initUser?.departamento || '');
  const [municipio, setMunicipio] = useState(initUser?.municipio || '');
  const [vereda, setVereda] = useState(initUser?.vereda || '');
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  // Campos trabajador
  const [nivelEstudios, setNivelEstudios] = useState(initPerfil?.nivel_estudios || '');
  const [tituloEstudio, setTituloEstudio] = useState(initPerfil?.titulo_estudio || '');
  const [experiencia, setExperiencia] = useState(initPerfil?.anios_experiencia || '');
  const [disponibilidad, setDisponibilidad] = useState(initPerfil?.disponibilidad || '');
  const [habilidades, setHabilidades] = useState(
    initPerfil?.habilidades?.map(h => h.habilidad) || []
  );
  const [cultivos, setCultivos] = useState(
    initPerfil?.cultivos?.map(c => c.cultivo) || []
  );
  const [showTituloPicker, setShowTituloPicker] = useState(false);

  // Campos empleador
  const [nombreEmpresa, setNombreEmpresa] = useState(initPerfil?.nombre_empresa_finca || '');
  const [tipoPago, setTipoPago] = useState(initPerfil?.tipo_pago || '');
  const [ofreceAlojamiento, setOfreceAlojamiento] = useState(!!initPerfil?.ofrece_alojamiento);
  const [ofreceAlimentacion, setOfreceAlimentacion] = useState(!!initPerfil?.ofrece_alimentacion);
  const [beneficiosExtra, setBeneficiosExtra] = useState(initPerfil?.beneficios_extra || '');
  const [cultivosEmp, setCultivosEmp] = useState(
    initPerfil?.cultivos?.map(c => c.cultivo) || []
  );
  const [labores, setLabores] = useState(
    initPerfil?.labores?.map(l => l.labor) || []
  );
  const [showTipoPagoPicker, setShowTipoPagoPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const errs = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (rol === 'empleador' && !nombreEmpresa.trim()) errs.empresa = 'El nombre de la finca/empresa es obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      Alert.alert('Campos requeridos', Object.values(errs).join('\n'));
      return false;
    }
    return true;
  };

  const handleGuardar = async () => {
    console.log('[EditarPerfil] handleGuardar iniciado, rol:', rol);
    console.log('[EditarPerfil] authAPI.actualizarPerfil disponible:', typeof authAPI.actualizarPerfil);
    if (!validate()) return;
    setLoading(true);
    try {
      let body;
      if (rol === 'trabajador') {
        body = {
          nombre_completo: nombre,
          departamento: departamento || null,
          municipio: municipio || null,
          vereda: vereda || null,
          nivel_estudios: nivelEstudios || null,
          titulo_estudio: tituloEstudio || null,
          anios_experiencia: experiencia || null,
          disponibilidad: disponibilidad || null,
          habilidades: habilidades.map(h => ({ nombre: h, es_personalizada: !LABORES.includes(h) })),
          cultivos_trabajador: cultivos.map(c => ({ nombre: c, es_personalizado: !CULTIVOS.includes(c) })),
        };
      } else {
        body = {
          nombre_completo: nombre,
          departamento: departamento || null,
          municipio: municipio || null,
          vereda: vereda || null,
          nombre_empresa_finca: nombreEmpresa,
          tipo_pago: tipoPago || null,
          ofrece_alojamiento: ofreceAlojamiento,
          ofrece_alimentacion: ofreceAlimentacion,
          beneficios_extra: beneficiosExtra || null,
          cultivos_empleador: cultivosEmp.map(c => ({ nombre: c, es_personalizado: !CULTIVOS.includes(c) })),
          labores: labores.map(l => ({ nombre: l, es_personalizada: !LABORES.includes(l) })),
        };
      }
      console.log('[EditarPerfil] Enviando PUT /auth/perfil, body keys:', Object.keys(body));
      await authAPI.actualizarPerfil(body);
      updateUser({ nombre_completo: nombre, departamento, municipio });
      Alert.alert('Éxito', 'Perfil actualizado correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      console.error('[EditarPerfil] Error:', err.response?.data || err.message);
      const msg = err.response?.data?.error || err.message || 'Error al actualizar el perfil';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Datos personales */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Datos Personales</Text>
            <Input label="Nombre completo" value={nombre} onChangeText={setNombre}
              placeholder="Ej: Juan Pérez García" icon="person-outline" required error={errors.nombre} />

            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Seleccione departamento *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.departamento && <Text style={styles.errorText}>{errors.departamento}</Text>}

            <TouchableOpacity
              style={[styles.pickerButton, !departamento && styles.pickerDisabled]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
            >
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Seleccione municipio *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Input label="Vereda (opcional)" value={vereda} onChangeText={setVereda}
              placeholder="Nombre de la vereda" icon="trail-sign-outline" />
          </View>

          {/* Campos trabajador */}
          {rol === 'trabajador' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Perfil Trabajador</Text>

              <Text style={styles.fieldLabel}>Nivel de estudios</Text>
              <ChipSelector
                options={NIVELES_ESTUDIO.map(n => n.label)}
                selected={nivelEstudios ? [NIVELES_ESTUDIO.find(n => n.value === nivelEstudios)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const nivel = NIVELES_ESTUDIO.find(n => n.label === sel[sel.length - 1]);
                  setNivelEstudios(nivel?.value || '');
                  if (!nivel || (nivel.value !== 'tecnico_tecnologo' && nivel.value !== 'universitario')) {
                    setTituloEstudio('');
                  }
                }}
                multiSelect={false}
                allowCustom={false}
              />

              {(nivelEstudios === 'tecnico_tecnologo' || nivelEstudios === 'universitario') && (
                <View style={{ marginTop: SPACING.sm }}>
                  <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTituloPicker(true)}>
                    <Ionicons name="school-outline" size={20} color={COLORS.primary} />
                    <Text style={[styles.pickerText, !tituloEstudio && { color: COLORS.textLight }]}>
                      {tituloEstudio || 'Seleccione su título'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                  </TouchableOpacity>
                  <PickerModal visible={showTituloPicker} onClose={() => setShowTituloPicker(false)}
                    title="Título obtenido" options={TITULOS_SUGERIDOS} selectedValue={tituloEstudio}
                    onSelect={setTituloEstudio} />
                </View>
              )}

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Años de experiencia</Text>
              <ChipSelector
                options={EXPERIENCIA_OPTIONS.map(e => e.label)}
                selected={experiencia ? [EXPERIENCIA_OPTIONS.find(e => e.value === experiencia)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const exp = EXPERIENCIA_OPTIONS.find(e => e.label === sel[sel.length - 1]);
                  setExperiencia(exp?.value || '');
                }}
                multiSelect={false}
                allowCustom={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Disponibilidad</Text>
              <ChipSelector
                options={DISPONIBILIDAD_OPTIONS.map(d => d.label)}
                selected={disponibilidad ? [DISPONIBILIDAD_OPTIONS.find(d => d.value === disponibilidad)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const disp = DISPONIBILIDAD_OPTIONS.find(d => d.label === sel[sel.length - 1]);
                  setDisponibilidad(disp?.value || '');
                }}
                multiSelect={false}
                allowCustom={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Habilidades / Labores</Text>
              <ChipSelector
                options={LABORES}
                selected={habilidades}
                onSelectionChange={setHabilidades}
                allowCustom={true}
                customLabel="+ Otra labor"
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Cultivos</Text>
              <ChipSelector
                options={CULTIVOS}
                selected={cultivos}
                onSelectionChange={setCultivos}
                allowCustom={true}
                customLabel="+ Otro cultivo"
              />
            </View>
          )}

          {/* Campos empleador */}
          {rol === 'empleador' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Perfil Empleador</Text>

              <Input label="Nombre de la finca / empresa" value={nombreEmpresa}
                onChangeText={setNombreEmpresa} placeholder="Ej: Finca El Paraíso"
                icon="business-outline" required error={errors.empresa} />

              <Text style={styles.fieldLabel}>Tipo de pago</Text>
              <TouchableOpacity style={styles.pickerButton} onPress={() => setShowTipoPagoPicker(true)}>
                <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
                <Text style={[styles.pickerText, !tipoPago && { color: COLORS.textLight }]}>
                  {tipoPago ? TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label : 'Seleccione tipo de pago'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
              </TouchableOpacity>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ofrece alojamiento</Text>
                <Switch value={ofreceAlojamiento} onValueChange={setOfreceAlojamiento}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlojamiento ? COLORS.primary : '#f4f3f4'} />
              </View>

              <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Ofrece alimentación</Text>
                <Switch value={ofreceAlimentacion} onValueChange={setOfreceAlimentacion}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlimentacion ? COLORS.primary : '#f4f3f4'} />
              </View>

              <Input label="Beneficios adicionales (opcional)" value={beneficiosExtra}
                onChangeText={setBeneficiosExtra} placeholder="Ej: transporte, dotación..."
                icon="gift-outline" />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Cultivos que maneja</Text>
              <ChipSelector
                options={CULTIVOS}
                selected={cultivosEmp}
                onSelectionChange={setCultivosEmp}
                allowCustom={true}
                customLabel="+ Otro cultivo"
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Labores requeridas</Text>
              <ChipSelector
                options={LABORES}
                selected={labores}
                onSelectionChange={setLabores}
                allowCustom={true}
                customLabel="+ Otra labor"
              />
            </View>
          )}

          <Button title="Guardar cambios" onPress={handleGuardar} loading={loading}
            size="large" style={{ marginTop: SPACING.md, marginBottom: SPACING.xl }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <PickerModal visible={showDeptPicker} onClose={() => setShowDeptPicker(false)}
        title="Departamento" options={DEPARTAMENTOS} selectedValue={departamento}
        onSelect={(v) => { setDepartamento(v); setMunicipio(''); }} />
      <PickerModal visible={showMunPicker} onClose={() => setShowMunPicker(false)}
        title="Municipio" options={getMunicipios(departamento)} selectedValue={municipio}
        onSelect={setMunicipio} />
      <PickerModal visible={showTipoPagoPicker} onClose={() => setShowTipoPagoPicker(false)}
        title="Tipo de pago" options={TIPO_PAGO_OPTIONS.map(t => t.label)} selectedValue={TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label}
        onSelect={(label) => setTipoPago(TIPO_PAGO_OPTIONS.find(t => t.label === label)?.value || '')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  content: { padding: SPACING.md, paddingBottom: 40 },
  card: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, marginBottom: SPACING.md, ...SHADOWS.small,
  },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.md },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.md, minHeight: 52, gap: SPACING.sm,
  },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  switchRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight,
    marginBottom: SPACING.sm,
  },
  switchLabel: { fontSize: 15, color: COLORS.textPrimary },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
});
