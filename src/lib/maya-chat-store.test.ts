import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  deleteMayaChatsForBoard,
  deleteMayaDayChatForUser,
  listMayaChatsForUser,
  saveMayaChatsForUser,
} from "./maya-chat-store";
import type { MayaDayLog } from "./types";

function log(over: Partial<MayaDayLog> & Pick<MayaDayLog, "boardId" | "date">): MayaDayLog {
  return {
    id: `${over.boardId}:${over.date}`,
    messages: [
      {
        id: "m1",
        role: "member",
        memberId: "ana",
        content: "oi Maya",
        createdAt: "2026-08-26T12:00:00.000Z",
      },
    ],
    updatedAt: "2026-08-26T12:00:00.000Z",
    ...over,
  };
}

describe("maya chat store per user", () => {
  const previous = {
    dir: process.env.USERS_DATA_DIR,
    pgHost: process.env.PG_HOST,
    pgDatabase: process.env.PG_DATABASE,
    pgUser: process.env.PG_USER,
    pgPassword: process.env.PG_PASSWORD,
    databaseUrl: process.env.DATABASE_URL,
  };
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "jangada-maya-"));
    process.env.USERS_DATA_DIR = tmp;
    delete process.env.PG_HOST;
    delete process.env.PG_DATABASE;
    delete process.env.PG_USER;
    delete process.env.PG_PASSWORD;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (previous.dir === undefined) delete process.env.USERS_DATA_DIR;
    else process.env.USERS_DATA_DIR = previous.dir;
    if (previous.pgHost === undefined) delete process.env.PG_HOST;
    else process.env.PG_HOST = previous.pgHost;
    if (previous.pgDatabase === undefined) delete process.env.PG_DATABASE;
    else process.env.PG_DATABASE = previous.pgDatabase;
    if (previous.pgUser === undefined) delete process.env.PG_USER;
    else process.env.PG_USER = previous.pgUser;
    if (previous.pgPassword === undefined) delete process.env.PG_PASSWORD;
    else process.env.PG_PASSWORD = previous.pgPassword;
    if (previous.databaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previous.databaseUrl;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("keeps chats isolated by email", async () => {
    await saveMayaChatsForUser("ana@cge.ce.gov.br", [log({ boardId: "asesi", date: "2026-08-26" })]);
    await saveMayaChatsForUser("bruno@cge.ce.gov.br", [
      log({
        boardId: "asesi",
        date: "2026-08-26",
        messages: [
          {
            id: "b1",
            role: "member",
            memberId: "bruno",
            content: "sou o Bruno",
            createdAt: "2026-08-26T13:00:00.000Z",
          },
        ],
      }),
    ]);

    const ana = await listMayaChatsForUser("ANA@cge.ce.gov.br", { boardId: "asesi" });
    const bruno = await listMayaChatsForUser("bruno@cge.ce.gov.br", { boardId: "asesi" });
    expect(ana["asesi:2026-08-26"].messages[0].content).toBe("oi Maya");
    expect(bruno["asesi:2026-08-26"].messages[0].content).toBe("sou o Bruno");
  });

  it("seeds once from the legacy board snapshot and then ignores it", async () => {
    const legacy = {
      "asesi:2026-08-25": log({ boardId: "asesi", date: "2026-08-25", id: "asesi:2026-08-25" }),
    };
    const first = await listMayaChatsForUser("ana@cge.ce.gov.br", {
      boardId: "asesi",
      legacyLogs: legacy,
    });
    expect(first["asesi:2026-08-25"].messages[0].content).toBe("oi Maya");

    await saveMayaChatsForUser("ana@cge.ce.gov.br", [
      log({
        boardId: "asesi",
        date: "2026-08-26",
        messages: [
          {
            id: "new",
            role: "member",
            memberId: "ana",
            content: "conversa nova",
            createdAt: "2026-08-26T15:00:00.000Z",
          },
        ],
      }),
    ]);

    const again = await listMayaChatsForUser("ana@cge.ce.gov.br", {
      boardId: "asesi",
      legacyLogs: {
        "asesi:2026-08-25": log({
          boardId: "asesi",
          date: "2026-08-25",
          messages: [
            {
              id: "other",
              role: "member",
              memberId: "x",
              content: "não deve entrar",
              createdAt: "2026-08-25T10:00:00.000Z",
            },
          ],
        }),
      },
    });
    expect(again["asesi:2026-08-25"].messages[0].content).toBe("oi Maya");
    expect(again["asesi:2026-08-26"].messages[0].content).toBe("conversa nova");
  });

  it("drops chats when the board is deleted", async () => {
    await saveMayaChatsForUser("ana@cge.ce.gov.br", [
      log({ boardId: "asesi", date: "2026-08-26" }),
      log({ boardId: "keep", date: "2026-08-26" }),
    ]);
    await deleteMayaChatsForBoard("asesi");
    const logs = await listMayaChatsForUser("ana@cge.ce.gov.br");
    expect(Object.keys(logs)).toEqual(["keep:2026-08-26"]);
  });

  it("deletes a single day conversation for that user", async () => {
    await saveMayaChatsForUser("ana@cge.ce.gov.br", [
      log({ boardId: "asesi", date: "2026-08-25" }),
      log({ boardId: "asesi", date: "2026-08-26" }),
    ]);
    await deleteMayaDayChatForUser("ana@cge.ce.gov.br", "asesi", "2026-08-25");
    const logs = await listMayaChatsForUser("ana@cge.ce.gov.br", { boardId: "asesi" });
    expect(Object.keys(logs)).toEqual(["asesi:2026-08-26"]);
  });
});
