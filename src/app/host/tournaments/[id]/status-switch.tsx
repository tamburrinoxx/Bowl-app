"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["draft", "open", "in_progress", "completed"] as const;

export default function StatusSwitch({
  tournamentId,
  status,
}: {
  tournamentId: string;
  status: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function change(next: string) {
    setBusy(true);
    setMessage(null);
    const { error } = await supabase
      .from("tournaments")
      .update({ status: next })
      .eq("id", tournamentId);
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setCurrent(next);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy || s === current}
            onClick={() => change(s)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase transition-colors ${
              s === current
                ? "bg-accent text-on-accent"
                : "bg-white/5 text-ink-soft hover:bg-white/8"
            }`}
          >
            {s.replace("_", " ")}
          </button>
        ))}
      </div>
      <p className="text-ink-soft mt-2 text-xs">
        Bowlers can only sign themselves up while this is Open or In Progress.
        {message ? ` · ${message}` : ""}
      </p>
    </div>
  );
}
