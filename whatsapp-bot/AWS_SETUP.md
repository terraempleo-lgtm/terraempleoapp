# AWS_SETUP.md — Despliegue del bot de WhatsApp en AWS

Runbook para provisionar y desplegar el gateway de WhatsApp (Evolution API + n8n) y
habilitar la IA (Bedrock) para TerraEmpleo. Sirve para un humano o un agente. Cada
paso trae **consola** y **CLI**. Región: `us-east-1` (donde está el resto del stack).

> Contexto del stack actual (no cambiar): backend Node en **Lightsail** (`107.20.220.171`,
> PM2 `terraempleo-api`), **RDS MariaDB** `terraempleo-mariadb.cyjse0ie8mw6.us-east-1.rds.amazonaws.com`,
> secretos en **SSM** `/terraempleo/production/*`. El bot vive dentro de ese backend.

---

## 0. Acceso (hacerlo una vez)

Crear un usuario IAM acotado y configurar el perfil local (las llaves NO se comparten en chat):

```bash
# (Consola IAM) Crear usuario "terraempleo-bot-deployer" con acceso programático y la policy de abajo.
aws configure --profile terraempleo
#   AWS Access Key ID / Secret / region us-east-1 / output json
aws sts get-caller-identity --profile terraempleo   # debe devolver la cuenta 084375580049
```

Policy mínima sugerida (ajustar al gusto): `AmazonEC2FullAccess` (o acotada a crear
instancias/SG/keypairs), `AmazonSSMFullAccess` (o solo `ssm:PutParameter`/`GetParameter` en
`/terraempleo/*`), `AmazonBedrockFullAccess` (o solo `bedrock:InvokeModel` + `bedrock:ListFoundationModels`),
y `iam:CreateRole/AttachRolePolicy/PassRole` solo si se usará rol de instancia.

**Al terminar el piloto: rotar/desactivar las llaves.**

---

## 1. Bedrock — habilitar Claude

La IA del bot (NLU) usa **Claude en Bedrock**. Hay que pedir acceso al modelo (1 vez):

- **Consola**: Bedrock → *Model access* → *Manage model access* → habilitar **Anthropic Claude**
  (Haiku como mínimo) → *Save changes*. Tarda unos minutos en quedar `Access granted`.
- **Verificar modelos disponibles** (y obtener el `modelId` exacto):
  ```bash
  aws bedrock list-foundation-models --region us-east-1 --profile terraempleo \
    --query "modelSummaries[?contains(modelId,'claude') && contains(modelId,'haiku')].modelId" --output table
  ```
  Usar ese id en `BEDROCK_MODEL_ID` (puede requerir el inference profile con prefijo `us.`).

El backend en Lightsail necesita permiso `bedrock:InvokeModel`. Opciones:
- (Recomendado) crear credenciales/usuario IAM con esa policy y ponerlas como `AWS_ACCESS_KEY_ID`/
  `AWS_SECRET_ACCESS_KEY` en el `.env` del backend (o rol de instancia si se migra a EC2).

---

## 2. Gateway WhatsApp — EC2 (piloto)

### 2.1 Key pair y security group
```bash
# Key pair (o reutilizar una de keyssh/)
aws ec2 create-key-pair --key-name terraempleo-wa --profile terraempleo \
  --query 'KeyMaterial' --output text > terraempleo-wa.pem && chmod 600 terraempleo-wa.pem

# Security group: SSH + puertos del gateway SOLO a tu IP (sustituye TU_IP/32)
aws ec2 create-security-group --group-name terraempleo-wa-sg \
  --description "WhatsApp gateway" --profile terraempleo
# (anota el GroupId y abre 22, 8080, 5678 a TU_IP/32)
aws ec2 authorize-security-group-ingress --group-name terraempleo-wa-sg \
  --protocol tcp --port 22   --cidr TU_IP/32 --profile terraempleo
aws ec2 authorize-security-group-ingress --group-name terraempleo-wa-sg \
  --protocol tcp --port 8080 --cidr TU_IP/32 --profile terraempleo
aws ec2 authorize-security-group-ingress --group-name terraempleo-wa-sg \
  --protocol tcp --port 5678 --cidr TU_IP/32 --profile terraempleo
```
> ⚠️ NO abrir 8080/5678 a `0.0.0.0/0`. El webhook hacia el backend sí necesita salir del
> gateway a `https://api.terrampleo.com` (salida, no entrada).

