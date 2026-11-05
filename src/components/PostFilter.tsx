"use client";

import { useRouter } from "next/navigation";

export function PostFilter({
  posts,
  value,
  kind = "",
}: {
  posts: { id: string; label: string }[];
  value: string;
  kind?: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Choose post"
      value={value}
      onChange={(e) => {
        const params = new URLSearchParams();
        if (kind) params.set("kind", kind);
        if (e.target.value) params.set("post", e.target.value);
        const qs = params.toString();
        router.push(qs ? `/?${qs}` : "/");
      }}
      className="rounded-lg border border-navy-700 bg-navy-850 px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue"
    >
      <option value="">{kind ? "All posts of this type" : "All analyzed posts"}</option>
      {posts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
