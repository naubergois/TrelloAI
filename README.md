# TrelloAI

Kanban com assistente de IA — primeira versão (MVP).

## O que já funciona

- Boards, listas e cards persistidos no `localStorage`
- **Tela inicial** com galeria de boards; fundo e design personalizáveis por board
- **Equipes** reutilizáveis atribuíveis a cada kanban
- Drag-and-drop entre listas (`@dnd-kit`)
- Labels, prioridade e edição de card (duplo clique)
- Painel de IA para:
  - gerar cards a partir de um briefing
  - sugerir prioridades
- Motor local sem chave; OpenAI se `OPENAI_API_KEY` estiver definida
- Reuniões virtuais com a equipe (Jitsi Meet embutido)
- **Gestor virtual por board**: daily automática, pergunta status ao time e cria/atualiza cards
- Login de usuários com Google (Auth.js) — ver [docs/GOOGLE_AUTH.md](docs/GOOGLE_AUTH.md)

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Zustand (estado + persistência)
- `@dnd-kit` (drag-and-drop)
- API route `/api/ai`
- Jitsi Meet (salas virtuais via iframe)
- Auth.js (`next-auth`) + Google OAuth

## Como rodar

```bash
npm install
cp .env.example .env.local
# preencha AUTH_SECRET, AUTH_GOOGLE_ID e AUTH_GOOGLE_SECRET (ver docs/GOOGLE_AUTH.md)
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000).

## Scripts

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Desenvolvimento |
| `npm run build` | Build de produção |
| `npm run start` | Servir build |
| `npm run lint` | ESLint |

## Roadmap curto

1. Auth e sync multi-dispositivo (Postgres)
2. Convites por email para reuniões
3. Tempo real no board (WebSockets)
4. Automações tipo Butler
5. Importação de boards Trello

## Docs

- [docs/PRD.md](docs/PRD.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
