import "server-only";
import gplay from "google-play-scraper";
import { ApifyError, isApifyConfigured, runActorSync } from "@/lib/apify";

// "Find sources": each connector answers two questions for a brand:
//   1. How much customer engagement exists here?  (count + unit)
//   2. What are people actually saying?            (mentions)
// A connector never throws. Failures come back as status "error" with a plain reason,
// so one broken source can't take down the whole scan.

export type SourceStatus = "ok" | "empty" | "needs_key" | "error";

export type ScanMention = {
  source: string;
  text: string;
  url: string | null;
  posted_at: string | null;
  rating: number | null; // 1–5 stars where the source has them
};

export type SourceResult = {
  name: string;
  type: string;
  status: SourceStatus;
  engagement_count: number;
  unit: string;
  avg_rating: number | null;
  where_list: string[];
  note: string;
  mentions: ScanMention[];
};

export type ScanOptions = { brand: string; market: string; paid: boolean };

type Connector = {
  name: string;
  type: string;
  paid?: boolean; // costs Apify credit per scan
  needs?: () => string | null; // missing setting, or null if ready
  fetch: (o: ScanOptions) => Promise<Omit<SourceResult, "name" | "type" | "status"> & { status?: SourceStatus }>;
};

const UA = "Polarvane/1.0 (brand listening; +https://polarvane.vercel.app)";

// ---------- helpers ----------

function tokens(brand: string) {
  return brand.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((t) => t.length > 1);
}
/** True if every meaningful word of the brand appears in the text. Keeps "boAt" from matching every boat. */
export function matchesBrand(text: string | null | undefined, brand: string) {
  const t = (text ?? "").toLowerCase();
  const toks = tokens(brand);
  return toks.length > 0 && toks.every((w) => t.includes(w));
}

const COUNTRIES: [RegExp, string][] = [
  [/india|bharat/i, "in"],
  [/\b(us|usa|united states|america)\b/i, "us"],
  [/\b(uk|united kingdom|britain|england)\b/i, "gb"],
  [/uae|dubai|emirates/i, "ae"],
  [/singapore/i, "sg"],
  [/australia/i, "au"],
  [/canada/i, "ca"],
];
export function countryCode(market: string) {
  for (const [re, cc] of COUNTRIES) if (re.test(market)) return cc;
  return (process.env.DEFAULT_COUNTRY ?? "in").toLowerCase();
}

