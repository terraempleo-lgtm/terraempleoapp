// OTA trigger: publicar módulo finca cafetera tras configurar EXPO_TOKEN.
import React, { useEffect, useRef, useState, Suspense } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Updates from 'expo-updates';
import { View, TouchableOpacity, Linking, Alert, Text, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, CommonActions, getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { FincaProvider, useFinca } from './src/context/FincaContext';
import { usePushNotifications } from './src/hooks/usePushNotifications';
import { ThemeProvider, useAppTheme } from './src/context/ThemeContext';
import { navigationRef } from './src/navigation/navigationRef';
import { COLORS, FONTS } from './src/theme';
import { AnimatedTabBar } from './src/components/animated';
import { chatsAPI } from './src/services/api';
import { Toast, AppAlert } from './src/components/ui';
import SplashAnimado from './src/components/ui/SplashAnimado';
import { setGlobalToastRef } from './src/utils/toastService';
import { setGlobalAlertRef } from './src/utils/alertService';
import OfflineSyncManager from './src/components/OfflineSyncManager';

// ── Helper: lazy en todos los entornos (Metro no hace split → resuelve sync en native)
const lazyWeb = (importFn) => React.lazy(importFn);

// ── Auth — siempre necesario, estático ───────────────────────────────────
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RoleSelectScreen from './src/screens/auth/RoleSelectScreen';
import RegisterTrabajadorScreen from './src/screens/auth/RegisterTrabajadorScreen';
import RegisterEmpleadorScreen from './src/screens/auth/RegisterEmpleadorScreen';
import RegisterEspecialistaScreen from './src/screens/auth/RegisterEspecialistaScreen';
import RecuperarPasswordScreen from './src/screens/auth/RecuperarPasswordScreen';
import DocumentoLegalScreen from './src/screens/auth/DocumentoLegalScreen';
import PasskeyEnrollScreen from './src/screens/auth/PasskeyEnrollScreen';
import VerificationNavigator from './src/modules/verification/navigation/VerificationNavigator';

// ── Shared — necesario para todos los roles autenticados, estático ────────
import PerfilScreen from './src/screens/shared/PerfilScreen';
import EditarPerfilScreen from './src/screens/shared/EditarPerfilScreen';
import NotificacionesScreen from './src/screens/shared/NotificacionesScreen';
import ChatsScreen from './src/screens/shared/ChatsScreen';
import ChatDetalleScreen from './src/screens/shared/ChatDetalleScreen';
import PerfilPublicoTrabajadorScreen from './src/screens/shared/PerfilPublicoTrabajadorScreen';
import PerfilPublicoEmpleadorScreen from './src/screens/shared/PerfilPublicoEmpleadorScreen';
import PqrsScreen from './src/screens/shared/PqrsScreen';
import MisServiciosScreen from './src/screens/shared/MisServiciosScreen';
import DetalleServicioScreen from './src/screens/shared/DetalleServicioScreen';

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

// ── Finca cafetera — lazy en web ──────────────────────────────────────────
const ResumenFincaScreen        = lazyWeb(() => import('./src/screens/finca/dueno/ResumenFincaScreen'));
const JornadasScreen            = lazyWeb(() => import('./src/screens/finca/dueno/JornadasScreen'));
const LeerPlanillaScreen        = lazyWeb(() => import('./src/screens/finca/shared/LeerPlanillaScreen'));
const MuroScreen                = lazyWeb(() => import('./src/screens/finca/dueno/MuroScreen'));
const PublicarMuroScreen        = lazyWeb(() => import('./src/screens/finca/dueno/PublicarMuroScreen'));
const CafeScreen                = lazyWeb(() => import('./src/screens/finca/dueno/CafeScreen'));
const FinanzasScreen            = lazyWeb(() => import('./src/screens/finca/dueno/FinanzasScreen'));
const BalanceFincaScreen        = lazyWeb(() => import('./src/screens/finca/dueno/BalanceFincaScreen'));
const RendimientoScreen         = lazyWeb(() => import('./src/screens/finca/dueno/RendimientoScreen'));
const AuditoriaScreen           = lazyWeb(() => import('./src/screens/finca/dueno/AuditoriaScreen'));
const ConfiguracionFincaScreen  = lazyWeb(() => import('./src/screens/finca/dueno/ConfiguracionFincaScreen'));
const CuadernoAdminScreen       = lazyWeb(() => import('./src/screens/finca/capataz/CuadernoAdminScreen'));
const NominaScreen              = lazyWeb(() => import('./src/screens/finca/shared/NominaScreen'));
const DetalleJornadaScreen      = lazyWeb(() => import('./src/screens/finca/shared/DetalleJornadaScreen'));
const CerrarJornadaScreen       = lazyWeb(() => import('./src/screens/finca/shared/CerrarJornadaScreen'));
const HistorialTrabajadorScreen = lazyWeb(() => import('./src/screens/finca/shared/HistorialTrabajadorScreen'));
const PreciosScreen             = lazyWeb(() => import('./src/screens/finca/shared/PreciosScreen'));

// ── Admin — lazy en web ───────────────────────────────────────────────────
const AdminDashboardScreen           = lazyWeb(() => import('./src/screens/admin/AdminDashboardScreen'));
const AdminUsuariosScreen            = lazyWeb(() => import('./src/screens/admin/AdminUsuariosScreen'));
const AdminDetalleUsuarioScreen      = lazyWeb(() => import('./src/screens/admin/AdminDetalleUsuarioScreen'));
const AdminVerificacionCedulasScreen  = lazyWeb(() => import('./src/screens/admin/AdminVerificacionCedulasScreen'));
const AdminVerificacionDetalleScreen  = lazyWeb(() => import('./src/screens/admin/AdminVerificacionDetalleScreen'));
const AdminVacantesScreen            = lazyWeb(() => import('./src/screens/admin/AdminVacantesScreen'));
const AdminPostulantesVacanteScreen  = lazyWeb(() => import('./src/screens/admin/AdminPostulantesVacanteScreen'));
const AdminMatchesScreen             = lazyWeb(() => import('./src/screens/admin/AdminMatchesScreen'));
const AdminReportesScreen            = lazyWeb(() => import('./src/screens/admin/AdminReportesScreen'));
const AdminPqrsScreen                = lazyWeb(() => import('./src/screens/admin/AdminPqrsScreen'));
const AdminServiciosScreen           = lazyWeb(() => import('./src/screens/admin/AdminServiciosScreen'));

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
    await Linking.openURL(url);
  } catch {
    Alert.alert('WhatsApp no disponible', 'No se pudo abrir WhatsApp. Verifica que esté instalado o visita wa.me');
  }
};

