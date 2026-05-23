import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Image, Keyboard, Linking,
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

const TOTAL_STEPS = 7;
const STEP_LABELS = [
  'Sus datos', 'Ubicación', 'Cédula', 'Especialidad', 'Sobre usted', 'Fotos', 'Resumen',
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
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Step 2: Ubicación
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [vereda, setVereda] = useState('');
  const [radioCobertura, setRadioCobertura] = useState('municipio');
  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  // Step 3: Cédula y consentimientos
  const [cedula, setCedula] = useState('');
  const [aceptaHabeasData, setAceptaHabeasData] = useState(false);
  const [aceptaTerminos, setAceptaTerminos] = useState(false);

  // Step 4: Especialidad
  const [especialidades, setEspecialidades] = useState([]);
  const [nivelFormacion, setNivelFormacion] = useState('');
  const [tituloCertificacion, setTituloCertificacion] = useState('');

  // Step 5: Sobre usted
  const [descripcionServicio, setDescripcionServicio] = useState('');
  const [cultivos, setCultivos] = useState([]);
  const [aniosExperiencia, setAniosExperiencia] = useState('');
  const [modalidadTrabajo, setModalidadTrabajo] = useState('');

  // Step 6: Fotos identidad
  const [fotoSelfie, setFotoSelfie] = useState(null);
  const [fotoCedulaDoc, setFotoCedulaDoc] = useState(null);
  const [fotoSelfieCedula, setFotoSelfieCedula] = useState(null);
  const [fotosPortafolio, setFotosPortafolio] = useState([null, null, null]);

  const onRestoreDraft = useCallback((d) => {
    if (typeof d.step === 'number' && d.step >= 1 && d.step <= TOTAL_STEPS) setStep(d.step);
    if (d.nombre) setNombre(d.nombre);
    if (d.celular) setCelular(d.celular);
    if (d.correo) setCorreo(d.correo);
    if (d.departamento) setDepartamento(d.departamento);
    if (d.municipio) setMunicipio(d.municipio);
    if (d.vereda) setVereda(d.vereda);
    if (d.radioCobertura) setRadioCobertura(d.radioCobertura);
    if (d.cedula) setCedula(d.cedula);
    if (Array.isArray(d.especialidades)) setEspecialidades(d.especialidades);
    if (d.nivelFormacion) setNivelFormacion(d.nivelFormacion);
    if (d.tituloCertificacion) setTituloCertificacion(d.tituloCertificacion);
    if (d.descripcionServicio) setDescripcionServicio(d.descripcionServicio);
    if (Array.isArray(d.cultivos)) setCultivos(d.cultivos);
    if (d.aniosExperiencia) setAniosExperiencia(d.aniosExperiencia);
    if (d.modalidadTrabajo) setModalidadTrabajo(d.modalidadTrabajo);
    if (typeof d.aceptaHabeasData === 'boolean') setAceptaHabeasData(d.aceptaHabeasData);
    if (typeof d.aceptaTerminos === 'boolean') setAceptaTerminos(d.aceptaTerminos);
  }, []);

  const { clearDraft: clearFormDraft } = useFormDraft('RegisterEspecialista', {
    data: {
      step, nombre, celular, correo, cedula, departamento, municipio, vereda, radioCobertura,
      especialidades, nivelFormacion, tituloCertificacion, descripcionServicio,
      cultivos, aniosExperiencia, modalidadTrabajo, aceptaHabeasData, aceptaTerminos,
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
        if (!password || password.length < 8) errs.password = 'Mínimo 8 caracteres';
        if (password !== confirmPassword) errs.confirmPassword = 'Las contraseñas no coinciden';
        break;
      case 2:
        if (!departamento) errs.departamento = 'Seleccione un departamento';
        if (!municipio) errs.municipio = 'Seleccione un municipio';
        break;
      case 3:
        if (!cedula.trim()) errs.cedula = 'La cédula es obligatoria';
        if (!aceptaHabeasData) errs.habeas = 'Debe aceptar el tratamiento de datos';
        if (!aceptaTerminos) errs.terminos = 'Debe aceptar los Términos y Condiciones';
        break;
      case 4:
        if (especialidades.length === 0) errs.especialidades = 'Seleccione al menos una especialidad';
        if (!nivelFormacion) errs.nivelFormacion = 'Seleccione su nivel de formación';
        break;
      case 6:
        if (!fotoSelfie) errs.selfie = 'La selfie es obligatoria';
        if (!fotoSelfieCedula) errs.selfieCed = 'La selfie con cédula es obligatoria';
        break;
      case 7:
        if (!nombre.trim()) errs.nombre = 'Falta nombre (paso 1)';
        if (!departamento || !municipio) errs.ubicacion = 'Falta ubicación (paso 2)';
        if (!cedula.trim()) errs.cedula = 'Falta cédula (paso 3)';
        if (especialidades.length === 0) errs.especialidades = 'Falta especialidad (paso 4)';
        if (!aceptaHabeasData || !aceptaTerminos) errs.habeas = 'Faltan consentimientos (paso 3)';
        break;
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0 && step === 7) {
      Alert.alert('Datos incompletos', Object.values(errs)[0]);
    }
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

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
        vereda: vereda || undefined,
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

      // Subir fotos en segundo plano
      const fotos = [
        { tipo: 'selfie', uri: fotoSelfie },
        { tipo: 'cedula', uri: fotoCedulaDoc },
        { tipo: 'selfie_cedula', uri: fotoSelfieCedula },
        ...fotosPortafolio
          .map((uri, idx) => ({ tipo: `portafolio_${idx}`, uri }))
          .filter(f => f.uri),
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
              const t = fotos[idx]?.tipo || 'desconocido';
              console.error(`Error subiendo foto ${t}:`, r.reason?.response?.data || r.reason?.message || r.reason);
            }
          });
        });
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

  const ConsentRow = ({ icon, title, subtitle, linkLabel, linkUrl, value, onToggle, error }) => (
    <View style={[styles.consentCard, { backgroundColor: colors.surface, borderColor: error ? COLORS.error : colors.border }]}>
      <View style={styles.consentIcon}>
        <Ionicons name={icon} size={20} color={COLORS.primary} />
      </View>
      <View style={styles.consentText}>
        <Text style={[styles.consentTitle, { color: colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.consentSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
        {linkUrl && (
          <TouchableOpacity onPress={() => Linking.openURL(linkUrl)}>
            <Text style={styles.consentLink}>{linkLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: colors.border, true: COLORS.primaryMuted }}
        thumbColor={value ? COLORS.primary : '#f4f3f4'}
      />
    </View>
  );

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
            <Input label="Correo electrónico (opcional)" value={correo} onChangeText={setCorreo}
              placeholder="tucorreo@ejemplo.com" keyboardType="email-address" icon="mail-outline" />
            <Input label="Contraseña" value={password} onChangeText={setPassword}
              placeholder="Mínimo 8 caracteres" secureTextEntry icon="lock-closed-outline" required error={errors.password} />
            <Input label="Confirmar contraseña" value={confirmPassword} onChangeText={setConfirmPassword}
              placeholder="Repite tu contraseña" secureTextEntry icon="lock-closed-outline" error={errors.confirmPassword} />
          </View>
        );

      case 2:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="location-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Ubicación</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>¿Dónde te encuentras?</Text>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>Departamento *</Text>
            <TouchableOpacity
              style={[styles.pickerButton, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }]}
              onPress={() => setShowDeptPicker(true)}
            >
              <Ionicons name="map-outline" size={16} color={COLORS.textLight} style={{ marginRight: 8 }} />
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
              <Ionicons name="business-outline" size={16} color={COLORS.textLight} style={{ marginRight: 8 }} />
              <Text style={[styles.pickerText, { color: municipio ? colors.textPrimary : colors.textMuted }]}>
                {municipio || 'Seleccione un municipio'}
              </Text>
              <Ionicons name="chevron-down" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Input label="Vereda / Sector" value={vereda} onChangeText={setVereda}
              placeholder="Ej: Vereda La Linda" icon="trail-sign-outline" />

            <View style={styles.mapDecor}>
              <Ionicons name="map" size={48} color={COLORS.primary} style={{ opacity: 0.15 }} />
              <Text style={[styles.mapDecorText, { color: colors.textMuted }]}>
                Tu ubicación nos ayuda a conectarte con fincas y empresas cercanas
              </Text>
            </View>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>¿Dispuesto a desplazarse?</Text>
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
              <Ionicons name="shield-checkmark-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Cédula y Datos Legales</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Necesitamos verificar tu identidad</Text>

            <Input label="Número de cédula" value={cedula} onChangeText={setCedula}
              placeholder="Ej: 1234567890" keyboardType="numeric" icon="card-outline" required error={errors.cedula} />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>Consentimientos legales</Text>

            <ConsentRow
              icon="document-text-outline"
              title="Habeas Data"
              subtitle="Autorizo el tratamiento de mis datos personales, según la Ley 1581 de 2012."
              linkLabel="Leer documento de Habeas Data"
              linkUrl="https://app.terrampleo.com/privacidad.html"
              value={aceptaHabeasData}
              onToggle={setAceptaHabeasData}
              error={errors.habeas}
            />
            {errors.habeas && <Text style={styles.errorText}>{errors.habeas}</Text>}

            <ConsentRow
              icon="checkmark-circle-outline"
              title="Términos y Condiciones"
              subtitle="Acepto los Términos y Condiciones de uso de la plataforma TerraEmpleo."
              linkLabel="Leer Términos y Condiciones completos"
              linkUrl="https://app.terrampleo.com/privacidad.html"
              value={aceptaTerminos}
              onToggle={setAceptaTerminos}
              error={errors.terminos}
            />
            {errors.terminos && <Text style={styles.errorText}>{errors.terminos}</Text>}
          </View>
        );

      case 4:
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
              onSelectionChange={setEspecialidades}
              allowCustom
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
              label="Título o certificación (si aplica)"
              value={tituloCertificacion}
              onChangeText={setTituloCertificacion}
              placeholder="Ej: Tecnólogo en Gestión Cafetera"
              icon="school-outline"
            />
          </View>
        );

      case 5:
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
              placeholder="Ej: Asesoro fincas cafeteras para mejorar el perfil de taza..."
              multiline
              numberOfLines={4}
              icon="create-outline"
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>¿Con qué cultivos ha trabajado?</Text>
            <ChipSelector
              options={CULTIVOS}
              selected={cultivos}
              onSelectionChange={setCultivos}
              allowCustom
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

      case 6:
        return (
          <View>
            <View style={styles.stepIconWrap}>
              <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
            </View>
            <Text style={[styles.stepTitle, { color: colors.textPrimary }]}>Fotos y portafolio</Text>
            <Text style={[styles.stepDesc, { color: colors.textSecondary }]}>Las fotos generan más confianza con las fincas</Text>

            <Text style={[styles.fieldLabel, { color: colors.textPrimary }]}>
              Selfie <Text style={{ color: COLORS.error, fontWeight: '700' }}>*</Text>
              <Text style={{ color: colors.textMuted, fontWeight: '400' }}> (será tu foto de perfil)</Text>
            </Text>
            <CamaraFoto
              tipo="selfie"
              label={fotoSelfie ? '✓ Selfie tomada' : 'Tomar selfie'}
              onFotoGuardada={(_tipo, uri) => setFotoSelfie(uri)}
              modoLocal
            />
            {errors.selfie && <Text style={styles.errorText}>{errors.selfie}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              Foto de cédula <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(recomendada)</Text>
            </Text>
            <CamaraFoto
              tipo="cedula"
              label={fotoCedulaDoc ? '✓ Foto de cédula guardada' : 'Foto de cédula'}
              onFotoGuardada={(_tipo, uri) => setFotoCedulaDoc(uri)}
              modoLocal
              permitirGaleria
            />

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.md }]}>
              Selfie sosteniendo la cédula <Text style={{ color: COLORS.error, fontWeight: '700' }}>*</Text>
            </Text>
            <CamaraFoto
              tipo="selfie_cedula"
              label={fotoSelfieCedula ? '✓ Selfie con cédula tomada' : 'Selfie con cédula'}
              onFotoGuardada={(_tipo, uri) => setFotoSelfieCedula(uri)}
              modoLocal
            />
            {errors.selfieCed && <Text style={styles.errorText}>{errors.selfieCed}</Text>}

            <Text style={[styles.fieldLabel, { color: colors.textPrimary, marginTop: SPACING.lg }]}>
              Fotos de su trabajo <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(opcional)</Text>
            </Text>
            <View style={styles.portafolioRow}>
              {fotosPortafolio.map((_uri, idx) => (
                <CamaraFoto
                  key={idx}
                  tipo={`portafolio_${idx}`}
                  label={fotosPortafolio[idx] ? '✓ Foto' : 'Subir foto'}
                  onFotoGuardada={(_tipo, uri) => handleFotoPortafolio(idx, uri)}
                  modoLocal
                  permitirGaleria
                />
              ))}
            </View>

            <InfoBox variant="info" text="La selfie y la selfie con cédula son obligatorias. La selfie será tu foto de perfil." />
          </View>
        );

      case 7: {
        const resumenEspecialidades = especialidades.slice(0, 3).join(', ') +
          (especialidades.length > 3 ? ` +${especialidades.length - 3}` : '');
        const rows = [
          { label: 'Nombre', value: nombre },
          { label: 'Ubicación', value: municipio && departamento ? `${municipio}, ${departamento}` : '—' },
          { label: 'Desplazamiento', value: RADIO_LABELS[radioCobertura] || '—' },
          { label: 'Especialidad', value: resumenEspecialidades || '—' },
          { label: 'Formación', value: NIVEL_LABELS[nivelFormacion] || '—' },
          { label: 'Experiencia', value: EXPERIENCIA_LABELS[aniosExperiencia] || '—' },
          { label: 'Modalidad', value: MODALIDAD_LABELS[modalidadTrabajo] || '—' },
        ];
        const docs = [
          fotoSelfie ? '✓ Selfie' : null,
          fotoCedulaDoc ? '✓ Cédula' : null,
          fotoSelfieCedula ? '✓ Selfie+Cédula' : null,
        ].filter(Boolean);
        return (
          <View>
            {/* Avatar con selfie */}
            <View style={styles.avatarWrap}>
              {fotoSelfie ? (
                <Image source={{ uri: fotoSelfie }} style={styles.avatarImg} />
              ) : (
                <View style={[styles.avatarPlaceholder, { backgroundColor: COLORS.primarySoft }]}>
                  <Ionicons name="person" size={40} color={COLORS.primary} />
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="checkmark" size={12} color={COLORS.white} />
              </View>
            </View>
            <Text style={[styles.avatarName, { color: colors.textPrimary }]}>{nombre}</Text>
            <Text style={[styles.avatarRole, { color: colors.textSecondary }]}>
              Especialista · {municipio || '—'}
            </Text>

            <Text style={[styles.stepTitle, { color: colors.textPrimary, marginTop: SPACING.lg }]}>Resumen de su perfil</Text>
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
              <InfoBox variant="warning" text="Falta la selfie (obligatoria). Vuelva al paso 6 para tomarla." />
            )}
            {!fotoSelfieCedula && (
              <InfoBox variant="warning" text="Falta la selfie con cédula (obligatoria). Vuelva al paso 6 para tomarla." />
            )}
          </View>
        );
      }

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <View style={[styles.headerBar, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
          <TouchableOpacity
            onPress={step > 1 ? prevStep : () => navigation.goBack()}
            style={styles.backBtn}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Registro especialista</Text>
          <View style={{ width: 40 }} />
        </View>

        <ProgressBar currentStep={step} totalSteps={TOTAL_STEPS} labels={STEP_LABELS} />

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
    borderBottomWidth: 0,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'flex-start' },
  headerTitle: { fontSize: 15, fontWeight: '600', flex: 1, textAlign: 'center' },
  scrollContent: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
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
  mapDecor: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: SPACING.lg, gap: SPACING.sm,
  },
  mapDecorText: { fontSize: 13, textAlign: 'center', lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  radioChip: {
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.full, borderWidth: 1.5,
  },
  radioChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  radioChipText: { fontSize: 13, fontWeight: '500' },
  radioChipTextActive: { color: COLORS.white, fontWeight: '700' },
  consentCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    borderWidth: 1.5, borderRadius: RADIUS.md,
    padding: SPACING.md, marginBottom: SPACING.sm,
  },
  consentIcon: { marginTop: 2 },
  consentText: { flex: 1 },
  consentTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  consentSubtitle: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  consentLink: { fontSize: 13, color: COLORS.primary, textDecorationLine: 'underline', fontWeight: '600' },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  optionRowActive: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryMuted },
  optionText: { fontSize: 15 },
  portafolioRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  navButtons: { marginTop: SPACING.xl, gap: SPACING.sm },
  backTextBtn: { alignItems: 'center', paddingVertical: SPACING.sm },
  backText: { fontSize: 14 },
  errorText: { color: COLORS.error, fontSize: 12, marginBottom: SPACING.sm },
  avatarWrap: { alignItems: 'center', marginBottom: SPACING.sm, position: 'relative', alignSelf: 'center' },
  avatarImg: { width: 80, height: 80, borderRadius: 40, borderWidth: 3, borderColor: COLORS.primary },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center' },
  avatarBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: COLORS.white,
  },
  avatarName: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
  avatarRole: { fontSize: 14, textAlign: 'center', marginBottom: SPACING.md },
  resumenCard: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden', marginTop: SPACING.md },
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