function env(name: string) {
  return (process.env[name] ?? "").replace(/[​-‍﻿ ]/g, "").trim().replace(/^["']+|["']+$/g, "");
}

async function getJson(url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": UA, ...(init?.headers ?? {}) },
    cache: "no-store",
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}${body ? `: ${body.slice(0, 160)}` : ""}`);
  }
  return res.json();
}

const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0);
const s = (v: unknown) => (typeof v === "string" ? v : v == null ? "" : String(v));
const fmt = (x: number) => x.toLocaleString("en-IN");
const weightedAvg = (pairs: [number, number][]) => {
  const total = pairs.reduce((a, [, c]) => a + c, 0);
  return total ? Math.round((pairs.reduce((a, [r, c]) => a + r * c, 0) / total) * 100) / 100 : null;
};

// ---------- free sources (no key needed) ----------

const googlePlay: Connector = {
  name: "Google Play reviews",
  type: "App reviews",
  async fetch({ brand, market }) {
    const country = countryCode(market);
    const hits = await gplay.search({ term: brand, num: 8, country, lang: "en" });
    const apps = hits.filter((h) => matchesBrand(h.title, brand) || matchesBrand(h.developer, brand)).slice(0, 3);
    if (!apps.length)
      return { engagement_count: 0, unit: "ratings", avg_rating: null, where_list: [], mentions: [], note: "No app from this brand on Google Play." };
    const details = await Promise.all(apps.map((a) => gplay.app({ appId: a.appId, country, lang: "en" })));
    const pairs = details.map((d) => [n(d.score), n(d.ratings)] as [number, number]);
    const top = details[0];
    const { data } = await gplay.reviews({ appId: top.appId, country, lang: "en", sort: (gplay.sort as unknown as { NEWEST: number }).NEWEST as never, num: 120 });
    return {
      engagement_count: pairs.reduce((a, [, c]) => a + c, 0),
      unit: "ratings",
      avg_rating: weightedAvg(pairs),
      where_list: details.map((d) => `${d.title} (${fmt(n(d.ratings))} ratings)`),
      note: "",
      mentions: data
        .filter((r) => r.text)
        .map((r) => ({
          source: "Google Play reviews",
          text: s(r.text),
          url: s(r.url) || top.url,
          posted_at: r.date ? new Date(r.date).toISOString().slice(0, 10) : null,
          rating: n(r.score) || null,
        })),
    };
  },
};

const appStore: Connector = {
  name: "App Store reviews",
  type: "App reviews",
  async fetch({ brand, market }) {
    const cc = countryCode(market);
    const q = new URLSearchParams({ term: brand, entity: "software", country: cc, limit: "10" });
    const json = await getJson(`https://itunes.apple.com/search?${q}`);
    const apps = (json.results as Record<string, unknown>[])
      .filter((a) => matchesBrand(s(a.trackName), brand) || matchesBrand(s(a.sellerName), brand) || matchesBrand(s(a.artistName), brand))
      .slice(0, 3);
    if (!apps.length)
      return { engagement_count: 0, unit: "ratings", avg_rating: null, where_list: [], mentions: [], note: "No app from this brand on the App Store." };
    const pairs = apps.map((a) => [n(a.averageUserRating), n(a.userRatingCount)] as [number, number]);
    const mentions: ScanMention[] = [];
    try {
      const feed = await getJson(`https://itunes.apple.com/${cc}/rss/customerreviews/id=${apps[0].trackId}/sortBy=mostRecent/json`);
      let entries = feed?.feed?.entry ?? [];
      if (!Array.isArray(entries)) entries = [entries];
      for (const e of entries as Record<string, { label?: string; name?: { label?: string } }>[]) {
        const body = e.content?.label;
        const rating = e["im:rating"]?.label;
        if (!body || !rating) continue;
        const title = e.title?.label;
        mentions.push({
          source: "App Store reviews",
          text: title ? `${title}. ${body}` : body,
          url: s(apps[0].trackViewUrl) || null,
          posted_at: s(e.updated?.label).slice(0, 10) || null,
          rating: Number(rating) || null,
        });
      }
    } catch {
      // Ratings counts still count even if the review feed is unavailable.
    }
    return {
      engagement_count: pairs.reduce((a, [, c]) => a + c, 0),
      unit: "ratings",
      avg_rating: weightedAvg(pairs),
      where_list: apps.map((a) => `${s(a.trackName)} (${fmt(n(a.userRatingCount))} ratings)`),
      note: "",
      mentions,
    };
  },
};

