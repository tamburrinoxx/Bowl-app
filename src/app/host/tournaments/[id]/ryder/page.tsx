import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import RyderPanel from "../ryder-panel";

export default async function HostRyderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments").select("id, name").eq("id", id).single();

  if (!tournament) {
    return (
      <main className="min-h-screen px-6 py-12">
        <p className="text-ink-soft">Tournament not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">
        <Link href={`/host/tournaments/${id}`} className="text-accent text-sm">
          &larr; {tournament.name}
        </Link>
        <h1 className="font-display text-ink mb-6 mt-2 text-3xl">Ryder Cup</h1>

        <div className="glass-panel p-6">
          <RyderPanel tournamentId={id} />
        </div>

        <p className="text-ink-soft mt-4 text-sm">
          Public TV display:{" "}
          <Link href={`/t/${id}/ryder`} className="text-accent">
            /t/{id}/ryder
          </Link>
        </p>
      </div>
    </main>
  );
}
