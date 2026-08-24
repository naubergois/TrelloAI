import { describe, expect, it } from "vitest";
import {
  DEFAULT_PG_DATABASE,
  DEFAULT_PG_HOST,
  DEFAULT_PG_SCHEMA,
  isPgConfigured,
  readPgConfig,
  sanitizePgSchema,
} from "./config";

describe("ASESI postgres config", () => {
  it("sanitizes schema names", () => {
    expect(sanitizePgSchema("TrelloAI")).toBe("trelloai");
    expect(sanitizePgSchema(undefined)).toBe(DEFAULT_PG_SCHEMA);
    expect(() => sanitizePgSchema("trello-ai")).toThrow(/PG_SCHEMA/);
  });

  it("detects discrete PG_* credentials", () => {
    expect(
      isPgConfigured({
        PG_HOST: DEFAULT_PG_HOST,
        PG_DATABASE: DEFAULT_PG_DATABASE,
        PG_USER: "postgres",
        PG_PASSWORD: "secret",
      }),
    ).toBe(true);
    expect(isPgConfigured({ PG_HOST: DEFAULT_PG_HOST })).toBe(false);
  });

  it("reads ASESI defaults from PG_*", () => {
    const cfg = readPgConfig({
      PG_HOST: DEFAULT_PG_HOST,
      PG_PORT: "5432",
      PG_DATABASE: DEFAULT_PG_DATABASE,
      PG_USER: "postgres",
      PG_PASSWORD: "secret",
      PG_SCHEMA: "trelloai",
    });
    expect(cfg).toMatchObject({
      host: DEFAULT_PG_HOST,
      database: DEFAULT_PG_DATABASE,
      user: "postgres",
      schema: "trelloai",
      ssl: false,
    });
  });
});
