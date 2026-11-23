import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignupForm from "./signup-form";

export const revalidate = 0;

type Opening = {
  squad_id: string;
  label: string;
  starts_at: string | null;
  cap: number;
  taken: number;
};

export default async function TeamSignupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id,name,signups_open,handicap_base,handicap_percent")
    .eq("id", id)
    .single();

  const { data: openings } = await supabase.rpc("squad_openings", {
    p_tournament: id,
  });

  if (!tournament) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-sm opacity-70">That signup link isn&apos;t valid.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-4 pb-16 pt-8">
      <header className="mb-6 text-center">
        <p className="text-xs uppercase tracking-[0.2em] opacity-60">Team signup</p>
        <h1 className="mt-1 text-2xl font-semibold">{tournament.name}</h1>
      </header>

      {tournament.signups_open ? (
        <SignupForm
          tournamentId={id}
          base={Number(tournament.handicap_base ?? 230)}
          percent={Number(tournament.handicap_percent ?? 0.8)}
          openings={(openings ?? []) as Opening[]}
        />
      ) : (
        <div className="glass-panel text-center">
          <p className="text-sm opacity-80">Signups are closed for this tournament.</p>
          <Link
            href={`/t/${id}`}
            className="mt-3 inline-block text-sm underline opacity-70"
          >
            View the tournament
          </Link>
        </div>
      )}
    </main>
  );
}
