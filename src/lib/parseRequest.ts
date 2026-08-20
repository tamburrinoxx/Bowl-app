import type { FinishStyle, FormatInputs, SkillSpread } from "@/lib/formats";

export interface ParseResult {
  inputs: FormatInputs;
  games: number | null;
  found: Set<keyof FormatInputs | "games">;
  understood: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, sixteen: 16, twenty: 20,
  thirty: 30, forty: 40, fifty: 50, sixty: 60,
};

function wordsToDigits(text: string): string {
  let out = text;
  for (const [word, n] of Object.entries(NUMBER_WORDS)) {
    out = out.replace(new RegExp(`\\b${word}\\b`, "g"), String(n));
  }
  return out;
}

function take(state: { text: string }, re: RegExp): RegExpMatchArray | null {
  const m = state.text.match(re);
  if (!m || m.index === undefined) return null;
  state.text =
    state.text.slice(0, m.index) +
    " ".repeat(m[0].length) +
    state.text.slice(m.index + m[0].length);
  return m;
}

export function parseRequest(raw: string): ParseResult {
  const state = { text: wordsToDigits(raw.toLowerCase().replace(/[,]/g, " ")) };
  const found = new Set<keyof FormatInputs | "games">();
  const understood: string[] = [];

  const lanesM = take(state, /(\d+)\s*lanes?\b/);
  const hoursM = take(state, /(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/);
  const gamesM = take(state, /(\d+)\s*[-\s]?games?\b/);

  let entrySize = 1;
  let entrySizeFound = false;
  const nManM = take(state, /(\d+)[-\s]?(?:man|person|player)\s*teams?\b/);
  if (nManM) {
    entrySize = Math.min(5, Math.max(1, Number(nManM[1])));
    entrySizeFound = true;
  } else if (/\bdoubles?\b|\bpairs?\b/.test(state.text)) {
    entrySize = 2; entrySizeFound = true;
  } else if (/\btrios?\b|\b3[-\s]?person\b/.test(state.text)) {
    entrySize = 3; entrySizeFound = true;
  } else if (/\bteams?\b|\bbaker\b/.test(state.text)) {
    entrySize = 5; entrySizeFound = true;
  } else if (/\bsingles?\b|\bindividual\b/.test(state.text)) {
    entrySize = 1; entrySizeFound = true;
  }

  const topM = take(state, /\btop\s*(\d+)\b/);

  let entries = 24;
  let entriesFound = false;

  const entryUnitM = take(state, /(\d+)\s*(entries|teams|doubles|pairs|trios)\b/);
  const peopleUnitM = entryUnitM
    ? null
    : take(state, /(\d+)\s*(bowlers?|people|players?|guys)\b/);
  const bareM = entryUnitM || peopleUnitM ? null : take(state, /\b(\d{1,3})\b/);

  if (entryUnitM) {
    entries = Number(entryUnitM[1]);
    entriesFound = true;
    understood.push(`${entries} entries`);
  } else if (peopleUnitM) {
    const people = Number(peopleUnitM[1]);
    entries = entrySize > 1 ? Math.ceil(people / entrySize) : people;
    entriesFound = true;
    understood.push(
      entrySize > 1
        ? `${people} bowlers → ${entries} entries of ${entrySize}`
        : `${people} bowlers`,
    );
  } else if (bareM) {
    entries = Number(bareM[1]);
    entriesFound = true;
    understood.push(`${entries} entries (assumed — no unit given)`);
  }

  if (entrySizeFound) {
    const labels: Record<number, string> = {
      1: "singles", 2: "doubles", 3: "trios", 4: "4-person teams", 5: "5-person teams",
    };
    understood.push(labels[entrySize] ?? `${entrySize}-person teams`);
  }

  let lanes = 12;
  if (lanesM) {
    lanes = Number(lanesM[1]);
    found.add("lanes");
    understood.push(`${lanes} lanes`);
  }

  let hours = 4;
  if (hoursM) {
    hours = Number(hoursM[1]);
    found.add("hours");
    understood.push(`${hours} hours`);
  } else if (/\ball[-\s]?day\b/.test(state.text)) {
    hours = 8; found.add("hours"); understood.push("all day → 8 hours");
  } else if (/\bmorning\b|\bafternoon\b|\bevening\b|\bnight\b/.test(state.text)) {
    hours = 4; found.add("hours"); understood.push("half-day session → 4 hours");
  }

  let skillSpread: SkillSpread = "wide";
  if (/\bscratch\b|\bleague\b|\badvanced\b|\bserious\b|\bcompetitive\b/.test(state.text)) {
    skillSpread = "similar"; found.add("skillSpread"); understood.push("scratch");
  } else if (/\bhandicap\b|\bmixed\b|\ball levels\b|\bbeginners?\b|\bcasual\b|\bfun\b|\bcharity\b|\bfundraiser\b/.test(state.text)) {
    skillSpread = "wide"; found.add("skillSpread"); understood.push("handicap");
  }

  let finishStyle: FinishStyle = "dramatic";
  if (/\bstepladder\b|\bstep ladder\b|\bladder\b|\btv finals?\b|\bdramatic\b/.test(state.text)) {
    finishStyle = "dramatic"; found.add("finishStyle"); understood.push("stepladder finals");
  } else if (/\bbracket\b|\bmatch play\b|\bhead[-\s]?to[-\s]?head\b|\belimination\b|\bround robin\b/.test(state.text)) {
    finishStyle = "head_to_head"; found.add("finishStyle"); understood.push("head-to-head finals");
  } else if (/\beliminator\b|\bsurvivor\b|\bcut\b|\blast one standing\b/.test(state.text)) {
    finishStyle = "survivor"; found.add("finishStyle"); understood.push("eliminator");
  } else if (/\btotal pinfall\b|\bhigh(est)? total\b|\bpinfall\b|\bsimple\b/.test(state.text)) {
    finishStyle = "simple"; found.add("finishStyle"); understood.push("highest total wins");
  }

  let games: number | null = null;
  if (gamesM) {
    games = Math.min(12, Math.max(1, Number(gamesM[1])));
    found.add("games");
    understood.push(`${games} qualifying games`);
  }

  if (entriesFound) found.add("entries");
  if (entrySizeFound) found.add("entrySize");
  if (topM) understood.push(`top ${topM[1]} advance`);

  return {
    inputs: { entrySize, entries, lanes, hours, skillSpread, finishStyle },
    games,
    found,
    understood,
  };
}
