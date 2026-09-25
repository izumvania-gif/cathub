import type { Layout, Spot, SpotKind } from './room';
import { ANIMS, type Anim } from './sprite';

/**
 * How the cat feels, derived from the chores (see catMood). It only picks behaviours. Pure and
 * driven by an injectable random so it can be unit-tested and replayed.
 */
export type Mood = 'fed' | 'hungry' | 'grumpy' | 'restless' | 'sleepy' | 'happy' | 'calm';

export const MOOD_LABELS: Record<Mood, string> = {
  fed: 'только что поел',
  hungry: 'ждёт еду',
  grumpy: 'недоволен лотком',
  restless: 'беспокоится',
  sleepy: 'спит',
  happy: 'доволен',
  calm: 'гуляет',
};

type Step =
  | { k: 'walk'; x: number; run?: boolean }
  | { k: 'leap'; x: number; y: number }
  | { k: 'act'; anim: Anim; dur: number; dir?: 1 | -1; spot?: Spot; hidden?: boolean };

export interface CatState {
  x: number;
  /** Height above the floor (on a sill, on the cat tree). */
  y: number;
  dir: 1 | -1;
  act: Anim;
  /** Seconds into the current step. */
  t: number;
  dur: number;
  /** The step being done now, and what comes after it. */
  cur: Step | null;
  plan: Step[];
  /** Where the leap started. */
  from: { x: number; y: number } | null;
  spot: Spot | null;
  hidden: boolean;
  bubble: string | null;
  /** Ate once in this "fed" mood, so it moves on to grooming and resting. */
  ate: boolean;
  ball: { x: number; v: number };
  /** Spring mouse wobble 0…1 after being batted. */
  wobble: number;
}

export const BUBBLES: Partial<Record<Anim, string>> = {
  meow: 'мяу?',
  grumpy: 'фу!',
  sleep: 'z z',
  happy: '♥',
  eat: 'ням',
  knead: '♥',
  belly: '♥',
  watch: '!',
};

const SPEED = { walk: 10, run: 26 };
const LEAP_TIME = 0.55;
const MAX = (l: Layout) => Math.max(0, l.width - 40);

export function initialState(l: Layout, rand = Math.random): CatState {
  return {
    x: Math.round(rand() * MAX(l)),
    y: 0,
    dir: rand() < 0.5 ? 1 : -1,
    act: 'sit',
    t: 0,
    dur: 1,
    cur: null,
    plan: [],
    from: null,
    spot: null,
    hidden: false,
    bubble: null,
    ate: false,
    ball: { x: Math.round(l.width * 0.42), v: 0 },
    wobble: 0,
  };
}

function range(rand: () => number, a: number, b: number) {
  return a + rand() * (b - a);
}

function pickWeighted<T>(choices: [number, T][], rand: () => number): T {
  const total = choices.reduce((s, c) => s + c[0], 0);
  let r = rand() * total;
  for (const c of choices) {
    r -= c[0];
    if (r <= 0) return c[1];
  }
  return choices[choices.length - 1]![1];
}

const DURATION: Partial<Record<Anim, [number, number]>> = {
  sit: [2, 4],
  meow: [2.5, 4],
  groom: [3, 5],
  eat: [7, 9],
  sleep: [15, 30],
  loaf: [5, 9],
  stretch: [2, 2],
  jump: [1, 1],
  happy: [3, 5],
  grumpy: [4, 6],
  play: [2.5, 3.5],
  scratch: [2.5, 4],
  bat: [2, 3.5],
  knead: [3, 5],
  belly: [3, 5],
  pounce: [0.9, 1.4],
  watch: [4, 8],
  sniff: [1.5, 2.5],
};

function act(anim: Anim, rand: () => number, extra: Partial<Step & { k: 'act' }> = {}): Step {
  const [a, b] = DURATION[anim] ?? [2, 3];
  return { k: 'act', anim, dur: range(rand, a, b), ...extra };
}

/** Steps to get from where the cat is to (x, y), leaping up or down as needed. */
function route(s: CatState, l: Layout, x: number, y: number, leapIn = false, run = false): Step[] {
  const steps: Step[] = [];
  let cx = s.x;
  if (s.y === y && Math.abs(cx - x) < 2 && (y > 0 || !leapIn || s.spot)) return steps; // already there
  if (s.y > 0) {
    // Jump down beside the perch first.
    const side = x >= cx ? 1 : -1;
    const land = Math.max(0, Math.min(MAX(l), cx + side * 12));
    steps.push({ k: 'leap', x: land, y: 0 });
    cx = land;
  }
  if (y > 0 || leapIn) {
    // Walk to a take-off point next to the target, then leap.
    const side = cx <= x ? -1 : 1;
    const takeoff = Math.max(0, Math.min(MAX(l), x + side * 14));
    if (Math.abs(takeoff - cx) >= 1) steps.push({ k: 'walk', x: takeoff, run });
    steps.push({ k: 'leap', x, y });
  } else if (Math.abs(x - cx) >= 1) {
    steps.push({ k: 'walk', x, run });
  }
  return steps;
}

