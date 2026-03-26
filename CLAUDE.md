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

- **Entry & Navigation**: [App.js](TerraEmpleoApp/App.js) — wraps app in `AuthProvider`, then `RootNavigator` reads `user.rol` from `AuthContext` to render one of three tab navigators: `TrabajadorTabs`, `EmpleadorTabs`, or `AdminTabs`. Unauthenticated users see `AuthStack`.
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
- **Backend env** ([backend/.env](TerraEmpleoApp/backend/.env)): DB apunta a RDS en producción. **NUNCA commitear este archivo.**
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
| **IAM deploy** | `terraempleo-s3-user` — permisos: S3 put/delete en ambos buckets + CloudFront invalidation |

### CI/CD — GitHub Actions

Repositorio: `github.com/terraempleo-lgtm/terraempleoapp`

Push a `main` dispara dos jobs paralelos en [.github/workflows/deploy.yml](.github/workflows/deploy.yml):

1. **Deploy Backend**: SSH → Lightsail → `git reset --hard origin/main` (preservando `.env`) → `npm install --production` → `pm2 restart terraempleo-api` → health check
2. **Deploy Frontend**: `npx expo export --platform web` → `aws s3 sync dist/ s3://terraempleo-web-frontend/` → invalidación CloudFront

**Secrets requeridos en GitHub**: `LIGHTSAIL_HOST`, `LIGHTSAIL_USER`, `LIGHTSAIL_SSH_KEY`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `CLOUDFRONT_DISTRIBUTION_ID`

**Importante**: Los `.env` del servidor tienen `git update-index --skip-worktree` y el workflow los preserva con backup antes del reset.

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

## Known Issues / Pending Work

- **SMS**: Backend mock (`SMS_MOCK: true`) is active; falta proveedor real de mensajería para producción.
- **Camera**: `expo-camera` is installed but photo capture shows an `Alert` placeholder.
- **Profile editing UI**: Not yet implemented.
- **Label formatting**: Raw DB values (e.g. `"menos_1"`) render without human-readable mapping in profile view.
- **SMS verification flag**: `verificado_sms = 0` for test/registered users.
- **Static IP Lightsail**: Pendiente verificar si `107.20.220.171` es estática o dinámica (requiere credenciales admin AWS).
- **Load balancer + autoscaling**: Pendiente para cuando el tráfico lo justifique.
- **Credenciales AWS**: Las keys del IAM user `terraempleo-s3-user` están en `backend/.env` — pendiente migrar a AWS Secrets Manager.
