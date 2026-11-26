import { connection } from "next/server";
import { PageHeader } from "@/components/NotBuiltYet";
import { redditConfigured } from "@/lib/reddit";

// Keys are read on the server only; the page shows just whether each source is connected.
const ITEMS = () => [
  {
    name: "Instagram public comments (via Apify)",
    detail: "Collects visible comments from public posts and Reels you paste in.",
    status: process.env.APIFY_TOKEN ? "Connected" : "Not connected yet",
  },
  {
    name: "Instagram official account connection (Meta)",
    detail: "Let creators and brands connect their own accounts with full permission.",
    status: "Planned",
  },
  { name: "Facebook", detail: "Official, authorized access only.", status: "Planned" },
  {
    name: "Reddit",
    detail:
      "Paste a Reddit thread link on Analyze. Uses Reddit’s official API when its keys are added, otherwise the Apify Reddit scraper. Usernames are never stored.",
    status: redditConfigured() ? "Connected (official API)" : process.env.APIFY_TOKEN ? "Connected (via Apify)" : "Not connected",
  },
  { name: "X", detail: "Official, authorized access only.", status: "Planned" },
];

export default async function IntegrationsPage() {
  await connection();
  return (
    <>
      <PageHeader
        title="Integrations"
        subtitle="Data sources Polarvane can use. Only working integrations are marked as connected."
      />
      <div className="panel divide-y divide-navy-700">
        {ITEMS().map((i) => (
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