async function redditToken() {
  const id = env("REDDIT_CLIENT_ID");
  const secret = env("REDDIT_CLIENT_SECRET");
  if (!id || !secret) return null;
  const json = await getJson("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  return s(json.access_token) || null;
}

const reddit: Connector = {
  name: "Reddit",
  type: "Forum",
  async fetch({ brand }) {
    const token = await redditToken();
    const q = new URLSearchParams({ q: `"${brand}"`, sort: "new", t: "year", limit: "100", type: "link", raw_json: "1" });
    let json;
    try {
      json = token
        ? await getJson(`https://oauth.reddit.com/search?${q}`, { headers: { Authorization: `Bearer ${token}` } })
        : await getJson(`https://www.reddit.com/search.json?${q}`);
    } catch (e) {
      if (!token && /HTTP (403|429)/.test(String(e)))
        return {
          status: "error",
          engagement_count: 0, unit: "", avg_rating: null, where_list: [], mentions: [],
          note: "Reddit blocks anonymous requests from servers. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET in Vercel.",
        };
      throw e;
    }
    const posts = (json?.data?.children ?? [])
      .map((c: { data: Record<string, unknown> }) => c.data)
      .filter((p: Record<string, unknown>) => matchesBrand(`${s(p.title)} ${s(p.selftext)}`, brand));
    const subs = new Map<string, number>();
    let count = 0;
    const mentions: ScanMention[] = posts.map((p: Record<string, unknown>) => {
      count += 1 + n(p.num_comments);
      const sub = s(p.subreddit_name_prefixed);
      subs.set(sub, (subs.get(sub) ?? 0) + 1);
      return {
        source: "Reddit",
        text: `${s(p.title)}. ${s(p.selftext).slice(0, 600)}`.trim(),
        url: `https://www.reddit.com${s(p.permalink)}`,
        posted_at: new Date(n(p.created_utc) * 1000).toISOString().slice(0, 10),
        rating: null,
      };
    });
    return {
      engagement_count: count,
      unit: "posts + comments (past year)",
      avg_rating: null,
      where_list: [...subs].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v})`),
      note: posts.length >= 100 ? "Capped at the 100 most recent matching posts." : "",
      mentions,
    };
  },
};

const FIPS: Record<string, string> = { in: "IN", us: "US", gb: "UK", au: "AS", ca: "CA", sg: "SN", ae: "AE" };
const news: Connector = {
  name: "News & blogs",
  type: "Media",
  async fetch({ brand, market }) {
    let query = `"${brand}"`;
    const fips = FIPS[countryCode(market)];
    if (market && fips) query += ` sourcecountry:${fips}`;
    const q = new URLSearchParams({ query, mode: "artlist", maxrecords: "250", format: "json", timespan: "3months", sort: "datedesc" });
    const res = await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?${q}`, {
      headers: { "User-Agent": UA }, cache: "no-store", signal: AbortSignal.timeout(25_000),
    });
    const body = await res.text();
    let arts: Record<string, unknown>[] = [];
    try {
      arts = JSON.parse(body).articles ?? [];
    } catch {
      // GDELT answers rate limits with plain text.
      throw new Error(body.slice(0, 160) || `HTTP ${res.status}`);
    }
    const domains = new Map<string, number>();
    for (const a of arts) domains.set(s(a.domain), (domains.get(s(a.domain)) ?? 0) + 1);
    return {
      engagement_count: arts.length,
      unit: "articles (past 3 months)",
      avg_rating: null,
      where_list: [...domains].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v})`),
      note: arts.length >= 250 ? "Capped at 250 articles." : "",
      mentions: arts.map((a) => ({
        source: "News & blogs",
        text: s(a.title),
        url: s(a.url) || null,
        posted_at: s(a.seendate).slice(0, 8) || null,
        rating: null,
      })),
    };
  },
};

// ---------- sources that need a key ----------

const youtube: Connector = {
  name: "YouTube comments",
  type: "Video",
  needs: () => (env("YOUTUBE_API_KEY") ? null : "YOUTUBE_API_KEY"),
  async fetch({ brand, market }) {
    const key = env("YOUTUBE_API_KEY");
    const after = new Date(Date.now() - 180 * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
    const search = await getJson(
      `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams({
        part: "snippet", q: brand, type: "video", maxResults: "25", order: "relevance",
        regionCode: countryCode(market).toUpperCase(), publishedAfter: after, key,
      })}`,
    );
    const ids = (search.items ?? [])
      .filter((i: { snippet: { title: string; description: string } }) => matchesBrand(`${i.snippet.title} ${i.snippet.description}`, brand))
      .map((i: { id: { videoId: string } }) => i.id.videoId);
    if (!ids.length)
      return { engagement_count: 0, unit: "comments on brand videos (past 6 months)", avg_rating: null, where_list: [], mentions: [], note: "" };
    const vids = await getJson(
      `https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: "statistics,snippet", id: ids.join(","), key })}`,
    );
    type Vid = { id: string; snippet: { title: string; channelTitle: string }; statistics: { commentCount?: string } };
    const list = ((vids.items ?? []) as Vid[]).sort((a, b) => n(b.statistics.commentCount) - n(a.statistics.commentCount));
    const mentions: ScanMention[] = [];
    await Promise.all(
      list.slice(0, 3).map(async (v) => {
        try {
          const c = await getJson(
            `https://www.googleapis.com/youtube/v3/commentThreads?${new URLSearchParams({
              part: "snippet", videoId: v.id, maxResults: "50", order: "relevance", textFormat: "plainText", key,
            })}`,
          );
          for (const t of c.items ?? []) {
            const sn = t.snippet.topLevelComment.snippet;
            mentions.push({
              source: "YouTube comments",
              text: s(sn.textDisplay),
              url: `https://www.youtube.com/watch?v=${v.id}&lc=${t.id}`,
              posted_at: s(sn.publishedAt).slice(0, 10) || null,
              rating: null,
            });
          }
        } catch {
          // Comments may be disabled on a video; skip it.
        }
      }),
    );
    return {
      engagement_count: list.reduce((a, v) => a + n(v.statistics.commentCount), 0),
      unit: "comments on brand videos (past 6 months)",
      avg_rating: null,
      where_list: list.slice(0, 4).map((v) => `${v.snippet.title.slice(0, 60)} · ${v.snippet.channelTitle} (${fmt(n(v.statistics.commentCount))})`),
      note: "",
      mentions,
    };
  },
};

