"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { capacityFor, assignLanes } from "@/lib/lanes";
import type { Entry } from "@/types";

export default function LaneBar({ entries }: { entries: Entry[] }) {
  const supabase = createClient();
  const router = useRouter();
  const [start, setStart] = useState("1");
  const [count, setCount] = useState("8");
  const [perPair, setPerPair] = useState("4");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const s = Number(start) || 0;
  const c = Number(count) || 0;
  const pp = Number(perPair) || 0;
  const cap = s > 0 && c > 0 && pp > 0 ? capacityFor(s, c, pp) : 0;
  const need = entries.length;
  const fits = cap >= need && need > 0;

  async function run(shuffle: boolean) {
    setBusy(true);
    setMsg(null);
    const rows = assignLanes(
      entries.map((e) => ({ id: e.id, lane: e.lane })),
      pp, s, c, { shuffle }
    );
    for (const r of rows) {
      const { error } = await supabase
        .from("entries").update({ lane: r.lane }).eq("id", r.id);
      if (error) { setBusy(false); setMsg(error.message); return; }
    }
    setBusy(false);
    setMsg(`Assigned ${rows.length} bowlers.`);
    router.refresh();
  }

  return (
    <div className="mb-4 rounded border border-white/10 bg-black/20 p-3">
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Start lane" value={start} onChange={setStart} />
        <Field label="Lanes" value={count} onChange={setCount} />
        <Field label="Per pair" value={perPair} onChange={setPerPair} />
        <button
          disabled={!fits || busy}
          onClick={() => run(false)}
          className="rounded bg-[#B6FF2E] px-3 py-2 font-bold text-black disabled:opacity-40"
        >Generate</button>
        <button
          disabled={!fits || busy}
          onClick={() => run(true)}
          className="rounded border border-[#B6FF2E] px-3 py-2 font-bold text-[#B6FF2E] disabled:opacity-40"
        >Randomize</button>
      </div>
      <p className={`mt-2 text-sm ${fits ? "text-white/60" : "text-red-400"}`}>
        Capacity {cap} / {need} entered{fits ? "" : " \u2014 not enough lanes"}
      </p>
      {msg && <p className="mt-1 text-sm text-white/80">{msg}</p>}
    </div>
  );
}

function Field({ label, value, onChange }: {
  label: string; value: string; onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col text-xs text-white/60">
      {label}
      <input
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-20 rounded border border-white/20 bg-black/40 px-2 py-1 text-white"
      />
    </label>
  );
}
