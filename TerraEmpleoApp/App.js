import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, TouchableOpacity, Linking, Alert } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NavigationContainer, CommonActions } from '@react-navigation/native';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { navigationRef } from './src/navigation/navigationRef';
import { COLORS, FONTS } from './src/theme';
import { AnimatedTabBar } from './src/components/animated';

// Auth
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RoleSelectScreen from './src/screens/auth/RoleSelectScreen';
import RegisterTrabajadorScreen from './src/screens/auth/RegisterTrabajadorScreen';
import RegisterEmpleadorScreen from './src/screens/auth/RegisterEmpleadorScreen';
import RecuperarPasswordScreen from './src/screens/auth/RecuperarPasswordScreen';
import DocumentoLegalScreen from './src/screens/auth/DocumentoLegalScreen';

// Trabajador
import TrabajadorVacantesScreen from './src/screens/trabajador/TrabajadorVacantesScreen';
import DetalleVacanteScreen from './src/screens/trabajador/DetalleVacanteScreen';
import MisPostulacionesScreen from './src/screens/trabajador/MisPostulacionesScreen';
import VacantesRecomendadasScreen from './src/screens/trabajador/VacantesRecomendadasScreen';
import VacantesMapaScreen from './src/screens/trabajador/VacantesMapaScreen';

// Empleador
import EmpleadorVacantesScreen from './src/screens/empleador/EmpleadorVacantesScreen';
import CrearVacanteScreen from './src/screens/empleador/CrearVacanteScreen';
import EditarVacanteScreen from './src/screens/empleador/EditarVacanteScreen';
import VerPostulacionesScreen from './src/screens/empleador/VerPostulacionesScreen';
import DetalleVacanteEmpleadorScreen from './src/screens/empleador/DetalleVacanteEmpleadorScreen';
import ExplorarVacantesScreen from './src/screens/empleador/ExplorarVacantesScreen';
import DetalleVacanteReferenciaScreen from './src/screens/empleador/DetalleVacanteReferenciaScreen';
import MisPostulantesScreen from './src/screens/empleador/MisPostulantesScreen';
import BuscarTrabajadoresScreen from './src/screens/empleador/BuscarTrabajadoresScreen';

// Admin
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminUsuariosScreen from './src/screens/admin/AdminUsuariosScreen';
import AdminDetalleUsuarioScreen from './src/screens/admin/AdminDetalleUsuarioScreen';
import AdminVerificacionCedulasScreen from './src/screens/admin/AdminVerificacionCedulasScreen';
import AdminVacantesScreen from './src/screens/admin/AdminVacantesScreen';
import AdminPostulantesVacanteScreen from './src/screens/admin/AdminPostulantesVacanteScreen';

// Shared
import PerfilScreen from './src/screens/shared/PerfilScreen';
import EditarPerfilScreen from './src/screens/shared/EditarPerfilScreen';
import PerfilPublicoTrabajadorScreen from './src/screens/shared/PerfilPublicoTrabajadorScreen';
import PerfilPublicoEmpleadorScreen from './src/screens/shared/PerfilPublicoEmpleadorScreen';
import NotificacionesScreen from './src/screens/shared/NotificacionesScreen';
import ChatsScreen from './src/screens/shared/ChatsScreen';
import ChatDetalleScreen from './src/screens/shared/ChatDetalleScreen';
import VerificationNavigator from './src/modules/verification/navigation/VerificationNavigator';

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
      <Tab.Screen name="Postulaciones" component={MisPostulacionesScreen}
        options={{ tabBarLabel: 'Mis Postulaciones', headerShown: true, ...headerOptions, title: 'Mis Postulaciones' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function VacantesRecomendadasStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="RecomendadasHome" component={VacantesRecomendadasScreen}
        options={{ title: 'Recomendadas para ti' }} />
      <Stack.Screen name="DetalleVacanteRecomendada" component={DetalleVacanteScreen}
        options={{ title: 'Detalle de Vacante' }} />
    </Stack.Navigator>
  );
}

function TrabajadorVacantesStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="VacantesHome" component={TrabajadorVacantesScreen}
        options={{ title: 'Vacantes Disponibles' }} />
      <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
        options={{ title: 'Detalle de Vacante' }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
        options={{ title: 'Notificaciones' }} />
    </Stack.Navigator>
  );
}

function VacantesMapaStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="VacantesMapaHome" component={VacantesMapaScreen}
        options={{ title: 'Mapa de Vacantes' }} />
      <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
        options={{ title: 'Detalle de Vacante' }} />
    </Stack.Navigator>
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
        options={{ title: 'Perfil del Trabajador' }} />
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
      <Tab.Screen name="Explorar" component={ExplorarVacantesStack}
        options={{ tabBarLabel: 'Explorar ofertas' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function BuscarTrabajadoresStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen
        name="BuscarTrabajadoresHome"
        component={BuscarTrabajadoresScreen}
        options={{ title: 'Trabajadores disponibles' }}
      />
      <Stack.Screen
        name="PerfilPublicoTrabajador"
        component={PerfilPublicoTrabajadorScreen}
        options={{ title: 'Perfil del Trabajador' }}
      />
    </Stack.Navigator>
  );
}

function ExplorarVacantesStack() {
  return (
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
  );
}

function EmpleadorVacantesStack() {
  return (
    <Stack.Navigator screenOptions={stackScreenOptions}>
      <Stack.Screen name="EmpleadorHome" component={EmpleadorVacantesScreen}
        options={{ title: 'Mis Vacantes' }} />
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
        options={{ title: 'Perfil del Trabajador' }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
        options={{ title: 'Notificaciones' }} />
    </Stack.Navigator>
  );
}

// ── Admin Tabs ──
function AdminUsuariosStack() {
  return (
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
  );
}

function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={AdminDashboardStack}
        options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Usuarios" component={AdminUsuariosStack}
        options={{ tabBarLabel: 'Usuarios' }} />
      <Tab.Screen name="Verificacion" component={AdminVerificacionCedulasScreen}
        options={{ tabBarLabel: 'Verificación', headerShown: true, ...headerOptions, title: 'Cédulas Pendientes' }} />
      <Tab.Screen name="AdminVacantes" component={AdminVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function AdminVacantesStack() {
  return (
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
  );
}

function AdminDashboardStack() {
  return (
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
  );
}

// ── Auth Stack ──
function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ ...stackScreenOptions, headerShown: false, headerRight: undefined }}>
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="Login" component={LoginScreen}
        options={{ headerShown: true, title: 'Iniciar Sesión' }} />
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <MotiView
          from={{ scale: 0.8, opacity: 0.4 }}
          animate={{ scale: 1.1, opacity: 1 }}
          transition={{ loop: true, type: 'timing', duration: 800 }}
        >
          <Ionicons name="leaf" size={48} color={COLORS.primary} />
        </MotiView>
      </View>
    );
  }

  return (
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
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <NavigationContainer ref={navigationRef}>
            <StatusBar style="light" backgroundColor={COLORS.primaryDark} />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
