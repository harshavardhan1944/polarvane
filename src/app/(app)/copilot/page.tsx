import { CopilotScreen } from "./CopilotScreen";

export const instant = false;

export default async function CopilotPage(props: PageProps<"/copilot">) {
  return <CopilotScreen sp={await props.searchParams} />;
}
