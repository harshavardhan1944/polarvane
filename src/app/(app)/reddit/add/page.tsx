import { AnalyzeScreen } from "../../analyze/AnalyzeScreen";

export const instant = false;
// Searching Reddit and collecting threads can take a minute or two.
export const maxDuration = 300;

export default async function RedditAddPage(props: PageProps<"/reddit/add">) {
  return <AnalyzeScreen sp={await props.searchParams} source="reddit" basePath="/reddit/add" />;
}
