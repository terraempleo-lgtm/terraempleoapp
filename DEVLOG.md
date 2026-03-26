# DEVLOG — TerraEmpleo

Registro de sesiones de trabajo del equipo.
**Regla:** Actualizar este archivo al terminar cada sesión y hacer `git push` antes de cerrar.

---

## Cómo usar este archivo

- Agrega una entrada de sesión debajo de los bloques de stack y checklist (más reciente primero)
- Actualiza el **checklist de qué sigue** cada vez que completes o agregues tareas
- Marca los pendientes con `- [ ]` y los completados con `- [x]`
- Siempre termina con `git add DEVLOG.md && git commit -m "devlog: sesion YYYY-MM-DD [Nombre]" && git push`

---

## Stack actual

| Capa | Tecnología | URL / Detalle |
| ---- | ---------- | ------------- |
| Frontend web | React Native + Expo SDK 54 → S3 + CloudFront | `https://app.terrampleo.com` |
| App móvil | React Native + Expo (Android / iOS) | build local con `npx expo start` |
| API | Express.js + Node.js + PM2 en Lightsail | `https://api.terrampleo.com/api` |
| Base de datos | RDS MariaDB (SSL obligatorio) | `terraempleo-mariadb.cyjse0ie8mw6.us-east-1.rds.amazonaws.com` |
| Secretos | AWS SSM Parameter Store | `/terraempleo/production/{DB_PASSWORD,JWT_SECRET,EMAIL_PASS}` |
| Imágenes usuarios | S3 | `terraempleo-prod-images` |
| CI/CD | GitHub Actions (deploy selectivo por carpeta) | push a `main` → deploy automático |
| Monitoreo | CloudWatch CPU alarms + Budget $30/mes | alertas → `terraempleo@gmail.com` |
| Backups | Snapshots Lightsail diarios + RDS diarios | retención 7 días |

---

## Stack técnico

| Área | Tecnología |
| ---- | ---------- |
| Frontend | React Native 0.76, Expo SDK 54, React Navigation 7, Axios |
| Navegación | Stack + Tab navigators, `React.lazy` + `Suspense` por rol (code splitting web) |
| Estado auth | `AuthContext` (in-memory), token inyectado globalmente en Axios |
| Tema | `ThemeContext` con modo oscuro, `COLORS` / `FONTS` / `SPACING` |
| Backend | Express.js, JWT, bcryptjs, multer, nodemailer, express-rate-limit |
| Base de datos | MariaDB (pool), schema auto-creado en startup, 12 tablas |
| Auth externa | Amazon Cognito (SMS OTP — mock activo), JWT propio para sesión |
| AWS SDK | `@aws-sdk/client-s3`, `@aws-sdk/client-ssm`, `@aws-sdk/client-cognito-identity-provider` |
| Infraestructura | Lightsail (Ubuntu, PM2), RDS, S3, CloudFront, ACM, SSM, IAM |
| CI/CD | GitHub Actions, `dorny/paths-filter`, `appleboy/ssh-action` |

---

## Qué sigue — checklist actualizado 2026-03-26

### 🔴 Urgente

- [x] **Rotar AWS keys**: keys rotadas para `terraempleo-s3-user`. Nuevas keys en `.env` del servidor. Viejas eliminadas.
- [ ] **IAM Role en la instancia**: Lightsail no soporta EC2 instance profiles vía API estándar. Pendiente evaluar migración a EC2 o seguir con keys en `.env` (gitignoreado).

### 🟡 Features pendientes

- [ ] **SMS real**: reemplazar mock (`SMS_MOCK: true`) con proveedor real (Twilio o AWS SNS).
- [ ] **expo-camera**: implementar captura real de fotos de identidad (actualmente `Alert` placeholder).
- [ ] **UI edición de perfil**: pantalla de edición no implementada.
- [ ] **Label formatting**: valores crudos de BD (ej. `"menos_1"`) sin mapeo legible en vista de perfil.

### 🟢 Mejoras futuras

- [ ] Load balancer + autoscaling (cuando el tráfico lo justifique).
- [ ] Migrar de SSM a AWS Secrets Manager (rotación automática).
- [ ] Suite de tests (ningún test configurado actualmente).
- [ ] Linter / ESLint en frontend y backend.

---

## Sesiones

---

## 2026-03-26 — Fixes producción: uploads, admin web, keys rotadas

**Participantes:** Vero

### ✅ Hecho (2026-03-26 — sesión 2)

