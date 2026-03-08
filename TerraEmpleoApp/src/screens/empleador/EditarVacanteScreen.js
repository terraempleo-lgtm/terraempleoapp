import React, { useState, useEffect } from 'react';
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
const FOTO_SIZE = (SCREEN_WIDTH - SPACING.md * 2 - SPACING.lg * 2 - SPACING.sm * 2) / 3;

function obtenerNombreFoto(foto, indice) {
  const tipo = foto.type || 'image/jpeg';
  const extension = tipo.includes('/') ? tipo.split('/')[1] : 'jpg';
  return foto.name || `editar_foto_${indice}.${extension}`;
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

export default function EditarVacanteScreen({ navigation, route }) {
  const { vacante } = route.params;

  const [titulo, setTitulo] = useState(vacante.titulo || '');
  const [descripcion, setDescripcion] = useState(vacante.descripcion || '');
  const [cultivosV, setCultivosV] = useState(vacante.cultivos?.map(c => c.cultivo) || []);
  const [laboresV, setLaboresV] = useState(vacante.labores?.map(l => l.labor) || []);
  const [tipoPago, setTipoPago] = useState(vacante.tipo_pago || '');
  const [montoPago, setMontoPago] = useState(vacante.monto_pago ? String(vacante.monto_pago) : '');
  const [departamento, setDepartamento] = useState(vacante.departamento || '');
  const [municipio, setMunicipio] = useState(vacante.municipio || '');
  const [vereda, setVereda] = useState(vacante.vereda || '');
  const [urgente, setUrgente] = useState(!!vacante.urgente);
  const [alojamiento, setAlojamiento] = useState(!!vacante.ofrece_alojamiento);
  const [alimentacion, setAlimentacion] = useState(!!vacante.ofrece_alimentacion);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);

  // Fotos
  const [fotosExistentes, setFotosExistentes] = useState([]);
  const [fotosNuevas, setFotosNuevas] = useState([]);
  const [loadingFotos, setLoadingFotos] = useState(true);

  useEffect(() => {
    const cargarDetalle = async () => {
      try {
        const res = await vacantesAPI.detalle(vacante.id);
        const v = res.data.vacante;
        if (v) {
          setFotosExistentes(v.fotos || []);
          setAlojamiento(!!v.ofrece_alojamiento);
          setAlimentacion(!!v.ofrece_alimentacion);
        }
      } catch (_) {}
      setLoadingFotos(false);
    };
    cargarDetalle();
  }, []);

  const totalFotos = fotosExistentes.length + fotosNuevas.length;

  const pickImage = async () => {
    if (totalFotos >= MAX_FOTOS) {
      Alert.alert('Límite alcanzado', `Máximo ${MAX_FOTOS} fotos por vacante.`);
      return;
    }
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Necesitamos acceso a tu galería.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX_FOTOS - totalFotos,
      quality: 0.8,
      allowsEditing: false,
    });
    if (result.canceled) return;
    const nuevas = result.assets.map(a => ({
      uri: a.uri,
      type: a.mimeType || 'image/jpeg',
      name: a.fileName || null,
      webFile: a.file || null,
      uploading: false,
      uploaded: false,
    }));
    setFotosNuevas(prev => [...prev, ...nuevas].slice(0, MAX_FOTOS - fotosExistentes.length));
  };

  const eliminarFotoExistente = (foto) => {
    Alert.alert('Eliminar foto', '¿Eliminar esta foto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try {
            await vacantesAPI.eliminarFoto(vacante.id, foto.id);
            setFotosExistentes(prev => prev.filter(f => f.id !== foto.id));
          } catch {
            Alert.alert('Error', 'No se pudo eliminar la foto');
          }
        },
      },
    ]);
  };

  const subirFotosNuevas = async () => {
    const pendientes = fotosNuevas.filter((f) => !f.uploaded);
    if (pendientes.length === 0) return;

    const detalle = await vacantesAPI.detalle(vacante.id);
    const totalServidor = detalle.data?.vacante?.fotos?.length || 0;

    if (totalServidor + pendientes.length > MAX_FOTOS) {
      throw new Error(`Máximo ${MAX_FOTOS} fotos por vacante. Tienes ${totalServidor} en el servidor.`);
    }

    for (let i = 0; i < fotosNuevas.length; i++) {
      if (fotosNuevas[i].uploaded) continue;

      setFotosNuevas((prev) => prev.map((f, idx) => idx === i ? { ...f, uploading: true } : f));

      try {
        const formData = new FormData();
        const { archivo, nombre } = await construirArchivoFoto(fotosNuevas[i], i);
        if (Platform.OS === 'web') {
          formData.append('fotos', archivo, nombre);
        } else {
          formData.append('fotos', archivo);
        }
        await vacantesAPI.subirFotos(vacante.id, formData);
        setFotosNuevas((prev) => prev.map((f, idx) => idx === i ? { ...f, uploading: false, uploaded: true } : f));
      } catch (err) {
        setFotosNuevas((prev) => prev.map((f, idx) => idx === i ? { ...f, uploading: false } : f));
        const mensaje = err.response?.data?.error || 'No se pudo subir una foto.';
        throw new Error(mensaje);
      }
    }
  };

  const handleGuardar = async () => {
    if (!titulo.trim()) {
      setErrors({ titulo: 'El título es obligatorio' });
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await vacantesAPI.actualizar(vacante.id, {
        titulo,
        descripcion: descripcion || null,
        cultivos: cultivosV,
        labores: laboresV,
        tipo_pago: tipoPago || null,
        monto_pago: montoPago ? parseFloat(montoPago) : null,
        departamento: departamento || null,
        municipio: municipio || null,
        vereda: vereda || null,
        urgente,
        ofrece_alojamiento: alojamiento,
        ofrece_alimentacion: alimentacion,
      });

      if (fotosNuevas.some((f) => !f.uploaded)) {
        await subirFotosNuevas();
      }

      Alert.alert('Éxito', 'Vacante actualizada correctamente', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      Alert.alert('Error', err.response?.data?.error || err.message || 'Error al actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>

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
            <ChipSelector
              options={TIPO_PAGO_OPTIONS.map(t => t.label)}
              selected={tipoPago ? [TIPO_PAGO_OPTIONS.find(t => t.value === tipoPago)?.label].filter(Boolean) : []}
              onSelectionChange={(sel) => {
                const tp = TIPO_PAGO_OPTIONS.find(t => t.label === sel[sel.length - 1]);
                setTipoPago(tp?.value || '');
              }}
              multiSelect={false}
              allowCustom={false}
            />

            <Input label="Monto de pago (COP)" value={montoPago} onChangeText={setMontoPago}
              placeholder="Ej: 50000" keyboardType="numeric" icon="cash-outline" />

            <Text style={styles.sectionLabel}>Ubicación</Text>
            <TouchableOpacity style={styles.pickerButton} onPress={() => setShowDeptPicker(true)}>
              <Ionicons name="location-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !departamento && { color: COLORS.textLight }]}>
                {departamento || 'Departamento'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.pickerButton, !departamento && { opacity: 0.5 }]}
              onPress={() => departamento && setShowMunPicker(true)}
              disabled={!departamento}
            >
              <Ionicons name="map-outline" size={20} color={COLORS.primary} />
              <Text style={[styles.pickerText, !municipio && { color: COLORS.textLight }]}>
                {municipio || 'Municipio'}
              </Text>
            </TouchableOpacity>
            <Input label="Vereda (opcional)" value={vereda} onChangeText={setVereda} placeholder="Vereda" />

            {/* Beneficios */}
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

            <View style={styles.urgentRow}>
              <View>
                <Text style={styles.urgentLabel}>¿Es urgente?</Text>
                <Text style={styles.urgentDesc}>Se destacará en las búsquedas</Text>
              </View>
              <Switch value={!!urgente} onValueChange={setUrgente}
                trackColor={{ false: COLORS.border, true: COLORS.urgent }}
                thumbColor={urgente ? '#fff' : '#f4f3f4'} />
            </View>

            {/* Fotos */}
            <Text style={styles.sectionLabel}>Fotos de la vacante</Text>
            {loadingFotos ? (
              <ActivityIndicator color={COLORS.primary} style={{ marginVertical: SPACING.md }} />
            ) : (
              <>
                <View style={styles.fotosGrid}>
                  {fotosExistentes.map((foto) => (
                    <View key={`ex-${foto.id}`} style={styles.fotoItem}>
                      <Image source={{ uri: foto.url }} style={styles.fotoThumb} resizeMode="cover" />
                      <TouchableOpacity style={styles.fotoDeleteBtn} onPress={() => eliminarFotoExistente(foto)}>
                        <Ionicons name="close-circle" size={22} color="#E53935" />
                      </TouchableOpacity>
                    </View>
                  ))}
                  {fotosNuevas.map((foto, i) => (
                    <View key={`new-${i}`} style={styles.fotoItem}>
                      <Image source={{ uri: foto.uri }} style={styles.fotoThumb} resizeMode="cover" />
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
                      {!foto.uploading && (
                        <TouchableOpacity
                          style={styles.fotoDeleteBtn}
                          onPress={() => setFotosNuevas(prev => prev.filter((_, idx) => idx !== i))}
                        >
                          <Ionicons name="close-circle" size={22} color="#E53935" />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                  {totalFotos < MAX_FOTOS && (
                    <TouchableOpacity style={styles.addFotoBtn} onPress={pickImage}>
                      <Ionicons name="add" size={32} color={COLORS.primary} />
                      <Text style={styles.addFotoText}>Agregar</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={styles.fotosCount}>{totalFotos}/{MAX_FOTOS} fotos</Text>
              </>
            )}

            <Button title="Guardar cambios" onPress={handleGuardar}
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scrollContent: { padding: SPACING.md },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.lg, ...SHADOWS.medium },
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
  urgentRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.urgentBg, padding: SPACING.md, borderRadius: RADIUS.md, marginTop: SPACING.sm,
  },
  urgentLabel: { fontSize: 16, fontWeight: '600', color: COLORS.urgent },
  urgentDesc: { fontSize: 13, color: COLORS.textSecondary },
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
});
