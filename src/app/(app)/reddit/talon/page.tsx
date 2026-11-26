import { CopilotScreen } from "../../copilot/CopilotScreen";

export const instant = false;

// Talon, answering only from Reddit threads.
export default async function RedditTalonPage(props: PageProps<"/reddit/talon">) {
  const sp = await props.searchParams;
  const d = typeof sp.d === "string" ? sp.d : "";
  return <CopilotScreen sp={sp} source="reddit" basePath="/reddit/talon" addHref={`/reddit/add${d ? `?d=${d}` : ""}`} />;
}
