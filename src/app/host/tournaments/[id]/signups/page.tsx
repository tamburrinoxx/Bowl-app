import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignupsList from "./signups-list";

export const revalidate = 0;

export default async function HostSignupsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,signups_open")
    .eq("id", id)
    .single();

  const { data: squads } = await supabase
    .from("squads")
    .select("id,label,starts_at,max_entries")
    .eq("tournament_id", id)
    .order("starts_at", { nullsFirst: false });

  const { data: signups } = await supabase
    .from("team_signups")
    .select(
      "id,squad_id,entry_id,team_name,captain_email,waitlisted,scratch_division,created_at," +
        "team_signup_bowlers(id,slot,bowler_name,phone,reported_average,verified_average,handicap)"
    )
    .eq("tournament_id", id)
    .order("created_at");

  return (
    <main className="mx-auto max-w-2xl px-4 pb-16 pt-8">
      <Link href={`/host/tournaments/${id}`} className="text-sm underline opacity-60">
        Back to tournament
      </Link>
      <header className="mb-6 mt-3">
        <h1 className="text-2xl font-semibold">Team signups</h1>
        <p className="mt-1 text-sm opacity-60">
          {tournament?.name}
          {tournament?.signups_open ? " — signups open" : " — signups closed"}
        </p>
        <p className="mt-2 text-xs opacity-50">
          Tap any average to correct it after checking bowl.com.
        </p>
      </header>

      <SignupsList
        squads={squads ?? []}
        signups={(signups ?? []) as never}
      />
    </main>
  );
}
