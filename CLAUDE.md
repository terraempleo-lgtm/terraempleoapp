# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TerraEmpleo** is a Colombian rural employment mobile app (React Native + Expo) connecting agricultural workers (*trabajadores*) with farm employers (*empleadores*). Three user roles: `trabajador`, `empleador`, `admin`.

## Production URLs

| Service | URL |
|---------|-----|
| Frontend web | `https://app.terrampleo.com` (CloudFront → S3) |
| API | `https://api.terrampleo.com/api` (Lightsail → Node.js) |
| Health check | `https://api.terrampleo.com/api/health` |

## Development Commands

### Startup Sequence (3 terminals required)

```bash
# Terminal 1: Database (MariaDB via Docker/Colima)
colima start && docker start terraempleo-db

# Terminal 2: Backend
cd TerraEmpleoApp/backend && npm run dev   # nodemon hot-reload
# or: npm start                            # node server.js (no hot-reload)

# Terminal 3: Frontend
cd TerraEmpleoApp && npx expo start
# then: npm run android  |  npm run ios  |  npm run web
```

### Build web (producción)

```bash
cd TerraEmpleoApp && npx expo export --platform web
# Output en dist/ — se despliega automáticamente vía GitHub Actions al hacer push a main
```

No test suite or linter is configured in either frontend or backend.

## Architecture

### Frontend (`TerraEmpleoApp/`)

- **Entry & Navigation**: [App.js](TerraEmpleoApp/App.js) — wraps app in `AuthProvider`, then `RootNavigator` reads `user.rol` from `AuthContext` to render one of three tab navigators: `TrabajadorTabs`, `EmpleadorTabs`, or `AdminTabs`. Unauthenticated users see `AuthStack`. Role-specific screens are loaded with `React.lazy` + `<Suspense>` — on web this produces separate JS chunks per role (~1MB vs 3.45MB monolítico); on native Metro bundles everything synchronously so behavior is identical.
- **Auth state**: [src/context/AuthContext.js](TerraEmpleoApp/src/context/AuthContext.js) — in-memory only, no persistence. `signIn(userData, token)` / `signOut()` / `updateUser(data)`. Token is injected globally into Axios via `setAuthToken()`.
- **API layer**: [src/services/api.js](TerraEmpleoApp/src/services/api.js) — Axios instance with `baseURL` from `src/config/index.js`. Organized into `authAPI`, `vacantesAPI`, `calificacionesAPI`, `adminAPI`.
- **Theme**: [src/theme/index.js](TerraEmpleoApp/src/theme/index.js) exports `COLORS`, `FONTS`, `SPACING`, `RADIUS`, `SHADOWS`. All screens use these constants. Primary green: `#2E7D32`, accent orange: `#FF8F00`.
- **Reusable UI**: [src/components/ui/](TerraEmpleoApp/src/components/ui/) — `Button`, `Input`, `ChipSelector`, `PickerModal`, `ProgressBar`, `StarRating`.
- **Static data**: Colombian departments/municipalities in [src/data/colombia.js](TerraEmpleoApp/src/data/colombia.js); agricultural options (cultivos, labores, tipos de pago, experience levels) in [src/data/options.js](TerraEmpleoApp/src/data/options.js).

### Backend (`TerraEmpleoApp/backend/`)

- **Framework**: Express.js on port 3000. MariaDB pool in [config/database.js](TerraEmpleoApp/backend/config/database.js) with `bigNumberStrings` and `supportBigNumbers` enabled.
- **Routes** (all prefixed `/api/`): `/auth`, `/vacantes`, `/calificaciones`, `/admin`, `/trabajadores`, `/notificaciones`, `/chats`, `/auth/cognito`.
- **Auth middleware**: [middleware/auth.js](TerraEmpleoApp/backend/middleware/auth.js) — `authMiddleware` (JWT verify), `adminMiddleware`, `empleadorMiddleware`, `trabajadorMiddleware`.
- **Schema**: Auto-created on startup via `initializeDatabase()` in [models/schema.js](TerraEmpleoApp/backend/models/schema.js). 12 tables: `usuarios`, `perfil_trabajador`, `trabajador_habilidades`, `trabajador_cultivos`, `perfil_empleador`, `empleador_cultivos`, `empleador_labores`, `vacantes`, `vacante_cultivos`, `vacante_labores`, `postulaciones`, `calificaciones`.
- **File uploads**: `multer` writes to `backend/uploads/`. Served statically at `/uploads`.
- **Default admin**: Auto-created on first run — `celular: 0000000000`, `password: admin123`.

