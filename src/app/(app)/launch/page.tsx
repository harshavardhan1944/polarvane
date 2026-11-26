import { PageHeader } from "@/components/NotBuiltYet";
import { listLaunches } from "./actions";
import { LaunchPlanner } from "./LaunchPlanner";

export const instant = false;
// Each step (search, collection check, AI question) can take up to a minute or two.
export const maxDuration = 300;

export default async function LaunchPage() {
  const saved = await listLaunches().catch(() => []);
  return (
    <>
      <PageHeader
        title="Launch planner"
        subtitle="Launching a product or entering a new market? The agent reads what shoppers there already say about the category (Reddit, competitor posts) and what AI assistants recommend, then writes one launch plan."
      />
      <LaunchPlanner initial={saved} />
    </>
  );
}
