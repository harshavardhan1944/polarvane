import { NotBuiltYet, PageHeader } from "@/components/NotBuiltYet";

export default function AnalyzePage() {
  return (
    <>
      <PageHeader title="New analysis" subtitle="Analyze comments on an Instagram post or Reel." />
      <NotBuiltYet
        step={2}
        title="Instagram link input, Apify collection and AI analysis"
        description="Here you'll paste a public Instagram post or Reel link, see a cost estimate, and start comment collection through Apify. Progress, errors and results will show on this page."
      />
    </>
  );
}
