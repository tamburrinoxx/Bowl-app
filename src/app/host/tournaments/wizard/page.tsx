"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { parseRequest } from "@/lib/parseRequest";
import { FORMAT_PRESETS, planPreset, type FormatPreset } from "@/lib/presets";
import {
  planTournament,
  formatDuration,
  type FinishStyle,
  type SkillSpread,
} from "@/lib/formats";

const ENTRY_SIZES = [
  { value: 1, label: "Singles", hint: "One bowler per entry" },
  { value: 2, label: "Doubles", hint: "Two bowlers, combined score" },
  { value: 3, label: "Trios", hint: "Three bowlers" },
  { value: 5, label: "Team", hint: "Five bowlers" },
];

const SPREADS: { value: SkillSpread; label: string; hint: string }[] = [
  { value: "similar", label: "Similar skill", hint: "League regulars, close averages → scratch" },
  { value: "wide", label: "Wide range", hint: "Beginners and sticks mixed → handicap" },
];

const FINISHES: { value: FinishStyle; label: string; hint: string }[] = [
  { value: "simple", label: "Highest total wins", hint: "Straight pinfall. Simplest to run." },
  { value: "dramatic", label: "Dramatic finish", hint: "Stepladder finals — great for spectators" },
  { value: "head_to_head", label: "Head-to-head", hint: "Bracket or round robin match play" },
  { value: "survivor", label: "Survivor", hint: "Eliminator — cut the bottom each game" },
];

