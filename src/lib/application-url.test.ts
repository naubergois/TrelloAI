import { describe, expect, it } from "vitest";
import { applicationUrlLabel, sanitizeApplicationUrl } from "./application-url";

describe("application url", () => {
  it("accepts http(s) and prefixes a bare host", () => {
    expect(sanitizeApplicationUrl("https://jangada.cge.ce.gov.br/app")).toBe(
      "https://jangada.cge.ce.gov.br/app",
    );
    expect(sanitizeApplicationUrl("http://homolog.local/piloto")).toBe(
      "http://homolog.local/piloto",
    );
    expect(sanitizeApplicationUrl("app.cge.ce.gov.br/jangada")).toBe(
      "https://app.cge.ce.gov.br/jangada",
    );
  });

  it("rejects empty values and unsafe schemes", () => {
    expect(sanitizeApplicationUrl("")).toBeNull();
    expect(sanitizeApplicationUrl("   ")).toBeNull();
    expect(sanitizeApplicationUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeApplicationUrl("data:text/html,hi")).toBeNull();
    expect(sanitizeApplicationUrl("not a url")).toBeNull();
  });

  it("formats a compact label for the panel", () => {
    expect(applicationUrlLabel("https://jangada.cge.ce.gov.br/app/")).toBe(
      "jangada.cge.ce.gov.br/app",
    );
    expect(applicationUrlLabel("javascript:alert(1)")).toBe("");
  });
});
