import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Image, Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { FadeInView } from '../../components/animated';
import { Button, Input, ChipSelector, ProgressBar, PickerModal, InfoBox } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import {
  CULTIVOS,
  ESPECIALIDADES_OPTIONS,
  NIVEL_FORMACION_OPTIONS,
  MODALIDAD_ESPECIALISTA_OPTIONS,
  RADIO_COBERTURA_OPTIONS,
  EXPERIENCIA_ESPECIALISTA_OPTIONS,
} from '../../data/options';
import { authAPI, setAuthToken } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { useDisenoResponsive } from '../../hooks/useDisenoResponsive';
import CamaraFoto from '../../components/CamaraFoto';
import { useFormDraft } from '../../hooks/useFormDraft';

const TOTAL_STEPS = 6;
const STEP_LABELS = [
  'Sus datos', 'Ubicación', 'Especialidad', 'Sobre usted', 'Fotos y portafolio', 'Resumen',
];

const RADIO_LABELS = {
  municipio: 'Solo mi municipio',
  departamento: 'Mi departamento',
  eje_cafetero: 'Eje Cafetero',
  nacional: 'Todo Colombia',
};

const EXPERIENCIA_LABELS = {
  menos_1: 'Menos de 1 año',
  '1_3': '1 a 3 años',
  '3_5': '3 a 5 años',
  '5_10': '5 a 10 años',
  mas_10: 'Más de 10 años',
};

const MODALIDAD_LABELS = {
  por_proyecto: 'Por proyecto',
  por_dias: 'Por días',
  mensual: 'Mensual',
  asesoria_puntual: 'Asesoría puntual',
};

const NIVEL_LABELS = {
  empirico: 'Empírico / experiencia',
  tecnico_tecnologo: 'Técnico / Tecnólogo',
  profesional: 'Profesional',
};

