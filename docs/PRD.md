# PRD — Jangada (MVP)

## Visão

Jangada é o kanban da ASESI/CGE, com identidade do Ceará e assistente de IA (Maya) para criar cards, quebrar trabalho e sugerir prioridades sem sair do board.

## Problema

Times e makers perdem tempo organizando boards manualmente e priorizando tarefas sem contexto.

## Público

Pequenos times e freelancers que já usam kanban e querem IA no fluxo.

## Escopo MVP

### Inclui

- Boards / listas / cards
- Drag-and-drop
- Labels e prioridade
- Persistência local
- Assistente de IA (local + OpenAI opcional)

### Fora do MVP

- Power-Ups, calendário
- Automações complexas (Butler)
- App mobile nativo
- Colaboração em tempo real

## Requisitos funcionais

| ID | Requisito | Prioridade |
|----|-----------|------------|
| RF-01 | Criar e renomear boards | Must |
| RF-02 | Criar listas e cards | Must |
| RF-03 | Mover cards entre listas (DnD) | Must |
| RF-04 | Editar título, descrição e prioridade | Must |
| RF-05 | Assistente gera cards a partir de texto | Must |
| RF-06 | Assistente sugere prioridades | Should |
| RF-07 | Persistência entre reloads | Must |
| RF-08 | Gerenciar equipe do board | Must |
| RF-09 | Iniciar / agendar reunião virtual | Must |
| RF-10 | Entrar na sala com áudio/vídeo (Jitsi) | Must |

## Critérios de sucesso

- Usuário cria um board e move cards em < 2 minutos
- Um briefing gera ≥ 3 cards úteis via IA
- App roda localmente sem chave de API
