import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { AuthProvider, useAuth } from './src/context/AuthContext';
import { COLORS } from './src/theme';

// Auth
import WelcomeScreen from './src/screens/auth/WelcomeScreen';
import LoginScreen from './src/screens/auth/LoginScreen';
import RoleSelectScreen from './src/screens/auth/RoleSelectScreen';
import RegisterTrabajadorScreen from './src/screens/auth/RegisterTrabajadorScreen';
import RegisterEmpleadorScreen from './src/screens/auth/RegisterEmpleadorScreen';
import RecuperarPasswordScreen from './src/screens/auth/RecuperarPasswordScreen';

// Trabajador
import TrabajadorVacantesScreen from './src/screens/trabajador/TrabajadorVacantesScreen';
import DetalleVacanteScreen from './src/screens/trabajador/DetalleVacanteScreen';
import MisPostulacionesScreen from './src/screens/trabajador/MisPostulacionesScreen';

// Empleador
import EmpleadorVacantesScreen from './src/screens/empleador/EmpleadorVacantesScreen';
import CrearVacanteScreen from './src/screens/empleador/CrearVacanteScreen';
import EditarVacanteScreen from './src/screens/empleador/EditarVacanteScreen';
import VerPostulacionesScreen from './src/screens/empleador/VerPostulacionesScreen';
import DetalleVacanteEmpleadorScreen from './src/screens/empleador/DetalleVacanteEmpleadorScreen';

// Admin
import AdminDashboardScreen from './src/screens/admin/AdminDashboardScreen';
import AdminUsuariosScreen from './src/screens/admin/AdminUsuariosScreen';
import AdminVacantesScreen from './src/screens/admin/AdminVacantesScreen';
import AdminPostulantesVacanteScreen from './src/screens/admin/AdminPostulantesVacanteScreen';

// Shared
import PerfilScreen from './src/screens/shared/PerfilScreen';
import EditarPerfilScreen from './src/screens/shared/EditarPerfilScreen';
import PerfilPublicoTrabajadorScreen from './src/screens/shared/PerfilPublicoTrabajadorScreen';
import NotificacionesScreen from './src/screens/shared/NotificacionesScreen';
import ChatsScreen from './src/screens/shared/ChatsScreen';
import ChatDetalleScreen from './src/screens/shared/ChatDetalleScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { fontWeight: '600' },
  headerBackTitleVisible: false,
};

const tabScreenOptions = ({ route }) => ({
  tabBarIcon: ({ focused, color, size }) => {
    let iconName;
    switch (route.name) {
      case 'Vacantes': iconName = focused ? 'briefcase' : 'briefcase-outline'; break;
      case 'Postulaciones': iconName = focused ? 'document-text' : 'document-text-outline'; break;
      case 'MisVacantes': iconName = focused ? 'list' : 'list-outline'; break;
      case 'Dashboard': iconName = focused ? 'stats-chart' : 'stats-chart-outline'; break;
      case 'Usuarios': iconName = focused ? 'people' : 'people-outline'; break;
      case 'AdminVacantes': iconName = focused ? 'briefcase' : 'briefcase-outline'; break;
      case 'Mensajes': iconName = focused ? 'chatbubbles' : 'chatbubbles-outline'; break;
      case 'Perfil': iconName = focused ? 'person' : 'person-outline'; break;
      default: iconName = 'ellipse';
    }
    return <Ionicons name={iconName} size={size} color={color} />;
  },
  tabBarActiveTintColor: COLORS.primary,
  tabBarInactiveTintColor: COLORS.textLight,
  tabBarStyle: {
    height: 60,
    paddingBottom: 8,
    paddingTop: 4,
    backgroundColor: COLORS.white,
    borderTopColor: COLORS.borderLight,
  },
  tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
  headerShown: false,
});

function PerfilStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
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
      <Tab.Screen name="Postulaciones" component={MisPostulacionesScreen}
        options={{ tabBarLabel: 'Mis Postulaciones', headerShown: true, ...screenOptions, title: 'Mis Postulaciones' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function TrabajadorVacantesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="VacantesHome" component={TrabajadorVacantesScreen}
        options={{ title: 'Vacantes Disponibles' }} />
      <Stack.Screen name="DetalleVacante" component={DetalleVacanteScreen}
        options={{ title: 'Detalle de Vacante' }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
        options={{ title: 'Notificaciones' }} />
    </Stack.Navigator>
  );
}

function ChatsStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ChatsHome" component={ChatsScreen}
        options={{ title: 'Mensajes' }} />
      <Stack.Screen name="ChatDetalle" component={ChatDetalleScreen}
        options={{ title: 'Chat' }} />
    </Stack.Navigator>
  );
}

// ── Empleador Tabs ──
function EmpleadorTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="MisVacantes" component={EmpleadorVacantesStack}
        options={{ tabBarLabel: 'Mis Vacantes' }} />
      <Tab.Screen name="Mensajes" component={ChatsStack}
        options={{ tabBarLabel: 'Mensajes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function EmpleadorVacantesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
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
      <Stack.Screen name="PerfilPublicoTrabajador" component={PerfilPublicoTrabajadorScreen}
        options={{ title: 'Perfil del Trabajador' }} />
      <Stack.Screen name="Notificaciones" component={NotificacionesScreen}
        options={{ title: 'Notificaciones' }} />
    </Stack.Navigator>
  );
}

// ── Admin Tabs ──
function AdminTabs() {
  return (
    <Tab.Navigator screenOptions={tabScreenOptions}>
      <Tab.Screen name="Dashboard" component={AdminDashboardStack}
        options={{ tabBarLabel: 'Dashboard' }} />
      <Tab.Screen name="Usuarios" component={AdminUsuariosScreen}
        options={{ tabBarLabel: 'Usuarios', headerShown: true, ...screenOptions, title: 'Usuarios' }} />
      <Tab.Screen name="AdminVacantes" component={AdminVacantesStack}
        options={{ tabBarLabel: 'Vacantes' }} />
      <Tab.Screen name="Perfil" component={PerfilStack}
        options={{ tabBarLabel: 'Perfil' }} />
    </Tab.Navigator>
  );
}

function AdminVacantesStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
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
        name="PerfilPublicoTrabajador"
        component={PerfilPublicoTrabajadorScreen}
        options={{ title: 'Perfil del Trabajador' }}
      />
    </Stack.Navigator>
  );
}

function AdminDashboardStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen}
        options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="AdminUsuarios" component={AdminUsuariosScreen}
        options={{ title: 'Usuarios' }} />
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
    <Stack.Navigator screenOptions={{ ...screenOptions, headerShown: false }}>
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
    </Stack.Navigator>
  );
}

// ── Root Navigator ──
function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
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
    <AuthProvider>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={COLORS.primaryDark} />
        <RootNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}