function SoporteHeaderButton() {
  return (
    <TouchableOpacity onPress={openWhatsAppSupport} style={{ marginRight: 14, padding: 4 }}>
      <Ionicons name="headset-outline" size={22} color={COLORS.textPrimary} />
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

const stackScreenOptions = ({ theme }) => ({
  headerStyle: { elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
  headerTintColor: theme.colors.text,
  headerTitleStyle: { ...FONTS.subtitle, fontWeight: FONTS.weight.bold, color: theme.colors.text },
  headerBackTitleVisible: false,
  headerBackTitle: '',
  headerTruncatedBackTitle: '',
  headerRight: () => <SoporteHeaderButton />,
  ...customTransition,
});

// La tab bar flota con position:'absolute' sobre el contenido — dentro de
// ChatDetalle eso tapaba la barra de escribir/enviar audio/imagen porque
// ambas quedaban pegadas al borde inferior. La ocultamos solo en esa pantalla.
function mensajesTabBarOptions(route) {
  const routeName = getFocusedRouteNameFromRoute(route) ?? 'ChatsHome';
  return {
    tabBarStyle: routeName === 'ChatDetalle' ? { display: 'none' } : { position: 'absolute' },
  };
}

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
      case 'AdminServicios': iconName = focused ? 'cube' : 'cube-outline'; break;
      case 'AdminPqrs': iconName = focused ? 'chatbox-ellipses' : 'chatbox-ellipses-outline'; break;
      case 'Trabajadores': iconName = focused ? 'people' : 'people-outline'; break;
      case 'ParaTi': iconName = focused ? 'sparkles' : 'sparkles-outline'; break;
      case 'Mapa': iconName = focused ? 'map' : 'map-outline'; break;
      case 'Mensajes': iconName = focused ? 'chatbubbles' : 'chatbubbles-outline'; break;
      case 'Perfil': iconName = focused ? 'person' : 'person-outline'; break;
      case 'Muro': iconName = focused ? 'storefront' : 'storefront-outline'; break;
      case 'Resumen': iconName = focused ? 'stats-chart' : 'stats-chart-outline'; break;
      case 'Jornadas': iconName = focused ? 'today' : 'today-outline'; break;
      case 'Nomina': iconName = focused ? 'wallet' : 'wallet-outline'; break;
      case 'Cafe': iconName = focused ? 'cafe' : 'cafe-outline'; break;
      case 'Finanzas': iconName = focused ? 'cash' : 'cash-outline'; break;
      case 'Rendimiento': iconName = focused ? 'trending-up' : 'trending-up-outline'; break;
      case 'CuadernoAdmin': iconName = focused ? 'book' : 'book-outline'; break;
      case 'Cuaderno': iconName = focused ? 'book' : 'book-outline'; break;
      default: iconName = 'ellipse';
    }
    return <Ionicons name={iconName} size={size} color={color} />;
  },
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textLight,
  tabBar: (props) => <AnimatedTabBar {...props} />,
  tabBarStyle: { position: 'absolute' },
  headerShown: false,
});

function PerfilStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="PerfilHome" component={PerfilScreen} options={{ headerShown: false }} />
      <Stack.Screen name="EditarPerfil" component={EditarPerfilScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Pqrs" component={PqrsScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MisServicios" component={MisServiciosScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

function MisPostulacionesStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="MisPostulacionesHome" component={MisPostulacionesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="PerfilPublicoEmpleador" component={PerfilPublicoEmpleadorScreen}
          options={{ title: 'Perfil de la Finca' }} />
      </Stack.Navigator>
    </S>
  );
}

function AdminVerificacionStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="AdminVerificacionHome" component={AdminVerificacionCedulasScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="AdminVerificacionDetalle" component={AdminVerificacionDetalleScreen}
          options={{ title: 'Verificar identidad' }} />
      </Stack.Navigator>
    </S>
  );
}

function useChatUnread() {
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await chatsAPI.contarNoLeidos();
        if (!cancelled) setUnread(res.data?.no_leidos || 0);
      } catch (_) {}
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);
  return unread;
}

// ── Trabajador Tabs ──
function TrabajadorTabs() {
  const unread = useChatUnread();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Vacantes" component={TrabajadorVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Mapa" component={VacantesMapaStack}
        options={{ tabBarLabel: 'Mapa' }} />
      <Tab.Screen name="ParaTi" component={VacantesRecomendadasStack}
        options={{ tabBarLabel: 'Para ti' }} />
      <Tab.Screen name="Postulaciones" component={MisPostulacionesStack}
        options={{ tabBarLabel: 'Mis Postulaciones' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={({ route }) => ({ tabBarLabel: 'Mensajes', tabBarBadge: unread > 0 ? unread : undefined, ...mensajesTabBarOptions(route) })} />
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
          options={{ headerShown: false }} />
        <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="PerfilPublicoEmpleador" component={PerfilPublicoEmpleadorScreen}
          options={{ title: 'Perfil de la Finca' }} />
        <Stack.Screen name="DetalleServicio" component={DetalleServicioScreen}
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
          options={{ headerShown: false }} />
        <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
          options={{ title: 'Detalle de Vacante' }} />
        <Stack.Screen name="PerfilPublicoEmpleador" component={PerfilPublicoEmpleadorScreen}
          options={{ title: 'Perfil de la Finca' }} />
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

// ── Finca cafetera — pantallas compartidas por dueño y capataz (jornada, historial, precios) ──
function fincaSharedScreens() {
  return (
    <>
      <Stack.Screen name="DetalleJornada" component={DetalleJornadaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CerrarJornada" component={CerrarJornadaScreen} options={{ headerShown: false }} />
      <Stack.Screen name="LeerPlanilla" component={LeerPlanillaScreen} options={{ headerShown: false, presentation: 'fullScreenModal' }} />
      <Stack.Screen name="HistorialTrabajador" component={HistorialTrabajadorScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Precios" component={PreciosScreen} options={{ headerShown: false }} />
    </>
  );
}

// Cuaderno del dueño: Resumen/Jornadas/Nómina/Café/Finanzas/Rendimiento viven
// como pantallas hermanas dentro de un único tab "Cuaderno" — la navegación
// entre ellas la resuelve CuadernoTopNav (pills internas, como en el panel web),
// no la barra de tabs inferior.
function CuadernoStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="ResumenFincaHome" component={ResumenFincaScreen} options={{ headerShown: false }} />
        <Stack.Screen name="JornadasHome" component={JornadasScreen} options={{ headerShown: false }} />
        <Stack.Screen name="NominaHome" component={NominaScreen} options={{ headerShown: false }} />
        <Stack.Screen name="CafeHome" component={CafeScreen} options={{ headerShown: false }} />
        <Stack.Screen name="FinanzasHome" component={FinanzasScreen} options={{ headerShown: false }} />
        <Stack.Screen name="BalanceFincaHome" component={BalanceFincaScreen} options={{ headerShown: false }} />
        <Stack.Screen name="RendimientoHome" component={RendimientoScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Auditoria" component={AuditoriaScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ConfiguracionFinca" component={ConfiguracionFincaScreen} options={{ headerShown: false }} />
        {fincaSharedScreens()}
      </Stack.Navigator>
    </S>
  );
}

function MuroStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="MuroHome" component={MuroScreen} options={{ headerShown: false }} />
        <Stack.Screen name="PublicarMuro" component={PublicarMuroScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </S>
  );
}

// ── Capataz: guard estructural — su navegador solo expone Cuaderno y Nómina,
// no puede navegar a Café/Finanzas/Rendimiento/Muro/Auditoría porque esas
// rutas no existen en su árbol de navegación. ──
function CuadernoAdminStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="CuadernoAdminHome" component={CuadernoAdminScreen} options={{ headerShown: false }} />
        {fincaSharedScreens()}
      </Stack.Navigator>
    </S>
  );
}

function NominaCapatazStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="NominaHome" component={NominaScreen} options={{ headerShown: false }} />
        {fincaSharedScreens()}
      </Stack.Navigator>
    </S>
  );
}

function CapatazTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="CuadernoAdmin" component={CuadernoAdminStack} options={{ tabBarLabel: 'Cuaderno' }} />
      <Tab.Screen name="Nomina" component={NominaCapatazStack} options={{ tabBarLabel: 'Nómina' }} />
    </Tab.Navigator>
  );
}

// ── Empleador Tabs (propietario) ──
function EmpleadorTabs() {
  const unread = useChatUnread();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Cuaderno" component={CuadernoStack}
        options={{ tabBarLabel: 'Cuaderno' }} />
      <Tab.Screen name="Muro" component={MuroStack}
        options={{ tabBarLabel: 'Mercado' }} />
      <Tab.Screen name="MisVacantes" component={EmpleadorVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Trabajadores" component={BuscarTrabajadoresStack}
        options={{ tabBarLabel: 'Trabajadores' }}
        listeners={({ navigation }) => ({
          tabPress: () => navigation.navigate('Trabajadores', { screen: 'BuscarTrabajadoresHome' }),
        })} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={({ route }) => ({ tabBarLabel: 'Mensajes', tabBarBadge: unread > 0 ? unread : undefined, ...mensajesTabBarOptions(route) })} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

// ── Empleador root: rutea entre vista de capataz y vista de propietario según rol_finca ──
function EmpleadorRoot() {
  const { esCapataz, loading } = useFinca();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="leaf" size={32} color={COLORS.primary} />
      </View>
    );
  }
  return esCapataz ? <CapatazTabs /> : <EmpleadorTabs />;
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
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PerfilPublicoTrabajador"
          component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="DetalleServicio"
          component={DetalleServicioScreen}
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
          options={{ headerShown: false }} />
        <Stack.Screen name="EditarVacante" component={EditarVacanteScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="DetalleVacanteEmpleador" component={DetalleVacanteEmpleadorScreen}
          options={{ title: 'Detalle de Vacante' }} />
        <Stack.Screen name="VerPostulaciones" component={VerPostulacionesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="MisPostulantes" component={MisPostulantesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="PerfilPublicoTrabajador" component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="ExplorarVacantes" component={ExplorarVacantesScreen}
          options={{ title: 'Explorar ofertas' }} />
        <Stack.Screen name="DetalleVacanteReferencia" component={DetalleVacanteReferenciaScreen}
          options={{ title: 'Detalle de referencia' }} />
        <Stack.Screen name="DetalleServicio" component={DetalleServicioScreen}
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
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminDetalleUsuario"
          component={AdminDetalleUsuarioScreen}
          options={{ title: 'Perfil de Usuario' }}
        />
        <Stack.Screen
          name="PerfilPublicoTrabajador"
          component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }}
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

function AdminReportesStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="AdminReportesHome" component={AdminReportesScreen}
          options={{ headerShown: false }} />
      </Stack.Navigator>
    </S>
  );
}

function AdminPqrsStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="AdminPqrsHome" component={AdminPqrsScreen}
          options={{ headerShown: false }} />
      </Stack.Navigator>
    </S>
  );
}

function AdminServiciosStack() {
  return (
    <S>
      <Stack.Navigator screenOptions={stackScreenOptions}>
        <Stack.Screen name="AdminServiciosHome" component={AdminServiciosScreen}
          options={{ headerShown: false }} />
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
      <Tab.Screen name="AdminServicios" component={AdminServiciosStack}
        options={{ tabBarLabel: 'Servicios' }} />
      <Tab.Screen name="AdminReportes" component={AdminReportesStack}
        options={{ tabBarLabel: 'Reportes' }} />
      <Tab.Screen name="AdminPqrs" component={AdminPqrsStack}
        options={{ tabBarLabel: 'PQRS' }} />
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
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminVerPostulantes"
          component={AdminPostulantesVacanteScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminMatches"
          component={AdminMatchesScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AdminDetalleVacante"
          component={DetalleVacanteEmpleadorScreen}
          options={{ title: 'Detalle de Vacante' }}
        />
        <Stack.Screen
          name="EditarVacante"
          component={EditarVacanteScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="VerPostulaciones"
          component={AdminPostulantesVacanteScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="PerfilPublicoTrabajador"
          component={PerfilPublicoTrabajadorScreen}
          options={{ headerShown: false }}
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
          options={{ headerShown: false }} />
        <Stack.Screen name="AdminUsuarios" component={AdminUsuariosStack}
          options={{ headerShown: false }} />
        <Stack.Screen
          name="AdminVacantes"
          component={AdminVacantesStack}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="AdminCrearVacante" component={CrearVacanteScreen}
          options={{ headerShown: false }} />
        <Stack.Screen name="AdminVistas" component={AdminUsuariosScreen}
          options={{ title: 'Vista Previa de Usuarios' }} />
      </Stack.Navigator>
    </S>
  );
}

// ── Especialista Tabs ── (mismas vistas que trabajador)
function EspecialistaTabs() {
  const unread = useChatUnread();
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Vacantes" component={TrabajadorVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Mapa" component={VacantesMapaStack}
        options={{ tabBarLabel: 'Mapa' }} />
      <Tab.Screen name="ParaTi" component={VacantesRecomendadasStack}
        options={{ tabBarLabel: 'Para ti' }} />
      <Tab.Screen name="Postulaciones" component={MisPostulacionesStack}
        options={{ tabBarLabel: 'Mis Postulaciones' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={({ route }) => ({ tabBarLabel: 'Mensajes', tabBarBadge: unread > 0 ? unread : undefined, ...mensajesTabBarOptions(route) })} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

// ── Auth Stack ──
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ ...stackScreenOptions, headerShown: false, headerRight: undefined }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="RoleSelect" component={RoleSelectScreen}
        options={{ headerShown: true, title: 'Tipo de cuenta' }} />
      <Stack.Screen name="RegisterTrabajador" component={RegisterTrabajadorScreen}
        options={{ headerShown: true, title: 'Registro Trabajador' }} />
      <Stack.Screen name="RegisterEmpleador" component={RegisterEmpleadorScreen}
        options={{ headerShown: true, title: 'Registro Empleador' }} />
      <Stack.Screen name="RegisterEspecialista" component={RegisterEspecialistaScreen}
        options={{ headerShown: false }} />
      <Stack.Screen name="RecuperarPassword" component={RecuperarPasswordScreen}
        options={{ headerShown: true, title: 'Recuperar contraseña' }} />
      <Stack.Screen name="DocumentoLegal" component={DocumentoLegalScreen}
        options={{ headerShown: true, title: 'Documento legal' }} />
      <Stack.Screen name="PasskeyEnroll" component={PasskeyEnrollScreen}
        options={{ headerShown: false, gestureEnabled: false }} />
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
  const wasLoggedIn = useRef(false);
  const pendingVacante = useRef(null);

  // Deep link: abrir la vacante exacta cuando llega un link
  // https://app.terrampleo.com/app/vacantes/:id (o terraempleo://vacantes/:id).
  useEffect(() => {
    const intentarNavegar = () => {
      const id = pendingVacante.current;
      if (!id || !user) return; // la pantalla de detalle es de usuario autenticado
      if (navigationRef.isReady()) {
        try {
          navigationRef.navigate('DetalleVacante', { vacante: { id } });
          pendingVacante.current = null;
        } catch (_) {}
      }
    };
    const manejarUrl = (url) => {
      if (!url) return;
      const m = String(url).match(/vacantes?\/(\d+)/i);
      if (m && m[1]) { pendingVacante.current = Number(m[1]); intentarNavegar(); }
    };
    Linking.getInitialURL().then(manejarUrl).catch(() => {});
    const sub = Linking.addEventListener('url', (e) => manejarUrl(e && e.url));
    intentarNavegar(); // reintentar al cambiar la sesión (p. ej. tras login)
    return () => { if (sub && sub.remove) sub.remove(); };
  }, [user]);

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
    return <SplashAnimado />;
  }

  return (
    <View style={{ flex: 1 }}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <Stack.Screen name="Auth" component={AuthStack} />
        ) : user.rol === 'admin' ? (
          <Stack.Screen name="AdminMain" component={AdminTabs} />
        ) : user.rol === 'empleador' ? (
          <Stack.Screen name="EmpleadorMain">
            {() => (
              <FincaProvider>
                <EmpleadorRoot />
              </FincaProvider>
            )}
          </Stack.Screen>
        ) : user.rol === 'especialista' ? (
          <Stack.Screen name="EspecialistaMain" component={EspecialistaTabs} />
        ) : (
          <Stack.Screen name="TrabajadorMain" component={TrabajadorTabs} />
        )}
      </Stack.Navigator>
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

  React.useEffect(() => {
    if (__DEV__) return;
    (async () => {
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (_) {}
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      <AuthProvider>
        <OfflineSyncManager />
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

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  render() {
    if (this.state.hasError) {
      return (
        <View style={ebStyles.container}>
          <Text style={ebStyles.emoji}>🌿</Text>
          <Text style={ebStyles.title}>Algo salió mal</Text>
          <Text style={ebStyles.sub}>La app tuvo un error inesperado.{'\n'}Ciérrala y vuelve a abrirla.</Text>
          <TouchableOpacity style={ebStyles.btn} onPress={() => this.setState({ hasError: false })}>
            <Text style={ebStyles.btnText}>Intentar de nuevo</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const ebStyles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4', padding: 32 },
  emoji: { fontSize: 56, marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#14532D', marginBottom: 8 },
  sub: { fontSize: 15, color: '#166534', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  btn: { backgroundColor: '#2E7D32', borderRadius: 24, paddingHorizontal: 32, paddingVertical: 14 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppShell />
      </ThemeProvider>
    </ErrorBoundary>
  );
}
