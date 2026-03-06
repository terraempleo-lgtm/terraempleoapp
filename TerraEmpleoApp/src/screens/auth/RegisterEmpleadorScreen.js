import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, ProgressBar, PickerModal } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';

function WhyImportant({ text }) {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoIconWrap}>
        <Ionicons name="information-circle" size={18} color={COLORS.white} />
      </View>
      <Text style={styles.infoText}>{text}</Text>
    </View>
  );
}

function TerraEmpleoFooter() {
  return (
    <View style={styles.terraFooter}>
      <View style={styles.terraFooterIcon}>
        <Ionicons name="leaf" size={13} color="#9E9E9E" />
      </View>
      <Text style={styles.terraFooterText}>TerraEmpleo</Text>
    </View>
  );
}

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
  const [fotoSelfie, setFotoSelfie] = useState(null);
  const [fotoCedula, setFotoCedula] = useState(null);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(null);

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
    if (tipo === 'selfie') setFotoSelfie('mock');
    if (tipo === 'cédula') setFotoCedula('mock');
    if (tipo === 'selfie con cédula') setFotoSelfieCedula('mock');
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
            <WhyImportant text="El nombre de tu finca o empresa es lo primero que verán los trabajadores al explorar oportunidades de empleo." />
          </View>
        );

      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>Ubicación</Text>
            <Text style={styles.stepDesc}>¿Dónde está ubicada la finca?</Text>

            <Text style={styles.fieldLabel}>Departamento</Text>
            <TouchableOpacity style={styles.pickerButtonClean} onPress={() => setShowDeptPicker(true)}>
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Seleccione un departamento'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.departamento && <Text style={styles.errorText}>{errors.departamento}</Text>}

            <Text style={styles.fieldLabel}>Municipio</Text>
            <TouchableOpacity
              style={[styles.pickerButtonClean, !departamento && styles.pickerDisabled]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
            >
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Seleccione un municipio'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Text style={styles.fieldLabel}>Vereda / Sector</Text>
            <Input value={vereda} onChangeText={setVereda}
              placeholder="Ej: Vereda La Linda" icon="trail-sign-outline" />

            {/* Imagen decorativa con pin */}
            <View style={styles.mapImageWrap}>
              <Image
                source={require('../../../assets/login.jpg')}
                style={styles.mapImage}
                resizeMode="cover"
              />
              <View style={styles.mapPin}>
                <Ionicons name="location" size={22} color={COLORS.white} />
              </View>
            </View>

            <WhyImportant text="Necesitamos tu ubicación exacta para conectar tu finca o negocio con trabajadores locales y optimizar la logística de pagos." />

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
            <Text style={styles.stepDesc}>Información del representante de la finca o empresa</Text>
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
            <WhyImportant text="Tus datos de contacto nos permiten comunicarnos contigo y gestionar tu cuenta de empleador de forma segura." />
          </View>
        );

      case 4:
        return (
          <View>
            <Text style={styles.stepTitle}>Cédula y Datos Legales</Text>
            <Text style={styles.stepDesc}>Verificación de identidad del representante</Text>
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
            <WhyImportant text="La verificación legal protege tu negocio y genera confianza en los trabajadores que aplican a tus vacantes." />
          </View>
        );

      case 5:
        return (
          <View>
            <Text style={styles.stepTitle}>Verificación SMS</Text>
            <Text style={styles.stepDesc}>Confirmaremos que el número de celular es tuyo</Text>
            {!codigoEnviado ? (
              <View style={styles.smsContainer}>
                <Text style={styles.smsText}>Se enviará un código de 6 dígitos a:</Text>
                <Text style={styles.smsPhone}>{celular}</Text>
                <Button title="Enviar Código" onPress={enviarCodigo} />
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
                <Button title="Reenviar" onPress={enviarCodigo} variant="outline" size="small" />
              </View>
            )}
            <WhyImportant text="La verificación por SMS garantiza que eres el único con acceso a tu cuenta de empleador." />
          </View>
        );

      case 6:
        return (
          <View>
            <Text style={styles.stepTitle}>Fotos de Verificación</Text>
            <Text style={styles.stepDesc}>Necesitamos verificar tu identidad como empleador</Text>
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
            <WhyImportant text="Las fotos verifican tu identidad y aumentan la credibilidad de tu empresa ante los trabajadores." />
          </View>
        );

      case 7:
        return (
          <View>
            <Text style={styles.stepTitle}>Cultivos, Labores y Pago</Text>
            <Text style={styles.stepDesc}>Define qué buscas en los trabajadores que contratarás.</Text>

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
            <WhyImportant text="Definir tus cultivos y labores nos permite mostrar tus vacantes a los trabajadores más capacitados." />
          </View>
        );

      case 8:
        return (
          <View>
            {/* Identity hero */}
            <View style={styles.summaryHero}>
              <View style={styles.summaryAvatarWrap}>
                {fotoSelfie && fotoSelfie !== 'mock' ? (
                  <Image source={{ uri: fotoSelfie }} style={styles.summaryAvatar} />
                ) : (
                  <View style={[styles.summaryAvatar, styles.summaryAvatarPlaceholder]}>
                    <Ionicons
                      name={fotoSelfie === 'mock' ? 'person' : 'camera-outline'}
                      size={48}
                      color={fotoSelfie === 'mock' ? COLORS.primaryLight : COLORS.textLight}
                    />
                  </View>
                )}
                {fotoSelfie && (
                  <View style={styles.summaryVerifiedBadge}>
                    <Ionicons name="checkmark" size={14} color={COLORS.white} />
                  </View>
                )}
              </View>
              <Text style={styles.summaryHeroName}>{nombre}</Text>
              <Text style={styles.summaryHeroSub}>{nombreEmpresa}</Text>
              <View style={styles.summaryVerifiedRow}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
                <Text style={styles.summaryVerifiedText}>Empleador verificado</Text>
              </View>
            </View>

            <Text style={styles.summaryGroupLabel}>NOMBRE DE EMPRESA</Text>
            <View style={styles.summaryGroup}>
              <SummaryCard icon="business-outline" label="FINCA / EMPRESA" value={nombreEmpresa} />
              <View style={styles.summaryDivider} />
              <SummaryCard icon="person-outline" label="REPRESENTANTE" value={nombre} />
            </View>

            <Text style={styles.summaryGroupLabel}>UBICACIÓN</Text>
            <View style={styles.summaryGroup}>
              <SummaryCard
                icon="location-outline"
                label="MUNICIPIO Y DEPARTAMENTO"
                value={`${municipio}, ${departamento}`}
              />
              {vereda ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryCard icon="trail-sign-outline" label="VEREDA" value={vereda} />
                </>
              ) : null}
            </View>

            <Text style={styles.summaryGroupLabel}>CONTACTO PRINCIPAL</Text>
            <View style={styles.summaryGroup}>
              <SummaryCard icon="call-outline" label="CELULAR" value={celular} />
              {correo ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryCard icon="mail-outline" label="CORREO" value={correo} />
                </>
              ) : null}
            </View>

            {(cultivosEmp.length > 0 || labores.length > 0 || tipoPago) && (
              <>
                <Text style={styles.summaryGroupLabel}>OFERTA LABORAL</Text>
                <View style={styles.summaryGroup}>
                  {tipoPago ? (
                    <SummaryCard
                      icon="cash-outline"
                      label="TIPO DE PAGO"
                      value={TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label || tipoPago}
                    />
                  ) : null}
                  {tipoPago && (cultivosEmp.length > 0 || labores.length > 0) && (
                    <View style={styles.summaryDivider} />
                  )}
                  {cultivosEmp.length > 0 ? (
                    <SummaryCard icon="leaf-outline" label="CULTIVOS" value={cultivosEmp.join(' · ')} />
                  ) : null}
                  {cultivosEmp.length > 0 && labores.length > 0 && (
                    <View style={styles.summaryDivider} />
                  )}
                  {labores.length > 0 ? (
                    <SummaryCard icon="construct-outline" label="LABORES" value={labores.join(' · ')} />
                  ) : null}
                </View>
              </>
            )}

            <View style={styles.summaryFotosRow}>
              <View style={[styles.summaryFotoChip, fotoCedula && styles.summaryFotoChipDone]}>
                <Ionicons name={fotoCedula ? 'checkmark-circle' : 'close-circle'} size={15}
                  color={fotoCedula ? COLORS.primary : COLORS.textLight} />
                <Text style={[styles.summaryFotoChipText, fotoCedula && styles.summaryFotoChipTextDone]}>
                  Cédula
                </Text>
              </View>
              <View style={[styles.summaryFotoChip, fotoSelfieCedula && styles.summaryFotoChipDone]}>
                <Ionicons name={fotoSelfieCedula ? 'checkmark-circle' : 'close-circle'} size={15}
                  color={fotoSelfieCedula ? COLORS.primary : COLORS.textLight} />
                <Text style={[styles.summaryFotoChipText, fotoSelfieCedula && styles.summaryFotoChipTextDone]}>
                  Selfie+Cédula
                </Text>
              </View>
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
        <View style={styles.footerWrap}>
          <View style={styles.footer}>
            {step > 1 && <Button title="Anterior" onPress={prevStep} variant="outline" size="medium" style={{ flex: 1 }} />}
            {step < TOTAL_STEPS ? (
              <Button title="Siguiente" onPress={nextStep} size="medium"
                style={{ flex: step > 1 ? 1 : undefined, width: step === 1 ? '100%' : undefined }} />
            ) : (
              <Button title="Finalizar Registro" onPress={handleRegister} loading={loading} size="large" style={{ flex: 1 }} />
            )}
          </View>
          <TerraEmpleoFooter />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryCard({ icon, label, value }) {
  return (
    <View style={summaryStyles.row}>
      <View style={summaryStyles.iconWrap}>
        <Ionicons name={icon} size={18} color={COLORS.primary} />
      </View>
      <View style={summaryStyles.textWrap}>
        <Text style={summaryStyles.label}>{label}</Text>
        <Text style={summaryStyles.value}>{value}</Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: SPACING.md, gap: SPACING.md },
  iconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  textWrap: { flex: 1 },
  label: { fontSize: 10, fontWeight: '700', color: COLORS.textLight, letterSpacing: 0.5 },
  value: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary, marginTop: 2 },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scrollContent: { flexGrow: 1 },
  formCard: { paddingHorizontal: SPACING.md, paddingBottom: SPACING.md },
  stepTitle: { fontSize: 24, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  stepDesc: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.lg },
  stepSubtitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  pickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.md, minHeight: 52, gap: SPACING.sm },
  pickerButtonClean: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.xs, minHeight: 52,
  },
  fieldLabel: {
    fontSize: 14, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.xs, marginTop: SPACING.sm,
  },
  mapImageWrap: {
    borderRadius: RADIUS.lg, overflow: 'hidden',
    marginTop: SPACING.md, height: 160, position: 'relative',
  },
  mapImage: { width: '100%', height: '100%' },
  mapPin: {
    position: 'absolute', top: '50%', left: '50%',
    marginTop: -20, marginLeft: -20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    ...SHADOWS.medium,
  },
  infoCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md, padding: SPACING.md,
    marginTop: SPACING.md, gap: SPACING.sm,
  },
  infoIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    flexShrink: 0, marginTop: 2,
  },
  infoCardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  infoText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, padding: SPACING.md, borderRadius: RADIUS.md, gap: SPACING.md, marginTop: SPACING.md },
  checkboxText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  smsContainer: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  smsText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  smsPhone: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  photoBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.lg, marginBottom: SPACING.md, gap: SPACING.md, borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed' },
  photoBtnDone: { borderStyle: 'solid', borderColor: COLORS.success, backgroundColor: '#e6f7ee' },
  photoBtnText: { fontSize: 17, fontWeight: '600', color: COLORS.textPrimary },
  summaryCard: { backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.md, padding: SPACING.md },

  /* Summary redesign */
  summaryHero: {
    alignItems: 'center', paddingVertical: SPACING.lg,
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  summaryAvatarWrap: { position: 'relative', marginBottom: SPACING.sm },
  summaryAvatar: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: COLORS.primary,
  },
  summaryAvatarPlaceholder: {
    backgroundColor: COLORS.white,
    justifyContent: 'center', alignItems: 'center',
  },
  summaryVerifiedBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  summaryHeroName: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  summaryHeroSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  summaryVerifiedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  summaryVerifiedText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },
  summaryGroupLabel: {
    fontSize: 11, fontWeight: '700', color: COLORS.textLight,
    letterSpacing: 0.8, marginBottom: SPACING.xs, marginTop: SPACING.md,
    marginLeft: SPACING.xs,
  },
  summaryGroup: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    overflow: 'hidden', ...SHADOWS.small,
  },
  summaryDivider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 64 },
  summaryFotosRow: {
    flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, justifyContent: 'center',
  },
  summaryFotoChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  summaryFotoChipDone: { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft },
  summaryFotoChipText: { fontSize: 13, color: COLORS.textLight, fontWeight: '600' },
  summaryFotoChipTextDone: { color: COLORS.primary },
  beneficiosSection: { marginTop: SPACING.lg },
  beneficioRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: SPACING.sm },
  beneficioLabel: { fontSize: 16, color: COLORS.textPrimary, fontWeight: '500' },
  footerWrap: {
    backgroundColor: COLORS.white, borderTopWidth: 1,
    borderTopColor: COLORS.borderLight, ...SHADOWS.small,
  },
  footer: { flexDirection: 'row', padding: SPACING.md, gap: SPACING.md, backgroundColor: COLORS.white },
  terraFooter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingBottom: SPACING.sm,
  },
  terraFooterIcon: {
    width: 22, height: 22, borderRadius: 6,
    backgroundColor: '#E0E0E0', justifyContent: 'center', alignItems: 'center',
  },
  terraFooterText: {
    fontSize: 12, color: '#9E9E9E', fontWeight: '600', letterSpacing: 0.3,
  },
});
