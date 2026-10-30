"use client";

import { useRouter } from "next/navigation";

export function PostFilter({
  posts,
  value,
}: {
  posts: { id: string; label: string }[];
  value: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label="Choose post"
      value={value}
      onChange={(e) => router.push(e.target.value ? `/?post=${e.target.value}` : "/")}
      className="rounded-lg border border-navy-700 bg-navy-850 px-3 py-2 text-sm text-ink outline-none focus:border-brand-blue"
    >
      <option value="">All analyzed posts</option>
      {posts.map((p) => (
        <option key={p.id} value={p.id}>
          {p.label}
        </option>
      ))}
    </select>
  );
}
