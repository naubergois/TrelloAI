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
  updateUser,
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

  it("lets any admin promote a user to admin", async () => {
    await ensureDefaultAdmin();
    const created = await createUser({
      username: "gestor",
      name: "Gestor ASESI",
      password: "senha1234",
      role: "user",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const promoted = await updateUser(created.user.id, { role: "admin" });
    expect(promoted.ok).toBe(true);
    if (!promoted.ok) return;
    expect(promoted.user.role).toBe("admin");
    expect(promoted.user.name).toBe("Gestor ASESI");

    const stored = await findUserByLogin("gestor");
    expect(stored?.role).toBe("admin");
    expect(verifyPassword(stored!, "senha1234")).toBe(true);
  });

  it("lets an admin edit name, username and password", async () => {
    await ensureDefaultAdmin();
    const created = await createUser({
      username: "ana",
      name: "Ana",
      password: "senha1234",
      role: "user",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const updated = await updateUser(created.user.id, {
      name: "Ana Silva",
      username: "ana.silva",
      password: "novaSenha9",
    });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.user.name).toBe("Ana Silva");
    expect(updated.user.username).toBe("ana.silva");
    expect(updated.user.role).toBe("user");

    const stored = await findUserByLogin("ana.silva");
    expect(stored?.name).toBe("Ana Silva");
    expect(verifyPassword(stored!, "novaSenha9")).toBe(true);
  });

  it("refuses to demote the last administrator", async () => {
    const admin = await ensureDefaultAdmin();
    expect(admin?.id).toBeTruthy();
    const result = await updateUser(admin!.id, { role: "user" });
    expect(result).toEqual({
      ok: false,
      error: "Não é possível remover o último administrador.",
    });
    expect((await findUserByEmail(DEFAULT_ADMIN_EMAIL))?.role).toBe("admin");
  });

  it("lets an admin demote another admin when more than one remains", async () => {
    const admin = await ensureDefaultAdmin();
    const created = await createUser({
      username: "segundo",
      name: "Segundo Admin",
      password: "senha1234",
      role: "admin",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const demoted = await updateUser(created.user.id, { role: "user" });
    expect(demoted.ok).toBe(true);
    if (!demoted.ok) return;
    expect(demoted.user.role).toBe("user");
    expect((await findUserByEmail(DEFAULT_ADMIN_EMAIL))?.role).toBe("admin");
    expect(admin?.role).toBe("admin");
  });
});
