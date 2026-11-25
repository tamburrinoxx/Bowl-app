import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

type Row = {
  entry_id: string;
  team_name: string;
  squad: string | null;
  lane: number | null;
  slot: number;
  bowler: string;
  average: number | null;
  handicap: number | null;
  team_handicap: number | null;
  scratch: boolean;
};

export default async function PublicRosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("name,handicap_base,handicap_percent")
    .eq("id", id)
    .single();

  const { data } = await supabase.rpc("public_roster", { p_tournament: id });
  const rows = (data ?? []) as Row[];

  const teams: {
    id: string;
    name: string;
    squad: string | null;
    lane: number | null;
    hdcp: number;
    scratch: boolean;
    bowlers: Row[];
  }[] = [];

  for (const r of rows) {
    let t = teams.find((x) => x.id === r.entry_id);
    if (!t) {
      t = {
        id: r.entry_id,
        name: r.team_name,
        squad: r.squad,
        lane: r.lane,
        hdcp: Number(r.team_handicap ?? 0),
        scratch: r.scratch,
        bowlers: [],
      };
      teams.push(t);
    }
    t.bowlers.push(r);
  }

  const base = Number(tournament?.handicap_base ?? 230);
  const raw = Number(tournament?.handicap_percent ?? 0.8);
  const pct = Math.round((raw > 1 ? raw / 100 : raw) * 100);

  return (
    <main className="mx-auto max-w-3xl px-4 pb-20 pt-8">
      <Link href={`/t/${id}`} className="text-sm underline opacity-60">
        Back to tournament
      </Link>
      <h1 className="font-display mt-3 text-3xl">{tournament?.name}</h1>
      <p className="mt-1 text-sm opacity-70">
        Field and handicaps — {pct}% of {base}, rounded to whole pins, zero at{" "}
        {base} and above.
      </p>

      {teams.length === 0 ? (
        <p className="mt-8 text-sm opacity-50">No teams entered yet.</p>
      ) : (
        <div className="mt-6 grid gap-3">
          {teams.map((t) => (
            <section key={t.id} className="glass-panel">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {t.name}
                  {t.scratch && (
                    <span className="ml-2 rounded bg-[#B6FF2E] px-1.5 py-0.5 text-[10px] font-bold text-black">
                      SCRATCH
                    </span>
                  )}
                </h2>
                <span className="text-xs opacity-60">
                  {t.squad ?? "No squad"}
                  {t.lane ? ` · lane ${t.lane}` : ""} · {t.hdcp} team hdcp
                </span>
              </div>
              <table className="w-full text-sm">
                <tbody>
                  {t.bowlers.map((b) => (
                    <tr key={b.slot} className="border-t border-white/5">
                      <td className="py-1.5">{b.bowler}</td>
                      <td className="py-1.5 text-right tabular-nums opacity-70">
                        {b.average ?? "—"} avg
                      </td>
                      <td className="w-24 py-1.5 text-right tabular-nums">
                        {b.handicap ?? 0} hdcp
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}