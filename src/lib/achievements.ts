import { analysePinLogs } from "./leaves";
import { scoreGame, type FrameData } from "./bowling";

export const BADGES: Record<string, { name: string; blurb: string }> = {
  first_session: { name: "On the board", blurb: "Logged your first session" },
  game_200: { name: "200 game", blurb: "Rolled a 200" },
  game_250: { name: "250 game", blurb: "Rolled a 250" },
  game_300: { name: "Perfect game", blurb: "300" },
  series_600: { name: "600 series", blurb: "Three-game series of 600+" },
  series_700: { name: "700 series", blurb: "Three-game series of 700+" },
  series_800: { name: "800 series", blurb: "Three-game series of 800+" },
  clean_game: { name: "Clean game", blurb: "No open frames" },
  split_7_10: { name: "7-10", blurb: "Converted the 7-10 split" },
  split_any: { name: "Split killer", blurb: "Converted a split" },
  all_spares: { name: "Dutch-proof", blurb: "Spared every open frame in a game" },
};

export type Earned = { code: string; detail?: Record<string, unknown> };

export function checkSession(
  frames: FrameData[][],
  pinLogs: number[][][][],
  isFirstSession: boolean
): Earned[] {
  const out: Earned[] = [];
  if (isFirstSession) out.push({ code: "first_session" });

  const scores = frames.map((g) => scoreGame(g));
  for (const sc of scores) {
    if (sc === 300) out.push({ code: "game_300", detail: { score: sc } });
    else if (sc >= 250) out.push({ code: "game_250", detail: { score: sc } });
    else if (sc >= 200) out.push({ code: "game_200", detail: { score: sc } });
  }

  const series = scores.reduce((a, b) => a + b, 0);
  if (scores.length >= 3) {
    if (series >= 800) out.push({ code: "series_800", detail: { series } });
    else if (series >= 700) out.push({ code: "series_700", detail: { series } });
    else if (series >= 600) out.push({ code: "series_600", detail: { series } });
  }

  for (const log of pinLogs) {
    const s = analysePinLogs([log]);
    if (s.opens === 0 && s.frames > 0) out.push({ code: "clean_game" });
    if (s.spares >= 3 && s.opens === 0) {
      out.push({ code: "all_spares" });
    }
    for (const lv of s.leaves) {
      if (lv.converted > 0 && lv.key === "7,10") out.push({ code: "split_7_10" });
      else if (lv.converted > 0 && lv.name.includes("split")) out.push({ code: "split_any" });
    }
  }

  return out;
}
