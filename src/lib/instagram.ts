// Checks an Instagram link and pulls out the post's unique code ("shortcode").
// Accepts post and Reel links; rejects everything else with a helpful message.

export type ParsedInstagramUrl =
  | { ok: true; shortcode: string; postType: "post" | "reel"; canonicalUrl: string }
  | { ok: false; error: string };

const INSTAGRAM_HOSTS = new Set([
  "instagram.com",
  "www.instagram.com",
  "m.instagram.com",
  "instagr.am",
  "www.instagr.am",
]);

export function parseInstagramUrl(input: string): ParsedInstagramUrl {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return { ok: false, error: "Please paste an Instagram post or Reel link." };
  if (trimmed.length > 500) return { ok: false, error: "That link is too long to be an Instagram link." };

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That doesn’t look like a web link. Copy the link from Instagram’s Share button." };
  }

  if (!INSTAGRAM_HOSTS.has(url.hostname.toLowerCase())) {
    return { ok: false, error: "Only Instagram links are supported right now (instagram.com/p/… or instagram.com/reel/…)." };
  }

  const parts = url.pathname.split("/").filter(Boolean);
  // Supports /p/CODE, /reel/CODE, /reels/CODE, /tv/CODE and /USERNAME/p/CODE, /USERNAME/reel/CODE
  const kindIndex = parts.findIndex((p) => ["p", "reel", "reels", "tv"].includes(p.toLowerCase()));

  if (kindIndex === -1 || kindIndex > 1 || !parts[kindIndex + 1]) {
    if (parts[0]?.toLowerCase() === "stories")
      return { ok: false, error: "Stories aren’t supported. Please paste a post or Reel link." };
    if (parts.length === 1)
      return { ok: false, error: "That’s a profile link. Open a specific post or Reel and copy its link instead." };
    return { ok: false, error: "That isn’t a post or Reel link. It should look like instagram.com/p/… or instagram.com/reel/…" };
  }

  const kind = parts[kindIndex].toLowerCase();
  const shortcode = parts[kindIndex + 1];
  if (!/^[A-Za-z0-9_-]{5,40}$/.test(shortcode)) {
    return { ok: false, error: "The post code in that link looks incomplete. Copy the link again from Instagram." };
  }

  const postType = kind === "reel" || kind === "reels" ? "reel" : "post";
  const canonicalUrl = `https://www.instagram.com/${postType === "reel" ? "reel" : "p"}/${shortcode}/`;
  return { ok: true, shortcode, postType, canonicalUrl };
}
