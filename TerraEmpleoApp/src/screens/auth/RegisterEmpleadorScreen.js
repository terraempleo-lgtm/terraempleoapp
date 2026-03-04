import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, ProgressBar, PickerModal } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

const TOTAL_STEPS = 8;
const STEP_LABELS = [
  'Datos de finca', 'Ubicación', 'Datos de contacto', 'Cédula y datos legales',
  'Verificación SMS', 'Fotos de verificación', 'Cultivos y labores', 'Resumen final'
];

export default function RegisterEmpleadorScreen({ navigation }) {
  const { signIn } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Datos finca
  const [nombreEmpresa, setNombreEmpresa] = useState('');

  // Step 2: Ubicación
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [vereda, setVereda] = useState('');
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  // Step 3: Contacto
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 4: Legal
  const [cedula, setCedula] = useState('');
  const [aceptaHabeasData, setAceptaHabeasData] = useState(false);

  // Step 5: SMS
  const [codigoSMS, setCodigoSMS] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoDebug, setCodigoDebug] = useState('');
  

  // Step 6: Fotos
  const [fotoSelfie, setFotoSelfie] = useState(false);
  const [fotoCedula, setFotoCedula] = useState(false);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(false);

  // Step 7: Cultivos, labores, pago, beneficios
  const [cultivosEmp, setCultivosEmp] = useState([]);
  const [labores, setLabores] = useState([]);
  const [tipoPago, setTipoPago] = useState('');
  const [ofreceAlojamiento, setOfreceAlojamiento] = useState(false);
  const [ofreceAlimentacion, setOfreceAlimentacion] = useState(false);
  const [beneficiosExtra, setBeneficiosExtra] = useState('');

  const [errors, setErrors] = useState({});

  const validateStep = () => {
    const errs = {};
    switch (step) {
      case 1:
        if (!nombreEmpresa.trim()) errs.empresa = 'El nombre de la finca/empresa es obligatorio';
        break;
      case 2:
        if (!departamento) errs.departamento = 'Seleccione un departamento';
        if (!municipio) errs.municipio = 'Seleccione un municipio';
        break;
      case 3:
        if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
        if (!celular.trim()) errs.celular = 'El celular es obligatorio';
        if (!password.trim()) errs.password = 'La contraseña es obligatoria';
        if (password.length < 6) errs.password = 'Mínimo 6 caracteres';
        if (password !== confirmPassword) errs.confirmPassword = 'No coinciden';
        break;
      case 4:
        if (!cedula.trim()) errs.cedula = 'La cédula es obligatoria';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar';
        break;
      case 5:
        if (!codigoSMS.trim()) errs.codigo = 'Ingrese el código';
        break;
      case 6:
        if (!fotoSelfie) errs.selfie = 'Obligatoria';
        if (!fotoCedula) errs.cedFoto = 'Obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'Obligatoria';
        break;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => { if (validateStep()) setStep(step + 1); };
  const prevStep = () => step > 1 && setStep(step - 1);

  const enviarCodigo = async () => {
  try {
    const res = await authAPI.enviarSMS(celular);
    setCodigoEnviado(true);
    setCodigoDebug(res.data.codigo_debug);
    Alert.alert('Código enviado', `Código debug: ${res.data.codigo_debug}`);
  } catch (err) {
    Alert.alert('Error', 'No se pudo enviar el código');
  }
};

  const mockFoto = (tipo) => {
    Alert.alert('Foto capturada', `${tipo} simulada exitosamente.`);
    if (tipo === 'selfie') setFotoSelfie(true);
    if (tipo === 'cédula') setFotoCedula(true);
    if (tipo === 'selfie con cédula') setFotoSelfieCedula(true);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const data = {
        rol: 'empleador',
        nombre_completo: nombre,
        celular,
        correo: correo || undefined,
        password,
        cedula,
        departamento,
        municipio,
        vereda: vereda || undefined,
        acepta_habeas_data: true,
        nombre_empresa_finca: nombreEmpresa,
        tipo_pago: tipoPago || undefined,
        ofrece_alojamiento: ofreceAlojamiento,
        ofrece_alimentacion: ofreceAlimentacion,
        beneficios_extra: beneficiosExtra || undefined,
        cultivos_empleador: cultivosEmp.map(c => ({
          nombre: c,
          es_personalizado: !CULTIVOS.includes(c),
        })),
        labores: labores.map(l => ({
          nombre: l,
          es_personalizada: !LABORES.includes(l),
        })),
      };

      const response = await authAPI.register(data);
      const { token, user } = response.data;
      Alert.alert('¡Registro exitoso!', 'Tu cuenta ha sido creada.', [
        { text: 'Continuar', onPress: () => signIn(user, token) }
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Error al registrarse';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <View>
            <Text style={styles.stepTitle}>Datos de Finca / Empresa</Text>
            <Text style={styles.stepDesc}>¿Cómo se llama tu finca o empresa?</Text>
            <Input label="Nombre de la finca o empresa" value={nombreEmpresa}
              onChangeText={setNombreEmpresa} placeholder="Ej: Finca La Esperanza"
              icon="home-outline" required error={errors.empresa} />
          </View>
        );

      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>Ubicación</Text>
            <Text style={styles.stepDesc}>¿Dónde está ubicada la finca?</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Seleccione departamento *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.departamento && <Text style={styles.errorText}>{errors.departamento}</Text>}

            <TouchableOpacity style={[styles.pickerButton, !departamento && styles.pickerDisabled]}
              onPress={() => departamento && setShowMunPicker(true)} disabled={!departamento}>
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Seleccione municipio *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Input label="Vereda (opcional)" value={vereda} onChangeText={setVereda}
              placeholder="Nombre de la vereda" icon="trail-sign-outline" />

            <PickerModal visible={showDeptPicker} onClose={() => setShowDeptPicker(false)}
              title="Departamento" options={DEPARTAMENTOS} selectedValue={departamento}
              onSelect={(v) => { setDepartamento(v); setMunicipio(''); }} />
            <PickerModal visible={showMunPicker} onClose={() => setShowMunPicker(false)}
              title="Municipio" options={getMunicipios(departamento)} selectedValue={municipio}
              onSelect={setMunicipio} />
          </View>
        );

      case 3:
        return (
          <View>
            <Text style={styles.stepTitle}>Datos de Contacto</Text>
            <Input label="Nombre completo (representante)" value={nombre} onChangeText={setNombre}
              placeholder="Nombre del contacto" icon="person-outline" required error={errors.nombre} />
            <Input label="Celular" value={celular} onChangeText={setCelular}
              placeholder="3001234567" keyboardType="phone-pad" icon="call-outline" required error={errors.celular} />
            <Input label="Correo (opcional)" value={correo} onChangeText={setCorreo}
              placeholder="correo@ejemplo.com" keyboardType="email-address" icon="mail-outline" />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres" secureTextEntry icon="lock-closed-outline" required error={errors.password} />
            <Input label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña" secureTextEntry icon="lock-closed-outline" required error={errors.confirmPassword} />
          </View>
        );

      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Cédula y Datos Legales</Text>
            <Input label="Número de cédula" value={cedula} onChangeText={setCedula}
              placeholder="1234567890" keyboardType="numeric" icon="card-outline" required error={errors.cedula} />
            <View style={styles.checkboxRow}>
              <Switch value={!!aceptaHabeasData} onValueChange={setAceptaHabeasData}
                trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                thumbColor={aceptaHabeasData ? COLORS.primary : '#f4f3f4'} />
              <Text style={styles.checkboxText}>
                Autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012 (Habeas Data)
              </Text>
            </View>
            {errors.habeas && <Text style={styles.errorText}>{errors.habeas}</Text>}
          </View>
        );

      case 5:
        return (
          <View>
            <Text style={styles.stepTitle}>Verificación SMS</Text>
            {!codigoEnviado ? (
              <View style={styles.smsContainer}>
                <Text style={styles.smsText}>Se enviará un código a:</Text>
                <Text style={styles.smsPhone}>{celular}</Text>
                <Button title="Enviar Código" onPress={enviarCodigo} />
              </View>
            ) : (
              <View>
                <Text style={styles.smsText}>Código debug: {codigoDebug}</Text>
                <Input label="Código" value={codigoSMS} onChangeText={setCodigoSMS}
                  placeholder="000000" keyboardType="numeric" maxLength={6}
                  icon="key-outline" error={errors.codigo} />
                <Button title="Reenviar" onPress={enviarCodigo} variant="outline" size="small" />
              </View>
            )}
          </View>
        );

      case 6:
        return (
          <View>
            <Text style={styles.stepTitle}>Fotos de Verificación</Text>
            <TouchableOpacity style={[styles.photoBtn, fotoSelfie && styles.photoBtnDone]}
              onPress={() => mockFoto('selfie')}>
              <Ionicons name={fotoSelfie ? 'checkmark-circle' : 'camera'} size={32}
                color={fotoSelfie ? COLORS.success : COLORS.primary} />
              <Text style={styles.photoBtnText}>{fotoSelfie ? '✓ Selfie' : 'Tomar Selfie'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoBtn, fotoCedula && styles.photoBtnDone]}
              onPress={() => mockFoto('cédula')}>
              <Ionicons name={fotoCedula ? 'checkmark-circle' : 'card'} size={32}
                color={fotoCedula ? COLORS.success : COLORS.primary} />
              <Text style={styles.photoBtnText}>{fotoCedula ? '✓ Cédula' : 'Foto Cédula'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoBtn, fotoSelfieCedula && styles.photoBtnDone]}
              onPress={() => mockFoto('selfie con cédula')}>
              <Ionicons name={fotoSelfieCedula ? 'checkmark-circle' : 'people'} size={32}
                color={fotoSelfieCedula ? COLORS.success : COLORS.primary} />
              <Text style={styles.photoBtnText}>{fotoSelfieCedula ? '✓ Selfie+Cédula' : 'Selfie con Cédula'}</Text>
            </TouchableOpacity>
          </View>
        );

      case 7:
        return (
          <View>
            <Text style={styles.stepTitle}>Cultivos, Labores y Pago</Text>

            <ChipSelector label="¿Qué cultivos maneja?" options={CULTIVOS}
              selected={cultivosEmp} onSelectionChange={setCultivosEmp}
              allowCustom customLabel="+ Otro cultivo" />

            <ChipSelector label="¿Qué labores necesita?" options={LABORES}
              selected={labores} onSelectionChange={setLabores}
              allowCustom customLabel="+ Otra labor" />

            <Text style={styles.stepSubtitle}>Tipo de pago</Text>
            <ChipSelector options={TIPO_PAGO_OPTIONS.map(t => t.label)}
              selected={tipoPago ? [TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label] : []}
              onSelectionChange={(sel) => {
                const tp = TIPO_PAGO_OPTIONS.find(t => t.label === sel[sel.length - 1]);
                setTipoPago(tp?.value || '');
              }}
              multiSelect={false} allowCustom={false} />

            <View style={styles.beneficiosSection}>
              <View style={styles.beneficioRow}>
                <Text style={styles.beneficioLabel}>¿Ofrece alojamiento?</Text>
                <Switch value={!!ofreceAlojamiento} onValueChange={setOfreceAlojamiento}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlojamiento ? COLORS.primary : '#f4f3f4'} />
              </View>
              <View style={styles.beneficioRow}>
                <Text style={styles.beneficioLabel}>¿Ofrece alimentación?</Text>
                <Switch value={!!ofreceAlimentacion} onValueChange={setOfreceAlimentacion}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlimentacion ? COLORS.primary : '#f4f3f4'} />
              </View>
              <Input label="¿Qué más ofrece? (opcional)" value={beneficiosExtra}
                onChangeText={setBeneficiosExtra} placeholder="Ej: Transporte incluido"
                multiline numberOfLines={2} />
            </View>
          </View>
        );

      case 8:
        return (
          <View>
            <Text style={styles.stepTitle}>Resumen</Text>
            <View style={styles.summaryCard}>
              <SummaryRow label="Finca/Empresa" value={nombreEmpresa} />
              <SummaryRow label="Representante" value={nombre} />
              <SummaryRow label="Celular" value={celular} />
              <SummaryRow label="Ubicación" value={`${municipio}, ${departamento}`} />
              <SummaryRow label="Cultivos" value={cultivosEmp.join(', ') || 'N/A'} />
              <SummaryRow label="Labores" value={labores.join(', ') || 'N/A'} />
              <SummaryRow label="Pago" value={TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label || 'N/A'} />
              <SummaryRow label="Alojamiento" value={ofreceAlojamiento ? 'Sí' : 'No'} />
              <SummaryRow label="Alimentación" value={ofreceAlimentacion ? 'Sí' : 'No'} />
            </View>
          </View>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.formCard}>{renderStep()}</View>
        </ScrollView>
        <View style={styles.footer}>
          {step > 1 && <Button title="Anterior" onPress={prevStep} variant="outline" size="medium" style={{ flex: 1 }} />}
          {step < TOTAL_STEPS ? (
            <Button title="Siguiente" onPress={nextStep} size="medium"
              style={{ flex: step > 1 ? 1 : undefined, width: step === 1 ? '100%' : undefined }} />
          ) : (
            <Button title="Finalizar Registro" onPress={handleRegister} loading={loading} size="large" style={{ flex: 1 }} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}:</Text>
      <Text style={summaryStyles.value}>{value}</Text>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: 'row', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  label: { width: 110, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  value: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, padding: SPACING.md },
  formCard: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.medium },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  stepDesc: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  stepSubtitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  pickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.md, minHeight: 52, gap: SPACING.sm },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, padding: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.md, marginTop: SPACING.md },
  checkboxText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  smsContainer: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  smsText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  smsPhone: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  photoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md, gap: SPACING.md, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed' },
  photoBtnDone: { borderStyle: 'solid', borderColor: COLORS.success, backgroundColor: '#E8F5E9' },
  photoBtnText: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
  summaryCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md },
  beneficiosSection: { marginTop: SPACING.lg },
  beneficioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  beneficioLabel: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  footer: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.borderLight, ...SHADOWS.small },
});
