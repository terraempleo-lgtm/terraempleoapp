import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ScrollView,
  Dimensions,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';
import { vacantesAPI } from '../../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────

type Cultivo = 'cafe' | 'cacao' | 'frutas' | 'otros';
type FilterType = 'todos' | Cultivo;

type VacancyBase = {
  id: string;
  titulo: string;
  fincaNombre: string;
  cultivo: Cultivo;
  salarioDia: number;
  rating?: number;
  municipio: string;
  departamento: string;
  latitude: number;
  longitude: number;
  fotoUrl?: string;
  verificada?: boolean;
};

type Vacancy = VacancyBase & { distanciaKm?: number };

// ─── Haversine ────────────────────────────────────────────────────────────────

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// ─── Department centroids (fallback when vacancy has no coordinates) ──────────

const DEPT_COORDS: Record<string, { latitude: number; longitude: number }> = {
  'Amazonas': { latitude: -1.4429, longitude: -71.5724 },
  'Antioquia': { latitude: 7.1986, longitude: -75.3412 },
  'Arauca': { latitude: 6.5477, longitude: -71.0020 },
  'Atlántico': { latitude: 10.6966, longitude: -74.8741 },
  'Bolívar': { latitude: 8.6704, longitude: -74.0300 },
  'Boyacá': { latitude: 5.4545, longitude: -73.3620 },
  'Caldas': { latitude: 5.2983, longitude: -75.2479 },
  'Caquetá': { latitude: 1.0144, longitude: -74.8125 },
  'Casanare': { latitude: 5.7589, longitude: -71.5724 },
  'Cauca': { latitude: 2.7097, longitude: -76.6413 },
  'Cesar': { latitude: 9.3373, longitude: -73.6536 },
  'Chocó': { latitude: 5.6917, longitude: -76.6583 },
  'Córdoba': { latitude: 8.3491, longitude: -75.8873 },
  'Cundinamarca': { latitude: 4.5981, longitude: -74.0758 },
  'Guainía': { latitude: 2.5854, longitude: -68.5247 },
  'Guaviare': { latitude: 2.0408, longitude: -72.3356 },
  'Huila': { latitude: 2.5359, longitude: -75.5277 },
  'La Guajira': { latitude: 11.3548, longitude: -72.5205 },
  'Magdalena': { latitude: 10.4113, longitude: -74.4057 },
  'Meta': { latitude: 3.9928, longitude: -73.2667 },
  'Nariño': { latitude: 1.2892, longitude: -77.3579 },
  'Norte de Santander': { latitude: 7.9463, longitude: -72.8988 },
  'Putumayo': { latitude: 0.4360, longitude: -76.6413 },
  'Quindío': { latitude: 4.4617, longitude: -75.6674 },
  'Risaralda': { latitude: 5.3158, longitude: -76.0000 },
  'San Andrés y Providencia': { latitude: 12.5567, longitude: -81.7185 },
  'Santander': { latitude: 6.6437, longitude: -73.6536 },
  'Sucre': { latitude: 8.8109, longitude: -74.7233 },
  'Tolima': { latitude: 4.0925, longitude: -75.1545 },
  'Valle del Cauca': { latitude: 3.8009, longitude: -76.6413 },
  'Vaupés': { latitude: 0.8554, longitude: -70.8119 },
  'Vichada': { latitude: 4.4233, longitude: -69.2878 },
};

// ─── API → Vacancy mapper ─────────────────────────────────────────────────────

// Random offsets are computed once per vacancy so they don't shift on re-render
const coordOffsets = new Map<string, { dLat: number; dLon: number }>();

function getOrCreateOffset(id: string) {
  if (!coordOffsets.has(id)) {
    coordOffsets.set(id, {
      dLat: (Math.random() - 0.5) * 0.12,
      dLon: (Math.random() - 0.5) * 0.12,
    });
  }
  return coordOffsets.get(id)!;
}

function detectCultivo(cultivos: any[]): Cultivo {
  const names = cultivos.map((c) => (c.cultivo || c || '').toLowerCase());
  if (names.some((n) => n.includes('caf'))) return 'cafe';
  if (names.some((n) => n.includes('cacao'))) return 'cacao';
  if (names.some((n) =>
    n.includes('fru') || n.includes('mora') || n.includes('mango') ||
    n.includes('naranj') || n.includes('banano') || n.includes('plátano') ||
    n.includes('platano') || n.includes('piña') || n.includes('citri') ||
    n.includes('aguacat')
  )) return 'frutas';
  return 'otros';
}

