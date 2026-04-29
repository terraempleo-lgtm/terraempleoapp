import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, Platform, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, vacantesAPI } from '../../services/api';
import { AnimatedPressable } from '../../components/animated';
import { showAlert } from '../../utils/alertService';

const DEFAULT_REGION = {
  latitude: 5.5,
  longitude: -74.5,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

// Coordenadas por municipio (más precisas) - misma estrategia usada en VacantesMapa.
const MUNICIPIO_COORDS = {
  Chinchina: { latitude: 5.0037, longitude: -75.6097 },
  'Chinchiná': { latitude: 5.0037, longitude: -75.6097 },
  Manizales: { latitude: 5.07, longitude: -75.5174 },
  Anserma: { latitude: 5.2167, longitude: -75.7833 },
  Riosucio: { latitude: 5.42, longitude: -75.71 },
  'Ríosucio': { latitude: 5.42, longitude: -75.71 },
  Supia: { latitude: 5.455, longitude: -75.638 },
  'Supía': { latitude: 5.455, longitude: -75.638 },
  Salamina: { latitude: 5.4029, longitude: -75.4828 },
  Armenia: { latitude: 4.5339, longitude: -75.6811 },
  Salento: { latitude: 4.6369, longitude: -75.5736 },
  Montenegro: { latitude: 4.566, longitude: -75.7479 },
  Calarca: { latitude: 4.517, longitude: -75.643 },
  'Calarcá': { latitude: 4.517, longitude: -75.643 },
  Pereira: { latitude: 4.8087, longitude: -75.6906 },
  Medellin: { latitude: 6.2442, longitude: -75.5812 },
  'Medellín': { latitude: 6.2442, longitude: -75.5812 },
  Rionegro: { latitude: 6.1547, longitude: -75.3741 },
  'Ibagué': { latitude: 4.4389, longitude: -75.2322 },
  Ibague: { latitude: 4.4389, longitude: -75.2322 },
  Cali: { latitude: 3.4516, longitude: -76.532 },
  Neiva: { latitude: 2.9273, longitude: -75.2819 },
  Pasto: { latitude: 1.2136, longitude: -77.2811 },
  Popayan: { latitude: 2.4448, longitude: -76.6147 },
  'Popayán': { latitude: 2.4448, longitude: -76.6147 },
  Bogota: { latitude: 4.711, longitude: -74.0721 },
  'Bogotá': { latitude: 4.711, longitude: -74.0721 },
  Tunja: { latitude: 5.5353, longitude: -73.3678 },
  Bucaramanga: { latitude: 7.1194, longitude: -73.1227 },
  Villavicencio: { latitude: 4.142, longitude: -73.6266 },
  Barranquilla: { latitude: 10.9639, longitude: -74.7964 },
  Cartagena: { latitude: 10.391, longitude: -75.4794 },
};

const DEPT_COORDS = {
  Amazonas: { latitude: -1.4429, longitude: -71.5724 },
  Antioquia: { latitude: 6.701, longitude: -75.5873 },
  Arauca: { latitude: 6.5477, longitude: -71.002 },
  Atlantico: { latitude: 10.6966, longitude: -74.8741 },
  'Atlantico': { latitude: 10.6966, longitude: -74.8741 },
  'Atlántico': { latitude: 10.6966, longitude: -74.8741 },
  Bolivar: { latitude: 8.6704, longitude: -74.03 },
  'Bolívar': { latitude: 8.6704, longitude: -74.03 },
  Boyaca: { latitude: 5.4545, longitude: -73.362 },
  'Boyacá': { latitude: 5.4545, longitude: -73.362 },
  Caldas: { latitude: 5.098, longitude: -75.62 },
  Caqueta: { latitude: 1.0144, longitude: -74.8125 },
  'Caquetá': { latitude: 1.0144, longitude: -74.8125 },
  Casanare: { latitude: 5.7589, longitude: -71.5724 },
  Cauca: { latitude: 2.7097, longitude: -76.6413 },
  Cesar: { latitude: 9.3373, longitude: -73.6536 },
  Choco: { latitude: 5.6917, longitude: -76.6583 },
  'Chocó': { latitude: 5.6917, longitude: -76.6583 },
  Cordoba: { latitude: 8.3491, longitude: -75.8873 },
  'Córdoba': { latitude: 8.3491, longitude: -75.8873 },
  Cundinamarca: { latitude: 4.5981, longitude: -74.0758 },
  Guainia: { latitude: 2.5854, longitude: -68.5247 },
  'Guainía': { latitude: 2.5854, longitude: -68.5247 },
  Guaviare: { latitude: 2.0408, longitude: -72.3356 },
  Huila: { latitude: 2.5359, longitude: -75.5277 },
  Guajira: { latitude: 11.3548, longitude: -72.5205 },
  'La Guajira': { latitude: 11.3548, longitude: -72.5205 },
  Magdalena: { latitude: 10.4113, longitude: -74.4057 },
  Meta: { latitude: 3.9928, longitude: -73.2667 },
  Narino: { latitude: 1.2892, longitude: -77.3579 },
  'Nariño': { latitude: 1.2892, longitude: -77.3579 },
  'Norte de Santander': { latitude: 7.9463, longitude: -72.8988 },
  Putumayo: { latitude: 0.436, longitude: -76.6413 },
  Quindio: { latitude: 4.5339, longitude: -75.6811 },
  'Quindío': { latitude: 4.5339, longitude: -75.6811 },
  Risaralda: { latitude: 4.983, longitude: -75.741 },
  Santander: { latitude: 6.6437, longitude: -73.6536 },
  Sucre: { latitude: 8.8109, longitude: -74.7233 },
  Tolima: { latitude: 4.0925, longitude: -75.1545 },
  'Valle del Cauca': { latitude: 3.8009, longitude: -76.6413 },
  Vaupes: { latitude: 0.8554, longitude: -70.8119 },
  'Vaupés': { latitude: 0.8554, longitude: -70.8119 },
  Vichada: { latitude: 4.4233, longitude: -69.2878 },
};

function hashNum(input) {
  const txt = String(input || '0');
  let hash = 0;
  for (let i = 0; i < txt.length; i += 1) {
    hash = ((hash << 5) - hash) + txt.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function normalizeCoordinates(item) {
  const lat = Number(item.latitud);
  const lng = Number(item.longitud);
  if (Number.isFinite(lat) && Number.isFinite(lng) && (Math.abs(lat) > 0.0001 || Math.abs(lng) > 0.0001)) {
    return { latitude: lat, longitude: lng };
  }

  const mun = item.municipio ? MUNICIPIO_COORDS[item.municipio] : null;
  if (mun) {
    const seed = hashNum(item.id);
    const dLat = ((seed % 100) / 100 - 0.5) * 0.08;
    const dLng = ((((seed / 100) | 0) % 100) / 100 - 0.5) * 0.08;
    return {
      latitude: mun.latitude + dLat,
      longitude: mun.longitude + dLng,
    };
  }

  const dept = DEPT_COORDS[item.departamento] || null;
  if (!dept) return null;

  const seed = hashNum(item.id);
  const dLat = ((seed % 100) / 100 - 0.5) * 0.22;
  const dLng = ((((seed / 100) | 0) % 100) / 100 - 0.5) * 0.22;

  return {
    latitude: dept.latitude + dLat,
    longitude: dept.longitude + dLng,
  };
}

export default function TrabajadoresMapaScreen({ navigation, route }) {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [trabajadores, setTrabajadores] = useState([]);
  const [vacanteContacto, setVacanteContacto] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState(route?.params?.search || '');

  const cargarVacante = useCallback(async () => {
    try {
      const res = await vacantesAPI.misVacantes();
      const vacantes = res.data?.vacantes || [];
      const activa = vacantes.find((v) => v.estado === 'activa') || vacantes[0] || null;
      setVacanteContacto(activa ? { id: Number(activa.id), titulo: activa.titulo } : null);
    } catch (_) {
      setVacanteContacto(null);
    }
  }, []);

  const cargarTrabajadores = useCallback(async () => {
    try {
      const res = await trabajadoresAPI.listar({ orden: 'match' });
      const lista = (res.data?.trabajadores || [])
        .map((item) => {
          const coords = normalizeCoordinates(item);
          if (!coords) return null;
          return {
            ...item,
            ...coords,
            calificacion_promedio: Number(item.calificacion_promedio || 0),
          };
        })
        .filter(Boolean);

      setTrabajadores(lista);
      if (lista.length > 0) {
        setSelectedId(Number(lista[0].id));
      }
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo cargar el mapa de trabajadores');
    }
  }, []);

  const centrarEnUsuario = useCallback(async () => {
    try {
      const permisos = await Location.requestForegroundPermissionsAsync();
      if (permisos.status !== 'granted') return;
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRegion((prev) => ({
        ...prev,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }));
    } catch (_) {
      // No bloqueamos mapa si geolocalizacion falla.
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.all([cargarTrabajadores(), cargarVacante(), centrarEnUsuario()]);
      if (active) setLoading(false);
    };
    init();
    return () => { active = false; };
  }, [cargarTrabajadores, cargarVacante, centrarEnUsuario]);

  const filtrados = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return trabajadores;
    return trabajadores.filter((t) =>
      String(t.nombre_completo || '').toLowerCase().includes(q) ||
      String(t.municipio || '').toLowerCase().includes(q) ||
      String(t.departamento || '').toLowerCase().includes(q) ||
      (t.cultivos || []).some((c) => String(c).toLowerCase().includes(q)) ||
      (t.habilidades || []).some((h) => String(h).toLowerCase().includes(q))
    );
  }, [trabajadores, search]);

  const seleccionado = useMemo(
    () => filtrados.find((t) => Number(t.id) === Number(selectedId)) || filtrados[0] || null,
    [filtrados, selectedId]
  );

  const irPerfil = (item) => {
    if (!item?.id) return;
    navigation.navigate('PerfilPublicoTrabajador', {
      trabajador_id: item.id,
      vacante_id: vacanteContacto?.id,
    });
  };

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Fullscreen map */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {filtrados.map((t) => (
          <Marker
            key={String(t.id)}
            coordinate={{ latitude: t.latitude, longitude: t.longitude }}
            pinColor={Number(t.id) === Number(seleccionado?.id) ? COLORS.warning : COLORS.primary}
            onPress={() => setSelectedId(Number(t.id))}
          />
        ))}
      </MapView>

      {/* Top overlay — search bar */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color="#9E9E9E" />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar por nombre, zona o habilidad"
            placeholderTextColor="#9E9E9E"
            value={search}
            onChangeText={setSearch}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={17} color="#9E9E9E" />
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Bottom card */}
      <View style={[styles.bottomCard, { paddingBottom: insets.bottom + SPACING.md }]}>
        {seleccionado ? (
          <View style={styles.workerRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.workerName} numberOfLines={1}>{seleccionado.nombre_completo}</Text>
              <Text style={styles.workerMeta} numberOfLines={1}>
                {[seleccionado.municipio, seleccionado.departamento].filter(Boolean).join(', ') || 'Sin ubicación'}
              </Text>
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={COLORS.warning} />
                <Text style={styles.workerMeta}>
                  {seleccionado.calificacion_promedio > 0 ? seleccionado.calificacion_promedio.toFixed(1) : 'Sin calificación'}
                </Text>
              </View>
            </View>
            <AnimatedPressable style={styles.btnPerfil} onPress={() => irPerfil(seleccionado)} scaleValue={0.96} haptic>
              <Ionicons name="person-outline" size={14} color={COLORS.white} />
              <Text style={styles.btnPerfilText}>Ver perfil</Text>
            </AnimatedPressable>
          </View>
        ) : (
          <View style={styles.emptyRow}>
            <Ionicons name="map-outline" size={20} color="#9E9E9E" />
            <Text style={styles.emptyText}>No hay trabajadores con ese filtro.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, zIndex: 10,
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, height: 50,
    borderWidth: 1, borderColor: '#E0E0E0',
    ...SHADOWS.medium,
  },
  searchInput: { flex: 1, fontSize: 14, color: '#212121', paddingVertical: 0 },
  bottomCard: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: SPACING.lg, paddingTop: SPACING.md,
    ...SHADOWS.large,
  },
  workerRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  workerName: { fontSize: 16, fontWeight: '700', color: '#212121' },
  workerMeta: { fontSize: 13, color: '#757575', marginTop: 2 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  btnPerfil: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: RADIUS.full,
  },
  btnPerfilText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: SPACING.sm },
  emptyText: { fontSize: 13, color: '#757575' },
});