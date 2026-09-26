import { rng, type Rand } from '../engine';

/**
 * «Прыг-скок» (a Doodle Jump for cats). y grows downwards, so climbing means y going negative.
 * The generator builds a path of solid shelves that is always reachable, then adds decoys
 * (cardboard that breaks), cushions, catnip, fish and, higher up, vacuum cleaners.
 */
export const W = 120;
export const GRAVITY = 520;
export const JUMP = 270; // reach ≈ JUMP² / 2g = 70 px
export const SPRING = 430;
export const NIP_SPEED = 250;
export const NIP_TIME = 1.6;
const MOVE = 115;
export const PLAT_W = 26;

export type PlatKind = 'shelf' | 'moving' | 'fragile';

export interface Plat {
  id: number;
  x: number; // left
  y: number; // top
  kind: PlatKind;
  vx: number;
  broken: number | null; // seconds since it broke
  cushion: boolean;
}

export interface Thing {
  id: number;
  kind: 'coin' | 'nip' | 'vacuum';
  x: number; // centre
  y: number; // bottom
  vx: number;
  gone: boolean;
}

export interface State {
  h: number;
  t: number;
  x: number;
  y: number; // feet
  vx: number;
  vy: number;
  dir: 1 | -1;
  nip: number; // catnip flight time left
  camY: number; // top of the view
  maxClimb: number;
  coins: number;
  stomps: number;
  plats: Plat[];
  things: Thing[];
  /** Highest generated path platform (y) and its centre x. */
  genY: number;
  genX: number;
  nextId: number;
  over: boolean;
  /** Last landing kind, for sounds. */
  events: Array<'jump' | 'spring' | 'coin' | 'nip' | 'stomp' | 'break' | 'fall' | 'hit'>;
  rand: Rand;
}

export function init(seed: number, h: number): State {
  const s: State = {
    h,
    t: 0,
    x: W / 2,
    y: 0,
    vx: 0,
    vy: -JUMP,
    dir: 1,
    nip: 0,
    camY: -h + 30,
    maxClimb: 0,
    coins: 0,
    stomps: 0,
    plats: [],
    things: [],
    genY: 0,
    genX: W / 2,
    nextId: 1,
    over: false,
    events: [],
    rand: rng(seed),
  };
  // A floor-wide shelf to start from.
  s.plats.push({
    id: s.nextId++,
    x: W / 2 - PLAT_W / 2,
    y: 0,
    kind: 'shelf',
    vx: 0,
    broken: null,
    cushion: false,
  });
  generate(s);
  return s;
}

export const climb = (s: State) => Math.max(0, Math.floor(s.maxClimb));
export const score = (s: State) => Math.floor(climb(s) / 10) + s.coins * 5 + s.stomps * 10;
const difficulty = (s: State) => Math.min(1, -s.genY / 5000);

/** Adds platforms up to a screen above the view. */
function generate(s: State) {
  const r = s.rand;
  while (s.genY > s.camY - s.h) {
    const d = difficulty(s);
    const gap = 20 + d * 30 + r() * 8; // ≤ 58 < reach
    const y = s.genY - gap;
    // Next centre: anywhere, but not absurdly far (the screen wraps, so any x is reachable).
    let x = s.genX + (r() * 2 - 1) * (40 + d * 30);
    x = ((x % W) + W) % W;
    const moving = r() < 0.08 + d * 0.3;
    const plat: Plat = {
      id: s.nextId++,
      x: Math.max(0, Math.min(W - PLAT_W, x - PLAT_W / 2)),
      y,
      kind: moving ? 'moving' : 'shelf',
      vx: moving ? (r() < 0.5 ? -1 : 1) * (18 + d * 30) : 0,
      broken: null,
      cushion: !moving && r() < 0.07,
    };
    s.plats.push(plat);
    const cx = plat.x + PLAT_W / 2;
    // Decoy cardboard between path shelves.
    if (r() < 0.1 + d * 0.25) {
      const dx = W / 2 + (r() - 0.5) * 40;
      s.plats.push({
        id: s.nextId++,
        x:
          ((cx + dx) % W) - PLAT_W / 2 < 0 ? 0 : Math.min(W - PLAT_W, ((cx + dx) % W) - PLAT_W / 2),
        y: y + gap / 2,
        kind: 'fragile',
        vx: 0,
        broken: null,
        cushion: false,
      });
    }
    if (!plat.cushion && r() < 0.28)
      s.things.push({ id: s.nextId++, kind: 'coin', x: cx, y: y - 14, vx: 0, gone: false });
    else if (!plat.cushion && -y > 600 && r() < 0.025)
      s.things.push({ id: s.nextId++, kind: 'nip', x: cx, y, vx: 0, gone: false });
    if (-y > 1500 && r() < 0.05 + d * 0.06)
      s.things.push({
        id: s.nextId++,
        kind: 'vacuum',
        x: r() * W,
        y: y + gap / 2,
        vx: (r() < 0.5 ? -1 : 1) * (14 + d * 18),
        gone: false,
      });
    s.genY = y;
    s.genX = cx;
  }
}

