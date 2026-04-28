import React, { useEffect, useRef, Suspense } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, Linking, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { navigationRef } from './src/navigation/navigationRef';
import { COLORS, FONTS } from './src/theme';
import { AnimatedTabBar } from './src/components/animated';
import { Toast, AppAlert, OfflineBanner } from './src/components/ui';
import { useNetworkStatus } from './src/hooks/useNetworkStatus';
import { setGlobalToastRef } from './src/utils/toastService';
import { setGlobalAlertRef } from './src/utils/alertService';

// ── Helper: lazy en todos los entornos (Metro no hace split → resuelve sync en native)
const lazyWeb = (importFn) => React.lazy(importFn);

// ── Auth — siempre necesario, estático ───────────────────────────────────
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RoleSelectScreen from './src/screens/auth/RoleSelectScreen';
import RegisterTrabajadorScreen from './src/screens/auth/RegisterTrabajadorScreen';
import RegisterEmpleadorScreen from './src/screens/auth/RegisterEmpleadorScreen';
import RecuperarPasswordScreen from './src/screens/auth/RecuperarPasswordScreen';
import DocumentoLegalScreen from './src/screens/auth/DocumentoLegalScreen';
import VerificationNavigator from './src/modules/verification/navigation/VerificationNavigator';

// ── Shared — necesario para todos los roles autenticados, estático ────────
import PerfilScreen from './src/screens/shared/PerfilScreen';
import EditarPerfilScreen from './src/screens/shared/EditarPerfilScreen';
import NotificacionesScreen from './src/screens/shared/NotificacionesScreen';
import ChatsScreen from './src/screens/shared/ChatsScreen';
import ChatDetalleScreen from './src/screens/shared/ChatDetalleScreen';
import PerfilPublicoTrabajadorScreen from './src/screens/shared/PerfilPublicoTrabajadorScreen';
import PerfilPublicoEmpleadorScreen from './src/screens/shared/PerfilPublicoEmpleadorScreen';

// ── Trabajador — lazy en web ──────────────────────────────────────────────
const TrabajadorVacantesScreen    = lazyWeb(() => import('./src/screens/trabajador/TrabajadorVacantesScreen'));
const DetalleVacanteScreen        = lazyWeb(() => import('./src/screens/trabajador/DetalleVacanteScreen'));
const MisPostulacionesScreen      = lazyWeb(() => import('./src/screens/trabajador/MisPostulacionesScreen'));
const VacantesRecomendadasScreen  = lazyWeb(() => import('./src/screens/trabajador/VacantesRecomendadasScreen'));
const VacantesMapaScreen          = lazyWeb(() => import('./src/screens/trabajador/VacantesMapaScreen'));

// ── Empleador — lazy en web ───────────────────────────────────────────────
const EmpleadorVacantesScreen        = lazyWeb(() => import('./src/screens/empleador/EmpleadorVacantesScreen'));
const CrearVacanteScreen             = lazyWeb(() => import('./src/screens/empleador/CrearVacanteScreen'));
const EditarVacanteScreen            = lazyWeb(() => import('./src/screens/empleador/EditarVacanteScreen'));
const VerPostulacionesScreen         = lazyWeb(() => import('./src/screens/empleador/VerPostulacionesScreen'));
const DetalleVacanteEmpleadorScreen  = lazyWeb(() => import('./src/screens/empleador/DetalleVacanteEmpleadorScreen'));
const ExplorarVacantesScreen         = lazyWeb(() => import('./src/screens/empleador/ExplorarVacantesScreen'));
const DetalleVacanteReferenciaScreen = lazyWeb(() => import('./src/screens/empleador/DetalleVacanteReferenciaScreen'));
const MisPostulantesScreen           = lazyWeb(() => import('./src/screens/empleador/MisPostulantesScreen'));
const TrabajadoresRecomendadosScreen = lazyWeb(() => import('./src/screens/empleador/TrabajadoresRecomendadosScreen'));
const BuscarTrabajadoresScreen       = lazyWeb(() => import('./src/screens/empleador/BuscarTrabajadoresScreen'));
const TrabajadoresMapaScreen         = lazyWeb(() => import('./src/screens/empleador/TrabajadoresMapaScreen'));