export default function RegisterEspecialistaScreen({ navigation }) {
  const { signIn } = useAuth();
  const { colors, isDark } = useAppTheme();
  const isWeb = Platform.OS === 'web';
  const { contenedorMaxAncho } = useDisenoResponsive();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const [errors, setErrors] = useState({});

  // Step 1: Datos personales
  const [nombre, setNombre] = useState('');
  const [celular, setCelular] = useState('');
  const [correo, setCorreo] = useState('');
  const [cedula, setCedula] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [aceptaHabeasData, setAceptaHabeasData] = useState(false);

  // Step 2: Ubicación
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [radioCobertura, setRadioCobertura] = useState('municipio');
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  // Step 3: Especialidad
  const [especialidades, setEspecialidades] = useState([]);
  const [nivelFormacion, setNivelFormacion] = useState('');
  const [tituloCertificacion, setTituloCertificacion] = useState('');

  // Step 4: Sobre usted
  const [descripcionServicio, setDescripcionServicio] = useState('');
  const [cultivos, setCultivos] = useState([]);
  const [aniosExperiencia, setAniosExperiencia] = useState('');
  const [modalidadTrabajo, setModalidadTrabajo] = useState('');

  // Step 5: Fotos identidad
  const [fotoSelfie, setFotoSelfie] = useState(null);
  const [fotoCedula, setFotoCedula] = useState(null);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(null);
  // Fotos portafolio (hasta 3)
  const [fotosPortafolio, setFotosPortafolio] = useState([null, null, null]);
  const [hojaVidaUri, setHojaVidaUri] = useState(null);
  const [hojaVidaNombre, setHojaVidaNombre] = useState('');

  const onRestoreDraft = useCallback((d) => {
    if (typeof d.step === 'number' && d.step >= 1 && d.step <= TOTAL_STEPS) setStep(d.step);
    if (d.nombre) setNombre(d.nombre);
    if (d.celular) setCelular(d.celular);
    if (d.correo) setCorreo(d.correo);
    if (d.cedula) setCedula(d.cedula);
    if (d.departamento) setDepartamento(d.departamento);
    if (d.municipio) setMunicipio(d.municipio);
    if (d.radioCobertura) setRadioCobertura(d.radioCobertura);
    if (Array.isArray(d.especialidades)) setEspecialidades(d.especialidades);
    if (d.nivelFormacion) setNivelFormacion(d.nivelFormacion);
    if (d.tituloCertificacion) setTituloCertificacion(d.tituloCertificacion);
    if (d.descripcionServicio) setDescripcionServicio(d.descripcionServicio);
    if (Array.isArray(d.cultivos)) setCultivos(d.cultivos);
    if (d.aniosExperiencia) setAniosExperiencia(d.aniosExperiencia);
    if (d.modalidadTrabajo) setModalidadTrabajo(d.modalidadTrabajo);
    if (typeof d.aceptaHabeasData === 'boolean') setAceptaHabeasData(d.aceptaHabeasData);
  }, []);

  const { clearDraft: clearFormDraft } = useFormDraft('RegisterEspecialista', {
    data: {
      step, nombre, celular, correo, cedula, departamento, municipio, radioCobertura,
      especialidades, nivelFormacion, tituloCertificacion, descripcionServicio,
      cultivos, aniosExperiencia, modalidadTrabajo, aceptaHabeasData,
    },
    onRestore: onRestoreDraft,
    toastMessage: 'Continuando con tu registro',
  });

  useEffect(() => {
    const scrollToTop = () => {
      if (!scrollRef.current || typeof scrollRef.current.scrollTo !== 'function') return;
      try { scrollRef.current.scrollTo({ y: 0, animated: false }); } catch (_) {}
    };
    if (isWeb) { setTimeout(scrollToTop, 0); } else { scrollToTop(); Keyboard.dismiss(); }
    setErrors({});
  }, [step, isWeb]);

  const validateStep = () => {
    const errs = {};
    switch (step) {
      case 1:
        if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
        if (!celular.trim() || celular.length < 7) errs.celular = 'Celular inválido';
        if (!cedula.trim()) errs.cedula = 'La cédula es obligatoria';
        if (!password || password.length < 8) errs.password = 'Mínimo 8 caracteres';
        if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar el tratamiento de datos';
        break;
      case 2:
        if (!departamento) errs.departamento = 'Seleccione un departamento';
        if (!municipio) errs.municipio = 'Seleccione un municipio';
        break;
      case 3:
        if (especialidades.length === 0) errs.especialidades = 'Seleccione al menos una especialidad';
        if (!nivelFormacion) errs.nivelFormacion = 'Seleccione su nivel de formación';
        break;
      case 5:
        if (!fotoSelfie) errs.selfie = 'La selfie es obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'La selfie con cédula es obligatoria';
        break;
      case 6:
        if (!nombre.trim()) errs.nombre = 'Falta nombre (paso 1)';
        if (!celular.trim()) errs.celular = 'Falta celular (paso 1)';
        if (!departamento || !municipio) errs.ubicacion = 'Falta ubicación (paso 2)';
        if (especialidades.length === 0) errs.especialidades = 'Falta especialidad (paso 3)';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar Habeas Data (paso 1)';
        break;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0 && step === 6) {
      Alert.alert('Datos incompletos', Object.values(errs)[0]);
    }
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const handleFotoIdentidad = (tipo, uri) => {
    if (tipo === 'selfie') setFotoSelfie(uri);
    if (tipo === 'cedula') setFotoCedula(uri);
    if (tipo === 'selfie_cedula') setFotoSelfieCedula(uri);
  };

  const handleFotoPortafolio = (index, uri) => {
    setFotosPortafolio(prev => prev.map((f, i) => (i === index ? uri : f)));
  };

  const handleRegister = async () => {
    if (loading) return;
    if (!validateStep()) return;
    setLoading(true);
    try {
      const data = {
        rol: 'especialista',
        nombre_completo: nombre,
        celular,
        correo: correo || undefined,
        password,
        cedula,
        departamento,
        municipio,
        acepta_habeas_data: true,
        descripcion_servicio: descripcionServicio || undefined,
        nivel_formacion: nivelFormacion || undefined,
        titulo_certificacion: tituloCertificacion || undefined,
        anios_experiencia_especialista: aniosExperiencia || undefined,
        modalidad_trabajo: modalidadTrabajo || undefined,
        radio_cobertura: radioCobertura,
        especialidades: especialidades.map(e => ({
          nombre: e,
          es_personalizada: !ESPECIALIDADES_OPTIONS.includes(e),
        })),
        cultivos_especialista: cultivos.map(c => ({
          nombre: c,
          es_personalizado: !CULTIVOS.includes(c),
        })),
      };

      const response = await authAPI.register(data);
      const { token, user } = response.data;
      setAuthToken(token);
      try { await clearFormDraft(); } catch (_) {}
      await signIn(user, token);
      Alert.alert('¡Bienvenido!', `Hola ${user.nombre_completo?.split(' ')[0] || ''}, tu cuenta fue creada exitosamente.`);

      // Subir fotos de identidad en segundo plano
      const fotosIdentidad = [
        { tipo: 'selfie', uri: fotoSelfie },
        { tipo: 'cedula', uri: fotoCedula },
        { tipo: 'selfie_cedula', uri: fotoSelfieCedula },
      ].filter(f => f.uri);

      if (fotosIdentidad.length > 0) {
        Promise.allSettled(
          fotosIdentidad.map(async ({ tipo, uri }) => {
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
        );
      }
    } catch (err) {
      let msg = 'No se pudo completar el registro. Intenta de nuevo.';
      if (err.response?.data?.error) msg = err.response.data.error;
      else if (!err.response) msg = 'Sin conexión al servidor. Verifica tu internet.';
      Alert.alert('Error en el registro', msg);
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
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Sus datos</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Información básica de contacto</Text>

            <Input label="Nombre completo" value={nombre} onChangeText={setNombre}
              placeholder="Ej: Andrés Castaño Ríos" icon="person-outline" required error={errors.nombre} />
            <Input label="Celular" value={celular} onChangeText={setCelular}
              placeholder="Ej: 310 000 0000" keyboardType="phone-pad" icon="call-outline" required error={errors.celular} />
            <Input label="Correo electrónico" value={correo} onChangeText={setCorreo}
              placeholder="tucorreo@ejemplo.com" keyboardType="email-address" icon="mail-outline"
              labelSuffix=" (opcional)" />
            <Input label="Cédula" value={cedula} onChangeText={setCedula}
              placeholder="Número de cédula" keyboardType="numeric" icon="card-outline" required error={errors.cedula} />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres" secureTextEntry icon="lock-closed-outline" required error={errors.password} />
            <Input label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña" secureTextEntry icon="lock-closed-outline" error={errors.confirmPassword} />

            <TouchableOpacity
              style={[styles.habeasCard, { backgroundColor: colors.surface, borderColor: aceptaHabeasData ? COLORS.primary : colors.border }]}
              onPress={() => setAceptaHabeasData(v => !v)}
              activeOpacity={0.8}
            >
              <View style={[styles.habeasCheck, aceptaHabeasData && styles.habeasCheckActive]}>
                {aceptaHabeasData && <Ionicons name="checkmark" size={14} color={COLORS.white} />}
              </View>
              <Text style={[styles.habeasText, { color: colors.textSecondary }]}>
                Acepto el tratamiento de mis datos personales según la Ley 1581 de 2012 (Habeas Data)
              </Text>
            </TouchableOpacity>
            {errors.habeas && <Text style={styles.errorText}>{errors.habeas}</Text>}
          </View>
        );

      case 2:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="location-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>¿Dónde trabaja?</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Puede ofrecer servicios en varias regiones</Text>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Departamento *</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }]}
              onPress={() => setShowDeptPicker(true)}
            >
              <Text style={[styles.pickerText, { color: departamento ? colors.textPrimary : colors.textMuted }]}>
                {departamento || 'Seleccione un departamento'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.departamento && <Text style={styles.errorText}>{errors.departamento}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Municipio *</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }, !departamento && { opacity: 0.5 }]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
            >
              <Text style={[styles.pickerText, { color: municipio ? colors.textPrimary : colors.textMuted }]}>
                {municipio || 'Seleccione un municipio'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>¿Dispuesto a desplazarse?{' '}
              <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(opcional)</Text>
            </Text>
            <View style={styles.chipRow}>
              {RADIO_COBERTURA_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radioChip, { borderColor: colors.border, backgroundColor: colors.surface },
                    radioCobertura === opt.value && styles.radioChipActive]}
                  onPress={() => setRadioCobertura(opt.value)}
                >
                  <Text style={[styles.radioChipText, { color: colors.textSecondary },
                    radioCobertura === opt.value && styles.radioChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 3:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="ribbon-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>¿En qué se especializa?</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Seleccione todos los que apliquen</Text>

            <ChipSelector
              options={ESPECIALIDADES_OPTIONS}
              selected={especialidades}
              onToggle={(item) => setEspecialidades(prev =>
                prev.includes(item) ? prev.filter(e => e !== item) : [...prev, item]
              )}
              allowCustom
              customPlaceholder="+ Otro"
            />
            {errors.especialidades && <Text style={styles.errorText}>{errors.especialidades}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.lg }]}>Nivel de formación</Text>
            {NIVEL_FORMACION_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, { backgroundColor: colors.surface, borderColor: colors.border },
                  nivelFormacion === opt.value && styles.optionRowActive]}
                onPress={() => setNivelFormacion(opt.value)}
              >
                <Text style={[styles.optionText, { color: colors.textPrimary },
                  nivelFormacion === opt.value && { color: COLORS.primary, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {nivelFormacion === opt.value && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}
            {errors.nivelFormacion && <Text style={styles.errorText}>{errors.nivelFormacion}</Text>}

            <Input
              label="Título o certificación"
              value={tituloCertificacion}
              onChangeText={setTituloCertificacion}
              placeholder="Ej: Tecnólogo en Gestión Cafetera"
              icon="school-outline"
              labelSuffix=" (si aplica)"
            />
          </View>
        );

      case 4:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="briefcase-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Cuéntenos sobre usted</Text>

            <Input
              label="Descripción de su servicio"
              value={descripcionServicio}
              onChangeText={setDescripcionServicio}
              placeholder="Ej: Asesoro fincas cafeteras para mejorar el perfil de taza y alcanzar puntajes de especialidad..."
              multiline
              numberOfLines={4}
              icon="create-outline"
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>¿Con qué cultivos o producciones ha trabajado?</Text>
            <ChipSelector
              options={CULTIVOS}
              selected={cultivos}
              onToggle={(item) => setCultivos(prev =>
                prev.includes(item) ? prev.filter(c => c !== item) : [...prev, item]
              )}
              allowCustom
              customPlaceholder="+ Otro"
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.lg }]}>Años de experiencia</Text>
            {EXPERIENCIA_ESPECIALISTA_OPTIONS.map(opt => (
              <TouchableOpacity
                key={opt.value}
                style={[styles.optionRow, { backgroundColor: colors.surface, borderColor: colors.border },
                  aniosExperiencia === opt.value && styles.optionRowActive]}
                onPress={() => setAniosExperiencia(opt.value)}
              >
                <Text style={[styles.optionText, { color: colors.textPrimary },
                  aniosExperiencia === opt.value && { color: COLORS.primary, fontWeight: '700' }]}>
                  {opt.label}
                </Text>
                {aniosExperiencia === opt.value && <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />}
              </TouchableOpacity>
            ))}

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.lg }]}>Modalidad de trabajo</Text>
            <View style={styles.chipRow}>
              {MODALIDAD_ESPECIALISTA_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.radioChip, { borderColor: colors.border, backgroundColor: colors.surface },
                    modalidadTrabajo === opt.value && styles.radioChipActive]}
                  onPress={() => setModalidadTrabajo(opt.value)}
                >
                  <Text style={[styles.radioChipText, { color: colors.textSecondary },
                    modalidadTrabajo === opt.value && styles.radioChipTextActive]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        );

      case 5:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Sus fotos y trabajo</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Las fotos generan más confianza con las fincas</Text>

            {/* Selfie — OBLIGATORIA */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Selfie{' '}<Text style={{ color: COLORS.error, fontWeight: '700' }}>*</Text>
            </Text>
            <CamaraFoto
              tipo="selfie"
              label={fotoSelfie ? '✓ Selfie tomada' : 'Tomar selfie'}
              sublabel="Solo se puede tomar en el momento"
              uri={fotoSelfie}
              onFotoGuardada={(uri) => handleFotoIdentidad('selfie', uri)}
              soloCaptura
            />
            {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}

            {/* Foto cédula — opcional */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              Foto de cédula{' '}<Text style={{ color: colors.textMuted, fontWeight: '400' }}>(recomendada)</Text>
            </Text>
            <CamaraFoto
              tipo="cedula"
              label={fotoCedula ? '✓ Foto de cédula guardada' : 'Foto de cédula'}
              uri={fotoCedula}
              onFotoGuardada={(uri) => handleFotoIdentidad('cedula', uri)}
            />

            {/* Selfie con cédula — OBLIGATORIA */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              Selfie sosteniendo la cédula{' '}<Text style={{ color: COLORS.error, fontWeight: '700' }}>*</Text>
            </Text>
            <CamaraFoto
              tipo="selfie_cedula"
              label={fotoSelfieCedula ? '✓ Selfie con cédula tomada' : 'Selfie con cédula'}
              sublabel="Sostenga su cédula visible al lado de su rostro"
              uri={fotoSelfieCedula}
              onFotoGuardada={(uri) => handleFotoIdentidad('selfie_cedula', uri)}
              soloCaptura
            />
            {errors.selfieCed && <Text style={styles.errorText}>{errors.selfieCed}</Text>}

            {/* Fotos portafolio */}
            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.lg }]}>
              Fotos de su trabajo{' '}<Text style={{ color: colors.textMuted, fontWeight: '400' }}>(opcional pero recomendado)</Text>
            </Text>
            <View style={styles.portafolioRow}>
              {fotosPortafolio.map((uri, idx) => (
                <CamaraFoto
                  key={idx}
                  tipo={`portafolio_${idx}`}
                  label="Subir foto"
                  uri={uri}
                  onFotoGuardada={(u) => handleFotoPortafolio(idx, u)}
                  style={styles.portafolioItem}
                  compact
                />
              ))}
            </View>

            <InfoBox variant="info" text="La selfie y la selfie con cédula son obligatorias para verificar su identidad. Las demás fotos son opcionales." />
          </View>
        );

      case 6: {
        const resumenEspecialidades = especialidades.slice(0, 3).join(', ') +
          (especialidades.length > 3 ? ` +${especialidades.length - 3}` : '');
        const rows = [
          { label: 'Nombre', value: nombre },
          { label: 'Ubicación', value: municipio && departamento ? `${municipio}, ${departamento}` : municipio || departamento || '—' },
          { label: 'Desplazamiento', value: RADIO_LABELS[radioCobertura] || '—' },
          { label: 'Especialidad', value: resumenEspecialidades || '—' },
          { label: 'Formación', value: NIVEL_LABELS[nivelFormacion] || '—' },
          { label: 'Experiencia', value: EXPERIENCIA_LABELS[aniosExperiencia] || '—' },
          { label: 'Modalidad', value: MODALIDAD_LABELS[modalidadTrabajo] || '—' },
        ];
        const docs = [
          fotoSelfie ? '✓ Selfie' : null,
          fotoCedula ? '✓ Cédula' : null,
          fotoSelfieCedula ? '✓ Selfie+Cédula' : null,
        ].filter(Boolean);
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="checkmark-done-circle-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Resumen de su perfil</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Verifique que todo esté correcto</Text>

            <View style={[styles.resumenCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {rows.map((r, i) => (
                <View key={i} style={[styles.resumenRow, i < rows.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[styles.resumenLabel, { color: colors.textMuted }]}>{r.label}</Text>
                  <Text style={[styles.resumenValue, { color: colors.textPrimary }]}>{r.value}</Text>
                </View>
              ))}
              {docs.length > 0 && (
                <View style={[styles.resumenRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
                  <Text style={[styles.resumenLabel, { color: colors.textMuted }]}>Documentos</Text>
                  <View style={styles.docsRow}>
                    {docs.map((d, i) => (
                      <View key={i} style={styles.docBadge}>
                        <Text style={styles.docBadgeText}>{d}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </View>

            {!fotoSelfie && (
              <InfoBox variant="warning" text="Falta la selfie (obligatoria). Vuelva al paso 5 para tomarla." />
            )}
            {!fotoSelfieCedula && (
              <InfoBox variant="warning" text="Falta la selfie con cédula (obligatoria). Vuelva al paso 5 para tomarla." />
            )}
          </View>
        );
      }

      default:
        return null;
    }
  };

  const progress = step / TOTAL_STEPS;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        {/* Header */}
        <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={step > 1 ? prevStep : () => navigation.goBack()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerStepLabel, { color: colors.textMuted }]}>
              {STEP_LABELS[step - 1]}
            </Text>
            <Text style={[styles.headerProgress, { color: colors.textSecondary }]}>
              Paso {step} de {TOTAL_STEPS} · {Math.round(progress * 100)}%
            </Text>
          </View>
          <View style={{ width: 40 }} />
        </View>

        <ProgressBar progress={progress} style={styles.progressBar} />

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={[
            styles.scrollContent,
            { maxWidth: contenedorMaxAncho, width: '100%', alignSelf: 'center' },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <FadeInView key={step}>
            {renderStep()}
          </FadeInView>

          <View style={styles.navButtons}>
            {step < TOTAL_STEPS ? (
              <Button title="Continuar" onPress={nextStep} size="large" />
            ) : (
              <Button
                title="Finalizar registro"
                onPress={handleRegister}
                loading={loading}
                size="large"
              />
            )}
            {step > 1 && step < TOTAL_STEPS && (
              <TouchableOpacity onPress={prevStep} style={styles.backTextBtn}>
                <Text style={[styles.backText, { color: colors.textMuted }]}>Editar algo</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Pickers */}
      <PickerModal
        visible={showDeptPicker}
        title="Seleccione departamento"
        options={DEPARTAMENTOS.map(d => ({ label: d, value: d }))}
        selected={departamento}
        onSelect={(val) => { setDepartamento(val); setMunicipio(''); setShowDeptPicker(false); }}
        onClose={() => setShowDeptPicker(false)}
        searchable
      />
      <PickerModal
        visible={showMunPicker}
        title="Seleccione municipio"
        options={(getMunicipios(departamento) || []).map(m => ({ label: m, value: m }))}
        selected={municipio}
        onSelect={(val) => { setMunicipio(val); setShowMunPicker(false); }}
        onClose={() => setShowMunPicker(false)}
        searchable
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerCenter: { alignItems: 'center', flex: 1 },
  headerStepLabel: { fontSize: 13, fontWeight: '600' },
  headerProgress: { fontSize: 12, marginTop: 2 },
  progressBar: { marginHorizontal: 0 },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xl * 2,
  },
  stepIconWrap: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: COLORS.primarySoft,
    justifyContent: 'center', alignItems: 'center',
    marginBottom: SPACING.md,
  },
  stepTitle: { fontSize: 22, fontWeight: '800', marginBottom: SPACING.xs },
  stepDesc: { fontSize: 14, marginBottom: SPACING.lg, lineHeight: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: SPACING.sm, marginTop: SPACING.md },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm + 2,
    marginBottom: SPACING.sm,
  },
  pickerText: { fontSize: 15, flex: 1 },
  chipRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md,
  },
  radioChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full, borderWidth: 1.5,
  },
  radioChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radioChipText: { fontSize: 13, fontWeight: '500' },
  radioChipTextActive: { color: COLORS.white, fontWeight: '700' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  optionRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryMuted },
  optionText: { fontSize: 15 },
  navButtons: { marginTop: SPACING.xl, gap: SPACING.sm },
  backTextBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  backText: { fontSize: 14 },
  habeasCard: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.md,
    borderWidth: 1.5, borderRadius: RADIUS.md,
    padding: SPACING.md, marginTop: SPACING.md,
  },
  habeasCheck: {
    width: 22, height: 22, borderRadius: 4, borderWidth: 2,
    borderColor: COLORS.border, justifyContent: 'center', alignItems: 'center',
  },
  habeasCheckActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  habeasText: { flex: 1, fontSize: 13, lineHeight: 18 },
  portafolioRow: {
    flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md,
  },
  portafolioItem: { flex: 1 },
  errorText: { color: COLORS.error, fontSize: 12, marginBottom: SPACING.sm },
  resumenCard: {
    borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.md,
  },
  resumenRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md, gap: SPACING.md,
  },
  resumenLabel: { fontSize: 14, flex: 1 },
  resumenValue: { fontSize: 14, fontWeight: '600', flex: 2, textAlign: 'right' },
  docsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' },
  docBadge: {
    backgroundColor: COLORS.primarySoft, borderRadius: RADIUS.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  docBadgeText: { fontSize: 11, color: COLORS.primary, fontWeight: '600' },
});