/** input: −1 … 1 (left/right). */
export function step(s: State, dt: number, input: number) {
  if (s.over) return;
  s.events = [];
  s.t += dt;
  // Horizontal: ease towards the input speed, wrap at the edges.
  const target = Math.max(-1, Math.min(1, input)) * MOVE;
  s.vx += (target - s.vx) * Math.min(1, dt * 18); // snappy, but not instant
  s.x = (((s.x + s.vx * dt) % W) + W) % W;
  if (Math.abs(s.vx) > 8) s.dir = s.vx > 0 ? 1 : -1;

  const prevY = s.y;
  if (s.nip > 0) {
    s.nip -= dt;
    s.vy = -NIP_SPEED;
  } else s.vy += GRAVITY * dt;
  s.y += s.vy * dt;

  for (const p of s.plats) {
    if (p.kind === 'moving') {
      p.x += p.vx * dt;
      if (p.x < 0 || p.x > W - PLAT_W) {
        p.vx = -p.vx;
        p.x = Math.max(0, Math.min(W - PLAT_W, p.x));
      }
    }
    if (p.broken !== null) p.broken += dt;
  }
  for (const v of s.things)
    if (v.kind === 'vacuum' && !v.gone) {
      v.x += v.vx * dt;
      if (v.x < 8 || v.x > W - 8) v.vx = -v.vx;
    }

  // Landing: only while falling, when the feet cross a platform top.
  if (s.vy > 0) {
    for (const p of s.plats) {
      if (p.broken !== null) continue;
      if (prevY <= p.y && s.y >= p.y && s.x > p.x - 6 && s.x < p.x + PLAT_W + 6) {
        if (p.kind === 'fragile') {
          p.broken = 0;
          s.events.push('break');
          continue;
        }
        s.y = p.y;
        s.vy = p.cushion ? -SPRING : -JUMP;
        s.events.push(p.cushion ? 'spring' : 'jump');
        break;
      }
    }
  }

  // Things.
  for (const th of s.things) {
    if (th.gone) continue;
    const dx = Math.abs(((s.x - th.x + W * 1.5) % W) - W / 2);
    if (th.kind === 'coin' && dx < 10 && Math.abs(s.y - 8 - th.y) < 12) {
      th.gone = true;
      s.coins += 1;
      s.events.push('coin');
    } else if (th.kind === 'nip' && dx < 10 && Math.abs(s.y - th.y) < 12) {
      th.gone = true;
      s.nip = NIP_TIME;
      s.events.push('nip');
    } else if (th.kind === 'vacuum' && dx < 9 && s.y > th.y - 9 && s.y - 14 < th.y) {
      // From above (falling onto it) it's a stomp; from the side or below it's the end.
      if (s.nip > 0 || (s.vy > 0 && prevY <= th.y - 5)) {
        th.gone = true;
        s.stomps += 1;
        s.vy = -JUMP;
        s.events.push('stomp');
      } else {
        s.over = true;
        s.events.push('hit');
        return;
      }
    }
  }

  // Camera follows upwards only.
  s.camY = Math.min(s.camY, s.y - s.h * 0.55);
  s.maxClimb = Math.max(s.maxClimb, -s.y);
  if (s.y > s.camY + s.h + 30) {
    s.over = true;
    s.events.push('fall');
    return;
  }
  generate(s);
  // Forget what fell far below the view.
  const floor = s.camY + s.h + 60;
  s.plats = s.plats.filter((p) => p.y < floor && (p.broken === null || p.broken < 0.6));
  s.things = s.things.filter((th) => th.y < floor && !(th.gone && th.kind !== 'vacuum'));
}

export const stats = (s: State) => ({ score: score(s), coins: s.coins });
