import { AnalyzeScreen } from "./AnalyzeScreen";

export const instant = false;
// Fetching post details can take up to ~2 minutes.
export const maxDuration = 300;

export default async function AnalyzePage(props: PageProps<"/analyze">) {
  return <AnalyzeScreen sp={await props.searchParams} />;
}