### Configuration

- **API URL producción** ([TerraEmpleoApp/.env](TerraEmpleoApp/.env)): `EXPO_PUBLIC_API_URL=https://api.terrampleo.com/api`
- **API URL local** ([src/config/index.js](TerraEmpleoApp/src/config/index.js)): `http://10.0.2.2:3000/api` (Android emulator). Change to LAN IP (e.g. `http://192.168.x.x:3000/api`) for physical devices.
- **SMS mock** ([src/config/index.js](TerraEmpleoApp/src/config/index.js)): `SMS_MOCK: true` — backend returns `codigo_debug` in response instead of sending a real SMS.
- **Backend env** ([backend/.env](TerraEmpleoApp/backend/.env)): DB apunta a RDS en producción. **NUNCA commitear este archivo.** Los secretos `DB_PASSWORD`, `JWT_SECRET` y `EMAIL_PASS` ya NO están en este archivo — se cargan desde SSM al arrancar. Ver [backend/config/secrets.js](TerraEmpleoApp/backend/config/secrets.js).
- **SMS verification screen** ([src/screens/auth/SmsVerificationScreen.js](TerraEmpleoApp/src/screens/auth/SmsVerificationScreen.js)): Uses backend endpoints `/api/auth/sms/enviar` and `/api/auth/sms/verificar` con OTP de 6 dígitos.

### Screen Organization

```
src/screens/
  auth/        — Welcome, Login, RoleSelect, RegisterTrabajador (9-step), RegisterEmpleador (8-step), SmsVerification*
  trabajador/  — TrabajadorVacantes, DetalleVacante, MisPostulaciones
  empleador/   — EmpleadorVacantes, CrearVacante, VerPostulaciones
  admin/       — AdminDashboard, AdminUsuarios, AdminVacantes
  shared/      — Perfil (universal, used by all roles)
```

### Registration Flow

Both registration wizards use `ProgressBar` for step tracking. Step 5 = SMS verification (mocked against backend). Step 6 = identity photos (mocked with `Alert` — expo-camera not yet implemented). Final step calls `authAPI.register()` then `signIn()` to log the user in immediately.

## AWS Infrastructure (Producción)

### Stack

```
Usuario web    → app.terrampleo.com → CloudFront (E2VW0BWNEBE3B4) → S3 (terraempleo-web-frontend)
Usuario móvil  → api.terrampleo.com → Lightsail (107.20.220.171)  → RDS MariaDB
```

### Servicios

| Servicio | Detalle |
|----------|---------|
| **Lightsail** | `ubuntu@107.20.220.171`, proceso PM2: `terraempleo-api`, ruta: `/home/ubuntu/terraempleoapp` |
| **RDS** | `terraempleo-mariadb.cyjse0ie8mw6.us-east-1.rds.amazonaws.com`, MariaDB, SSL obligatorio, `global-bundle.pem` en `/home/ubuntu/` |
| **S3 frontend** | `terraempleo-web-frontend` (privado, acceso solo por OAC de CloudFront) |
| **S3 imágenes** | `terraempleo-prod-images` (uploads de usuarios) |
| **CloudFront** | ID `E2VW0BWNEBE3B4`, dominio `d25u3yf9l5z6o2.cloudfront.net`, cert ACM para `app.terrampleo.com` |
| **ACM** | Certificado `app.terrampleo.com` validado vía DNS (GoDaddy) |
| **IAM deploy** | `terraempleo-s3-user` — permisos: S3 put/delete en ambos buckets + CloudFront invalidation + SSM read (`/terraempleo/production/*`) |
| **SSM Parameter Store** | `/terraempleo/production/DB_PASSWORD`, `/terraempleo/production/JWT_SECRET`, `/terraempleo/production/EMAIL_PASS` (tipo `SecureString`) |

### CI/CD — GitHub Actions

Repositorio: `github.com/terraempleo-lgtm/terraempleoapp`

