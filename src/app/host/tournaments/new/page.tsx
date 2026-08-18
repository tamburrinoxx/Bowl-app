"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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

          <div className="rounded-2xl bg-white/50 p-5">
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Entry fee ($)">
              <input
                type="number"
                value={form.entry_fee}
                onChange={(e) => update("entry_fee", e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Prize fund ($)">
              <input
                type="number"
                value={form.prize_fund}
                onChange={(e) => update("prize_fund", e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>

          {error && (
            <p className="text-danger text-sm bg-danger/10 border border-danger/20 rounded-2xl p-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="pill-button w-full bg-accent text-white text-base py-3.5 hover:brightness-110 disabled:opacity-50"
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
