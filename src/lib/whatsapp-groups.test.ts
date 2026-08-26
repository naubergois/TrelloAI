import { describe, expect, it } from "vitest";
import {
  coerceWhatsAppGroup,
  findDuplicateWhatsAppGroup,
  mergeWhatsAppGroup,
  normalizeWhatsAppGroups,
  sanitizeWhatsAppInviteUrl,
  sanitizeWhatsAppJid,
} from "./whatsapp-groups";

describe("whatsapp group metadata", () => {
  it("accepts chat.whatsapp.com invite links and rejects other schemes", () => {
    expect(sanitizeWhatsAppInviteUrl("https://chat.whatsapp.com/AbCdEfGhIjKlMnOp")).toBe(
      "https://chat.whatsapp.com/AbCdEfGhIjKlMnOp",
    );
    expect(sanitizeWhatsAppInviteUrl("chat.whatsapp.com/invite/AbCdEfGhIjKlMnOp")).toBe(
      "https://chat.whatsapp.com/AbCdEfGhIjKlMnOp",
    );
    expect(sanitizeWhatsAppInviteUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeWhatsAppInviteUrl("https://wa.me/5585999999999")).toBeNull();
  });

  it("extracts group JIDs from free text", () => {
    expect(sanitizeWhatsAppJid("120363430202949653@g.us")).toBe("120363430202949653@g.us");
    expect(
      sanitizeWhatsAppJid("Grupo WhatsApp ASESI (120363430202949653@g.us)"),
    ).toBe("120363430202949653@g.us");
    expect(sanitizeWhatsAppJid("120363430202949653")).toBe("120363430202949653@g.us");
    expect(sanitizeWhatsAppJid("not-a-group")).toBeNull();
  });

  it("normalizes a list and drops duplicates and junk", () => {
    const groups = normalizeWhatsAppGroups([
      {
        id: "wa-1",
        name: "ASESI",
        jid: "120363430202949653@g.us",
        inviteUrl: "https://chat.whatsapp.com/AbCdEfGhIjKlMnOp",
      },
      {
        name: "ASESI de novo",
        jid: "120363430202949653@g.us",
      },
      { name: "" },
      {
        name: "COTRA",
        jid: "120363426236844760@g.us",
      },
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0].name).toBe("ASESI");
    expect(groups[0].inviteUrl).toBe("https://chat.whatsapp.com/AbCdEfGhIjKlMnOp");
    expect(groups[1].jid).toBe("120363426236844760@g.us");
  });

  it("finds duplicates by invite or JID and merges edits", () => {
    const current = coerceWhatsAppGroup({
      id: "wa-1",
      name: "ASESI",
      jid: "120363430202949653@g.us",
    });
    expect(current).toBeTruthy();
    expect(
      findDuplicateWhatsAppGroup([current!], { jid: "120363430202949653@g.us", inviteUrl: null })
        ?.id,
    ).toBe("wa-1");
    const merged = mergeWhatsAppGroup(current!, {
      name: "Grupo WhatsApp ASESI",
      inviteUrl: "https://chat.whatsapp.com/AbCdEfGhIjKlMnOp",
      notes: "Fonte da carteira",
    });
    expect(merged?.name).toBe("Grupo WhatsApp ASESI");
    expect(merged?.inviteUrl).toContain("chat.whatsapp.com");
    expect(merged?.notes).toBe("Fonte da carteira");
    expect(merged?.jid).toBe("120363430202949653@g.us");
  });
});
