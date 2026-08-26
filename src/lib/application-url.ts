/** URL pública ou interna da aplicação ligada ao projeto. */

export function sanitizeApplicationUrl(raw: string | null | undefined): string | null {
  let value = (raw || "").trim();
  if (!value) return null;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(value)) {
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    const proto = parsed.protocol.toLowerCase();
    if (proto !== "https:" && proto !== "http:") return null;
    if (!parsed.hostname) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function applicationUrlLabel(url: string | null | undefined): string {
  const href = sanitizeApplicationUrl(url);
  if (!href) return "";
  try {
    const parsed = new URL(href);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    return `${parsed.host}${path}${parsed.search}`.replace(/\/$/, "") || href;
  } catch {
    return href;
  }
}
