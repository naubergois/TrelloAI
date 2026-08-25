# Jangada

Kanban da **ASESI / CGE** com identidade visual do Governo do Ceará (Terra da Luz). Boards, listas, cards, convites, reuniões e a gestora virtual **Maya**.

Repositório GitLab ASESI: [g_asesi/jangada](https://git.cge.ce.gov.br/g_asesi/jangada)

## O que a aplicação faz

O Jangada é um quadro Kanban colaborativo para a gestão pública cearense. Cada usuário autentica, vê os boards dos quais participa e trabalha com listas e cards (prioridade, prazo, labels, checklist, requisitos). Há um board oficial **ASESI** (id estável `asesi`) criado automaticamente no banco.

Fluxo típico:

1. Entrar em `/login` com o admin padrão (`admin` / `Jangada@Admin`) ou uma conta cadastrada por ele.
2. Na home, abrir um board existente, criar um novo ou aceitar um convite.
3. Arrastar cards entre listas, editar detalhes e atribuir pessoas da equipe.
4. Usar a **Maya** para daily, criar/mover cards e sugerir prioridades (DeepSeek ou LiteLLM CGE).
5. Abrir reunião virtual da equipe (Jitsi) quando precisar.

A persistência oficial é o PostgreSQL da ASESI (`h_asesi`, schema `trelloai`), o mesmo servidor do Farol, em schema isolado. Sem `PG_*` configurado, o app cai para arquivos locais em `data/` (só desenvolvimento).

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Auth.js (`next-auth`) — usuário e senha (admin cadastra os demais)
- Zustand no cliente (estado do board aberto)
- PostgreSQL (`pg`) — boards, membros, usuários e convites
- `@dnd-kit` — drag-and-drop
- Maya: DeepSeek / LiteLLM CGE (`DEEPSEEK_*`); motor local se a chave não estiver definida
- AWS Secrets Manager (`AWS_SECRET_NAME`) — injeta env vars na inicialização, sem sobrescrever `.env.local`
- Jitsi Meet (salas via iframe)

## Identidade e banco

| Item | Valor |
|------|--------|
| Produto | Jangada |
| Schema PostgreSQL | `trelloai` (nome técnico legado; **não** misturar com `farol`) |
| Banco | `h_asesi` em `192.168.3.26:5432` |
| Health | `GET /api/health` → `{ service: "jangada", database: … }` |
| Homologação | stack Swarm `homolog-jangada`, host `homolog-jangada.cge.local` |
| Cofre | secret `asesi/jangada/homol` (região `sa-east-1`) |

## Como rodar localmente

Na rede CGE (ou VPN) para alcançar o Postgres. Localmente use `.env.local` (não precisa do cofre AWS).

```powershell
npm install
copy .env.example .env.local
# preencha AUTH_SECRET, PG_PASSWORD e, se for usar Maya, DEEPSEEK_API_KEY
npm run db:ensure
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Login inicial:

- **Usuário:** `admin`
- **Senha:** `Jangada@Admin`

O administrador cadastra os demais em `/admin/usuarios`.

`AUTH_SECRET` pode ser gerado com:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servir build |
| `npm run test` | Vitest |
| `npm run typecheck` | TypeScript |
| `npm run db:ensure` | Cria schema `trelloai` e tabelas no `h_asesi` |

## Homologação

Secrets (Postgres, Auth, DeepSeek/LiteLLM, admin) vêm do AWS Secrets Manager. O compose só passa as credenciais do cofre:

- `docker-compose.homol.yml` — deploy Swarm (branch `homol`, CI)
- `.gitlab-ci.yml` — build Nexus + `docker stack deploy` nas branches `homol` e `production`
- Variáveis de controle: `AWS_SECRET_NAME=asesi/jangada/homol` e `AWS_REGION=sa-east-1`
- Campos já definidos em `process.env` (ex.: `.env.local`) **não** são sobrescritos pelo cofre
