#!/usr/bin/env node
/**
 * MCP stdio do Jangada — Cursor e Kiro alimentam o mesmo Postgres/arquivo.
 * Protocolo: Content-Length (oficial) e JSON por linha (compatível com Cacimba).
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  callTool,
  createFileStore,
  createPgStore,
  listTools,
  loadEnvFile,
  pgConfigured,
} from "./jangada-mcp-tools.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
loadEnvFile(root, ".env.local");
loadEnvFile(root, ".env");

const store = pgConfigured() ? createPgStore(root) : createFileStore(root);

function send(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  process.stdout.write(`Content-Length: ${json.length}\r\n\r\n`);
  process.stdout.write(json);
}

function sendResult(id, result) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, result });
}

function sendError(id, code, message) {
  if (id === undefined || id === null) return;
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(req) {
  if (!req || typeof req !== "object") return;
  const { id, method, params } = req;
  if (!method) return;

  if (method === "initialize") {
    sendResult(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "jangada", version: "0.1.0" },
      instructions:
        "Kanban Jangada (ASESI/CGE). Use jangada_criar_card / jangada_anexar_arquivo / jangada_mover_card para Cursor e Kiro alimentarem o mesmo board. Board padrão: asesi.",
    });
    return;
  }

  if (method === "notifications/initialized" || method === "initialized") return;
  if (method === "ping") {
    sendResult(id, {});
    return;
  }

  if (method === "tools/list") {
    sendResult(id, { tools: listTools() });
    return;
  }

  if (method === "tools/call") {
    const name = params?.name;
    const arguments_ = params?.arguments || {};
    const data = await callTool(name, arguments_, store);
    sendResult(id, {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      isError: Boolean(data && data.status === "erro"),
    });
    return;
  }

  sendError(id, -32601, `Method not found: ${method}`);
}

async function readStdin() {
  let buf = Buffer.alloc(0);
  for await (const chunk of process.stdin) {
    buf = Buffer.concat([buf, Buffer.from(chunk)]);
    while (buf.length) {
      if (buf[0] === 0x7b) {
        const end = buf.indexOf(0x0a);
        if (end === -1) break;
        const line = buf.slice(0, end).toString("utf8").trim();
        buf = buf.slice(end + 1);
        if (!line) continue;
        try {
          await handle(JSON.parse(line));
        } catch (err) {
          process.stderr.write(`[jangada-mcp] JSON inválido: ${err}\n`);
        }
        continue;
      }

      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = buf.slice(0, headerEnd).toString("utf8");
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(match[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) break;
      const body = buf.slice(start, start + len).toString("utf8");
      buf = buf.slice(start + len);
      try {
        await handle(JSON.parse(body));
      } catch (err) {
        process.stderr.write(`[jangada-mcp] mensagem inválida: ${err}\n`);
      }
    }
  }
}

process.stdin.on("end", () => {
  store.close?.().catch(() => {});
});

readStdin().catch((err) => {
  process.stderr.write(`[jangada-mcp] ${err instanceof Error ? err.stack : err}\n`);
  process.exit(1);
});
