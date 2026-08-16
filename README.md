# TrelloAI

Kanban com assistente de IA — primeira versão (MVP).

## O que já funciona

- Boards, listas e cards persistidos no `localStorage`
- Drag-and-drop entre listas (`@dnd-kit`)
- Labels, prioridade e edição de card (duplo clique)
- Painel de IA para:
  - gerar cards a partir de um briefing
  - sugerir prioridades
- Motor local sem chave; OpenAI se `OPENAI_API_KEY` estiver definida

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Zustand (estado + persistência)
- `@dnd-kit` (drag-and-drop)
- API route `/api/ai`

## Como rodar

```bash
npm install
cp .env.example .env.local   # opcional: adicione OPENAI_API_KEY
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

1. Auth e multi-usuário (convites / papéis)
2. Backend com Postgres em vez de só `localStorage`
3. Tempo real (WebSockets)
4. Automações tipo Butler
5. Importação de boards Trello

## Docs

- [docs/PRD.md](docs/PRD.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
