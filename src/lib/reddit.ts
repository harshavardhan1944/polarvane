import "server-only";
import type { CollectedComment } from "./apify";
export { isRedditLink, parseRedditUrl } from "./reddit-url";

// Reddit through the official Data API (OAuth, read-only, app-only token).
// Keys live only in server environment variables: REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET
// (and optionally REDDIT_USER_AGENT). Usernames are never stored.

export class RedditError extends Error {
  constructor(
    message: string,
    public kind: "not_configured" | "auth" | "not_found" | "rate_limit" | "other",
  ) {
    super(message);
  }
}

const HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "new.reddit.com", "m.reddit.com", "np.reddit.com"]);

// Reddit "share" links redirect to the real post address.
export async function resolveShareLink(input: string): Promise<string> {
  try {
    const url = new URL(/^https?:\/\//i.test(input.trim()) ? input.trim() : `https://${input.trim()}`);
    if (!HOSTS.has(url.hostname.toLowerCase()) || !url.pathname.split("/").includes("s")) return input;
    const res = await fetch(url, { method: "HEAD", redirect: "manual", headers: { "User-Agent": userAgent() }, cache: "no-store" });
    const loc = res.headers.get("location");
    return loc ? new URL(loc, url).toString() : input;
  } catch {
    return input;
  }
}

function env(name: string) {
  return (process.env[name] ?? "").replace(/^["']+|["']+$/g, "").trim();
}

function userAgent() {
  return env("REDDIT_USER_AGENT") || "web:app.polarvane:v1.0 (read-only brand comment analysis)";
}

export function redditConfigured() {
  return Boolean(env("REDDIT_CLIENT_ID") && env("REDDIT_CLIENT_SECRET"));
}

let cached: { token: string; expires: number } | null = null;

async function token() {
  if (cached && cached.expires > Date.now() + 60_000) return cached.token;
  const id = env("REDDIT_CLIENT_ID");
  const secret = env("REDDIT_CLIENT_SECRET");
  if (!id || !secret)
    throw new RedditError("Reddit isn’t connected yet. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Vercel.", "not_configured");
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": userAgent(),
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const json = (await res.json().catch(() => null)) as { access_token?: string; expires_in?: number; error?: string } | null;
  if (!res.ok || !json?.access_token) {
    console.error("[polarvane] reddit token", res.status, json?.error);
    throw new RedditError(
      res.status === 401 || json?.error === "invalid_grant" || json?.error === "unauthorized_client"
        ? "Reddit rejected the keys. Check REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Vercel."
        : `Couldn’t sign in to Reddit (${res.status}). Please try again.`,
      res.status === 401 ? "auth" : "other",
    );
  }
  cached = { token: json.access_token, expires: Date.now() + (json.expires_in ?? 3600) * 1000 };
  return cached.token;
}

type Thing = { kind: string; data: Record<string, unknown> };

export type RedditThread = {
  details: {
    caption: string;
    post_owner: string | null;
    likes_count: number | null;
    views_count: null;
    comments_reported: number | null;
    post_published_at: string | null;
  };
  title: string;
  comments: CollectedComment[];
};

const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null);
const iso = (v: unknown) => (typeof v === "number" ? new Date(v * 1000).toISOString() : null);
// Privacy: hide u/usernames inside comment text too.
const maskUsers = (t: string) => t.replace(/(^|[^a-z0-9_])\/?u\/[a-z0-9_-]{2,}/gi, "$1u/…");

// Fetches a thread and its comments (top-level and replies), newest Reddit limits apply (~500 per request).
export async function fetchRedditThread(postId: string, limit: number): Promise<RedditThread> {
  const t = await token();
  const res = await fetch(
    `https://oauth.reddit.com/comments/${encodeURIComponent(postId)}?limit=${Math.min(500, Math.max(10, limit))}&depth=8&sort=top&raw_json=1`,
    { headers: { Authorization: `Bearer ${t}`, "User-Agent": userAgent() }, cache: "no-store" },
  );
  if (res.status === 401 || res.status === 403) {
    cached = null;
    throw new RedditError("Reddit refused the request. Your API access may not be approved for this yet.", "auth");
  }
  if (res.status === 404) throw new RedditError("Reddit post not found. It may be deleted or private.", "not_found");
  if (res.status === 429) throw new RedditError("Reddit’s rate limit was reached. Please wait a minute and try again.", "rate_limit");
  if (!res.ok) throw new RedditError(`Reddit returned an error (${res.status}). Please try again.`, "other");

  const json = (await res.json()) as { data?: { children?: Thing[] } }[];
  const post = json?.[0]?.data?.children?.[0]?.data ?? {};
  const top = json?.[1]?.data?.children ?? [];

  const comments: CollectedComment[] = [];
  const walk = (things: Thing[]) => {
    for (const th of things) {
      if (comments.length >= limit) return;
      if (th.kind !== "t1") continue; // "more" placeholders are skipped
      const d = th.data;
      const body = s(d.body).trim();
      const r = d.replies; // "" when there are no replies
      const children = r && typeof r === "object" ? ((r as { data?: { children?: Thing[] } }).data?.children ?? []) : [];
      if (body && body !== "[deleted]" && body !== "[removed]") {
        comments.push({
          external_id: s(d.id) || s(d.name),
          text: maskUsers(body).slice(0, 4000),
          author_username: null,
          posted_at: iso(d.created_utc),
          like_count: n(d.score),
          reply_count: children.filter((c) => c.kind === "t1").length,
          raw: { id: s(d.id), score: n(d.score), depth: n(d.depth), source: "reddit" },
        });
      }
      if (children.length) walk(children);
    }
  };
  walk(top);

  const title = s(post.title).trim();
  const body = s(post.selftext).trim();
  return {
    title: title.slice(0, 120),
    details: {
      caption: maskUsers([title, body].filter(Boolean).join("\n\n")).slice(0, 3000),
      post_owner: s(post.subreddit_name_prefixed) || null, // the community (r/…), never the poster's username
      likes_count: n(post.score),
      views_count: null,
      comments_reported: n(post.num_comments),
      post_published_at: iso(post.created_utc),
    },
    comments,
  };
}

// ---------- Apify Reddit scraper output ----------
// Items are tagged dataType "post" or "comment" (field names shared by most Apify Reddit tools).

export function mapApifyRedditItems(items: Record<string, unknown>[], limit: number): RedditThread & { errors: string[] } {
  const kind = (it: Record<string, unknown>) => s(it.dataType || it.type).toLowerCase();
  const errors = items.map((it) => s(it.error || it.errorMessage)).filter(Boolean);
  const post = items.find((it) => kind(it) === "post") ?? {};
  const raw = items.filter((it) => kind(it) === "comment");
  const idOf = (it: Record<string, unknown>) => (s(it.parsedId) || s(it.id) || s(it.commentId)).replace(/^t1_/, "");
  const replies = new Map<string, number>();
  for (const it of raw) {
    const parent = s(it.parentId).replace(/^t1_/, "");
    if (parent && !parent.startsWith("t3_")) replies.set(parent, (replies.get(parent) ?? 0) + 1);
  }
  const date = (v: unknown) => (typeof v === "number" ? iso(v) : typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
  const seen = new Set<string>();
  const comments: CollectedComment[] = [];
  for (const it of raw) {
    const id = idOf(it);
    const body = (s(it.body) || s(it.text)).trim();
    if (!id || seen.has(id) || !body || body === "[deleted]" || body === "[removed]") continue;
    seen.add(id);
    comments.push({
      external_id: id,
      text: maskUsers(body).slice(0, 4000),
      author_username: null, // privacy: never stored
      posted_at: date(it.createdAt ?? it.created_utc),
      like_count: n(it.upVotes ?? it.score),
      reply_count: replies.get(id) ?? n(it.numberOfreplies ?? it.numberOfReplies) ?? 0,
      raw: { id, score: n(it.upVotes ?? it.score), depth: n(it.depth), source: "reddit-apify" },
    });
    if (comments.length >= limit) break;
  }
  const title = s(post.title).trim();
  const body = s(post.body).trim();
  return {
    title: title.slice(0, 120),
    details: {
      caption: maskUsers([title, body].filter(Boolean).join("\n\n")).slice(0, 3000),
      post_owner: s(post.communityName) || (s(post.parsedCommunityName) ? `r/${s(post.parsedCommunityName)}` : null),
      likes_count: n(post.upVotes ?? post.score),
      views_count: null,
      comments_reported: n(post.numberOfComments ?? post.commentsCount),
      post_published_at: date(post.createdAt ?? post.created_utc),
    },
    comments,
    errors,
  };
}
