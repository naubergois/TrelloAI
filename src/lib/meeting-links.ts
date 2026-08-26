export type MeetingLinkKind = "meet" | "teams" | "jitsi" | "zoom" | "generic";

const URL_IN_TEXT = /(?:https?:\/\/[^\s<>"'()]+|msteams:[^\s<>"'()]+)/gi;

function looksLikeMeetingHost(host: string) {
  const h = host.replace(/^www\./, "").toLowerCase();
  return (
    h === "meet.google.com" ||
    h.endsWith(".meet.google.com") ||
    h === "teams.microsoft.com" ||
    h === "teams.live.com" ||
    h === "teams.office.com" ||
    h.endsWith(".teams.microsoft.com") ||
    h === "meet.jit.si" ||
    h.endsWith(".zoom.us") ||
    h === "zoom.us" ||
    h === "zoom.com"
  );
}

export function sanitizeMeetingUrl(raw: string | null | undefined): string | null {
  let value = (raw || "").trim();
  if (!value) return null;
  if (/^(meet\.google\.com|teams\.(microsoft|live|office)\.com)\//i.test(value)) {
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    const proto = parsed.protocol.toLowerCase();
    if (proto === "https:" || proto === "http:" || proto === "msteams:") {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

export function meetingLinkKind(url: string | null | undefined): MeetingLinkKind | null {
  const href = sanitizeMeetingUrl(url);
  if (!href) return null;
  try {
    const parsed = new URL(href);
    if (parsed.protocol.toLowerCase() === "msteams:") return "teams";
    const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
    if (host === "meet.google.com" || host.endsWith(".meet.google.com")) return "meet";
    if (
      host === "teams.microsoft.com" ||
      host === "teams.live.com" ||
      host === "teams.office.com" ||
      host.endsWith(".teams.microsoft.com")
    ) {
      return "teams";
    }
    if (host === "meet.jit.si" || host.endsWith(".jit.si")) return "jitsi";
    if (host === "zoom.us" || host.endsWith(".zoom.us") || host === "zoom.com") {
      return "zoom";
    }
    return "generic";
  } catch {
    return "generic";
  }
}

export function meetingLinkLabel(kind: MeetingLinkKind | null) {
  if (kind === "meet") return "Google Meet";
  if (kind === "teams") return "Microsoft Teams";
  if (kind === "jitsi") return "Jitsi";
  if (kind === "zoom") return "Zoom";
  if (kind === "generic") return "Reunião";
  return "Reunião";
}

export function meetingJoinLabel(kind: MeetingLinkKind | null) {
  if (kind === "meet") return "Entrar no Meet";
  if (kind === "teams") return "Entrar no Teams";
  if (kind === "jitsi") return "Entrar no Jitsi";
  if (kind === "zoom") return "Entrar no Zoom";
  return "Entrar na reunião";
}

export function extractMeetingUrlFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_IN_TEXT) || [];
  const cleaned = matches
    .map((m) => sanitizeMeetingUrl(m.replace(/[.,;:!?)]+$/, "")))
    .filter((u): u is string => Boolean(u));
  const preferred = cleaned.find((url) => {
    try {
      const parsed = new URL(url);
      if (parsed.protocol.toLowerCase() === "msteams:") return true;
      return looksLikeMeetingHost(parsed.hostname);
    } catch {
      return false;
    }
  });
  return preferred || cleaned[0] || null;
}

export function resolveEventMeetingUrl(event: {
  meetingUrl?: string | null;
  description?: string | null;
}): string | null {
  return (
    sanitizeMeetingUrl(event.meetingUrl) ||
    extractMeetingUrlFromText(event.description)
  );
}
