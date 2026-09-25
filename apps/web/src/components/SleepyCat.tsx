/** Small line illustration for calm empty states ("nothing to do"). */
export function SleepyCat({ className = 'h-20' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 160 90"
      className={className}
      aria-hidden
      fill="none"
      stroke="var(--ink-soft)"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* body curled up */}
      <path d="M30 76c-8-24 10-44 44-46 30-2 52 14 52 34 0 8-5 12-14 12H44" />
      {/* tail wrapping around */}
      <path d="M126 64c10 2 16 8 12 13-3 4-12 3-22-1" />
      {/* head with ears */}
      <path d="M44 76c-10 0-18-7-17-17 1-7 6-12 12-13l-2-12 11 8c4-1 8-1 12 1l9-8v13c3 3 4 7 3 11" />
      {/* closed eyes */}
      <path d="M38 60c2 2 5 2 7 0M53 61c2 2 5 2 7 0" />
      {/* zzz */}
      <path d="M92 18h9l-9 9h9M108 8h6l-6 6h6" strokeWidth="2.5" stroke="var(--amber)" />
    </svg>
  );
}
