"use client";

import { useRouter } from "next/navigation";

export default function BackLink({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <button
      onClick={() => router.back()}
      className="text-ink-soft hover:text-ink mb-4 flex items-center gap-1 text-sm"
    >
      <span className="text-lg leading-none">‹</span>
      {label}
    </button>
  );
}
