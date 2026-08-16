# Arquitetura — TrelloAI

## Contexto

```mermaid
flowchart TB
  subgraph client [Browser]
    UI[Next.js UI]
    Store[Zustand + localStorage]
  end
  subgraph server [Next.js Server]
    AiApi["/api/ai"]
  end
  subgraph external [Opcional]
    OpenAI[OpenAI Chat Completions]
  end
  UI --> Store
  UI --> AiApi
  AiApi -->|OPENAI_API_KEY| OpenAI
  AiApi -->|fallback| LocalEngine[Motor local heurístico]
```

## Componentes

| Componente | Responsabilidade | Tecnologia |
|------------|------------------|------------|
| UI Kanban | Boards, listas, cards, DnD | React + @dnd-kit |
| Store | Estado e persistência | Zustand persist |
| API IA | Interpreta prompt e devolve ações | Next.js Route Handler |
| Motor local | Fallback sem chave | Heurísticas PT-BR |

## Modelo de dados (cliente)

- `Board` → `listIds[]`
- `List` → `cardIds[]`
- `Card` → título, descrição, labels, prioridade, dueDate

## Decisões

- **ADR-001**: Persistência em `localStorage` no MVP — simples e offline-first.
- **ADR-002**: Ações de IA estruturadas (`create_cards`, `suggest_priorities`) aplicadas no client.
- **ADR-003**: OpenAI opcional; produto usable sem chave.

## Próxima evolução

Auth + Postgres + sync multi-dispositivo; realtime via WebSockets.