### 2.2 Lanzar instancia (Amazon Linux 2023, t3.small)
```bash
aws ec2 run-instances --image-id <AMI_AL2023_us-east-1> --instance-type t3.small \
  --key-name terraempleo-wa --security-groups terraempleo-wa-sg \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=terraempleo-wa}]' \
  --profile terraempleo
# Obtener IP pública:
aws ec2 describe-instances --filters Name=tag:Name,Values=terraempleo-wa \
  --query 'Reservations[].Instances[].PublicIpAddress' --output text --profile terraempleo
```

### 2.3 Instalar Docker y levantar el stack
```bash
ssh -i terraempleo-wa.pem ec2-user@IP_PUBLICA
sudo dnf update -y && sudo dnf install -y docker && sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user   # reconectar para aplicar
# Compose plugin:
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 \
  -o /usr/local/bin/docker-compose && sudo chmod +x /usr/local/bin/docker-compose

# Subir la carpeta whatsapp-bot/ (scp desde tu máquina) o clonarla del repo.
cd whatsapp-bot && cp .env.example .env && nano .env   # completar valores
docker compose --env-file .env up -d
```

### 2.4 Vincular el número 573108870800 (QR)
```bash
# Crear la instancia en Evolution y pedir el QR:
curl -X POST http://IP_PUBLICA:8080/instance/create \
  -H "apikey: $EVOLUTION_API_KEY" -H "Content-Type: application/json" \
  -d '{"instanceName":"terraempleo","qrcode":true,"integration":"WHATSAPP-BAILEYS"}'
# Escanear el QR (devuelto en base64 / o GET /instance/connect/terraempleo) desde el WhatsApp del número.
```

---

## 3. SSM + configuración del backend

```bash
# Guardar la apikey de Evolution como secreto:
aws ssm put-parameter --name /terraempleo/production/WHATSAPP_API_KEY \
  --value '<EVOLUTION_API_KEY>' --type SecureString --overwrite --profile terraempleo
```

En el `.env` del backend (Lightsail, `/home/ubuntu/terraempleoapp/.../backend/.env`) añadir:
```
WHATSAPP_PROVIDER=evolution
WHATSAPP_API_URL=http://IP_PUBLICA:8080
WHATSAPP_INSTANCE=terraempleo
WHATSAPP_WEBHOOK_TOKEN=<token-largo>
BEDROCK_REGION=us-east-1
BEDROCK_MODEL_ID=<id del paso 1>
# Si el backend no usa rol IAM, también AWS_ACCESS_KEY_ID/SECRET con permiso bedrock:InvokeModel
```
Recordar: `WHATSAPP_API_KEY` se carga desde SSM al arrancar (ya está en `SECRET_KEYS`).
Reiniciar: `pm2 restart terraempleo-api` (o push a `main` para CI/CD).

En el `.env` del **gateway** (`whatsapp-bot/.env`):
```
TERRAEMPLEO_WEBHOOK_URL=https://api.terrampleo.com/api/webhooks/whatsapp?token=<token-largo>
```

---

## 4. Verificar
```bash
curl https://api.terrampleo.com/api/webhooks/whatsapp           # {"status":"...","provider":"evolution"}
# Desde WhatsApp (empleador): "necesito 8 recolectores mañana en El Porvenir 70 mil" → bot confirma → crea vacante.
# Desde WhatsApp (cualquiera): "ayuda no puedo entrar" → bot escala (PQRS + notif admin).
```

---

## 5. Producción (después del piloto)
Mover Evolution + n8n a **ECS Fargate** (alineado con `terraempleoaplicativoweb/.aws/PLAN_MIGRACION_AWS.md`),
Redis a **ElastiCache**, y Bedrock vía **rol de tarea** (sin llaves en `.env`). Coste estimado piloto
(EC2 t3.small + tráfico) ~ $15-25/mes, cubierto por los créditos.
