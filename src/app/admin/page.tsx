import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/nav-bar";

const GLOBAL_PAGES = [
  { group: "Entry points", links: [
    { label: "Landing", href: "/", note: "host vs bowler split" },
    { label: "Login", href: "/login", note: "sign in / sign up" },
  ]},
  { group: "Host", links: [
    { label: "My tournaments", href: "/host/tournaments", note: "list, delete" },
    { label: "Build a tournament", href: "/host/tournaments/wizard", note: "guided, presets, free text" },
    { label: "Manual setup", href: "/host/tournaments/new", note: "raw form" },
  ]},
  { group: "Bowler", links: [
    { label: "Public tournaments", href: "/t", note: "what bowlers land on" },
    { label: "My profile", href: "/profile", note: "Bowl ID, averages, sessions" },
    { label: "Practice scoring", href: "/profile/score", note: "pin-tap sheet" },
  ]},
];

export default async function AdminPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: tournaments } = user
    ? await supabase
        .from("tournaments")
        .select("id, name, status")
        .eq("host_id", user.id)
        .order("starts_at", { ascending: false, nullsFirst: false })
    : { data: null };

  return (
    <>
      <NavBar title="Every page" />
      <main className="min-h-screen px-6 py-12">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-ink mb-2 text-4xl">All Pages</h1>
          <p className="text-ink-soft mb-8 text-sm">
            Every route in Pinfall, with tournament links already filled in.
          </p>

          {GLOBAL_PAGES.map((section) => (
            <div key={section.group} className="mb-8">
              <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
                {section.group}
              </p>
              <div className="space-y-2">
                {section.links.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="glass-panel flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-white/8"
                  >
                    <span>
                      <span className="text-ink block text-sm font-medium">{l.label}</span>
                      <span className="text-ink-soft text-xs">{l.note}</span>
                    </span>
                    <span className="text-ink-soft font-score shrink-0 text-xs">{l.href}</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}

          <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
            Per tournament
          </p>

          {!tournaments?.length ? (
            <p className="glass-panel text-ink-soft p-5 text-sm">
              {user
                ? "No tournaments yet — build one and its pages appear here."
                : "Sign in to see your tournaments."}
            </p>
          ) : (
            <div className="space-y-3">
              {tournaments.map((t) => (
                <div key={t.id} className="glass-panel p-5">
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <p className="text-ink font-medium">{t.name}</p>
                    <span className="text-ink-soft text-xs uppercase">
                      {t.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { label: "Host page", href: `/host/tournaments/${t.id}` },
                      { label: "Run brackets", href: `/host/tournaments/${t.id}/brackets` },
                      { label: "Lane card", href: `/host/tournaments/${t.id}/qr` },
                      { label: "Public standings", href: `/t/${t.id}` },
                      { label: "Public brackets", href: `/t/${t.id}/brackets` },
                      { label: "Your day", href: `/t/${t.id}/me` },
                    ].map((l) => (
                      <Link
                        key={l.href}
                        href={l.href}
                        className="bg-white/8 text-ink hover:bg-accent hover:text-on-accent rounded-full px-4 py-1.5 text-xs font-medium transition-colors"
                      >
                        {l.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