function spotPlan(s: CatState, l: Layout, spot: Spot, rand: () => number, anim?: Anim): Step[] {
  const x = spot.kind === 'ball' ? Math.max(0, Math.min(MAX(l), s.ball.x - 33)) : spot.x;
  const steps = route(s, l, x, spot.y, spot.leap);
  if (spot.kind === 'ball') {
    return [...steps, act('pounce', rand, { dir: 1 }), act('play', rand, { dir: 1, spot })];
  }
  if (spot.kind === 'hide')
    return [
      ...steps,
      act('sit', rand, { dir: spot.dir, spot, hidden: true, dur: range(rand, 4, 8) }),
    ];
  const a = anim ?? spot.acts[Math.floor(rand() * spot.acts.length)]!;
  return [...steps, act(a, rand, { dir: spot.dir, spot })];
}

function wander(s: CatState, l: Layout, rand: () => number, run = false): Step[] {
  let x = Math.round(rand() * MAX(l));
  if (Math.abs(x - s.x) < 14)
    x = s.x < MAX(l) / 2 ? Math.min(MAX(l), s.x + 24) : Math.max(0, s.x - 24);
  return route(s, l, x, 0, false, run);
}

/** What to do next, given the mood and the room. */
export function plan(s: CatState, mood: Mood, l: Layout, rand = Math.random): Step[] {
  const spots = (k: SpotKind | SpotKind[]) =>
    l.spots.filter((p) => (Array.isArray(k) ? k : [k]).includes(p.kind));
  const any = (k: SpotKind | SpotKind[]) => {
    const xs = spots(k);
    return xs.length ? xs[Math.floor(rand() * xs.length)]! : null;
  };
  const here = (anim: Anim) => [act(anim, rand)];

  switch (mood) {
    case 'hungry':
      if (Math.abs(s.x - l.bowlX) >= 2 || s.y > 0) return route(s, l, l.bowlX, 0);
      return [act(rand() < 0.6 ? 'meow' : 'sit', rand, { dir: 1 })];
    case 'fed':
      if (!s.ate) {
        if (Math.abs(s.x - l.bowlX) >= 2 || s.y > 0) return route(s, l, l.bowlX, 0, false, true);
        return [act('eat', rand, { dir: 1 })];
      }
      return s.act === 'eat' ? here('groom') : spotOr(['bed', 'rug'], 'loaf');
    case 'sleepy': {
      const bed = any('bed') ?? any('perch') ?? any('box');
      if (bed) return spotPlan(s, l, bed, rand, bed.acts.includes('sleep') ? 'sleep' : 'loaf');
      if (Math.abs(s.x - l.napX) >= 2 || s.y > 0) return route(s, l, l.napX, 0);
      return here('sleep');
    }
    case 'grumpy':
      return pickWeighted<() => Step[]>(
        [
          [4, () => here('grumpy')],
          [
            spots(['hide', 'box']).length ? 3 : 0,
            () => spotPlan(s, l, any(['hide', 'box'])!, rand),
          ],
          [spots('perch').length ? 2 : 0, () => spotPlan(s, l, any('perch')!, rand, 'loaf')],
          [2, () => wander(s, l, rand)],
        ],
        rand,
      )();
    case 'restless':
      return pickWeighted<() => Step[]>(
        [
          [4, () => wander(s, l, rand, rand() < 0.4)],
          [spots('perch').length ? 2 : 0, () => spotPlan(s, l, any('perch')!, rand, 'watch')],
          [spots('scratch').length ? 2 : 0, () => spotPlan(s, l, any('scratch')!, rand)],
          [1, () => here('meow')],
        ],
        rand,
      )();
    case 'happy':
      return pickWeighted<() => Step[]>(
        [
          [
            spots(['ball', 'bat']).length ? 4 : 0,
            () => spotPlan(s, l, any(['ball', 'bat'])!, rand),
          ],
          [
            spots('rug').length ? 2 : 0,
            () => spotPlan(s, l, any('rug')!, rand, rand() < 0.5 ? 'belly' : 'knead'),
          ],
          [
            spots(['perch', 'box', 'watch']).length ? 2 : 0,
            () => spotPlan(s, l, any(['perch', 'box', 'watch'])!, rand),
          ],
          [2, () => (s.y > 0 ? wander(s, l, rand) : here('happy'))],
          [2, () => wander(s, l, rand, rand() < 0.3)],
          [1, () => (s.y > 0 ? wander(s, l, rand) : here('jump'))],
        ],
        rand,
      )();
    case 'calm':
      return pickWeighted<() => Step[]>(
        [
          [4, () => wander(s, l, rand)],
          [
            l.spots.length ? 5 : 0,
            () => spotPlan(s, l, l.spots[Math.floor(rand() * l.spots.length)]!, rand),
          ],
          [2, () => here('sit')],
          [1, () => here('groom')],
          [1, () => here('stretch')],
          [1, () => here('loaf')],
        ],
        rand,
      )();
  }

  function spotOr(kinds: SpotKind[], fallback: Anim): Step[] {
    const p = any(kinds);
    return p
      ? spotPlan(s, l, p, rand, p.acts.includes(fallback) ? fallback : undefined)
      : here(fallback);
  }
}

