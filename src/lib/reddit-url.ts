// Reddit link checks, shared by the browser (instant feedback) and the server.

export type ParsedRedditUrl =
  | { ok: true; postId: string; canonicalUrl: string; shortcode: string }
  | { ok: false; error: string };

const HOSTS = new Set(["reddit.com", "www.reddit.com", "old.reddit.com", "new.reddit.com", "m.reddit.com", "np.reddit.com"]);

export function isRedditLink(input: string) {
  return /(^|\/\/|\.)(reddit\.com|redd\.it)\//i.test((input ?? "").trim());
}

// Accepts reddit.com/r/<sub>/comments/<id>/…, reddit.com/comments/<id>, redd.it/<id>.
// Share links (reddit.com/r/<sub>/s/<code>) are resolved with resolveShareLink first.
export function parseRedditUrl(input: string): ParsedRedditUrl {
  const trimmed = (input ?? "").trim();
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return { ok: false, error: "That doesn’t look like a Reddit link." };
  }
  const host = url.hostname.toLowerCase();
  const parts = url.pathname.split("/").filter(Boolean);
  let id: string | undefined;
  let sub = "";
  if (host === "redd.it" || host === "www.redd.it") id = parts[0];
  else if (HOSTS.has(host)) {
    const i = parts.findIndex((p) => p.toLowerCase() === "comments");
    if (i !== -1) id = parts[i + 1];
    if (parts[0]?.toLowerCase() === "r" && /^[a-z0-9_]{2,30}$/i.test(parts[1] ?? "")) sub = parts[1];
    else if (parts.includes("s"))
      return { ok: false, error: "Open the Reddit share link in your browser, then copy the full address from the address bar." };
  } else return { ok: false, error: "That isn’t a Reddit link." };

  if (!id || !/^[a-z0-9]{4,12}$/i.test(id))
    return { ok: false, error: "That isn’t a Reddit post link. It should look like reddit.com/r/…/comments/…" };
  id = id.toLowerCase();
  const canonicalUrl = sub ? `https://www.reddit.com/r/${sub}/comments/${id}/` : `https://www.reddit.com/comments/${id}/`;
  return { ok: true, postId: id, canonicalUrl, shortcode: `reddit_${id}` };
}

