# Módulo Bot de WhatsApp — TerraEmpleo

Bot automatizado de WhatsApp para TerraEmpleo. Sigue el spec del equipo
("Módulo backend de mensajería_Whatsapp.docx"): **WhatsApp entra/sale por API +
webhooks; el backend es la fuente única de verdad; la app solo lee estados.**

## Arquitectura

```
WhatsApp ⇄ Evolution API (gateway, AWS) ──webhook──▶ Backend TerraEmpleo (módulo whatsapp)
                                                          │  Node/Express + RDS MariaDB (la BD que ya existe)
              n8n (opcional, flujos visuales) ◀──────────┘
   App Android / Panel web  ◀── lee estados (vacantes, postulaciones) desde el backend
```

- **Evolution API** (open-source, self-host): habla WhatsApp por el protocolo de
  WhatsApp Web (Baileys) → **no requiere verificación de negocio en Meta** ni cobra
  por mensaje. El mismo adapter del backend soporta el modo **Cloud API oficial**
  para migrar después sin reescribir el bot.
- **Backend**: el código vive en `../TerraEmpleoApp/backend` (mismo repo). Reutiliza la RDS MariaDB
  existente; solo agrega tablas `whatsapp_conversaciones` y `whatsapp_mensajes` y las
  columnas `whatsapp_opt_in*` en `usuarios`. **No replica datos.**

### ⚠️ Nota sobre Baileys (no oficial)
Evolution en modo Baileys viola los TOS de WhatsApp → riesgo de baneo del número.
Mitigaciones: usar un **número dedicado** (no el personal), bajo volumen, opt-in,
y sin botones nativos (se usan respuestas numeradas "1 / 2"). Para producción de alto
volumen, migrar al modo Cloud API oficial (`WHATSAPP_PROVIDER=cloud`).

## Flujos implementados

