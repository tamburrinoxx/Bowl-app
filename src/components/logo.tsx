/**
 * Pinfall mark and wordmark.
 *
 * The pin is a single path with an even-odd neck stripe, so the stripe
 * knocks through to whatever is behind it rather than being painted a
 * fixed background colour. One component works on charcoal, on a lighter
 * tile, or in monochrome.
 */

const PIN_PATH =
  "M20 2 C27 2 31 8 31 14 C31 19 28 22 26 25 C25 27 25 29 26 31 " +
  "C30 38 34 52 34 66 C34 82 28 96 20 96 C12 96 6 82 6 66 " +
  "C6 52 10 38 14 31 C15 29 15 27 14 25 C12 22 9 19 9 14 C9 8 13 2 20 2 Z " +
  "M11 27 L29 27 L29 34 L11 34 Z";

export function PinMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 98"
      className={className}
      fill="currentColor"
      fillRule="evenodd"
      clipRule="evenodd"
      aria-hidden="true"
    >
      <path d={PIN_PATH} />
    </svg>
  );
}

export function Logo({
  className = "",
  mono = false,
}: {
  className?: string;
  mono?: boolean;
}) {
  return (
    <span
      className={`font-display inline-flex items-center leading-none tracking-tight ${className}`}
    >
      <span className="text-ink">P</span>
      <PinMark
        className={`mx-[0.06em] h-[1.18em] w-auto ${mono ? "text-ink" : "text-accent"}`}
      />
      <span className="text-ink">NFALL</span>
    </span>
  );
}
