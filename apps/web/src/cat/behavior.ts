import { ANIMS, type Anim } from './sprite';

/**
 * How the cat feels, derived from the chores (see catMood) — it only picks behaviours; it never
 * blocks anything. Kept pure so it can be unit-tested and replayed with a seeded random.
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

export interface Scene {
  /** Width of the room in sprite pixels. */
  width: number;
  /** Left edge of the cat frame when eating from the bowl. */
  bowlX: number;
  /** Left edge of the cat frame when sleeping in its spot. */
  bedX: number;
}

export interface CatState {
  x: number;
  dir: 1 | -1;
  act: Anim;
  /** Seconds spent in the current act. */
  t: number;
  dur: number;
  targetX: number | null;
  /** Ate once in this "fed" mood, so it moves on to grooming and resting. */
  ate: boolean;
  bubble: string | null;
}

export const MOVING: ReadonlySet<Anim> = new Set(['walk', 'run']);
const SPEED: Partial<Record<Anim, number>> = { walk: 9, run: 24 };

export const BUBBLES: Partial<Record<Anim, string>> = {
  meow: 'мяу?',
  grumpy: 'фу!',
  sleep: 'z z',
  happy: '♥',
  eat: 'ням',
};

export function initialState(scene: Scene, rand = Math.random): CatState {
  return {
    x: Math.round(rand() * (scene.width - 40)),
    dir: rand() < 0.5 ? 1 : -1,
    act: 'sit',
    t: 0,
    dur: 1,
    targetX: null,
    ate: false,
    bubble: null,
  };
}

type Choice = [weight: number, anim: Anim, dur: [number, number]];

function pick(choices: Choice[], rand: () => number) {
  const total = choices.reduce((s, c) => s + c[0], 0);
  let r = rand() * total;
  for (const c of choices) {
    r -= c[0];
    if (r <= 0) return c;
  }
  return choices[choices.length - 1]!;
}

function goTo(s: CatState, x: number, anim: Anim = 'walk'): CatState {
  return { ...s, act: anim, t: 0, dur: 30, targetX: x, dir: x >= s.x ? 1 : -1, bubble: null };
}

function doing(s: CatState, anim: Anim, [a, b]: [number, number], rand: () => number): CatState {
  return {
    ...s,
    act: anim,
    t: 0,
    dur: a + rand() * (b - a),
    targetX: null,
    bubble: BUBBLES[anim] ?? null,
  };
}

function wander(s: CatState, scene: Scene, rand: () => number, anim: Anim = 'walk') {
  const max = Math.max(0, scene.width - 40);
  // Pick somewhere at least a few steps away so walks don't look like twitches.
  let x = Math.round(rand() * max);
  if (Math.abs(x - s.x) < 12) x = s.x < max / 2 ? Math.min(max, s.x + 20) : Math.max(0, s.x - 20);
  return goTo(s, x, anim);
}

/** What to do next, given the mood. */
export function nextAct(s: CatState, mood: Mood, scene: Scene, rand = Math.random): CatState {
  const near = (x: number) => Math.abs(s.x - x) < 2;
  switch (mood) {
    case 'hungry':
      if (!near(scene.bowlX)) return goTo(s, scene.bowlX);
      return doing(
        { ...s, dir: 1 },
        pick(
          [
            [3, 'meow', [2.5, 4]],
            [2, 'sit', [2, 3]],
          ],
          rand,
        )[1],
        [2.5, 4],
        rand,
      );
    case 'fed':
      if (!s.ate) {
        if (!near(scene.bowlX)) return goTo(s, scene.bowlX, 'run');
        return { ...doing({ ...s, dir: 1 }, 'eat', [7, 9], rand), ate: true };
      }
      return doing(s, s.act === 'eat' ? 'groom' : 'loaf', [5, 8], rand);
    case 'grumpy': {
      const c = pick(
        [
          [4, 'grumpy', [4, 6]],
          [2, 'walk', [0, 0]],
          [1, 'sit', [2, 3]],
        ],
        rand,
      );
      return c[1] === 'walk' ? wander(s, scene, rand) : doing(s, c[1], c[2], rand);
    }
    case 'restless': {
      const c = pick(
        [
          [5, 'walk', [0, 0]],
          [2, 'run', [0, 0]],
          [2, 'meow', [1.5, 2.5]],
          [1, 'sit', [1, 2]],
        ],
        rand,
      );
      return MOVING.has(c[1]) ? wander(s, scene, rand, c[1]) : doing(s, c[1], c[2], rand);
    }
    case 'sleepy':
      if (!near(scene.bedX)) return goTo(s, scene.bedX);
      return doing(s, 'sleep', [20, 40], rand);
    case 'happy': {
      const c = pick(
        [
          [3, 'play', [3, 5]],
          [3, 'happy', [3, 5]],
          [2, 'walk', [0, 0]],
          [1, 'jump', [1, 1]],
          [1, 'loaf', [4, 6]],
        ],
        rand,
      );
      return c[1] === 'walk' ? wander(s, scene, rand) : doing(s, c[1], c[2], rand);
    }
    case 'calm': {
      const c = pick(
        [
          [5, 'walk', [0, 0]],
          [2, 'sit', [3, 5]],
          [2, 'loaf', [5, 8]],
          [2, 'groom', [3, 4]],
          [1, 'stretch', [2, 2]],
          [1, 'sleep', [6, 10]],
        ],
        rand,
      );
      return c[1] === 'walk' ? wander(s, scene, rand) : doing(s, c[1], c[2], rand);
    }
  }
}

/** Advances the simulation by dt seconds. */
export function step(
  s: CatState,
  dt: number,
  mood: Mood,
  scene: Scene,
  rand = Math.random,
): CatState {
  const max = Math.max(0, scene.width - 40);
  if (s.targetX !== null) {
    const speed = SPEED[s.act] ?? 9;
    const d = s.targetX - s.x;
    const move = Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    const x = Math.max(0, Math.min(max, s.x + move));
    if (Math.abs(s.targetX - x) < 0.5 || x === 0 || x === max) {
      return nextAct({ ...s, x: Math.round(x), targetX: null }, mood, scene, rand);
    }
    return { ...s, x, t: s.t + dt };
  }
  const t = s.t + dt;
  if (t >= s.dur) return nextAct({ ...s, t }, mood, scene, rand);
  return { ...s, t };
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