function mapApiVacante(v: any): VacancyBase | null {
  const lat = parseFloat(v.latitud);
  const lon = parseFloat(v.longitud);
  const hasRealCoords = Number.isFinite(lat) && Number.isFinite(lon) && (Math.abs(lat) > 0.001 || Math.abs(lon) > 0.001);

  let latitude: number;
  let longitude: number;

  if (hasRealCoords) {
    latitude = lat;
    longitude = lon;
  } else {
    const dept = DEPT_COORDS[v.departamento];
    if (!dept) return null; // skip if no coords and unknown department
    const { dLat, dLon } = getOrCreateOffset(String(v.id));
    latitude = dept.latitude + dLat;
    longitude = dept.longitude + dLon;
  }

  const cultivos: any[] = v.cultivos || [];
  const salarioDia = Number(v.salario_jornal || v.salario_mensual || v.salario || 0);
  const rating = parseFloat(v.calificacion_promedio || 0) || undefined;

  return {
    id: String(v.id),
    titulo: v.titulo || 'Sin título',
    fincaNombre: v.nombre_empresa_finca || '',
    cultivo: detectCultivo(cultivos),
    salarioDia,
    rating: rating && rating > 0 ? rating : undefined,
    municipio: v.municipio || '',
    departamento: v.departamento || '',
    latitude,
    longitude,
    fotoUrl: v.foto_portada || undefined,
    verificada: v.verificado === 1 || v.verificado === true,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CultivoConfig = { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; emoji: string; color: string };

const CULTIVO_CONFIG: Record<FilterType, CultivoConfig> = {
  todos:  { label: 'Todos',  icon: 'apps-outline',    emoji: '',  color: COLORS.primary },
  cafe:   { label: 'Café',   icon: 'cafe',            emoji: '☕', color: '#6F4E37' },
  cacao:  { label: 'Cacao',  icon: 'leaf',            emoji: '🌿', color: '#4E342E' },
  frutas: { label: 'Frutas', icon: 'nutrition',       emoji: '🍎', color: '#C62828' },
  otros:  { label: 'Otros',  icon: 'construct-outline', emoji: '', color: '#37474F' },
};

const FILTERS: FilterType[] = ['todos', 'cafe', 'cacao', 'frutas'];

function formatPrice(amount: number): string {
  if (!amount || amount === 0) return 'A convenir';
  return `$${amount.toLocaleString('es-CO')} / día`;
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

function SearchBar({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <View style={sbStyles.wrap}>
      <Ionicons name="search" size={18} color="#9E9E9E" />
      <TextInput
        style={sbStyles.input}
        placeholder="Buscar fincas o cultivos..."
        placeholderTextColor="#BDBDBD"
        value={value}
        onChangeText={onChange}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChange('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="close-circle" size={18} color="#BDBDBD" />
        </TouchableOpacity>
      )}
      <View style={sbStyles.divider} />
      <Ionicons name="options-outline" size={18} color="#757575" />
    </View>
  );
}

const sbStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFFFF', borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md, height: 50,
    ...SHADOWS.medium,
  },
  input: { flex: 1, fontSize: 14, color: '#212121', paddingVertical: 0 },
  divider: { width: 1, height: 20, backgroundColor: '#E0E0E0' },
});

// ─── FilterChips ──────────────────────────────────────────────────────────────