Push a `main` dispara dos jobs paralelos en [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. **Deploy Backend**: SSH → Lightsail → `git reset --hard origin/main` (preservando `.env`) → `npm install --production` → `pm2 restart terraempleo-api` → health check. Se activa solo si cambia `TerraEmpleoApp/backend/**`.
2. **Deploy Frontend**: `npx expo export --platform web` → `aws s3 sync dist/ s3://terraempleo-web-frontend/` → invalidación CloudFront. Se activa solo si cambia `TerraEmpleoApp/**` (excepto backend).

**Secrets requeridos en GitHub**: `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`, `LIGHTSAIL_SSH_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID`

**Importante**: Los `.env` del servidor tienen `git update-index --skip-worktree` y el workflow los preserva con backup antes del reset.

### Despliegue de la app móvil (Play Store / App Store)

Un `git push` a `main` NO actualiza la app instalada en celulares. La app móvil tiene **dos canales** de despliegue distintos:

#### A. OTA (over-the-air) — para cambios solo de JS/React

Cuando solo cambia código JS (componentes, lógica, estilos, llamadas API), no hace falta rebuild ni Play Store. Se manda directo a los celulares con la app abierta:

```bash
EXPO_TOKEN=<token> npx eas update --branch production --message "descripción corta"
```

Los usuarios reciben el OTA al abrir la app la siguiente vez. Esto funciona porque `app.json` tiene `runtimeVersion.policy: "appVersion"` — los OTA se publican contra la `version` actual de app.json.

**Limites de OTA — NO funciona si cambiaste:**
- Dependencias nativas (`expo-*`, `@react-native-community/*`, etc.)
- Permisos de Android/iOS
- Plugins en `app.json`
- Iconos / splash screen
- `version` o `versionCode` en `app.json`

#### B. Build nuevo + subir a stores — para cualquier cambio nativo

Cuando cambias algo de la lista anterior, hay que generar un binario nuevo:

```bash
# Antes del build: bumpear version + versionCode en app.json
# Ejemplo: 1.0.1 → 1.1.0, versionCode 5 → 6

# Android (AAB para Play Store)
EXPO_TOKEN=<token> npx eas build --platform android --profile production

# iOS
EXPO_TOKEN=<token> npx eas build --platform ios --profile production

# Subir a stores (manual desde EAS dashboard o usando submit)
EXPO_TOKEN=<token> npx eas submit --platform android
```

El proyecto EAS oficial pertenece a `rendonv` (la compañera Vero) — `projectId: f0c2d1e1-9208-44e1-af6f-9a2c29a3e5ba`. Solo ella o quien tenga acceso a esa cuenta puede ejecutar `eas build` con `owner: rendonv` en app.json.

#### Versionado

- `version` (semver): incrementar cuando se hace nuevo build. Mayor → cambios grandes (1.0.x → 1.1.0). Patch → fixes (1.0.0 → 1.0.1).
- `android.versionCode`: entero monotónico. Play Store rechaza un build con versionCode menor o igual al anterior. Incrementar +1 con cada build.
- `runtimeVersion.policy: "appVersion"` significa que los OTAs salen apuntando a la `version` actual. Al bumpear version, automáticamente se "cierra" el canal OTA de la versión anterior — los usuarios con el build viejo dejan de recibir actualizaciones JS hasta que instalen el nuevo build desde Play Store.

#### Flujo recomendado de despliegue

1. Cambios solo de JS → `git push` + `eas update --branch production` → todos los usuarios al instante.
2. Cambios nativos → bumpear `version` y `versionCode` en `app.json` → `git push` → `eas build --platform android --profile production` → bajar AAB → subir a Play Store → esperar review (~horas) → publicar.

#### Auto-OTA en pushes a main

Hay un workflow opcional en [.github/workflows/eas-update.yml](.github/workflows/eas-update.yml) que dispara `eas update` automáticamente cuando se pushea a `main` y SOLO cambiaron archivos JS (excluye `app.json`, `package.json`, `eas.json`, `.github/**`). Si el push toca cualquier archivo de esa lista, el workflow se salta porque probablemente se necesita un build nuevo.

**Requisito**: configurar el secret `EXPO_TOKEN` en GitHub Settings → Secrets and variables → Actions.

### Monitoreo y Backups

| Item | Configuración |
|------|---------------|
| **CloudWatch** | Alarm CPU < 1% (caída) y > 80% (sobrecarga) → `terraempleo@gmail.com` |
| **Budget** | $30 USD/mes, alertas al 80% y 100% |
| **Snapshots Lightsail** | Diarios 3:00 AM GMT-5, retención 7 días |
| **RDS backups** | Automáticos diarios, retención 7 días, ventana 4:00-5:00 UTC |
| **RDS Deletion Protection** | Activo |

### Conectar a RDS desde Lightsail

```bash
mysql -h terraempleo-mariadb.cyjse0ie8mw6.us-east-1.rds.amazonaws.com \
      -u terraempleoadmin -p'<password>' terraempleo \
      --ssl-ca=/home/ubuntu/global-bundle.pem \
      -e "SELECT COUNT(*) FROM usuarios;"
```

### Postman

Colección completa (44 endpoints) en [TerraEmpleo_API.postman_collection.json](TerraEmpleo_API.postman_collection.json).
Variables: `{{base_url}}` = `https://api.terrampleo.com/api`. El request **Login** auto-guarda el token.

### Secrets en producción

El backend carga secretos desde SSM al arrancar ([backend/config/secrets.js](TerraEmpleoApp/backend/config/secrets.js)). En desarrollo usa `.env` directamente. Para ver o actualizar un secreto:

```bash
# Ver valor
aws ssm get-parameter --name "/terraempleo/production/DB_PASSWORD" --with-decryption --query "Parameter.Value" --output text

# Actualizar valor
aws ssm put-parameter --name "/terraempleo/production/DB_PASSWORD" --value 'nuevo_valor' --type SecureString --overwrite
```

## Chat Multimedia

El chat soporta tres tipos de mensaje: `texto`, `imagen`, `audio`.

- **Backend**: tabla `mensajes` tiene columnas `tipo`, `archivo_url`, `duracion_audio`. Endpoint `POST /api/chats/:id/mensajes/media` recibe archivo via multer-s3 (límite 25 MB).
- **S3**: archivos en `terraempleo-prod-images` bajo `chat/imagenes/` y `chat/audios/`. URLs firmadas (15 min) generadas en `getMensajes`.
- **Frontend** ([ChatDetalleScreen.js](TerraEmpleoApp/src/screens/shared/ChatDetalleScreen.js)): botón imagen (galería/cámara), botón mic (press-hold graba con `expo-av`), modal de preview en pantalla completa.
- **Teclado**: `KeyboardAvoidingView` con `behavior="padding"` + `useHeaderHeight()` de `@react-navigation/elements` — funciona igual que WhatsApp en Android e iOS.
- **Nota**: grabación de audio requiere build nativo (EAS). En Expo Go solo funciona reproducción + imágenes.

## Mapa de Trabajadores (compañera Vero)

- **Pantalla**: [TrabajadoresMapaScreen.js](TerraEmpleoApp/src/screens/empleador/TrabajadoresMapaScreen.js) — mapa interactivo de trabajadores disponibles.
- **Web fallback**: [TrabajadoresMapaScreen.web.js](TerraEmpleoApp/src/screens/empleador/TrabajadoresMapaScreen.web.js)
- Integrado en `main` vía merge 2026-04-20 sin conflictos.

## Known Issues / Pending Work

- **AWS keys**: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` aún están en `backend/.env`. Pendiente rotar y migrar a IAM Role en la instancia.
- **SMS**: Paso de verificación SMS deshabilitado intencionalmente en registro (`setStep(8)` salta paso 7). Todos los usuarios quedan con `verificado_sms = 0`. Activar cuando se integre proveedor real (Twilio / AWS SNS).
- **Camera**: `expo-camera` instalado pero la captura de identidad está implementada — toma fotos en native, usa galería en web. Las fotos de registro se guardan localmente pero no se persisten en servidor al crear cuenta.
- **Profile editing UI**: Implementada y funcional (`EditarPerfilScreen.js`).
- **Label formatting**: Raw DB values (e.g. `"menos_1"`) tienen mapeo en `PerfilScreen` y `EditarPerfilScreen`. Puede faltar en algunas vistas secundarias.
- **SMS verification flag**: `verificado_sms = 0` para todos los usuarios (SMS deshabilitado intencionalmente).
- **Static IP Lightsail**: Confirmada `107.20.220.171`.
- **Load balancer + autoscaling**: Pendiente para cuando el tráfico lo justifique.
- **Chat / Notificaciones**: Chat con polling cada 5s. Sin WebSocket en tiempo real.
- **Audio en chat**: Grabación requiere EAS build nativo — no funciona en Expo Go.
- **Foto de perfil pública**: El perfil público de trabajador solo muestra iniciales (no hay foto de perfil en la respuesta del endpoint).
- **Matching score en recomendadas**: No se muestra en `VacantesRecomendadasScreen` (sí aparece en `BuscarTrabajadoresScreen`).
- **Crear vacante como admin**: El endpoint `POST /api/admin/vacantes` existe pero no hay UI para accederlo desde el panel admin.
