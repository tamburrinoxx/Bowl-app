"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { capacityFor, assignLanes } from "@/lib/lanes";
import type { Entry } from "@/types";

type Squad = { id: string; label: string };

export default function LaneBar({ entries }: { entries: Entry[] }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const [start, setStart] = useState("1");
  const [count, setCount] = useState("8");
  const [perPair, setPerPair] = useState("4");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [squadId, setSquadId] = useState<string>("all");

  const squadKey = entries.map((e) => e.squad_id ?? "").join(",");

  useEffect(() => {
    const ids = [...new Set(entries.map((e) => e.squad_id).filter(Boolean))] as string[];
    if (!ids.length) return;
    let off = false;
    (async () => {
      const { data } = await supabase
        .from("squads")
        .select("id,label,starts_at")
        .in("id", ids)
        .order("starts_at", { nullsFirst: false });
      if (off) return;
      const list = (data ?? []) as Squad[];
      setSquads(list);
      setSquadId((cur) => (cur === "all" && list[0] ? list[0].id : cur));
    })();
    return () => {
      off = true;
    };
  }, [supabase, squadKey]);

  const scoped =
    squadId === "all" ? entries : entries.filter((e) => e.squad_id === squadId);

  const s = Number(start) || 0;
  const c = Number(count) || 0;
  const pp = Number(perPair) || 0;
  const cap = s > 0 && c > 0 && pp > 0 ? capacityFor(s, c, pp) : 0;
  const need = scoped.length;
  const fits = cap >= need && need > 0;

  async function run(shuffle: boolean) {
    setBusy(true);
    setMsg(null);
    const rows = assignLanes(
      scoped.map((e) => ({ id: e.id, lane: e.lane })),
      pp,
      s,
      c,
      { shuffle }
    );
    for (const r of rows) {
      const { error } = await supabase
        .from("entries")
        .update({ lane: r.lane })
        .eq("id", r.id);
      if (error) {
        setBusy(false);
        setMsg(error.message);
        return;
      }
    }
    setBusy(false);
    const where = squads.find((q) => q.id === squadId)?.label ?? "all squads";
    setMsg(`Assigned ${rows.length} in ${where}.`);
    router.refresh();
  }

  const pill = (on: boolean) =>
    `rounded-full px-3 py-1 text-sm ${
      on ? "bg-[#B6FF2E] font-bold text-black" : "bg-white/10 text-white"
    }`;

  return (
    <div className="mb-4 rounded border border-white/10 bg-black/20 p-3">
      {squads.length > 1 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {squads.map((q) => (
            <button key={q.id} type="button" onClick={() => setSquadId(q.id)} className={pill(squadId === q.id)}>
              {q.label}
            </button>
          ))}
          <button type="button" onClick={() => setSquadId("all")} className={pill(squadId === "all")}>
            All
          </button>
        </div>
      )}
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