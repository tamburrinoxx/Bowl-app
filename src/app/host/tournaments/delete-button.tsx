"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function DeleteTournamentButton({
  tournamentId,
  name,
}: {
  tournamentId: string;
  name: string;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const typed = prompt(
      `Delete "${name}"? Entries, scores, side pots and brackets all go with it.\n\nType the tournament name to confirm.`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== name.trim().toLowerCase()) {
      setError("Name didn't match — nothing deleted.");
      return;
    }

    setBusy(true);
    setError(null);
    const { error: err } = await supabase
      .from("tournaments")
      .delete()
      .eq("id", tournamentId);
    setBusy(false);

    if (err) {
      setError(err.message);
      return;
    }
    router.refresh();
  }

  return (
    <span className="shrink-0">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="text-ink-soft text-xs hover:text-red-400 disabled:opacity-40"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="ml-2 text-xs text-red-400">{error}</span>}
    </span>
  );
}
