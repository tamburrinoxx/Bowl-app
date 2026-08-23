import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";
import MyTournament from "./my-tournament";

export default async function MyTournamentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, games_per_squad")
    .eq("id", id)
    .single();

  if (!tournament) {
    return (
      <main className="min-h-screen px-6 py-12">
        <p className="text-ink-soft mx-auto max-w-2xl">Tournament not found.</p>
      </main>
    );
  }

  return (
    <>
      <NavBar
        title={tournament.name}
        backHref={`/t/${id}`}
        links={[
          { label: "Standings", href: `/t/${id}` },
          { label: "Brackets", href: `/t/${id}/brackets` },
          { label: "All tournaments", href: "/t" },
        ]}
      />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-ink mb-8 text-4xl">Your Day</h1>
          <MyTournament
            tournamentId={id}
            gamesPerSquad={tournament.games_per_squad}
          />
        </div>
      </main>
    </>
  );
}
