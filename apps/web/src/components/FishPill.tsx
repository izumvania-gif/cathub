export function FishPill({ balance, className = '' }: { balance: number; className?: string }) {
  return (
    <span
      className={`bg-card text-ink inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold tabular-nums shadow-sm ${className}`}
    >
      🐟 {balance}
    </span>
  );
}
