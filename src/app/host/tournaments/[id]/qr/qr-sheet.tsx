"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export default function QrSheet({
  tournamentId,
  name,
  centerName,
}: {
  tournamentId: string;
  name: string;
  centerName: string | null;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const target = `${window.location.origin}/t/${tournamentId}`;
    setUrl(target);
    QRCode.toDataURL(target, {
      width: 900,
      margin: 1,
      color: { dark: "#1F2329", light: "#FFFFFF" },
      errorCorrectionLevel: "M",
    }).then(setDataUrl);
  }, [tournamentId]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen px-6 py-12 print:p-0">
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex flex-wrap gap-3 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="pill-button bg-accent text-on-accent px-6 py-2.5 text-sm hover:brightness-110"
          >
            Print lane card
          </button>
          <button
            type="button"
            onClick={copy}
            className="pill-button bg-white/8 text-ink px-6 py-2.5 text-sm hover:bg-white/12"
          >
            {copied ? "Copied" : "Copy link"}
          </button>
          <p className="text-ink-soft self-center text-xs">
            Tape one to each pair. Bowlers scan it — no app, no account needed.
          </p>
        </div>

        <div className="rounded-3xl bg-white p-10 text-center text-[#1F2329] print:rounded-none print:p-6">
          <div className="mb-6 flex items-center justify-center gap-2">
            <span className="font-display text-2xl tracking-tight">PINFALL</span>
          </div>

          <p className="font-score mb-1 text-[13px] font-semibold uppercase tracking-[0.25em] text-[#1F2329]/50">
            Live standings
          </p>
          <h1 className="font-display mb-1 text-4xl leading-none">{name}</h1>
          {centerName && (
            <p className="mb-6 text-sm text-[#1F2329]/60">{centerName}</p>
          )}

          {dataUrl ? (
            <img
              src={dataUrl}
              alt="Scan for live standings"
              className="mx-auto h-64 w-64"
            />
          ) : (
            <div className="mx-auto h-64 w-64 animate-pulse rounded-2xl bg-[#1F2329]/5" />
          )}

          <p className="mt-6 text-lg font-medium">Scan for scores as they happen</p>
          <p className="mt-1 text-sm text-[#1F2329]/60">
            Standings, side action, brackets — updated as scores go in.
          </p>

          <p className="font-score mt-6 break-all text-xs text-[#1F2329]/40">{url}</p>
        </div>
      </div>
    </main>
  );
}
