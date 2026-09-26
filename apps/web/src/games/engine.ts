import { useEffect, useRef, useState, type RefObject } from 'react';
import { frameAt } from '../cat/behavior';
import { framesFor } from '../cat/frames';
import type { CatLook } from '../cat/look';
import { FRAME_FLOOR, FRAME_W, type Anim } from '../cat/sprite';

/** Seeded RNG (mulberry32): the same seed plays the same level. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Rand = ReturnType<typeof rng>;

export const STEP = 1 / 60;

export interface Stage {
  /** World size in game pixels; width is fixed by the game, height follows the screen. */
  w: number;
  h: number;
  /** Device pixels per game pixel (an integer, so pixels stay square). */
  scale: number;
  ox: number;
  oy: number;
}

/**
 * A canvas that fills its box: a fixed world width, the height the screen allows (at least
 * minH, at most maxH), scaled by a whole number of device pixels and centred.
 */
export function useStage(
  canvas: RefObject<HTMLCanvasElement | null>,
  worldW: number,
  { minH = worldW, maxH = worldW * 3 } = {},
): Stage | null {
  const [stage, setStage] = useState<Stage | null>(null);
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const fit = () => {
      const box = el.parentElement!.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const cw = Math.max(1, Math.round(box.width * dpr));
      const ch = Math.max(1, Math.round(box.height * dpr));
      const scale = Math.max(1, Math.floor(Math.min(cw / worldW, ch / minH)));
      const h = Math.min(maxH, Math.max(minH, Math.floor(ch / scale)));
      el.setAttribute('width', String(cw));
      el.setAttribute('height', String(ch));
      el.style.setProperty('width', `${box.width}px`);
      el.style.setProperty('height', `${box.height}px`);
      setStage({
        w: worldW,
        h,
        scale,
        ox: Math.floor((cw - worldW * scale) / 2),
        oy: Math.floor((ch - h * scale) / 2),
      });
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el.parentElement!);
    return () => ro.disconnect();
  }, [canvas, worldW, minH, maxH]);
  return stage;
}

/** Prepares a frame: clears the whole canvas and maps game pixels onto it. */
export function begin(ctx: CanvasRenderingContext2D, s: Stage, outside: string) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = outside;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(s.scale, 0, 0, s.scale, s.ox, s.oy);
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, s.w, s.h);
  ctx.clip();
}
export const end = (ctx: CanvasRenderingContext2D) => ctx.restore();

/**
 * Fixed-step game loop: update(STEP) as many times as real time allows (max 5 per frame, so a
 * slow phone slows the game rather than skipping through walls), then draw once.
 */
export function useLoop(update: (dt: number) => void, draw: () => void, running: boolean) {
  const cb = useRef({ update, draw });
  useEffect(() => {
    cb.current = { update, draw };
  });
  useEffect(() => {
    if (!running) {
      // Paused or counting down: keep the scene on screen (a few frames a second is plenty).
      cb.current.draw();
      const id = setInterval(() => cb.current.draw(), 150);
      return () => clearInterval(id);
    }
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const tick = (now: number) => {
      acc += Math.min(0.1, (now - last) / 1000);
      last = now;
      let n = 0;
      while (acc >= STEP && n < 5) {
        cb.current.update(STEP);
        acc -= STEP;
        n++;
      }
      if (n === 5) acc = 0;
      cb.current.draw();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);
}

/** Draws the player's cat with its feet at (cx, footY), facing dir. */
export function drawCat(
  ctx: CanvasRenderingContext2D,
  look: CatLook,
  anim: Anim,
  t: number,
  cx: number,
  footY: number,
  dir: 1 | -1 = 1,
) {
  const frames = framesFor(look, anim);
  const img = frames[frameAt(anim, t) % frames.length]!;
  const x = Math.round(cx - FRAME_W / 2);
  const y = Math.round(footY - FRAME_FLOOR);
  if (dir < 0) {
    ctx.save();
    ctx.translate(x + FRAME_W, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
    ctx.restore();
  } else ctx.drawImage(img, x, y);
}

/** Pixel sprite from rows of characters and a palette (' ' or '.' is transparent). */
export function sprite(rows: string[], pal: Record<string, string>): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(...rows.map((r) => r.length));
  c.height = rows.length;
  const g = c.getContext('2d')!;
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }),
  );
  return c;
}

/** Pixel rectangle helper. */
export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: string,
) {
  ctx.fillStyle = c;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}
