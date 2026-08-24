import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";
import QrSheet from "./qr-sheet";

export default async function QrPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, center_name, starts_at")
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
      <div className="print:hidden">
        <NavBar
          crumbs={[
            { label: "Tournaments", href: "/host/tournaments" },
            { label: tournament.name, href: `/host/tournaments/${id}` },
            { label: "Lane card" },
          ]}
          backHref={`/host/tournaments/${id}`}
        />
      </div>
      <QrSheet
        tournamentId={id}
        name={tournament.name}
        centerName={tournament.center_name}
      />
    </>
  );
}
