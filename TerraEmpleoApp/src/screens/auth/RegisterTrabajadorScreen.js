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
import { CULTIVOS, LABORES, NIVELES_ESTUDIO, TITULOS_SUGERIDOS, EXPERIENCIA_OPTIONS, DISPONIBILIDAD_OPTIONS } from '../../data/options';
import { authAPI, cognitoAPI, setAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CamaraFoto from '../../components/CamaraFoto';
import { showAlert } from '../../utils/alertService';

const TOTAL_STEPS = 9;
const STEP_LABELS = [
  'Datos personales', 'Ubicación', 'Cédula y datos legales', 'Nivel de estudios',
  'Experiencia y habilidades', 'Cultivos y disponibilidad', 'Verificación SMS',
  'Fotos de verificación', 'Resumen final'
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
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Step 7: SMS (Cognito)
  const [codigoSMS, setCodigoSMS] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);

  // Step 8: Fotos (guardadas localmente hasta después del registro)
  const [fotoSelfie, setFotoSelfie] = useState(null);
  const [fotoCedula, setFotoCedula] = useState(null);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(null);

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
        if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
        if (!celular.trim()) errs.celular = 'El celular es obligatorio';
        if (celular.length < 7) errs.celular = 'Celular inválido';
        if (!password.trim()) errs.password = 'La contraseña es obligatoria';
        if (password.length < 8) errs.password = 'Mínimo 8 caracteres';
        if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
        break;
      case 2:
        if (!departamento) errs.departamento = 'Seleccione un departamento';
        if (!municipio) errs.municipio = 'Seleccione un municipio';
        break;
      case 3:
        if (!cedula.trim()) errs.cedula = 'La cédula es obligatoria';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar el tratamiento de datos personales';
        if (!aceptaTerminos) errs.terminos = 'Debe aceptar los términos y condiciones';
        break;
      case 4:
        if (!nivelEstudios) errs.estudios = 'Seleccione su nivel de estudios';
        break;
      // case 7: SMS verification disabled temporarily
      // if (!codigoSMS.trim()) errs.codigo = 'Ingrese el código';
      // break;
      case 8:
        if (!fotoSelfie) errs.selfie = 'La selfie es obligatoria';
        if (!fotoCedula) errs.cedFoto = 'La foto de cédula es obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'La foto con cédula es obligatoria';
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
      showAlert('Error', msg);
      return false;
    }
  };

  const nextStep = async () => {
    if (!validateStep()) return;
    // SMS verification disabled temporarily - skip step 7
    // if (step === 7) {
    //   setLoading(true);
    //   const ok = await verificarCodigo();
    //   setLoading(false);
    //   if (!ok) return;
    // }
    // Skip SMS step (7)
    if (step === 6) {
      setStep(8);
      return;
    }
    setStep(step + 1);
  };
  const prevStep = () => {
    if (step <= 1) return;
    // Skip SMS step (7) going back
    if (step === 8) {
      setStep(6);
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
      showAlert('Código enviado', `Se envió un código de verificación por SMS al ${celular}`);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'No se pudo enviar el código';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleFotoGuardada = (tipo, uri) => {
    if (tipo === 'selfie') setFotoSelfie(uri);
    if (tipo === 'cedula') setFotoCedula(uri);
    if (tipo === 'selfie_cedula') setFotoSelfieCedula(uri);
  };

  const handleRegister = async () => {
    if (loading) return;
    if (!validateStep()) return;

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

      // Activar token para futuras peticiones autenticadas
      setAuthToken(token);

      // Completar registro y navegación de inmediato.
      await signIn(user, token);

      // Subir fotos en segundo plano para evitar bloquear la UX en este paso final.
      const fotos = [
        { tipo: 'selfie', uri: fotoSelfie },
        { tipo: 'cedula', uri: fotoCedula },
        { tipo: 'selfie_cedula', uri: fotoSelfieCedula },
      ].filter(f => f.uri);

      if (fotos.length > 0) {
        Promise.allSettled(
          fotos.map(async ({ tipo, uri }) => {
            const formData = new FormData();
            if (Platform.OS === 'web') {
              const resp = await fetch(uri);
              const blob = await resp.blob();
              formData.append('foto', blob, `${tipo}_${Date.now()}.jpg`);
            } else {
              formData.append('foto', { uri, type: 'image/jpeg', name: `${tipo}_${Date.now()}.jpg` });
            }
            await authAPI.subirFoto(tipo, formData);
          })
        ).then((results) => {
          results.forEach((r, idx) => {
            if (r.status === 'rejected') {
              const tipo = fotos[idx]?.tipo || 'desconocido';
              console.error(`Error subiendo foto ${tipo}:`, r.reason?.response?.data || r.reason?.message || r.reason);
            }
          });
        });
      }
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
      showAlert('Error', msg);
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
              <Ionicons name="person-circle-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Datos Personales</Text>
            <Text style={styles.stepDesc}>Cuéntanos quién eres</Text>
            <Input label="Nombre completo" value={nombre} onChangeText={setNombre}
              placeholder="Ej: Juan Pérez García" icon="person-outline" required error={errors.nombre} />
            <Input label="Celular" value={celular} onChangeText={setCelular}
              placeholder="Ej: 3001234567" keyboardType="phone-pad" icon="call-outline" required error={errors.celular} />
            <Input label="Correo electrónico (opcional)" value={correo} onChangeText={setCorreo}
              placeholder="correo@ejemplo.com" keyboardType="email-address" icon="mail-outline" />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres" secureTextEntry icon="lock-closed-outline" required error={errors.password} />
            <Input label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña" secureTextEntry icon="lock-closed-outline" required error={errors.confirmPassword} />
            <InfoBox variant="info" text="Tus datos personales permiten crear tu perfil y conectarte con empleadores de manera segura." />
          </View>
        );

      case 2:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="location-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Ubicación</Text>
            <Text style={styles.stepDesc}>¿Dónde te encuentras?</Text>

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
                const q = encodeURIComponent(`${municipio || ''}, ${departamento || ''}`);
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

            <InfoBox variant="info" text="Necesitamos tu ubicación para conectarte con empleadores y vacantes cerca de ti." />

          </View>
        );

      case 3:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Cédula y Datos Legales</Text>
            <Text style={styles.stepDesc}>Necesitamos verificar tu identidad</Text>
            <Input label="Número de cédula" value={cedula} onChangeText={setCedula}
              placeholder="Ej: 1234567890" keyboardType="numeric" icon="card-outline" required error={errors.cedula} />

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
                Autorizo el tratamiento de mis datos personales, según la Ley 1581 de 2012.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('DocumentoLegal', { tipo: 'habeas' })}>
                <Text style={styles.legalLink}>Leer documento de Habeas Data</Text>
              </TouchableOpacity>
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
                Acepto los Términos y Condiciones de uso de la plataforma TerraEmpleo.
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('DocumentoLegal', { tipo: 'terminos' })}>
                <Text style={styles.legalLink}>Leer Términos y Condiciones completos</Text>
              </TouchableOpacity>
            </View>
            {errors.terminos && <Text style={styles.errorText}>{errors.terminos}</Text>}

            <InfoBox variant="info" text="Tu cédula y consentimientos legales verifican tu identidad y generan confianza en los empleadores que revisen tu perfil." />
          </View>
        );

      case 4:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="school-outline" size={32} color={COLORS.primary} />
            </View>
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
                <Text style={styles.fieldLabel}>Título obtenido</Text>
                <Input
                  value={tituloEstudio}
                  onChangeText={setTituloEstudio}
                  placeholder="Ej: Ingeniería Agronómica"
                  icon="create-outline"
                  helper="Si no aparece en la lista, escríbelo manualmente."
                  maxLength={80}
                />
                <TouchableOpacity style={styles.pickerButtonNew} onPress={() => setShowTituloPicker(true)}>
                  <Ionicons name="school-outline" size={20} color={tituloEstudio ? COLORS.primary : COLORS.textLight} />
                  <Text style={[styles.pickerText, !tituloEstudio && { color: COLORS.textLight }]}>
                    {tituloEstudio || 'Seleccionar título sugerido'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              </View>
            )}
            <InfoBox variant="info" text="Tu nivel educativo ayuda a los empleadores a encontrar el perfil ideal para sus vacantes." />
          </View>
        );

      case 5:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="construct-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Experiencia Laboral</Text>
            <Text style={styles.stepDesc}>Selecciona tus habilidades y labores principales para ayudarte a encontrar mejores oportunidades.</Text>
            <ChipSelector
              label="Labores / Habilidades"
              options={LABORES}
              selected={habilidades}
              onSelectionChange={setHabilidades}
              allowCustom={true}
              customLabel="+ Otra labor"
            />
            <InfoBox variant="tip" text="¿No encuentras tu habilidad? Presiona el botón de + Otra labor para agregarla manualmente." />
            <InfoBox variant="info" text="Las empresas filtran candidatos basados en estas habilidades técnicas. Asegúrate de incluir todas las que domines." />
          </View>
        );

      case 6:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="leaf-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Cultivos y Disponibilidad</Text>
            <Text style={styles.stepDesc}>Indica en qué has trabajado y cuándo estás disponible.</Text>

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
            <InfoBox variant="info" text="Indicar tus cultivos y disponibilidad aumenta tus posibilidades de ser seleccionado para vacantes activas." />
          </View>
        );

      case 7:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="chatbubble-ellipses-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Verificación SMS</Text>
            <Text style={styles.stepDesc}>Verificaremos tu número de celular</Text>

            {!codigoEnviado ? (
              <View style={styles.smsContainer}>
                <View style={styles.smsIconCircle}>
                  <Ionicons name="shield-checkmark" size={28} color={COLORS.primary} />
                </View>
                <Text style={styles.smsText}>Se enviará un código de 6 dígitos a:</Text>
                <Text style={styles.smsPhone}>{celular}</Text>
                <Button title="Enviar Código" onPress={enviarCodigo} size="large" />
              </View>
            ) : (
              <View style={styles.smsContainer}>
                <Text style={styles.smsText}>Ingresa el código de 6 dígitos:</Text>
                <Input label="Código de verificación" value={codigoSMS} onChangeText={setCodigoSMS}
                  placeholder="Ingresa el código" keyboardType="numeric" maxLength={6}
                  icon="key-outline" error={errors.codigo} />
                <Button title="Reenviar código" onPress={enviarCodigo} variant="ghost" size="small"
                  icon={<Ionicons name="refresh-outline" size={16} color={COLORS.primary} />}
                  style={{ marginTop: SPACING.xs, alignSelf: 'center' }} />
              </View>
            )}
            <InfoBox variant="info" text="La verificación por SMS garantiza la seguridad de tu cuenta y genera confianza en los empleadores." />
          </View>
        );

      case 8:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Fotos de Verificación</Text>
            <Text style={styles.stepDesc}>Necesitamos verificar tu identidad</Text>

            <InfoBox variant="tip" text="Solo puedes tomar la foto en el momento, no se permite subir desde galería." />

            {/* Selfie */}
            <View style={[styles.fotoCard, fotoSelfie && styles.fotoCardDone]}>
              <View style={styles.fotoCardTop}>
                <View style={[styles.fotoIconCircle, fotoSelfie && styles.fotoIconCircleDone]}>
                  <Ionicons
                    name={fotoSelfie ? 'checkmark' : 'camera-outline'}
                    size={22}
                    color={fotoSelfie ? COLORS.white : COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fotoLabel}>Selfie</Text>
                  <Text style={styles.fotoDesc}>Foto de tu cara, mirando a la cámara</Text>
                </View>
              </View>
              <InfoBox variant="info" text="Esta selfie será tu foto de perfil en TerraEmpleo." />
              {!fotoSelfie ? (
                <CamaraFoto tipo="selfie" label="Selfie" onFotoGuardada={handleFotoGuardada} modoLocal={true} />
              ) : (
                <View style={styles.fotoOkBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.fotoOkText}>Foto capturada</Text>
                </View>
              )}
            </View>
            {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}

            {/* Foto cedula */}
            <View style={[styles.fotoCard, fotoCedula && styles.fotoCardDone]}>
              <View style={styles.fotoCardTop}>
                <View style={[styles.fotoIconCircle, fotoCedula && styles.fotoIconCircleDone]}>
                  <Ionicons
                    name={fotoCedula ? 'checkmark' : 'card-outline'}
                    size={22}
                    color={fotoCedula ? COLORS.white : COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fotoLabel}>Foto de Cédula</Text>
                  <Text style={styles.fotoDesc}>Foto frontal de tu documento de identidad</Text>
                </View>
              </View>
              {!fotoCedula ? (
                <CamaraFoto tipo="cedula" label="Foto de Cédula" onFotoGuardada={handleFotoGuardada} modoLocal={true} />
              ) : (
                <View style={styles.fotoOkBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.fotoOkText}>Foto capturada</Text>
                </View>
              )}
            </View>
            {errors.cedFoto && <Text style={styles.errorText}>{errors.cedFoto}</Text>}

            {/* Selfie con cedula */}
            <View style={[styles.fotoCard, fotoSelfieCedula && styles.fotoCardDone]}>
              <View style={styles.fotoCardTop}>
                <View style={[styles.fotoIconCircle, fotoSelfieCedula && styles.fotoIconCircleDone]}>
                  <Ionicons
                    name={fotoSelfieCedula ? 'checkmark' : 'people-outline'}
                    size={22}
                    color={fotoSelfieCedula ? COLORS.white : COLORS.primary}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fotoLabel}>Selfie con Cédula</Text>
                  <Text style={styles.fotoDesc}>Tú sosteniendo tu cédula junto a tu cara</Text>
                </View>
              </View>
              {!fotoSelfieCedula ? (
                <CamaraFoto tipo="selfie_cedula" label="Selfie con Cédula" onFotoGuardada={handleFotoGuardada} modoLocal={true} />
              ) : (
                <View style={styles.fotoOkBadge}>
                  <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                  <Text style={styles.fotoOkText}>Foto capturada</Text>
                </View>
              )}
            </View>
            {errors.selfieCed && <Text style={styles.errorText}>{errors.selfieCed}</Text>}
            <InfoBox variant="info" text="Las fotos verifican tu identidad en la plataforma y aumentan tu credibilidad ante los empleadores." />
          </View>
        );

      case 9:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="document-text-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={styles.stepTitle}>Resumen de tu Perfil</Text>
            <Text style={styles.stepDesc}>Revisa que toda tu información sea correcta antes de finalizar.</Text>

            {/* Identity hero */}
            <View style={styles.summaryHero}>
              <View style={styles.summaryAvatarWrap}>
                {fotoSelfie ? (
                  <Image source={{ uri: fotoSelfie }} style={styles.summaryAvatar} />
                ) : (
                  <View style={[styles.summaryAvatar, styles.summaryAvatarPlaceholder]}>
                    <Ionicons name="person" size={48} color={COLORS.primaryLight} />
                  </View>
                )}
                <View style={styles.summaryVerifiedBadge}>
                  <Ionicons name="checkmark" size={14} color={COLORS.white} />
                </View>
              </View>
              <Text style={styles.summaryHeroName}>{nombre}</Text>
              <Text style={styles.summaryHeroSub}>Trabajador · {municipio || departamento}</Text>
              <View style={styles.summaryVerifiedRow}>
                <Ionicons name="shield-checkmark" size={14} color={COLORS.primary} />
                <Text style={styles.summaryVerifiedText}>Identidad verificada</Text>
              </View>
            </View>

            <Text style={styles.summaryGroupLabel}>DATOS DE LA CUENTA</Text>

            <View style={styles.summaryGroup}>
              <SummaryCard icon="person-outline" label="NOMBRE COMPLETO" value={nombre} />
              <View style={styles.summaryDivider} />
              <SummaryCard icon="call-outline" label="CELULAR" value={celular} />
              {correo ? <View style={styles.summaryDivider} /> : null}
              {correo ? <SummaryCard icon="mail-outline" label="CORREO" value={correo} /> : null}
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

            <Text style={styles.summaryGroupLabel}>PERFIL PROFESIONAL</Text>
            <View style={styles.summaryGroup}>
              <SummaryCard
                icon="school-outline"
                label="ESTUDIOS"
                value={NIVELES_ESTUDIO.find(n => n.value === nivelEstudios)?.label || 'N/A'}
              />
              {tituloEstudio ? <View style={styles.summaryDivider} /> : null}
              {tituloEstudio ? <SummaryCard icon="ribbon-outline" label="TÍTULO" value={tituloEstudio} /> : null}
              <View style={styles.summaryDivider} />
              <SummaryCard
                icon="time-outline"
                label="EXPERIENCIA"
                value={EXPERIENCIA_OPTIONS.find(e => e.value === experiencia)?.label || 'N/A'}
              />
              <View style={styles.summaryDivider} />
              <SummaryCard
                icon="calendar-outline"
                label="DISPONIBILIDAD"
                value={DISPONIBILIDAD_OPTIONS.find(d => d.value === disponibilidad)?.label || 'N/A'}
              />
            </View>

            {(cultivos.length > 0 || habilidades.length > 0) ? (
              <View>
                <Text style={styles.summaryGroupLabel}>HABILIDADES</Text>
                <View style={styles.summaryGroup}>
                  {cultivos.length > 0 ? (
                    <SummaryCard icon="leaf-outline" label="CULTIVOS" value={cultivos.join(' · ')} />
                  ) : null}
                  {cultivos.length > 0 && habilidades.length > 0 ? (
                    <View style={styles.summaryDivider} />
                  ) : null}
                  {habilidades.length > 0 ? (
                    <SummaryCard icon="construct-outline" label="HABILIDADES" value={habilidades.join(' · ')} />
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
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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

      <PickerModal
        visible={showDeptPicker}
        onClose={() => setShowDeptPicker(false)}
        title="Departamento"
        options={DEPARTAMENTOS}
        selectedValue={departamento}
        onSelect={(v) => {
          setDepartamento(v);
          setMunicipio('');
          setShowMunPicker(false);
        }}
      />
      <PickerModal
        visible={showMunPicker}
        onClose={() => setShowMunPicker(false)}
        title="Municipio"
        options={getMunicipios(departamento)}
        selectedValue={municipio}
        onSelect={setMunicipio}
      />
      <PickerModal
        visible={showTituloPicker}
        onClose={() => setShowTituloPicker(false)}
        title="Título obtenido"
        options={TITULOS_SUGERIDOS}
        selectedValue={tituloEstudio}
        onSelect={setTituloEstudio}
      />
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
  stepSubtitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  legalSectionTitle: {
    fontSize: 17, fontWeight: '700', color: COLORS.textPrimary,
    marginTop: SPACING.lg, marginBottom: SPACING.sm,
  },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F9FAFB',
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.md, minHeight: 54, gap: SPACING.sm,
  },
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
  checkboxRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.primarySoft,
    padding: SPACING.md, borderRadius: RADIUS.lg, gap: SPACING.md, marginTop: SPACING.md,
  },
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
  legalLink: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.primary,
    textDecorationLine: 'underline',
  },
  errorText: { fontSize: 13, color: COLORS.error, marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  smsContainer: { alignItems: 'center', gap: SPACING.md, paddingVertical: SPACING.lg },
  smsIconCircle: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  smsText: { fontSize: 16, color: COLORS.textSecondary, textAlign: 'center' },
  smsPhone: { fontSize: 24, fontWeight: '700', color: COLORS.primary },
  fotoCard: {
    borderRadius: RADIUS.lg, padding: SPACING.md, marginBottom: SPACING.md,
    backgroundColor: COLORS.white, borderWidth: 1.5, borderColor: COLORS.border,
    ...SHADOWS.small,
  },
  fotoCardDone: {
    borderColor: COLORS.primary, backgroundColor: COLORS.primaryMuted,
  },
  fotoCardTop: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm,
  },
  fotoIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
  },
  fotoIconCircleDone: {
    backgroundColor: COLORS.primary,
  },
  fotoLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  fotoDesc: { fontSize: 13, color: COLORS.textLight, marginTop: 2 },
  fotoOkBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: COLORS.primarySoft, paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, alignSelf: 'flex-start',
  },
  fotoOkText: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
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
  footer: {
    flexDirection: 'row', paddingVertical: SPACING.md, gap: SPACING.md, alignItems: 'center',
  },
});