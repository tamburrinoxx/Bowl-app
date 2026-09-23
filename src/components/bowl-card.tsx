"use client";

import { BADGES } from "@/lib/achievements";

const TIER: Record<string, string> = {
  game_300: "from-amber-300/30 to-amber-600/10 ring-amber-300/50",
  series_800: "from-amber-300/30 to-amber-600/10 ring-amber-300/50",
  split_7_10: "from-fuchsia-400/25 to-fuchsia-700/10 ring-fuchsia-400/50",
  game_250: "from-accent/25 to-accent/5 ring-accent/40",
  series_700: "from-accent/25 to-accent/5 ring-accent/40",
};

export default function BowlCard({
  code, earnedAt, detail,
}: {
  code: string;
  earnedAt: string;
  detail?: Record<string, unknown> | null;
}) {
  const b = BADGES[code];
  const tier = TIER[code] ?? "from-white/10 to-white/[0.02] ring-white/15";
  const headline =
    (detail?.score as number) ?? (detail?.series as number) ?? null;

  return (
    <div className={`relative aspect-[5/7] rounded-2xl bg-gradient-to-br ${tier} p-4 ring-1`}>
      <p className="font-score text-ink-soft text-[10px] uppercase tracking-[0.2em]">
        Pinfall
      </p>
      <div className="flex h-[62%] flex-col items-center justify-center">
        {headline ? (
          <p className="font-score text-ink text-5xl leading-none">{headline}</p>
        ) : (
          <p className="font-score text-ink text-2xl leading-tight text-center">
            {b?.name ?? code}
          </p>
        )}
      </div>
      <p className="text-ink text-center text-[13px] font-semibold leading-tight">
        {b?.name ?? code}
      </p>
      <p className="text-ink-soft mt-1 text-center text-[10px]">
        {new Date(earnedAt).toLocaleDateString()}
      </p>
    </div>
  );
}