1. **Empleador crea solicitud por WhatsApp** (`conversationEngine.js`): el empleador puede
   escribir **texto libre** ("necesito 8 recolectores mañana en El Porvenir 70 mil") y la
   **NLU con Bedrock** (`nluService.js`) prellena los campos; el flujo guiado solo pregunta
   lo que falte (finca → labor → # → fecha → pago) → *CONFIRMAR*. Crea una **vacante** normal
   (visible en la app) y dispara el matching. Si Bedrock no está, degrada al flujo guiado.
2. **Trabajadores reciben vacantes que encajan** (hook en `ejecutarMatching`): a cada
   trabajador con match y `whatsapp_opt_in=1` se le envía la vacante por WhatsApp
   ("responde 1 para postularte / 2 no").
3. **Soporte** (mismo número 573108870800): palabras como "ayuda/problema/no puedo" abren el
   flujo de soporte → el bot pide detalle → registra **PQRS** + notifica a admins → escala a humano.

Comandos: `Necesito trabajadores` (inicia), `CONFIRMAR`/`CORREGIR`, `CANCELAR`, `SALIR` (opt-out), `AYUDA` (soporte).

## IA (AWS Bedrock)
La interpretación de texto libre usa **Claude Haiku en Bedrock** (gasta créditos AWS, no la API
directa). Ver despliegue y habilitación del modelo en [AWS_SETUP.md](./AWS_SETUP.md). Es opcional:
con `BEDROCK_ENABLED=false` o sin credenciales, el bot funciona 100% con el flujo guiado.

## Componentes del backend (en `../TerraEmpleoApp/backend`)

| Archivo | Rol |
|---|---|
| `services/whatsappService.js` | Adapter de envío (Evolution/Cloud/mock) + log + normalización + opt-in |
| `services/conversationEngine.js` | Máquina de estados del flujo del empleador |
| `controllers/whatsappController.js` | Webhook receiver + idempotencia + identificación de usuario |
| `routes/whatsapp.js` | `POST/GET /api/webhooks/whatsapp`, `GET .../estado` |
| `models/whatsappSchema.js` | Tablas del módulo |

### Variables de entorno del backend
```
WHATSAPP_PROVIDER=evolution            # evolution | cloud | mock (default: mock si falta config)
WHATSAPP_API_URL=http://IP_GATEWAY:8080
WHATSAPP_API_KEY=<EVOLUTION_API_KEY>   # en producción va en SSM (/terraempleo/production/WHATSAPP_API_KEY)
WHATSAPP_INSTANCE=terraempleo
WHATSAPP_WEBHOOK_TOKEN=<token compartido para proteger el webhook>
# IA (Bedrock):
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0   # Haiku 4.5 (inference profile), verificado con acceso
BEDROCK_ENABLED=auto                  # 'false' para desactivar la NLU
# Cloud API (solo si WHATSAPP_PROVIDER=cloud):
# WHATSAPP_PHONE_NUMBER_ID=...   WHATSAPP_VERIFY_TOKEN=...
```
Sin `WHATSAPP_API_URL`/`WHATSAPP_API_KEY` el módulo corre en **modo mock** (loguea en
consola y BD) — útil para desarrollo sin gateway.

## Puesta en marcha del gateway

### Local
```bash
cp .env.example .env      # editar valores
docker compose --env-file .env up -d
# Vincular el número: abrir el QR de la instancia
#   POST http://localhost:8080/instance/create  { "instanceName": "terraempleo", "qrcode": true }
#   header: apikey: <EVOLUTION_API_KEY>
# Escanear el QR desde el WhatsApp del número dedicado.
```
Para que Evolution alcance un backend local, exponer con túnel:
`ngrok http 3000` y poner esa URL en `TERRAEMPLEO_WEBHOOK_URL`.

### AWS (recomendado, usa los créditos)
**Piloto** — 1 EC2 `t3.small` (o Lightsail container) con Docker:
1. Lanzar instancia, instalar Docker + Compose, abrir puertos 8080 (Evolution) y 5678 (n8n) solo a tus IPs.
2. Subir esta carpeta, `cp .env.example .env`, editar (`EVOLUTION_SERVER_URL=http://IP:8080`,
   `TERRAEMPLEO_WEBHOOK_URL=https://api.terrampleo.com/api/webhooks/whatsapp?token=...`).
3. `docker compose --env-file .env up -d` y vincular el número (QR).
4. Guardar la apikey en SSM: `aws ssm put-parameter --name /terraempleo/production/WHATSAPP_API_KEY --value '<key>' --type SecureString --overwrite` y poner `WHATSAPP_API_URL`/`WHATSAPP_INSTANCE`/`WHATSAPP_PROVIDER=evolution` en el `.env` del backend (Lightsail).

**Producción** — mover Evolution + n8n a **ECS Fargate** (alineado con `PLAN_MIGRACION_AWS.md` del repo `aplicativoweb`), con Redis en ElastiCache.

## Verificación end-to-end

1. Gateway arriba + número vinculado (QR escaneado).
2. Webhook configurado → `GET https://api.terrampleo.com/api/webhooks/whatsapp` responde
   `{"status":"whatsapp webhook ok","provider":"evolution"}`.
3. **Flujo 1**: desde un WhatsApp de un usuario con rol `empleador`, enviar
   "Necesito trabajadores" y completar el flujo → debe crearse una vacante
   (verla en `GET /api/vacantes` o en la app) y la fila en `whatsapp_conversaciones`.
4. **Flujo 2**: un trabajador con `whatsapp_opt_in=1` cuyo perfil haga match debe recibir
   la vacante por WhatsApp. Responder "1"/"2" recibe la respuesta correspondiente.
5. Idempotencia: reenviar el mismo evento no duplica (UNIQUE en `provider_message_id`).
6. Estado: `GET /api/webhooks/whatsapp/estado` (admin) muestra conteos.

> Para probar sin gateway: dejar `WHATSAPP_PROVIDER` sin configurar (modo mock) y hacer
> `POST /api/webhooks/whatsapp` con un payload de Evolution simulado; las respuestas se
> loguean en consola y en `whatsapp_mensajes`.
