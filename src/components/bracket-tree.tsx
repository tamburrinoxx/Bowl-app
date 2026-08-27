import { formatMoney } from "@/lib/payouts";

export interface TreeMatch {
  id: string;
  round_number: number;
  match_number: number;
  entry_a: string | null;
  entry_b: string | null;
  seed_a: number | null;
  seed_b: number | null;
  score_a: number | null;
  score_b: number | null;
  winner_entry_id: string | null;
  status: string;
}

/**
 * Classic single-elimination bracket.
 *
 * Each match box holds two slots. Flexbox puts them at 25% and 75% of the box
 * height, so a connector drawn from 25% to 75% exits at the vertical centre —
 * exactly where the next round's slot sits, since that box is twice as tall.
 * The lines line up at any bracket size without hard-coded pixels.
 */
export function BracketTree({
  matches,
  names,
  winnerPay,
  runnerUpPay,
  renderScore,
}: {
  matches: TreeMatch[];
  names: Record<string, string>;
  winnerPay?: number;
  runnerUpPay?: number;
  renderScore?: (m: TreeMatch, side: "a" | "b") => React.ReactNode;
}) {
  if (!matches.length) return null;

  const rounds = [...new Set(matches.map((m) => m.round_number))].sort((a, b) => a - b);
  const lastRound = Math.max(...rounds);
  const final = matches.find((m) => m.round_number === lastRound);
  const champ = final?.winner_entry_id ?? null;
  const runnerUp =
    final && champ ? (final.entry_a === champ ? final.entry_b : final.entry_a) : null;

  const firstRoundCount = matches.filter((m) => m.round_number === rounds[0]).length;
  const minHeight = Math.max(220, firstRoundCount * 72);

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-[560px] gap-5" style={{ minHeight }}>
        {rounds.map((r) => {
          const inRound = matches
            .filter((m) => m.round_number === r)
            .sort((a, b) => a.match_number - b.match_number);
          const isFinal = r === lastRound;

          return (
            <div key={r} className="flex min-w-[150px] flex-1 flex-col">
              <p className="text-ink-soft mb-2 text-center text-[10px] uppercase tracking-[0.2em]">
                {isFinal ? "Final" : `Round ${r}`}
              </p>
              <div className="flex flex-1 flex-col">
                {inRound.map((m) => (
                  <div key={m.id} className="relative flex flex-1 flex-col justify-around">
                    <Slot match={m} side="a" names={names} renderScore={renderScore} />
                    <Slot match={m} side="b" names={names} renderScore={renderScore} />

                    {!isFinal && (
                      <>
                        <span className="absolute right-0 top-1/4 h-1/2 w-px bg-white/20" />
                        <span className="absolute right-0 top-1/2 h-px w-5 translate-x-full bg-white/20" />
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="flex min-w-[150px] flex-col">
          <p className="text-ink-soft mb-2 text-center text-[10px] uppercase tracking-[0.2em]">
            Champion
          </p>
          <div className="flex flex-1 flex-col justify-center gap-2">
            <div className={`rounded-xl px-3 py-2.5 ${champ ? "bg-accent/15 ring-accent/40 ring-1" : "bg-white/5"}`}>
              <span className="text-ink-soft block text-[9px] uppercase tracking-widest">1st</span>
              <span className="flex items-center justify-between gap-2">
                <span className={`truncate text-sm ${champ ? "text-accent font-semibold" : "text-ink-soft"}`}>
                  {champ ? names[champ] : "TBD"}
                </span>
                {winnerPay != null && (
                  <span className="font-score text-accent shrink-0 text-sm">
                    {formatMoney(winnerPay)}
                  </span>
                )}
              </span>
            </div>

            {runnerUpPay != null && (
              <div className={`rounded-xl px-3 py-2.5 ${runnerUp ? "bg-white/[0.07]" : "bg-white/5"}`}>
                <span className="text-ink-soft block text-[9px] uppercase tracking-widest">2nd</span>
                <span className="flex items-center justify-between gap-2">
                  <span className={`truncate text-sm ${runnerUp ? "text-ink" : "text-ink-soft"}`}>
                    {runnerUp ? names[runnerUp] : "TBD"}
                  </span>
                  <span className="font-score text-ink-soft shrink-0 text-sm">
                    {formatMoney(runnerUpPay)}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Slot({
  match,
  side,
  names,
  renderScore,
}: {
  match: TreeMatch;
  side: "a" | "b";
  names: Record<string, string>;
  renderScore?: (m: TreeMatch, side: "a" | "b") => React.ReactNode;
}) {
  const entryId = side === "a" ? match.entry_a : match.entry_b;
  const seed = side === "a" ? match.seed_a : match.seed_b;
  const score = side === "a" ? match.score_a : match.score_b;
  const done = match.status === "complete";
  const won = done && match.winner_entry_id === entryId;
  const lost = done && entryId != null && match.winner_entry_id !== entryId;

  return (
    <span className={`flex items-center justify-between gap-2 border-b pb-1 text-xs ${won ? "border-accent" : "border-white/20"}`}>
      <span className="flex min-w-0 items-baseline gap-1.5">
        {seed != null && (
          <span className="font-score text-ink-soft/60 shrink-0 text-[10px]">{seed}</span>
        )}
        <span className={`truncate ${won ? "text-accent font-semibold" : lost ? "text-ink-soft/50" : "text-ink"}`}>
          {entryId ? (names[entryId] ?? "—") : "TBD"}
        </span>
      </span>

      <span className="shrink-0">
        {renderScore ? (
          renderScore(match, side)
        ) : (
          <span className={`font-score text-xs ${won ? "text-accent" : "text-ink-soft"}`}>
            {score ?? ""}
          </span>
        )}
      </span>
    </span>
  );
}
