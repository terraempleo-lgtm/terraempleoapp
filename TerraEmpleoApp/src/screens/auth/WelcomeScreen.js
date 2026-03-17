import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  StatusBar,
  ScrollView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { MotiView } from 'moti';
import { COLORS, SPACING, RADIUS, ANIMATION } from '../../theme';
import { AnimatedPressable } from '../../components/animated';

const SLIDES = [
  {
    id: '1',
    title: 'TerraEmpleo',
    subtitle: 'Transformando el agro colombiano conectando talento con oportunidades reales.',
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

const AnimatedDot = ({ isActive, index, onPress }) => {
  const dotWidth = useSharedValue(8);

  useEffect(() => {
    dotWidth.value = withSpring(isActive ? 24 : 8, ANIMATION.spring.bouncy);
  }, [isActive]);

  const dotStyle = useAnimatedStyle(() => ({
    width: dotWidth.value,
  }));

  return (
    <AnimatedPressable onPress={() => onPress(index)} haptic={false} scaleValue={0.9}>
      <Animated.View
        style={[
          styles.dotTop,
          isActive && styles.dotTopActive,
          dotStyle,
        ]}
      />
    </AnimatedPressable>
  );
};

export default function WelcomeScreen({ navigation }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef(null);
  const { width, height } = useWindowDimensions();

  const handleScroll = useCallback((e) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    if (index >= 0 && index < SLIDES.length && index !== activeIndex) {
      setActiveIndex(index);
    }
  }, [width, activeIndex]);

  const goToSlide = useCallback((index) => {
    scrollRef.current?.scrollTo({ x: index * width, animated: true });
    setActiveIndex(index);
  }, [width]);

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
        <View style={[styles.overlayBottom, { height: height * 0.55 }]} />

        <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
          {/* Dots indicadores arriba - con animación de ancho */}
          <MotiView
            from={{ opacity: 0, translateY: -10 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ type: 'timing', duration: 500, delay: 200 }}
          >
            <View style={styles.dotsTopRow}>
              {SLIDES.map((_, i) => (
                <AnimatedDot
                  key={i}
                  index={i}
                  isActive={i === activeIndex}
                  onPress={goToSlide}
                />
              ))}
            </View>
          </MotiView>

          {/* Icono leaf con animación de entrada */}
          <MotiView
            from={{ opacity: 0, scale: 0.5, rotate: '-30deg' }}
            animate={{ opacity: 1, scale: 1, rotate: '0deg' }}
            transition={{ type: 'spring', damping: 12, stiffness: 150, delay: 400 }}
            style={[styles.leafContainer, { marginTop: height * 0.08 }]}
          >
            <View style={styles.leafCircle}>
              <Ionicons name="leaf" size={26} color={COLORS.accent} />
            </View>
          </MotiView>

          {/* Carrusel de slides */}
          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            decelerationRate="fast"
            snapToInterval={width}
            snapToAlignment="start"
            style={styles.slider}
            contentContainerStyle={styles.sliderContent}
            {...(Platform.OS === 'web' ? {
              style: [styles.slider, {
                scrollSnapType: 'x mandatory',
                WebkitOverflowScrolling: 'touch',
              }],
            } : {})}
          >
            {SLIDES.map((item) => (
              <View
                key={item.id}
                style={[
                  styles.slide,
                  { width },
                  Platform.OS === 'web' ? { scrollSnapAlign: 'start' } : {},
                ]}
              >
                <MotiView
                  from={{ opacity: 0, translateY: 20 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 200 }}
                >
                  <Text style={styles.appName}>{item.title}</Text>
                </MotiView>
                <MotiView
                  from={{ opacity: 0, translateY: 15 }}
                  animate={{ opacity: 1, translateY: 0 }}
                  transition={{ type: 'timing', duration: 500, delay: 400 }}
                >
                  <Text style={styles.tagline}>{item.subtitle}</Text>
                </MotiView>
              </View>
            ))}
          </ScrollView>

          {/* Botones con entrada escalonada */}
          <View style={styles.buttonsContainer}>
            <MotiView
              from={{ opacity: 0, translateY: 30 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 150, delay: 500 }}
            >
              <AnimatedPressable
                style={styles.btnPrimary}
                onPress={() => navigation.navigate('Login')}
                scaleValue={ANIMATION.scale.pressed}
                haptic={true}
              >
                <Text style={styles.btnPrimaryText}>Iniciar sesión</Text>
              </AnimatedPressable>
            </MotiView>

            <MotiView
              from={{ opacity: 0, translateY: 30 }}
              animate={{ opacity: 1, translateY: 0 }}
              transition={{ type: 'spring', damping: 15, stiffness: 150, delay: 650 }}
            >
              <AnimatedPressable
                style={styles.btnOutline}
                onPress={() => navigation.navigate('RoleSelect')}
                scaleValue={ANIMATION.scale.pressed}
                haptic={true}
              >
                <Text style={styles.btnOutlineText}>Crear cuenta</Text>
              </AnimatedPressable>
            </MotiView>

            {/* Footer */}
            <MotiView
              from={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ type: 'timing', duration: 600, delay: 800 }}
            >
              <View style={styles.footerRow}>
                <Text style={styles.footerText}>POTENCIANDO EL CAMPO</Text>
              </View>
            </MotiView>
          </View>
        </SafeAreaView>
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  bg: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 25, 10, 0.45)',
  },
  overlayBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 20, 8, 0.35)',
  },
  safe: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: SPACING.lg,
  },

  // Dots top
  dotsTopRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: SPACING.md,
    gap: 8,
  },
  dotTop: {
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotTopActive: {
    backgroundColor: COLORS.accent,
  },

  // Leaf
  leafContainer: {
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  leafCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255,255,255,0.12)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Slider
  slider: {
    flexGrow: 0,
    marginBottom: SPACING.xl,
  },
  sliderContent: {
    alignItems: 'center',
  },
  slide: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
  },
  appName: {
    fontSize: 52,
    fontWeight: '900',
    color: COLORS.accent,
    letterSpacing: -1,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 10,
  },
  tagline: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 24,
    fontWeight: '400',
    paddingHorizontal: SPACING.lg,
  },

  // Buttons
  buttonsContainer: {
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  btnPrimary: {
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  btnPrimaryText: {
    color: COLORS.white,
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
    borderColor: COLORS.accent,
    backgroundColor: 'rgba(193, 255, 114, 0.06)',
  },
  btnOutlineText: {
    color: COLORS.accent,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // Footer
  footerRow: {
    alignItems: 'center',
    paddingTop: SPACING.sm,
  },
  footerText: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
});
