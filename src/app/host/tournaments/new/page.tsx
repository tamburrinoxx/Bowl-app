"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { splitEntryFee } from "@/lib/money";

const EVENT_TYPES = [
  { value: "singles", label: "Singles" },
  { value: "doubles", label: "Doubles" },
  { value: "team", label: "Team" },
  { value: "baker", label: "Baker" },
] as const;

export default function NewTournamentPage() {
  const router = useRouter();
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patternFile, setPatternFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    name: "",
    format: "handicap" as "handicap" | "scratch",
    event_type: "singles" as (typeof EVENT_TYPES)[number]["value"],
    center_name: "",
    entry_fee: "",
    prize_fund: "",
    handicap_base: "220",
    handicap_percent: "90",
    games_per_squad: "3",
    starts_at: "",
    pattern_name: "",
    pattern_distance_ft: "",
    lineage_per_game: "4",
    director_percent: "15",
  });

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      router.push("/login");
      return;
    }

    // The sheet is optional — a host often books lanes before the pattern is
    // decided, so this can be filled in later from the tournament page.
    let patternUrl: string | null = null;
    if (patternFile) {
      setUploading(true);
      const ext = patternFile.name.split(".").pop() ?? "pdf";
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("oil-patterns")
        .upload(path, patternFile);
      setUploading(false);
      if (upErr) {
        setError(`Pattern upload failed: ${upErr.message}`);
        setSaving(false);
        return;
      }
      const { data: pub } = supabase.storage.from("oil-patterns").getPublicUrl(path);
      patternUrl = pub.publicUrl;
    }

    let oilPatternId: string | null = null;
    if (form.pattern_name.trim()) {
      const { data: pattern, error: patternErr } = await supabase
        .from("oil_patterns")
        .insert({
          name: form.pattern_name.trim(),
          source: "house",
          distance_ft: form.pattern_distance_ft ? Number(form.pattern_distance_ft) : null,
          created_by: user.id,
        })
        .select()
        .single();

      if (patternErr) {
        setError(patternErr.message);
        setSaving(false);
        return;
      }
      oilPatternId = pattern.id;
    }

    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .insert({
        host_id: user.id,
        name: form.name,
        format: form.format,
        event_type: form.event_type,
        oil_pattern_id: oilPatternId,
        center_name: form.center_name || null,
        entry_fee: form.entry_fee ? Number(form.entry_fee) : null,
        oil_pattern_url: patternUrl,
        oil_pattern_name: form.pattern_name.trim() || null,
        lineage_per_game: Number(form.lineage_per_game) || 0,
        director_percent: Number(form.director_percent) || 0,
        prize_fund: form.prize_fund ? Number(form.prize_fund) : null,
        handicap_base: Number(form.handicap_base),
        handicap_percent: Number(form.handicap_percent) / 100,
        games_per_squad: Number(form.games_per_squad),
        starts_at: form.starts_at || null,
        status: "draft",
      })
      .select()
      .single();

    setSaving(false);

    if (tErr) {
      setError(tErr.message);
      return;
    }

    router.push(`/host/tournaments/${tournament.id}`);
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <p className="font-score text-accent text-xs font-semibold tracking-wide mb-2 uppercase">
          Host / New Event
        </p>
        <h1 className="font-display text-4xl md:text-5xl text-ink mb-8">
          Set Up a Tournament
        </h1>

        <form onSubmit={handleSubmit} className="glass-panel p-8 space-y-6">
          <Field label="Tournament name">
            <input
              required
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Plum Brook Fall Classic"
              className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Format">
              <select
                value={form.format}
                onChange={(e) => update("format", e.target.value as "handicap" | "scratch")}
                className={inputClass}
              >
                <option value="handicap">Handicap</option>
                <option value="scratch">Scratch</option>
              </select>
            </Field>

            <Field label="Event type">
              <select
                value={form.event_type}
                onChange={(e) => update("event_type", e.target.value as typeof form.event_type)}
                className={inputClass}
              >
                {EVENT_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>
                    {et.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="rounded-2xl bg-white/5 p-5">
            <p className="text-accent text-xs font-semibold uppercase tracking-wide mb-3">
              Oil pattern (drives pattern-specific handicaps)
            </p>
            <div className="grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Field label="Pattern name">
                  <input
                    value={form.pattern_name}
                    onChange={(e) => update("pattern_name", e.target.value)}
                    placeholder="Cheetah, Kegel Main Street, house shot…"
                    className={inputClass}
                  />
                </Field>
              </div>
              <Field label="Length (ft)">
                <input
                  type="number"
                  value={form.pattern_distance_ft}
                  onChange={(e) => update("pattern_distance_ft", e.target.value)}
                  placeholder="39"
                  className={inputClass}
                />
              </Field>
            </div>
            <p className="text-xs text-ink-soft mt-3">
              Bowlers&apos; handicaps for this event will be pulled from their average on this
              exact pattern, not their overall average.
            </p>
          </div>

          {form.format === "handicap" && (
            <div className="grid grid-cols-3 gap-4">
              <Field label="Base">
                <input
                  type="number"
                  value={form.handicap_base}
                  onChange={(e) => update("handicap_base", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Percent (%)">
                <input
                  type="number"
                  value={form.handicap_percent}
                  onChange={(e) => update("handicap_percent", e.target.value)}
                  className={inputClass}
                />
              </Field>
              <Field label="Games / squad">
                <input
                  type="number"
                  value={form.games_per_squad}
                  onChange={(e) => update("games_per_squad", e.target.value)}
                  className={inputClass}
                />
              </Field>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Center">
              <input
                value={form.center_name}
                onChange={(e) => update("center_name", e.target.value)}
                placeholder="Clubhouse No. 3"
                className={inputClass}
              />
            </Field>
            <Field label="Start date/time">
              <input
                type="datetime-local"
                value={form.starts_at}
                onChange={(e) => update("starts_at", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Oil pattern sheet">
            <input
              type="file"
              accept="application/pdf,image/*"
              onChange={(e) => setPatternFile(e.target.files?.[0] ?? null)}
              className="text-ink-soft file:bg-accent file:text-on-accent w-full text-sm file:mr-3 file:rounded-full file:border-0 file:px-4 file:py-2 file:text-sm file:font-semibold"
            />
          </Field>
          <p className="text-ink-soft text-xs">
            {patternFile
              ? `${patternFile.name} ready to upload.`
              : "PDF or photo. Skip it if the pattern isn't decided — you can add it from the tournament page later."}
          </p>

          <div className="grid grid-cols-3 gap-4">
            <Field label="Entry fee ($)">
              <input
                type="number"
                value={form.entry_fee}
                onChange={(e) => update("entry_fee", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Lineage / game ($)">
              <input
                type="number"
                step="0.5"
                value={form.lineage_per_game}
                onChange={(e) => update("lineage_per_game", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Director cut (%)">
              <input
                type="number"
                min={0}
                max={100}
                value={form.director_percent}
                onChange={(e) => update("director_percent", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {Number(form.entry_fee) > 0 && (() => {
            const split = splitEntryFee(
              Number(form.entry_fee),
              Number(form.games_per_squad) || 0,
              Number(form.lineage_per_game) || 0,
              Number(form.director_percent) || 0,
            );
            return (
              <div className="rounded-2xl bg-white/5 p-4">
                <p className="text-ink-soft mb-3 text-xs font-medium uppercase tracking-wide">
                  Where each ${split.entryFee} goes
                </p>
                <div className="space-y-1.5 text-sm">
                  <Split label={`Lineage · ${form.games_per_squad} games to the house`} value={split.lineage} />
                  <Split label={`Director · ${form.director_percent}% of what's left`} value={split.director} />
                  <Split label="Prize fund" value={split.prizePerEntry} accent />
                </div>
                <p className="text-ink-soft mt-3 text-xs">
                  Set the prize fund below to{" "}
                  <span className="font-score text-accent">${split.prizePerEntry} × entries</span>
                  , or type your own.
                </p>
              </div>
            );
          })()}

          <Field label="Prize fund ($)">
            <input
              type="number"
              value={form.prize_fund}
              onChange={(e) => update("prize_fund", e.target.value)}
              className={inputClass}
            />
          </Field>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-2xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="pill-button w-full bg-accent text-on-accent text-base py-3.5 hover:brightness-110 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Tournament"}
          </button>
        </form>
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-ink-soft block mb-1.5 ml-1">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  "glass-input w-full px-4 py-3 text-ink placeholder:text-ink-soft/60 text-base";

function Split({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-soft">{label}</span>
      <span className={`font-score ${accent ? "text-accent" : "text-ink"}`}>${value}</span>
    </div>
  );
}
