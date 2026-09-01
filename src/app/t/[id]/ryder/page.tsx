import { createClient } from "@/lib/supabase/server";

export const revalidate = 10;

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
    score_a: number | null; score_b: number | null }[]) ?? [];
  const t = (teams as { name: string; side: string }[]) ?? [];

  function pts(m: (typeof rows)[number]) {
    if (m.score_a == null || m.score_b == null) return [0, 0];
    if (m.score_a > m.score_b) return [1, 0];
    if (m.score_b > m.score_a) return [0, 1];
    return [0.5, 0.5];
  }
  const totalA = rows.reduce((s, m) => s + pts(m)[0], 0);
  const totalB = rows.reduce((s, m) => s + pts(m)[1], 0);

  return (
    <main className="flex h-screen flex-col px-8 py-6">
      <h1 className="font-display text-ink mb-4 shrink-0 text-center text-3xl">
        {tournament?.name ?? "Ryder Cup"}
      </h1>

      <div className="mb-6 flex shrink-0 items-center justify-center gap-12">
        <div className="text-center">
          <p className="text-ink-soft text-lg uppercase">
            {t.find((x) => x.side === "A")?.name ?? "Team A"}
          </p>
          <p className="font-score text-accent text-8xl leading-none">{totalA}</p>
        </div>
        <span className="text-ink-soft text-2xl">-</span>
        <div className="text-center">
          <p className="text-ink-soft text-lg uppercase">
            {t.find((x) => x.side === "B")?.name ?? "Team B"}
          </p>
          <p className="font-score text-accent text-8xl leading-none">{totalB}</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-4xl flex-1 space-y-1.5 overflow-y-auto">
        {rows.map((m) => {
          const p = pts(m);
          const done = m.score_a != null && m.score_b != null;
          return (
            <div key={m.id} className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2">
              <span className="text-ink-soft w-40 shrink-0 text-xs uppercase">
                {m.session_label} - {m.format}
              </span>
              <span className={`flex-1 truncate ${p[0] > p[1] ? "text-accent" : "text-ink"}`}>
                {m.side_a_label}
              </span>
              <span className="font-score text-ink w-24 shrink-0 text-center text-xl">
                {done ? `${m.score_a} - ${m.score_b}` : "vs"}
              </span>
              <span className={`flex-1 truncate text-right ${p[1] > p[0] ? "text-accent" : "text-ink"}`}>
                {m.side_b_label}
              </span>
            </div>
          );
        })}
      </div>

    </main>
  );
}
