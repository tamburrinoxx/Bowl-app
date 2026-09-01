/**
 * Tournament phase shown as scoresheet frames.
 *
 * A tournament moves through these in order, so the scoresheet's own device —
 * numbered boxes with a mark corner — carries real information rather than
 * decorating. The current phase is "marked" the way a struck frame is.
 */

const PHASES = [
  { key: "draft", label: "Setup", hint: "Building it" },
  { key: "open", label: "Signups", hint: "Bowlers joining" },
  { key: "in_progress", label: "Bowling", hint: "Scores coming in" },
  { key: "completed", label: "Paid", hint: "Money out" },
];

export function PhaseStrip({ status }: { status: string; tournamentId?: string }) {
  const currentIndex = Math.max(0, PHASES.findIndex((p) => p.key === status));

  return (
    <div className="mb-4 flex items-center gap-2 overflow-x-auto">
      {PHASES.map((p, i) => {
        const done = i < currentIndex;
        const now = i === currentIndex;
        return (
          <div
            key={p.key}
            className={`relative shrink-0 rounded-full border px-3 py-1 ${
              now
                ? "border-accent bg-accent/10"
                : done
                  ? "border-white/15 bg-white/[0.04]"
                  : "border-white/10"
            } ${i === 0 ? "rounded-l-lg" : ""} ${
              i === PHASES.length - 1 ? "rounded-r-lg" : ""
            }`}
          >
            <span
              className={`absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
                now
                  ? "border-accent/50 text-accent"
                  : done
                    ? "border-white/15 text-ink-soft"
                    : "border-white/10 text-ink-soft/40"
              }`}
            >
              {done ? "×" : now ? "•" : ""}
            </span>

            <span
              className={`font-score mr-1 inline text-[10px] uppercase tracking-widest ${
                now ? "text-accent" : "text-ink-soft/60"
              }`}
            >
              {i + 1}
            </span>
            <span
              className={`inline text-xs font-medium ${
                now ? "text-accent" : done ? "text-ink" : "text-ink-soft"
              }`}
            >
              {p.label}
            </span>
            <span className="text-ink-soft ml-1 inline text-[11px] leading-tight">
              {now ? p.hint : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