- **Nginx client_max_body_size**: aumentado a `50m` → solucionó error 413 al subir fotos de perfil.
- **CORS en error handler**: `server.js` ahora incluye headers `Access-Control-Allow-Origin` en respuestas de error. Solucionó errores CORS desde `localhost:8081`.
- **Admin delete en web**: `Alert.alert` con múltiples botones no dispara `onPress` en Expo web. Corregido usando `window.confirm()` en `AdminUsuariosScreen.js` y `AdminVacantesScreen.js`.
- **AWS keys rotadas**: nuevas keys generadas para `terraempleo-s3-user` → actualizadas en `.env` del servidor → viejas eliminadas en IAM.
- **IAM Role (descartado)**: Lightsail no expone el EC2 instance ID vía `ec2 describe-instances` → no se puede adjuntar instance profile. Role e instance profile creados en IAM fueron eliminados. Keys en `.env` siguen siendo la solución para Lightsail.

---

## 2026-03-26 — Seguridad backend: SSM + Code splitting + CORS

**Participantes:** Veronica

### ✅ Hecho (2026-03-26)

- **CORS restrictivo** en `server.js`: whitelist con `app.terrampleo.com`, `api.terrampleo.com` y orígenes locales. Apps nativas (sin header `Origin`) siempre permitidas.
- **Code splitting por rol** en `App.js`: pantallas de trabajador, empleador y admin usan `React.lazy` + `<Suspense>`. En web genera chunks separados por rol (~1MB por usuario vs 3.45MB antes). En native Metro resuelve síncronamente.
- **SSM Parameter Store**: `DB_PASSWORD`, `JWT_SECRET` y `EMAIL_PASS` migrados a `/terraempleo/production/*` (tipo `SecureString`). El backend los carga al arrancar con fallback a `.env`. Ya no están en disco.
- `@aws-sdk/client-ssm` instalado. IAM policy `terraempleo-ssm-read` en `terraempleo-s3-user`.
- **DEVLOG.md** creado. **CLAUDE.md** actualizado.

---

## 2026-03-25 — Infraestructura AWS: CI/CD + CloudFront + Monitoreo

**Participantes:** Veronica

### ✅ Hecho (2026-03-25)

- **Migración frontend a S3 + CloudFront**: bucket `terraempleo-web-frontend`, distribución `E2VW0BWNEBE3B4`, dominio `app.terrampleo.com`, cert ACM + DNS GoDaddy. SPA routing (403/404 → `index.html`).
- **GitHub Actions CI/CD**: deploy selectivo por carpeta. Backend: SSH → git reset + restaurar `.env` → npm install → pm2 restart → health check. Frontend: expo export → S3 sync → invalidación CloudFront.
- **Compresión login.jpg**: 21MB → 392KB (98%). Bundle web: 29MB → 7.7MB.
- **IP estática Lightsail**: confirmada `107.20.220.171`.
- **CloudWatch alarms**: CPU < 1% y > 80% → email.
- **Budget**: $30 USD/mes, alertas 80% y 100%.
- **Snapshots Lightsail**: diarios 3:00 AM GMT-5, retención 7 días.
- **RDS backups**: diarios, retención 7 días, Deletion Protection activo.
- **Postman collection**: 44 endpoints, 7 carpetas, auto-guarda token.
- Eliminado `express.static(publicDir)` que exponía 2,586 líneas de HTML en raíz de API.
- SSH deploy key configurada en GitHub. `git update-index --skip-worktree` en `.env` del servidor.

---

## 2026-03-24 — Modo oscuro + fondos decorativos

**Participantes:** Fredy

### ✅ Hecho (2026-03-24)

- Integración de modo oscuro con `ThemeContext`.
- Fondos decorativos en pantallas principales.

---

## 2026-03-23 — Rate limiting en autenticación

**Participantes:** Sebas

### ✅ Hecho (2026-03-23)

- Rate limiting en rutas de auth para proteger contra fuerza bruta.
- Middleware `rateLimit.js` en backend.

---

## 2026-03-21 — Mapa de vacantes

**Participantes:** Veronica

### ✅ Hecho (2026-03-21)

- Pantalla `VacantesMapaScreen` con mapa interactivo.
- Correcciones en coordenadas y nombre de ubicación en cards.

---

## 2026-03-19 — HTTPS y dominio

**Participantes:** Veronica

### ✅ Hecho (2026-03-19)

- Configuración de dominio con HTTPS.
- `.env` excluido del repositorio.
