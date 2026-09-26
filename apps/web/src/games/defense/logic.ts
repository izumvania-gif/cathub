import { rng, type Rand } from '../engine';

/**
 * «Оборона кухни»: three kitchen shelves (rows); mice run right to left towards the bowl. The
 * cat guards the left end of one row and swats mice that come close; a tap moves it to another
 * row. Caught mice drop cheese, which buys helpers: a scratching post that blocks a row, a yarn
 * ball that rolls down a row, and a kitten that swats in its cell. Five waves. Pure logic.
 */
export const W = 100;
export const ROWS = 3;
export const WAVES = 5;
export const CAT_X = 18;
const CAT_REACH = 28;
const CAT_COOL = 0.42;
const LEAP = 0.22;
export const SLOTS = [44, 64, 84];
export const START_FOOD = 100;

export type MouseKind = 'mouse' | 'fast' | 'fat' | 'thief';
export type HelperKind = 'post' | 'yarn' | 'kitten';

export const MOUSE: Record<MouseKind, { hp: number; speed: number; bite: number; cheese: number }> =
  {
    mouse: { hp: 1, speed: 15, bite: 10, cheese: 1 },
    fast: { hp: 1, speed: 28, bite: 10, cheese: 1 },
    fat: { hp: 3, speed: 9, bite: 10, cheese: 1 },
    thief: { hp: 2, speed: 18, bite: 20, cheese: 2 },
  };

export const HELPERS: Record<HelperKind, { cost: number; hp: number; label: string }> = {
  post: { cost: 3, hp: 8, label: 'Когтеточка' },
  yarn: { cost: 3, hp: 0, label: 'Клубок' },
  // A kitten swats this many times, then goes off to sleep.
  kitten: { cost: 5, hp: 5, label: 'Котёнок' },
};

export interface Mouse {
  id: number;
  row: number;
  x: number;
  hp: number;
  kind: MouseKind;
  /** Seconds since last hit (for a flash). */
  hurt: number;
  gnawing: boolean;
}

export interface Helper {
  id: number;
  row: number;
  slot: number;
  kind: 'post' | 'kitten';
  hp: number;
  cool: number;
  swipe: number;
}

export interface Yarn {
  id: number;
  row: number;
  x: number;
  hit: number[];
}

export type DefenseEvent = 'swat' | 'catch' | 'bite' | 'place' | 'wave' | 'win' | 'lose' | 'cheese';

export interface State {
  h: number;
  t: number;
  /** Waves fully cleared. */
  cleared: number;
  phase: 'break' | 'run';
  phaseT: number;
  queue: Array<{ kind: MouseKind; row: number }>;
  nextSpawn: number;
  spawnGap: number;
  mice: Mouse[];
  helpers: Helper[];
  yarns: Yarn[];
  cat: { row: number; from: number; leap: number; cool: number; swipe: number };
  cheese: number;
  cheeseT: number;
  food: number;
  /** Seconds since a mouse last reached the bowl, per row (for a red flash). */
  bitten: number[];
  caught: number;
  nextId: number;
  over: boolean;
  won: boolean;
  events: DefenseEvent[];
  rand: Rand;
}

export function init(seed: number, h: number): State {
  return {
    h,
    t: 0,
    cleared: 0,
    phase: 'break',
    phaseT: 0,
    queue: [],
    nextSpawn: 0,
    spawnGap: 1.6,
    mice: [],
    helpers: [],
    yarns: [],
    cat: { row: 1, from: 1, leap: LEAP, cool: 0, swipe: 9 },
    cheese: 3,
    cheeseT: 0,
    food: START_FOOD,
    bitten: [9, 9, 9],
    caught: 0,
    nextId: 1,
    over: false,
    won: false,
    events: [],
    rand: rng(seed),
  };
}

/** The floor line of a row, in world pixels (row 0 is the top shelf). */
export function rowY(h: number, row: number) {
  const top = 22;
  const gap = (h - top - 8) / ROWS;
  return Math.round(top + gap * (row + 1) - 2);
}

