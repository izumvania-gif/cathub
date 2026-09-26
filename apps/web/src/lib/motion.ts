/** One spring for small UI moves (pills, indicators, knobs, rolling numbers). */
export const SNAP = { type: 'spring', stiffness: 520, damping: 38, mass: 0.8 } as const;

/** Ease-out for entrances (matches --ease-out-soft in index.css). */
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;
