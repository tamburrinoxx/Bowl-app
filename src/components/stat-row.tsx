"use client";

export function StatRow({
  label, value, onClick, indent = 0,
}: {
  label: string;
  value?: string;
  onClick?: () => void;
  indent?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`flex w-full items-center justify-between border-b border-white/5 px-4 py-3 text-left ${
        onClick ? "hover:bg-white/5" : ""
      }`}
      style={{ paddingLeft: 16 + indent * 16 }}
    >
      <span className="text-ink text-[15px]">{label}</span>
      <span className="flex items-center gap-2">
        {value && <span className="font-score text-ink text-[15px]">{value}</span>}
        {onClick && <span className="text-ink-soft/40 text-sm">›</span>}
      </span>
    </button>
  );
}
