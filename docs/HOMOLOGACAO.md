# Homologação Jangada

Pacote alinhado ao portal ASESI (Swarm + Traefik + Nexus + branch `homol`) e ao Cacimba (`.env.homolog`, health e template CGE Atende).

## O que sobe

- Imagem Docker `jangada:homol` / `nexus.cge.ce.gov.br/jangada:homol` (Next.js standalone, Node 22)
- Porta interna **3000**; smoke local **5558**
- Host Traefik: `homolog-jangada.cge.local`
- Stack Swarm: `homolog-jangada`
- Health: `GET /api/health` (`service: "jangada"` + ping no Postgres)
- Persistência: PostgreSQL `h_asesi`, schema `trelloai` em `192.168.3.26`

## Subir localmente (smoke)

Na rede CGE (o container precisa alcançar `192.168.3.26`):

```powershell
cd C:\Users\francisco.gois\TrelloAI
copy docker\env.homolog.example .env.homolog
# Edite AUTH_SECRET (≥32), PG_PASSWORD, AUTH_URL e DEEPSEEK_API_KEY

docker compose -f docker-compose.homol.local.yml --env-file .env.homolog up -d --build
curl http://127.0.0.1:5558/api/health
```

Login: criar conta em `/login` (e-mail + senha). Google é opcional.

## Deploy HMG (Swarm / Traefik)

Padrão do portal ASESI. A CI da branch `homol` faz build, publica no Nexus e executa:

```bash
docker stack deploy -c docker-compose.homol.yml homolog-jangada --with-registry-auth
```

Secrets **não** vão no git. No servidor HMG:

```bash
sudo mkdir -p /opt/jangada
# copie docker/env.homolog.example → /opt/jangada/.env.homolog e preencha
```

A CI faz `source /opt/jangada/.env.homolog` no host antes do `stack deploy`, para interpolar `${AUTH_SECRET}`, `${PG_PASSWORD}`, etc.

## Checklist para infra (Leonardo / CGE Atende)

1. Host HMG com Docker Swarm, rede `proxy` (Traefik) e acesso a `192.168.3.26:5432`
2. Variáveis CI: `NEXUS_REGISTRY_*`, `SSH_HOST_HMG`, `SSH_USER_HMG`
3. DNS interno `homolog-jangada.cge.local` no Traefik
4. Arquivo `/opt/jangada/.env.homolog` no manager (nunca no git)
5. LiteLLM CGE acessível do host (`DEEPSEEK_BASE_URL=https://litellm.cge.ce.gov.br`)
6. Após deploy: `GET /api/health` com `database.reachable: true` + login + board ASESI

## Template de chamado (CGE Atende)

Categoria: **INFRAESTRUTURA** → **APLICAÇÕES**

```text
ASSUNTO: Deploy do Jangada em homologação (Swarm/Nexus/CI)

Sistema: Jangada — kanban ASESI/CGE (Maya, convites, board ASESI)
Repo: https://git.cge.ce.gov.br/g_asesi/jangada
Clone: git clone https://git.cge.ce.gov.br/g_asesi/jangada.git
Branch: homol (CI/deploy) / master
Imagem: nexus.cge.ce.gov.br/jangada:homol
Compose: docker-compose.homol.yml
Stack: homolog-jangada
Host Traefik: homolog-jangada.cge.local
Porta smoke local: 5558 (container 3000)
Tipo: Next.js standalone (Node 22, 0.0.0.0:3000)
Healthcheck: GET /api/health
Banco: PostgreSQL 192.168.3.26:5432 / h_asesi / schema trelloai (isolado do farol)

Pedir:
- Variáveis CI Nexus/SSH HMG (mesmo padrão do portal ASESI)
- Publish Nexus jangada:homol
- DNS Traefik homolog-jangada.cge.local
- Confirmação de rede até 192.168.3.26 e LiteLLM
- Secrets no servidor (/opt/jangada/.env.homolog): AUTH_SECRET, AUTH_URL, PG_PASSWORD, DEEPSEEK_API_KEY
```

## Segurança em homolog

- `ALLOW_LOCAL_BYPASS=0` — sem `?local=1`
- `AUTH_SECRET` forte (≥32 caracteres)
- `AUTH_URL` deve ser a URL pública/interna real (`http://homolog-jangada.cge.local`)
- Senha do Postgres e chaves LLM só em `.env.homolog` / variáveis CI, fora do git

## Rede / banco

O host `192.168.3.26` é interno da CGE. O Swarm precisa rota até ele. DDL: `infra/asesi-schema.sql`. Detalhes: [ASESI_DATABASE.md](ASESI_DATABASE.md).
