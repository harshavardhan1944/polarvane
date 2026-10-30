import "server-only";

// Talks to Apify's Instagram Comments Scraper (apify/instagram-comment-scraper).
// Runs ONLY on the server. The APIFY_TOKEN never reaches the browser.

const ACTOR = "apify~instagram-comment-scraper";
const API = "https://api.apify.com/v2";

export class ApifyError extends Error {
  constructor(
    message: string,
    public kind: "not_configured" | "auth" | "credit" | "rate_limit" | "not_found" | "other",
  ) {
    super(message);
  }
}

function token() {
  // Clean up copy-paste mistakes: spaces, quotes, invisible characters, "KEY=value".
  const raw = (process.env.APIFY_TOKEN ?? "")
    .replace(/[\u200B-\u200D\uFEFF\u00A0]/g, "")
    .replace(/^\s*APIFY_TOKEN\s*=/, "")
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .trim();
  if (!raw) {
    throw new ApifyError(
      "Apify isn’t connected yet. Add APIFY_TOKEN in Vercel’s environment variables.",
      "not_configured",
    );
  }
  const found = raw.match(/apify_api_[A-Za-z0-9]+/);
  if (found) return found[0];
  throw new ApifyError(
    `The saved APIFY_TOKEN doesn’t look like an Apify token. It should start with “apify_api_” (the saved value is ${raw.length} characters long and starts with “${raw.slice(0, 4)}…”).`,
    "auth",
  );
}

async function apifyFetch(path: string, init?: RequestInit) {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token()}`,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (err) {
    if (err instanceof ApifyError) throw err;
    throw new ApifyError("Couldn’t reach Apify. Please try again in a minute.", "other");
  }

  if (res.ok) return res.json();

  const body = await res.text().catch(() => "");
  console.error(`[polarvane] Apify ${res.status} on ${path}:`, body.slice(0, 500));
  // Apify's own explanation (never contains the token itself).
  let detail = "";
  try {
    const e = JSON.parse(body)?.error;
    if (e?.message) detail = ` Apify says: “${String(e.message).slice(0, 300)}” (${e.type ?? res.status})`;
  } catch {}
  if (res.status === 401)
    throw new ApifyError(`Apify didn’t recognise the API token. Check APIFY_TOKEN in Vercel.${detail}`, "auth");
  if (res.status === 403)
    throw new ApifyError(`Apify refused this request.${detail}`, "auth");
  if (res.status === 402 || /insufficient|credit|usage limit|exceed/i.test(body))
    throw new ApifyError(
      `Your Apify account is out of credit or hit its monthly limit. Check billing in Apify.${detail}`,
      "credit",
    );
  if (res.status === 429)
    throw new ApifyError("Apify is busy (rate limit). Please wait a minute and try again.", "rate_limit");
  if (res.status === 404) throw new ApifyError("Apify couldn’t find that job.", "not_found");
  throw new ApifyError(`Apify returned an error (${res.status}).${detail}`, "other");
}

export async function startCommentRun(postUrl: string, limit: number) {
  const input = {
    directUrls: [postUrl],
    resultsLimit: limit,
    includeNestedComments: false,
  };
  // maxItems caps what Apify will charge for, as a second safety limit.
  const json = await apifyFetch(`/acts/${ACTOR}/runs?maxItems=${limit}`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return { runId: json.data.id as string };
}

export type ApifyRunStatus =
  | "READY"
  | "RUNNING"
  | "SUCCEEDED"
  | "FAILED"
  | "TIMING-OUT"
  | "TIMED-OUT"
  | "ABORTING"
  | "ABORTED";

export async function getRun(runId: string) {
  const json = await apifyFetch(`/actor-runs/${encodeURIComponent(runId)}`);
  return {
    status: json.data.status as ApifyRunStatus,
    datasetId: json.data.defaultDatasetId as string,
    statusMessage: (json.data.statusMessage as string | undefined) ?? null,
  };
}

export async function getDatasetItems(datasetId: string, limit: number) {
  const items = await apifyFetch(
    `/datasets/${encodeURIComponent(datasetId)}/items?clean=true&format=json&limit=${limit}`,
  );
  return Array.isArray(items) ? (items as Record<string, unknown>[]) : [];
}

// ---------- Turning Apify's output into our comment rows ----------

export type CollectedComment = {
  external_id: string;
  text: string;
  author_username: string | null;
  posted_at: string | null;
  like_count: number | null;
  reply_count: number | null;
  raw: Record<string, unknown>;
};

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
function num(v: unknown) {
  return typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
}
function toIso(v: unknown) {
  if (typeof v === "number") {
    const ms = v > 1e12 ? v : v * 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

// Keep only the fields we need (data minimisation): no profile pictures or owner IDs.
const RAW_KEEP = ["id", "text", "ownerUsername", "timestamp", "likesCount", "repliesCount", "postUrl", "position"];

export function mapApifyItems(items: Record<string, unknown>[]) {
  const comments: CollectedComment[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    if (item.error || item.errorDescription) {
      errors.push(String(item.errorDescription ?? item.error));
      continue;
    }
    const text = str(item.text) ?? str(item.commentText) ?? str(item.content);
    if (!text) continue;

    const owner = (item.owner ?? {}) as Record<string, unknown>;
    const author = str(item.ownerUsername) ?? str(owner.username) ?? str(item.username);
    const postedAt = toIso(item.timestamp ?? item.createdAt ?? item.created_at);
    const id =
      str(item.id) ??
      (typeof item.id === "number" ? String(item.id) : null) ??
      str(item.commentId) ??
      str(item.pk) ??
      `h_${hash(`${author}|${postedAt}|${text}`)}`;

    if (seen.has(id)) continue;
    seen.add(id);

    const raw: Record<string, unknown> = {};
    for (const k of RAW_KEEP) if (k in item) raw[k] = item[k];

    comments.push({
      external_id: id,
      text: text.slice(0, 5000),
      author_username: author,
      posted_at: postedAt,
      like_count: num(item.likesCount) ?? num(item.likeCount) ?? num(item.likes_count),
      reply_count:
        num(item.repliesCount) ??
        num(item.replyCount) ??
        (Array.isArray(item.replies) ? item.replies.length : null),
      raw,
    });
  }
  return { comments, errors };
}

function hash(s: string) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
