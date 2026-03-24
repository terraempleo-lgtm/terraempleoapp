import React, { useState } from 'react';
import {
  View, Text, StyleSheet, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MotiView } from 'moti';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeIn } from 'react-native-reanimated';
import { COLORS, SPACING, RADIUS, SHADOWS, ANIMATION } from '../../theme';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { AppHeader, Button } from '../../components/ui';
import { AnimatedPressable, FadeInView, StaggeredItem } from '../../components/animated';

// Hojas decorativas del fondo
function DecoLeaf({ style, size = 60, rotation = 0, opacity = 0.08 }) {
  return (
    <MotiView
      from={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity, scale: 1 }}
      transition={{ type: 'timing', duration: 1000 }}
      style={[styles.decoLeaf, style, { transform: [{ rotate: `${rotation}deg` }] }]}
    >
      <Ionicons name="leaf" size={size} color={COLORS.primary} />
    </MotiView>
  );
}

const ROLES = [
  {
    key: 'trabajador',
    icon: 'tractor-variant',
    iconLib: 'material',
    title: 'Soy Trabajador',
    description: 'Busco oportunidades de empleo en el campo colombiano',
    features: ['Encuentra vacantes', 'Postula fácilmente', 'Recibe notificaciones'],
    gradient: [COLORS.primary, COLORS.primaryDark],
    screen: 'RegisterTrabajador',
  },
  {
    key: 'empleador',
    icon: 'office-building-outline',
    iconLib: 'material',
    title: 'Soy Empleador',
    description: 'Busco talento rural para mi finca o empresa agrícola',
    features: ['Publica vacantes', 'Revisa postulantes', 'Gestiona tu equipo'],
    gradient: ['#FF8F00', '#E65100'],
    screen: 'RegisterEmpleador',
  },
];

