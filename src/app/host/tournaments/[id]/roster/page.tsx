import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RosterGrid from "./roster-grid";

export const revalidate = 0;

export default async function RosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,handicap_base,handicap_percent")
    .eq("id", id)
    .single();

  const { data: entries } = await supabase
    .from("entries")
    .select("id,entry_name,lane,paid,squad_id,locked_handicap,scratch_division")
    .eq("tournament_id", id);

  const entryIds = (entries ?? []).map((e) => e.id);

  const { data: squads } = await supabase
    .from("squads")
    .select("id,label,starts_at")
    .eq("tournament_id", id)
    .order("starts_at", { nullsFirst: false });

  const { data: bowlers } = await supabase
    .from("entry_bowlers")
    .select("id,entry_id,position,name,average,handicap")
    .in("entry_id", entryIds);

  const { data: pots } = await supabase
    .from("side_pots")
    .select("id,name,pot_type,buy_in,scoring,participant,allow_multiple")
    .eq("tournament_id", id);

  const { data: buys } = await supabase
    .from("side_pot_entries")
    .select("id,side_pot_id,entry_id,bowler_slot,quantity,paid")
    .in("side_pot_id", (pots ?? []).map((p) => p.id));

  return (
    <main className="mx-auto w-full max-w-full px-4 pb-24 pt-6">
      <Link
        href={`/host/tournaments/${id}`}
        className="text-sm underline opacity-60"
      >
        Back to tournament
      </Link>
      <h1 className="font-display mt-3 text-3xl">
        {tournament?.name} — Roster
      </h1>
      <p className="mt-1 text-sm opacity-60">
        Edit averages, assign side action per bowler, and mark teams paid.
      </p>

      <RosterGrid
        base={Number(tournament?.handicap_base ?? 230)}
        percent={Number(tournament?.handicap_percent ?? 0.8)}
        entries={(entries ?? []) as never}
        squads={(squads ?? []) as never}
        bowlers={(bowlers ?? []) as never}
        pots={(pots ?? []) as never}
        buys={(buys ?? []) as never}
      />
    </main>
  );
}