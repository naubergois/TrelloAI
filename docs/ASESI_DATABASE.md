# Banco ASESI (`h_asesi`)

O Jangada persiste boards, membros, usuários e convites no PostgreSQL operacional da ASESI — o mesmo servidor do Farol — em um **schema próprio** para não misturar dados.

O nome técnico do schema permanece `trelloai` (já criado no servidor). O produto na UI e no health check é **Jangada**.

| Item | Valor |
|------|--------|
| Host | `192.168.3.26` |
| Porta | `5432` |
| Banco | `h_asesi` |
| Schema | `trelloai` (isolado do schema `farol`) |
| SSL | desligado na rede interna (`PG_SSL=0`) |

## Variáveis

Copie `.env.example` para `.env.local` (dev) ou `docker/env.homolog.example` para `.env.homolog` (homolog) e preencha a senha (a mesma do Farol, `PG_PASSWORD`):

```
PG_HOST=192.168.3.26
PG_PORT=5432
PG_DATABASE=h_asesi
PG_USER=postgres
PG_PASSWORD=
PG_SCHEMA=trelloai
PG_SSL=0
```

Também vale `DATABASE_URL=postgres://usuario:senha@192.168.3.26:5432/h_asesi` — o schema continua vindo de `PG_SCHEMA`.

## Bootstrap

Na primeira conexão o app executa `CREATE SCHEMA IF NOT EXISTS trelloai`, cria as tabelas e insere o board oficial `asesi` se ainda não existir.

```bash
npm run db:ensure
```

O health check `/api/health` reporta `service: "jangada"`, `database.reachable` e `database.schema`.

## Rede

`192.168.3.26` é endereço interno da CGE. O app precisa rodar na rede da ASESI (ou VPN). O AWS App Runner na internet pública **não alcança** esse host sem VPN/Direct Connect. Homologação CGE usa Swarm na rede interna; injete `PG_*` no serviço.

DDL de referência: `infra/asesi-schema.sql`.
