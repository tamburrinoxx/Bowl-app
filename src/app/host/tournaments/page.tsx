import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeleteTournamentButton from "./delete-button";
import { NavBar } from "@/components/nav-bar";
import type { Tournament } from "@/types";

export default async function HostTournamentsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: tournaments } = await supabase
    .from("tournaments")
    .select("*")
    .eq("host_id", user.id)
    .order("starts_at", { ascending: false, nullsFirst: false })
    .returns<Tournament[]>();

  return (
    <>
      <NavBar
        title="Host"
        backHref="/host/tournaments"
        links={[
          { label: "New tournament", href: "/host/tournaments/wizard" },
          { label: "Public tournaments", href: "/t" },
          { label: "My profile", href: "/profile" },
        ]}
      />
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 uppercase">
          Host
        </p>
        <div className="mb-8 flex items-baseline justify-between gap-4">
          <h1 className="font-display text-4xl text-ink">Your Tournaments</h1>
          <div className="flex shrink-0 items-center gap-3">
            <Link
              href="/host/tournaments/new"
              className="text-ink-soft text-sm hover:text-ink"
            >
              Manual
            </Link>
            <Link
              href="/host/tournaments/wizard"
              className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm hover:brightness-110"
            >
              Build one
            </Link>
          </div>
        </div>

        {tournaments?.length ? (
          <div className="space-y-3">
            {tournaments.map((t) => (
              <div key={t.id} className="glass-panel p-6">
              <Link
                href={`/host/tournaments/${t.id}`}
                className="block transition-opacity hover:opacity-80"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-display text-xl text-ink mb-1">{t.name}</p>
                    <p className="text-ink-soft text-sm">
                      {t.center_name ?? "Center TBD"}
                      {t.starts_at
                        ? ` · ${new Date(t.starts_at).toLocaleDateString()}`
                        : ""}
                    </p>
                  </div>
                  <span className="ml-4 flex shrink-0 items-center gap-3">
                    <span
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase ${
                        t.status === "in_progress"
                          ? "bg-accent/15 text-accent"
                          : "bg-white/8 text-ink-soft"
                      }`}
                    >
                      {t.status.replace("_", " ")}
                    </span>
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex justify-end border-t border-white/5 pt-3">
                <DeleteTournamentButton tournamentId={t.id} name={t.name} />
              </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="glass-panel p-6">
            <p className="text-ink-soft mb-4 text-sm">
              You haven&apos;t created a tournament yet.
            </p>
            <Link
              href="/host/tournaments/new"
              className="pill-button bg-accent text-on-accent inline-block px-5 py-2.5 text-sm hover:brightness-110"
            >
              Create your first
            </Link>
          </div>
        )}
      </div>
    </main>
    </>
  );
}
