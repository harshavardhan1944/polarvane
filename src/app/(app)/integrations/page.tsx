import { PageHeader } from "@/components/NotBuiltYet";

const ITEMS = [
  {
    name: "Instagram public comments (via Apify)",
    detail: "Collects visible comments from public posts and Reels you paste in.",
    status: process.env.APIFY_TOKEN ? "Connected" : "Not connected yet",
  },
  {
    name: "Amazon & Google reviews (via Apify)",
    detail: "Find sources: rating counts across a brand’s Amazon listings, and reviews for every Google Maps location.",
    status: process.env.APIFY_TOKEN ? "Connected" : "Needs APIFY_TOKEN",
  },
  {
    name: "Google Play & App Store reviews",
    detail: "Find sources: ratings and newest reviews for the brand’s apps. No key needed.",
    status: "Connected",
  },
  {
    name: "News & blogs (GDELT)",
    detail: "Find sources: articles mentioning the brand in the past 3 months. No key needed.",
    status: "Connected",
  },
  {
    name: "Reddit",
    detail: "Find sources: posts and comments from the past year. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET for reliable access from Vercel.",
    status: process.env.REDDIT_CLIENT_ID && process.env.REDDIT_CLIENT_SECRET ? "Connected" : "Limited (no key)",
  },
  {
    name: "YouTube comments",
    detail: "Find sources: comments on recent videos about the brand.",
    status: process.env.YOUTUBE_API_KEY ? "Connected" : "Needs YOUTUBE_API_KEY",
  },
  {
    name: "X (Twitter)",
    detail: "Find sources: recent posts (paid X API).",
    status: process.env.X_BEARER_TOKEN ? "Connected" : "Needs X_BEARER_TOKEN",
  },
  {
    name: "Instagram official account connection (Meta)",
    detail: "Let creators and brands connect their own accounts with full permission.",
    status: "Planned",
  },
  { name: "Facebook", detail: "Official, authorized access only.", status: "Planned" },
  { name: "Flipkart, Myntra/Nykaa, Zomato/Swiggy", detail: "No public APIs; planned via scrapers or seller exports.", status: "Planned" },
];

export default function IntegrationsPage() {
  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Data sources Polarvane can use. Only working integrations are marked as connected."
      />
      <div className="panel divide-y divide-navy-700">
        {ITEMS.map((i) => (
          <div key={i.name} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">{i.name}</p>
              <p className="text-xs text-muted">{i.detail}</p>
            </div>
            <span className="w-fit rounded-full border border-navy-600 bg-navy-800 px-2.5 py-1 text-xs text-muted">
              {i.status}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
