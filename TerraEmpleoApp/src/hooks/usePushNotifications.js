import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { notificacionesAPI } from '../services/api';

// Configurar cómo se muestran las notificaciones cuando la app está en primer plano
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export function usePushNotifications(isAuthenticated) {
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  useEffect(() => {
    if (!isAuthenticated || Platform.OS === 'web') return;

    let isMounted = true;

    async function registrar() {
      try {
        // Verificar/pedir permiso
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
          const { status } = await Notifications.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== 'granted') return;

        // Obtener token de Expo Push
        const tokenData = await Notifications.getExpoPushTokenAsync({
          projectId: 'f0c2d1e1-9208-44e1-af6f-9a2c29a3e5ba',
        });
        if (!isMounted) return;

        // Guardar en el backend (silencioso si falla)
        notificacionesAPI.guardarPushToken(tokenData.data).catch(() => {});

        // Canal de notificaciones para Android
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'TerraEmpleo',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#2E7D32',
          });
        }
      } catch (err) {
        console.warn('Push notifications no disponibles:', err.message);
      }
    }

    registrar();

    // Listener: notificación recibida con app abierta
    notificationListener.current = Notifications.addNotificationReceivedListener(() => {});

    // Listener: usuario tocó la notificación
    responseListener.current = Notifications.addNotificationResponseReceivedListener(() => {});

    return () => {
      isMounted = false;
      notificationListener.current?.remove();
      responseListener.current?.remove();
    };
  }, [isAuthenticated]);
}
