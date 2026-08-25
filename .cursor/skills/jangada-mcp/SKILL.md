---
name: jangada-mcp
description: Alimenta o kanban Jangada (ASESI/CGE) via MCP — criar listas, cards e requisitos no mesmo Postgres usado pelo app. Use when the user asks to criar card, alimentar o board, MCP Jangada, Kiro, ou gravar tarefas no kanban.
---

# Jangada MCP

Cursor e Kiro usam o mesmo servidor stdio `scripts/jangada-mcp.mjs`. Os dados vão para `h_asesi.trelloai` (ou `data/shared-boards.json` se não houver PG).

## Quando usar

Qualquer pedido para criar/mover/atualizar cards, listas ou requisitos no Jangada. Não edite `shared-boards.json` nem o JSONB na mão.

## Tools

- `jangada_ping` — persistência
- `jangada_listar_boards` / `jangada_ver_board` — leitura (`board_id` default `asesi`)
- `jangada_criar_card` / `jangada_criar_cards` — escrita
- `jangada_criar_lista`, `jangada_mover_card`, `jangada_atualizar_card`
- `jangada_criar_requisito`

Liste o board antes de criar. Prefira `list_title` (ex.: Backlog) se não tiver o id da lista.
