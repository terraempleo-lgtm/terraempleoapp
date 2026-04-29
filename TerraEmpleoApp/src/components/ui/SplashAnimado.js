import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withDelay, withSpring, withSequence,
  withRepeat, Easing,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

function Particula({ delay, x, size, color }) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withSequence(
      withTiming(0.7, { duration: 600 }),
      withRepeat(withSequence(
        withTiming(0.9, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 }),
      ), -1, true),
    ));
    translateY.value = withDelay(delay, withRepeat(
      withSequence(
        withTiming(-30, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={[{ position: 'absolute', left: x, bottom: height * 0.32 }, style]}>
      <Ionicons name="leaf" size={size} color={color} />
    </Animated.View>
  );
}

export default function SplashAnimado() {
  // Tallo
  const stemH = useSharedValue(0);
  // Hojas
  const leaf1Scale = useSharedValue(0);
  const leaf2Scale = useSharedValue(0);
  const leaf3Scale = useSharedValue(0);
  // Flor central
  const flowerScale = useSharedValue(0);
  const flowerRotate = useSharedValue(0);
  // Título
  const titleOpacity = useSharedValue(0);
  const titleY = useSharedValue(20);
  // Subtítulo
  const subOpacity = useSharedValue(0);
  // Brillo pulsante del icono central
  const glowScale = useSharedValue(1);

  useEffect(() => {
    stemH.value = withDelay(200, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    leaf1Scale.value = withDelay(600, withSpring(1, { damping: 8, stiffness: 120 }));
    leaf2Scale.value = withDelay(800, withSpring(1, { damping: 8, stiffness: 120 }));
    leaf3Scale.value = withDelay(1000, withSpring(1, { damping: 8, stiffness: 120 }));
    flowerScale.value = withDelay(1200, withSpring(1, { damping: 6, stiffness: 100 }));
    flowerRotate.value = withDelay(1200, withTiming(360, { duration: 900, easing: Easing.out(Easing.back(1.5)) }));
    titleOpacity.value = withDelay(1500, withTiming(1, { duration: 600 }));
    titleY.value = withDelay(1500, withSpring(0, { damping: 12 }));
    subOpacity.value = withDelay(1900, withTiming(1, { duration: 600 }));
    glowScale.value = withDelay(1400, withRepeat(
      withSequence(
        withTiming(1.15, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      ), -1, true,
    ));
  }, []);

  const stemStyle = useAnimatedStyle(() => ({ transform: [{ scaleY: stemH.value }], transformOrigin: 'bottom' }));
  const leaf1Style = useAnimatedStyle(() => ({ transform: [{ scale: leaf1Scale.value }, { rotate: '-35deg' }] }));
  const leaf2Style = useAnimatedStyle(() => ({ transform: [{ scale: leaf2Scale.value }, { rotate: '35deg' }] }));
  const leaf3Style = useAnimatedStyle(() => ({ transform: [{ scale: leaf3Scale.value }, { rotate: '-20deg' }] }));
  const flowerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: flowerScale.value }, { rotate: `${flowerRotate.value}deg` }],
  }));
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: glowScale.value }] }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subStyle = useAnimatedStyle(() => ({ opacity: subOpacity.value }));

  return (
    <LinearGradient
      colors={['#0a2e14', '#1b5e20', '#2e7d32']}
      start={{ x: 0.2, y: 0 }}
      end={{ x: 0.8, y: 1 }}
      style={styles.container}
    >
      {/* Partículas flotantes de fondo */}
      <Particula delay={300} x={width * 0.08} size={18} color="rgba(193,255,114,0.5)" />
      <Particula delay={600} x={width * 0.82} size={14} color="rgba(193,255,114,0.4)" />
      <Particula delay={900} x={width * 0.15} size={12} color="rgba(255,255,255,0.25)" />
      <Particula delay={400} x={width * 0.72} size={20} color="rgba(193,255,114,0.35)" />
      <Particula delay={750} x={width * 0.45} size={10} color="rgba(255,255,255,0.2)" />

      {/* Planta animada */}
      <View style={styles.plantWrap}>
        {/* Tierra */}
        <View style={styles.soil}>
          <View style={styles.soilInner} />
        </View>

        {/* Tallo */}
        <Animated.View style={[styles.stem, stemStyle]} />

        {/* Hojas laterales */}
        <Animated.View style={[styles.leaf, styles.leafLeft, leaf1Style]}>
          <Ionicons name="leaf" size={30} color="#c1ff72" />
        </Animated.View>
        <Animated.View style={[styles.leaf, styles.leafRight, leaf2Style]}>
          <Ionicons name="leaf" size={24} color="#a5d65c" />
        </Animated.View>
        <Animated.View style={[styles.leaf, styles.leafLeft2, leaf3Style]}>
          <Ionicons name="leaf" size={20} color="#c1ff72" />
        </Animated.View>

        {/* Flor / brote en la punta */}
        <Animated.View style={[styles.flowerWrap, glowStyle]}>
          <Animated.View style={flowerStyle}>
            <View style={styles.flower}>
              <Ionicons name="sunny" size={28} color="#c1ff72" />
            </View>
          </Animated.View>
        </Animated.View>
      </View>

      {/* Texto */}
      <Animated.View style={[styles.textWrap, titleStyle]}>
        <Text style={styles.title}>TerraEmpleo</Text>
      </Animated.View>
      <Animated.View style={subStyle}>
        <Text style={styles.subtitle}>Conectando el campo colombiano</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },

  plantWrap: {
    width: 120, height: 200,
    alignItems: 'center', justifyContent: 'flex-end',
    marginBottom: 32,
  },

  soil: {
    width: 80, height: 18, borderRadius: 99,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center', justifyContent: 'center',
  },
  soilInner: {
    width: 50, height: 6, borderRadius: 99,
    backgroundColor: 'rgba(193,255,114,0.2)',
  },

  stem: {
    position: 'absolute', bottom: 18,
    width: 5, height: 130,
    backgroundColor: '#c1ff72',
    borderRadius: 3,
  },

  leaf: { position: 'absolute' },
  leafLeft:  { bottom: 85, left: 22 },
  leafRight: { bottom: 65, right: 22 },
  leafLeft2: { bottom: 110, left: 20 },

  flowerWrap: {
    position: 'absolute', top: 0,
    width: 60, height: 60,
    justifyContent: 'center', alignItems: 'center',
  },
  flower: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: 'rgba(193,255,114,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1.5, borderColor: 'rgba(193,255,114,0.4)',
  },

  textWrap: { alignItems: 'center' },
  title: {
    fontSize: 36, fontWeight: '900', color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14, color: 'rgba(255,255,255,0.65)',
    marginTop: 6, letterSpacing: 0.3,
  },
});
