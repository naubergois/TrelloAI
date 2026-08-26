import { mkdtempSync, rmSync } from "fs";
import os from "os";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_PASSWORD,
  createUser,
  ensureDefaultAdmin,
  findUserByEmail,
  findUserByLogin,
  getAdminSeed,
  hashPassword,
  listUsers,
  resetAdminSeedCache,
  verifyPassword,
} from "./users";

describe("admin seed and passwords", () => {
  const previousDir = process.env.USERS_DATA_DIR;
  let tmp: string;

  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), "jangada-users-"));
    process.env.USERS_DATA_DIR = tmp;
    resetAdminSeedCache();
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;
    delete process.env.ADMIN_NAME;
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

  it("uses the default admin identity", () => {
    expect(getAdminSeed()).toEqual({
      email: DEFAULT_ADMIN_EMAIL,
      password: DEFAULT_ADMIN_PASSWORD,
      name: "Administrador",
      username: "admin",
    });
  });

  it("hashes and verifies passwords", () => {
    const salt = "abc123";
    const hash = hashPassword("Jangada@Admin", salt);
    expect(verifyPassword({ passwordHash: hash, salt } as never, "Jangada@Admin")).toBe(true);
    expect(verifyPassword({ passwordHash: hash, salt } as never, "outra")).toBe(false);
  });

  it("creates the default admin once", async () => {
    const first = await ensureDefaultAdmin();
    const second = await ensureDefaultAdmin();
    expect(first?.email).toBe(DEFAULT_ADMIN_EMAIL);
    expect(first?.role).toBe("admin");
    expect(second?.id).toBe(first?.id);

    expect(first?.username).toBe("admin");
    const stored = await findUserByEmail(DEFAULT_ADMIN_EMAIL);
    expect(stored).toBeTruthy();
    expect(verifyPassword(stored!, DEFAULT_ADMIN_PASSWORD)).toBe(true);
  });

  it("finds the admin by username", async () => {
    await ensureDefaultAdmin();
    const byName = await findUserByLogin("admin");
    expect(byName?.email).toBe(DEFAULT_ADMIN_EMAIL);
  });

  it("lets the admin create another user", async () => {
    await ensureDefaultAdmin();
    const created = await createUser({
      username: "pessoa",
      name: "Pessoa ASESI",
      password: "senha1234",
      role: "user",
    });
    expect(created.ok).toBe(true);
    const users = await listUsers();
    expect(users.map((u) => u.email).sort()).toEqual([
      DEFAULT_ADMIN_EMAIL,
      "pessoa@cge.ce.gov.br",
    ]);
  });
});
