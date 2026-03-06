import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  TouchableOpacity,
  StatusBar,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SPACING, RADIUS } from '../../theme';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'TerraEmpleo',
    subtitle: 'El futuro del trabajo en el campo colombiano.',
  },
  {
    id: '2',
    title: 'TerraEmpleo',
    subtitle: 'Conecta trabajadores rurales con empleadores del campo.',
  },
  {
    id: '3',
    title: 'TerraEmpleo',
    subtitle: 'Tu próxima oportunidad en el agro colombiano te espera.',
  },
];

export default function WelcomeScreen({ navigation }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef(null);

  const onScroll = (e) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / width);
    setActiveIndex(index);
  };

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />

      <ImageBackground
        source={require('../../../assets/login.jpg')}
        style={styles.bg}
        resizeMode="cover"
      >
        {/* Overlay oscuro */}
        <View style={styles.overlay} />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Slider de slides */}
          <FlatList
            ref={flatListRef}
            data={SLIDES}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={onScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            style={styles.slider}
            renderItem={({ item }) => (
              <View style={styles.slide}>
                <Text style={styles.appName}>{item.title}</Text>
                <Text style={styles.tagline}>{item.subtitle}</Text>
              </View>
            )}
          />

          {/* Dots indicadores */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === activeIndex && styles.dotActive]}
              />
            ))}
          </View>

          {/* Botones */}
          <View style={styles.buttonsContainer}>
            <TouchableOpacity
              style={styles.btnPrimary}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.btnOutline}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('RoleSelect')}
            >
              <Text style={styles.btnOutlineText}>Crear cuenta</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 30, 10, 0.52)',
  },
  safe: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: SPACING.xl,
  },
  slider: {
    flexGrow: 0,
    marginBottom: SPACING.md,
  },
  slide: {
    width,
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: height * 0.35,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: '#c1ff72',
    letterSpacing: -1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  tagline: {
    fontSize: 17,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: SPACING.sm,
    lineHeight: 26,
    fontWeight: '400',
    opacity: 0.92,
    paddingHorizontal: SPACING.md,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xl,
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotActive: {
    backgroundColor: '#c1ff72',
    width: 22,
    borderRadius: 4,
  },
  buttonsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  btnPrimary: {
    backgroundColor: '#008d49',
    borderRadius: RADIUS.full,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  btnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  btnOutline: {
    borderRadius: RADIUS.full,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#c1ff72',
  },
  btnOutlineText: {
    color: '#c1ff72',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
