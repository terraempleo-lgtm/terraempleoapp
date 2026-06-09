# CLAUDE_CODE_DEPLOY.md — Contexto de despliegue para Claude Code

Lee este archivo antes de desplegar el bot de WhatsApp de TerraEmpleo. Aquí está todo
lo necesario para operar AWS **sin credenciales en texto plano**: las llaves viven en el
perfil local `terraempleo` (`~/.aws/credentials`), nunca en el repo.

> ⚠️ NUNCA escribas el Access Key ID ni el Secret Access Key en ningún archivo de este
> repo, ni los pegues en chat. Si una llave aparece en git, AWS la desactiva y hay que
> rotarla. Usa siempre el perfil.

## Cuenta y perfil

| Dato | Valor |
|---|---|
| Cuenta AWS | `084375580049` |
| Región | `us-east-1` |
| Perfil CLI | `terraempleo` |
| Usuario IAM | `terraempleo-bot-deployer` |
| Policies | `AmazonEC2FullAccess`, `AmazonSSMFullAccess`, `AmazonBedrockFullAccess` |

## Cómo usar las credenciales

Pasa el perfil en cada comando, o expórtalo en la sesión:

```bash
export AWS_PROFILE=terraempleo
export AWS_REGION=us-east-1

# verifica que estás en la cuenta correcta antes de tocar nada
aws sts get-caller-identity        # debe devolver Account 084375580049
```

Si `get-caller-identity` falla, el perfil no está configurado todavía. Pídele al humano
(Fredy) que corra `aws configure --profile terraempleo`. **No** intentes crear ni escribir
llaves tú mismo.

## Bedrock (NLU del bot)

El acceso al modelo Anthropic Claude se habilita una vez por consola
(Bedrock → Model access → Manage model access → Anthropic Claude, mín. Claude 3.5 Haiku → Save).
Para obtener el `modelId` exacto a usar en `BEDROCK_MODEL_ID`:

```bash
aws bedrock list-foundation-models --region us-east-1 \
  --query "modelSummaries[?contains(modelId,'claude') && contains(modelId,'haiku')].modelId" \
  --output table
```

## Runbook completo

El paso a paso de despliegue (EC2, security groups, gateway WhatsApp, SSM) está en
`AWS_SETUP.md` en esta misma carpeta. Contexto general del proyecto en `COWORK_CONTEXT.md`.

## Al terminar el piloto

Rotar o desactivar la access key del usuario `terraempleo-bot-deployer`:

```bash
aws iam list-access-keys --user-name terraempleo-bot-deployer
aws iam update-access-key --user-name terraempleo-bot-deployer \
  --access-key-id <KEY_ID> --status Inactive
```
