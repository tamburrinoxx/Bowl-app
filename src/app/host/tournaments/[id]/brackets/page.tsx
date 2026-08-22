import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BracketsRunner from "./brackets-runner";

export default async function BracketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name")
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
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/host/tournaments/${id}`}
          className="text-accent mb-4 inline-block text-sm hover:brightness-110"
        >
          ← {tournament.name}
        </Link>
        <h1 className="font-display text-ink mb-8 text-4xl">Brackets</h1>
        <BracketsRunner tournamentId={id} />
      </div>
    </main>
  );
}
