"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatMoney } from "@/lib/payouts";
import ScoreTicker from "./score-ticker";

export interface BoardRow {
  entry_id: string;
  entry_name: string;
  games_played: number;
  scratch_total: number;
  handicap_total: number;
}

export default function StandingsBoard({
  rows,
  payouts,
  gamesPerSquad,
  showTicker,
}: {
  rows: BoardRow[];
  payouts: { position: number; amount: number }[];
  gamesPerSquad: number;
  showTicker: boolean;
}) {
  const supabase = createClient();
  const [myEntryId, setMyEntryId] = useState<string | null>(null);

  const [gameMap, setGameMap] = useState<Record<string, Record<number, number>>>({});

  useEffect(() => {
    if (!rows.length) return;
    let off = false;
    (async () => {
      const { data } = await supabase
        .from("games")
        .select("entry_id, game_number, scratch_score")
        .in("entry_id", rows.map((r) => r.entry_id));
      if (off) return;
      const m: Record<string, Record<number, number>> = {};
      for (const g of (data as { entry_id: string; game_number: number; scratch_score: number }[]) ?? []) {
        (m[g.entry_id] ||= {})[g.game_number] =
          (m[g.entry_id][g.game_number] ?? 0) + g.scratch_score;
      }
      setGameMap(m);
    })();
    return () => { off = true; };
  }, [rows, supabase]);

  useEffect(() => {
    let cancelled = false;
    async function findMe() {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user || !rows.length) return;
      const { data: links } = await supabase
        .from("entry_bowlers")
        .select("entry_id")
        .eq("bowler_id", auth.user.id)
        .in("entry_id", rows.map((r) => r.entry_id));
      if (!cancelled) setMyEntryId(links?.[0]?.entry_id ?? null);
    }
    findMe();
    return () => {
      cancelled = true;
    };
  }, [supabase, rows]);

  if (!rows.length) {
    return (
      <p className="text-ink-soft rounded-2xl bg-white/5 px-4 py-8 text-center text-sm">
        No entries yet. Check back once bowlers are signed up.
      </p>
    );
  }

  const payFor = new Map(payouts.map((p) => [p.position, Number(p.amount)]));
  const cashLine = payouts.length;
  const leader = rows[0]?.handicap_total ?? 0;
  const cashMark = cashLine > 0 ? rows[cashLine - 1]?.handicap_total ?? 0 : 0;
  const myIndex = myEntryId ? rows.findIndex((r) => r.entry_id === myEntryId) : -1;

  return (
    <div className="pb-12">
      {showTicker && <ScoreTicker rows={rows} />}
      {myIndex >= 0 && (
        <YouBar row={rows[myIndex]} index={myIndex} rows={rows} cashLine={cashLine} payFor={payFor} />
      )}

      <div className="space-y-1.5">
        {rows.map((row, i) => {
          const isMe = row.entry_id === myEntryId;
          const pay = payFor.get(i + 1) ?? 0;
          const backFromAbove = i === 0 ? 0 : rows[i - 1].handicap_total - row.handicap_total;
          const showCut = cashLine > 0 && i === cashLine;

          return (
            <div key={row.entry_id}>
              {showCut && (
                <div className="my-2 flex items-center gap-3">
                  <div className="bg-accent/50 h-px flex-1" />
                  <span className="font-score text-accent text-[12px] font-semibold uppercase tracking-[0.2em]">
                    Cash line · top {cashLine}
                  </span>
                  <div className="bg-accent/50 h-px flex-1" />
                </div>
              )}

              <div
                className={`relative w-full rounded-xl px-2 py-1.5 ${
                  isMe
                    ? "bg-accent/15 ring-accent/50 ring-1"
                    : i < cashLine
                      ? "bg-white/[0.06]"
                      : "bg-white/[0.03]"
                }`}
              >
                {/* Pace bar: how close this total sits to the leader, so the
                    row's width carries meaning instead of sitting empty. */}

                <span className="relative flex items-center gap-1.5">
                  <span
                    className={`font-score w-7 shrink-0 text-center text-lg leading-none ${
                      i === 0 ? "text-accent" : isMe ? "text-accent" : "text-ink-soft"
                    }`}
                  >
                    {i + 1}
                  </span>

                  <span className="min-w-0 flex-1 pr-2">
                    <span className={`block break-words text-[15px] leading-[1.05] ${isMe ? "text-accent font-semibold" : "text-ink"}`}>
                      {row.entry_name}
                      {isMe && <span className="text-ink-soft ml-2 text-[12px] uppercase">you</span>}
                    </span>
                    <span className="text-ink-soft text-[11px]">
                      <span className="sm:hidden">{Array.from({ length: gamesPerSquad }, (_, gi) => {
                        const v = gameMap[row.entry_id]?.[gi + 1];
                        return (
                          <span key={gi} className={`mr-1.5 ${v ? "text-ink" : "text-ink-soft/40"}`}>
                            {v ?? "-"}
                          </span>
                        );
                      })}</span>
                    </span>
                  </span>

                  <span className="hidden w-12 shrink-0 text-right sm:block">
                    <span className="text-ink-soft block text-[10px] uppercase">Avg</span>
                    <span className="font-score text-ink block leading-none">
                      {row.games_played ? Math.round(row.scratch_total / row.games_played) : "—"}
                    </span>
                  </span>

                  <span className="hidden shrink-0 items-center sm:flex">
                    {Array.from({ length: gamesPerSquad }, (_, gi) => {
                      const v = gameMap[row.entry_id]?.[gi + 1];
                      return (
                        <span key={gi} className={`font-score w-9 rounded text-center text-[13px] ${
                            v && v > 279
                              ? "bg-accent/20 text-accent font-bold"
                              : v ? "text-ink" : "text-ink-soft/30"
                          }`}>
                          {v ?? "-"}
                        </span>
                      );
                    })}
                  </span>


                  <span className="hidden w-16 shrink-0 text-right sm:block">
                    <span className="text-ink-soft block text-[10px] uppercase">Scratch</span>
                    <span className="font-score text-ink-soft block leading-none">
                      {row.scratch_total}
                    </span>
                  </span>

                  <span className="hidden w-12 shrink-0 text-right sm:block">
                    <span className="text-ink-soft block text-[10px] uppercase">Hdcp</span>
                    <span className="font-score text-accent block leading-none">
                      {row.handicap_total > row.scratch_total
                        ? `+${row.handicap_total - row.scratch_total}`
                        : "\u2014"}
                    </span>
                  </span>

                  <span className="hidden w-12 shrink-0 text-right sm:block">
                    <span className="text-ink-soft block text-[10px] uppercase">Back</span>
                    <span className="font-score text-ink-soft block leading-none">
                      {backFromAbove > 0 ? backFromAbove : "\u2014"}
                    </span>
                  </span>

                  <span className="w-16 shrink-0 text-right">
                    <span className="text-ink-soft hidden text-[10px] uppercase sm:block">Total</span>
                    <span className={`font-score block text-xl leading-none ${isMe ? "text-accent" : "text-ink"}`}>
                      {row.handicap_total}
                    </span>
                    {pay > 0 && (
                      <span className="font-score text-accent block text-[13px]">
                        {formatMoney(pay)}
                      </span>
                    )}
                  </span>
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-ink-soft mt-4 text-center text-[13px]">
        Leader {leader}
        {cashLine > 0 && ` · ${cashMark} to cash`}
      </p>
    </div>
  );
}

function YouBar({
  row,
  index,
  rows,
  cashLine,
  payFor,
}: {
  row: BoardRow;
  index: number;
  rows: BoardRow[];
  cashLine: number;
  payFor: Map<number, number>;
}) {
  const inMoney = cashLine > 0 && index < cashLine;
  const pay = payFor.get(index + 1) ?? 0;
  const toCash =
    cashLine > 0 && !inMoney
      ? (rows[cashLine - 1]?.handicap_total ?? 0) - row.handicap_total
      : 0;
  const toNext = index === 0 ? 0 : rows[index - 1].handicap_total - row.handicap_total;

  return (
    <div className="bg-accent/10 ring-accent/30 mb-5 rounded-2xl p-5 ring-1">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-ink-soft text-[12px] font-semibold uppercase tracking-[0.2em]">You</p>
          <p className="font-score text-accent text-4xl leading-none">
            {index + 1}
            <span className="text-ink-soft ml-1 text-base">of {rows.length}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-ink-soft text-[12px] font-semibold uppercase tracking-[0.2em]">Total</p>
          <p className="font-score text-ink text-3xl leading-none">{row.handicap_total}</p>
        </div>
      </div>

      <p className="text-ink mt-3 text-sm">
        {inMoney ? (
          <>
            In the money for <span className="font-score text-accent">{formatMoney(pay)}</span>
            {toNext > 0 && <span className="text-ink-soft"> · {toNext} pins off the spot above</span>}
          </>
        ) : toCash > 0 ? (
          <>
            <span className="font-score text-accent">{toCash}</span> pins out of the money
          </>
        ) : (
          <span className="text-ink-soft">Standings update as scores go in.</span>
        )}
      </p>
    </div>
  );
}
