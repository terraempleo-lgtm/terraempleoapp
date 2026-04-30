import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Alert,
  KeyboardAvoidingView, Platform, TouchableOpacity, Switch, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { Button, Input, ChipSelector, PickerModal, FechaInicioField } from '../../components/ui';
import { CULTIVOS, LABORES, TIPO_PAGO_OPTIONS } from '../../data/options';
import { DEPARTAMENTOS, getMunicipios } from '../../data/colombia';
import { getFechaInicioPayload } from '../../utils/vacantesFecha';
import { formatearMontoInput, normalizarMontoPayload } from '../../utils/vacantesPago';
import { vacantesAPI } from '../../services/api';
import { Ionicons } from '@expo/vector-icons';
import { showAlert } from '../../utils/alertService';

export default function CrearVacanteScreen({ navigation }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [cultivosV, setCultivosV] = useState([]);
  const [laboresV, setLaboresV] = useState([]);
  const [tipoPago, setTipoPago] = useState('');
  const [montoPago, setMontoPago] = useState('');
  const [duracion, setDuracion] = useState('');
  const [requisitos, setRequisitos] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  const [departamento, setDepartamento] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [vereda, setVereda] = useState('');
  const [urgente, setUrgente] = useState(false);
  const [alojamiento, setAlojamiento] = useState(false);
  const [alimentacion, setAlimentacion] = useState(false);
  const [otrosBeneficios, setOtrosBeneficios] = useState('');
  const [loading, setLoading] = useState(false);
  const [fotosVacante, setFotosVacante] = useState([]);

  const [showDeptPicker, setShowDeptPicker] = useState(false);
  const [showMunPicker, setShowMunPicker] = useState(false);
  const [errors, setErrors] = useState({});

  const [publicadoExitoso, setPublicadoExitoso] = useState(false);
  const successTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, []);

  const seleccionarFotosVacante = async () => {
    try {
      const disponibles = Math.max(0, 5 - fotosVacante.length);
      if (disponibles === 0) {
        showAlert('Límite alcanzado', 'Puedes subir máximo 5 fotos por vacante.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: disponibles,
      });

      if (result.canceled) return;
      const uris = (result.assets || [])
        .map((asset) => asset?.uri)
        .filter(Boolean);

      if (uris.length === 0) return;

      setFotosVacante((prev) => {
        const merged = [...prev, ...uris];
        return merged.slice(0, 5);
      });
    } catch (_) {
      showAlert('Error', 'No se pudieron seleccionar las fotos. Intenta de nuevo.');
    }
  };

  const eliminarFotoSeleccionada = (uri) => {
    setFotosVacante((prev) => prev.filter((item) => item !== uri));
  };


  const handleCrear = async () => {
    const errs = {};
    if (!titulo.trim()) errs.titulo = 'El título es obligatorio';
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const response = await vacantesAPI.crear({
        titulo,
        descripcion,
        cultivos: cultivosV,
        labores: laboresV,
        tipo_pago: tipoPago || undefined,
        monto_pago: normalizarMontoPayload(montoPago) ?? undefined,
        duracion: duracion.trim() || undefined,
        requisitos: requisitos.trim() || undefined,
        fecha_inicio: getFechaInicioPayload(fechaInicio),
        fecha_fin: getFechaInicioPayload(fechaFin),
        departamento,
        municipio,
        vereda: vereda || undefined,
        urgente,
        ofrece_alojamiento: alojamiento,
        ofrece_alimentacion: alimentacion,
        otros_beneficios: otrosBeneficios.trim() || undefined,
      });

      const vacanteId = response?.data?.vacanteId;
      if (vacanteId && fotosVacante.length > 0) {
        const formData = new FormData();
        for (let i = 0; i < fotosVacante.length; i++) {
          const uri = fotosVacante[i];
          if (Platform.OS === 'web') {
            const fotoResp = await fetch(uri);
            const blob = await fotoResp.blob();
            formData.append('fotos', blob, `vacante_${vacanteId}_${i}.jpg`);
          } else {
            formData.append('fotos', {
              uri,
              type: 'image/jpeg',
              name: `vacante_${vacanteId}_${i}.jpg`,
            });
          }
        }
        await vacantesAPI.subirFotos(vacanteId, formData);
      }

      setPublicadoExitoso(true);
      successTimerRef.current = setTimeout(() => {
        setPublicadoExitoso(false);
        navigation.navigate('EmpleadorHome');
      }, 1800);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'Error al crear la vacante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight }}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 4 }}>
          <Ionicons name="chevron-back" size={26} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={{ fontSize: 17, fontWeight: '700', color: COLORS.textPrimary }}>Nueva Vacante</Text>
        <View style={{ width: 34 }} />
      </View>
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

            <Input label="Monto de pago (COP)" value={formatearMontoInput(montoPago)}
              placeholder="Ej: 1.800.000" keyboardType="numeric" icon="cash-outline"
              onChangeText={(value) => setMontoPago(value.replace(/\D/g, ''))}
            />

            <Input
              label="Duración (opcional)"
              value={duracion}
              onChangeText={setDuracion}
              placeholder="Ej: 3 meses, temporada de cosecha"
              icon="time-outline"
            />

            <Input
              label="Requisitos (opcional)"
              value={requisitos}
              onChangeText={setRequisitos}
              placeholder="Ej: experiencia en poda, disponibilidad para vivir en finca"
              multiline
              numberOfLines={3}
            />

            <FechaInicioField
              label="Fecha de inicio"
              value={fechaInicio}
              onChange={setFechaInicio}
              helper="Indica desde qué fecha necesitas al trabajador"
            />

            <FechaInicioField
              label="Fecha de finalización"
              value={fechaFin}
              onChange={setFechaFin}
              helper="La vacante se cerrará automáticamente después de esta fecha"
            />

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

            <Text style={styles.sectionLabel}>Fotos de la finca o vacante (opcional)</Text>
            <View style={styles.fotosCard}>
              <View style={styles.fotosHeader}>
                <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                <Text style={styles.fotosTitle}>Agregar fotos te da un plus</Text>
              </View>
              <Text style={styles.fotosHelper}>
                Las vacantes con fotos generan más confianza y suelen recibir más postulaciones.
              </Text>

              <TouchableOpacity style={styles.addFotoBtn} onPress={seleccionarFotosVacante}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addFotoBtnText}>Agregar fotos ({fotosVacante.length}/5)</Text>
              </TouchableOpacity>

              {fotosVacante.length > 0 && (
                <View style={styles.fotosPreviewWrap}>
                  {fotosVacante.map((uri) => (
                    <View key={uri} style={styles.fotoThumbWrap}>
                      <Image source={{ uri }} style={styles.fotoThumb} />
                      <TouchableOpacity
                        style={styles.fotoRemoveBtn}
                        onPress={() => eliminarFotoSeleccionada(uri)}
                      >
                        <Ionicons name="close" size={12} color={COLORS.white} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <Button title="Publicar vacante" onPress={handleCrear}
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

      {publicadoExitoso && (
        <View style={styles.successOverlay} pointerEvents="none">
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={32} color={COLORS.primary} />
            <Text style={styles.successText}>Vacante publicada con éxito 🌱</Text>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

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
  fotosCard: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primarySoft,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  fotosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  fotosTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.textPrimary,
  },
  fotosHelper: {
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 19,
  },
  addFotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.md,
    paddingVertical: 9,
  },
  addFotoBtnText: {
    color: COLORS.primary,
    fontWeight: '700',
    fontSize: 13,
  },
  fotosPreviewWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  fotoThumbWrap: {
    position: 'relative',
  },
  fotoThumb: {
    width: 84,
    height: 84,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.borderLight,
  },
  fotoRemoveBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.white,
  },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  successCard: {
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.lg,
    ...SHADOWS.medium,
  },
  successText: { fontSize: 17, fontWeight: '700', color: COLORS.primary },
});
