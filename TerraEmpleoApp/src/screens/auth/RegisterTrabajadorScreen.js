import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, ProgressBar, PickerModal } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { CULTIVOS, LABORES, NIVELES_ESTUDIO, TITULOS_SUGERIDOS, EXPERIENCIA_OPTIONS, DISPONIBILIDAD_OPTIONS } from '../../data/options';
import { authAPI, setAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import CamaraFoto from '../../components/CamaraFoto';

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

  // Step 4: SMS
  const [codigoSMS, setCodigoSMS] = useState('');
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoDebug, setCodigoDebug] = useState('');

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
        if (!nivelEstudios) errs.estudios = 'Seleccione su nivel de estudios';
        break;
      case 7:
        if (!codigoSMS.trim()) errs.codigo = 'Ingrese el código';
        break;
      case 8:
        if (!fotoSelfie) errs.selfie = 'La selfie es obligatoria';
        if (!fotoCedula) errs.cedFoto = 'La foto de cédula es obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'La foto con cédula es obligatoria';
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

  const handleFotoGuardada = (tipo, uri) => {
    if (tipo === 'selfie') setFotoSelfie(uri);
    if (tipo === 'cedula') setFotoCedula(uri);
    if (tipo === 'selfie_cedula') setFotoSelfieCedula(uri);
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

      // Activar token para subir fotos
      setAuthToken(token);
      const fotos = [
        { tipo: 'selfie', uri: fotoSelfie },
        { tipo: 'cedula', uri: fotoCedula },
        { tipo: 'selfie_cedula', uri: fotoSelfieCedula },
      ].filter(f => f.uri);
      for (const { tipo, uri } of fotos) {
        try {
          const formData = new FormData();
          formData.append('foto', { uri, type: 'image/jpeg', name: `${tipo}_${Date.now()}.jpg` });
          await authAPI.subirFoto(tipo, formData);
        } catch {
          // No bloqueamos el registro si falla la subida de una foto
        }
      }

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
            <WhyImportant text="Tus datos personales permiten crear tu perfil y conectarte con empleadores de manera segura." />
          </View>
        );

      case 2:
        return (
          <View>
            <Text style={styles.stepTitle}>Ubicación</Text>
            <Text style={styles.stepDesc}>¿Dónde te encuentras?</Text>

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

            <WhyImportant text="Necesitamos tu ubicación para conectarte con empleadores y vacantes cerca de ti." />

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
            <Text style={styles.stepDesc}>Necesitamos verificar tu identidad</Text>
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
            <WhyImportant text="Tu cédula y datos legales verifican tu identidad y generan confianza en los empleadores que revisen tu perfil." />
          </View>
        );

      case 4:
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
            <WhyImportant text="Tu nivel educativo ayuda a los empleadores a encontrar el perfil ideal para sus vacantes." />
          </View>
        );

      case 5:
        return (
          <View>
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
            <WhyImportant text="Las empresas filtran candidatos basados en estas habilidades técnicas. Asegúrate de incluir todas las que domines." />
          </View>
        );

      case 6:
        return (
          <View>
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
            <WhyImportant text="Indicar tus cultivos y disponibilidad aumenta tus posibilidades de ser seleccionado para vacantes activas." />
          </View>
        );

      case 7:
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
            <WhyImportant text="La verificación por SMS garantiza la seguridad de tu cuenta y genera confianza en los empleadores." />
          </View>
        );

      case 8:
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
                <CamaraFoto tipo="selfie" label="Selfie" onFotoGuardada={handleFotoGuardada} modoLocal={true} />
              ) : (
                <Text style={styles.fotoOk}>✓ Lista</Text>
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
                <CamaraFoto tipo="cedula" label="Foto de Cédula" onFotoGuardada={handleFotoGuardada} modoLocal={true} />
              ) : (
                <Text style={styles.fotoOk}>✓ Lista</Text>
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
                <CamaraFoto tipo="selfie_cedula" label="Selfie con Cédula" onFotoGuardada={handleFotoGuardada} modoLocal={true} />
              ) : (
                <Text style={styles.fotoOk}>✓ Lista</Text>
              )}
            </View>
            {errors.selfieCed && <Text style={styles.errorText}>{errors.selfieCed}</Text>}
            <WhyImportant text="Las fotos verifican tu identidad en la plataforma y aumentan tu credibilidad ante los empleadores." />
          </View>
        );

      case 9:
        return (
          <View>
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
              {correo ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryCard icon="mail-outline" label="CORREO" value={correo} />
                </>
              ) : null}
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

            <Text style={styles.summaryGroupLabel}>PERFIL PROFESIONAL</Text>
            <View style={styles.summaryGroup}>
              <SummaryCard
                icon="school-outline"
                label="ESTUDIOS"
                value={NIVELES_ESTUDIO.find(n => n.value === nivelEstudios)?.label || 'N/A'}
              />
              {tituloEstudio ? (
                <>
                  <View style={styles.summaryDivider} />
                  <SummaryCard icon="ribbon-outline" label="TÍTULO" value={tituloEstudio} />
                </>
              ) : null}
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

            {(cultivos.length > 0 || habilidades.length > 0) && (
              <>
                <Text style={styles.summaryGroupLabel}>HABILIDADES</Text>
                <View style={styles.summaryGroup}>
                  {cultivos.length > 0 && (
                    <SummaryCard icon="leaf-outline" label="CULTIVOS" value={cultivos.join(' · ')} />
                  )}
                  {cultivos.length > 0 && habilidades.length > 0 && (
                    <View style={styles.summaryDivider} />
                  )}
                  {habilidades.length > 0 && (
                    <SummaryCard icon="construct-outline" label="HABILIDADES" value={habilidades.join(' · ')} />
                  )}
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
          <View style={styles.formCard}>
            {renderStep()}
          </View>
        </ScrollView>

        <View style={styles.footerWrap}>
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
  stepSubtitle: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.md, minHeight: 52, gap: SPACING.sm,
  },
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
    marginTop: SPACING.md, height: 160,
    position: 'relative',
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
    borderRadius: RADIUS.md,
    padding: SPACING.md,
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
    borderColor: COLORS.success, backgroundColor: '#e6f7ee',
  },
  fotoInfo: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md, marginBottom: SPACING.sm,
  },
  fotoLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary },
  fotoDesc: { fontSize: 13, color: COLORS.textLight },
  fotoOk: { fontSize: 15, color: COLORS.success, fontWeight: '600', textAlign: 'center' },
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
  footerWrap: {
    backgroundColor: COLORS.white, borderTopWidth: 1,
    borderTopColor: COLORS.borderLight, ...SHADOWS.small,
  },
  footer: {
    flexDirection: 'row', padding: SPACING.md, gap: SPACING.md,
    backgroundColor: COLORS.white,
  },
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