export default function RoleSelectScreen({ navigation }) {
  const [selected, setSelected] = useState(null);

  const handleContinue = () => {
    if (!selected) return;
    const role = ROLES.find(r => r.key === selected);
    navigation.navigate(role.screen);
  };

  // Contenido scrollable
  const Content = (
    <>
      {/* Header con animación */}
      <FadeInView delay={100} translateY={-10}>
        <View style={styles.header}>
          <View style={styles.leafBadge}>
            <Ionicons name="leaf" size={16} color={COLORS.primary} />
            <Text style={styles.leafBadgeText}>REGISTRO</Text>
          </View>
          <Text style={styles.title}>¿Cómo quieres usar TerraEmpleo?</Text>
          <Text style={styles.subtitle}>
            Selecciona tu perfil para comenzar tu experiencia en el campo colombiano.
          </Text>
        </View>
      </FadeInView>

      {/* Role cards con animación staggered */}
      <View style={styles.cardsContainer}>
        {ROLES.map((role, index) => {
          const isSelected = selected === role.key;
          return (
            <StaggeredItem key={role.key} index={index}>
              <AnimatedPressable
                style={[styles.card, isSelected && styles.cardSelected]}
                onPress={() => setSelected(role.key)}
                scaleValue={ANIMATION.scale.pressedSubtle}
                haptic
              >
                {/* Gradient header del card */}
                <LinearGradient
                  colors={isSelected ? role.gradient : [COLORS.primarySoft, COLORS.primaryMuted]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.cardHeader}
                >
                  <MotiView
                    animate={{ scale: isSelected ? 1.1 : 1, rotate: isSelected ? '10deg' : '0deg' }}
                    transition={{ type: 'spring', damping: 15, stiffness: 200 }}
                  >
                    <View style={[styles.iconCircle, isSelected && styles.iconCircleSelected]}>
                      <MaterialCommunityIcons
                        name={role.icon}
                        size={32}
                        color={isSelected ? COLORS.white : COLORS.primary}
                      />
                    </View>
                  </MotiView>

                  {isSelected && (
                    <MotiView
                      from={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', damping: 12, stiffness: 200 }}
                      style={styles.checkBadge}
                    >
                      <Ionicons name="checkmark" size={14} color={COLORS.white} />
                    </MotiView>
                  )}
                </LinearGradient>

                {/* Contenido del card */}
                <View style={styles.cardBody}>
                  <Text style={[styles.cardTitle, isSelected && styles.cardTitleSelected]}>
                    {role.title}
                  </Text>
                  <Text style={styles.cardDesc}>{role.description}</Text>

                  {/* Features list */}
                  <View style={styles.featuresRow}>
                    {role.features.map((feature, i) => (
                      <View key={i} style={styles.featureChip}>
                        <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
                        <Text style={styles.featureText}>{feature}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </AnimatedPressable>
            </StaggeredItem>
          );
        })}
      </View>

      {/* Espacio extra para el bottom area */}
      <View style={{ height: 120 }} />
    </>
  );

  return (
    <View style={styles.container}>
      {/* Fondo con hojas decorativas */}
      <View style={styles.backgroundDeco}>
        <DecoLeaf style={{ top: '5%', left: -20 }} size={80} rotation={-25} opacity={0.06} />
        <DecoLeaf style={{ top: '15%', right: -15 }} size={50} rotation={35} opacity={0.05} />
        <DecoLeaf style={{ top: '45%', left: '10%' }} size={40} rotation={15} opacity={0.04} />
        <DecoLeaf style={{ top: '60%', right: '5%' }} size={70} rotation={-40} opacity={0.05} />
        <DecoLeaf style={{ bottom: '15%', left: -10 }} size={60} rotation={20} opacity={0.06} />
        <DecoLeaf style={{ bottom: '25%', right: '15%' }} size={35} rotation={-15} opacity={0.04} />
      </View>

      <SafeAreaView style={styles.safeArea}>
        <AppHeader onBack={() => navigation.goBack()} />

        {/* Scroll nativo para web */}
        {Platform.OS === 'web' ? (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            paddingLeft: SPACING.lg,
            paddingRight: SPACING.lg,
            paddingTop: SPACING.md,
            paddingBottom: SPACING.xl,
          }}>
            {Content}
          </div>
        ) : (
          <Animated.ScrollView
            entering={FadeIn.duration(300)}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {Content}
          </Animated.ScrollView>
        )}

        {/* Bottom area fijo */}
        <FadeInView delay={500} translateY={10}>
          <View style={styles.bottomArea}>
            <Button
              title="Continuar"
              onPress={handleContinue}
              disabled={!selected}
              size="large"
              icon="arrow-forward"
            />
            <Text style={styles.footerNote}>
              Podrás cambiar tu elección más tarde en la configuración.
            </Text>
          </View>
        </FadeInView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5FAF7',
  },
  backgroundDeco: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: 0,
  },
  decoLeaf: {
    position: 'absolute',
  },
  safeArea: {
    flex: 1,
    zIndex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  leafBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.xs,
    borderRadius: RADIUS.full,
    marginBottom: SPACING.md,
  },
  leafBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
    letterSpacing: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    lineHeight: 36,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textSecondary,
    lineHeight: 22,
  },
  cardsContainer: {
    gap: SPACING.md,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    overflow: 'hidden',
    ...SHADOWS.card,
  },
  cardSelected: {
    borderColor: COLORS.primary,
    borderWidth: 2,
    ...SHADOWS.medium,
  },
  cardHeader: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    alignItems: 'center',
    position: 'relative',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOWS.small,
  },
  iconCircleSelected: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  checkBadge: {
    position: 'absolute',
    top: SPACING.sm,
    right: SPACING.sm,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardBody: {
    padding: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.textPrimary,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardTitleSelected: {
    color: COLORS.primary,
  },
  cardDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  featuresRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: SPACING.xs,
  },
  featureChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.primarySoft,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  featureText: {
    fontSize: 11,
    fontWeight: '600',
    color: COLORS.primary,
  },
  bottomArea: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingTop: SPACING.md,
    backgroundColor: 'rgba(245,250,247,0.98)',
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
  },
  footerNote: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    marginTop: SPACING.md,
    lineHeight: 18,
  },
});
