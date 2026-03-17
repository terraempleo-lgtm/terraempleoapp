import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Image,
  Linking, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { FadeInView } from '../../components/animated';
import { Button, Input, ChipSelector, ProgressBar, PickerModal, InfoBox, TerraFooter } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { authAPI, cognitoAPI, setAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CamaraFoto from '../../components/CamaraFoto';

const TOTAL_STEPS = 9;
const STEP_LABELS = [
  'Datos de finca', 'Ubicación', 'Datos de contacto', 'Cédula y datos legales',
  'Verificación SMS', 'Fotos de verificación', 'Cultivos y labores', 'Fotos de finca', 'Resumen final'
];

export default function RegisterEmpleadorScreen({ navigation }) {
  const { signIn } = useAuth();
  const isWeb = Platform.OS === 'web';
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
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Step 5: SMS (Cognito)
  const [codigoSMS, setCodigoSMS] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  

  // Step 6: Fotos
  const [fotoSelfie, setFotoSelfie] = useState(null);
  const [fotoCedula, setFotoCedula] = useState(null);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(null);

  // Step 8: Fotos de finca
  const [fotoFincaFachada, setFotoFincaFachada] = useState(null);

  // Step 7: Cultivos, labores, pago, beneficios
  const [cultivosEmp, setCultivosEmp] = useState([]);
  const [labores, setLabores] = useState([]);
  const [tipoPago, setTipoPago] = useState('');
  const [ofreceAlojamiento, setOfreceAlojamiento] = useState(false);
  const [ofreceAlimentacion, setOfreceAlimentacion] = useState(false);
  const [beneficiosExtra, setBeneficiosExtra] = useState('');

  const [errors, setErrors] = useState({});
  const scrollRef = useRef(null);

  // Scroll to top and clear errors when step changes
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
    setErrors({});
    Keyboard.dismiss();
  }, [step]);

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
        if (password.length < 8) errs.password = 'Mínimo 8 caracteres';
        if (password !== confirmPassword) errs.confirmPassword = 'No coinciden';
        break;
      case 4:
        if (!cedula.trim()) errs.cedula = 'La cédula es obligatoria';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar';
        if (!aceptaTerminos) errs.terminos = 'Debe aceptar los términos';
        break;
      // case 5: SMS verification disabled temporarily
      // if (!codigoSMS.trim()) errs.codigo = 'Ingrese el código';
      // break;
      case 6:
        if (!fotoSelfie) errs.selfie = 'Obligatoria';
        if (!fotoCedula) errs.cedFoto = 'Obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'Obligatoria';
        break;
      case 8:
        // En fotos de finca solo se exige la foto principal de fachada/entrada.
        if (!fotoFincaFachada) errs.fincaFachada = 'La foto de fachada o entrada es obligatoria';
        break;
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const verificarCodigo = async () => {
    if (!codigoSMS.trim()) {
      setErrors({ codigo: 'Ingrese el código' });
      return false;
    }
    try {
      await cognitoAPI.confirmRegister(celular, codigoSMS.trim());
      return true;
    } catch (err) {
      const msg = err.response?.data?.error || 'Código incorrecto';
      Alert.alert('Error', msg);
      return false;
    }
  };

  const nextStep = async () => {
    if (!validateStep()) return;
    // SMS verification disabled temporarily - skip step 5
    // if (step === 5) {
    //   setLoading(true);
    //   const ok = await verificarCodigo();
    //   setLoading(false);
    //   if (!ok) return;
    // }
    // Skip SMS step (5)
    if (step === 4) {
      setStep(6);
      return;
    }
    setStep(step + 1);
  };
  const prevStep = () => {
    if (step <= 1) return;
    // Skip SMS step (5) going back
    if (step === 6) {
      setStep(4);
      return;
    }
    setStep(step - 1);
  };

  const enviarCodigo = async () => {
    try {
      setLoading(true);
      if (!codigoEnviado) {
        // Primer envío: registrar en Cognito (dispara SMS automáticamente)
        try {
          await cognitoAPI.register(celular, password);
        } catch (regErr) {
          // Si ya existe en Cognito, reenviar código
          if (regErr.response?.status === 409) {
            await cognitoAPI.resendCode(celular);
          } else {
            throw regErr;
          }
        }
      } else {
        // Reenvío
        await cognitoAPI.resendCode(celular);
      }
      setCodigoEnviado(true);
      Alert.alert('Código enviado', `Se envió un código de verificación por SMS al ${celular}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'No se pudo enviar el código';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFotoGuardada = (tipo, uri) => {
    if (tipo === 'selfie') setFotoSelfie(uri);
    if (tipo === 'cedula') setFotoCedula(uri);
    if (tipo === 'selfie_cedula') setFotoSelfieCedula(uri);
    if (tipo === 'finca_fachada') setFotoFincaFachada(uri);
  };

  const getLabelCarga = (uri) => {
    if (isWeb) return uri ? 'Reemplazar foto' : 'Subir foto';
    return uri ? 'Tomar o subir de nuevo' : 'Tomar o subir';
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

      // Activar token para subir fotos a S3
      setAuthToken(token);
      const todasLasFotos = [
        { tipo: 'selfie', uri: fotoSelfie },
        { tipo: 'cedula', uri: fotoCedula },
        { tipo: 'selfie_cedula', uri: fotoSelfieCedula },
        { tipo: 'finca_fachada', uri: fotoFincaFachada },
      ].filter((foto) => foto.uri);

      let fotosSubidas = 0;
      for (const { tipo, uri } of todasLasFotos) {
        try {
          const formData = new FormData();
          if (Platform.OS === 'web') {
            const resp = await fetch(uri);
            const blob = await resp.blob();
            formData.append('foto', blob, `${tipo}_${Date.now()}.jpg`);
          } else {
            formData.append('foto', { uri, type: 'image/jpeg', name: `${tipo}_${Date.now()}.jpg` });
          }
          await authAPI.subirFoto(tipo, formData);
          fotosSubidas++;
        } catch (fotoErr) {
          console.error(`Error subiendo foto ${tipo}:`, fotoErr?.response?.data || fotoErr.message);
        }
      }

      // Sign in directly to redirect to home (Alert callback unreliable on web)
      await signIn(user, token);
    } catch (err) {
      console.error('Error registro:', err?.response?.status, err?.response?.data, err.message);
      let msg = 'Error al registrarse';
      if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.message?.includes('Network')) {
        msg = 'No se pudo conectar al servidor. Verifica tu conexión a internet.';
      } else if (err.message?.includes('timeout')) {
        msg = 'La solicitud tardó demasiado. Intenta de nuevo.';
      } else if (err.message) {
        msg = err.message;
      }
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
            <View style={styles.stepIconWrap}>
              <Ionicons name="home-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Datos de Finca / Empresa</Text>
            <Text style={styles.stepDesc}>¿Cómo se llama tu finca o empresa?</Text>
            <Input label="Nombre de la finca o empresa" value={nombreEmpresa}
              onChangeText={setNombreEmpresa} placeholder="Ej: Finca La Esperanza"
              icon="home-outline" required error={errors.empresa} />
            <InfoBox variant="info" text="El nombre de tu finca o empresa es lo primero que verán los trabajadores al explorar oportunidades de empleo." />
          </View>
        );

      case 2:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="location-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Ubicación</Text>
            <Text style={styles.stepDesc}>¿Dónde está ubicada la finca?</Text>

            <Text style={styles.fieldLabel}>Departamento *</Text>
            <TouchableOpacity style={styles.pickerButtonNew} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="map-outline" size={20} color={departamento ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Seleccione un departamento'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.departamento && <Text style={styles.errorText}>{errors.departamento}</Text>}

            <Text style={styles.fieldLabel}>Municipio *</Text>
            <TouchableOpacity
              style={[styles.pickerButtonNew, !departamento && styles.pickerDisabled]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
            >
              <Ionicons name="business-outline" size={20} color={municipio ? COLORS.primary : COLORS.textLight} />
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Seleccione un municipio'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Text style={styles.fieldLabel}>Vereda / Sector</Text>
            <Input value={vereda} onChangeText={setVereda}
              placeholder="Ej: Vereda La Linda" icon="trail-sign-outline" />

            {/* Imagen de ubicación - abre Google Maps */}
            <TouchableOpacity
              style={styles.mapImageWrap}
              activeOpacity={0.8}
              onPress={() => {
                const q = encodeURIComponent(`${municipio || ''}, ${departamento || ''}, Colombia`);
                Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${q}`);
              }}
            >
              <Image
                source={require('../../../assets/login.jpg')}
                style={styles.mapImage}
                resizeMode="cover"
              />
              <View style={styles.mapPin}>
                <Ionicons name="location" size={22} color={COLORS.white} />
              </View>
              {!!(municipio || departamento) && (
                <View style={styles.mapLabel}>
                  <Ionicons name="navigate-outline" size={12} color={COLORS.white} />
                  <Text style={styles.mapLabelText}>Ver en Google Maps</Text>
                </View>
              )}
            </TouchableOpacity>

            <InfoBox variant="info" text="Necesitamos tu ubicación exacta para conectar tu finca o negocio con trabajadores locales y optimizar la logística de pagos." />

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
            <View style={styles.stepIconWrap}>
              <Ionicons name="person-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Datos de Contacto</Text>
            <Text style={styles.stepDesc}>Información del representante de la finca o empresa</Text>
            <Input label="Nombre completo (representante)" value={nombre} onChangeText={setNombre}
              placeholder="Nombre del contacto" icon="person-outline" required error={errors.nombre} />
            <Input label="Celular" value={celular} onChangeText={setCelular}
              placeholder="3001234567" keyboardType="phone-pad" icon="call-outline" required error={errors.celular} />
            <Input label="Correo (opcional)" value={correo} onChangeText={setCorreo}
              placeholder="correo@ejemplo.com" keyboardType="email-address" icon="mail-outline" />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres" secureTextEntry icon="lock-closed-outline" required error={errors.password} />
            <Input label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña" secureTextEntry icon="lock-closed-outline" required error={errors.confirmPassword} />
            <InfoBox variant="info" text="Tus datos de contacto nos permiten comunicarnos contigo y gestionar tu cuenta de empleador de forma segura." />
          </View>
        );

      case 4:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Cédula y Datos Legales</Text>
            <Text style={styles.stepDesc}>Verificación de identidad del representante</Text>
            <Input label="Número de cédula" value={cedula} onChangeText={setCedula}
              placeholder="1234567890" keyboardType="numeric" icon="card-outline" required error={errors.cedula} />

            <Text style={styles.legalSectionTitle}>Consentimientos legales</Text>

            <View style={styles.legalCard}>
              <View style={styles.legalCardHeader}>
                <View style={styles.legalIconWrap}>
                  <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legalCardTitle}>Habeas Data</Text>
                  <Text style={styles.legalCardDesc}>Ley 1581 de 2012</Text>
                </View>
                <Switch value={!!aceptaHabeasData} onValueChange={setAceptaHabeasData}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={aceptaHabeasData ? COLORS.primary : '#f4f3f4'} />
              </View>
              <Text style={styles.legalCardText}>
                Autorizo el tratamiento de mis datos personales según la Ley 1581 de 2012
              </Text>
            </View>
            {errors.habeas && <Text style={styles.errorText}>{errors.habeas}</Text>}

            <View style={styles.legalCard}>
              <View style={styles.legalCardHeader}>
                <View style={styles.legalIconWrap}>
                  <Ionicons name="checkmark-done-outline" size={20} color={COLORS.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.legalCardTitle}>Términos y Condiciones</Text>
                  <Text style={styles.legalCardDesc}>Uso de la plataforma</Text>
                </View>
                <Switch value={!!aceptaTerminos} onValueChange={setAceptaTerminos}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={aceptaTerminos ? COLORS.primary : '#f4f3f4'} />
              </View>
              <Text style={styles.legalCardText}>
                Acepto los Términos y Condiciones de uso de la plataforma TerraEmpleo
              </Text>
            </View>
            {errors.terminos && <Text style={styles.errorText}>{errors.terminos}</Text>}

            <InfoBox variant="info" text="La verificación legal protege tu negocio y genera confianza en los trabajadores que aplican a tus vacantes." />
          </View>
        );

      case 5:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Verificación SMS</Text>
            <Text style={styles.stepDesc}>Confirmaremos que el número de celular es tuyo</Text>
            {!codigoEnviado ? (
              <View style={styles.smsContainer}>
                <View style={styles.smsIconCircle}>
                  <Ionicons name="phone-portrait-outline" size={36} color={COLORS.primary} />
                </View>
                <Text style={styles.smsText}>Se enviará un código de 6 dígitos a:</Text>
                <Text style={styles.smsPhone}>{celular}</Text>
                <Button
                  title="Enviar Código"
                  onPress={enviarCodigo}
                  icon={<Ionicons name="send-outline" size={16} color={COLORS.white} />}
                />
              </View>
            ) : (
              <View>
                <Text style={styles.smsText}>Ingresa el código de 6 dígitos:</Text>
                <Input label="Código" value={codigoSMS} onChangeText={setCodigoSMS}
                  placeholder="Ingresa el código" keyboardType="numeric" maxLength={6}
                  icon="key-outline" error={errors.codigo} />
                <Button
                  title="Reenviar código"
                  onPress={enviarCodigo}
                  variant="ghost"
                  size="small"
                  icon={<Ionicons name="refresh-outline" size={16} color={COLORS.primary} />}
                  style={{ alignSelf: 'center' }}
                />
              </View>
            )}
            <InfoBox variant="info" text="La verificación por SMS garantiza que eres el único con acceso a tu cuenta de empleador." />
          </View>
        );

      case 6:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Fotos de Verificación</Text>
            <Text style={styles.stepDesc}>Necesitamos verificar tu identidad como empleador</Text>

            <View style={[styles.fotoCard, fotoSelfie && styles.fotoCardDone]}>
              <View style={styles.fotoCardRow}>
                <View style={[styles.fotoIconCircle, fotoSelfie && { backgroundColor: COLORS.primaryMuted }]}>
                  <Ionicons
                    name={fotoSelfie ? 'checkmark-circle' : 'camera-outline'}
                    size={28}
                    color={fotoSelfie ? COLORS.primary : COLORS.textLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fotoCardTitle}>Selfie del empleador</Text>
                  <Text style={styles.fotoCardDesc}>Foto frontal de tu rostro</Text>
                </View>
                <Text style={[styles.estadoFotoText, fotoSelfie && styles.estadoFotoOk]}>{fotoSelfie ? 'Cargada' : 'Pendiente'}</Text>
              </View>
              {fotoSelfie ? (
                <Image source={{ uri: fotoSelfie }} style={styles.fotoPreview} />
              ) : null}
              <CamaraFoto tipo="selfie" label={getLabelCarga(fotoSelfie)} onFotoGuardada={handleFotoGuardada} modoLocal={true} permitirGaleria={true} />
            </View>
            {errors.selfie && <Text style={styles.errorTextFoto}>{errors.selfie}</Text>}

            <View style={[styles.fotoCard, fotoCedula && styles.fotoCardDone]}>
              <View style={styles.fotoCardRow}>
                <View style={[styles.fotoIconCircle, fotoCedula && { backgroundColor: COLORS.primaryMuted }]}>
                  <Ionicons
                    name={fotoCedula ? 'checkmark-circle' : 'card-outline'}
                    size={28}
                    color={fotoCedula ? COLORS.primary : COLORS.textLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fotoCardTitle}>Foto de la cédula</Text>
                  <Text style={styles.fotoCardDesc}>Frente de tu documento de identidad</Text>
                </View>
                <Text style={[styles.estadoFotoText, fotoCedula && styles.estadoFotoOk]}>{fotoCedula ? 'Cargada' : 'Pendiente'}</Text>
              </View>
              {fotoCedula ? (
                <Image source={{ uri: fotoCedula }} style={styles.fotoPreview} />
              ) : null}
              <CamaraFoto tipo="cedula" label={getLabelCarga(fotoCedula)} onFotoGuardada={handleFotoGuardada} modoLocal={true} permitirGaleria={true} />
            </View>
            {errors.cedFoto && <Text style={styles.errorTextFoto}>{errors.cedFoto}</Text>}

            <View style={[styles.fotoCard, fotoSelfieCedula && styles.fotoCardDone]}>
              <View style={styles.fotoCardRow}>
                <View style={[styles.fotoIconCircle, fotoSelfieCedula && { backgroundColor: COLORS.primaryMuted }]}>
                  <Ionicons
                    name={fotoSelfieCedula ? 'checkmark-circle' : 'people-outline'}
                    size={28}
                    color={fotoSelfieCedula ? COLORS.primary : COLORS.textLight}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fotoCardTitle}>Selfie con cédula</Text>
                  <Text style={styles.fotoCardDesc}>Tu rostro junto a tu documento</Text>
                </View>
                <Text style={[styles.estadoFotoText, fotoSelfieCedula && styles.estadoFotoOk]}>{fotoSelfieCedula ? 'Cargada' : 'Pendiente'}</Text>
              </View>
              {fotoSelfieCedula ? (
                <Image source={{ uri: fotoSelfieCedula }} style={styles.fotoPreview} />
              ) : null}
              <CamaraFoto tipo="selfie_cedula" label={getLabelCarga(fotoSelfieCedula)} onFotoGuardada={handleFotoGuardada} modoLocal={true} permitirGaleria={true} />
            </View>
            {errors.selfieCed && <Text style={styles.errorTextFoto}>{errors.selfieCed}</Text>}

            <InfoBox variant="info" text="Las fotos verifican tu identidad y aumentan la credibilidad de tu empresa ante los trabajadores." />
          </View>
        );

      case 7:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="leaf-outline" size={32} color={COLORS.primary} />
            </View>
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

            <Text style={styles.stepSubtitle}>Beneficios adicionales</Text>
            <View style={styles.beneficiosCard}>
              <View style={styles.beneficioRow}>
                <View style={styles.beneficioLeft}>
                  <View style={styles.beneficioIconWrap}>
                    <Ionicons name="bed-outline" size={20} color={ofreceAlojamiento ? COLORS.primary : COLORS.textLight} />
                  </View>
                  <Text style={styles.beneficioLabel}>¿Ofrece alojamiento?</Text>
                </View>
                <Switch value={!!ofreceAlojamiento} onValueChange={setOfreceAlojamiento}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlojamiento ? COLORS.primary : '#f4f3f4'} />
              </View>
              <View style={styles.beneficioDivider} />
              <View style={styles.beneficioRow}>
                <View style={styles.beneficioLeft}>
                  <View style={styles.beneficioIconWrap}>
                    <Ionicons name="restaurant-outline" size={20} color={ofreceAlimentacion ? COLORS.primary : COLORS.textLight} />
                  </View>
                  <Text style={styles.beneficioLabel}>¿Ofrece alimentación?</Text>
                </View>
                <Switch value={!!ofreceAlimentacion} onValueChange={setOfreceAlimentacion}
                  trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlimentacion ? COLORS.primary : '#f4f3f4'} />
              </View>
            </View>
            <Input label="¿Qué más ofrece? (opcional)" value={beneficiosExtra}
              onChangeText={setBeneficiosExtra} placeholder="Ej: Transporte incluido"
              multiline numberOfLines={2} icon="gift-outline" />
            <InfoBox variant="info" text="Definir tus cultivos y labores nos permite mostrar tus vacantes a los trabajadores más capacitados." />
          </View>
        );

      case 8:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="image-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Foto de la finca</Text>
            <Text style={styles.stepDesc}>Sube una foto principal de tu finca o negocio para generar más confianza en los trabajadores.</Text>

            <View style={[styles.fincaSimpleCard, fotoFincaFachada && styles.fincaSimpleCardDone]}>
              <View style={styles.fincaSimpleHeader}>
                <View>
                  <Text style={styles.fincaSimpleLabel}>Foto principal de la finca *</Text>
                  <Text style={styles.fincaSimpleEstado}>{fotoFincaFachada ? 'Estado: Cargada' : 'Estado: Pendiente'}</Text>
                </View>
                <Ionicons
                  name={fotoFincaFachada ? 'checkmark-circle' : 'alert-circle-outline'}
                  size={22}
                  color={fotoFincaFachada ? COLORS.primary : COLORS.textLight}
                />
              </View>

              {fotoFincaFachada ? (
                <Image source={{ uri: fotoFincaFachada }} style={styles.fincaSimplePreview} />
              ) : (
                <View style={styles.fincaSimplePlaceholder}>
                  <Ionicons name="home-outline" size={44} color={COLORS.textLight} />
                  <Text style={styles.fincaSimplePlaceholderText}>Sin foto cargada</Text>
                </View>
              )}

              <CamaraFoto
                tipo="finca_fachada"
                label={getLabelCarga(fotoFincaFachada)}
                onFotoGuardada={handleFotoGuardada}
                modoLocal={true}
                permitirGaleria={true}
              />
            </View>
            {errors.fincaFachada && <Text style={styles.errorTextFoto}>{errors.fincaFachada}</Text>}
            <InfoBox variant="info" text="Esta foto es obligatoria para continuar el registro." />
          </View>
        );

      case 9:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="document-text-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Resumen de tu Perfil</Text>
            <Text style={styles.stepDesc}>Revisa que toda la información de tu empresa sea correcta.</Text>

            {/* Identity hero */}
            <View style={styles.summaryHero}>
              <View style={styles.summaryAvatarWrap}>
                {fotoSelfie ? (
                  <Image source={{ uri: fotoSelfie }} style={styles.summaryAvatar} />
                ) : (
                  <View style={[styles.summaryAvatar, styles.summaryAvatarPlaceholder]}>
                    <Ionicons name="camera-outline" size={48} color={COLORS.textLight} />
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
              <View style={styles.summaryVerifiedRow}>
                <Ionicons name="home" size={14} color={COLORS.primary} />
                <Text style={styles.summaryVerifiedText}>
                  Finca {fotoFincaFachada ? 'lista' : 'pendiente'}
                </Text>
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
              {vereda ? <View style={styles.summaryDivider} /> : null}
              {vereda ? <SummaryCard icon="trail-sign-outline" label="VEREDA" value={vereda} /> : null}
            </View>

            <Text style={styles.summaryGroupLabel}>CONTACTO PRINCIPAL</Text>
            <View style={styles.summaryGroup}>
              <SummaryCard icon="call-outline" label="CELULAR" value={celular} />
              {correo ? <View style={styles.summaryDivider} /> : null}
              {correo ? <SummaryCard icon="mail-outline" label="CORREO" value={correo} /> : null}
            </View>

            {(cultivosEmp.length > 0 || labores.length > 0 || tipoPago) ? (
              <View>
                <Text style={styles.summaryGroupLabel}>OFERTA LABORAL</Text>
                <View style={styles.summaryGroup}>
                  {tipoPago ? (
                    <SummaryCard
                      icon="cash-outline"
                      label="TIPO DE PAGO"
                      value={TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label || tipoPago}
                    />
                  ) : null}
                  {tipoPago && (cultivosEmp.length > 0 || labores.length > 0) ? (
                    <View style={styles.summaryDivider} />
                  ) : null}
                  {cultivosEmp.length > 0 ? (
                    <SummaryCard icon="leaf-outline" label="CULTIVOS" value={cultivosEmp.join(' · ')} />
                  ) : null}
                  {cultivosEmp.length > 0 && labores.length > 0 ? (
                    <View style={styles.summaryDivider} />
                  ) : null}
                  {labores.length > 0 ? (
                    <SummaryCard icon="construct-outline" label="LABORES" value={labores.join(' · ')} />
                  ) : null}
                </View>
              </View>
            ) : null}

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
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={isWeb ? 'none' : 'on-drag'}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formCard}>
            <FadeInView key={`step-${step}`} delay={50} translateY={10} duration={ANIMATION.duration.normal}>
              {renderStep()}
            </FadeInView>
          </View>

          <View style={{ flex: 1 }} />

          <View style={styles.footerInScroll}>
            <View style={styles.footer}>
              {step > 1 && (
                <View style={{ flex: 1 }}>
                  <Button title="Anterior" onPress={prevStep} variant="outline" size="medium" icon="arrow-back" />
                </View>
              )}
              <View style={{ flex: 1 }}>
                {step < TOTAL_STEPS ? (
                  <Button title="Siguiente" onPress={nextStep} size="medium" loading={loading} iconRight="arrow-forward" />
                ) : (
                  <Button title="Finalizar Registro" onPress={handleRegister} loading={loading} size="medium" icon="checkmark-circle" />
                )}
              </View>
            </View>
            <TerraFooter />
          </View>
        </ScrollView>
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
  scrollContent: { flexGrow: 1, paddingBottom: Platform.OS === 'android' ? 20 : 0 },
  formCard: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  footerInScroll: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
  },
  stepIconWrap: {
    width: 56, height: 56, borderRadius: 16,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  stepTitle: { fontSize: 26, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  stepDesc: { fontSize: 15, color: COLORS.textSecondary, marginBottom: SPACING.lg, lineHeight: 22 },
  stepSubtitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm, marginTop: SPACING.lg },
  legalSectionTitle: {
    fontSize: 17, fontWeight: '700', color: COLORS.textPrimary,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  pickerButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB', borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, marginBottom: SPACING.md, minHeight: 54, gap: SPACING.sm },
  pickerButtonNew: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.sm, minHeight: 54, gap: SPACING.sm,
  },
  pickerButtonClean: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.xs, minHeight: 54,
  },
  fieldLabel: {
    fontSize: 14, fontWeight: '700', color: COLORS.textPrimary,
    marginBottom: SPACING.xs, marginTop: SPACING.sm,
  },
  mapImageWrap: {
    borderRadius: RADIUS.lg, overflow: 'hidden',
    marginTop: SPACING.md, marginBottom: SPACING.md, height: 160,
    position: 'relative', ...SHADOWS.small,
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
  mapLabel: {
    position: 'absolute', bottom: 8, right: 8,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(46,125,50,0.85)', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: RADIUS.full,
  },
  mapLabelText: { fontSize: 11, fontWeight: '600', color: COLORS.white },
  pickerDisabled: { opacity: 0.5 },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft, padding: SPACING.md, borderRadius: RADIUS.lg, gap: SPACING.md, marginTop: SPACING.md },
  checkboxText: { flex: 1, fontSize: 14, color: COLORS.textPrimary, lineHeight: 20 },
  legalCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md,
    marginTop: SPACING.md, borderWidth: 1.5, borderColor: COLORS.borderLight,
  },
  legalCardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm,
  },
  legalIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  legalCardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  legalCardDesc: { fontSize: 12, color: COLORS.textLight },
  legalCardText: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  smsContainer: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  smsIconCircle: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  smsText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  smsPhone: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  fotoCard: {
    borderRadius: RADIUS.lg, padding: SPACING.md,
    marginBottom: SPACING.md, backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, ...SHADOWS.small,
  },
  fotoCardDone: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryMuted },
  fotoCardRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md },
  fotoIconCircle: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#F3F4F6', justifyContent: 'center', alignItems: 'center',
  },
  fotoCardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  fotoCardDesc: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  fotoPreview: {
    width: '100%',
    height: 150,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  fotoOkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: COLORS.primary, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  fotoOkText: { fontSize: 11, fontWeight: '700', color: COLORS.white },
  estadoFotoText: { fontSize: 12, fontWeight: '700', color: COLORS.textLight },
  estadoFotoOk: { color: COLORS.primary },
  errorTextFoto: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm, marginLeft: SPACING.xs },
  fincaSimpleCard: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    marginBottom: SPACING.md,
    padding: SPACING.md,
    ...SHADOWS.small,
  },
  fincaSimpleCardDone: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryMuted,
  },
  fincaSimpleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  fincaSimpleLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  fincaSimpleEstado: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  fincaSimplePreview: {
    width: '100%',
    height: 190,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  fincaSimplePlaceholder: {
    width: '100%',
    height: 190,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FAFC',
    marginBottom: SPACING.sm,
  },
  fincaSimplePlaceholderText: {
    fontSize: 13,
    color: COLORS.textLight,
    marginTop: SPACING.sm,
  },
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
  beneficiosCard: {
    backgroundColor: COLORS.white, borderRadius: RADIUS.lg,
    borderWidth: 1.5, borderColor: COLORS.borderLight,
    overflow: 'hidden', marginBottom: SPACING.md,
  },
  beneficioRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingVertical: SPACING.md, paddingHorizontal: SPACING.md,
  },
  beneficioLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  beneficioIconWrap: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  beneficioDivider: { height: 1, backgroundColor: COLORS.borderLight, marginLeft: 60 },
  beneficioLabel: { fontSize: 15, color: COLORS.textPrimary, fontWeight: '500' },
  footer: {
    flexDirection: 'row',
    paddingVertical: SPACING.md,
    gap: SPACING.md,
    alignItems: 'center',
  },
});
