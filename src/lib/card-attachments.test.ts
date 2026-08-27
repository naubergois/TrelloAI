import { describe, expect, it } from "vitest";
import {
  assertAttachmentPayload,
  attachmentPublicUrl,
  formatFileSize,
  guessMimeType,
  isBlockedFilename,
  isImageAttachment,
  isPdfAttachment,
  sanitizeFilename,
  snapshotWithAttachment,
  snapshotWithoutAttachment,
  mergeSnapshotAttachments,
} from "./card-attachments";

describe("card attachments", () => {
  it("sanitizes names and blocks executables", () => {
    expect(sanitizeFilename("C:\\\\tmp\\\\mapa final.pdf")).toBe("mapa final.pdf");
    expect(isBlockedFilename("setup.exe")).toBe(true);
    expect(isBlockedFilename("relatorio.pdf")).toBe(false);
    expect(() => assertAttachmentPayload("virus.bat", 10)).toThrow(/não permitido/);
    expect(() => assertAttachmentPayload("vazio.pdf", 0)).toThrow(/vazio/);
  });

  it("guesses mime types and formats size", () => {
    expect(guessMimeType("foto.PNG")).toBe("image/png");
    expect(guessMimeType("planilha.xlsx")).toContain("spreadsheet");
    expect(isImageAttachment({ mimeType: "image/png", name: "foto.png" })).toBe(true);
    expect(isImageAttachment({ mimeType: "application/pdf", name: "relatorio.pdf" })).toBe(
      false,
    );
    expect(isPdfAttachment({ mimeType: "application/pdf", name: "relatorio.pdf" })).toBe(true);
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
    expect(attachmentPublicUrl("asesi", "card1", "att1")).toBe(
      "/api/boards/asesi/cards/card1/attachments/att1",
    );
  });

  it("adds and removes attachments on a snapshot without dropping other card fields", () => {
    const snapshot = {
      board: { id: "asesi", updatedAt: "t0" },
      cards: {
        c1: { id: "c1", title: "Card", attachments: [], updatedAt: "t0" },
      },
      updatedAt: "t0",
    };
    const attachment = {
      id: "a1",
      name: "nota.txt",
      mimeType: "text/plain",
      size: 4,
      kind: "file" as const,
      url: "/api/boards/asesi/cards/c1/attachments/a1",
      createdAt: "t1",
    };
    const withFile = snapshotWithAttachment(snapshot as never, "c1", attachment);
    expect(withFile.cards.c1.attachments).toEqual([attachment]);
    expect(withFile.cards.c1.title).toBe("Card");
    const without = snapshotWithoutAttachment(withFile, "c1", "a1");
    expect(without.cards.c1.attachments).toEqual([]);
  });

  it("keeps server attachments when a stale client snapshot is saved", () => {
    const server = {
      cards: {
        c1: {
          id: "c1",
          attachments: [
            {
              id: "a1",
              name: "via-mcp.pdf",
              mimeType: "application/pdf",
              size: 10,
              kind: "file" as const,
              url: "/a1",
              createdAt: "t1",
            },
          ],
        },
      },
    };
    const client = {
      cards: {
        c1: { id: "c1", title: "Card", attachments: [] },
      },
    };
    const merged = mergeSnapshotAttachments(server as never, client as never);
    expect(merged.cards.c1.attachments?.map((item) => item.id)).toEqual(["a1"]);
  });
});
