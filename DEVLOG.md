# DEVLOG — TerraEmpleo

Registro de sesiones de trabajo del equipo.
**Regla:** Actualizar este archivo al terminar cada sesión y hacer `git push` antes de cerrar.

---

## Cómo usar este archivo

- Agrega una entrada al inicio (más reciente primero)
- Usa el formato de sección de abajo
- Marca los pendientes con `- [ ]` y los completados con `- [x]`
- Siempre termina con `git add DEVLOG.md && git commit -m "devlog: sesion YYYY-MM-DD" && git push`

---

## 2026-03-26 — Seguridad backend: SSM + Code splitting + CORS

**Participantes:** Veronica

### ✅ Hecho
- **CORS restrictivo** en `server.js`: solo permite `app.terrampleo.com`, `api.terrampleo.com` y orígenes locales de desarrollo. Apps nativas (sin header `Origin`) siempre permitidas.
- **Code splitting por rol** en `App.js`: todas las pantallas de trabajador, empleador y admin son `React.lazy`. Cada stack navigator envuelto en `<Suspense>`. En web genera chunks separados por rol (~1MB por usuario vs 3.45MB antes). En native Metro resuelve síncronamente sin cambio de comportamiento.
- **SSM Parameter Store**: secretos `DB_PASSWORD`, `JWT_SECRET` y `EMAIL_PASS` migrados a `/terraempleo/production/*` como `SecureString`. El backend los carga al arrancar en producción con fallback a `.env` si SSM no responde. Ya no están en disco.
- Instalado `@aws-sdk/client-ssm` en backend.
- IAM policy `terraempleo-ssm-read` añadida a `terraempleo-s3-user`.

### ⚠️ Pendiente próxima sesión
- [ ] **Rotar AWS keys**: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` quedaron expuestas en conversación. Crear nuevas con `aws iam create-access-key`, actualizar `.env` del servidor, eliminar las viejas.
- [ ] **IAM Role en la instancia**: adjuntar rol IAM al Lightsail/EC2 para eliminar las AWS keys del `.env` completamente (solución definitiva al chicken-and-egg de credenciales).
- [ ] **SMS real**: reemplazar mock (`SMS_MOCK: true`) con proveedor real (Twilio o AWS SNS).
- [ ] **Cámara**: implementar `expo-camera` para captura real de fotos de identidad (actualmente muestra `Alert` placeholder).
- [ ] **Edición de perfil**: UI de edición de perfil no implementada.

---

## 2026-03-25 — Infraestructura AWS: CI/CD + CloudFront + Monitoreo

**Participantes:** Veronica

### ✅ Hecho
- **Migración frontend a S3 + CloudFront**: bucket `terraempleo-web-frontend`, distribución `E2VW0BWNEBE3B4`, dominio `app.terrampleo.com` con cert ACM validado por DNS en GoDaddy. SPA routing configurado (403/404 → `index.html`).
- **GitHub Actions CI/CD** (`.github/workflows/deploy.yml`): deploy selectivo — solo despliega backend si cambia `backend/**`, solo frontend si cambia el resto. Backend: SSH → git reset + restaurar `.env` → npm install → pm2 restart → health check. Frontend: expo export → S3 sync → invalidación CloudFront.
- **Compresión login.jpg**: de 21MB a 392KB (98% menos). Bundle web pasó de 29MB a 7.7MB.
- **IP estática Lightsail**: confirmada `107.20.220.171`.
- **CloudWatch alarms**: CPU < 1% (caída) y > 80% (sobrecarga) → `terraempleo@gmail.com`.
- **Budget**: $30 USD/mes con alertas al 80% y 100%.
- **Snapshots Lightsail**: diarios 3:00 AM GMT-5, retención 7 días.
- **RDS backups**: automáticos diarios, retención 7 días, Deletion Protection activo.
- **Postman collection**: 44 endpoints en 7 carpetas, auto-guarda token en Login.
- **CLAUDE.md** actualizado con toda la infraestructura AWS.

### ✅ Hecho (sesiones anteriores)
- Eliminado `express.static(publicDir)` de `server.js` que exponía 2,586 líneas de HTML en la raíz de la API.
- SSH deploy key configurada en GitHub para el servidor Lightsail.
- `git update-index --skip-worktree` en `.env` del servidor para protegerlo de `git reset --hard`.

---

## 2026-03-24 — Modo oscuro + fondos decorativos

**Participantes:** Veronica

### ✅ Hecho
- Integración de modo oscuro con `ThemeContext`.
- Fondos decorativos en pantallas principales.

---

## 2026-03-23 — Rate limiting en autenticación

**Participantes:** Veronica

### ✅ Hecho
- Rate limiting en rutas de auth para proteger contra fuerza bruta.
- Middleware `rateLimit.js` en backend.

---

## 2026-03-21 — Mapa de vacantes

**Participantes:** Veronica

### ✅ Hecho
- Pantalla `VacantesMapaScreen` con mapa interactivo.
- Correcciones en coordenadas y nombre de ubicación en cards.

---

## 2026-03-19 — HTTPS y dominio

**Participantes:** Veronica

### ✅ Hecho
- Configuración de dominio con HTTPS.
- `.env` excluido del repositorio.

---

## Stack actual

| Capa | Tecnología | URL |
|------|-----------|-----|
| Frontend web | React Native + Expo → S3 + CloudFront | `https://app.terrampleo.com` |
| API | Express.js + PM2 en Lightsail | `https://api.terrampleo.com/api` |
| Base de datos | RDS MariaDB | `terraempleo-mariadb.cyjse0ie8mw6.us-east-1.rds.amazonaws.com` |
| Secretos | AWS SSM Parameter Store | `/terraempleo/production/*` |
| Imágenes usuarios | S3 | `terraempleo-prod-images` |
| CI/CD | GitHub Actions | push a `main` → deploy automático |

---

## Backlog técnico

| Prioridad | Tarea |
|-----------|-------|
| 🔴 Alta | Rotar AWS keys expuestas |
| 🔴 Alta | IAM Role en instancia (eliminar keys del .env) |
| 🟡 Media | SMS real (Twilio / AWS SNS) |
| 🟡 Media | expo-camera para fotos de identidad |
| 🟡 Media | UI edición de perfil |
| 🟢 Baja | Load balancer + autoscaling (cuando el tráfico lo justifique) |
| 🟢 Baja | Migrar a AWS Secrets Manager (upgrade de SSM) |
