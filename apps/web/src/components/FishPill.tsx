import { RollingNumber } from './ui';

export function FishPill({ balance, className = '' }: { balance: number; className?: string }) {
  return (
    <span
      className={`bg-card text-ink shadow-card inline-flex items-center gap-1 rounded-full px-3 py-1 text-sm font-semibold ${className}`}
    >
      🐟 <RollingNumber value={balance} />
    </span>
  );
}
