import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createInvite, getInvite, isInviteValid } from "./invites";

describe("team invites", () => {
  const previousDir = process.env.USERS_DATA_DIR;
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "jangada-invites-"));
    process.env.USERS_DATA_DIR = tmp;
    delete process.env.PG_HOST;
    delete process.env.PG_DATABASE;
    delete process.env.PG_USER;
    delete process.env.PG_PASSWORD;
    delete process.env.DATABASE_URL;
  });

  afterEach(() => {
    if (previousDir === undefined) delete process.env.USERS_DATA_DIR;
    else process.env.USERS_DATA_DIR = previousDir;
    rmSync(tmp, { recursive: true, force: true });
  });

  it("stores a reusable team signup link", async () => {
    const invite = await createInvite({
      boardId: "board-1",
      boardTitle: "Engenharia",
      createdByEmail: "ana@cge.ce.gov.br",
      createdByName: "Ana",
      kind: "team",
      teamId: "team-eng",
      teamName: "Engenharia",
    });
    expect(invite.kind).toBe("team");
    expect(invite.teamId).toBe("team-eng");
    expect(isInviteValid(invite).ok).toBe(true);

    const loaded = await getInvite(invite.token);
    expect(loaded?.kind).toBe("team");
    expect(loaded?.teamName).toBe("Engenharia");
  });

  it("defaults older invites to board kind", async () => {
    const invite = await createInvite({
      boardId: "board-1",
      boardTitle: "Kanban",
      createdByEmail: "ana@cge.ce.gov.br",
      createdByName: "Ana",
    });
    expect(invite.kind).toBe("board");
    expect(invite.teamId).toBeNull();
  });
});
