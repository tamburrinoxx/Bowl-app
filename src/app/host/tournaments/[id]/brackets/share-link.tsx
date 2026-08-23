"use client";

import { useEffect, useState } from "react";

export default function ShareLink({ tournamentId }: { tournamentId: string }) {
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    setUrl(`${window.location.origin}/t/${tournamentId}/brackets`);
  }, [tournamentId]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="glass-panel mb-6 flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="min-w-0">
        <p className="text-ink text-sm font-medium">Share with bowlers</p>
        <p className="text-ink-soft truncate text-xs">{url || "…"}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={copy}
          className="pill-button bg-accent text-on-accent px-5 py-2.5 text-sm hover:brightness-110"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
        <a
          href={`/t/${tournamentId}/brackets`}
          target="_blank"
          rel="noopener noreferrer"
          className="pill-button bg-white/8 text-ink px-5 py-2.5 text-sm hover:bg-white/12"
        >
          Open
        </a>
      </div>
    </div>
  );
}
