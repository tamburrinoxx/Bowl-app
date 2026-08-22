import { Logo } from "@/components/logo";
import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <Logo className="mb-6 justify-center text-4xl" />
          <h1 className="font-display text-4xl text-ink mb-2">
            Who are you here as?
          </h1>
          <p className="text-ink-soft text-sm">
            Pick the path that fits what you&apos;re doing today.
          </p>
        </div>

        <div className="space-y-4">
          <Link
            href="/login"
            className="glass-panel p-6 flex items-center justify-between group hover:bg-white/8 transition-colors"
          >
            <div>
              <p className="font-display text-xl text-ink mb-1">
                Tournament Host
              </p>
              <p className="text-ink-soft text-sm">
                Create and run tournaments, verify scores, manage standings.
              </p>
            </div>
            <span className="text-accent text-2xl font-light group-hover:translate-x-1 transition-transform">
              →
            </span>
          </Link>

          <Link
            href="/profile"
            className="glass-panel p-6 flex items-center justify-between group hover:bg-white/8 transition-colors"
          >
            <div>
              <p className="font-display text-xl text-ink mb-1">Bowler</p>
              <p className="text-ink-soft text-sm">
                View your profile, track pattern-specific averages and handicaps.
              </p>
            </div>
            <span className="text-accent text-2xl font-light group-hover:translate-x-1 transition-transform">
              →
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
