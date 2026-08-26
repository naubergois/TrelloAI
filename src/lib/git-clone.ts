import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { MAYA_GIT_INTERVAL_MS } from "@/lib/constants";

const BLOCKED_HOSTS = new Set(["169.254.169.254", "metadata.google.internal"]);

export function shouldRefreshClone(
  lastClonedAt?: string | null,
  now = Date.now(),
  intervalMs = MAYA_GIT_INTERVAL_MS,
) {
  if (!lastClonedAt) return true;
  const ts = Date.parse(lastClonedAt);
  if (Number.isNaN(ts)) return true;
  return now - ts >= intervalMs;
}

export function isCloneableGitUrl(raw: string) {
  try {
    const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host)) return false;
    if (host === "localhost" || host.endsWith(".localhost")) return false;
    return Boolean(parsed.hostname);
  } catch {
    return false;
  }
}

export function authenticatedCloneUrl(raw: string, token?: string) {
  const parsed = new URL(raw.includes("://") ? raw : `https://${raw}`);
  if (token && !parsed.username) {
    parsed.username = "oauth2";
    parsed.password = token;
  }
  return parsed.toString();
}

export function redactGitText(text: string) {
  return text.replace(/oauth2:[^@\s]+@/gi, "oauth2:***@").replace(/glpat-[A-Za-z0-9_-]+/g, "glpat-***");
}

export function cloneDestination(url: string) {
  const hash = createHash("sha1").update(url).digest("hex").slice(0, 16);
  return path.join(os.tmpdir(), "jangada-git", hash);
}

function runGit(args: string[], cwd?: string, timeoutMs = 180_000) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn("git", args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    });
    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      if (stderr.length > 4000) stderr = stderr.slice(-4000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("Tempo esgotado no git clone."));
    }, timeoutMs);
    child.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(redactGitText(stderr.trim() || `git saiu com código ${code}`)));
    });
  });
}

export async function cloneGitRepo(rawUrl: string): Promise<{ root: string; cleanup: () => void }> {
  if (!isCloneableGitUrl(rawUrl)) {
    throw new Error("URL Git não permitida para clone.");
  }
  const token = process.env.GITLAB_TOKEN || process.env.GITLAB_API_TOKEN || "";
  const authUrl = authenticatedCloneUrl(rawUrl, token || undefined);
  const root = cloneDestination(rawUrl);
  fs.rmSync(root, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(root), { recursive: true });
  await runGit(["clone", "--depth", "1", "--single-branch", authUrl, root]);
  return {
    root,
    cleanup: () => {
      try {
        fs.rmSync(root, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    },
  };
}
