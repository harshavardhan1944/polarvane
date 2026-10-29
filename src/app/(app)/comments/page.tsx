import { NotBuiltYet, PageHeader } from "@/components/NotBuiltYet";

export default function CommentsPage() {
  return (
    <>
      <PageHeader title="Comments" subtitle="Search, filter and export analyzed comments." />
      <NotBuiltYet
        step={6}
        title="Comment explorer and CSV export"
        description="A searchable table of every analyzed comment, with filters for sentiment, topic, post and date, plus a button to download results as CSV."
      />
    </>
  );
}
