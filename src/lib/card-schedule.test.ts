import { describe, expect, it } from "vitest";
import {
  daysInCardRange,
  formatCardScheduleLabel,
  notesForDay,
  normalizeDailyNotes,
  resolveCardDates,
  sanitizeCalendarDay,
  sanitizeDailyNoteBody,
} from "./card-schedule";

describe("card schedule", () => {
  it("keeps valid days and drops invalid ones", () => {
    expect(sanitizeCalendarDay("2026-08-26")).toBe("2026-08-26");
    expect(sanitizeCalendarDay("2026-02-30")).toBeNull();
    expect(sanitizeCalendarDay("26/08/2026")).toBeNull();
  });

  it("swaps start and end when they are inverted", () => {
    expect(resolveCardDates("2026-08-30", "2026-08-26")).toEqual({
      startDate: "2026-08-26",
      dueDate: "2026-08-30",
    });
  });

  it("formats a compact start/end label", () => {
    expect(formatCardScheduleLabel("2026-08-26", "2026-09-02", "2026-08-26")).toBe(
      "26/08 → 02/09",
    );
    expect(formatCardScheduleLabel(null, "2026-08-26", "2026-08-26")).toBe("26/08");
    expect(formatCardScheduleLabel("2026-08-26", null, "2026-08-26")).toBe(
      "Início 26/08",
    );
  });

  it("lists days in the card range", () => {
    expect(daysInCardRange("2026-08-26", "2026-08-28")).toEqual([
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
    ]);
  });

  it("normalizes daily notes and groups by day", () => {
    const notes = normalizeDailyNotes([
      {
        id: "n2",
        date: "2026-08-27",
        body: "  Homolog ok  ",
        authorId: "ana",
        createdAt: "2026-08-27T12:00:00.000Z",
        updatedAt: "2026-08-27T12:00:00.000Z",
      },
      {
        id: "n1",
        date: "2026-08-26",
        body: "Kickoff",
        authorId: null,
        createdAt: "2026-08-26T09:00:00.000Z",
        updatedAt: "2026-08-26T09:00:00.000Z",
      },
    ]);
    expect(notes.map((n) => n.id)).toEqual(["n2", "n1"]);
    expect(notesForDay(notes, "2026-08-27")[0].body).toBe("Homolog ok");
    expect(sanitizeDailyNoteBody("  a\r\nb  ")).toBe("a\nb");
  });
});
