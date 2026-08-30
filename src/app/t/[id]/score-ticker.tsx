"use client";

export default function ScoreTicker({
  rows,
}: {
  rows: { entry_name: string; handicap_total: number }[];
}) {
  if (rows.length === 0) return null;
  const loop = [...rows, ...rows];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#1f2329]/95 backdrop-blur">
      <div
        className="flex gap-8 whitespace-nowrap py-2"
        style={{ width: "max-content", animation: `pf-ticker ${Math.max(45, rows.length * 9)}s linear infinite` }}
      >
        {loop.map((r, i) => (
          <span key={i} className="font-score text-sm text-ink">
            <span className="text-ink-soft mr-2">{(i % rows.length) + 1}</span>
            {r.entry_name}
            <span className="text-accent ml-2">{r.handicap_total}</span>
          </span>
        ))}
      </div>

    </div>
  );
}
