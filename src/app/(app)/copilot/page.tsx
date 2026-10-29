import { NotBuiltYet, PageHeader } from "@/components/NotBuiltYet";

export default function CopilotPage() {
  return (
    <>
      <PageHeader title="Talon Copilot" subtitle="Ask questions about your audience in plain English." />
      <NotBuiltYet
        step={7}
        title="Talon AI Copilot"
        description="Ask things like “What topics does my audience love?” or “Give me content ideas.” Talon will answer only from your analyzed comments and quote real comments as evidence."
      />
    </>
  );
}
