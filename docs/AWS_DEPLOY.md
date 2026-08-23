# Deploy AWS (App Runner)

Produção via **Docker + Amazon ECR Public + AWS App Runner** (`us-east-1`).

## URL atual

- App: https://64ribmgvda.us-east-1.awsapprunner.com
- Health: https://64ribmgvda.us-east-1.awsapprunner.com/api/health
- Bypass local (sem Google): https://64ribmgvda.us-east-1.awsapprunner.com/?local=1

Imagem: `public.ecr.aws/z7l7j8h4/trelloai:v17` (e `:latest`).

## Pré-requisitos

- AWS CLI autenticado
- Docker rodando
- `.env.local` com `AUTH_SECRET` (e Google OAuth se for usar login)

## Deploy

```bash
chmod +x scripts/deploy-aws.sh
./scripts/deploy-aws.sh
```

Ou rebuild manual (Apple Silicon: use `--platform linux/amd64`):

```bash
docker build --platform linux/amd64 -t trelloai:v4 .
aws ecr-public get-login-password --region us-east-1 | docker login --username AWS --password-stdin public.ecr.aws
docker tag trelloai:v4 public.ecr.aws/z7l7j8h4/trelloai:v4
docker push public.ecr.aws/z7l7j8h4/trelloai:v4
# depois update-service no App Runner para a nova tag
```

O `Dockerfile` inicia com `/bin/sh ./start.sh`, que força `HOSTNAME=0.0.0.0` (App Runner sobrescreve `HOSTNAME`; sem isso o health check falha).

## Login

Preferência: **e-mail + senha** em `/login` (criar conta / entrar).

Google OAuth é opcional. Se aparecer “Acesso bloqueado / solicitação inválida”, o redirect URI no Cloud Console precisa bater com:

`https://SEU_DOMINIO/api/auth/callback/google`

Contas locais ficam em `USERS_DATA_DIR` (padrão `./data`; no App Runner `/tmp/trelloai-data`). Em redeploy da instância o arquivo pode ser perdido — para persistência definitiva use um banco depois.

## Board ASESI e convites

- Board oficial **ASESI — Gestão de Projetos** (`/board/asesi`) é criado automaticamente.
- No board: ícone **Convidar** gera link `/invite/{token}` (snapshot compartilhado no servidor).
- Convidado cadastra/entra e aceita o convite para carregar o board.
- Maya (painel do gestor) usa **DeepSeek** (`DEEPSEEK_API_KEY`) para chat e daily; sem chave, cai no motor local.
- Maya aceita comandos de gestão: criar cards/listas, atribuir responsáveis e mover cards — além da daily.

## Google OAuth em produção

No [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

1. **Authorized JavaScript origins:** `https://64ribmgvda.us-east-1.awsapprunner.com`
2. **Authorized redirect URIs:** `https://64ribmgvda.us-east-1.awsapprunner.com/api/auth/callback/google`

`AUTH_URL` no serviço App Runner deve ser a mesma URL HTTPS.

## Custos

App Runner (1 vCPU / 2 GB) + ECR storage. Pare o serviço no console AWS se não estiver usando.
