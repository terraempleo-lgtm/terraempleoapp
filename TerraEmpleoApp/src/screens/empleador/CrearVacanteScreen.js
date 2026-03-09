import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch,
  Image, ActivityIndicator, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, PickerModal } from '../../components/ui';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { vacantesAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';

const MAX_FOTOS = 5;
const SCREEN_WIDTH = Dimensions.get('window').width;

function obtenerNombreFoto(foto, indice) {
  const tipo = foto.type || 'image/jpeg';
  const extension = tipo.includes('/') ? tipo.split('/')[1] : 'jpg';
  return foto.name || `vacante_foto_${indice}.${extension}`;
}

async function construirArchivoFoto(foto, indice) {
  const tipo = foto.type || 'image/jpeg';
  const nombre = obtenerNombreFoto(foto, indice);

  if (Platform.OS === 'web') {
    if (foto.webFile) {
      return { archivo: foto.webFile, nombre };
    }

    const response = await fetch(foto.uri);
    const blob = await response.blob();
    try {
      return { archivo: new File([blob], nombre, { type: tipo }), nombre };
    } catch (_) {
      return { archivo: blob, nombre };
    }
  }

  return {
    archivo: { uri: foto.uri, type: tipo, name: nombre },
    nombre,
  };
}

export default function CrearVacanteScreen({ navigation }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cultivosV, setCultivosV] = useState([]);
  const [laboresV, setLaboresV] = useState([]);
  const [tipoPago, setTipoPago] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [vereda, setVereda] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [alojamiento, setAlojamiento] = useState(false);
  const [alimentacion, setAlimentacion] = useState(false);
  const [otrosBeneficios, setOtrosBeneficios] = useState('');
  const [loading, setLoading] = useState(false);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);
  const [errors, setErrors] = useState({});

  // Paso 2: fotos
  const [step, setStep] = useState('form'); // 'form' | 'fotos'
  const [vacanteId, setVacanteId] = useState(null);
  const [fotos, setFotos] = useState([]); // [{uri, uploading, uploaded, id}]

  const handleCrear = async () => {
    const errs = {};
    if (!titulo.trim()) errs.titulo = 'El título es obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await vacantesAPI.crear({
        titulo,
        descripcion,
        cultivos: cultivosV,
        labores: laboresV,
        tipo_pago: tipoPago || undefined,
        monto_pago: montoPago ? parseFloat(montoPago) : undefined,
        departamento,
        municipio,
        vereda: vereda || undefined,
        urgente,
        ofrece_alojamiento: alojamiento,
        ofrece_alimentacion: alimentacion,
        otros_beneficios: otrosBeneficios.trim() || undefined,
      });
      setVacanteId(res.data.vacanteId);
      setStep('fotos');
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || 'Error al crear la vacante');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_FOTOS} fotos por vacante.`);
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería para agregar fotos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - fotos.length,
      quality: 0.8,
      allowsEditing: false,
    });

    if (result.canceled) return;

    const nuevas = result.assets.map((asset) => ({
      uri: asset.uri,
      type: asset.mimeType || 'image/jpeg',
      name: asset.fileName || null,
      webFile: asset.file || null,
      uploading: false,
      uploaded: false,
      id: null,
    }));

    setFotos((prev) => [...prev, ...nuevas].slice(0, MAX_FOTOS));
  };

  const takePhoto = async () => {
    if (fotos.length >= MAX_FOTOS) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_FOTOS} fotos por vacante.`);
      return;
    }

    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a la cámara.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      allowsEditing: true,
    });

    if (result.canceled) return;

    setFotos((prev) => [
      ...prev,
      {
        uri: result.assets[0].uri,
        type: result.assets[0].mimeType || 'image/jpeg',
        name: result.assets[0].fileName || null,
        webFile: result.assets[0].file || null,
        uploading: false,
        uploaded: false,
        id: null,
      },
    ].slice(0, MAX_FOTOS));
  };

  const eliminarFotoLocal = (index) => {
    const foto = fotos[index];
    if (foto.uploaded && foto.id) {
      // Ya subida — eliminar en el servidor
      vacantesAPI.eliminarFoto(vacanteId, foto.id).catch(() => {});
    }
    setFotos((prev) => prev.filter((_, i) => i !== index));
  };

  const subirTodasLasFotos = async () => {
    const pendientes = fotos.filter((f) => !f.uploaded);
    if (pendientes.length === 0) return true;

    let exito = true;
    for (let i = 0; i < fotos.length; i++) {
      if (fotos[i].uploaded) continue;

      setFotos((prev) =>
        prev.map((f, idx) => (idx === i ? { ...f, uploading: true } : f))
      );

      try {
        const formData = new FormData();
        const { archivo, nombre } = await construirArchivoFoto(fotos[i], i);
        if (Platform.OS === 'web') {
          formData.append('fotos', archivo, nombre);
        } else {
          formData.append('fotos', archivo);
        }
        const res = await vacantesAPI.subirFotos(vacanteId, formData);
        const fotoSubida = res.data.fotos?.[0];
        setFotos((prev) =>
          prev.map((f, idx) =>
            idx === i
              ? { ...f, uploading: false, uploaded: true, id: fotoSubida?.id || null }
              : f
          )
        );
      } catch (err) {
        setFotos((prev) =>
          prev.map((f, idx) => (idx === i ? { ...f, uploading: false } : f))
        );
        const mensaje = err.response?.data?.error || 'No se pudo subir una foto.';
        Alert.alert('Error al subir foto', mensaje);
        exito = false;
      }
    }
    return exito;
  };

  const handleFinalizar = async () => {
    const pendientes = fotos.filter((f) => !f.uploaded);
    if (pendientes.length > 0) {
      setLoading(true);
      const ok = await subirTodasLasFotos();
      setLoading(false);
      if (!ok) {
        Alert.alert('Error', 'Algunas fotos no pudieron subirse. ¿Deseas continuar sin ellas?', [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Continuar', onPress: () => navigation.goBack() },
        ]);
        return;
      }
    }
    Alert.alert('¡Vacante publicada!', 'Se realizó el matching automático con trabajadores disponibles.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  const handleSaltarFotos = () => {
    Alert.alert('¡Vacante publicada!', 'Se realizó el matching automático con trabajadores disponibles.', [
      { text: 'OK', onPress: () => navigation.goBack() },
    ]);
  };

  if (step === 'fotos') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.card}>
            <View style={styles.stepHeader}>
              <Ionicons name="images-outline" size={28} color={COLORS.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Fotos de la vacante</Text>
                <Text style={styles.stepSubtitle}>
                  Agrega hasta {MAX_FOTOS} fotos de la finca o el trabajo para atraer más candidatos
                </Text>
              </View>
            </View>

            {/* Grid de fotos */}
            <View style={styles.fotosGrid}>
              {fotos.map((foto, index) => (
                <View key={index} style={styles.fotoItem}>
                  <Image source={{ uri: foto.uri }} style={styles.fotoThumb} />
                  {foto.uploading && (
                    <View style={styles.fotoOverlay}>
                      <ActivityIndicator color={COLORS.white} />
                    </View>
                  )}
                  {foto.uploaded && (
                    <View style={styles.fotoUploaded}>
                      <Ionicons name="checkmark-circle" size={20} color={COLORS.white} />
                    </View>
                  )}
                  <TouchableOpacity
                    style={styles.fotoDeleteBtn}
                    onPress={() => eliminarFotoLocal(index)}
                  >
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}

              {fotos.length < MAX_FOTOS && (
                <TouchableOpacity style={styles.addFotoBtn} onPress={pickImage}>
                  <Ionicons name="add" size={32} color={COLORS.primary} />
                  <Text style={styles.addFotoText}>Galería</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.fotosCount}>
              {fotos.length}/{MAX_FOTOS} fotos
            </Text>

            <View style={styles.fotoActions}>
              <TouchableOpacity style={styles.cameraBtn} onPress={takePhoto} disabled={fotos.length >= MAX_FOTOS}>
                <Ionicons name="camera-outline" size={20} color={fotos.length >= MAX_FOTOS ? COLORS.disabled : COLORS.primary} />
                <Text style={[styles.cameraBtnText, fotos.length >= MAX_FOTOS && { color: COLORS.disabled }]}>
                  Tomar foto
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <Button
            title={fotos.filter((f) => !f.uploaded).length > 0 ? 'Subir fotos y publicar' : 'Publicar vacante'}
            onPress={handleFinalizar}
            loading={loading}
            size="large"
            style={{ marginTop: SPACING.md }}
          />
          <TouchableOpacity style={styles.skipBtn} onPress={handleSaltarFotos}>
            <Text style={styles.skipText}>Publicar sin fotos</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.title}>Nueva Vacante</Text>

            <Input label="Título de la vacante" value={titulo} onChangeText={setTitulo}
              placeholder="Ej: Recolector de café" icon="briefcase-outline"
              required error={errors.titulo} />

            <Input label="Descripción" value={descripcion} onChangeText={setDescripcion}
              placeholder="Describe el trabajo..." multiline numberOfLines={4} />

            <ChipSelector label="Cultivo relacionado" options={CULTIVOS}
              selected={cultivosV} onSelectionChange={setCultivosV}
              allowCustom customLabel="+ Otro" />

            <ChipSelector label="Tipo de labor" options={LABORES}
              selected={laboresV} onSelectionChange={setLaboresV}
              allowCustom customLabel="+ Otra" />

            <Text style={styles.sectionLabel}>Tipo de pago</Text>
            <ChipSelector options={TIPO_PAGO_OPTIONS.map(t => t.label)}
              selected={tipoPago ? [TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label] : []}
              onSelectionChange={(sel) => {
                const tp = TIPO_PAGO_OPTIONS.find(t => t.label === sel[sel.length - 1]);
                setTipoPago(tp?.value || '');
              }}
              multiSelect={false} allowCustom={false} />

            <Input label="Monto de pago (COP)" value={montoPago} onChangeText={setMontoPago}
              placeholder="Ej: 50000" keyboardType="numeric" icon="cash-outline" />

            <Text style={styles.sectionLabel}>Ubicación</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Departamento'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.pickerButton, !departamento && { opacity: 0.5 }]}
              onPress={() => departamento && setShowMunPicker(true)} disabled={!departamento}>
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Municipio'}
              </Text>
            </TouchableOpacity>
            <Input label="Vereda (opcional)" value={vereda} onChangeText={setVereda} placeholder="Vereda" />

            <Text style={styles.sectionLabel}>Beneficios incluidos</Text>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="home-outline" size={20} color={COLORS.primary} />
                <View>
                  <Text style={styles.switchLabel}>Alojamiento</Text>
                  <Text style={styles.switchDesc}>Provees hospedaje al trabajador</Text>
                </View>
              </View>
              <Switch value={alojamiento} onValueChange={setAlojamiento}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff" />
            </View>
            <View style={styles.switchRow}>
              <View style={styles.switchInfo}>
                <Ionicons name="restaurant-outline" size={20} color={COLORS.primary} />
                <View>
                  <Text style={styles.switchLabel}>Alimentación</Text>
                  <Text style={styles.switchDesc}>Incluyes comidas en el trabajo</Text>
                </View>
              </View>
              <Switch value={alimentacion} onValueChange={setAlimentacion}
                trackColor={{ false: COLORS.border, true: COLORS.primary }}
                thumbColor="#fff" />
            </View>
            <View style={styles.otrosBeneficiosWrap}>
              <View style={styles.otrosBeneficiosHeader}>
                <Ionicons name="gift-outline" size={20} color={COLORS.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.switchLabel}>Otros beneficios</Text>
                  <Text style={styles.switchDesc}>Escribe beneficios adicionales si aplica</Text>
                </View>
              </View>
              <Input
                value={otrosBeneficios}
                onChangeText={setOtrosBeneficios}
                placeholder="Ej: transporte, bonificaciones, herramientas, dotación..."
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.urgentRow}>
              <View>
                <Text style={styles.urgentLabel}>¿Es urgente?</Text>
                <Text style={styles.urgentDesc}>Se destacará en las búsquedas</Text>
              </View>
              <Switch value={!!urgente} onValueChange={setUrgente}
                trackColor={{ false: COLORS.border, true: COLORS.urgent }}
                thumbColor={urgente ? '#fff' : '#f4f3f4'} />
            </View>

            <Button title="Siguiente: Agregar fotos" onPress={handleCrear}
              loading={loading} size="large" style={{ marginTop: SPACING.lg }} />
          </View>

          <PickerModal visible={showDeptPicker} onClose={() => setShowDeptPicker(false)}
            title="Departamento" options={DEPARTAMENTOS} selectedValue={departamento}
            onSelect={(v) => { setDepartamento(v); setMunicipio(''); }} />
          <PickerModal visible={showMunPicker} onClose={() => setShowMunPicker(false)}
            title="Municipio" options={getMunicipios(departamento)} selectedValue={municipio}
            onSelect={setMunicipio} />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const FOTO_SIZE = (SCREEN_WIDTH - SPACING.md * 2 - SPACING.lg * 2 - SPACING.sm * 2) / 3;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.medium },
  title: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: SPACING.sm },
  sectionLabel: { fontSize: 16, fontWeight: '600', color: COLORS.textPrimary, marginTop: SPACING.md, marginBottom: SPACING.sm },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white,
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.md,
    marginBottom: SPACING.sm, gap: SPACING.sm,
  },
  pickerText: { flex: 1, fontSize: 16, color: COLORS.textPrimary },
  switchRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.primarySoft, padding: SPACING.md, borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  switchInfo: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flex: 1 },
  switchLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  switchDesc: { fontSize: 12, color: COLORS.textSecondary, marginTop: 1 },
  otrosBeneficiosWrap: {
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  otrosBeneficiosHeader: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
  },
  urgentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.urgentBg, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.md,
  },
  urgentLabel: { fontSize: 16, fontWeight: '600', color: COLORS.urgent },
  urgentDesc: { fontSize: 13, color: COLORS.textSecondary },
  // Fotos step
  stepHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, marginBottom: SPACING.lg },
  stepSubtitle: { fontSize: 14, color: COLORS.textSecondary, marginTop: 2 },
  fotosGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  fotoItem: { width: FOTO_SIZE, height: FOTO_SIZE, borderRadius: RADIUS.md, overflow: 'visible' },
  fotoThumb: { width: FOTO_SIZE, height: FOTO_SIZE, borderRadius: RADIUS.md, backgroundColor: COLORS.border },
  fotoOverlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center',
  },
  fotoUploaded: {
    position: 'absolute', bottom: 4, right: 4,
    backgroundColor: COLORS.success, borderRadius: RADIUS.full, padding: 1,
  },
  fotoDeleteBtn: { position: 'absolute', top: -6, right: -6, backgroundColor: COLORS.white, borderRadius: RADIUS.full },
  addFotoBtn: {
    width: FOTO_SIZE, height: FOTO_SIZE, borderRadius: RADIUS.md,
    borderWidth: 2, borderColor: COLORS.primary, borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.primarySoft,
  },
  addFotoText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 2 },
  fotosCount: { fontSize: 13, color: COLORS.textLight, marginTop: SPACING.sm, textAlign: 'right' },
  fotoActions: { marginTop: SPACING.md },
  cameraBtn: {
    flexDirection: 'row', alignItems: 'center', gap: SPACING.sm,
    paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: COLORS.primary,
    alignSelf: 'flex-start',
  },
  cameraBtnText: { fontSize: 15, color: COLORS.primary, fontWeight: '600' },
  skipBtn: { alignItems: 'center', paddingVertical: SPACING.md },
  skipText: { fontSize: 15, color: COLORS.textLight, textDecorationLine: 'underline' },
});
