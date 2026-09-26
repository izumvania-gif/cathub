import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

// A 7×6 pixel heart, drawn as crisp rects so it matches the pixel cat.
const HEART = ['.XX.XX.', 'XXXXXXX', 'XXXXXXX', '.XXXXX.', '..XXX..', '...X...'];
const COLORS = ['var(--tomato)', 'var(--amber)', 'var(--mint)', 'var(--data)'];

function PixelHeart({ color, size }: { color: string; size: number }) {
  return (
    <svg
      width={size}
      height={(size * 6) / 7}
      viewBox="0 0 7 6"
      shapeRendering="crispEdges"
      aria-hidden
    >
      {HEART.flatMap((row, y) =>
        [...row].map((c, x) =>
          c === 'X' ? (
            <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={color} />
          ) : null,
        ),
      )}
    </svg>
  );
}

interface Piece {
  id: number;
  dx: number;
  dy: number;
  rot: number;
  size: number;
  color: string;
  delay: number;
}

function burst(seed: number): Piece[] {
  return Array.from({ length: 16 }, (_, i) => {
    const angle = -Math.PI / 2 + ((i / 15) * 2 - 1) * 1.25 + (Math.random() - 0.5) * 0.3;
    const dist = 90 + Math.random() * 90;
    return {
      id: seed * 100 + i,
      dx: Math.cos(angle) * dist,
      dy: Math.sin(angle) * dist * 0.8,
      rot: (Math.random() - 0.5) * 50,
      size: 12 + Math.round(Math.random() * 3) * 3,
      color: COLORS[i % COLORS.length]!,
      delay: Math.random() * 0.12,
    };
  });
}

/**
 * Pixel hearts that burst from the top of the screen when `active` turns on (the last chore of
 * the day is done). Only on a change seen on screen, never on page load, and never under
 * reduced motion.
 */
export function HeartBurst({ active }: { active: boolean }) {
  const reduce = useReducedMotion();
  const was = useRef(active);
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    const turnedOn = active && !was.current;
    was.current = active;
    if (!turnedOn || reduce) return;
    setPieces(burst(Date.now() % 1000));
    const t = setTimeout(() => setPieces([]), 1800);
    return () => clearTimeout(t);
  }, [active, reduce]);

  if (!pieces.length) return null;
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-[max(env(safe-area-inset-top),1.25rem)] z-30 flex justify-center"
    >
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-8"
          initial={{ x: 0, y: 0, scale: 0.4, opacity: 1, rotate: 0 }}
          animate={{
            x: [0, p.dx, p.dx * 1.15],
            y: [0, p.dy, p.dy + 140],
            scale: [0.4, 1, 0.9],
            opacity: [1, 1, 0],
            rotate: [0, p.rot, p.rot * 1.5],
          }}
          transition={{
            duration: 1.5,
            delay: p.delay,
            ease: [0.22, 1, 0.36, 1],
            times: [0, 0.4, 1],
          }}
        >
          <PixelHeart color={p.color} size={p.size} />
        </motion.span>
      ))}
    </div>
  );
}
