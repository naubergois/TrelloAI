import { describe, expect, it } from "vitest";
import { checkRateLimit, assertBodySize } from "@/lib/rate-limit";

describe("rate-limit", () => {
  it("rate limits after max requests", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(key, 5, 60_000).ok).toBe(true);
    }
    expect(checkRateLimit(key, 5, 60_000).ok).toBe(false);
  });

  it("rejects oversized bodies", () => {
    const big = "x".repeat(100);
    expect(assertBodySize(big, 50).ok).toBe(false);
    expect(assertBodySize("ok", 50).ok).toBe(true);
  });
});
