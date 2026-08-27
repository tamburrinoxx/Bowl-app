import { redirect } from "next/navigation";
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: tournament } = await supabase
    .from("tournaments")
    .select("id, name, center_name, starts_at, host_id")
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
