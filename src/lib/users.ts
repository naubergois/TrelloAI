import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import {
  isPgConfigured,
  pgEnsureUsername,
  pgFindUserByEmail,
  pgFindUserByLogin,
  pgInsertUser,
  pgListUsers,
} from "@/lib/storage/pg";

export type UserRole = "admin" | "user";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
  role: UserRole;
  username: string;
};

export type PublicUser = Omit<StoredUser, "passwordHash" | "salt">;

export const DEFAULT_ADMIN_EMAIL = "admin@cge.ce.gov.br";
export const DEFAULT_ADMIN_PASSWORD = "Jangada@Admin";
export const DEFAULT_ADMIN_NAME = "Administrador";
export const DEFAULT_ADMIN_USERNAME = "admin";
export const DEFAULT_USER_DOMAIN = "cge.ce.gov.br";

type UsersFile = { users: StoredUser[] };

function usersFilePath() {
  const dir = process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "users.json");
}

function normalizeRole(role: unknown): UserRole {
  return role === "admin" ? "admin" : "user";
}

function withDefaults(user: StoredUser): StoredUser {
  const email = normalizeEmail(user.email);
  return {
    ...user,
    email,
    role: normalizeRole(user.role),
    username: normalizeUsername(user.username || email.split("@")[0] || email),
  };
}

function toPublic(user: StoredUser): PublicUser {
  const full = withDefaults(user);
  return {
    id: full.id,
    email: full.email,
    name: full.name,
    createdAt: full.createdAt,
    role: full.role,
    username: full.username,
  };
}

function readUsers(): StoredUser[] {
  const file = usersFilePath();
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as UsersFile;
    return Array.isArray(parsed.users) ? parsed.users.map(withDefaults) : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  const file = usersFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ users }, null, 2), "utf8");
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
}

export function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export function getAdminSeed() {
  const email = normalizeEmail(process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const name = (process.env.ADMIN_NAME || DEFAULT_ADMIN_NAME).trim() || DEFAULT_ADMIN_NAME;
  const username =
    normalizeUsername(process.env.ADMIN_USERNAME || DEFAULT_ADMIN_USERNAME) ||
    normalizeUsername(email.split("@")[0] || DEFAULT_ADMIN_USERNAME);
  return { email, password, name, username };
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const normalized = normalizeEmail(email);
  if (isPgConfigured()) {
    const user = await pgFindUserByEmail(normalized);
    return user ? withDefaults(user) : undefined;
  }
  return readUsers().find((u) => u.email === normalized);
}

export async function findUserByLogin(login: string): Promise<StoredUser | undefined> {
  const raw = login.trim().toLowerCase();
  if (!raw) return undefined;
  if (isPgConfigured()) {
    const user = await pgFindUserByLogin(raw);
    return user ? withDefaults(user) : undefined;
  }
  const username = normalizeUsername(raw.includes("@") ? raw.split("@")[0] : raw);
  return readUsers().find(
    (u) =>
      u.email === raw ||
      u.username === username ||
      u.email.split("@")[0] === username,
  );
}

export async function listUsers(): Promise<PublicUser[]> {
  if (isPgConfigured()) {
    const users = await pgListUsers();
    return users.map((u) => toPublic(withDefaults(u)));
  }
  return readUsers().map(toPublic);
}

export function verifyPassword(user: StoredUser, password: string): boolean {
  const hash = hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createUser(input: {
  email?: string;
  username?: string;
  name: string;
  password: string;
  role?: UserRole;
}): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }> {
  const name = input.name.trim();
  const password = input.password;
  const role = normalizeRole(input.role);
  const username = normalizeUsername(input.username || (input.email || "").split("@")[0] || "");
  const email = normalizeEmail(
    input.email?.trim() || (username ? `${username}@${DEFAULT_USER_DOMAIN}` : ""),
  );

  if (!username || username.length < 2) {
    return { ok: false, error: "Informe um usuário com pelo menos 2 caracteres." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Informe um e-mail válido ou um usuário." };
  }
  if (name.length < 2) {
    return { ok: false, error: "Informe um nome com pelo menos 2 caracteres." };
  }
  if (password.length < 8) {
    return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (await findUserByLogin(username) || await findUserByEmail(email)) {
    return { ok: false, error: "Já existe uma conta com este usuário ou e-mail." };
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const id = createHash("sha256").update(`${email}:${Date.now()}`).digest("hex").slice(0, 24);

  const user: StoredUser = {
    id,
    email,
    username,
    name,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    role,
  };

  if (isPgConfigured()) {
    try {
      await pgInsertUser(user);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "23505") {
        return { ok: false, error: "Já existe uma conta com este usuário ou e-mail." };
      }
      throw err;
    }
    return { ok: true, user: toPublic(user) };
  }

  const users = readUsers();
  users.push(user);
  writeUsers(users);

  return { ok: true, user: toPublic(user) };
}

let adminSeed: Promise<PublicUser | null> | null = null;

export function resetAdminSeedCache() {
  adminSeed = null;
}

export function ensureDefaultAdmin() {
  if (!adminSeed) {
    adminSeed = seedDefaultAdmin().catch((err) => {
      adminSeed = null;
      throw err;
    });
  }
  return adminSeed;
}

export async function ensureDefaultAdminSafe() {
  try {
    return await ensureDefaultAdmin();
  } catch {
    return null;
  }
}

async function seedDefaultAdmin(): Promise<PublicUser | null> {
  const seed = getAdminSeed();
  const existing = (await findUserByEmail(seed.email)) || (await findUserByLogin(seed.username));
  if (existing) {
    if (isPgConfigured()) {
      await pgEnsureUsername(existing.email, seed.username);
    }
    return toPublic({ ...existing, username: existing.username || seed.username });
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(seed.password, salt);
  const user: StoredUser = {
    id: createHash("sha256").update(`jangada-admin:${seed.email}`).digest("hex").slice(0, 24),
    email: seed.email,
    username: seed.username,
    name: seed.name,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
    role: "admin",
  };

  if (isPgConfigured()) {
    try {
      await pgInsertUser(user);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "23505") {
        const again = await findUserByEmail(seed.email);
        return again ? toPublic(again) : null;
      }
      throw err;
    }
    return toPublic(user);
  }

  const users = readUsers();
  if (users.some((u) => u.email === seed.email)) {
    return toPublic(users.find((u) => u.email === seed.email)!);
  }
  users.push(user);
  writeUsers(users);
  return toPublic(user);
}
