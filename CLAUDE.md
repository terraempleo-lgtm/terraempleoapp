# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**TerraEmpleo** is a Colombian rural employment mobile app (React Native + Expo) connecting agricultural workers (*trabajadores*) with farm employers (*empleadores*). Three user roles: `trabajador`, `empleador`, `admin`.

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
- **Routes** (all prefixed `/api/`): `/auth`, `/vacantes`, `/calificaciones`, `/admin`.
- **Auth middleware**: [middleware/auth.js](TerraEmpleoApp/backend/middleware/auth.js) — `authMiddleware` (JWT verify), `adminMiddleware`, `empleadorMiddleware`, `trabajadorMiddleware`.
- **Schema**: Auto-created on startup via `initializeDatabase()` in [models/schema.js](TerraEmpleoApp/backend/models/schema.js). 12 tables: `usuarios`, `perfil_trabajador`, `trabajador_habilidades`, `trabajador_cultivos`, `perfil_empleador`, `empleador_cultivos`, `empleador_labores`, `vacantes`, `vacante_cultivos`, `vacante_labores`, `postulaciones`, `calificaciones`.
- **File uploads**: `multer` writes to `backend/uploads/`. Served statically at `/uploads`.
- **Default admin**: Auto-created on first run — `celular: 0000000000`, `password: admin123`.

### Configuration

- **API URL** ([src/config/index.js](TerraEmpleoApp/src/config/index.js)): `http://10.0.2.2:3000/api` (Android emulator). Change to LAN IP (e.g. `http://192.168.x.x:3000/api`) for physical devices.
- **SMS mock** ([src/config/index.js](TerraEmpleoApp/src/config/index.js)): `SMS_MOCK: true` — backend returns `codigo_debug` in response instead of sending a real SMS.
- **Backend env** ([backend/.env](TerraEmpleoApp/backend/.env)): `DB_HOST=127.0.0.1`, `DB_PORT=3306`, `DB_USER=root`, `DB_PASSWORD=12345`, `DB_NAME=terraempleo`, `PORT=3000`, `JWT_EXPIRES_IN=7d`.
- **SMS verification screen** ([src/screens/auth/SmsVerificationScreen.js](TerraEmpleoApp/src/screens/auth/SmsVerificationScreen.js)): Uses backend endpoints `/api/auth/sms/enviar` and `/api/auth/sms/verificar` with OTP de 6 dígitos.

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

## Known Issues / Pending Work

- **SMS**: Backend mock (`SMS_MOCK: true`) is active; falta proveedor real de mensajería para producción.
- **Camera**: `expo-camera` is installed but photo capture shows an `Alert` placeholder.
- **Profile editing UI**: Not yet implemented.
- **Label formatting**: Raw DB values (e.g. `"menos_1"`) render without human-readable mapping in profile view.
- **SMS verification flag**: `verificado_sms = 0` for test/registered users.
