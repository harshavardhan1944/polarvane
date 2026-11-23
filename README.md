This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Find sources (where each brand's customers talk)

`/sources` scans every connected source for a brand, ranks them by real engagement (ratings, reviews, comments, posts), then analyzes only the ones you pick.

**One-time setup**

1. In Supabase, open the SQL editor and run `supabase/migrations/008_source_scans.sql`.
2. In Vercel → Settings → Environment Variables, add any of these (all optional), then redeploy:

| Variable | Turns on | Cost |
|---|---|---|
| `APIFY_TOKEN` (already used for Instagram) | Amazon rating counts + Google reviews for every location | Apify credit, capped ≈ $0.40 per scan |
| `GEMINI_API_KEY` (already used) | AI sentiment, themes, summary and actions | Gemini free tier |
| `YOUTUBE_API_KEY` | YouTube comments on brand videos | Free quota (Google Cloud → YouTube Data API v3) |
| `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET` | Reliable Reddit access from Vercel (Reddit blocks anonymous server requests) | Free (reddit.com/prefs/apps, "script" app) |
| `X_BEARER_TOKEN` | X recent posts | Paid X API |
| `DEFAULT_COUNTRY` | Country used when no market is typed (default `in`) | |
| `APIFY_MAPS_ACTOR`, `APIFY_AMAZON_ACTOR` | Swap the Apify scrapers (defaults: `compass/crawler-google-places`, `junglee/amazon-crawler`) | |

Google Play, App Store and News (GDELT) work with no key.

**How it decides:** a result only counts if every word of the brand name appears in it (so "boAt" doesn't match every boat). Sources are ranked on a log scale (100 = busiest), and the ones holding ~80% of the weight are pre-selected. Star ratings are used directly as sentiment; other text goes to Gemini, or keyword rules if Gemini isn't available. A source that fails shows its reason under "Not connected" and the rest of the scan continues. Re-scanning a brand shows how each source's volume changed since the last scan.