// ── Admin — lazy en web ───────────────────────────────────────────────────
const AdminDashboardScreen           = lazyWeb(() => import('./src/screens/admin/AdminDashboardScreen'));
const AdminUsuariosScreen            = lazyWeb(() => import('./src/screens/admin/AdminUsuariosScreen'));
const AdminDetalleUsuarioScreen      = lazyWeb(() => import('./src/screens/admin/AdminDetalleUsuarioScreen'));
const AdminVerificacionCedulasScreen  = lazyWeb(() => import('./src/screens/admin/AdminVerificacionCedulasScreen'));
const AdminVerificacionDetalleScreen  = lazyWeb(() => import('./src/screens/admin/AdminVerificacionDetalleScreen'));
const AdminVacantesScreen            = lazyWeb(() => import('./src/screens/admin/AdminVacantesScreen'));
const AdminPostulantesVacanteScreen  = lazyWeb(() => import('./src/screens/admin/AdminPostulantesVacanteScreen'));

// Fallback mientras carga un chunk lazy
const LazyFallback = () => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Ionicons name="leaf" size={32} color={COLORS.primary} />
  </View>
);

// Wrapper Suspense (necesario siempre que se use React.lazy)
const S = ({ children }) => (
  <Suspense fallback={<LazyFallback />}>{children}</Suspense>
);

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const WHATSAPP_NUMBER = '573108870800';
const WHATSAPP_MESSAGE = 'Hola, necesito ayuda con TerraEmpleo.';

