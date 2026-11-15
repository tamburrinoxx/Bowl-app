import { createClient } from "@/lib/supabase/server";
import { pointsFor } from "@/lib/ryder";
import Link from "next/link";

export const revalidate = 0;

type M = {
  id: string; session_label: string; format: string;
  side_a_label: string; side_b_label: string;
  scores_a: number[] | null; scores_b: number[] | null;
  game_count: number | null; tie_buffer: number | null;
};

export default async function RyderRecap({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: tournament }, { data: teams }, { data: rows }] = await Promise.all([
    supabase.from("tournaments").select("id, name").eq("id", id).single(),
    supabase.from("ryder_teams").select("*").eq("tournament_id", id).order("side"),
    supabase.from("ryder_matches").select("*").eq("tournament_id", id).order("sort_order"),
  ]);

  const ms = (rows as M[]) ?? [];
  const t = (teams as { name: string; side: string; color: string | null }[]) ?? [];
  const nameA = t.find((x) => x.side === "A")?.name ?? "Team A";
  const nameB = t.find((x) => x.side === "B")?.name ?? "Team B";
  const colorA = t.find((x) => x.side === "A")?.color ?? "#FF4D4D";
  const colorB = t.find((x) => x.side === "B")?.color ?? "#4D8BFF";

  const res = (m: M) =>
    pointsFor(m.format, m.scores_a ?? [], m.scores_b ?? [], m.game_count ?? 2, m.tie_buffer ?? 20);

  const totalA = ms.reduce((s, m) => s + res(m).a, 0);
  const totalB = ms.reduce((s, m) => s + res(m).b, 0);

  const sessions = [...new Set(ms.map((m) => m.session_label))].map((label) => {
    const inIt = ms.filter((m) => m.session_label === label);
    return {
      label,
      a: inIt.reduce((s, m) => s + res(m).a, 0),
      b: inIt.reduce((s, m) => s + res(m).b, 0),
      count: inIt.length,
    };
  });

  const allGames = ms.flatMap((m) => [
    ...(m.scores_a ?? []).map((v) => ({ v, who: m.side_a_label })),
    ...(m.scores_b ?? []).map((v) => ({ v, who: m.side_b_label })),
  ]).filter((g) => g.v > 0);
  const highGame = allGames.sort((x, y) => y.v - x.v)[0];
  const decided = ms.filter((m) => res(m).decided).length;

  const winner = totalA > totalB ? nameA : totalB > totalA ? nameB : null;

  return (
    <main className="min-h-screen px-5 py-8">
      <Link href={`/t/${id}/ryder`} className="text-ink-soft mb-4 inline-block text-sm">
        &lsaquo; Back
      </Link>

      <div className="mx-auto max-w-xl rounded-3xl bg-[#1f2329] p-8 ring-1 ring-white/10">
        <p className="text-ink-soft text-center text-[11px] uppercase tracking-[0.3em]">
          Final
        </p>
        <h1 className="font-display text-ink mb-6 text-center text-3xl leading-tight">
          {tournament?.name ?? "Ryder Cup"}
        </h1>

        <div className="mb-6 flex items-end justify-center gap-8">
          <div className="text-center">
            <p className="text-ink-soft mb-1 text-sm uppercase tracking-wide">{nameA}</p>
            <p className="font-score text-7xl leading-none" style={{ color: colorA }}>
              {totalA}
            </p>
          </div>
          <p className="text-ink-soft pb-4 text-2xl">–</p>
          <div className="text-center">
            <p className="text-ink-soft mb-1 text-sm uppercase tracking-wide">{nameB}</p>
            <p className="font-score text-7xl leading-none" style={{ color: colorB }}>
              {totalB}
            </p>
          </div>
        </div>

        {winner && (
          <p className="font-display text-accent mb-6 text-center text-2xl">
            {winner} wins
          </p>
        )}

        <div className="mb-6 space-y-1.5">
          {sessions.map((s) => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5">
              <span className="text-ink flex-1 truncate text-sm">{s.label}</span>
              <span className="font-score text-sm" style={{ color: s.a > s.b ? colorA : undefined }}>
                {s.a}
              </span>
              <span className="text-ink-soft/40 text-xs">-</span>
              <span className="font-score text-sm" style={{ color: s.b > s.a ? colorB : undefined }}>
                {s.b}
              </span>
            </div>
          ))}
        </div>

        <div className="mb-6 grid grid-cols-3 gap-2 border-t border-white/10 pt-5">
          <div className="text-center">
            <p className="font-score text-ink text-xl leading-none">{decided}</p>
            <p className="text-ink-soft mt-1 text-[10px] uppercase">Matches</p>
          </div>
          <div className="text-center">
            <p className="font-score text-accent text-xl leading-none">{highGame?.v ?? "-"}</p>
            <p className="text-ink-soft mt-1 text-[10px] uppercase">High game</p>
          </div>
          <div className="text-center">
            <p className="font-score text-ink text-xl leading-none">{sessions.length}</p>
            <p className="text-ink-soft mt-1 text-[10px] uppercase">Sessions</p>
          </div>
        </div>

        <div className="mb-6 space-y-4 border-t border-white/10 pt-5">
          <p className="text-ink-soft text-[11px] uppercase tracking-[0.2em]">
            Every match
          </p>
          {sessions.map((s) => (
            <div key={s.label}>
              <p className="text-ink mb-1.5 text-sm font-semibold">{s.label}</p>
              <div className="space-y-1">
                {ms.filter((m) => m.session_label === s.label).map((m) => {
                  const r = res(m);
                  const ta = (m.scores_a ?? []).reduce((x, y) => x + (y || 0), 0);
                  const tb = (m.scores_b ?? []).reduce((x, y) => x + (y || 0), 0);
                  const tie = r.decided && r.a === r.b;
                  const sa = tie ? { color: "#B6FF2E" } : r.a > r.b ? { color: colorA } : undefined;
                  const sb = tie ? { color: "#B6FF2E" } : r.b > r.a ? { color: colorB } : undefined;
                  return (
                    <div key={m.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-3 py-1.5 text-xs">
                      <span className="flex-1 truncate" style={sa}>{m.side_a_label}</span>
                      <span className="font-score text-ink-soft shrink-0">{ta}-{tb}</span>
                      <span className="font-score text-accent w-10 shrink-0 text-center">{r.a}-{r.b}</span>
                      <span className="flex-1 truncate text-right" style={sb}>{m.side_b_label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-ink-soft/50 text-center text-[11px] uppercase tracking-[0.2em]">
          Pinfall
        </p>
      </div>

      <p className="text-ink-soft mt-4 text-center text-xs">
        Screenshot this to share it.
      </p>
    </main>
  );
}
