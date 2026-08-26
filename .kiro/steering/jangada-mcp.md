# Jangada MCP

Alimente o kanban pelo MCP `jangada` (mesmo servidor do Cursor: `scripts/jangada-mcp.mjs`).

- Board padrão: `asesi`
- Criar trabalho: `jangada_criar_card` ou `jangada_criar_cards`
- Anexar arquivo: `jangada_anexar_arquivo` (`file_path`, `content_base64` ou `url`)
- `jangada_atualizar_resumo` guarda o resumo executivo do board
- `jangada_adicionar_git` liga um Git ao board (Maya analisa cobertura)
- Não grave snapshot JSON à mão; use as tools

O Postgres ASESI (`h_asesi`, schema `trelloai`) é a fonte oficial. Sem `PG_*` no `.env.local`, cai no arquivo `data/shared-boards.json`.
