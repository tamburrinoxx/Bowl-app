"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function TickerSwitch({ tournamentId, showTicker }: {
  tournamentId: string; showTicker: boolean;
}) {
  const supabase = createClient();
  const router = useRouter();
  const [on, setOn] = useState(showTicker);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    const next = !on;
    setBusy(true);
    const { error } = await supabase
      .from("tournaments").update({ show_ticker: next }).eq("id", tournamentId);
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setErr(null);
    setOn(next);
    router.refresh();
  }

  return (
    <>
    <button onClick={toggle} disabled={busy}
      className={`mt-3 rounded px-3 py-2 text-sm font-bold ${on
        ? "bg-[#B6FF2E] text-black"
        : "border border-white/20 text-white/70"}`}>
      Score ticker: {on ? "On" : "Off"}
    </button>
    {err && <p className="mt-1 text-xs text-red-400">{err}</p>}
    </>
  );
}
