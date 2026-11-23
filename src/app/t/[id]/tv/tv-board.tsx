"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Standing = {
  entry_id: string;
  entry_name: string;
  scratch_total: number;
  baker_total: number;
  handicap_total: number;
};

type Pot = { id: string; name: string; pot_type: string; scoring: string };
type Line = { pos: number; left: string; sub?: string; right: number };

export default function TvBoard({ tournamentId }: { tournamentId: string }) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const [title, setTitle] = useState("");
  const [standings, setStandings] = useState<Standing[]>([]);
  const [pots, setPots] = useState<Pot[]>([]);
  const [potBoards, setPotBoards] = useState<Record<string, Line[]>>({});
  const [updated, setUpdated] = useState("");

  const load = useCallback(async () => {
    const { data: t } = await supabase
      .from("tournaments")
      .select("name")
      .eq("id", tournamentId)
      .single();
    if (t?.name) setTitle(t.name as string);

    const { data: st } = await supabase
      .from("standings")
      .select("entry_id,entry_name,scratch_total,baker_total,handicap_total")
      .eq("tournament_id", tournamentId);
    const rows = (st ?? []) as Standing[];
    setStandings(rows);

    const { data: po } = await supabase
      .from("side_pots")
      .select("id,name,pot_type,scoring")
      .eq("tournament_id", tournamentId)
      .in("pot_type", ["high_game", "high_series"]);
    const potList = (po ?? []) as Pot[];
    setPots(potList);

    const ids = rows.map((r) => r.entry_id);
    if (!ids.length || !potList.length) {
      setPotBoards({});
      setUpdated(new Date().toLocaleTimeString());
      return;
    }

    const [{ data: pe }, { data: eb }, { data: gm }] = await Promise.all([
      supabase
        .from("side_pot_entries")
        .select("side_pot_id,entry_id")
        .in("side_pot_id", potList.map((p) => p.id)),
      supabase
        .from("entry_bowlers")
        .select("entry_id,position,name,handicap")
        .in("entry_id", ids),
      supabase
        .from("games")
        .select("entry_id,bowler_slot,scratch_score")
        .in("entry_id", ids),
    ]);

    const teamOf = new Map(rows.map((r) => [r.entry_id, r.entry_name]));
    const nameOf = new Map<string, string>();
    const hcpOf = new Map<string, number>();
    for (const b of (eb ?? []) as {
      entry_id: string;
      position: number;
      name: string | null;
      handicap: number | null;
    }[]) {
      const k = `${b.entry_id}:${b.position}`;
      nameOf.set(k, b.name ?? `Bowler ${b.position}`);
      hcpOf.set(k, Number(b.handicap ?? 0));
    }

    const scoresOf = new Map<string, number[]>();
    for (const g of (gm ?? []) as {
      entry_id: string;
      bowler_slot: number | null;
      scratch_score: number;
    }[]) {
      const k = `${g.entry_id}:${g.bowler_slot ?? 1}`;
      const arr = scoresOf.get(k) ?? [];
      arr.push(Number(g.scratch_score));
      scoresOf.set(k, arr);
    }

    const boards: Record<string, Line[]> = {};
    for (const p of potList) {
      const inPot = new Set(
        ((pe ?? []) as { side_pot_id: string; entry_id: string }[])
          .filter((x) => x.side_pot_id === p.id)
          .map((x) => x.entry_id)
      );
      const out: { name: string; team: string; score: number }[] = [];
      for (const [k, scores] of scoresOf) {
        const entryId = k.slice(0, k.lastIndexOf(":"));
        if (!inPot.has(entryId) || !scores.length) continue;
        const h = p.scoring === "handicap" ? hcpOf.get(k) ?? 0 : 0;
        const score =
          p.pot_type === "high_game"
            ? Math.max(...scores.map((s) => s + h))
            : scores.reduce((a, b) => a + b, 0) + h * scores.length;
        out.push({
          name: nameOf.get(k) ?? "Bowler",
          team: teamOf.get(entryId) ?? "",
          score,
        });
      }
      boards[p.id] = out
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((x, i) => ({ pos: i + 1, left: x.name, sub: x.team, right: x.score }));
    }
    setPotBoards(boards);
    setUpdated(new Date().toLocaleTimeString());
  }, [supabase, tournamentId]);

  useEffect(() => {
    load();
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let dir = 1;
    const id = setInterval(() => {
      if (el.scrollHeight <= el.clientHeight + 4) return;
      el.scrollTop += dir;
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) dir = -1;
      if (el.scrollTop <= 0) dir = 1;
    }, 40);
    return () => clearInterval(id);
  }, []);

  const byHcp = [...standings]
    .sort((a, b) => b.handicap_total - a.handicap_total)
    .slice(0, 20)
    .map((r, i) => ({ pos: i + 1, left: r.entry_name, right: r.handicap_total }));
  const byScr = [...standings]
    .sort((a, b) => (b.scratch_total + b.baker_total) - (a.scratch_total + a.baker_total))
    .slice(0, 20)
    .map((r, i) => ({ pos: i + 1, left: r.entry_name, right: r.scratch_total + r.baker_total }));

  return (
    <main className="flex h-screen flex-col bg-black p-6 text-white print:h-auto print:bg-white print:text-black">
      <header className="mb-4 flex items-baseline justify-between">
        <h1 className="font-display text-4xl">{title}</h1>
        <span className="text-xs uppercase tracking-[0.3em] opacity-50 print:hidden">
          Live · {updated}
        </span>
      </header>

      <div ref={scroller} className="flex-1 overflow-hidden print:overflow-visible">
        <div className="grid gap-8 lg:grid-cols-2">
          <Board title="Handicap standings" lines={byHcp} />
          <Board title="Scratch pinfall" lines={byScr} />
          {pots.map((p) => (
            <Board key={p.id} title={`${p.name} — ${p.scoring}`} lines={potBoards[p.id] ?? []} />
          ))}
        </div>
      </div>

      <button
        onClick={() => window.print()}
        className="fixed bottom-4 right-4 rounded-lg bg-white/10 px-3 py-2 text-xs print:hidden"
      >
        Print
      </button>
    </main>
  );
}

function Board({ title, lines }: { title: string; lines: Line[] }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="sticky top-0 z-10 mb-2 border-b border-white/15 bg-black pb-1 text-base uppercase tracking-wide opacity-70 print:border-black/20">
        {title}
      </h2>
      <ol className="divide-y divide-white/5 print:divide-black/10">
        {lines.length === 0 ? (
          <li className="py-2 text-sm opacity-40">No results yet</li>
        ) : (
          lines.map((r) => (
            <li key={`${r.pos}-${r.left}`} className="flex items-baseline gap-3 py-1.5">
              <span className="font-score w-8 text-right text-xl opacity-50">{r.pos}</span>
              <span className="flex-1 truncate text-xl">
                {r.left}
                {r.sub ? <span className="ml-2 text-sm opacity-50">{r.sub}</span> : null}
              </span>
              <span className="font-score text-2xl tabular-nums">{r.right}</span>
            </li>
          ))
        )}
      </ol>
    </section>
  );
}