/** Wave n (0-based): which mice come, in order, and how fast they follow each other. */
export function waveMice(n: number, rand: Rand): { list: MouseKind[]; gap: number } {
  const count = 8 + n * 6;
  const pool: MouseKind[] = ['mouse'];
  if (n >= 1) pool.push('fast');
  if (n >= 2) pool.push('fat');
  if (n >= 3) pool.push('thief');
  const list = Array.from({ length: count }, (_, i) =>
    i < 2 ? 'mouse' : pool[Math.floor(rand() * pool.length)]!,
  );
  return { list, gap: Math.max(0.5, 1.4 - n * 0.22) };
}

function startWave(s: State) {
  const { list, gap } = waveMice(s.cleared, s.rand);
  s.queue = list.map((kind) => ({ kind, row: Math.floor(s.rand() * ROWS) }));
  s.spawnGap = gap;
  s.nextSpawn = 0.5;
  s.phase = 'run';
  s.phaseT = 0;
  s.events.push('wave');
}

function hit(s: State, m: Mouse) {
  m.hp -= 1;
  m.hurt = 0;
  if (m.hp <= 0) {
    s.caught += 1;
    // Cheese from every second mouse (big ones always drop some).
    if (MOUSE[m.kind].cheese > 1 || s.caught % 2 === 0) s.cheese += 1;
    s.events.push('catch');
  }
}

export function step(s: State, dt: number) {
  if (s.over) return;
  s.events = [];
  s.t += dt;
  s.phaseT += dt;
  s.bitten = s.bitten.map((b) => b + dt);
  const c = s.cat;
  c.leap = Math.min(LEAP, c.leap + dt);
  c.cool -= dt;
  c.swipe += dt;

  if (s.phase === 'break') {
    if (s.phaseT >= (s.cleared === 0 ? 1.5 : 3)) startWave(s);
    return;
  }

  // Spawn.
  if (s.queue.length && s.phaseT >= s.nextSpawn) {
    // Later waves send small packs at once, in different rows.
    const pack = 1 + Math.floor(s.rand() * Math.min(3, 1 + s.cleared * 0.8));
    const rows = new Set<number>();
    for (let i = 0; i < pack && s.queue.length; i++) {
      const q = s.queue.shift()!;
      let row = q.row;
      while (rows.has(row) && rows.size < ROWS) row = (row + 1) % ROWS;
      rows.add(row);
      s.mice.push({
        id: s.nextId++,
        row,
        x: W + 6 + i * 4,
        hp: MOUSE[q.kind].hp,
        kind: q.kind,
        hurt: 9,
        gnawing: false,
      });
    }
    s.nextSpawn = s.phaseT + s.spawnGap * pack * (0.7 + s.rand() * 0.6);
  }
  // Slow cheese income.
  s.cheeseT += dt;
  if (s.cheeseT >= 8) {
    s.cheeseT = 0;
    s.cheese += 1;
    s.events.push('cheese');
  }

  // Mice move unless a helper blocks them; blocked mice gnaw it.
  for (const m of s.mice) {
    m.hurt += dt;
    // Only a scratching post stops them; they run past kittens.
    const block = s.helpers.find(
      (hp) =>
        hp.kind === 'post' &&
        hp.row === m.row &&
        m.x - 4 <= SLOTS[hp.slot]! + 6 &&
        m.x > SLOTS[hp.slot]! - 2,
    );
    m.gnawing = Boolean(block);
    if (block) block.hp -= dt;
    else m.x -= MOUSE[m.kind].speed * (1 + s.cleared * 0.12) * dt; // later waves run faster
  }
  s.helpers = s.helpers.filter((hp) => hp.hp > 0);

  // Kittens swat whatever reaches their cell.
  for (const k of s.helpers) {
    k.cool -= dt;
    k.swipe += dt;
    if (k.kind !== 'kitten' || k.cool > 0) continue;
    const target = s.mice.find(
      (m) => m.hp > 0 && m.row === k.row && m.x >= SLOTS[k.slot]! - 2 && m.x <= SLOTS[k.slot]! + 16,
    );
    if (target) {
      hit(s, target);
      k.cool = 0.9;
      k.swipe = 0;
      k.hp -= 1;
      s.events.push('swat');
    }
  }
  s.helpers = s.helpers.filter((hp) => hp.hp > 0);

  // The cat swats the nearest mouse in its row.
  if (c.leap >= LEAP && c.cool <= 0) {
    const target = s.mice
      .filter((m) => m.hp > 0 && m.row === c.row && m.x <= CAT_X + CAT_REACH)
      .sort((a, b) => a.x - b.x)[0];
    if (target) {
      hit(s, target);
      c.cool = CAT_COOL;
      c.swipe = 0;
      s.events.push('swat');
    }
  }

  // Yarn balls roll right and knock every mouse once.
  for (const y of s.yarns) {
    y.x += 90 * dt;
    for (const m of s.mice)
      if (m.hp > 0 && m.row === y.row && Math.abs(m.x - y.x) < 6 && !y.hit.includes(m.id)) {
        y.hit.push(m.id);
        hit(s, m);
      }
  }
  s.yarns = s.yarns.filter((y) => y.x < W + 10);

  // Mice that reach the bowl bite into the food.
  for (const m of s.mice)
    if (m.hp > 0 && m.x < 4) {
      m.hp = 0;
      s.food = Math.max(0, s.food - MOUSE[m.kind].bite);
      s.bitten[m.row] = 0;
      s.events.push('bite');
    }
  s.mice = s.mice.filter((m) => m.hp > 0 || m.hurt < 0.25);

  if (s.food <= 0) {
    s.over = true;
    s.events.push('lose');
    return;
  }
  if (!s.queue.length && !s.mice.some((m) => m.hp > 0)) {
    s.cleared += 1;
    if (s.cleared >= WAVES) {
      s.over = true;
      s.won = true;
      s.events.push('win');
    } else {
      s.phase = 'break';
      s.phaseT = 0;
    }
  }
}

