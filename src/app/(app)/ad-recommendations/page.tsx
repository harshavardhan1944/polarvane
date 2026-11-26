import { AdRecsScreen } from "./AdRecsScreen";

export const instant = false;
// Video checks upload and process a video, which can take a minute or two.
export const maxDuration = 300;

export default async function AdRecommendationsPage(props: PageProps<"/ad-recommendations">) {
  return <AdRecsScreen sp={await props.searchParams} />;
}
