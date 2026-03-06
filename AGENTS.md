# Project Guidelines — TerraEmpleo

Colombian rural employment React Native + Expo app. See [CLAUDE.md](CLAUDE.md) for full architecture overview, startup commands, and known issues.

## Build and Run

```bash
# Database (Terminal 1)
colima start && docker start terraempleo-db

# Backend (Terminal 2) — CommonJS, Express, port 3000
cd TerraEmpleoApp/backend && npm run dev

# Frontend (Terminal 3) — Expo SDK 54
cd TerraEmpleoApp && npx expo start
```

No test suite or linter is configured. Validate changes by running the backend (`npm run dev`) and checking for startup errors.

## Code Style

- **All Spanish**: variable names, DB columns, error messages, comments, route paths.
- **Frontend**: ES modules (`import/export`), pure JavaScript (.js), functional components only (`export default function ComponentName`).
- **Backend**: CommonJS (`require/module.exports`), async functions in controllers, raw SQL with `?` parameterized queries — no ORM.
- **Naming**: PascalCase files for screens/components (`LoginScreen.js`, `Button.js`); camelCase for state/vars; UPPER_SNAKE_CASE for exported constants (`COLORS`, `CULTIVOS`).
- **Import order**: React/RN core → theme → UI components → data → API services → context hooks → icons → project components. No blank lines between groups.

## Architecture

### Frontend (`TerraEmpleoApp/src/`)
- **Theme**: import `{ COLORS, SPACING, RADIUS, SHADOWS }` from `'../../theme'` — never hardcode colors. Primary: `#2E7D32`, accent: `#FF8F00`.
- **UI components**: import from barrel `'../../components/ui'` — `Button`, `Input`, `ChipSelector`, `PickerModal`, `ProgressBar`, `StarRating`.
- **Screen layout**: always `SafeAreaView > KeyboardAvoidingView > ScrollView > View`. Set `keyboardShouldPersistTaps="handled"`.
- **Styles**: `StyleSheet.create()` at bottom of file. Spread SHADOWS into style objects (`...SHADOWS.medium`).
- **State**: `useState` only (no Redux/Zustand). Auth via `useAuth()` from `AuthContext`.
- **API calls**: import from `src/services/api.js` (`authAPI`, `vacantesAPI`, `calificacionesAPI`, `adminAPI`). Each method returns an Axios promise. Consume with `const { data } = await vacantesAPI.listar()`.
- **Error pattern**: `try/catch` → `err.response?.data?.error || 'Fallback message'` → `Alert.alert('Error', msg)`.
- **Validation**: `errors` state object with field-name keys, validated in `validate()` or `validateStep()` functions.
- **Static data**: agricultural options in `src/data/options.js`, Colombian geography in `src/data/colombia.js`. Values must match DB ENUM strings.

### Backend (`TerraEmpleoApp/backend/`)
- **Pattern**: `routes/*.js` → `controllers/*.js` → `config/database.js` query helper. Controllers never call `next()`.
- **DB**: MariaDB pool via `mariadb` driver. `bigNumberStrings: true` means IDs come as strings — cast with `Number(result.insertId)`. Booleans are `TINYINT(1)` — normalize with `const toBool = (val) => Number(val) === 1`.
- **Auth**: JWT Bearer in `Authorization` header. Middleware in `middleware/auth.js` sets `req.user = { id, rol, celular, nombre_completo }`. Role middlewares also allow `admin` access.
- **Responses**: errors use `{ error: '...' }`, success uses `{ message: '...', ...data }`.
- **Schema**: 12 tables auto-created on startup in `models/schema.js`. ENUM values must match `src/data/options.js`.

## Project Conventions

- **Three user roles**: `trabajador`, `empleador`, `admin`. Navigation splits by `user.rol` in [App.js](TerraEmpleoApp/App.js).
- **Multi-step registration**: 9 steps (trabajador), 8 steps (empleador). Step validation via `switch(step)` in `validateStep()`. Use `ProgressBar` for step tracking.
- **SMS mock active** (`SMS_MOCK: true` in `src/config/index.js`). Backend returns `codigo_debug` — no real SMS sent.
- **No token persistence**: Auth state is in-memory only. `expo-secure-store` is installed but unused.
- **Camera is placeholder**: `CamaraFoto` component exists but photo capture uses `Alert` mock.
- **Navigation**: `@react-navigation/stack` (JS-based, not native-stack). Route names are PascalCase (`"VacantesHome"`, `"DetalleVacante"`).

## Security

- Passwords hashed with `bcryptjs` (backend only — `bcryptjs` in frontend `package.json` is unused/accidental).
- JWT secret from `backend/.env` (`JWT_SECRET`), 7-day expiry.
- `helmet` middleware enabled. CORS open (default `cors()`).
- File uploads: `multer` with 10MB limit, JPG/PNG/WEBP only, stored in `backend/uploads/`.
- Default admin: `celular: 0000000000`, `password: admin123` — seeded on first DB init.


## vexp <!-- vexp v1.2.18 -->

**MANDATORY: use `run_pipeline` — do NOT grep, glob, or Read files.**
vexp returns pre-indexed, graph-ranked context in a single call.

### Workflow
1. `run_pipeline` with your task description — ALWAYS FIRST (replaces all other tools)
2. Make targeted changes based on the context returned
3. `run_pipeline` again only if you need more context

### Available MCP tools
- `run_pipeline` — **PRIMARY TOOL**. Runs capsule + impact + memory in 1 call.
  Auto-detects intent. Includes file content. Example: `run_pipeline({ "task": "fix auth bug" })`
- `get_context_capsule` — lightweight, for simple questions only
- `get_impact_graph` — impact analysis of a specific symbol
- `search_logic_flow` — execution paths between functions
- `get_skeleton` — compact file structure
- `index_status` — indexing status
- `get_session_context` — recall observations from sessions
- `search_memory` — cross-session search
- `save_observation` — persist insights (prefer run_pipeline's observation param)

### Smart Features
Intent auto-detection, hybrid ranking, session memory, auto-expanding budget.

### Multi-Repo
`run_pipeline` auto-queries all indexed repos. Use `repos: ["alias"]` to scope. Run `index_status` to see aliases.
<!-- /vexp -->