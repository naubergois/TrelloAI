import { createHash, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { isPgConfigured, pgFindUserByEmail, pgInsertUser } from "@/lib/storage/pg";

export type StoredUser = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
};

type UsersFile = { users: StoredUser[] };

function usersFilePath() {
  const dir = process.env.USERS_DATA_DIR || path.join(process.cwd(), "data");
  return path.join(dir, "users.json");
}

function readUsers(): StoredUser[] {
  const file = usersFilePath();
  if (!existsSync(file)) return [];
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as UsersFile;
    return Array.isArray(parsed.users) ? parsed.users : [];
  } catch {
    return [];
  }
}

function writeUsers(users: StoredUser[]) {
  const file = usersFilePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify({ users }, null, 2), "utf8");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

export async function findUserByEmail(email: string): Promise<StoredUser | undefined> {
  const normalized = normalizeEmail(email);
  if (isPgConfigured()) {
    return pgFindUserByEmail(normalized);
  }
  return readUsers().find((u) => u.email === normalized);
}

export function verifyPassword(user: StoredUser, password: string): boolean {
  const hash = hashPassword(password, user.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(user.passwordHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function createUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ ok: true; user: Omit<StoredUser, "passwordHash" | "salt"> } | { ok: false; error: string }> {
  const email = normalizeEmail(input.email);
  const name = input.name.trim();
  const password = input.password;

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Informe um e-mail válido." };
  }
  if (name.length < 2) {
    return { ok: false, error: "Informe um nome com pelo menos 2 caracteres." };
  }
  if (password.length < 8) {
    return { ok: false, error: "A senha deve ter pelo menos 8 caracteres." };
  }
  if (await findUserByEmail(email)) {
    return { ok: false, error: "Já existe uma conta com este e-mail." };
  }

  const salt = randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);
  const id = createHash("sha256").update(`${email}:${Date.now()}`).digest("hex").slice(0, 24);

  const user: StoredUser = {
    id,
    email,
    name,
    passwordHash,
    salt,
    createdAt: new Date().toISOString(),
  };

  if (isPgConfigured()) {
    try {
      await pgInsertUser(user);
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code === "23505") {
        return { ok: false, error: "Já existe uma conta com este e-mail." };
      }
      throw err;
    }
    return { ok: true, user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } };
  }

  const users = readUsers();
  users.push(user);
  writeUsers(users);

  return { ok: true, user: { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt } };
}
