import { describe, expect, it } from "vitest";
import {
  extractMeetingUrlFromText,
  meetingJoinLabel,
  meetingLinkKind,
  resolveEventMeetingUrl,
  sanitizeMeetingUrl,
} from "./meeting-links";

describe("meeting links", () => {
  it("accepts Meet and Teams https urls", () => {
    expect(
      sanitizeMeetingUrl("https://meet.google.com/abc-defg-hij"),
    ).toBe("https://meet.google.com/abc-defg-hij");
    expect(
      meetingLinkKind(
        "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc",
      ),
    ).toBe("teams");
    expect(meetingLinkKind("https://meet.google.com/abc-defg-hij")).toBe("meet");
    expect(meetingJoinLabel("teams")).toBe("Entrar no Teams");
  });

  it("accepts bare hosts and msteams protocol", () => {
    expect(sanitizeMeetingUrl("meet.google.com/abc-defg-hij")).toBe(
      "https://meet.google.com/abc-defg-hij",
    );
    expect(meetingLinkKind("msteams://teams.microsoft.com/l/meetup-join/x")).toBe(
      "teams",
    );
  });

  it("rejects dangerous schemes", () => {
    expect(sanitizeMeetingUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeMeetingUrl("data:text/html,hi")).toBeNull();
  });

  it("extracts a Teams link from the description", () => {
    const url = extractMeetingUrlFromText(
      "Sala 3. Link: https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc veja também o board.",
    );
    expect(url).toContain("teams.microsoft.com");
    expect(
      resolveEventMeetingUrl({
        meetingUrl: null,
        description: "Meet: https://meet.google.com/aaa-bbbb-ccc",
      }),
    ).toBe("https://meet.google.com/aaa-bbbb-ccc");
  });

  it("prefers the dedicated field over the description", () => {
    expect(
      resolveEventMeetingUrl({
        meetingUrl: "https://teams.live.com/meet/abc",
        description: "https://meet.google.com/aaa-bbbb-ccc",
      }),
    ).toBe("https://teams.live.com/meet/abc");
  });
});
