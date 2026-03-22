import React, { useState, useEffect, useRef, useCallback } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Region, PROVIDER_DEFAULT } from 'react-native-maps';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { COLORS, SPACING, RADIUS, SHADOWS } from '../../theme';

// ─── Types ────────────────────────────────────────────────────────────────────

type Cultivo = 'cafe' | 'cacao' | 'frutas' | 'otros';
type FilterType = 'todos' | Cultivo;

type Vacancy = {
  id: string;
  titulo: string;
  fincaNombre: string;
  cultivo: Cultivo;
  salarioDia: number;
  rating?: number;
  distanciaKm?: number;
  municipio: string;
  departamento: string;
  latitude: number;
  longitude: number;
  fotoUrl?: string;
  verificada?: boolean;
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_VACANCIES: Vacancy[] = [
  {
    id: '1',
    titulo: 'Recolector de Café',
    fincaNombre: 'Finca La Esperanza',
    cultivo: 'cafe',
    salarioDia: 45000,
    rating: 4.8,
    distanciaKm: 12,
    municipio: 'Salento',
    departamento: 'Quindío',
    latitude: 4.6369,
    longitude: -75.5736,
    verificada: true,
  },
  {
    id: '2',
    titulo: 'Cosecha de Cacao',
    fincaNombre: 'Hacienda El Paraíso',
    cultivo: 'cacao',
    salarioDia: 38000,
    rating: 4.5,
    distanciaKm: 25,
    municipio: 'San Vicente',
    departamento: 'Antioquia',
    latitude: 6.2987,
    longitude: -75.3380,
    verificada: true,
  },
  {
    id: '3',
    titulo: 'Recolección de Mora y Fresa',
    fincaNombre: 'Granja El Bosque',
    cultivo: 'frutas',
    salarioDia: 44000,
    rating: 4.6,
    distanciaKm: 20,
    municipio: 'Sutatenza',
    departamento: 'Boyacá',
    latitude: 5.0509,
    longitude: -73.4467,
    verificada: true,
  },
  {
    id: '4',
    titulo: 'Cortero de Café',
    fincaNombre: 'Finca La Montana',
    cultivo: 'cafe',
    salarioDia: 50000,
    rating: 4.9,
    distanciaKm: 30,
    municipio: 'Pijao',
    departamento: 'Quindío',
    latitude: 4.3371,
    longitude: -75.6963,
    verificada: true,
  },
  {
    id: '5',
    titulo: 'Beneficio de Cacao',
    fincaNombre: 'Hacienda Palmeras',
    cultivo: 'cacao',
    salarioDia: 35000,
    rating: 4.0,
    distanciaKm: 45,
    municipio: 'Turbo',
    departamento: 'Antioquia',
    latitude: 8.0967,
    longitude: -76.7258,
  },
  {
    id: '6',
    titulo: 'Recolector de Frutas Tropicales',
    fincaNombre: 'Finca El Mango',
    cultivo: 'frutas',
    salarioDia: 42000,
    rating: 4.2,
    distanciaKm: 8,
    municipio: 'Fredonia',
    departamento: 'Antioquia',
    latitude: 5.9352,
    longitude: -75.6734,
  },
  {
    id: '7',
    titulo: 'Labores Agrícolas Generales',
    fincaNombre: 'Finca Los Naranjos',
    cultivo: 'otros',
    salarioDia: 40000,
    rating: 3.8,
    distanciaKm: 15,
    municipio: 'La Mesa',
    departamento: 'Cundinamarca',
    latitude: 4.6329,
    longitude: -74.4714,
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

type CultivoConfig = { label: string; icon: React.ComponentProps<typeof Ionicons>['name']; emoji: string; color: string };

const CULTIVO_CONFIG: Record<FilterType, CultivoConfig> = {
  todos:  { label: 'Todos',  icon: 'apps-outline',   emoji: '',  color: COLORS.primary },
  cafe:   { label: 'Café',   icon: 'cafe',            emoji: '☕', color: '#6F4E37' },
  cacao:  { label: 'Cacao',  icon: 'leaf',            emoji: '🌿', color: '#4E342E' },
  frutas: { label: 'Frutas', icon: 'nutrition',       emoji: '🍎', color: '#C62828' },
  otros:  { label: 'Otros',  icon: 'construct-outline', emoji: '', color: '#37474F' },
};

const FILTERS: FilterType[] = ['todos', 'cafe', 'cacao', 'frutas'];

function formatPrice(amount: number): string {
  return `$${amount.toLocaleString('es-CO')} / día`;
}

// ─── SearchBar ────────────────────────────────────────────────────────────────

interface SearchBarProps {
  value: string;
  onChange: (text: string) => void;
}

function SearchBar({ value, onChange }: SearchBarProps) {
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.md,
    height: 50,
    ...SHADOWS.medium,
  },
  input: { flex: 1, fontSize: 14, color: '#212121', paddingVertical: 0 },
  divider: { width: 1, height: 20, backgroundColor: '#E0E0E0' },
});

// ─── FilterChips ──────────────────────────────────────────────────────────────

interface FilterChipsProps {
  selected: FilterType;
  onSelect: (f: FilterType) => void;
}

function FilterChips({ selected, onSelect }: FilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={fcStyles.row}
    >
      {FILTERS.map((f) => {
        const cfg = CULTIVO_CONFIG[f];
        const active = selected === f;
        return (
          <TouchableOpacity
            key={f}
            onPress={() => onSelect(f)}
            style={[fcStyles.chip, active && fcStyles.chipActive]}
            activeOpacity={0.8}
          >
            {cfg.emoji ? (
              <Text style={fcStyles.emoji}>{cfg.emoji}</Text>
            ) : (
              <Ionicons
                name={cfg.icon}
                size={13}
                color={active ? '#FFF' : COLORS.primary}
              />
            )}
            <Text style={[fcStyles.label, active && fcStyles.labelActive]}>
              {cfg.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const fcStyles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    ...SHADOWS.small,
  },
  chipActive: { backgroundColor: COLORS.primary },
  emoji: { fontSize: 13 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.primary },
  labelActive: { color: '#FFFFFF' },
});

// ─── CustomMarker ─────────────────────────────────────────────────────────────

interface CustomMarkerProps {
  vacancy: Vacancy;
  selected: boolean;
}

function CustomMarker({ vacancy, selected }: CustomMarkerProps) {
  const cfg = CULTIVO_CONFIG[vacancy.cultivo];
  const bg = selected ? COLORS.primary : cfg.color;

  return (
    <View style={mkStyles.wrap}>
      {selected && (
        <View style={mkStyles.callout}>
          <Text style={mkStyles.calloutText} numberOfLines={1}>
            {vacancy.titulo}
          </Text>
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
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 170,
  },
  calloutText: { fontSize: 11, fontWeight: '700', color: '#212121' },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  bubbleSelected: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    marginTop: -1,
  },
});

// ─── VacancyCard ──────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.72;
const CARD_GAP = 12;

interface VacancyCardProps {
  vacancy: Vacancy;
  selected: boolean;
  onPress: () => void;
}

function VacancyCard({ vacancy, selected, onPress }: VacancyCardProps) {
  const cfg = CULTIVO_CONFIG[vacancy.cultivo];

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.88}
      style={[vcStyles.card, selected && vcStyles.cardSelected]}
    >
      {/* Image */}
      <View style={vcStyles.imgWrap}>
        {vacancy.fotoUrl ? (
          <Image source={{ uri: vacancy.fotoUrl }} style={vcStyles.img} resizeMode="cover" />
        ) : (
          <View style={[vcStyles.imgFallback, { backgroundColor: `${cfg.color}18` }]}>
            <Ionicons name={cfg.icon} size={34} color={cfg.color} />
          </View>
        )}
        {vacancy.verificada && (
          <View style={vcStyles.verifiedBadge}>
            <Ionicons name="shield-checkmark" size={10} color="#FFF" />
          </View>
        )}
      </View>

      {/* Info */}
      <View style={vcStyles.info}>
        <Text style={vcStyles.title} numberOfLines={1}>{vacancy.titulo}</Text>
        <Text style={vcStyles.farm} numberOfLines={1}>{vacancy.fincaNombre}</Text>

        <View style={vcStyles.metaRow}>
          {vacancy.rating !== undefined && (
            <View style={vcStyles.metaItem}>
              <Ionicons name="star" size={12} color="#F59E0B" />
              <Text style={vcStyles.metaText}>{vacancy.rating.toFixed(1)}</Text>
            </View>
          )}
          {vacancy.distanciaKm !== undefined && (
            <>
              <Text style={vcStyles.dot}>•</Text>
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
    width: CARD_WIDTH,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    ...SHADOWS.large,
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  imgWrap: { width: 95, position: 'relative' },
  img: { width: '100%', height: '100%' },
  imgFallback: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifiedBadge: {
    position: 'absolute',
    top: 7,
    right: 7,
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    padding: 3,
  },
  info: {
    flex: 1,
    padding: 13,
    justifyContent: 'space-between',
  },
  title: { fontSize: 13, fontWeight: '700', color: '#212121' },
  farm: { fontSize: 11, color: '#757575', marginTop: 2 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 5,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 12, fontWeight: '600', color: '#212121' },
  dot: { fontSize: 11, color: '#BDBDBD' },
  distText: { fontSize: 11, color: '#9E9E9E' },
  price: { fontSize: 14, fontWeight: '800', color: COLORS.primary, marginTop: 5 },
});

// ─── FloatingMapControls ──────────────────────────────────────────────────────

interface FloatingMapControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLocate: () => void;
}

function FloatingMapControls({ onZoomIn, onZoomOut, onLocate }: FloatingMapControlsProps) {
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
  },
  btnAccent: { backgroundColor: COLORS.primary },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

const COLOMBIA_CENTER: Region = {
  latitude: 5.5,
  longitude: -74.5,
  latitudeDelta: 9,
  longitudeDelta: 9,
};

export default function VacantesMapaScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('todos');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [region, setRegion] = useState<Region>(COLOMBIA_CENTER);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const mapRef = useRef<MapView>(null);
  const carouselRef = useRef<FlatList<Vacancy>>(null);

  // ── Filtered list ──
  const filtered = MOCK_VACANCIES.filter((v) => {
    const matchesCultivo = filter === 'todos' || v.cultivo === filter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      v.titulo.toLowerCase().includes(q) ||
      v.fincaNombre.toLowerCase().includes(q) ||
      v.municipio.toLowerCase().includes(q) ||
      v.cultivo.includes(q);
    return matchesCultivo && matchesSearch;
  });

  // ── Request location ──
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
    })();
  }, []);

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

  // ── Reset selection when filter/search changes ──
  useEffect(() => {
    setSelectedIndex(0);
    if (filtered.length > 0) {
      const v = filtered[0];
      mapRef.current?.animateToRegion(
        { latitude: v.latitude, longitude: v.longitude, latitudeDelta: 0.5, longitudeDelta: 0.5 },
        400,
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, search]);

  // ── Marker press: select + scroll carousel ──
  const handleMarkerPress = useCallback((index: number) => {
    setSelectedIndex(index);
    carouselRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
  }, []);

  // ── Carousel scroll: sync map ──
  const onCarouselScroll = useCallback(
    (e: { nativeEvent: { contentOffset: { x: number } } }) => {
      const offset = e.nativeEvent.contentOffset.x;
      const idx = Math.round(offset / (CARD_WIDTH + CARD_GAP));
      const clamped = Math.max(0, Math.min(idx, filtered.length - 1));
      if (clamped !== selectedIndex) setSelectedIndex(clamped);
    },
    [selectedIndex, filtered.length],
  );

  // ── Zoom controls ──
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
        { ...userLocation, latitudeDelta: 1.5, longitudeDelta: 1.5 },
        400,
      );
    } else {
      Alert.alert('Ubicación no disponible', 'Activa el permiso de ubicación para centrar el mapa.');
    }
  }, [userLocation]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      {/* Full-screen map */}
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

      {/* Top overlay: SearchBar + FilterChips */}
      <SafeAreaView style={styles.topOverlay} edges={['top']}>
        <View style={styles.searchRow}>
          <SearchBar value={search} onChange={setSearch} />
        </View>
        <View style={styles.chipsRow}>
          <FilterChips
            selected={filter}
            onSelect={(f) => setFilter(f)}
          />
        </View>
      </SafeAreaView>

      {/* Right-side floating controls */}
      <View style={styles.fabColumn}>
        <FloatingMapControls onZoomIn={zoomIn} onZoomOut={zoomOut} onLocate={locateMe} />
      </View>

      {/* Bottom carousel */}
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
              No hay vacantes para{' '}
              {search ? `"${search}"` : CULTIVO_CONFIG[filter].label.toLowerCase()}.
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

  topOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    zIndex: 10,
  },
  searchRow: { marginBottom: 10 },
  chipsRow: {},

  fabColumn: {
    position: 'absolute',
    right: SPACING.md,
    bottom: 210,
    zIndex: 10,
  },

  carouselWrap: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  carouselContent: {
    paddingHorizontal: (SCREEN_WIDTH - CARD_WIDTH) / 2,
    gap: CARD_GAP,
  },

  emptyWrap: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: 6,
    marginHorizontal: SPACING.xl,
    ...SHADOWS.large,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: '#212121' },
  emptySub: { fontSize: 12, color: '#757575', textAlign: 'center' },
});