/** Starts the next step of the plan, making a new plan when it runs out. */
function begin(s: CatState, mood: Mood, l: Layout, rand: () => number): CatState {
  let steps = s.plan;
  if (!steps.length) steps = plan(s, mood, l, rand);
  if (!steps.length) steps = [act('sit', rand)];
  const [head, ...rest] = steps;
  const base = { ...s, cur: head!, plan: rest, t: 0, from: null, bubble: null as string | null };
  switch (head!.k) {
    case 'walk':
      return {
        ...base,
        act: head!.run ? 'run' : 'walk',
        dur: Infinity,
        dir: head!.x >= s.x ? 1 : -1,
        spot: null,
        hidden: false,
      };
    case 'leap':
      return {
        ...base,
        act: head!.y > s.y ? 'leapUp' : 'leapDown',
        dur: LEAP_TIME,
        dir: head!.x > s.x ? 1 : head!.x < s.x ? -1 : s.dir,
        from: { x: s.x, y: s.y },
        spot: null,
        hidden: false,
      };
    case 'act': {
      const a = head!;
      return {
        ...base,
        act: a.anim,
        dur: a.dur,
        dir: a.dir ?? s.dir,
        spot: a.spot ?? (s.y > 0 ? s.spot : null),
        hidden: !!a.hidden,
        bubble: a.hidden ? null : (BUBBLES[a.anim] ?? null),
        ate: s.ate || a.anim === 'eat',
      };
    }
  }
}

/** Advances the simulation by dt seconds. */
export function step(s: CatState, dt: number, mood: Mood, l: Layout, rand = Math.random): CatState {
  // The ball rolls and slows down; the spring mouse settles.
  let ball = s.ball;
  if (ball.v) {
    let x = ball.x + ball.v * dt;
    let v = ball.v * Math.pow(0.25, dt);
    if (x < 2 || x > l.width - 10) {
      x = Math.max(2, Math.min(l.width - 10, x));
      v = -v * 0.5;
    }
    ball = { x, v: Math.abs(v) < 2 ? 0 : v };
  }
  const wobble = Math.max(0, s.wobble - dt * 0.6);
  s = { ...s, ball, wobble };

  const head = s.cur;
  if (head?.k === 'walk') {
    const speed = head.run ? SPEED.run : SPEED.walk;
    const d = head.x - s.x;
    const x = s.x + Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    if (Math.abs(head.x - x) < 0.5) return begin({ ...s, x: head.x }, mood, l, rand);
    return { ...s, x, t: s.t + dt };
  }
  if (head?.k === 'leap' && s.from) {
    const t = s.t + dt;
    const k = Math.min(1, t / LEAP_TIME);
    const arc = Math.sin(Math.PI * k) * (6 + Math.abs(head.y - s.from.y) * 0.3);
    const x = s.from.x + (head.x - s.from.x) * k;
    const y = s.from.y + (head.y - s.from.y) * k + arc;
    if (k >= 1) return begin({ ...s, x: head.x, y: head.y }, mood, l, rand);
    return { ...s, x, y, t };
  }
  const t = s.t + dt;
  if (s.act === 'bat' && s.spot?.kind === 'bat') s = { ...s, wobble: 1 };
  if (t >= s.dur) {
    let next = { ...s, t };
    if (s.act === 'play') {
      // Swat the ball away and go after it next time.
      const dir = rand() < 0.5 ? -1 : 1;
      next = { ...next, ball: { x: s.ball.x, v: dir * range(rand, 30, 60) } };
    }
    return begin(next, mood, l, rand);
  }
  return { ...s, t };
}

/** Interrupts whatever the cat is doing (the mood changed or someone tapped it). */
export function replan(s: CatState, mood: Mood, l: Layout, rand = Math.random): CatState {
  // Mid-leap the cat lands first.
  const landed = s.cur?.k === 'leap' ? { ...s, x: s.cur.x, y: s.cur.y } : s;
  return begin({ ...landed, plan: [], ate: false }, mood, l, rand);
}

export function react(s: CatState, rand = Math.random): CatState {
  const anim: Anim = s.act === 'sleep' ? 'stretch' : rand() < 0.6 ? 'happy' : 'meow';
  if (s.hidden || s.cur?.k === 'leap') return s;
  return {
    ...s,
    act: anim,
    t: 0,
    dur: 2.2,
    cur: { k: 'act', anim, dur: 2.2 },
    plan: [],
    bubble: BUBBLES[anim] ?? null,
  };
}

/** The frame to draw for an act at time t (loops; one-shot acts hold their last frame). */
export function frameAt(act: Anim, t: number): number {
  const a = ANIMS[act];
  const i = Math.floor(t * a.fps);
  return act === 'jump' || act === 'stretch' ? Math.min(i, a.frames - 1) : i % a.frames;
}

/** A single still pose per mood for reduced motion. */
export const STILL: Record<Mood, Anim> = {
  fed: 'groom',
  hungry: 'meow',
  grumpy: 'grumpy',
  restless: 'sit',
  sleepy: 'sleep',
  happy: 'happy',
  calm: 'loaf',
};
