import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, Switch, Linking, ActionSheetIOS, Modal, ActivityIndicator, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, PickerModal } from '../../components/ui';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import {
  CULTIVOS, LABORES, NIVELES_ESTUDIO, TITULOS_SUGERIDOS,
  EXPERIENCIA_OPTIONS, DISPONIBILIDAD_OPTIONS, TIPO_PAGO_OPTIONS,
  ESPECIALIDADES_OPTIONS, NIVEL_FORMACION_OPTIONS, MODALIDAD_ESPECIALISTA_OPTIONS,
  RADIO_COBERTURA_OPTIONS, EXPERIENCIA_ESPECIALISTA_OPTIONS,
} from '../../data/options';
import { authAPI } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { useAppTheme } from '../../context/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';
import { AnimatedPressable } from '../../components/animated';
import { useFormDraft } from '../../hooks/useFormDraft';

export default function EditarPerfilScreen({ navigation, route }) {
  const { updateUser, user, signOut } = useAuth();
  const { colors, isDark } = useAppTheme();
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
  const [acercaDeTrabajador, setAcercaDeTrabajador] = useState(initPerfil?.acerca_de || '');
  const [hojaVidaUrl, setHojaVidaUrl] = useState(initPerfil?.hoja_vida_url || '');
  const [hojaVidaNombre, setHojaVidaNombre] = useState(initPerfil?.hoja_vida_nombre || '');
  const [subiendoHojaVida, setSubiendoHojaVida] = useState(false);

  // Campos especialista
  const [descripcionServicio, setDescripcionServicio] = useState(initPerfil?.descripcion_servicio || '');
  const [nivelFormacion, setNivelFormacion] = useState(initPerfil?.nivel_formacion || '');
  const [tituloCertificacion, setTituloCertificacion] = useState(initPerfil?.titulo_certificacion || '');
  const [experienciaEsp, setExperienciaEsp] = useState(initPerfil?.anios_experiencia || '');
  const [modalidadTrabajo, setModalidadTrabajo] = useState(initPerfil?.modalidad_trabajo || '');
  const [radioCobertura, setRadioCobertura] = useState(initPerfil?.radio_cobertura || '');
  const [especialidades, setEspecialidades] = useState(
    initPerfil?.especialidades?.map(e => e.especialidad || e) || []
  );
  const [cultivosEsp, setCultivosEsp] = useState(
    initPerfil?.cultivos?.map(c => c.cultivo || c) || []
  );
  const [hojaVidaUrlEsp, setHojaVidaUrlEsp] = useState(initPerfil?.hoja_vida_url || '');
  const [hojaVidaNombreEsp, setHojaVidaNombreEsp] = useState(initPerfil?.hoja_vida_nombre || '');

  // Campos empleador
  const [nombreEmpresa, setNombreEmpresa] = useState(initPerfil?.nombre_empresa_finca || '');
  const [tipoPago, setTipoPago] = useState(initPerfil?.tipo_pago || '');
  const [ofreceAlojamiento, setOfreceAlojamiento] = useState(!!initPerfil?.ofrece_alojamiento);
  const [ofreceAlimentacion, setOfreceAlimentacion] = useState(!!initPerfil?.ofrece_alimentacion);
  const [beneficiosExtra, setBeneficiosExtra] = useState(initPerfil?.beneficios_extra || '');
  const [acercaDeEmpleador, setAcercaDeEmpleador] = useState(initPerfil?.acerca_de || '');
  const [cultivosEmp, setCultivosEmp] = useState(
    initPerfil?.cultivos?.map(c => c.cultivo) || []
  );
  const [labores, setLabores] = useState(
    initPerfil?.labores?.map(l => l.labor) || []
  );
  const [showTipoPagoPicker, setShowTipoPagoPicker] = useState(false);

  const [loading, setLoading] = useState(false);
  const [guardadoExitoso, setGuardadoExitoso] = useState(false);
  const [errors, setErrors] = useState({});
  const successTimerRef = useRef(null);

  const [modalEliminar, setModalEliminar] = useState(false);
  const [motivoEliminar, setMotivoEliminar] = useState('');
  const [eliminando, setEliminando] = useState(false);
  const MOTIVOS_ELIMINAR = ['Ya encontré trabajo', 'No encuentro lo que busco', 'La app no funciona bien', 'Privacidad y datos personales', 'Prefiero no decirlo', 'Otro motivo'];

  const confirmarEliminacion = () => {
    Alert.alert(
      '¿Eliminar cuenta definitivamente?',
      'Tus datos se conservarán por 30 días y luego serán eliminados permanentemente.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sí, eliminar',
          style: 'destructive',
          onPress: async () => {
            setEliminando(true);
            try {
              await authAPI.eliminarCuenta(motivoEliminar);
              setModalEliminar(false);
              signOut();
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'No se pudo eliminar la cuenta.');
            } finally {
              setEliminando(false);
            }
          },
        },
      ]
    );
  };

  // Foto de perfil (selfie)
  const [fotoUri, setFotoUri] = useState(initUser?.foto_selfie || null);

  // Foto de finca (empleador)
  const [fotoFincaUri, setFotoFincaUri] = useState(initPerfil?.foto_finca_fachada || null);
  const [subiendoFotoFinca, setSubiendoFotoFinca] = useState(false);
  const [modalCamara, setModalCamara] = useState(false);
  const [preview, setPreview] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();

  // ── Borrador automático del perfil (por usuario) ──────────────────────────
  const onRestoreDraft = useCallback((d) => {
    if (d.nombre) setNombre(d.nombre);
    if (d.departamento) setDepartamento(d.departamento);
    if (d.municipio) setMunicipio(d.municipio);
    if (d.vereda) setVereda(d.vereda);
    if (d.nivelEstudios) setNivelEstudios(d.nivelEstudios);
    if (d.tituloEstudio) setTituloEstudio(d.tituloEstudio);
    if (d.experiencia) setExperiencia(d.experiencia);
    if (d.disponibilidad) setDisponibilidad(d.disponibilidad);
    if (Array.isArray(d.habilidades)) setHabilidades(d.habilidades);
    if (Array.isArray(d.cultivos)) setCultivos(d.cultivos);
    if (d.acercaDeTrabajador) setAcercaDeTrabajador(d.acercaDeTrabajador);
    if (d.descripcionServicio) setDescripcionServicio(d.descripcionServicio);
    if (d.nivelFormacion) setNivelFormacion(d.nivelFormacion);
    if (d.tituloCertificacion) setTituloCertificacion(d.tituloCertificacion);
    if (d.experienciaEsp) setExperienciaEsp(d.experienciaEsp);
    if (d.modalidadTrabajo) setModalidadTrabajo(d.modalidadTrabajo);
    if (d.radioCobertura) setRadioCobertura(d.radioCobertura);
    if (Array.isArray(d.especialidades)) setEspecialidades(d.especialidades);
    if (Array.isArray(d.cultivosEsp)) setCultivosEsp(d.cultivosEsp);
    if (d.nombreEmpresa) setNombreEmpresa(d.nombreEmpresa);
    if (d.tipoPago) setTipoPago(d.tipoPago);
    if (typeof d.ofreceAlojamiento === 'boolean') setOfreceAlojamiento(d.ofreceAlojamiento);
    if (typeof d.ofreceAlimentacion === 'boolean') setOfreceAlimentacion(d.ofreceAlimentacion);
    if (d.beneficiosExtra) setBeneficiosExtra(d.beneficiosExtra);
    if (d.acercaDeEmpleador) setAcercaDeEmpleador(d.acercaDeEmpleador);
    if (Array.isArray(d.cultivosEmp)) setCultivosEmp(d.cultivosEmp);
    if (Array.isArray(d.labores)) setLabores(d.labores);
  }, []);

  const { clearDraft: clearFormDraft } = useFormDraft(`EditarPerfil:${user?.id || 'guest'}`, {
    enabled: !!user?.id,
    data: {
      nombre, departamento, municipio, vereda,
      nivelEstudios, tituloEstudio, experiencia, disponibilidad, habilidades, cultivos, acercaDeTrabajador,
      descripcionServicio, nivelFormacion, tituloCertificacion, experienciaEsp, modalidadTrabajo, radioCobertura, especialidades, cultivosEsp,
      nombreEmpresa, tipoPago, ofreceAlojamiento, ofreceAlimentacion, beneficiosExtra, acercaDeEmpleador,
      cultivosEmp, labores,
    },
    onRestore: onRestoreDraft,
    toastMessage: 'Cambios sin guardar restaurados',
  });

  const diasDesdeUltimoCambio = initUser?.foto_selfie_cambiada_at
    ? (Date.now() - new Date(initUser.foto_selfie_cambiada_at).getTime()) / 86400000
    : null;
  const puedeCambiarFoto = diasDesdeUltimoCambio === null || diasDesdeUltimoCambio >= 7;
  const diasParaCambio = diasDesdeUltimoCambio !== null && diasDesdeUltimoCambio < 7
    ? Math.ceil(7 - diasDesdeUltimoCambio)
    : 0;

  const _abrirCamara = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) { showAlert('Permiso requerido', 'Necesitamos acceso a la cámara.'); return; }
    }
    setPreview(null);
    setModalCamara(true);
  };

  const abrirSelectorFoto = () => {
    if (!puedeCambiarFoto) {
      showAlert('Cambio no disponible', `Podrás cambiar tu foto en ${diasParaCambio} día(s).`);
      return;
    }
    _abrirCamara();
  };

  const tomarFoto = async () => {
    if (!cameraRef.current) return;
    try {
      const foto = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPreview(foto.uri);
    } catch { showAlert('Error', 'No se pudo tomar la foto.'); }
  };

  const confirmarFoto = async () => {
    if (!preview) return;
    setSubiendoFoto(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(preview);
        const blob = await response.blob();
        formData.append('foto', blob, `selfie_${Date.now()}.jpg`);
      } else {
        formData.append('foto', { uri: preview, type: 'image/jpeg', name: `selfie_${Date.now()}.jpg` });
      }
      const res = await authAPI.cambiarFotoPerfil(formData);
      setFotoUri(res.data.path);
      setModalCamara(false);
      setPreview(null);
      updateUser({ foto_selfie: res.data.path, validacion_identidad_estado: 'pendiente', foto_selfie_cambiada_at: new Date().toISOString() });
      showAlert('Foto actualizada', 'Tu foto de perfil fue cambiada exitosamente.');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'No se pudo actualizar la foto.');
    } finally {
      setSubiendoFoto(false);
    }
  };

  useEffect(() => {
    return () => {
      if (successTimerRef.current) {
        clearTimeout(successTimerRef.current);
      }
    };
  }, []);

  const abrirFotoFinca = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Cancelar', 'Tomar foto', 'Elegir de galería'], cancelButtonIndex: 0 },
        async (idx) => {
          if (idx === 1) await _capturarFotoFinca();
          else if (idx === 2) await _galeriaFotoFinca();
        }
      );
    } else {
      Alert.alert('Foto de la finca', '', [
        { text: 'Tomar foto', onPress: _capturarFotoFinca },
        { text: 'Elegir de galería', onPress: _galeriaFotoFinca },
        { text: 'Cancelar', style: 'cancel' },
      ]);
    }
  };

  const _galeriaFotoFinca = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.8 });
    if (!result.canceled && result.assets?.length > 0) {
      await _subirFotoFinca(result.assets[0].uri);
    }
  };

  const _capturarFotoFinca = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { showAlert('Permiso requerido', 'Necesitamos acceso a la cámara.'); return; }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [16, 9], quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      await _subirFotoFinca(result.assets[0].uri);
    }
  };

  const _subirFotoFinca = async (uri) => {
    setSubiendoFotoFinca(true);
    try {
      const formData = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        formData.append('foto', blob, `finca_${Date.now()}.jpg`);
      } else {
        formData.append('foto', { uri, type: 'image/jpeg', name: `finca_${Date.now()}.jpg` });
      }
      const res = await authAPI.subirFoto('finca_fachada', formData);
      setFotoFincaUri(res.data.path);
      showAlert('Foto actualizada', 'La foto de tu finca fue actualizada.');
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo subir la foto.');
    } finally {
      setSubiendoFotoFinca(false);
    }
  };

  const abrirSelectorPdfWeb = () => {
    if (typeof document === 'undefined') return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/pdf,.pdf';
    input.style.position = 'fixed';
    input.style.opacity = '0';
    input.style.pointerEvents = 'none';
    input.style.left = '-9999px';

    input.addEventListener('change', async (event) => {
      const file = event.target?.files?.[0];
      input.remove();
      if (!file) return;

      if (file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name || '')) {
        showAlert('Archivo inválido', 'Solo se permiten archivos PDF.');
        return;
      }

      const formData = new FormData();
      formData.append('hoja_vida', file, file.name || 'hoja_vida.pdf');

      setSubiendoHojaVida(true);
      try {
        const res = await authAPI.subirHojaVida(formData);
        setHojaVidaUrl(res.data?.hoja_vida_url || '');
        setHojaVidaNombre(res.data?.hoja_vida_nombre || file.name || 'hoja_vida.pdf');
        showAlert('Éxito', 'Hoja de vida cargada correctamente.');
      } catch (err) {
        showAlert('Error', err.response?.data?.error || 'No se pudo subir la hoja de vida');
      } finally {
        setSubiendoHojaVida(false);
      }
    });

    document.body.appendChild(input);
    input.click();
  };

  const manejarSubidaHojaVidaNativa = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/pdf',
        copyToCacheDirectory: true,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      const formData = new FormData();
      formData.append('hoja_vida', {
        uri: asset.uri,
        name: asset.name || 'hoja_vida.pdf',
        type: asset.mimeType || 'application/pdf',
      });

      setSubiendoHojaVida(true);
      try {
        const res = await authAPI.subirHojaVida(formData);
        setHojaVidaUrl(res.data?.hoja_vida_url || '');
        setHojaVidaNombre(res.data?.hoja_vida_nombre || asset.name || 'hoja_vida.pdf');
        Alert.alert('Éxito', 'Hoja de vida cargada correctamente.');
      } catch (err) {
        Alert.alert('Error', err.response?.data?.error || 'No se pudo subir la hoja de vida');
      } finally {
        setSubiendoHojaVida(false);
      }
    } catch (err) {
      Alert.alert('Error', 'No se pudo seleccionar el archivo.');
    }
  };

  const manejarSubidaHojaVida = () => {
    if (Platform.OS === 'web') {
      abrirSelectorPdfWeb();
    } else {
      manejarSubidaHojaVidaNativa();
    }
  };

  const verHojaVida = async () => {
    if (!hojaVidaUrl) return;
    try {
      const canOpen = await Linking.canOpenURL(hojaVidaUrl);
      if (canOpen) {
        await Linking.openURL(hojaVidaUrl);
      } else {
        showAlert('No disponible', 'No se pudo abrir la hoja de vida en este dispositivo.');
      }
    } catch (_) {
      showAlert('Error', 'No se pudo abrir la hoja de vida.');
    }
  };

  const validate = () => {
    const errs = {};
    if (!nombre.trim()) errs.nombre = 'El nombre es obligatorio';
    if (rol === 'empleador' && !nombreEmpresa.trim()) errs.empresa = 'El nombre de la finca/empresa es obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showAlert('Campos requeridos', Object.values(errs).join('\n'));
      return false;
    }
    return true;
  };

  const handleGuardar = async () => {
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
          acerca_de: acercaDeTrabajador.trim() || null,
          nivel_estudios: nivelEstudios || null,
          titulo_estudio: tituloEstudio || null,
          anios_experiencia: experiencia || null,
          disponibilidad: disponibilidad || null,
          habilidades: habilidades.map(h => ({ nombre: h, es_personalizada: !LABORES.includes(h) })),
          cultivos_trabajador: cultivos.map(c => ({ nombre: c, es_personalizado: !CULTIVOS.includes(c) })),
        };
      } else if (rol === 'especialista') {
        body = {
          nombre_completo: nombre,
          departamento: departamento || null,
          municipio: municipio || null,
          vereda: vereda || null,
          descripcion_servicio: descripcionServicio.trim() || null,
          nivel_formacion: nivelFormacion || null,
          titulo_certificacion: tituloCertificacion.trim() || null,
          anios_experiencia_especialista: experienciaEsp || null,
          modalidad_trabajo: modalidadTrabajo || null,
          radio_cobertura: radioCobertura || null,
          especialidades: especialidades.map(e => ({ nombre: e, es_personalizada: !ESPECIALIDADES_OPTIONS.includes(e) })),
          cultivos_especialista: cultivosEsp.map(c => ({ nombre: c, es_personalizado: !CULTIVOS.includes(c) })),
        };
      } else {
        body = {
          nombre_completo: nombre,
          departamento: departamento || null,
          municipio: municipio || null,
          vereda: vereda || null,
          nombre_empresa_finca: nombreEmpresa,
          acerca_de: acercaDeEmpleador.trim() || null,
          tipo_pago: tipoPago || null,
          ofrece_alojamiento: ofreceAlojamiento,
          ofrece_alimentacion: ofreceAlimentacion,
          beneficios_extra: beneficiosExtra || null,
          cultivos_empleador: cultivosEmp.map(c => ({ nombre: c, es_personalizado: !CULTIVOS.includes(c) })),
          labores: labores.map(l => ({ nombre: l, es_personalizada: !LABORES.includes(l) })),
        };
      }
      await authAPI.actualizarPerfil(body);
      updateUser({ nombre_completo: nombre, departamento, municipio });
      try { await clearFormDraft(); } catch (_) {}
      setGuardadoExitoso(true);
      successTimerRef.current = setTimeout(() => {
        setGuardadoExitoso(false);
        navigation.replace('PerfilHome');
      }, 1200);
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Error al actualizar el perfil';
      showAlert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.textPrimary }}>Editar Perfil</Text>
        <View style={{ width: 34 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

          {/* Foto de perfil */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Foto de perfil</Text>
            <View style={styles.fotoRow}>
              <TouchableOpacity onPress={abrirSelectorFoto} activeOpacity={0.8} style={styles.avatarWrap}>
                {fotoUri && fotoUri.startsWith('http') ? (
                  <Image source={{ uri: fotoUri }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatarFallback, { backgroundColor: COLORS.primary + '22' }]}>
                    <Ionicons name="person" size={36} color={COLORS.primary} />
                  </View>
                )}
                <View style={styles.camaraBadge}>
                  <Ionicons name="camera" size={14} color="#FFF" />
                </View>
              </TouchableOpacity>
              <View style={styles.fotoInfo}>
                <Text style={[styles.fotoLabel, { color: colors.textPrimary }]}>Cambiar foto</Text>
                <Text style={[styles.fotoSub, { color: colors.textSecondary }]}>
                  {puedeCambiarFoto ? 'Toca para tomar una nueva foto' : `Disponible en ${diasParaCambio} día(s)`}
                </Text>
              </View>
            </View>
          </View>

          {/* Datos personales */}
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Datos Personales</Text>
            <Input label="Nombre completo" value={nombre} onChangeText={setNombre}
              placeholder="Ej: Juan Pérez García" icon="person-outline" required error={errors.nombre} />

            <AnimatedPressable style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowDeptPicker(true)} scaleValue={0.97}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, { color: colors.textPrimary }, !departamento && { color: colors.textMuted }]}>
                {departamento || 'Seleccione departamento *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textLight} />
            </AnimatedPressable>
            {errors.departamento && <Text style={styles.errorText}>{errors.departamento}</Text>}

            <AnimatedPressable
              style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }, !departamento && styles.pickerDisabled]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
              scaleValue={0.97}
            >
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, { color: colors.textPrimary }, !municipio && { color: colors.textMuted }]}>
                {municipio || 'Seleccione municipio *'}
              </Text>
              <Ionicons name="chevron-down" size={20} color={colors.textLight} />
            </AnimatedPressable>
            {errors.municipio && <Text style={styles.errorText}>{errors.municipio}</Text>}

            <Input label="Vereda (opcional)" value={vereda} onChangeText={setVereda}
              placeholder="Nombre de la vereda" icon="trail-sign-outline" />
          </View>

          {/* Campos trabajador */}
          {rol === 'trabajador' && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Perfil Trabajador</Text>

              <Input
                label="Acerca de"
                value={acercaDeTrabajador}
                onChangeText={setAcercaDeTrabajador}
                placeholder="Cuéntale a los empleadores sobre tu experiencia, fortalezas y tipo de trabajo que buscas"
                multiline
                numberOfLines={4}
              />

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
                  <Text style={[styles.fieldLabel, { marginBottom: 6 }]}>Título obtenido <Text style={{ color: colors.textMuted, fontWeight: '400' }}>(opcional)</Text></Text>
                  <View style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
                    <Ionicons name="school-outline" size={18} color={COLORS.primary} style={{ marginRight: 8 }} />
                    <TextInput
                      style={{ flex: 1, fontSize: 15, color: colors.textPrimary, paddingVertical: 14 }}
                      placeholder="Ej: Ingeniería Agronómica"
                      placeholderTextColor={colors.textMuted}
                      value={tituloEstudio}
                      onChangeText={setTituloEstudio}
                      returnKeyType="done"
                      maxLength={100}
                    />
                    {tituloEstudio ? (
                      <TouchableOpacity onPress={() => setTituloEstudio('')}>
                        <Ionicons name="close-circle" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8 }}>
                    {TITULOS_SUGERIDOS.slice(0, 8).map(t => (
                      <TouchableOpacity
                        key={t}
                        onPress={() => setTituloEstudio(t)}
                        style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: tituloEstudio === t ? COLORS.primarySoft : colors.surface, borderWidth: 1, borderColor: tituloEstudio === t ? COLORS.primary : colors.border }}
                      >
                        <Text style={{ fontSize: 12, color: tituloEstudio === t ? COLORS.primary : colors.textSecondary }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
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

              <View style={styles.hojaVidaCard}>
                <View style={styles.hojaVidaHeader}>
                  <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.hojaVidaTitle}>Hoja de vida</Text>
                </View>

                {hojaVidaUrl ? (
                  <View style={styles.hojaVidaEstadoOk}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                    <Text style={styles.hojaVidaEstadoText}>Hoja de vida cargada</Text>
                  </View>
                ) : (
                  <Text style={styles.hojaVidaHint}>Aún no has cargado una hoja de vida</Text>
                )}

                {hojaVidaNombre ? (
                  <Text style={styles.hojaVidaNombre} numberOfLines={1}>{hojaVidaNombre}</Text>
                ) : null}

                <View style={styles.hojaVidaAcciones}>
                  {hojaVidaUrl ? (
                    <AnimatedPressable style={[styles.hojaVidaBtnOutline, { borderColor: COLORS.primary }]} onPress={verHojaVida} scaleValue={0.95}>
                      <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.hojaVidaBtnOutlineText}>Ver hoja de vida</Text>
                    </AnimatedPressable>
                  ) : null}
                  <AnimatedPressable
                    style={[styles.hojaVidaBtnPrimary, { backgroundColor: COLORS.primary }]}
                    onPress={manejarSubidaHojaVida}
                    disabled={subiendoHojaVida}
                    scaleValue={0.95}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color={COLORS.white} />
                    <Text style={styles.hojaVidaBtnPrimaryText}>
                      {subiendoHojaVida ? 'Subiendo...' : hojaVidaUrl ? 'Cambiar hoja de vida' : 'Subir hoja de vida'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          )}

          {/* Campos especialista */}
          {rol === 'especialista' && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Perfil Especialista</Text>

              <Input
                label="Descripción de tus servicios"
                value={descripcionServicio}
                onChangeText={setDescripcionServicio}
                placeholder="Describe qué servicios ofreces, tu especialidad y cómo puedes ayudar a las fincas"
                multiline
                numberOfLines={4}
              />

              <Text style={styles.fieldLabel}>Nivel de formación</Text>
              <ChipSelector
                options={NIVEL_FORMACION_OPTIONS.map(n => n.label)}
                selected={nivelFormacion ? [NIVEL_FORMACION_OPTIONS.find(n => n.value === nivelFormacion)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const n = NIVEL_FORMACION_OPTIONS.find(x => x.label === sel[sel.length - 1]);
                  setNivelFormacion(n?.value || '');
                }}
                multiSelect={false}
                allowCustom={false}
              />

              <Input
                label="Título / Certificación (opcional)"
                value={tituloCertificacion}
                onChangeText={setTituloCertificacion}
                placeholder="Ej: Ingeniero Agrónomo, Técnico en Café"
                icon="school-outline"
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Años de experiencia</Text>
              <ChipSelector
                options={EXPERIENCIA_ESPECIALISTA_OPTIONS.map(e => e.label)}
                selected={experienciaEsp ? [EXPERIENCIA_ESPECIALISTA_OPTIONS.find(e => e.value === experienciaEsp)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const e = EXPERIENCIA_ESPECIALISTA_OPTIONS.find(x => x.label === sel[sel.length - 1]);
                  setExperienciaEsp(e?.value || '');
                }}
                multiSelect={false}
                allowCustom={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Modalidad de trabajo</Text>
              <ChipSelector
                options={MODALIDAD_ESPECIALISTA_OPTIONS.map(m => m.label)}
                selected={modalidadTrabajo ? [MODALIDAD_ESPECIALISTA_OPTIONS.find(m => m.value === modalidadTrabajo)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const m = MODALIDAD_ESPECIALISTA_OPTIONS.find(x => x.label === sel[sel.length - 1]);
                  setModalidadTrabajo(m?.value || '');
                }}
                multiSelect={false}
                allowCustom={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Radio de cobertura</Text>
              <ChipSelector
                options={RADIO_COBERTURA_OPTIONS.map(r => r.label)}
                selected={radioCobertura ? [RADIO_COBERTURA_OPTIONS.find(r => r.value === radioCobertura)?.label].filter(Boolean) : []}
                onSelectionChange={(sel) => {
                  const r = RADIO_COBERTURA_OPTIONS.find(x => x.label === sel[sel.length - 1]);
                  setRadioCobertura(r?.value || '');
                }}
                multiSelect={false}
                allowCustom={false}
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Especialidades</Text>
              <ChipSelector
                options={ESPECIALIDADES_OPTIONS}
                selected={especialidades}
                onSelectionChange={setEspecialidades}
                allowCustom={true}
                customLabel="+ Otra especialidad"
              />

              <Text style={[styles.fieldLabel, { marginTop: SPACING.md }]}>Cultivos con los que trabajas</Text>
              <ChipSelector
                options={CULTIVOS}
                selected={cultivosEsp}
                onSelectionChange={setCultivosEsp}
                allowCustom={true}
                customLabel="+ Otro cultivo"
              />

              <View style={styles.hojaVidaCard}>
                <View style={styles.hojaVidaHeader}>
                  <Ionicons name="document-text-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.hojaVidaTitle}>Hoja de vida / Portafolio</Text>
                </View>
                {hojaVidaUrlEsp ? (
                  <View style={styles.hojaVidaEstadoOk}>
                    <Ionicons name="checkmark-circle" size={16} color={COLORS.primary} />
                    <Text style={styles.hojaVidaEstadoText}>Documento cargado</Text>
                  </View>
                ) : (
                  <Text style={styles.hojaVidaHint}>Aún no has cargado tu hoja de vida</Text>
                )}
                {hojaVidaNombreEsp ? <Text style={styles.hojaVidaNombre} numberOfLines={1}>{hojaVidaNombreEsp}</Text> : null}
                <View style={styles.hojaVidaAcciones}>
                  {hojaVidaUrlEsp ? (
                    <AnimatedPressable style={[styles.hojaVidaBtnOutline, { borderColor: COLORS.primary }]}
                      onPress={async () => {
                        const canOpen = await Linking.canOpenURL(hojaVidaUrlEsp);
                        if (canOpen) Linking.openURL(hojaVidaUrlEsp);
                        else showAlert('No disponible', 'No se pudo abrir el documento.');
                      }} scaleValue={0.95}>
                      <Ionicons name="open-outline" size={16} color={COLORS.primary} />
                      <Text style={styles.hojaVidaBtnOutlineText}>Ver documento</Text>
                    </AnimatedPressable>
                  ) : null}
                  <AnimatedPressable
                    style={[styles.hojaVidaBtnPrimary, { backgroundColor: COLORS.primary }]}
                    onPress={async () => {
                      const upload = async (formData) => {
                        setSubiendoHojaVida(true);
                        try {
                          const res = await authAPI.subirHojaVida(formData);
                          setHojaVidaUrlEsp(res.data?.hoja_vida_url || '');
                          setHojaVidaNombreEsp(res.data?.hoja_vida_nombre || '');
                          showAlert('Éxito', 'Documento cargado correctamente.');
                        } catch (err) {
                          showAlert('Error', err.response?.data?.error || 'No se pudo subir el documento');
                        } finally {
                          setSubiendoHojaVida(false);
                        }
                      };
                      if (Platform.OS === 'web') {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'application/pdf,.pdf';
                        input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;left:-9999px';
                        input.addEventListener('change', async (ev) => {
                          const file = ev.target?.files?.[0]; input.remove();
                          if (!file) return;
                          const fd = new FormData(); fd.append('hoja_vida', file, file.name || 'hoja_vida.pdf');
                          await upload(fd);
                        });
                        document.body.appendChild(input); input.click();
                      } else {
                        try {
                          const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
                          if (result.canceled || !result.assets?.[0]) return;
                          const asset = result.assets[0];
                          const fd = new FormData();
                          fd.append('hoja_vida', { uri: asset.uri, name: asset.name || 'hoja_vida.pdf', type: asset.mimeType || 'application/pdf' });
                          await upload(fd);
                        } catch { showAlert('Error', 'No se pudo seleccionar el archivo.'); }
                      }
                    }}
                    disabled={subiendoHojaVida}
                    scaleValue={0.95}
                  >
                    <Ionicons name="cloud-upload-outline" size={16} color={COLORS.white} />
                    <Text style={styles.hojaVidaBtnPrimaryText}>
                      {subiendoHojaVida ? 'Subiendo...' : hojaVidaUrlEsp ? 'Cambiar documento' : 'Subir hoja de vida'}
                    </Text>
                  </AnimatedPressable>
                </View>
              </View>
            </View>
          )}

          {/* Campos empleador */}
          {rol === 'empleador' && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Foto de la finca</Text>

              <TouchableOpacity onPress={abrirFotoFinca} activeOpacity={0.8} style={styles.fotoFincaWrap} disabled={subiendoFotoFinca}>
                {fotoFincaUri && fotoFincaUri.startsWith('http') ? (
                  <Image source={{ uri: fotoFincaUri }} style={styles.fotoFincaImg} resizeMode="cover" />
                ) : (
                  <View style={[styles.fotoFincaPlaceholder, { backgroundColor: colors.background }]}>
                    <Ionicons name="image-outline" size={36} color={COLORS.primary} />
                    <Text style={[styles.fotoFincaPlaceholderText, { color: colors.textSecondary }]}>Toca para agregar foto de tu finca</Text>
                  </View>
                )}
                <View style={styles.fotoFincaOverlay}>
                  {subiendoFotoFinca
                    ? <ActivityIndicator color="#FFF" />
                    : <Ionicons name="camera" size={20} color="#FFF" />}
                </View>
              </TouchableOpacity>
              <Text style={[styles.fotoFincaSub, { color: colors.textSecondary }]}>
                Esta foto aparece en tu perfil público y en el mapa de empleadores
              </Text>
            </View>
          )}

          {rol === 'empleador' && (
            <View style={[styles.card, { backgroundColor: colors.surface }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Perfil Empleador</Text>

              <Input
                label="Acerca de"
                value={acercaDeEmpleador}
                onChangeText={setAcercaDeEmpleador}
                placeholder="Describe tu finca, el ambiente de trabajo, el tipo de cultivos y lo que ofreces a los trabajadores"
                multiline
                numberOfLines={4}
              />

              <Input label="Nombre de la finca / empresa" value={nombreEmpresa}
                onChangeText={setNombreEmpresa} placeholder="Ej: Finca El Paraíso"
                icon="business-outline" required error={errors.empresa} />

              <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tipo de pago</Text>
              <AnimatedPressable style={[styles.pickerButton, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => setShowTipoPagoPicker(true)} scaleValue={0.97}>
                <Ionicons name="cash-outline" size={20} color={COLORS.primary} />
                <Text style={[styles.pickerText, { color: colors.textPrimary }, !tipoPago && { color: colors.textMuted }]}>
                  {tipoPago ? TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label : 'Seleccione tipo de pago'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textLight} />
              </AnimatedPressable>

              <View style={[styles.switchRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Ofrece alojamiento</Text>
                <Switch value={ofreceAlojamiento} onValueChange={setOfreceAlojamiento}
                  trackColor={{ false: colors.border, true: COLORS.primaryLight }}
                  thumbColor={ofreceAlojamiento ? COLORS.primary : '#f4f3f4'} />
              </View>

              <View style={[styles.switchRow, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.switchLabel, { color: colors.textPrimary }]}>Ofrece alimentación</Text>
                <Switch value={ofreceAlimentacion} onValueChange={setOfreceAlimentacion}
                  trackColor={{ false: colors.border, true: COLORS.primaryLight }}
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

          <Button
            title={loading ? 'Guardando...' : 'Guardar cambios'}
            loadingText="Guardando..."
            onPress={handleGuardar}
            loading={loading}
            size="large" style={{ marginTop: SPACING.md, marginBottom: SPACING.sm }} />
          <TouchableOpacity onPress={() => { setMotivoEliminar(''); setModalEliminar(true); }} style={{ alignItems: 'center', paddingVertical: 12 }}>
            <Text style={[styles.deleteAccountLink]}>Eliminar cuenta</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {guardadoExitoso ? (
        <View style={styles.successOverlay} pointerEvents="none">
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
            <Text style={styles.successText}>Cambios guardados con éxito</Text>
          </View>
        </View>
      ) : null}

      {/* Modal cámara / preview foto */}
      <Modal visible={modalCamara} animationType="slide" statusBarTranslucent onRequestClose={() => { setModalCamara(false); setPreview(null); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#000' }}>
          {/* Header con botón cerrar siempre visible */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 }}>
            <TouchableOpacity
              onPress={() => { setModalCamara(false); setPreview(null); }}
              style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <Ionicons name="close" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>
              {preview ? 'Vista previa' : 'Nueva foto de perfil'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {!preview ? (
            <View style={{ flex: 1 }}>
              <CameraView ref={cameraRef} style={{ flex: 1 }} facing="front" />
              <View style={{ position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' }}>
                <View style={{ width: 220, height: 220, borderRadius: 110, borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }} />
                <Text style={{ color: 'rgba(255,255,255,0.7)', marginTop: 12, fontSize: 13 }}>Centra tu cara</Text>
              </View>
              <View style={{ paddingBottom: 40, alignItems: 'center' }}>
                <TouchableOpacity
                  style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#FFF', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' }}
                  onPress={tomarFoto}
                >
                  <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF', borderWidth: 2, borderColor: '#000' }} />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <Image source={{ uri: preview }} style={{ flex: 1 }} resizeMode="contain" />
              <View style={{ paddingBottom: 40, paddingHorizontal: 32, flexDirection: 'row', gap: 16 }}>
                <TouchableOpacity
                  onPress={() => setPreview(null)}
                  style={{ flex: 1, paddingVertical: 16, backgroundColor: '#333', borderRadius: 99, alignItems: 'center' }}
                >
                  <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Repetir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={confirmarFoto}
                  disabled={subiendoFoto}
                  style={{ flex: 1, paddingVertical: 16, backgroundColor: COLORS.primary, borderRadius: 99, alignItems: 'center', opacity: subiendoFoto ? 0.7 : 1 }}
                >
                  {subiendoFoto
                    ? <ActivityIndicator color="#FFF" />
                    : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Guardar foto</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      <Modal visible={modalEliminar} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalEliminar(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <TouchableOpacity onPress={() => setModalEliminar(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.textPrimary }}>Eliminar cuenta</Text>
            <View style={{ width: 24 }} />
          </View>
          <ScrollView contentContainerStyle={{ padding: 24, gap: 16 }}>
            <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textPrimary, textAlign: 'center' }}>😔 Cuéntanos</Text>
            <Text style={{ fontSize: 15, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
              ¿Por qué deseas eliminar tu cuenta?{'\n'}Esperamos verte de vuelta pronto.
            </Text>
            <View style={{ gap: 10, marginTop: 8 }}>
              {MOTIVOS_ELIMINAR.map((m) => (
                <TouchableOpacity key={m} onPress={() => setMotivoEliminar(m)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: motivoEliminar === m ? COLORS.primary : colors.border, backgroundColor: motivoEliminar === m ? COLORS.primary + '10' : colors.surface }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: motivoEliminar === m ? COLORS.primary : colors.border, alignItems: 'center', justifyContent: 'center' }}>
                    {motivoEliminar === m && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary }} />}
                  </View>
                  <Text style={{ fontSize: 14, color: colors.textPrimary, flex: 1 }}>{m}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={confirmarEliminacion} disabled={!motivoEliminar || eliminando}
              style={{ marginTop: 16, paddingVertical: 16, borderRadius: 99, backgroundColor: motivoEliminar ? COLORS.error : colors.border, alignItems: 'center', opacity: eliminando ? 0.7 : 1 }}>
              {eliminando ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '700', fontSize: 15 }}>Continuar</Text>}
            </TouchableOpacity>
            <Text style={{ fontSize: 12, color: colors.textSecondary, textAlign: 'center', lineHeight: 18 }}>
              Tus datos se conservarán 30 días antes de eliminarse permanentemente.
            </Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
  fotoRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  avatarWrap: { position: 'relative', width: 72, height: 72 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 2.5, borderColor: COLORS.primary + '55' },
  avatarFallback: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  camaraBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    borderWidth: 2, borderColor: '#FFF',
  },
  fotoInfo: { flex: 1 },
  fotoLabel: { fontSize: 14, fontWeight: '700', marginBottom: 3 },
  fotoSub: { fontSize: 12, lineHeight: 17 },

  fotoFincaWrap: { borderRadius: 12, overflow: 'hidden', height: 160, position: 'relative', marginBottom: 8 },
  fotoFincaImg: { width: '100%', height: '100%' },
  fotoFincaPlaceholder: {
    width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center', gap: 8,
    borderRadius: 12, borderWidth: 1.5, borderColor: COLORS.primary + '44', borderStyle: 'dashed',
  },
  fotoFincaPlaceholderText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
  fotoFincaOverlay: {
    position: 'absolute', bottom: 10, right: 10,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  fotoFincaSub: { fontSize: 11, lineHeight: 16 },
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
  hojaVidaCard: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  hojaVidaHeader: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  hojaVidaTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  hojaVidaHint: { fontSize: 13, color: COLORS.textSecondary },
  hojaVidaEstadoOk: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hojaVidaEstadoText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  hojaVidaNombre: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600' },
  hojaVidaAcciones: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  hojaVidaBtnOutline: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, borderWidth: 1.5, borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  hojaVidaBtnOutlineText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  hojaVidaBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    borderRadius: RADIUS.full, backgroundColor: COLORS.primary,
  },
  hojaVidaBtnPrimaryText: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  successCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    ...SHADOWS.medium,
  },
  successText: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  deleteAccountLink: {
    fontSize: 12, color: COLORS.textLight, textAlign: 'center',
    textDecorationLine: 'underline', marginBottom: SPACING.xl, paddingVertical: SPACING.xs,
  },
});
