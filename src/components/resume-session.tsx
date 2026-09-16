"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function ResumeSession() {
  const [draft, setDraft] = useState<{ label?: string; at: number } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("pinfall_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (Date.now() - d.at > 3 * 60 * 60 * 1000) return;
      const thrown = (d.games ?? []).some((g: { rolls: number[] }[]) =>
        g.some((f) => f.rolls.length > 0)
      );
      if (thrown) setDraft(d);
    } catch {}
  }, []);

  if (!draft) return null;

  return (
    <Link
      href="/profile/score"
      className="bg-accent/15 ring-accent/40 mb-4 flex items-center justify-between rounded-2xl p-4 ring-1 sm:mb-6"
    >
      <div>
        <p className="text-accent text-sm font-semibold">Session in progress</p>
        <p className="text-ink-soft text-xs">
          {draft.label || "Unsaved games"} — tap to keep bowling
        </p>
      </div>
      <span className="text-accent text-2xl font-light">→</span>
    </Link>
  );
}
