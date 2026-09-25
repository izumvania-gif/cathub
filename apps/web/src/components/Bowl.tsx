import { motion } from 'motion/react';
import { useId } from 'react';

/**
 * The signature element: the cat's own bowl with its name on the side, seen from above at an
 * angle. `level` 0…1 is how full it is — full right after feeding, empty by the next slot.
 */
export function Bowl({ level, name }: { level: number; name: string }) {
  const id = useId();
  const l = Math.max(0, Math.min(1, level));
  // Food surface: hidden below the opening when empty, bulging up to the rim when full.
  const foodCy = 66 - l * 22;
  const kibble = [
    [96, -3],
    [110, -5],
    [124, -3],
    [88, 1],
    [103, 0],
    [118, 0],
    [132, 1],
    [95, 4],
    [111, 4],
    [126, 4],
  ] as const;
  return (
    <svg
      viewBox="0 0 220 124"
      className="w-full max-w-[16rem]"
      role="img"
      aria-label={`Миска: ${name}`}
    >
      <defs>
        <clipPath id={`${id}-open`}>
          <ellipse cx="110" cy="42" rx="62" ry="13" />
        </clipPath>
        <linearGradient id={`${id}-body`} x1="0" x2="1">
          <stop offset="0" stopColor="var(--ink)" />
          <stop offset="0.55" stopColor="var(--ink)" stopOpacity="0.88" />
          <stop offset="1" stopColor="var(--ink)" />
        </linearGradient>
      </defs>
      {/* shadow */}
      <ellipse cx="110" cy="112" rx="96" ry="8" fill="var(--ink)" opacity="0.1" />
      {/* body: narrow top, wide stable base */}
      <path
        d="M40 42 C36 62 26 86 16 98 Q14 108 30 110 H190 Q206 108 204 98 C194 86 184 62 180 42 Z"
        fill={`url(#${id}-body)`}
      />
      {/* name on the side */}
      <text
        x="110"
        y="86"
        textAnchor="middle"
        fontFamily="var(--font-display)"
        fontSize="13"
        fontWeight="700"
        letterSpacing="3"
        fill="var(--amber)"
      >
        {name.toUpperCase().slice(0, 12)}
      </text>
      {/* rim */}
      <ellipse cx="110" cy="42" rx="72" ry="17" fill="var(--ink)" />
      <ellipse
        cx="110"
        cy="41"
        rx="72"
        ry="16"
        fill="none"
        stroke="var(--paper)"
        strokeOpacity="0.18"
      />
      {/* opening with the food inside */}
      <g clipPath={`url(#${id}-open)`}>
        <ellipse cx="110" cy="42" rx="62" ry="13" fill="var(--tint)" />
        <ellipse cx="110" cy="30" rx="62" ry="13" fill="var(--ink)" opacity="0.18" />
        <motion.g
          initial={false}
          animate={{ y: foodCy - 44 }}
          transition={{ type: 'spring', stiffness: 70, damping: 15 }}
        >
          <ellipse cx="110" cy="44" rx="58" ry="12" fill="var(--amber)" />
          {kibble.map(([x, dy], i) => (
            <g key={i}>
              <circle
                cx={x}
                cy={40 + dy}
                r="5.2"
                fill="var(--amber)"
                stroke="var(--amber-ink)"
                strokeOpacity="0.25"
              />
              <circle cx={x - 1.6} cy={38.4 + dy} r="1.4" fill="#fff" opacity="0.45" />
            </g>
          ))}
        </motion.g>
      </g>
    </svg>
  );
}