function FilterChips({ selected, onSelect }: { selected: FilterType; onSelect: (f: FilterType) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={fcStyles.row}>
      {FILTERS.map((f) => {
        const cfg = CULTIVO_CONFIG[f];
        const active = selected === f;
        return (
          <TouchableOpacity key={f} onPress={() => onSelect(f)}
            style={[fcStyles.chip, active && fcStyles.chipActive]} activeOpacity={0.8}>
            {cfg.emoji
              ? <Text style={fcStyles.emoji}>{cfg.emoji}</Text>
              : <Ionicons name={cfg.icon} size={13} color={active ? '#FFF' : COLORS.primary} />}
            <Text style={[fcStyles.label, active && fcStyles.labelActive]}>{cfg.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const fcStyles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: RADIUS.full, backgroundColor: '#FFFFFF',
    borderWidth: 1.5, borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  chipActive: { backgroundColor: COLORS.primary },
  emoji: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  labelActive: { color: '#FFFFFF' },
});

// ─── CustomMarker ─────────────────────────────────────────────────────────────

function CustomMarker({ vacancy, selected }: { vacancy: Vacancy; selected: boolean }) {
  const cfg = CULTIVO_CONFIG[vacancy.cultivo];
  const bg = selected ? COLORS.primary : cfg.color;
  return (
    <View style={mkStyles.wrap}>
      {selected && (
        <View style={mkStyles.callout}>
          <Text style={mkStyles.calloutText} numberOfLines={1}>{vacancy.titulo}</Text>
        </View>
      )}
      <View style={[mkStyles.bubble, { backgroundColor: bg }, selected && mkStyles.bubbleSelected]}>
        <Ionicons name={cfg.icon} size={selected ? 16 : 13} color="#FFFFFF" />
      </View>
      <View style={[mkStyles.tail, { borderTopColor: bg }]} />
    </View>
  );
}

const mkStyles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  callout: {
    backgroundColor: '#FFFFFF', paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, marginBottom: 5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 5, maxWidth: 170,
  },
  calloutText: { fontSize: 11, fontWeight: '700', color: '#212121' },
  bubble: {
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 2.5, borderColor: '#FFFFFF',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25, shadowRadius: 4, elevation: 5,
  },
  bubbleSelected: { width: 40, height: 40, borderRadius: 20 },
  tail: {
    width: 0, height: 0,
    borderLeftWidth: 6, borderRightWidth: 6, borderTopWidth: 8,
    borderLeftColor: 'transparent', borderRightColor: 'transparent',
    marginTop: -1,
  },
});

// ─── VacancyCard ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_GAP = 12;

function VacancyCard({ vacancy, selected, onPress }: { vacancy: Vacancy; selected: boolean; onPress: () => void }) {
  const cfg = CULTIVO_CONFIG[vacancy.cultivo];
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.88}
      style={[vcStyles.card, selected && vcStyles.cardSelected]}>
      <View style={vcStyles.imgWrap}>
        {vacancy.fotoUrl
          ? <Image source={{ uri: vacancy.fotoUrl }} style={vcStyles.img} resizeMode="cover" />
          : <View style={[vcStyles.imgFallback, { backgroundColor: `${cfg.color}18` }]}>
              <Ionicons name={cfg.icon} size={34} color={cfg.color} />
            </View>}
        {vacancy.verificada && (
          <View style={vcStyles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={10} color="#FFF" />
          </View>
        )}
      </View>
      <View style={vcStyles.info}>
        <Text style={vcStyles.title} numberOfLines={1}>{vacancy.titulo}</Text>
        <Text style={vcStyles.farm} numberOfLines={1}>{vacancy.fincaNombre}</Text>
        <View style={vcStyles.metaRow}>
          {vacancy.rating !== undefined && vacancy.rating > 0 && (
            <View style={vcStyles.metaItem}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={vcStyles.metaText}>{vacancy.rating.toFixed(1)}</Text>
            </View>
          )}
          {vacancy.distanciaKm !== undefined && (
            <>
              {vacancy.rating !== undefined && vacancy.rating > 0 && <Text style={vcStyles.dot}>•</Text>}
              <Text style={vcStyles.distText}>{vacancy.distanciaKm} km</Text>
            </>
          )}
        </View>
        <Text style={vcStyles.price}>{formatPrice(vacancy.salarioDia)}</Text>
      </View>
    </TouchableOpacity>
  );
}

const vcStyles = StyleSheet.create({
  card: {
    width: CARD_WIDTH, flexDirection: 'row',
    backgroundColor: '#FFFFFF', borderRadius: 18,
    overflow: 'hidden', ...SHADOWS.large,
  },
  cardSelected: { borderWidth: 2, borderColor: COLORS.primary },
  imgWrap: { width: 95, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgFallback: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  verifiedBadge: {
    position: 'absolute', top: 7, right: 7,
    backgroundColor: COLORS.primary, borderRadius: 10, padding: 3,
  },
  info: { flex: 1, padding: 13, justifyContent: 'space-between' },
  title: { fontSize: 13, fontWeight: '700', color: '#212121' },
  farm: { fontSize: 11, color: '#757575', marginTop: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, fontWeight: '600', color: '#212121' },
  dot: { fontSize: 11, color: '#BDBDBD' },
  distText: { fontSize: 11, color: '#9E9E9E' },
  price: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 5 },
});

// ─── FloatingMapControls ──────────────────────────────────────────────────────

function FloatingMapControls({ onZoomIn, onZoomOut, onLocate }: {
  onZoomIn: () => void; onZoomOut: () => void; onLocate: () => void;
}) {
  return (
    <View style={fmcStyles.wrap}>
      <TouchableOpacity onPress={onZoomIn} style={fmcStyles.btn} activeOpacity={0.8}>
        <Ionicons name="add" size={22} color="#424242" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onZoomOut} style={fmcStyles.btn} activeOpacity={0.8}>
        <Ionicons name="remove" size={22} color="#424242" />
      </TouchableOpacity>
      <TouchableOpacity onPress={onLocate} style={[fmcStyles.btn, fmcStyles.btnAccent]} activeOpacity={0.8}>
        <Ionicons name="locate" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
}

const fmcStyles = StyleSheet.create({
  wrap: { gap: 10 },
  btn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
  },
  btnAccent: { backgroundColor: COLORS.primary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const COLOMBIA_CENTER: Region = {
  latitude: 5.5, longitude: -74.5,
  latitudeDelta: 9, longitudeDelta: 9,
};

export default function VacantesMapaScreen() {
  const [rawData, setRawData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('todos');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [region, setRegion] = useState<Region>(COLOMBIA_CENTER);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const mapRef = useRef<MapView>(null);
  const carouselRef = useRef<FlatList<Vacancy>>(null);

  // ── Load vacancies from API ──
  const cargar = useCallback(async () => {
    try {
      setLoading(true);
      const res = await vacantesAPI.listar({});
      setRawData(res.data?.vacantes || []);
    } catch (err) {
      console.error('Error cargando vacantes mapa:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Request user location ──
  useEffect(() => {
    cargar();
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, [cargar]);

  // ── Base vacancies (stable coords, no distance) — recomputed only when rawData changes ──
  const baseVacancies = useMemo<VacancyBase[]>(() => {
    const mapped = rawData.map(mapApiVacante).filter(Boolean) as VacancyBase[];
    return mapped;
  }, [rawData]);

  // ── Full vacancies with real-time distance — updates whenever userLocation changes ──
  const allVacancies = useMemo<Vacancy[]>(() =>
    baseVacancies.map((v) => ({
      ...v,
      distanciaKm: userLocation
        ? haversineKm(userLocation.latitude, userLocation.longitude, v.latitude, v.longitude)
        : undefined,
    })),
    [baseVacancies, userLocation],
  );

  // ── Apply search + cultivo filter ──
  const filtered = useMemo<Vacancy[]>(() => {
    const q = search.trim().toLowerCase();
    return allVacancies.filter((v) => {
      const matchesCultivo = filter === 'todos' || v.cultivo === filter;
      const matchesSearch =
        !q ||
        v.titulo.toLowerCase().includes(q) ||
        v.fincaNombre.toLowerCase().includes(q) ||
        v.municipio.toLowerCase().includes(q) ||
        v.cultivo.includes(q);
      return matchesCultivo && matchesSearch;
    });
  }, [allVacancies, filter, search]);

  // ── Pan map to selected vacancy ──
  useEffect(() => {
    const v = filtered[selectedIndex];
    if (!v) return;
    mapRef.current?.animateToRegion(
      { latitude: v.latitude, longitude: v.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 },
      400,
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIndex]);

  // ── Reset to first when filter/search changes ──
  useEffect(() => {
    setSelectedIndex(0);
    const v = filtered[0];
    if (v) {
      mapRef.current?.animateToRegion(
        { latitude: v.latitude, longitude: v.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 },
        400,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  const handleMarkerPress = useCallback((index: number) => {
    setSelectedIndex(index);
    carouselRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, []);

  const onCarouselScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const idx = Math.round(e.nativeEvent.contentOffset.x / (CARD_WIDTH + CARD_GAP));
      const clamped = Math.max(0, Math.min(idx, filtered.length - 1));
      if (clamped !== selectedIndex) setSelectedIndex(clamped);
    },
    [selectedIndex, filtered.length],
  );

  const zoomIn = useCallback(() => {
    const next: Region = {
      ...region,
      latitudeDelta: Math.max(region.latitudeDelta / 2, 0.002),
      longitudeDelta: Math.max(region.longitudeDelta / 2, 0.002),
    };
    mapRef.current?.animateToRegion(next, 300);
  }, [region]);

  const zoomOut = useCallback(() => {
    const next: Region = {
      ...region,
      latitudeDelta: Math.min(region.latitudeDelta * 2, 60),
      longitudeDelta: Math.min(region.longitudeDelta * 2, 60),
    };
    mapRef.current?.animateToRegion(next, 300);
  }, [region]);

  const locateMe = useCallback(() => {
    if (userLocation) {
      mapRef.current?.animateToRegion(
        { ...userLocation, latitudeDelta: 1.5, longitudeDelta: 1.5 }, 400,
      );
    } else {
      Alert.alert('Ubicación no disponible', 'Activa el permiso de ubicación para centrar el mapa.');
    }
  }, [userLocation]);

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Cargando vacantes...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={COLOMBIA_CENTER}
        onRegionChangeComplete={setRegion}
        showsUserLocation={!!userLocation}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {filtered.map((v, index) => (
          <Marker
            key={v.id}
            coordinate={{ latitude: v.latitude, longitude: v.longitude }}
            anchor={{ x: 0.5, y: 1 }}
            tracksViewChanges={false}
            onPress={() => handleMarkerPress(index)}
          >
            <CustomMarker vacancy={v} selected={index === selectedIndex} />
          </Marker>
        ))}
      </MapView>

      {/* Top overlay */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.searchRow}>
          <SearchBar value={search} onChange={setSearch} />
        </View>
        <View style={styles.chipsRow}>
          <FilterChips selected={filter} onSelect={(f) => setFilter(f)} />
        </View>
      </SafeAreaView>

      {/* Counter badge */}
      {filtered.length > 0 && (
        <View style={styles.counterWrap}>
          <View style={styles.counterBadge}>
            <Ionicons name="briefcase-outline" size={12} color={COLORS.primary} />
            <Text style={styles.counterText}>{filtered.length} vacante{filtered.length !== 1 ? 's' : ''}</Text>
          </View>
        </View>
      )}

      {/* Zoom + locate controls */}
      <View style={styles.fabColumn}>
        <FloatingMapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onLocate={locateMe} />
      </View>

      {/* Carousel */}
      {filtered.length > 0 ? (
        <View style={styles.carouselWrap}>
          <FlatList
            ref={carouselRef}
            data={filtered}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            snapToInterval={CARD_WIDTH + CARD_GAP}
            snapToAlignment="center"
            decelerationRate="fast"
            contentContainerStyle={styles.carouselContent}
            onMomentumScrollEnd={onCarouselScroll}
            onScrollEndDrag={onCarouselScroll}
            getItemLayout={(_, index) => ({
              length: CARD_WIDTH + CARD_GAP,
              offset: (CARD_WIDTH + CARD_GAP) * index,
              index,
            })}
            renderItem={({ item, index }) => (
              <VacancyCard
                vacancy={item}
                selected={index === selectedIndex}
                onPress={() => handleMarkerPress(index)}
              />
            )}
          />
        </View>
      ) : (
        <View style={styles.emptyWrap}>
          <View style={styles.emptyCard}>
            <Ionicons name="search-outline" size={34} color={COLORS.primary} />
            <Text style={styles.emptyTitle}>Sin resultados</Text>
            <Text style={styles.emptySub}>
              {search
                ? `No hay vacantes para "${search}"`
                : 'No hay vacantes en esta categoría con ubicación disponible.'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },

  loadingWrap: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#F1F8E9', gap: 12,
  },
  loadingText: { fontSize: 14, color: '#757575' },

  topOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, zIndex: 10,
  },
  searchRow: { marginBottom: 10 },
  chipsRow: {},

  counterWrap: {
    position: 'absolute', top: 130, left: 0, right: 0,
    alignItems: 'center', zIndex: 10,
  },
  counterBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: RADIUS.full, ...SHADOWS.medium,
  },
  counterText: { fontSize: 12, fontWeight: '700', color: COLORS.primary },

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
    backgroundColor: '#FFFFFF', borderRadius: 18,
    padding: SPACING.lg, alignItems: 'center', gap: 6,
    marginHorizontal: SPACING.xl, ...SHADOWS.large,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#212121' },
  emptySub: { fontSize: 12, color: '#757575', textAlign: 'center' },
});