const xTwitter: Connector = {
  name: "X (Twitter)",
  type: "Social",
  needs: () => (env("X_BEARER_TOKEN") ? null : "X_BEARER_TOKEN"),
  async fetch({ brand }) {
    const json = await getJson(
      `https://api.x.com/2/tweets/search/recent?${new URLSearchParams({
        query: `"${brand}" -is:retweet`, max_results: "100", "tweet.fields": "created_at,public_metrics",
      })}`,
      { headers: { Authorization: `Bearer ${env("X_BEARER_TOKEN")}` } },
    );
    const tweets = (json.data ?? []) as { id: string; text: string; created_at?: string; public_metrics?: { reply_count?: number } }[];
    return {
      engagement_count: tweets.reduce((a, t) => a + 1 + n(t.public_metrics?.reply_count), 0),
      unit: "posts + replies (past 7 days)",
      avg_rating: null,
      where_list: [],
      note: tweets.length >= 100 ? "Capped at 100 most recent posts." : "",
      mentions: tweets.map((t) => ({
        source: "X (Twitter)", text: t.text, url: `https://x.com/i/web/status/${t.id}`,
        posted_at: s(t.created_at).slice(0, 10) || null, rating: null,
      })),
    };
  },
};

// ---------- paid sources via Apify (uses the app's existing APIFY_TOKEN) ----------

const googleMaps: Connector = {
  name: "Google reviews",
  type: "Local reviews",
  paid: true,
  needs: () => (isApifyConfigured() ? null : "APIFY_TOKEN"),
  async fetch({ brand, market }) {
    const items = await runActorSync(
      process.env.APIFY_MAPS_ACTOR?.trim() || "compass/crawler-google-places",
      {
        searchStringsArray: [brand],
        ...(market ? { locationQuery: market } : {}),
        maxCrawledPlacesPerSearch: 20,
        maxReviews: 10,
        reviewsSort: "newest",
        language: "en",
      },
      { timeoutSecs: 170, maxUsd: 0.25 },
    );
    const places = items.filter((p) => matchesBrand(s(p.title), brand));
    const pairs = places.map((p) => [n(p.totalScore), n(p.reviewsCount)] as [number, number]);
    const mentions: ScanMention[] = [];
    for (const p of places) {
      for (const r of (Array.isArray(p.reviews) ? p.reviews : []) as Record<string, unknown>[]) {
        const text = s(r.text) || s(r.textTranslated);
        if (!text) continue;
        mentions.push({
          source: "Google reviews", text, url: s(r.reviewUrl) || s(p.url) || null,
          posted_at: s(r.publishedAtDate).slice(0, 10) || null, rating: n(r.stars) || null,
        });
      }
    }
    return {
      engagement_count: pairs.reduce((a, [, c]) => a + c, 0),
      unit: `ratings across ${places.length} location${places.length === 1 ? "" : "s"}`,
      avg_rating: weightedAvg(pairs),
      where_list: [...places]
        .sort((a, b) => n(b.reviewsCount) - n(a.reviewsCount))
        .slice(0, 4)
        .map((p) => `${s(p.title)}${p.city ? `, ${s(p.city)}` : ""} (${fmt(n(p.reviewsCount))})`),
      note: places.length ? "Up to 10 newest reviews read per location." : "No locations with this brand's name found.",
      mentions,
    };
  },
};