export default function TournamentWizard() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [centerName, setCenterName] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [entrySize, setEntrySize] = useState(1);
  const [entries, setEntries] = useState("24");
  const [lanes, setLanes] = useState("12");
  const [hours, setHours] = useState("4");
  const [entryFee, setEntryFee] = useState("");
  const [handicapBase, setHandicapBase] = useState("220");
  const [handicapPercent, setHandicapPercent] = useState("90");
  const [skillSpread, setSkillSpread] = useState<SkillSpread>("wide");
  const [finishStyle, setFinishStyle] = useState<FinishStyle>("dramatic");
  const [gamesOverride, setGamesOverride] = useState<number | null>(null);
  const [freeText, setFreeText] = useState("");
  const [understood, setUnderstood] = useState<string[] | null>(null);
  const [presetId, setPresetId] = useState<string | null>(null);

  function buildFromText() {
    if (!freeText.trim()) return;
    const r = parseRequest(freeText);
    setPresetId(null);
    setEntrySize(r.inputs.entrySize);
    setEntries(String(r.inputs.entries));
    setLanes(String(r.inputs.lanes));
    setHours(String(r.inputs.hours));
    setSkillSpread(r.inputs.skillSpread);
    setFinishStyle(r.inputs.finishStyle);
    setGamesOverride(r.games);
    setUnderstood(r.understood);
    setStep(5);
  }

  function pickPreset(preset: FormatPreset) {
    setPresetId(preset.id);
    setUnderstood(null);
    setEntrySize(preset.entrySize);
    setEntries(String(preset.suggestedEntries));
    setHours(String(preset.suggestedHours));
    setGamesOverride(null);
    setStep(5);
  }

  const preset = presetId
    ? (FORMAT_PRESETS.find((p) => p.id === presetId) ?? null)
    : null;

  const plan = useMemo(
    () =>
      preset
        ? planPreset(preset, {
            entries: Number(entries) || 1,
            lanes: Number(lanes) || 1,
            hours: Number(hours) || 1,
          })
        : planTournament(
            {
              entrySize,
              entries: Number(entries) || 1,
              lanes: Number(lanes) || 1,
              hours: Number(hours) || 1,
              skillSpread,
              finishStyle,
            },
            gamesOverride ?? undefined,
          ),
    [preset, entrySize, entries, lanes, hours, skillSpread, finishStyle, gamesOverride],
  );

  async function save() {
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const eventType =
      entrySize === 1 ? "singles" : entrySize === 2 ? "doubles" : "team";

    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .insert({
        host_id: user.id,
        name: name.trim(),
        format: plan.format,
        event_type: eventType,
        entry_size: entrySize,
        center_name: centerName.trim() || null,
        entry_fee: entryFee.trim() === "" ? null : Number(entryFee),
        prize_fund:
          entryFee.trim() === "" ? null : Number(entryFee) * (Number(entries) || 0),
        handicap_base: Number(handicapBase) || 220,
        handicap_percent: (Number(handicapPercent) || 90) / 100,
        games_per_squad: plan.qualifyingGames || 3,
        starts_at: startsAt || null,
        status: "draft",
      })
      .select()
      .single();

    if (tErr || !tournament) {
      setError(tErr?.message ?? "Could not create the tournament.");
      setSaving(false);
      return;
    }

    const { error: sErr } = await supabase.from("tournament_stages").insert(
      plan.stages.map((s, i) => ({
        tournament_id: tournament.id,
        stage_number: i + 1,
        name: s.name,
        stage_type: s.stage_type,
        scoring_mode: s.scoring_mode,
        games: s.games,
        cut_per_game: s.cut_per_game,
        advance_count: s.advance_count,
        advance_rule: s.advance_rule,
        bonus_pins_per_win: s.bonus_pins_per_win,
        carry_pins: s.carry_pins,
      })),
    );

    setSaving(false);

    if (sErr) {
      setError(`Tournament created, but stages failed: ${sErr.message}`);
      return;
    }

    router.push(`/host/tournaments/${tournament.id}`);
  }

  const canAdvance = step !== 0 || name.trim().length > 0;

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/host/tournaments"
          className="text-accent mb-4 inline-block text-sm hover:brightness-110"
        >
          ← Your tournaments
        </Link>

        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 uppercase">
          Step {step + 1} of 6
        </p>
        <h1 className="font-display text-4xl text-ink mb-8">
          {step === 5 ? "Your Format" : "Build a Tournament"}
        </h1>

        <div className="glass-panel space-y-6 p-8">
          {step === 0 && (
            <>
              <Field label="Describe it in a sentence">
                <textarea
                  rows={2}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="24 bowlers, 12 lanes, 4 hours, handicap, stepladder finals"
                  className="glass-input w-full px-4 py-2.5 text-ink"
                />
              </Field>
              <button
                type="button"
                onClick={buildFromText}
                disabled={!freeText.trim() || !name.trim()}
                className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-40"
              >
                Build from this
              </button>

              <div>
                <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
                  Or pick a format
                </p>
                <div className="space-y-2">
                  {FORMAT_PRESETS.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!name.trim()}
                      onClick={() => pickPreset(p)}
                      className="w-full rounded-2xl bg-white/5 p-4 text-left transition-colors hover:bg-white/8 disabled:opacity-40"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="text-ink font-medium">{p.name}</span>
                        <span className="text-accent font-score shrink-0 text-xs">
                          {p.tagline}
                        </span>
                      </div>
                      <span className="text-ink-soft mt-1 block text-xs">
                        {p.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <p className="text-ink-soft text-xs">
                Name it first, then describe it or pick a format — or skip both
                and step through the questions.
              </p>

              <Field label="Tournament name">
                <input
                  autoFocus
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Saturday Singles Shootout"
                  className="glass-input w-full px-4 py-2.5 text-ink"
                />
              </Field>
              <Field label="Center">
                <input
                  value={centerName}
                  onChange={(e) => setCenterName(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 text-ink"
                />
              </Field>
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                  className="glass-input w-full px-4 py-2.5 text-ink"
                />
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <Field label="Who's bowling?">
                <div className="grid grid-cols-2 gap-3">
                  {ENTRY_SIZES.map((o) => (
                    <Choice
                      key={o.value}
                      selected={entrySize === o.value}
                      label={o.label}
                      hint={o.hint}
                      onClick={() => setEntrySize(o.value)}
                    />
                  ))}
                </div>
              </Field>
              <Field label={entrySize === 1 ? "How many bowlers?" : "How many entries?"}>
                <input
                  type="number"
                  min={2}
                  value={entries}
                  onChange={(e) => setEntries(e.target.value)}
                  className="glass-input font-score w-32 px-4 py-2.5 text-ink"
                />
              </Field>
            </>
          )}

          {step === 2 && (
            <>
              <Field label="How many lanes do you have?">
                <input
                  type="number"
                  min={1}
                  value={lanes}
                  onChange={(e) => setLanes(e.target.value)}
                  className="glass-input font-score w-32 px-4 py-2.5 text-ink"
                />
              </Field>
              <Field label="How many hours?">
                <input
                  type="number"
                  min={1}
                  step={0.5}
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="glass-input font-score w-32 px-4 py-2.5 text-ink"
                />
              </Field>
              <p className="text-ink-soft text-xs">
                These two drive everything. Lanes and time decide how many games
                actually fit, which decides the format.
              </p>

              <Field label="Entry fee">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={entryFee}
                  onChange={(e) => setEntryFee(e.target.value)}
                  placeholder="30"
                  className="glass-input font-score w-32 px-4 py-2.5 text-ink"
                />
              </Field>
              <p className="text-ink-soft text-xs">
                {entryFee.trim() === ""
                  ? "Used for the check-in Owed column and to seed the prize fund."
                  : `${entries} entries at $${entryFee} seeds a $${(Number(entryFee) || 0) * (Number(entries) || 0)} prize fund. You can change it later.`}
              </p>

              <div className="flex flex-wrap items-end gap-4">
                <Field label="Handicap base">
                  <input
                    type="number"
                    min={0}
                    max={300}
                    value={handicapBase}
                    onChange={(e) => setHandicapBase(e.target.value)}
                    className="glass-input font-score w-24 px-4 py-2.5 text-ink"
                  />
                </Field>
                <Field label="Handicap %">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={handicapPercent}
                    onChange={(e) => setHandicapPercent(e.target.value)}
                    className="glass-input font-score w-24 px-4 py-2.5 text-ink"
                  />
                </Field>
                <p className="text-ink-soft pb-3 text-xs">
                  A {handicapBase} base at {handicapPercent}% gives a{" "}
                  {Math.max(
                    0,
                    Math.floor(
                      ((Number(handicapBase) || 220) - 150) *
                        ((Number(handicapPercent) || 90) / 100),
                    ),
                  )}{" "}
                  handicap to a 150 average.
                </p>
              </div>
            </>
          )}

          {step === 3 && (
            <Field label="How close are the averages?">
              <div className="space-y-3">
                {SPREADS.map((o) => (
                  <Choice
                    key={o.value}
                    selected={skillSpread === o.value}
                    label={o.label}
                    hint={o.hint}
                    onClick={() => setSkillSpread(o.value)}
                  />
                ))}
              </div>
            </Field>
          )}

          {step === 4 && (
            <Field label="How should it end?">
              <div className="space-y-3">
                {FINISHES.map((o) => (
                  <Choice
                    key={o.value}
                    selected={finishStyle === o.value}
                    label={o.label}
                    hint={o.hint}
                    onClick={() => setFinishStyle(o.value)}
                  />
                ))}
              </div>
            </Field>
          )}

          {step === 5 && (
            <>
              <div
                className={`rounded-2xl p-5 ${
                  plan.fits ? "bg-accent/10" : "bg-white/5"
                }`}
              >
                <p className="text-ink font-medium">
                  {plan.format === "handicap" ? "Handicap" : "Scratch"} ·{" "}
                  {plan.stages.map((s) => s.name).join(" → ")}
                </p>
                <p className="font-score text-accent mt-1 text-sm">
                  Est. {formatDuration(plan.totalMinutes)}
                  {plan.squads > 1 ? ` · ${plan.squads} squads` : ""} ·{" "}
                  {plan.bowlersPerLane}/lane
                  {plan.fits ? "" : " — over your window"}
                </p>
              </div>

              <div className="space-y-3">
                {plan.stages.map((s, i) => (
                  <div key={i} className="rounded-2xl bg-white/5 p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="text-ink font-medium">
                        {i + 1}. {s.name}
                      </p>
                      <span className="text-ink-soft font-score shrink-0 text-xs">
                        {formatDuration(s.estimated_minutes)}
                      </span>
                    </div>
                    <p className="text-ink-soft mt-1 text-sm">{s.blurb}</p>
                    {s.scoring_mode === "baker" && (
                      <span className="bg-accent/15 text-accent mt-2 inline-block rounded-full px-3 py-1 text-xs font-semibold uppercase">
                        Baker
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {preset ? (
                <div className="rounded-2xl bg-white/5 p-5">
                  <p className="text-ink text-sm font-medium">{preset.name}</p>
                  <p className="text-ink-soft mt-1 text-xs">
                    Preset formats are fixed. Adjust entries, lanes, or hours on
                    the earlier steps and the estimate follows.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPresetId(null)}
                    className="text-accent mt-2 text-xs hover:brightness-110"
                  >
                    Customize instead →
                  </button>
                </div>
              ) : (
                <Field label="Qualifying games">
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={gamesOverride ?? plan.qualifyingGames}
                    onChange={(e) => setGamesOverride(Number(e.target.value))}
                    className="glass-input font-score w-24 px-4 py-2.5 text-ink"
                  />
                </Field>
              )}

              {understood && (
                <div className="rounded-2xl bg-white/5 p-5">
                  <p className="text-ink-soft mb-2 text-xs font-medium uppercase tracking-wide">
                    Understood from your description
                  </p>
                  <p className="text-ink text-sm">{understood.join(" · ")}</p>
                  <p className="text-ink-soft mt-2 text-xs">
                    Anything missing fell back to a default — go Back and check.
                  </p>
                </div>
              )}

              {plan.notes.map((n, i) => (
                <p key={i} className="text-ink-soft text-xs">
                  {n}
                </p>
              ))}

              {error && <p className="text-sm text-red-400">{error}</p>}
            </>
          )}

          <div className="flex items-center justify-between gap-4 pt-2">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => setStep((s) => s - 1)}
              className="text-ink-soft text-sm disabled:opacity-30"
            >
              ← Back
            </button>

            {step < 5 ? (
              <button
                type="button"
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
                className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                type="button"
                disabled={saving}
                onClick={save}
                className="pill-button bg-accent text-on-accent px-6 py-2.5 hover:brightness-110 disabled:opacity-50"
              >
                {saving ? "Creating…" : "Create Tournament"}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-ink-soft mb-2 block text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      {children}
    </label>
  );
}

function Choice({
  selected,
  label,
  hint,
  onClick,
}: {
  selected: boolean;
  label: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl p-4 text-left transition-colors ${
        selected ? "bg-accent/15 ring-accent ring-1" : "bg-white/5 hover:bg-white/8"
      }`}
    >
      <span className={`block font-medium ${selected ? "text-accent" : "text-ink"}`}>
        {label}
      </span>
      <span className="text-ink-soft mt-0.5 block text-xs">{hint}</span>
    </button>
  );
}
