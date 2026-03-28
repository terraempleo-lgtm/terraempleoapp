# TerraEmpleo Dev Log

## 2026-03-27 — Biometría local + Limpieza Cognito WebAuthn

### Resumen
Eliminación completa de Cognito WebAuthn / react-native-passkey y reemplazo con `expo-local-authentication` (Face ID, Touch ID, PIN del dispositivo). No requiere backend ni EAS build especial — funciona en Expo Go.

### Cambios realizados

**Nuevos archivos:**
- `src/services/localAuthService.js` — `isLocalAuthAvailable()` + `authenticateLocally()`
- `src/components/ui/AppAlert.js` — Modal nativo estilizado (reemplaza `Alert.alert`)
- `src/utils/alertService.js` — Servicio global imperativo para AppAlert

**Modificados:**
- `src/context/AuthContext.js` — Eliminado `cognitoAccessToken`; agregado `tryBiometricLogin()` que restaura sesión guardada en SecureStore tras verificación biométrica
- `src/screens/auth/LoginScreen.js` — Reemplazado flujo passkey por `handleBiometricLogin` con `expo-local-authentication`
- `src/screens/auth/RecuperarPasswordScreen.js` — Reemplazada tab "passkey" por tab "biometrico" usando autenticación local
- `src/screens/shared/PerfilScreen.js` — Eliminadas filas de activar/desactivar passkey (Cognito); limpiados imports de passkeyService y passkeyAPI
- `App.js` — Eliminados `PasskeyEnrollScreen` import y rutas `PasskeyEnroll` / `PasskeyEnrollPerfil` del navigator

**Archivos obsoletos (sin referencias activas):**
- `src/screens/auth/PasskeyEnrollScreen.js`
- `src/services/passkeyService.js`

**Dependencias:**
- Agregado: `expo-local-authentication ~17.0.8`
- Removido del bundle frontend: `bcryptjs`

### Flujo biométrico resultante
1. Usuario abre LoginScreen o tab "biométrico" en RecuperarPassword
2. Se llama `authenticateLocally()` → diálogo nativo Face ID / Touch ID / PIN
3. Si éxito → `tryBiometricLogin()` en AuthContext: verifica token guardado en SecureStore contra `/api/auth/perfil`
4. Si token válido → sesión restaurada. Si expirado → mensaje de error.