const AMAZON_DOMAIN: Record<string, string> = {
  in: "www.amazon.in", us: "www.amazon.com", gb: "www.amazon.co.uk", ae: "www.amazon.ae",
  ca: "www.amazon.ca", au: "www.amazon.com.au", sg: "www.amazon.sg",
};
const amazon: Connector = {
  name: "Amazon reviews",
  type: "Marketplace",
  paid: true,
  needs: () => (isApifyConfigured() ? null : "APIFY_TOKEN"),
  async fetch({ brand, market }) {
    const domain = AMAZON_DOMAIN[countryCode(market)] ?? "www.amazon.in";
    const items = await runActorSync(
      process.env.APIFY_AMAZON_ACTOR?.trim() || "junglee/amazon-crawler",
      {
        categoryOrProductUrls: [{ url: `https://${domain}/s?k=${encodeURIComponent(brand)}` }],
        maxItemsPerStartUrl: 24,
        scrapeProductDetails: false,
        proxyCountry: "AUTO_SELECT_PROXY_COUNTRY",
      },
      { timeoutSecs: 170, maxUsd: 0.15 },
    );
    const prods = items.filter((p) => matchesBrand(`${s(p.brand)} ${s(p.title)}`, brand));
    const pairs = prods.map((p) => [n(p.stars), n(p.reviewsCount)] as [number, number]);
    return {
      engagement_count: pairs.reduce((a, [, c]) => a + c, 0),
      unit: `ratings across top ${prods.length} ${domain.replace("www.", "")} listings`,
      avg_rating: weightedAvg(pairs),
      where_list: [...prods]
        .sort((a, b) => n(b.reviewsCount) - n(a.reviewsCount))
        .slice(0, 4)
        .map((p) => `${s(p.title).slice(0, 60)} (${fmt(n(p.reviewsCount))})`),
      note: prods.length ? "Rating counts are live. Review text isn't collected yet, to keep Apify costs low." : "",
      mentions: [],
    };
  },
};

const CONNECTORS: Connector[] = [amazon, googleMaps, googlePlay, appStore, youtube, reddit, xTwitter, news];

export function connectorStatus() {
  return CONNECTORS.map((c) => ({ name: c.name, type: c.type, paid: Boolean(c.paid), missing: c.needs?.() ?? null }));
}

async function runOne(c: Connector, o: ScanOptions): Promise<SourceResult> {
  const base = { name: c.name, type: c.type, engagement_count: 0, unit: "", avg_rating: null, where_list: [], mentions: [] };
  const missing = c.needs?.();
  if (missing) return { ...base, status: "needs_key", note: `Add ${missing} in Vercel to enable.` };
  if (c.paid && !o.paid) return { ...base, status: "needs_key", note: "Skipped: paid sources were turned off for this scan." };
  try {
    const r = await c.fetch(o);
    const status: SourceStatus = r.status ?? (r.engagement_count > 0 || r.mentions.length ? "ok" : "empty");
    return { ...r, name: c.name, type: c.type, status, mentions: r.mentions.slice(0, 200) };
  } catch (err) {
    console.error(`[polarvane] source ${c.name} failed:`, err);
    const note =
      err instanceof ApifyError ? err.message : `Couldn’t reach this source right now (${String(err instanceof Error ? err.message : err).slice(0, 140)}).`;
    return { ...base, status: "error", note };
  }
}

export async function scanAll(o: ScanOptions) {
  return Promise.all(CONNECTORS.map((c) => runOne(c, o)));
}

// Channels with no open API: shown so brands know how to bring them in.
export const NOT_YET_CONNECTED = [
  { name: "Instagram", detail: "Paste a post or Reel in “Analyze a post” to collect its comments." },
  { name: "Flipkart reviews", detail: "No public reviews API. Planned via an Apify scraper or seller export." },
  { name: "Facebook", detail: "Needs Meta’s official account connection (planned)." },
  { name: "Myntra / Nykaa / Zomato / Swiggy", detail: "No public APIs. Planned via seller/partner exports." },
];
