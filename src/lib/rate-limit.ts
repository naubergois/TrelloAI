import { NextResponse } from "next/server";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max = 40,
  windowMs = 60_000,
): { ok: true } | { ok: false; response: NextResponse } {
  const now = Date.now();
  const bucket = rateBuckets.get(key) ?? { count: 0, resetAt: now + windowMs };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + windowMs;
  }
  bucket.count += 1;
  rateBuckets.set(key, bucket);
  if (bucket.count > max) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Muitas requisições. Tente novamente em instantes." },
        { status: 429 },
      ),
    };
  }
  return { ok: true };
}

export function assertBodySize(
  body: string,
  maxBytes = 2_000_000,
): { ok: true } | { ok: false; response: NextResponse } {
  if (body.length > maxBytes) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Payload muito grande." }, { status: 413 }),
    };
  }
  return { ok: true };
}
