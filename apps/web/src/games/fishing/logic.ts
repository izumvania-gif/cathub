import { rng, type Rand } from '../engine';

/**
 * «Рыбалка»: fish swim across the aquarium; a tap catches the fish inside the paw band in the
 * middle. Catches in a row raise the multiplier; a tap on nothing or on the spiky ruff breaks
 * the streak. Pure logic, no DOM.
 */
export const W = 96;
export const DURATION = 45;
export const BAND = 8; // half-width of the paw band
/** After a miss the paw rests: taps are ignored for this long (no point in tapping nonstop). */
export const TIRED = 1.5;
const MAX_MULT = 4;

export type FishKind = 'fish' | 'gold' | 'ruff';

export interface Fish {
  id: number;
  x: number;
  y: number;
  vx: number;
  kind: FishKind;
  color: number;
  /** Seconds since caught (then it flies to the paw and fades). */
  caught: number | null;
}

export interface Pop {
  x: number;
  y: number;
  text: string;
  t: number;
}

export interface State {
  h: number;
  t: number;
  fish: Fish[];
  nextSpawn: number;
  nextId: number;
  score: number;
  caught: number;
  streak: number;
  bestStreak: number;
  /** Seconds since the last swipe (for the paw animation). */
  paw: number;
  /** Seconds the paw still rests after a miss. */
  tired: number;
  pops: Pop[];
  over: boolean;
  rand: Rand;
}

export const BASE: Record<FishKind, number> = { fish: 1, gold: 3, ruff: 0 };

export function init(seed: number, h: number): State {
  return {
    h,
    t: 0,
    fish: [],
    nextSpawn: 0.3,
    nextId: 1,
    score: 0,
    caught: 0,
    streak: 0,
    bestStreak: 0,
    paw: 9,
    tired: 0,
    pops: [],
    over: false,
    rand: rng(seed),
  };
}

export const multiplier = (streak: number) => Math.min(MAX_MULT, 1 + Math.floor(streak / 3));
export const timeLeft = (s: State) => Math.max(0, DURATION - s.t);
/** Fish swim between the surface and the cat's head. */
export const swimTop = 14;
export const swimBottom = (h: number) => h - 44;

function spawn(s: State) {
  const r = s.rand;
  const fromLeft = r() < 0.5;
  const hurry = Math.min(1, s.t / DURATION);
  const roll = r();
  const kind: FishKind = roll < 0.08 ? 'gold' : roll < 0.08 + 0.1 + hurry * 0.08 ? 'ruff' : 'fish';
  const speed = (18 + r() * 22 + hurry * 22) * (kind === 'gold' ? 1.6 : 1);
  s.fish.push({
    id: s.nextId++,
    x: fromLeft ? -10 : W + 10,
    y: swimTop + r() * (swimBottom(s.h) - swimTop),
    vx: fromLeft ? speed : -speed,
    kind,
    color: Math.floor(r() * 4),
    caught: null,
  });
  s.nextSpawn = s.t + 0.55 + r() * (1.1 - hurry * 0.5);
}

export function step(s: State, dt: number) {
  if (s.over) return;
  s.t += dt;
  s.paw += dt;
  s.tired = Math.max(0, s.tired - dt);
  if (s.t >= DURATION) {
    s.over = true;
    return;
  }
  if (s.t >= s.nextSpawn) spawn(s);
  for (const f of s.fish) {
    if (f.caught !== null) f.caught += dt;
    else f.x += f.vx * dt;
  }
  s.fish = s.fish.filter((f) => (f.caught === null ? f.x > -14 && f.x < W + 14 : f.caught < 0.4));
  for (const p of s.pops) p.t += dt;
  s.pops = s.pops.filter((p) => p.t < 0.8);
}

/** Fish inside the paw band, nearest to the middle first. */
export function inBand(s: State): Fish | undefined {
  return s.fish
    .filter((f) => f.caught === null && Math.abs(f.x - W / 2) <= BAND)
    .sort((a, b) => Math.abs(a.x - W / 2) - Math.abs(b.x - W / 2))[0];
}

export type TapResult = 'catch' | 'gold' | 'ruff' | 'miss' | 'tired';

export function tap(s: State): TapResult {
  if (s.over || s.tired > 0) return 'tired';
  s.paw = 0;
  const f = inBand(s);
  if (!f) {
    s.streak = 0;
    s.tired = TIRED;
    s.pops.push({ x: W / 2, y: swimBottom(s.h), text: 'мимо', t: 0 });
    return 'miss';
  }
  f.caught = 0;
  if (f.kind === 'ruff') {
    s.streak = 0;
    s.tired = TIRED;
    s.pops.push({ x: f.x, y: f.y, text: 'ай!', t: 0 });
    return 'ruff';
  }
  const gain = BASE[f.kind] * multiplier(s.streak);
  s.score += gain;
  s.caught += 1;
  s.streak += 1;
  s.bestStreak = Math.max(s.bestStreak, s.streak);
  s.pops.push({ x: f.x, y: f.y, text: `+${gain}`, t: 0 });
  return f.kind === 'gold' ? 'gold' : 'catch';
}

export const stats = (s: State) => ({ score: s.score, caught: s.caught, streak: s.bestStreak });
