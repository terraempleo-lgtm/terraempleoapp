import React, { useState } from 'react';
import {
  View, Text, StyleSheet, SafeAreaView, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch
} from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, ProgressBar, PickerModal } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { CULTIVOS, LABORES, NIVELES_ESTUDIO, TITULOS_SUGERIDOS, EXPERIENCIA_OPTIONS, DISPONIBILIDAD_OPTIONS } from '../../data/options';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CamaraFoto from '../../components/CamaraFoto';

const TOTAL_STEPS = 9;
const STEP_LABELS = [
  'Datos personales', 'Ubicación', 'Cédula y datos legales', 'Verificación SMS',
  'Fotos de verificación', 'Nivel de estudios', 'Experiencia y habilidades',
  'Cultivos y disponibilidad', 'Resumen final'
];

export default function RegisterTrabajadorScreen({ navigation }) {
  const { signIn } = useAuth();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Datos personales
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Ubicación
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [vereda, setVereda] = useState('');
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  // Step 3: Cédula y legal
  const [cedula, setCedula] = useState('');
  const [aceptaHabeasData, setAceptaHabeasData] = useState(false);

  // Step 4: SMS
  const [codigoSMS, setCodigoSMS] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoDebug, setCodigoDebug] = useState('');

  // Step 5: Fotos reales
  const [fotoSelfie, setFotoSelfie] = useState(false);
  const [fotoCedula, setFotoCedula] = useState(false);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(false);

  // Step 6: Estudios
  const [nivelEstudios, setNivelEstudios] = useState('');
  const [tituloEstudio, setTituloEstudio] = useState('');
  const [showTituloPicker, setShowTituloPicker] = useState(false);

  // Step 7: Habilidades
  const [habilidades, setHabilidades] = useState([]);

  // Step 8: Cultivos y disponibilidad
  const [cultivos, setCultivos] = useState([]);
  const [experiencia, setExperiencia] = useState('');
  const [disponibilidad, setDisponibilidad] = useState('');

  const [errors, setErrors] = useState({});

  const validateStep = () => {
    const errs = {};
    switch (step) {
      case 1:
        if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
        if (!celular.trim()) errs.celular = 'El celular es obligatorio';
        if (celular.length < 7) errs.celular = 'Celular inválido';
        if (!password.trim()) errs.password = 'La contraseña es obligatoria';
        if (password.length < 6) errs.password = 'Mínimo 6 caracteres';
        if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
        break;
      case 2:
        if (!departamento) errs.departamento = 'Seleccione un departamento';
        if (!municipio) errs.municipio = 'Seleccione un municipio';
        break;
      case 3:
        if (!cedula.trim()) errs.cedula = 'La cédula es obligatoria';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar el tratamiento de datos';
        break;
      case 4:
        if (!codigoSMS.trim()) errs.codigo = 'Ingrese el código';
        break;
      case 5:
        if (!fotoSelfie) errs.selfie = 'La selfie es obligatoria';
        if (!fotoCedula) errs.cedFoto = 'La foto de cédula es obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'La foto con cédula es obligatoria';
        break;
      case 6:
        if (!nivelEstudios) errs.estudios = 'Seleccione su nivel de estudios';
        break;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep()) setStep(step + 1);
  };
  const prevStep = () => step > 1 && setStep(step - 1);

  const enviarCodigo = async () => {
    try {
      const res = await authAPI.enviarSMS(celular);
      setCodigoEnviado(true);
      setCodigoDebug(res.data.codigo_debug);
      Alert.alert('Código enviado', `Se envió un código de verificación a ${celular}\n\n(Debug: ${res.data.codigo_debug})`);
    } catch (err) {
      Alert.alert('Error', 'No se pudo enviar el código');
    }
  };

  const handleFotoGuardada = (tipo) => {
    if (tipo === 'selfie') setFotoSelfie(true);
    if (tipo === 'cedula') setFotoCedula(true);
    if (tipo === 'selfie_cedula') setFotoSelfieCedula(true);
  };

  const handleRegister = async () => {
    setLoading(true);
    try {
      const data = {
        rol: 'trabajador',
        nombre_completo: nombre,
        celular,
        correo: correo || undefined,
        password,
        cedula,
        departamento,
        municipio,
        vereda: vereda || undefined,
        acepta_habeas_data: true,
        nivel_estudios: nivelEstudios,
        titulo_estudio: tituloEstudio || undefined,
        anios_experiencia: experiencia || undefined,
        disponibilidad: disponibilidad || undefined,
        habilidades: habilidades.map(h => ({
          nombre: h,
          es_personalizada: !LABORES.includes(h),
        })),
        cultivos_trabajador: cultivos.map(c => ({
          nombre: c,
          es_personalizado: !CULTIVOS.includes(c),
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
            <Text style={styles.stepTitle}>Datos Personales</Text>
            <Text style={styles.stepDesc}>Cuéntanos quién eres</Text>
            <Input label="Nombre completo" value={nombre} onChangeText={setNombre}
              placeholder="Ej: Juan Pérez García" icon="person-outline" required error={errors.nombre} />
            <Input label="Celular" value={celular} onChangeText={setCelular}
              placeholder="Ej: 3001234567" keyboardType="phone-pad" icon="call-outline" required error={errors.celular} />
            <Input label="Correo electrónico (opcional)" value={correo} onChangeText={setCorreo}
              placeholder="correo@ejemplo.com" keyboardType="email-address" icon="mail-outline" />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Mínimo 6 caracteres" secureTextEntry icon="lock-closed-outline" required error={errors.password} />
            <Input label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña" secureTextEntry icon="lock-closed-outline" required error={errors.confirmPassword} />
          </View>
        );

      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>Ubicación</Text>
            <Text style={styles.stepDesc}>¿Dónde te encuentras?</Text>
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
            <Text style={styles.stepTitle}>Cédula y Datos Legales</Text>
            <Input label="Número de cédula" value={cedula} onChangeText={setCedula}
              placeholder="Ej: 1234567890" keyboardType="numeric" icon="card-outline" required error={errors.cedula} />

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

      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Verificación SMS</Text>
            <Text style={styles.stepDesc}>Verificaremos tu número de celular</Text>

            {!codigoEnviado ? (
              <View style={styles.smsContainer}>
                <Text style={styles.smsText}>Se enviará un código de 6 dígitos a:</Text>
                <Text style={styles.smsPhone}>{celular}</Text>
                <Button title="Enviar Código" onPress={enviarCodigo} size="large" />
              </View>
            ) : (
              <View>
                <Text style={styles.smsText}>Ingresa el código de 6 dígitos:</Text>
                {codigoDebug ? (
                  <Text style={[styles.smsText, { color: COLORS.info, fontWeight: '600' }]}>
                    (Código debug: {codigoDebug})
                  </Text>
                ) : null}
                <Input label="Código" value={codigoSMS} onChangeText={setCodigoSMS}
                  placeholder="000000" keyboardType="numeric" maxLength={6}
                  icon="key-outline" error={errors.codigo} />
                <Button title="Reenviar código" onPress={enviarCodigo} variant="outline" size="small"
                  style={{ marginTop: SPACING.sm }} />
              </View>
            )}
          </View>
        );

      case 5:
        return (
          <View>
            <Text style={styles.stepTitle}>Fotos de Verificación</Text>
            <Text style={styles.stepDesc}>Necesitamos verificar tu identidad</Text>

            <Text style={styles.fotoHint}>
              Solo puedes tomar la foto en el momento, no se permite subir desde galería.
            </Text>

            {/* Selfie */}
            <View style={[styles.fotoRow, fotoSelfie && styles.fotoRowDone]}>
              <View style={styles.fotoInfo}>
                <Ionicons
                  name={fotoSelfie ? 'checkmark-circle' : 'camera-outline'}
                  size={28}
                  color={fotoSelfie ? COLORS.success : COLORS.primary}
                />
                <View>
                  <Text style={styles.fotoLabel}>Selfie</Text>
                  <Text style={styles.fotoDesc}>Foto de tu cara</Text>
                </View>
              </View>
              {!fotoSelfie ? (
                <CamaraFoto tipo="selfie" label="Selfie" onFotoGuardada={handleFotoGuardada} />
              ) : (
                <Text style={styles.fotoOk}>✓ Guardada</Text>
              )}
            </View>
            {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}

            {/* Foto cedula */}
            <View style={[styles.fotoRow, fotoCedula && styles.fotoRowDone]}>
              <View style={styles.fotoInfo}>
                <Ionicons
                  name={fotoCedula ? 'checkmark-circle' : 'card-outline'}
                  size={28}
                  color={fotoCedula ? COLORS.success : COLORS.primary}
                />
                <View>
                  <Text style={styles.fotoLabel}>Foto de Cédula</Text>
                  <Text style={styles.fotoDesc}>Foto de tu documento</Text>
                </View>
              </View>
              {!fotoCedula ? (
                <CamaraFoto tipo="cedula" label="Foto de Cédula" onFotoGuardada={handleFotoGuardada} />
              ) : (
                <Text style={styles.fotoOk}>✓ Guardada</Text>
              )}
            </View>
            {errors.cedFoto && <Text style={styles.errorText}>{errors.cedFoto}</Text>}

            {/* Selfie con cedula */}
            <View style={[styles.fotoRow, fotoSelfieCedula && styles.fotoRowDone]}>
              <View style={styles.fotoInfo}>
                <Ionicons
                  name={fotoSelfieCedula ? 'checkmark-circle' : 'people-outline'}
                  size={28}
                  color={fotoSelfieCedula ? COLORS.success : COLORS.primary}
                />
                <View>
                  <Text style={styles.fotoLabel}>Selfie con Cédula</Text>
                  <Text style={styles.fotoDesc}>Tú sosteniendo tu cédula</Text>
                </View>
              </View>
              {!fotoSelfieCedula ? (
                <CamaraFoto tipo="selfie_cedula" label="Selfie con Cédula" onFotoGuardada={handleFotoGuardada} />
              ) : (
                <Text style={styles.fotoOk}>✓ Guardada</Text>
              )}
            </View>
            {errors.selfieCed && <Text style={styles.errorText}>{errors.selfieCed}</Text>}
          </View>
        );

      case 6:
        return (
          <View>
            <Text style={styles.stepTitle}>Nivel de Estudios</Text>
            <Text style={styles.stepDesc}>¿Cuál es tu formación?</Text>
            <ChipSelector
              options={NIVELES_ESTUDIO.map(n => n.label)}
              selected={nivelEstudios ? [NIVELES_ESTUDIO.find(n => n.value === nivelEstudios)?.label] : []}
              onSelectionChange={(sel) => {
                const nivel = NIVELES_ESTUDIO.find(n => n.label === sel[sel.length - 1]);
                setNivelEstudios(nivel?.value || '');
              }}
              multiSelect={false}
              allowCustom={false}
              error={errors.estudios}
            />
            {(nivelEstudios === 'tecnico_tecnologo' || nivelEstudios === 'universitario') && (
              <View style={{ marginTop: SPACING.md }}>
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
          </View>
        );

      case 7:
        return (
          <View>
            <Text style={styles.stepTitle}>Experiencia y Habilidades</Text>
            <Text style={styles.stepDesc}>¿Qué labores sabes hacer?</Text>
            <ChipSelector
              label="Labores / Habilidades"
              options={LABORES}
              selected={habilidades}
              onSelectionChange={setHabilidades}
              allowCustom={true}
              customLabel="+ Otra labor"
            />
          </View>
        );

      case 8:
        return (
          <View>
            <Text style={styles.stepTitle}>Cultivos y Disponibilidad</Text>

            <ChipSelector
              label="¿En qué cultivos has trabajado?"
              options={CULTIVOS}
              selected={cultivos}
              onSelectionChange={setCultivos}
              allowCustom={true}
              customLabel="+ Otro cultivo"
            />

            <Text style={[styles.stepSubtitle, { marginTop: SPACING.lg }]}>Años de experiencia</Text>
            <ChipSelector
              options={EXPERIENCIA_OPTIONS.map(e => e.label)}
              selected={experiencia ? [EXPERIENCIA_OPTIONS.find(e => e.value === experiencia)?.label] : []}
              onSelectionChange={(sel) => {
                const exp = EXPERIENCIA_OPTIONS.find(e => e.label === sel[sel.length - 1]);
                setExperiencia(exp?.value || '');
              }}
              multiSelect={false}
              allowCustom={false}
            />

            <Text style={[styles.stepSubtitle, { marginTop: SPACING.lg }]}>Disponibilidad</Text>
            <ChipSelector
              options={DISPONIBILIDAD_OPTIONS.map(d => d.label)}
              selected={disponibilidad ? [DISPONIBILIDAD_OPTIONS.find(d => d.value === disponibilidad)?.label] : []}
              onSelectionChange={(sel) => {
                const disp = DISPONIBILIDAD_OPTIONS.find(d => d.label === sel[sel.length - 1]);
                setDisponibilidad(disp?.value || '');
              }}
              multiSelect={false}
              allowCustom={false}
            />
          </View>
        );

      case 9:
        return (
          <View>
            <Text style={styles.stepTitle}>Resumen</Text>
            <Text style={styles.stepDesc}>Verifica que tus datos sean correctos</Text>

            <View style={styles.summaryCard}>
              <SummaryRow label="Nombre" value={nombre} />
              <SummaryRow label="Celular" value={celular} />
              {correo ? <SummaryRow label="Correo" value={correo} /> : null}
              <SummaryRow label="Ubicación" value={`${municipio}, ${departamento}`} />
              {vereda ? <SummaryRow label="Vereda" value={vereda} /> : null}
              <SummaryRow label="Cédula" value={cedula} />
              <SummaryRow label="Estudios" value={NIVELES_ESTUDIO.find(n => n.value === nivelEstudios)?.label || 'N/A'} />
              {tituloEstudio ? <SummaryRow label="Título" value={tituloEstudio} /> : null}
              <SummaryRow label="Habilidades" value={habilidades.join(', ') || 'N/A'} />
              <SummaryRow label="Cultivos" value={cultivos.join(', ') || 'N/A'} />
              <SummaryRow label="Experiencia" value={EXPERIENCIA_OPTIONS.find(e => e.value === experiencia)?.label || 'N/A'} />
              <SummaryRow label="Disponibilidad" value={DISPONIBILIDAD_OPTIONS.find(d => d.value === disponibilidad)?.label || 'N/A'} />
              <SummaryRow label="Fotos"
                value={`${fotoSelfie ? '✓' : '✗'} Selfie  ${fotoCedula ? '✓' : '✗'} Cédula  ${fotoSelfieCedula ? '✓' : '✗'} Selfie+Cédula`} />
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
          <View style={styles.formCard}>
            {renderStep()}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          {step > 1 && (
            <Button title="Anterior" onPress={prevStep} variant="outline" size="medium" style={{ flex: 1 }} />
          )}
          {step < TOTAL_STEPS ? (
            <Button title="Siguiente" onPress={nextStep} size="medium"
              style={{ flex: step > 1 ? 1 : undefined, width: step === 1 ? '100%' : undefined }} />
          ) : (
            <Button title="Finalizar Registro" onPress={handleRegister} loading={loading}
              size="large" style={{ flex: 1 }} />
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
  row: {
    flexDirection: 'row',
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  label: { width: 110, fontSize: 14, fontWeight: '600', color: COLORS.textSecondary },
  value: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { flexGrow: 1, padding: SPACING.md },
  formCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    padding: SPACING.lg, ...SHADOWS.medium,
  },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  stepDesc: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  stepSubtitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.md, minHeight: 52, gap: SPACING.sm,
  },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft,
    padding: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.md, marginTop: SPACING.md,
  },
  checkboxText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  smsContainer: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  smsText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  smsPhone: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  fotoHint: {
    fontSize: 13, color: COLORS.textLight, fontStyle: 'italic',
    marginBottom: SPACING.md, textAlign: 'center',
  },
  fotoRow: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.white,
  },
  fotoRowDone: {
    borderColor: COLORS.success, backgroundColor: '#E8F5E9',
  },
  fotoInfo: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm,
  },
  fotoLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  fotoDesc: { fontSize: 13, color: COLORS.textLight },
  fotoOk: { fontSize: 15, color: COLORS.success, fontWeight: '600', textAlign: 'center' },
  summaryCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md },
  footer: {
    flexDirection: 'row', padding: SPACING.md, gap: SPACING.md,
    backgroundColor: COLORS.white, borderTopWidth: 1,
    borderTopColor: COLORS.borderLight, ...SHADOWS.small,
  },
});