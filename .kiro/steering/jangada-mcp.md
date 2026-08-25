# Jangada MCP

Alimente o kanban pelo MCP `jangada` (mesmo servidor do Cursor: `scripts/jangada-mcp.mjs`).

- Board padrão: `asesi`
- Criar trabalho: `jangada_criar_card` ou `jangada_criar_cards`
- Antes de criar, chame `jangada_ver_board` para ver listas
- Não grave snapshot JSON à mão; use as tools

O Postgres ASESI (`h_asesi`, schema `trelloai`) é a fonte oficial. Sem `PG_*` no `.env.local`, cai no arquivo `data/shared-boards.json`.
