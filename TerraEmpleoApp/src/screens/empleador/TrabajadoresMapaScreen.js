import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TextInput, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centerWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Cargando mapa de trabajadores...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Mapa de trabajadores</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {filtrados.length} trabajador{filtrados.length !== 1 ? 'es' : ''} visible{filtrados.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View style={[styles.searchWrap, { backgroundColor: isDark ? colors.surface : '#F9FAFB', borderColor: colors.border }]}> 
        <Ionicons name="search" size={17} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.textPrimary }]}
          placeholder="Buscar por nombre, zona o habilidad"
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={[styles.mapWrap, { borderColor: colors.border }]}> 
        <MapView
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
          initialRegion={region}
          onRegionChangeComplete={setRegion}
          showsUserLocation
          showsMyLocationButton={false}
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
      </View>

      {seleccionado ? (
        <View style={[styles.footerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={{ flex: 1 }}>
            <Text style={[styles.workerName, { color: colors.textPrimary }]} numberOfLines={1}>{seleccionado.nombre_completo}</Text>
            <Text style={[styles.workerMeta, { color: colors.textSecondary }]} numberOfLines={1}>
              {[seleccionado.municipio, seleccionado.departamento].filter(Boolean).join(', ') || 'Ubicación sin detalle'}
            </Text>
            <View style={styles.ratingRow}>
              <Ionicons name="star" size={14} color={COLORS.star} />
              <Text style={[styles.workerMeta, { color: colors.textSecondary }]}> 
                {seleccionado.calificacion_promedio > 0 ? seleccionado.calificacion_promedio.toFixed(1) : 'Sin calificación'}
              </Text>
            </View>
          </View>

          <AnimatedPressable
            style={styles.btnPerfil}
            onPress={() => irPerfil(seleccionado)}
            scaleValue={0.96}
            haptic
          >
            <Ionicons name="person-outline" size={14} color={COLORS.white} />
            <Text style={styles.btnPerfilText}>Ver perfil</Text>
          </AnimatedPressable>
        </View>
      ) : (
        <View style={[styles.emptyWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Ionicons name="map-outline" size={22} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No hay trabajadores para mostrar con ese filtro.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: SPACING.sm },
  loadingText: { fontSize: 14 },
  header: { paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, paddingBottom: 8 },
  title: { fontSize: 20, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.sm,
    marginBottom: SPACING.sm,
    gap: 6,
    height: 42,
  },
  searchInput: { flex: 1, fontSize: 14 },
  mapWrap: {
    flex: 1,
    marginHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  footerCard: {
    margin: SPACING.md,
    marginTop: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    ...SHADOWS.card,
  },
  workerName: { fontSize: 16, fontWeight: '700' },
  workerMeta: { fontSize: 13 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  btnPerfil: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  btnPerfilText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  emptyWrap: {
    margin: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13 },
});