export function moveCat(s: State, row: number) {
  if (s.over || row === s.cat.row || row < 0 || row >= ROWS) return;
  s.cat.from = s.cat.row;
  s.cat.row = row;
  s.cat.leap = 0;
}

/** Free cells of a row (indexes into SLOTS). */
export const freeSlots = (s: State, row: number) => {
  const taken = new Set(s.helpers.filter((h) => h.row === row).map((h) => h.slot));
  return SLOTS.map((_, i) => i).filter((i) => !taken.has(i));
};

/** The row whose shelf space contains world y (taps anywhere above a shelf count for it). */
export function rowAt(h: number, y: number) {
  for (let r = 0; r < ROWS; r++) if (y <= rowY(h, r) + 3) return r;
  return ROWS - 1;
}

/**
 * Puts a helper in a row: in the free cell nearest `x` (where the player tapped), or the one
 * nearest the cat. A yarn ball rolls at once.
 */
export function place(s: State, kind: HelperKind, row: number, x?: number): boolean {
  if (s.over || s.cheese < HELPERS[kind].cost) return false;
  if (kind === 'yarn') {
    s.yarns.push({ id: s.nextId++, row, x: CAT_X + 10, hit: [] });
  } else {
    const free = freeSlots(s, row);
    if (!free.length) return false;
    const slot =
      x === undefined
        ? free[0]!
        : free.reduce((a, b) => (Math.abs(SLOTS[b]! - x) < Math.abs(SLOTS[a]! - x) ? b : a));
    s.helpers.push({ id: s.nextId++, row, slot, kind, hp: HELPERS[kind].hp, cool: 0, swipe: 9 });
  }
  s.cheese -= HELPERS[kind].cost;
  s.events.push('place');
  return true;
}

export const score = (s: State) => s.cleared * 100 + (s.won ? s.food : 0);
export const stats = (s: State) => ({
  score: score(s),
  waves: s.cleared,
  food: s.won ? s.food : 0,
});