const openWhatsAppSupport = async () => {
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_MESSAGE)}`;
  try {
    const supported = await Linking.canOpenURL(url);
    if (supported) {
      await Linking.openURL(url);
    } else {
      Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp. Verifica que esté instalado.');
    }
  } catch {
    Alert.alert('Error', 'No se pudo abrir el enlace de soporte.');
  }
};

function SoporteHeaderButton() {
  return (
    <TouchableOpacity onPress={openWhatsAppSupport} style={{ marginRight: 14, padding: 4 }}>
      <Ionicons name="headset-outline" size={22} color={COLORS.white} />
    </TouchableOpacity>
  );
}

// Custom screen transition: slide + fade
const customTransition = {
  cardStyleInterpolator: ({ current, layouts }) => ({
    cardStyle: {
      transform: [
        {
          translateX: current.progress.interpolate({
            inputRange: [0, 1],
            outputRange: [layouts.screen.width * 0.2, 0],
          }),
        },
      ],
      opacity: current.progress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0.6, 1],
      }),
    },
  }),
  transitionSpec: {
    open: { animation: 'spring', config: { damping: 22, stiffness: 220, mass: 0.85 } },
    close: { animation: 'spring', config: { damping: 22, stiffness: 220, mass: 0.85 } },
  },
};

const headerOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { ...FONTS.subtitle, color: COLORS.white, fontWeight: FONTS.weight.bold },
  headerBackTitleVisible: false,
  headerBackTitle: '',
  headerTruncatedBackTitle: '',
  headerRight: () => <SoporteHeaderButton />,
};

const stackScreenOptions = {
  ...headerOptions,
  ...customTransition,
};

const tabScreenOptions = ({ route }) => ({
  tabBarIcon: ({ focused, color, size }) => {
    let iconName;
    switch (route.name) {
      case 'Vacantes': iconName = focused ? 'briefcase' : 'briefcase-outline'; break;
      case 'Postulaciones': iconName = focused ? 'document-text' : 'document-text-outline'; break;
      case 'MisVacantes': iconName = focused ? 'list' : 'list-outline'; break;
      case 'Explorar': iconName = focused ? 'search' : 'search-outline'; break;
      case 'Dashboard': iconName = focused ? 'stats-chart' : 'stats-chart-outline'; break;
      case 'Usuarios': iconName = focused ? 'people' : 'people-outline'; break;
      case 'Verificacion': iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline'; break;
      case 'AdminVacantes': iconName = focused ? 'briefcase' : 'briefcase-outline'; break;
      case 'Trabajadores': iconName = focused ? 'people' : 'people-outline'; break;
      case 'ParaTi': iconName = focused ? 'sparkles' : 'sparkles-outline'; break;
      case 'Mapa': iconName = focused ? 'map' : 'map-outline'; break;
      case 'Mensajes': iconName = focused ? 'chatbubbles' : 'chatbubbles-outline'; break;
      case 'Perfil': iconName = focused ? 'person' : 'person-outline'; break;
      default: iconName = 'ellipse';
    }
    return <Ionicons name={iconName} size={size} color={color} />;
  },
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textLight,
  tabBar: (props) => <AnimatedTabBar {...props} />,
  headerShown: false,
});

function PerfilStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="PerfilHome" component={PerfilScreen} options={{ title: 'Mi Perfil' }} />
      <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ title: 'Editar Perfil' }} />
    </Stack.Navigator>
  );
}

// Wrappers para screens lazy usadas directamente en Tab.Screen (sin stack propio)
const MisPostulacionesTab = (props) => <S><MisPostulacionesScreen {...props} /></S>;

function AdminVerificacionStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="AdminVerificacionHome" component={AdminVerificacionCedulasScreen}
          options={{ title: 'Cédulas Pendientes' }} />
        <Stack.Screen name="AdminVerificacionDetalle" component={AdminVerificacionDetalleScreen}
          options={{ title: 'Verificar identidad' }} />
      </Stack.Navigator>
    </S>
  );
}

// ── Trabajador Tabs ──
function TrabajadorTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Vacantes" component={TrabajadorVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Mapa" component={VacantesMapaStack}
        options={{ tabBarLabel: 'Mapa' }} />
      <Tab.Screen name="ParaTi" component={VacantesRecomendadasStack}
        options={{ tabBarLabel: 'Para ti' }} />
      <Tab.Screen name="Postulaciones" component={MisPostulacionesTab}
        options={{ tabBarLabel: 'Mis Postulaciones' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function VacantesRecomendadasStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="RecomendadasHome" component={VacantesRecomendadasScreen}
          options={{ title: 'Recomendadas para ti' }} />
        <Stack.Screen name="DetalleVacanteRecomendada" component={DetalleVacanteScreen}
          options={{ title: 'Detalle de Vacante' }} />
      </Stack.Navigator>
    </S>
  );
}

function TrabajadorVacantesStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="VacantesHome" component={TrabajadorVacantesScreen}
          options={{ title: 'Vacantes Disponibles' }} />
        <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
          options={{ title: 'Detalle de Vacante' }} />
        <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
          options={{ headerShown: false }} />
      </Stack.Navigator>
    </S>
  );
}

function VacantesMapaStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="VacantesMapaHome" component={VacantesMapaScreen}
          options={{ title: 'Mapa de Vacantes' }} />
        <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
          options={{ title: 'Detalle de Vacante' }} />
      </Stack.Navigator>
    </S>
  );
}

function ChatsStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="ChatsHome" component={ChatsScreen}
        options={{ title: 'Mensajes' }} />
      <Stack.Screen name="ChatDetalle" component={ChatDetalleScreen}
        options={{ title: 'Chat' }} />
      <Stack.Screen name="PerfilPublicoTrabajador" component={PerfilPublicoTrabajadorScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="PerfilPublicoEmpleador" component={PerfilPublicoEmpleadorScreen}
        options={{ title: 'Perfil de la Finca' }} />
    </Stack.Navigator>
  );
}

// ── Empleador Tabs ──
function EmpleadorTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="MisVacantes" component={EmpleadorVacantesStack}
        options={{ tabBarLabel: 'Mis Vacantes' }} />
      <Tab.Screen name="Trabajadores" component={BuscarTrabajadoresStack}
        options={{ tabBarLabel: 'Trabajadores' }} />
      <Tab.Screen name="Mapa" component={TrabajadoresMapaTabStack}
        options={{ tabBarLabel: 'Mapa' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function ParaTiEmpleadorStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="TrabajadoresRecomendadosHome"
          component={TrabajadoresRecomendadosScreen}
          options={{ title: 'Trabajadores recomendados' }}
        />
        <Stack.Screen
          name="PerfilPublicoTrabajador"
          component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </S>
  );
}

function BuscarTrabajadoresStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="BuscarTrabajadoresHome"
          component={BuscarTrabajadoresScreen}
          options={{ title: 'Buscar trabajadores', headerShown: false }}
        />
        <Stack.Screen
          name="TrabajadoresRecomendados"
          component={TrabajadoresRecomendadosScreen}
          options={{ title: 'Trabajadores recomendados', headerShown: false }}
        />
        <Stack.Screen
          name="TrabajadoresMapa"
          component={TrabajadoresMapaScreen}
          options={{ title: 'Mapa de trabajadores' }}
        />
        <Stack.Screen
          name="PerfilPublicoTrabajador"
          component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }}
        />
      </Stack.Navigator>
    </S>
  );
}

function ExplorarVacantesStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="ExplorarVacantesHome"
          component={ExplorarVacantesScreen}
          options={{ title: 'Explorar ofertas' }}
        />
        <Stack.Screen
          name="DetalleVacanteReferencia"
          component={DetalleVacanteReferenciaScreen}
          options={{ title: 'Detalle de referencia' }}
        />
      </Stack.Navigator>
    </S>
  );
}

function EmpleadorVacantesStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="EmpleadorHome" component={EmpleadorVacantesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="CrearVacante" component={CrearVacanteScreen}
          options={{ title: 'Nueva Vacante' }} />
        <Stack.Screen name="EditarVacante" component={EditarVacanteScreen}
          options={{ title: 'Editar Vacante' }} />
        <Stack.Screen name="DetalleVacanteEmpleador" component={DetalleVacanteEmpleadorScreen}
          options={{ title: 'Detalle de Vacante' }} />
        <Stack.Screen name="VerPostulaciones" component={VerPostulacionesScreen}
          options={{ title: 'Postulaciones' }} />
        <Stack.Screen name="MisPostulantes" component={MisPostulantesScreen}
          options={{ title: 'Mis Postulantes' }} />
        <Stack.Screen name="PerfilPublicoTrabajador" component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="ExplorarVacantes" component={ExplorarVacantesScreen}
          options={{ title: 'Explorar ofertas' }} />
        <Stack.Screen name="DetalleVacanteReferencia" component={DetalleVacanteReferenciaScreen}
          options={{ title: 'Detalle de referencia' }} />
      </Stack.Navigator>
    </S>
  );
}

function TrabajadoresMapaTabStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="TrabajadoresMapaHome" component={TrabajadoresMapaScreen}
          options={{ title: 'Mapa de trabajadores' }} />
        <Stack.Screen name="PerfilPublicoTrabajador" component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }} />
      </Stack.Navigator>
    </S>
  );
}

// ── Admin Tabs ──
function AdminUsuariosStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="AdminUsuariosHome"
          component={AdminUsuariosScreen}
          options={{ title: 'Usuarios' }}
        />
        <Stack.Screen
          name="AdminDetalleUsuario"
          component={AdminDetalleUsuarioScreen}
          options={{ title: 'Perfil de Usuario' }}
        />
      </Stack.Navigator>
    </S>
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={AdminDashboardStack}
        options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Usuarios" component={AdminUsuariosStack}
        options={{ tabBarLabel: 'Usuarios' }} />
      <Tab.Screen name="Verificacion" component={AdminVerificacionStack}
        options={{ tabBarLabel: 'Verificación' }} />
      <Tab.Screen name="AdminVacantes" component={AdminVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function AdminVacantesStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen
          name="AdminVacantesHome"
          component={AdminVacantesScreen}
          options={{ title: 'Vacantes' }}
        />
        <Stack.Screen
          name="AdminVerPostulantes"
          component={AdminPostulantesVacanteScreen}
          options={{ title: 'Postulantes' }}
        />
        <Stack.Screen
          name="AdminDetalleVacante"
          component={DetalleVacanteEmpleadorScreen}
          options={{ title: 'Detalle de Vacante' }}
        />
        <Stack.Screen
          name="EditarVacante"
          component={EditarVacanteScreen}
          options={{ title: 'Editar Vacante' }}
        />
        <Stack.Screen
          name="VerPostulaciones"
          component={AdminPostulantesVacanteScreen}
          options={{ title: 'Postulantes' }}
        />
        <Stack.Screen
          name="PerfilPublicoTrabajador"
          component={PerfilPublicoTrabajadorScreen}
          options={{ title: 'Perfil del Trabajador' }}
        />
        <Stack.Screen
          name="PerfilPublicoEmpleador"
          component={PerfilPublicoEmpleadorScreen}
          options={{ title: 'Perfil del Empleador' }}
        />
      </Stack.Navigator>
    </S>
  );
}

function AdminDashboardStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen}
          options={{ title: 'Admin Dashboard' }} />
        <Stack.Screen name="AdminUsuarios" component={AdminUsuariosStack}
          options={{ headerShown: false }} />
        <Stack.Screen
          name="AdminVacantes"
          component={AdminVacantesStack}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="AdminCrearVacante" component={CrearVacanteScreen}
          options={{ title: 'Crear Vacante (Admin)' }} />
        <Stack.Screen name="AdminVistas" component={AdminUsuariosScreen}
          options={{ title: 'Vista Previa de Usuarios' }} />
      </Stack.Navigator>
    </S>
  );
}

// ── Auth Stack ──
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ ...stackScreenOptions, headerShown: false, headerRight: undefined }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen}
        options={{ headerShown: true, title: 'Iniciar sesión' }} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen}
        options={{ headerShown: true, title: 'Tipo de cuenta' }} />
      <Stack.Screen name="RegisterTrabajador" component={RegisterTrabajadorScreen}
        options={{ headerShown: true, title: 'Registro Trabajador' }} />
      <Stack.Screen name="RegisterEmpleador" component={RegisterEmpleadorScreen}
        options={{ headerShown: true, title: 'Registro Empleador' }} />
      <Stack.Screen name="RecuperarPassword" component={RecuperarPasswordScreen}
        options={{ headerShown: true, title: 'Recuperar contraseña' }} />
      <Stack.Screen name="DocumentoLegal" component={DocumentoLegalScreen}
        options={{ headerShown: true, title: 'Documento legal' }} />
      <Stack.Screen
        name="ValidacionInternaIdentidad"
        component={VerificationNavigator}
        options={{ headerShown: false }}
      />
    </Stack.Navigator>
  );
}

// ── Root Navigator ──
function RootNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useAppTheme();
  usePushNotifications(!!user);
  const { isOnline } = useNetworkStatus();
  const wasLoggedIn = useRef(false);

  useEffect(() => {
    if (user) {
      wasLoggedIn.current = true;
    } else if (wasLoggedIn.current) {
      wasLoggedIn.current = false;
      setTimeout(() => {
        if (navigationRef.isReady()) {
          navigationRef.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{
                name: 'Auth',
                state: { routes: [{ name: 'Welcome' }] },
              }],
            })
          );
        }
      }, 100);
    }
  }, [user]);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <MotiView
          from={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 800 }}
        >
          <Ionicons name="leaf" size={48} color={colors.primary} />
        </MotiView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : user.rol === 'admin' ? (
          <Stack.Screen name="AdminMain" component={AdminTabs} />
        ) : user.rol === 'empleador' ? (
          <Stack.Screen name="EmpleadorMain" component={EmpleadorTabs} />
        ) : (
          <Stack.Screen name="TrabajadorMain" component={TrabajadorTabs} />
        )}
      </Stack.Navigator>
      <OfflineBanner isOnline={isOnline} />
    </View>
  );
}

function AppShell() {
  const { navigationTheme, colors, isDark } = useAppTheme();
  const toastRef = useRef(null);
  const alertRef = useRef(null);

  React.useEffect(() => {
    setGlobalToastRef(toastRef.current);
    setGlobalAlertRef(alertRef.current);
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer ref={navigationRef} theme={navigationTheme}>
          <StatusBar style={isDark ? 'light' : 'dark'} backgroundColor={colors.primaryDark} />
          <RootNavigator />
          <Toast ref={toastRef} />
          <AppAlert ref={alertRef} />
        </NavigationContainer>
      </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}
