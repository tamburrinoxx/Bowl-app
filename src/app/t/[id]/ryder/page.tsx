import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { pointsFor } from "@/lib/ryder";
import AutoScroll from "./auto-scroll";

export const revalidate = 0;

export default async function RyderTvPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments").select("id, name").eq("id", id).single();
  const { data: teams } = await supabase
    .from("ryder_teams").select("*").eq("tournament_id", id).order("side");
  const { data: matches } = await supabase
    .from("ryder_matches").select("*").eq("tournament_id", id).order("sort_order");

  const rows = (matches as { id: string; session_label: string; format: string;
    side_a_label: string; side_b_label: string;
    score_a: number | null; score_b: number | null;
    scores_a: number[] | null; scores_b: number[] | null;
    game_count: number | null; tie_buffer: number | null; lane: string | null }[]) ?? [];
  const t = (teams as { name: string; side: string; color: string | null }[]) ?? [];
  const colorA = t.find((x) => x.side === "A")?.color ?? "#FF4D4D";
  const colorB = t.find((x) => x.side === "B")?.color ?? "#4D8BFF";

  function pts(m: (typeof rows)[number]) {
    const r = pointsFor(m.format, m.scores_a ?? [], m.scores_b ?? [], m.game_count ?? 2, m.tie_buffer ?? 20);
    return [r.a, r.b];
    /* legacy
    if (m.score_a == null || m.score_b == null) return [0, 0];
    if (m.score_a > m.score_b) return [1, 0];
    if (m.score_b > m.score_a) return [0, 1];
    return [0.5, 0.5];
    */
  }
  const totalA = rows.reduce((s, m) => s + pts(m)[0], 0);
  const totalB = rows.reduce((s, m) => s + pts(m)[1], 0);

  return (
    <main className="flex h-screen flex-col px-8 py-6">
      <Link href={`/t/${id}`} className="text-ink-soft hover:text-ink absolute left-4 top-4 text-sm">
        ‹ Back
      </Link>
      <h1 className="font-display text-ink mb-4 shrink-0 text-center text-3xl">
        {tournament?.name ?? "Ryder Cup"}
      </h1>

      <div className="mb-6 flex shrink-0 items-center justify-center gap-12">
        <div className="text-center">
          <p className="text-ink-soft text-lg uppercase">
            {t.find((x) => x.side === "A")?.name ?? "Team A"}
          </p>
          <p className="font-score text-8xl leading-none" style={{ color: colorA }}>{totalA}</p>
        </div>
        <span className="text-ink-soft text-2xl">-</span>
        <div className="text-center">
          <p className="text-ink-soft text-lg uppercase">
            {t.find((x) => x.side === "B")?.name ?? "Team B"}
          </p>
          <p className="font-score text-8xl leading-none" style={{ color: colorB }}>{totalB}</p>
        </div>
      </div>

      <AutoScroll>
        {rows.map((m) => {
          const p = pts(m);
          const ta = (m.scores_a ?? []).reduce((x, y) => x + (y || 0), 0);
          const tb = (m.scores_b ?? []).reduce((x, y) => x + (y || 0), 0);
          const done = ta > 0 || tb > 0;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2">
              <span className="text-ink-soft w-40 shrink-0 text-xs uppercase">
                {m.session_label} - {m.format}
              </span>
              <span className="flex-1 truncate" style={p[0] > p[1] ? { color: colorA, fontWeight: 700 } : undefined}>
                {m.side_a_label}
              </span>
              <span className="font-score text-ink w-24 shrink-0 text-center text-xl">
                {done ? ` - ` : "vs"}
              </span>
              <span className="flex-1 truncate text-right" style={p[1] > p[0] ? { color: colorB, fontWeight: 700 } : undefined}>
                {m.side_b_label}
              </span>
            </div>
          );
        })}
      </AutoScroll>

    </main>
  );
}
