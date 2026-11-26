import { AdRecsScreen } from "../../ad-recommendations/AdRecsScreen";

export const instant = false;
// Video checks upload and process a video, which can take a minute or two.
export const maxDuration = 300;

// Ad recommendations, ad brief and video ad checker using Reddit threads only.
export default async function RedditAdsPage(props: PageProps<"/reddit/ads">) {
  return <AdRecsScreen sp={await props.searchParams} source="reddit" basePath="/reddit/ads" />;
}
