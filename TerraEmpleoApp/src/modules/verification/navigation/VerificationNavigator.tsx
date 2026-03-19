import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useAuth } from '../../../context/AuthContext';
import { COLORS } from '../../../theme';
import { VerificationFlowProvider } from '../hooks';
import {
  IdFrontCaptureScreen,
  SelfieCaptureScreen,
  SelfieWithIdCaptureScreen,
  VerificationReviewScreen,
} from '../screens';
import type { VerificationStackParamList } from '../types';

const Stack = createStackNavigator<VerificationStackParamList>();

const screenOptions = {
  headerStyle: { backgroundColor: COLORS.primary },
  headerTintColor: COLORS.white,
  headerTitleStyle: { color: COLORS.white, fontWeight: '700' as const },
  headerBackTitleVisible: false,
};

export default function VerificationNavigator() {
  const { user } = useAuth() as {
    user?: { id?: number | string; usuario_id?: number | string } | null;
  };
  const usuarioId = user?.id ?? user?.usuario_id ?? 'anonimo';

  return (
    <VerificationFlowProvider usuarioId={usuarioId}>
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen
          name="IdFrontCapture"
          component={IdFrontCaptureScreen}
          options={{ title: 'Validación interna de identidad' }}
        />
        <Stack.Screen
          name="SelfieCapture"
          component={SelfieCaptureScreen}
          options={{ title: 'Selfie' }}
        />
        <Stack.Screen
          name="SelfieWithIdCapture"
          component={SelfieWithIdCaptureScreen}
          options={{ title: 'Selfie con cédula' }}
        />
        <Stack.Screen
          name="VerificationReview"
          component={VerificationReviewScreen}
          options={{ title: 'Revisión y envío' }}
        />
      </Stack.Navigator>
    </VerificationFlowProvider>
  );
}
