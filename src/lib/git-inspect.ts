import fs from "node:fs";
import path from "node:path";
import type { GitInspectSummary } from "./types";
import { analyzeGitCoverage } from "./risk-analysis";

const SKIP_DIR = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".venv",
  "__pycache__",
  "coverage",
  ".turbo",
]);

function stripGitSuffix(value: string) {
  return value.replace(/\.git$/i, "").replace(/\/$/, "");
}

export function parseGitUrl(raw: string): {
  url: string;
  kind: "local" | "gitlab" | "github" | "generic";
  host?: string;
  project?: string;
  localPath?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Informe a URL ou o caminho do Git.");

  if (fs.existsSync(trimmed) && fs.statSync(trimmed).isDirectory()) {
    return { url: trimmed, kind: "local", localPath: trimmed };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
  } catch {
    throw new Error("URL Git inválida.");
  }

  const project = stripGitSuffix(parsed.pathname.replace(/^\//, ""));
  if (/github\.com$/i.test(parsed.host)) {
    return { url: parsed.toString(), kind: "github", host: parsed.host, project };
  }
  if (/gitlab|git\.cge/i.test(parsed.host)) {
    return { url: parsed.toString(), kind: "gitlab", host: parsed.host, project };
  }
  return { url: parsed.toString(), kind: "generic", host: parsed.host, project };
}

function walkLocal(root: string, limit = 250): string[] {
  const out: string[] = [];
  function walk(dir: string) {
    if (out.length >= limit) return;
    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (SKIP_DIR.has(entry.name) || entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      const rel = path.relative(root, full).replaceAll("\\", "/");
      if (entry.isDirectory()) walk(full);
      else out.push(rel);
    }
  }
  walk(root);
  return out;
}

function readReadme(root: string) {
  for (const name of ["README.md", "README.MD", "Readme.md", "README.txt"]) {
    const file = path.join(root, name);
    if (fs.existsSync(file)) {
      return fs.readFileSync(file, "utf8").slice(0, 6000);
    }
  }
  return "";
}

function hintsFrom(files: string[], readme: string) {
  const hints: string[] = [];
  if (files.some((f) => f.endsWith("package.json"))) hints.push("Node/Next");
  if (files.some((f) => f.includes("docker-compose"))) hints.push("Docker");
  if (files.some((f) => /\.py$/.test(f))) hints.push("Python");
  if (/next\.js|nextjs/i.test(readme)) hints.push("Next.js");
  if (/maya|jangada/i.test(readme)) hints.push("Jangada/Maya");
  return [...new Set(hints)].slice(0, 8);
}

async function fetchJson(url: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...headers },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status} ${text.slice(0, 160)}`);
  return JSON.parse(text) as unknown;
}

async function inspectGithub(project: string): Promise<{ files: string[]; readme: string }> {
  const [owner, repo] = project.split("/");
  if (!owner || !repo) throw new Error("Repositório GitHub inválido (owner/repo).");
  const tree = (await fetchJson(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    process.env.GITHUB_TOKEN
      ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
      : {},
  )) as { tree?: { path?: string; type?: string }[] };
  const files = (tree.tree || [])
    .filter((n) => n.type === "blob" && n.path)
    .map((n) => n.path as string)
    .slice(0, 250);
  let readme = "";
  try {
    const raw = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
      headers: {
        Accept: "application/vnd.github.raw",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
      cache: "no-store",
    });
    if (raw.ok) readme = (await raw.text()).slice(0, 6000);
  } catch {
    readme = "";
  }
  return { files, readme };
}

async function inspectGitlab(host: string, project: string): Promise<{ files: string[]; readme: string }> {
  const base = /cge\.local|localhost/i.test(host) ? `http://${host}` : `https://${host}`;
  const token = process.env.GITLAB_TOKEN || process.env.GITLAB_API_TOKEN || "";
  const headers: Record<string, string> = {};
  if (token) headers["PRIVATE-TOKEN"] = token;
  const encoded = encodeURIComponent(project);
  const tree = (await fetchJson(
    `${base}/api/v4/projects/${encoded}/repository/tree?recursive=true&per_page=100`,
    headers,
  )) as { path?: string; type?: string }[];
  const files = (Array.isArray(tree) ? tree : [])
    .filter((n) => n.type === "blob" && n.path)
    .map((n) => n.path as string)
    .slice(0, 250);
  let readme = "";
  try {
    const raw = await fetch(
      `${base}/api/v4/projects/${encoded}/repository/files/${encodeURIComponent("README.md")}/raw?ref=HEAD`,
      { headers, cache: "no-store" },
    );
    if (raw.ok) readme = (await raw.text()).slice(0, 6000);
  } catch {
    readme = "";
  }
  return { files, readme };
}

function localWorkspaceFallback(url: string): string | null {
  const cwd = process.cwd();
  if (!/jangada|trelloai/i.test(url)) return null;
  if (fs.existsSync(path.join(cwd, "package.json"))) return cwd;
  return null;
}

export async function inspectGitRepo(
  rawUrl: string,
  boardItems: {
    cards: { id: string; title: string }[];
    requirements: { id: string; title: string; code?: string }[];
  },
): Promise<GitInspectSummary> {
  const parsed = parseGitUrl(rawUrl);
  let files: string[] = [];
  let readme = "";
  let error: string | undefined;
  let kind = parsed.kind;

  try {
    if (parsed.kind === "local" && parsed.localPath) {
      files = walkLocal(parsed.localPath);
      readme = readReadme(parsed.localPath);
    } else if (parsed.kind === "github" && parsed.project) {
      const gh = await inspectGithub(parsed.project);
      files = gh.files;
      readme = gh.readme;
    } else if (parsed.kind === "gitlab" && parsed.host && parsed.project) {
      try {
        const gl = await inspectGitlab(parsed.host, parsed.project);
        files = gl.files;
        readme = gl.readme;
      } catch (err) {
        const fallback = parsed.localPath || localWorkspaceFallback(parsed.url);
        if (fallback) {
          kind = "local";
          files = walkLocal(fallback);
          readme = readReadme(fallback);
        } else {
          throw err;
        }
      }
    } else {
      const fallback = localWorkspaceFallback(parsed.url);
      if (fallback) {
        kind = "local";
        files = walkLocal(fallback);
        readme = readReadme(fallback);
      } else {
        throw new Error("Não foi possível listar os arquivos deste Git.");
      }
    }
  } catch (err) {
    const fallback = localWorkspaceFallback(parsed.url);
    if (fallback) {
      kind = "local";
      files = walkLocal(fallback);
      readme = readReadme(fallback);
    } else {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  const coverage = analyzeGitCoverage({
    cards: boardItems.cards,
    requirements: boardItems.requirements,
    files,
    readmeExcerpt: readme,
  });

  return {
    url: parsed.url,
    ok: !error && files.length > 0,
    error,
    kind,
    fileCount: files.length,
    files: files.slice(0, 120),
    readmeExcerpt: readme.slice(0, 2500) || undefined,
    hints: hintsFrom(files, readme),
    coverage,
  };
}
