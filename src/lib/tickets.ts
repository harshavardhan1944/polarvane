import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Signed run tickets: the browser can only ask about Apify runs this user started.
function sign(runId: string, userId: string, kind: string) {
  return createHmac("sha256", `${process.env.APIFY_TOKEN ?? ""}:${userId}:${kind}`).update(runId).digest("hex").slice(0, 32);
}

export function makeTicket(runId: string, userId: string, kind: string) {
  return `${runId}.${sign(runId, userId, kind)}`;
}

export function readTicket(ticket: string, userId: string, kind: string): string | null {
  const [runId, sig] = String(ticket ?? "").split(".");
  if (!runId || !sig || !/^[A-Za-z0-9]{8,40}$/.test(runId)) return null;
  const want = Buffer.from(sign(runId, userId, kind));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? runId : null;
}
