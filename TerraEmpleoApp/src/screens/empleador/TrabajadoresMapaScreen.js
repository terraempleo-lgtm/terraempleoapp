import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ActivityIndicator, TextInput, Platform,
  TouchableOpacity, FlatList, Image, Dimensions, ScrollView,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import MapView, { Marker, PROVIDER_DEFAULT, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { useAppTheme } from '../../context/ThemeContext';
import { trabajadoresAPI, vacantesAPI } from '../../services/api';
import { showAlert } from '../../utils/alertService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_GAP = 12;

const DEFAULT_REGION = {
  latitude: 5.5,
  longitude: -74.5,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

// ─── Coordinate helpers ───────────────────────────────────────────────────────

const MUNICIPIO_COORDS = {
  'Chinchiná': { latitude: 5.0037, longitude: -75.6097 },
  'Manizales': { latitude: 5.07, longitude: -75.5174 },
  'Anserma': { latitude: 5.2167, longitude: -75.7833 },
  'Riosucio': { latitude: 5.42, longitude: -75.71 },
  'Supía': { latitude: 5.455, longitude: -75.638 },
  'Salamina': { latitude: 5.4029, longitude: -75.4828 },
  'Armenia': { latitude: 4.5339, longitude: -75.6811 },
  'Salento': { latitude: 4.6369, longitude: -75.5736 },
  'Montenegro': { latitude: 4.566, longitude: -75.7479 },
  'Calarcá': { latitude: 4.517, longitude: -75.643 },
  'Pereira': { latitude: 4.8087, longitude: -75.6906 },
  'Medellín': { latitude: 6.2442, longitude: -75.5812 },
  'Rionegro': { latitude: 6.1547, longitude: -75.3741 },
  'Jardín': { latitude: 5.5997, longitude: -75.8236 },
  'Andes': { latitude: 5.6561, longitude: -75.8808 },
  'Fredonia': { latitude: 5.9352, longitude: -75.6734 },
  'Ibagué': { latitude: 4.4389, longitude: -75.2322 },
  'Cali': { latitude: 3.4516, longitude: -76.532 },
  'Neiva': { latitude: 2.9273, longitude: -75.2819 },
  'Pasto': { latitude: 1.2136, longitude: -77.2811 },
  'Popayán': { latitude: 2.4448, longitude: -76.6147 },
  'Bogotá': { latitude: 4.711, longitude: -74.0721 },
  'Tunja': { latitude: 5.5353, longitude: -73.3678 },
  'Bucaramanga': { latitude: 7.1194, longitude: -73.1227 },
  'Villavicencio': { latitude: 4.142, longitude: -73.6266 },
  'Barranquilla': { latitude: 10.9639, longitude: -74.7964 },
  'Cartagena': { latitude: 10.391, longitude: -75.4794 },
};

const DEPT_COORDS = {
  'Antioquia': { latitude: 6.701, longitude: -75.5873 },
  'Atlántico': { latitude: 10.6966, longitude: -74.8741 },
  'Bolívar': { latitude: 8.6704, longitude: -74.03 },
  'Boyacá': { latitude: 5.4545, longitude: -73.362 },
  'Caldas': { latitude: 5.098, longitude: -75.62 },
  'Cauca': { latitude: 2.7097, longitude: -76.6413 },
  'Cundinamarca': { latitude: 4.5981, longitude: -74.0758 },
  'Huila': { latitude: 2.5359, longitude: -75.5277 },
  'La Guajira': { latitude: 11.3548, longitude: -72.5205 },
  'Meta': { latitude: 3.9928, longitude: -73.2667 },
  'Nariño': { latitude: 1.2892, longitude: -77.3579 },
  'Norte de Santander': { latitude: 7.9463, longitude: -72.8988 },
  'Quindío': { latitude: 4.5339, longitude: -75.6811 },
  'Risaralda': { latitude: 4.983, longitude: -75.741 },
  'Santander': { latitude: 6.6437, longitude: -73.6536 },
  'Tolima': { latitude: 4.0925, longitude: -75.1545 },
  'Valle del Cauca': { latitude: 3.8009, longitude: -76.6413 },
};

const coordOffsets = new Map();
function getOrCreateOffset(id) {
  if (!coordOffsets.has(id)) {
    coordOffsets.set(id, {
      dLat: (Math.random() - 0.5) * 0.12,
      dLon: (Math.random() - 0.5) * 0.12,
    });
  }
  return coordOffsets.get(id);
}

function resolveCoords(item) {
  const lat = parseFloat(item.latitud);
  const lon = parseFloat(item.longitud);
  if (Number.isFinite(lat) && Number.isFinite(lon) && (Math.abs(lat) > 0.001 || Math.abs(lon) > 0.001)) {
    return { latitude: lat, longitude: lon };
  }
  const mun = item.municipio ? MUNICIPIO_COORDS[item.municipio] : null;
  if (mun) {
    const { dLat, dLon } = getOrCreateOffset(String(item.id));
    return { latitude: mun.latitude + dLat * 0.5, longitude: mun.longitude + dLon * 0.5 };
  }
  const dept = DEPT_COORDS[item.departamento];
  if (!dept) return null;
  const { dLat, dLon } = getOrCreateOffset(String(item.id));
  return { latitude: dept.latitude + dLat, longitude: dept.longitude + dLon };
}

// ─── CustomMarker ─────────────────────────────────────────────────────────────

function CustomMarker({ selected, foto, nombre }) {
  const initials = (nombre || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  return (
    <View style={mkStyles.wrap}>
      {selected && (
        <View style={mkStyles.callout}>
          <Text style={mkStyles.calloutText} numberOfLines={1}>{(nombre || '').split(' ')[0]}</Text>
        </View>
      )}
      <View style={[mkStyles.bubble, selected && mkStyles.bubbleSelected]}>
        {foto ? (
          <Image source={{ uri: foto }} style={mkStyles.foto} />
        ) : (
          <Text style={mkStyles.initials}>{initials}</Text>
        )}
      </View>
      <View style={[mkStyles.tail, { borderTopColor: selected ? COLORS.primary : '#546E7A' }]} />
    </View>
  );
}

const mkStyles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  callout: {
    backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, marginBottom: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 5, maxWidth: 140,
  },
  calloutText: { fontSize: 11, fontWeight: '700', color: '#212121' },
  bubble: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#546E7A',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#FFF',
    overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  bubbleSelected: { width: 46, height: 46, borderRadius: 23, borderColor: COLORS.primary, backgroundColor: COLORS.primary },
  foto: { width: 38, height: 38, borderRadius: 19 },
  initials: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
});

// ─── WorkerCard ───────────────────────────────────────────────────────────────

function WorkerCard({ worker, selected, onPress }) {
  const initials = (worker.nombre_completo || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  const cal = Number(worker.calificacion_promedio || 0);
  const cultivos = (worker.cultivos || []).slice(0, 3);
  const ubicacion = [worker.municipio, worker.departamento].filter(Boolean).join(', ');

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}
      style={[wcStyles.card, selected && wcStyles.cardSelected]}>
      <View style={wcStyles.avatarWrap}>
        {worker.foto_selfie ? (
          <Image source={{ uri: worker.foto_selfie }} style={wcStyles.avatar} />
        ) : (
          <View style={wcStyles.avatarFallback}>
            <Text style={wcStyles.initials}>{initials}</Text>
          </View>
        )}
      </View>
      <View style={wcStyles.info}>
        <Text style={wcStyles.name} numberOfLines={1}>{worker.nombre_completo}</Text>
        <View style={wcStyles.locationRow}>
          <Ionicons name="location-outline" size={11} color="#9E9E9E" />
          <Text style={wcStyles.locationText} numberOfLines={1}>{ubicacion || 'Sin ubicación'}</Text>
        </View>
        {cal > 0 && (
          <View style={wcStyles.ratingRow}>
            <Ionicons name="star" size={12} color="#F59E0B" />
            <Text style={wcStyles.ratingText}>{cal.toFixed(1)}</Text>
          </View>
        )}
        {cultivos.length > 0 && (
          <View style={wcStyles.chipsRow}>
            {cultivos.map((c, i) => (
              <View key={i} style={wcStyles.chip}>
                <Text style={wcStyles.chipText}>{c.cultivo || c}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

const wcStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, flexDirection: 'row',
    backgroundColor: '#FFF', borderRadius: 18,
    overflow: 'hidden', ...SHADOWS.large, padding: 12, gap: 10,
  },
  cardSelected: { borderWidth: 2, borderColor: COLORS.primary },
  avatarWrap: { width: 70, height: 70, borderRadius: 35, overflow: 'hidden', backgroundColor: COLORS.primary + '22' },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avatarFallback: {
    width: 70, height: 70, borderRadius: 35,
    backgroundColor: COLORS.primary + '22',
    justifyContent: 'center', alignItems: 'center',
  },
  initials: { fontSize: 22, fontWeight: '700', color: COLORS.primary },
  info: { flex: 1, justifyContent: 'center', gap: 3 },
  name: { fontSize: 14, fontWeight: '700', color: '#212121' },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  locationText: { fontSize: 11, color: '#9E9E9E', flex: 1 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  ratingText: { fontSize: 12, fontWeight: '600', color: '#212121' },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  chip: { backgroundColor: COLORS.primary + '15', borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  chipText: { fontSize: 10, fontWeight: '600', color: COLORS.primary },
});

// ─── FloatingMapControls ──────────────────────────────────────────────────────

function FloatingMapControls({ onZoomIn, onZoomOut, onLocate }) {
  return (
    <View style={fmcStyles.wrap}>
      <TouchableOpacity onPress={onZoomIn} style={fmcStyles.btn} activeOpacity={0.8}>
        <Ionicons name="add" size={22} color="#424242" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onZoomOut} style={fmcStyles.btn} activeOpacity={0.8}>
        <Ionicons name="remove" size={22} color="#424242" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onLocate} style={[fmcStyles.btn, fmcStyles.btnAccent]} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#FFF" />
      </TouchableOpacity>
    </View>
  );
}

const fmcStyles = StyleSheet.create({
  wrap: { gap: 10 },
  btn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFF', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
  },
  btnAccent: { backgroundColor: COLORS.primary },
});

// ─── FilterChip ───────────────────────────────────────────────────────────────

function FilterChip({ label, icon, active, onPress }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[chipStyles.chip, active && chipStyles.chipActive]}
    >
      {icon && <Ionicons name={icon} size={12} color={active ? '#0E1410' : '#555'} style={{ marginRight: 3 }} />}
      <Text style={[chipStyles.label, active && chipStyles.labelActive]}>{label}</Text>
      {active && (
        <Ionicons name="close" size={12} color="#0E1410" style={{ marginLeft: 2 }} />
      )}
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderRadius: 99, paddingHorizontal: 11, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.08)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 2, elevation: 2,
  },
  chipActive: { backgroundColor: '#c1ff72', borderColor: '#a3d95e' },
  label: { fontSize: 12, fontWeight: '600', color: '#424242' },
  labelActive: { color: '#0E1410' },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function TrabajadoresMapaScreen({ navigation, route }) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const mapRef = useRef(null);
  const carouselRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState(DEFAULT_REGION);
  const [rawWorkers, setRawWorkers] = useState([]);
  const [vacanteContacto, setVacanteContacto] = useState(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [search, setSearch] = useState(route?.params?.search || '');
  const [userLocation, setUserLocation] = useState(null);

  // Active filters
  const [filterCultivo, setFilterCultivo] = useState(null);
  const [filterEducacion, setFilterEducacion] = useState(false);
  const [filterDept, setFilterDept] = useState(null);
  const [filterMunicipio, setFilterMunicipio] = useState(null);

  const cargarVacante = useCallback(async () => {
    try {
      const res = await vacantesAPI.misVacantes();
      const vacantes = res.data?.vacantes || [];
      const activa = vacantes.find(v => v.estado === 'activa') || vacantes[0] || null;
      setVacanteContacto(activa ? { id: Number(activa.id), titulo: activa.titulo } : null);
    } catch (_) {}
  }, []);

  const cargarTrabajadores = useCallback(async () => {
    try {
      const res = await trabajadoresAPI.listar({ orden: 'match' });
      const lista = (res.data?.trabajadores || [])
        .map(item => {
          const coords = resolveCoords(item);
          if (!coords) return null;
          return { ...item, ...coords, calificacion_promedio: Number(item.calificacion_promedio || 0) };
        })
        .filter(Boolean);
      setRawWorkers(lista);
    } catch (err) {
      showAlert('Error', err.response?.data?.error || 'No se pudo cargar el mapa de trabajadores');
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.all([cargarTrabajadores(), cargarVacante()]);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (active) setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        }
      } catch (_) {}
      if (active) setLoading(false);
    };
    init();
    return () => { active = false; };
  }, [cargarTrabajadores, cargarVacante]);

  // Derive available filter options from data
  const cultivoOptions = useMemo(() => {
    const freq = {};
    rawWorkers.forEach(w => {
      (w.cultivos || []).forEach(c => {
        const name = c.cultivo || c;
        if (name) freq[name] = (freq[name] || 0) + 1;
      });
    });
    return Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);
  }, [rawWorkers]);

  const deptOptions = useMemo(() => {
    const depts = new Set();
    rawWorkers.forEach(w => { if (w.departamento) depts.add(w.departamento); });
    return [...depts].sort();
  }, [rawWorkers]);

  const municipioOptions = useMemo(() => {
    const muns = new Set();
    rawWorkers
      .filter(w => !filterDept || w.departamento === filterDept)
      .forEach(w => { if (w.municipio) muns.add(w.municipio); });
    return [...muns].sort();
  }, [rawWorkers, filterDept]);

  const hasEducTecnico = useMemo(() =>
    rawWorkers.some(w => w.nivel_estudios === 'tecnico' || w.nivel_estudios === 'tecnico_tecnologo'),
    [rawWorkers]
  );

  const filtered = useMemo(() => {
    let list = rawWorkers;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(t =>
        String(t.nombre_completo || '').toLowerCase().includes(q) ||
        String(t.municipio || '').toLowerCase().includes(q) ||
        String(t.departamento || '').toLowerCase().includes(q) ||
        (t.cultivos || []).some(c => String(c.cultivo || c).toLowerCase().includes(q)) ||
        (t.habilidades || []).some(h => String(h).toLowerCase().includes(q))
      );
    }
    if (filterCultivo) {
      list = list.filter(t =>
        (t.cultivos || []).some(c => (c.cultivo || c) === filterCultivo)
      );
    }
    if (filterEducacion) {
      list = list.filter(t =>
        t.nivel_estudios === 'tecnico' || t.nivel_estudios === 'tecnico_tecnologo'
      );
    }
    if (filterDept) {
      list = list.filter(t => t.departamento === filterDept);
    }
    if (filterMunicipio) {
      list = list.filter(t => t.municipio === filterMunicipio);
    }
    return list;
  }, [rawWorkers, search, filterCultivo, filterEducacion, filterDept, filterMunicipio]);

  const activeFilterCount = (filterCultivo ? 1 : 0) + (filterEducacion ? 1 : 0) + (filterDept ? 1 : 0) + (filterMunicipio ? 1 : 0);

  // Pan map when selection changes
  useEffect(() => {
    const w = filtered[selectedIndex];
    if (!w) return;
    mapRef.current?.animateToRegion(
      { latitude: w.latitude, longitude: w.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 400,
    );
  }, [selectedIndex]);

  useEffect(() => {
    setSelectedIndex(0);
    const w = filtered[0];
    if (w) {
      mapRef.current?.animateToRegion(
        { latitude: w.latitude, longitude: w.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 }, 400,
      );
    }
  }, [search, filterCultivo, filterEducacion, filterDept]);

  const handleMarkerPress = useCallback((index) => {
    setSelectedIndex(index);
    carouselRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, []);

  const onCarouselScroll = useCallback((e) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
    const clamped = Math.max(0, Math.min(idx, filtered.length - 1));
    if (clamped !== selectedIndex) setSelectedIndex(clamped);
  }, [selectedIndex, filtered.length]);

  const zoomIn = useCallback(() => {
    const next = { ...region, latitudeDelta: Math.max(region.latitudeDelta / 2, 0.002), longitudeDelta: Math.max(region.longitudeDelta / 2, 0.002) };
    mapRef.current?.animateToRegion(next, 300);
  }, [region]);

  const zoomOut = useCallback(() => {
    const next = { ...region, latitudeDelta: Math.min(region.latitudeDelta * 2, 60), longitudeDelta: Math.min(region.longitudeDelta * 2, 60) };
    mapRef.current?.animateToRegion(next, 300);
  }, [region]);

  const locateMe = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 1.5, longitudeDelta: 1.5 }, 400);
    } else {
      showAlert('Ubicación no disponible', 'Activa el permiso de ubicación para centrar el mapa.');
    }
  }, [userLocation]);

  const irPerfil = useCallback((item) => {
    if (!item?.id) return;
    navigation.navigate('PerfilPublicoTrabajador', { trabajador_id: item.id, vacante_id: vacanteContacto?.id });
  }, [navigation, vacanteContacto]);

  if (loading) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={COLORS.primary} style={{ flex: 1 }} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Fullscreen map */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        initialRegion={DEFAULT_REGION}
        onRegionChangeComplete={setRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {filtered.map((w, index) => (
          <Marker
            key={String(w.id)}
            coordinate={{ latitude: w.latitude, longitude: w.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            onPress={() => index === selectedIndex ? irPerfil(w) : handleMarkerPress(index)}
          >
            <CustomMarker
              selected={index === selectedIndex}
              foto={w.foto_selfie}
              nombre={w.nombre_completo}
            />
          </Marker>
        ))}
      </MapView>

      {/* Search bar + filters overlay */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        {/* Search row */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={16} color="#9E9E9E" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar trabajador, zona..."
              placeholderTextColor="#9E9E9E"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={16} color="#9E9E9E" />
              </TouchableOpacity>
            ) : (
              <View style={styles.countBadge}>
                <Text style={styles.countText}>{filtered.length}</Text>
              </View>
            )}
          </View>
          {activeFilterCount > 0 && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => { setFilterCultivo(null); setFilterEducacion(false); setFilterDept(null); setFilterMunicipio(null); }}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={14} color="#0E1410" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersContent}
          style={styles.filtersRow}
        >
          {/* Cultivos */}
          {cultivoOptions.map(cultivo => (
            <FilterChip
              key={cultivo}
              label={cultivo}
              icon="leaf-outline"
              active={filterCultivo === cultivo}
              onPress={() => setFilterCultivo(filterCultivo === cultivo ? null : cultivo)}
            />
          ))}

          {/* Educación técnico */}
          {hasEducTecnico && (
            <FilterChip
              label="Técnico / Tecnólogo"
              icon="school-outline"
              active={filterEducacion}
              onPress={() => setFilterEducacion(v => !v)}
            />
          )}

          {/* Departamentos */}
          {deptOptions.map(dept => (
            <FilterChip
              key={dept}
              label={dept}
              icon="map-outline"
              active={filterDept === dept}
              onPress={() => {
                const next = filterDept === dept ? null : dept;
                setFilterDept(next);
                setFilterMunicipio(null);
              }}
            />
          ))}

          {/* Municipios — shown when no dept filter or after dept selected */}
          {municipioOptions.map(mun => (
            <FilterChip
              key={mun}
              label={mun}
              icon="location-outline"
              active={filterMunicipio === mun}
              onPress={() => setFilterMunicipio(filterMunicipio === mun ? null : mun)}
            />
          ))}
        </ScrollView>
      </SafeAreaView>

      {/* Zoom + locate controls */}
      <View style={styles.fabColumn}>
        <FloatingMapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onLocate={locateMe} />
      </View>

      {/* Carousel */}
      {filtered.length > 0 ? (
        <View style={[styles.carouselWrap, { bottom: tabBarHeight + 8 }]}>
          <FlatList
            ref={carouselRef}
            data={filtered}
            keyExtractor={item => String(item.id)}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
            onMomentumScrollEnd={onCarouselScroll}
            onScrollEndDrag={onCarouselScroll}
            getItemLayout={(_, index) => ({ length: CARD_WIDTH + CARD_GAP, offset: (CARD_WIDTH + CARD_GAP) * index, index })}
            renderItem={({ item, index }) => (
              <WorkerCard
                worker={item}
                selected={index === selectedIndex}
                onPress={() => index === selectedIndex ? irPerfil(item) : handleMarkerPress(index)}
              />
            )}
          />
        </View>
      ) : (
        <View style={[styles.emptyWrap, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.emptyCard}>
            <Ionicons name="people-outline" size={34} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptySub}>
              {search || activeFilterCount > 0
                ? 'No hay trabajadores con estos filtros.'
                : 'No hay trabajadores disponibles en el mapa.'}
            </Text>
            {activeFilterCount > 0 && (
              <TouchableOpacity
                onPress={() => { setFilterCultivo(null); setFilterEducacion(false); setFilterDept(null); setFilterMunicipio(null); }}
                style={styles.clearFiltersBtn}
              >
                <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 10,
  },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.xs, paddingBottom: 6,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFF', borderRadius: RADIUS.full,
    paddingHorizontal: 14, height: 46,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.07)',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 5,
  },
  searchInput: { flex: 1, fontSize: 13, color: '#212121', paddingVertical: 0 },
  countBadge: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#c1ff72', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15, shadowRadius: 3, elevation: 3,
  },

  filtersRow: { maxHeight: 44 },
  filtersContent: {
    paddingHorizontal: SPACING.md, paddingBottom: 8, gap: 8, flexDirection: 'row', alignItems: 'center',
  },

  fabColumn: {
    position: 'absolute', right: SPACING.md, bottom: 210, zIndex: 10,
  },

  carouselWrap: {
    position: 'absolute', bottom: 16, left: 0, right: 0, zIndex: 10,
  },
  carouselContent: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    gap: CARD_GAP,
  },

  emptyWrap: {
    position: 'absolute', bottom: 24, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  emptyCard: {
    backgroundColor: '#FFF', borderRadius: 18, borderWidth: 1, borderColor: '#E5E7EB',
    padding: SPACING.lg, alignItems: 'center', gap: 6,
    marginHorizontal: SPACING.xl, ...SHADOWS.large,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#212121' },
  emptySub: { fontSize: 12, color: '#757575', textAlign: 'center' },
  clearFiltersBtn: {
    marginTop: 4, paddingHorizontal: 16, paddingVertical: 7,
    backgroundColor: COLORS.primary, borderRadius: 99,
  },
  clearFiltersText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
});
