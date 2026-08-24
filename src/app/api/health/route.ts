import { NextResponse } from "next/server";
import { isPgConfigured, pgPing } from "@/lib/storage/pg";

export async function GET() {
  const database = isPgConfigured()
    ? await pgPing()
    : { ok: false, configured: false, error: "PostgreSQL não configurado" };

  return NextResponse.json({
    ok: true,
    service: "jangada",
    database: {
      configured: database.configured,
      reachable: database.ok,
      schema: database.schema ?? null,
      name: database.database ?? null,
      host: database.host ?? null,
      error: database.error ?? null,
    },
  });
}
