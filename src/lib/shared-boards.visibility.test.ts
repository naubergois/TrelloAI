import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createOfficialHierarchySnapshots } from "./asesi-seed";
import {
  getVisibleBoardPreference,
  listBoardCatalog,
  listBoardsForHome,
  saveSharedBoard,
  setVisibleBoards,
} from "./shared-boards";

describe("per-user board visibility", () => {
  const previousDir = process.env.USERS_DATA_DIR;
  const pgKeys = ["PG_HOST", "PG_DATABASE", "PG_USER", "PG_PASSWORD", "DATABASE_URL"] as const;
  const previousPg = Object.fromEntries(pgKeys.map((key) => [key, process.env[key]]));
  let tmp: string;

  beforeEach(async () => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "jangada-visibility-"));
    process.env.USERS_DATA_DIR = tmp;
    for (const key of pgKeys) delete process.env[key];
    for (const snapshot of createOfficialHierarchySnapshots({
      name: "Admin",
      email: "admin@cge.ce.gov.br",
    })) {
      await saveSharedBoard(snapshot);
    }
  });

  afterEach(() => {
    if (previousDir === undefined) delete process.env.USERS_DATA_DIR;
    else process.env.USERS_DATA_DIR = previousDir;
    for (const key of pgKeys) {
      const value = previousPg[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(tmp, { recursive: true, force: true });
  });

  it("shows every accessible board until the user saves a choice", async () => {
    const email = "admin@cge.ce.gov.br";
    expect(await getVisibleBoardPreference(email)).toBeNull();
    const home = await listBoardsForHome(email, true);
    expect(home.map((s) => s.board.id).sort()).toEqual(["asesi", "cge"]);

    const catalog = await listBoardCatalog(email, true);
    expect(catalog.every((b) => b.selected)).toBe(true);
  });

  it("keeps only the boards the user selected", async () => {
    const email = "admin@cge.ce.gov.br";
    const saved = await setVisibleBoards(email, ["asesi", "ghost"], true);
    expect(saved.boardIds).toEqual(["asesi"]);
    expect(saved.snapshots.map((s) => s.board.id)).toEqual(["asesi"]);

    expect(await getVisibleBoardPreference(email)).toEqual(["asesi"]);
    const home = await listBoardsForHome(email, true);
    expect(home.map((s) => s.board.id)).toEqual(["asesi"]);

    const catalog = await listBoardCatalog(email, true);
    expect(catalog.find((b) => b.id === "asesi")?.selected).toBe(true);
    expect(catalog.find((b) => b.id === "cge")?.selected).toBe(false);
  });

  it("lists every board of a team even when the person is only on one snapshot", async () => {
    const charles = "charles.marques@cge.ce.gov.br";
    const now = "2026-01-01T00:00:00.000Z";
    const member = {
      id: "c1",
      name: "Charles",
      email: charles,
      role: "member" as const,
      color: "sky" as const,
      createdAt: now,
    };
    await saveSharedBoard({
      board: {
        id: "mandacaru",
        title: "Mandacaru",
        description: "",
        listIds: [],
        memberIds: ["c1"],
        teamId: "asesi-team",
        level: "project",
        parentBoardId: "asesi",
        backgroundId: "trello",
        designId: "classic",
        createdAt: now,
        updatedAt: now,
      },
      lists: {},
      cards: {},
      members: { c1: member },
      teams: {
        "asesi-team": {
          id: "asesi-team",
          name: "ASESI",
          description: "",
          memberIds: ["c1"],
          color: "teal",
          createdAt: now,
          updatedAt: now,
        },
      },
      meetings: {},
      managers: {},
      standups: {},
      activities: {},
      requirements: {},
      calendarEvents: {},
      updatedAt: now,
    });
    await saveSharedBoard({
      board: {
        id: "farol",
        title: "Farol",
        description: "",
        listIds: [],
        memberIds: ["admin"],
        teamId: "asesi-team",
        level: "project",
        parentBoardId: "asesi",
        backgroundId: "trello",
        designId: "classic",
        createdAt: now,
        updatedAt: now,
      },
      lists: {},
      cards: {},
      members: {},
      teams: {
        "asesi-team": {
          id: "asesi-team",
          name: "ASESI",
          description: "",
          memberIds: ["admin"],
          color: "teal",
          createdAt: now,
          updatedAt: now,
        },
      },
      meetings: {},
      managers: {},
      standups: {},
      activities: {},
      requirements: {},
      calendarEvents: {},
      updatedAt: now,
    });

    const catalog = await listBoardCatalog(charles, false);
    expect(catalog.map((b) => b.id).sort()).toEqual(["asesi", "cge", "farol", "mandacaru"]);
  });
});
