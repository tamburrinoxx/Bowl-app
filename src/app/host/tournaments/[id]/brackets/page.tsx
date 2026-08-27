import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BracketsRunner from "./brackets-runner";
import ShareLink from "./share-link";

export default async function BracketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, games_per_squad, host_id")
    .eq("id", id)
    .single();

  // Host pages carry rosters, money owed and payouts, so only the host who
  // owns this tournament may see them.
  if (!tournament || tournament.host_id !== user.id) {
    redirect("/host/tournaments");
  }

  if (!tournament) {
    return (
      <main className="min-h-screen px-6 py-12">
        <p className="text-ink-soft mx-auto max-w-2xl">Tournament not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/host/tournaments/${id}`}
          className="text-accent mb-4 inline-block text-sm hover:brightness-110"
        >
          ← {tournament.name}
        </Link>
        <h1 className="font-display text-ink mb-8 text-4xl">Brackets</h1>
        <ShareLink tournamentId={id} />
        <BracketsRunner tournamentId={id} gamesPerSquad={tournament.games_per_squad} />
      </div>
    </main>
  );
}
