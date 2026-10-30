// Apify's listed price for apify/instagram-comment-scraper is about $2.30 per
// 1,000 comments (a little higher on the free plan). Estimates only — the real
// charge is shown in your Apify billing page.
export const APIFY_PRICE_PER_1000_USD = { low: 2.3, high: 2.7 };
export const COMMENT_LIMITS = [50, 200, 500, 1000] as const;

export function estimateApifyCost(comments: number) {
  const f = (n: number) => `$${n.toFixed(2)}`;
  return `${f((comments / 1000) * APIFY_PRICE_PER_1000_USD.low)}–${f((comments / 1000) * APIFY_PRICE_PER_1000_USD.high)}`;
}
