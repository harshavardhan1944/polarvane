// Apify's listed price for apify/instagram-comment-scraper is about $2.30 per
// 1,000 comments (a little higher on the free plan). Estimates only — the real
// charge is shown in your Apify billing page.
export const APIFY_PRICE_PER_1000_USD = { low: 2.3, high: 2.7 };
// "All" options are capped for cost safety. Two distinct values so we know whether to include replies.
export const ALL_COMMENTS = 5000; // every comment + replies
export const ALL_TOP_LEVEL = 4999; // every comment, no replies
export const COMMENT_LIMITS = [50, 200, 500, 1000, ALL_TOP_LEVEL, ALL_COMMENTS] as const;

export const isAllOption = (n: number) => n === ALL_COMMENTS || n === ALL_TOP_LEVEL;

export function limitLabel(n: number) {
  if (n === ALL_COMMENTS) return "All comments + replies (max 5,000)";
  if (n === ALL_TOP_LEVEL) return "All comments, no replies (max 5,000)";
  return `${n.toLocaleString()} comments`;
}

export function estimateApifyCost(comments: number) {
  const f = (n: number) => `$${n.toFixed(2)}`;
  return `${f((comments / 1000) * APIFY_PRICE_PER_1000_USD.low)}–${f((comments / 1000) * APIFY_PRICE_PER_1000_USD.high)}`;
}
