import { CopilotScreen } from "./CopilotScreen";

export const instant = false;
// Full plan mode runs agent steps that can wait on the AI service.
export const maxDuration = 300;

export default async function CopilotPage(props: PageProps<"/copilot">) {
  return <CopilotScreen sp={await props.searchParams} />;
}
