import Link from "next/link";
import { PageHeader } from "@/components/NotBuiltYet";
import { createClient } from "@/lib/supabase/server";
import { TalonChat } from "./TalonChat";

export const instant = false;

export default async function CopilotPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("analyses")
    .select("id, shortcode, post_type")
    .eq("status", "completed")
    .order("created_at", { ascending: false });
  const posts = (data ?? []).map((a) => ({
    id: a.id as string,
    label: `${a.post_type === "reel" ? "Reel" : "Post"} · ${a.shortcode}`,
  }));

  return (
    <>
      <PageHeader title="Talon Copilot" subtitle="Ask questions about your audience in plain English." />
      {posts.length === 0 ? (
        <div className="panel p-6 text-sm text-muted">
          Talon needs analyzed comments to answer questions.{" "}
          <Link href="/analyze" className="text-brand-blue hover:underline">
            Analyze a post first
          </Link>
          .
        </div>
      ) : (
        <TalonChat posts={posts} />
      )}
    </>
  );
}
