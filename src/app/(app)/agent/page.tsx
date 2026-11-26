import { redirect } from "next/navigation";

// The agent now lives in "Ask Polarvane" (Full plan mode).
export default function AgentPage() {
  redirect("/copilot?mode=plan");
}
