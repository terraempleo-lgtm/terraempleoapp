# COWORK_CONTEXT.md — Contexto del bot de WhatsApp de TerraEmpleo

Documento para pasarle a "cowork" (u otro agente/dev) que necesite continuar o
desplegar el bot. Resume qué se construyó, cómo, dónde y qué NO tocar.

## Qué es

Bot automatizado de WhatsApp para TerraEmpleo (app de empleo rural). Implementa el
spec del equipo "Módulo backend de mensajería_Whatsapp.docx": **WhatsApp entra/sale
por API + webhooks; el backend es la fuente única de verdad; la app solo lee estados.**

## Decisiones tomadas (y por qué)

- **Gateway: Evolution API** (self-host, open-source) en modo Baileys → **no requiere
  verificación de negocio en Meta** (que les fallaba) y **$0 por mensaje**. El adapter
  del backend también soporta **Cloud API oficial** para migrar sin reescribir.
- **IA: AWS Bedrock (Claude Haiku)** como capa NLU sobre el flujo guiado (usa créditos AWS,
  no la API directa). Si Bedrock falla → degrada al flujo guiado, nunca se rompe.
- **n8n: self-hosted** (Community, gratis) — opcional, para iterar flujos visualmente.
- **BD: la RDS MariaDB de producción que ya existe.** ❗NO crear BD nueva ni replicar datos.
  (Hay un plan de migración a Postgres/ECS en el repo `aplicativoweb`, pero NO está ejecutado.)
- **Número: 573108870800** — es también el de soporte de la app, así que el bot atiende
  **soporte + empleos** y escala a humano cuando hace falta.
- **Reuso:** el flujo del empleador crea una **vacante normal** (no tablas de solicitudes),
  reutilizando `vacantes`/`postulaciones`/matching existentes.

## Dónde está el código (repo `terraempleoapp`, dentro de `TerraEmpleoApp/backend/`)

| Archivo | Rol |
|---|---|
| `services/whatsappService.js` | Adapter de envío (evolution/cloud/mock) + log + normalización tel + opt-in |
| `services/nluService.js` | Bedrock (Claude) — extrae {finca,labor,cantidad,fecha,pago} de texto libre |
| `services/conversationEngine.js` | Router de intención + flujo empleador (con NLU) + flujo soporte + escalamiento |
| `controllers/whatsappController.js` | Webhook receiver + idempotencia + identifica usuario por número |
| `routes/whatsapp.js` | `POST/GET /api/webhooks/whatsapp`, `GET .../estado` |
| `models/whatsappSchema.js` | Tablas `whatsapp_conversaciones`, `whatsapp_mensajes`, cols `whatsapp_opt_in*` |
| `controllers/vacantesController.js` | `ejecutarMatching` (existente) — se le añadió hook WhatsApp (flujo 2) |
| `../whatsapp-bot/` | Infra: docker-compose (Evolution+n8n+Redis+Postgres), README, AWS_SETUP.md, .env.example |

Wiring en `server.js`: `app.use('/api', whatsappRoutes)` y `initWhatsappSchema()` tras `initializeDatabase()`.
`config/secrets.js`: `WHATSAPP_API_KEY` añadida a `SECRET_KEYS` (se carga de SSM).

## Flujos

1. **Empleador crea solicitud** (texto libre o guiado): NLU prellena → pregunta lo que falte →
   *CONFIRMAR* → crea vacante → dispara matching.
2. **Trabajadores con match + opt-in** reciben la vacante por WhatsApp ("responde 1/2").
3. **Soporte**: palabras como "ayuda/problema/no puedo" → el bot pide detalle → registra **PQRS**
   + notifica a admins → "un asesor te contactará".
Comandos: `CONFIRMAR`/`CORREGIR`, `CANCELAR`, `SALIR` (opt-out).

## Variables de entorno del backend
```
WHATSAPP_PROVIDER=evolution|cloud|mock   # mock si falta config (loguea, no envía)
WHATSAPP_API_URL=http://IP_GATEWAY:8080
WHATSAPP_API_KEY=...                      # en SSM en producción
WHATSAPP_INSTANCE=terraempleo
WHATSAPP_WEBHOOK_TOKEN=...                # protege el webhook (?token=)
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-haiku-4-5-20251001-v1:0   # Haiku 4.5 (inference profile) — acceso verificado
BEDROCK_ENABLED=auto                      # 'false' para desactivar IA
```

## Cómo probar sin gateway (modo mock)
Sin `WHATSAPP_API_URL`/`WHATSAPP_API_KEY` el módulo corre en mock: hacer `POST /api/webhooks/whatsapp`
con un payload de Evolution simulado y ver respuestas en consola + tabla `whatsapp_mensajes`.

## Qué NO hacer
- ❌ No crear una base de datos nueva ni duplicar tablas existentes.
- ❌ No exponer los puertos 8080/5678 del gateway a `0.0.0.0/0` (solo IPs de confianza).
- ❌ No poner secretos en el repo (usar SSM / `.env` ignorado).
- ❌ No romper el flujo guiado: la NLU es una mejora opcional, debe degradar a guiado.

## Despliegue
Ver `AWS_SETUP.md` (runbook consola + CLI). Piloto = 1 EC2 t3.small con docker-compose; producción = ECS Fargate.
