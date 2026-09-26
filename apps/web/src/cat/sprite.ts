import { hexToRgb, mix, palette, type CatLook, type Palette } from './look';

/**
 * The pixel cat. Instead of hand-drawn frames, a pose is a handful of shapes (body and head
 * ellipses, triangle ears, capsule legs, a Bézier tail) rasterized onto a small grid with an
 * automatic outline. Coat patterns are computed per pixel in each part's own coordinates, so
 * stripes and patches move with the body. Everything faces right; the renderer mirrors it.
 */
export const FRAME_W = 40;
/** Headroom above the poses (jumps, ears). Poses are authored in a 30-row space. */
const OY = 4;
export const FRAME_H = 30 + OY;
/** Row just below the paws: where the floor is. */
export const FRAME_FLOOR = 28 + OY;

type P = readonly [number, number];

export type Face =
  'open' | 'up' | 'blink' | 'closed' | 'happy' | 'meow' | 'lick' | 'grumpy' | 'down';

interface Ellipse {
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Radians; rotates the belly/back with the body (sitting, stretching). */
  rot?: number;
  /** Where the light fur is: the underside (standing, lying) or the chest (sitting). */
  chest?: boolean;
  /** Lying on its back: the belly faces up. */
  upsideDown?: boolean;
}

interface Leg {
  a: P;
  b: P;
  far?: boolean;
  /** Drawn over the head (a paw raised to the face). */
  top?: boolean;
}

export interface Pose {
  body: Ellipse;
  haunch?: Ellipse;
  head: { x: number; y: number };
  face: Face;
  ears: 'up' | 'flat';
  legs: Leg[];
  tucked?: P[];
  /** Cubic Bézier from the base (on the body) to the tip. */
  tail: [P, P, P, P];
  tailFront?: boolean;
}

// ── poses ─────────────────────────────────────────────────────────────────

export type Anim =
  | 'walk'
  | 'run'
  | 'sit'
  | 'meow'
  | 'groom'
  | 'eat'
  | 'sleep'
  | 'loaf'
  | 'stretch'
  | 'jump'
  | 'happy'
  | 'grumpy'
  | 'play'
  | 'scratch'
  | 'bat'
  | 'knead'
  | 'belly'
  | 'pounce'
  | 'leapUp'
  | 'leapDown'
  | 'watch'
  | 'sniff';

export const ANIMS: Record<Anim, { frames: number; fps: number; label: string }> = {
  walk: { frames: 8, fps: 10, label: 'Идёт' },
  run: { frames: 6, fps: 14, label: 'Бежит' },
  sit: { frames: 24, fps: 6, label: 'Сидит' },
  meow: { frames: 12, fps: 6, label: 'Мяукает' },
  groom: { frames: 8, fps: 6, label: 'Умывается' },
  eat: { frames: 6, fps: 6, label: 'Ест' },
  sleep: { frames: 16, fps: 4, label: 'Спит' },
  loaf: { frames: 24, fps: 6, label: 'Лежит' },
  stretch: { frames: 12, fps: 6, label: 'Потягивается' },
  jump: { frames: 10, fps: 10, label: 'Прыгает' },
  happy: { frames: 12, fps: 6, label: 'Мурчит' },
  grumpy: { frames: 12, fps: 8, label: 'Недоволен' },
  play: { frames: 8, fps: 8, label: 'Играет' },
  scratch: { frames: 6, fps: 8, label: 'Точит когти' },
  bat: { frames: 8, fps: 10, label: 'Бьёт лапкой' },
  knead: { frames: 8, fps: 5, label: 'Мнёт лапками' },
  belly: { frames: 12, fps: 6, label: 'Валяется' },
  pounce: { frames: 8, fps: 12, label: 'Готовится прыгнуть' },
  leapUp: { frames: 2, fps: 6, label: 'Запрыгивает' },
  leapDown: { frames: 2, fps: 6, label: 'Спрыгивает' },
  watch: { frames: 24, fps: 6, label: 'Наблюдает' },
  sniff: { frames: 8, fps: 6, label: 'Нюхает' },
};

const TAU = Math.PI * 2;
const GROUND = 26.9; // paw centers; the paws' bottom row is 27, the outline 28

function standing(t: number, o: { stride: number; lift: number; run?: boolean }): Pose {
  const f = TAU * t;
  const bob = o.run ? -Math.abs(Math.sin(f)) * 1.2 : Math.sin(2 * f) * 0.35;
  const by = 18.9 + bob;
  const leg = (hipX: number, phase: number, far: boolean): Leg => {
    const s = Math.sin(f + phase);
    const lift = Math.max(0, Math.cos(f + phase)) * o.lift;
    return {
      a: [hipX + (far ? 1.4 : 0), by + 1.5 - (far ? 0.4 : 0)],
      b: [hipX + (far ? 1.4 : 0) + s * o.stride, GROUND - lift],
      far,
    };
  };
  const sway = Math.sin(f) * 0.8;
  return {
    body: { x: 17, y: by, rx: o.run ? 9.2 : 8.4, ry: o.run ? 4.2 : 4.6, rot: o.run ? 0.06 : 0 },
    head: { x: o.run ? 28.6 : 28, y: 13.3 + bob * 0.8 + (o.run ? 1 : 0) },
    face: 'open',
    ears: o.run ? 'flat' : 'up',
    legs: [
      leg(13, Math.PI, true),
      leg(22.5, 0, true),
      leg(12, 0, false),
      leg(21.5, Math.PI, false),
    ],
    tail: o.run
      ? [
          [9.4, by - 1.5],
          [5.5, by - 3],
          [4.4, by - 4 + sway],
          [3.8, by - 6 + sway],
        ]
      : [
          [9.4, by - 2],
          [4.2, by - 2],
          [3.2 + sway, 11],
          [6 + sway, 8.6],
        ],
  };
}

function sitting(t: number, o: { face?: Face; tail?: 'swish' | 'lash' | 'up'; headDy?: number }) {
  const f = TAU * t;
  const pose: Pose = {
    body: { x: 16.8, y: 20.2, rx: 5.8, ry: 7.2, rot: -0.2, chest: true },
    haunch: { x: 13.6, y: 24, rx: 4.8, ry: 3.6 },
    head: { x: 21.6, y: 11.2 + (o.headDy ?? 0) },
    face: o.face ?? 'open',
    ears: 'up',
    legs: [
      { a: [22.2, 19], b: [22.6, GROUND], far: true },
      { a: [20.6, 19.5], b: [20.8, GROUND] },
    ],
    tucked: [[17.2, 26.9]],
    tail: [
      [11, 25.5],
      [5, 27.5],
      [5, 28],
      [11, 28],
    ],
  };
  if (o.tail === 'swish') {
    const s = Math.sin(f);
    pose.tail = [
      [10.5, 25.6],
      [4.5, 27],
      [4.4 + s * 0.8, 24.5 - Math.max(0, s) * 2],
      [6 + s * 1.5, 21.5 - Math.max(0, s) * 2.5],
    ];
  } else if (o.tail === 'lash') {
    const s = Math.sin(f * 2);
    pose.tail = [
      [10.5, 25.6],
      [5, 27.2],
      [3.6, 26 + s * 1.5],
      [3.8, 22.5 + s * 3],
    ];
  } else if (o.tail === 'up') {
    const s = Math.sin(f) * 1.2;
    pose.tail = [
      [10.8, 22],
      [6, 22],
      [5 + s, 13],
      [8 + s, 10.5],
    ];
  }
  return pose;
}

function lying(t: number, o: { asleep: boolean }): Pose {
  const breathe = Math.sin(TAU * t) * 0.35;
  return {
    body: { x: 18.5, y: 23.2 - breathe * 0.5, rx: 9.6, ry: 4.6 + breathe },
    head: o.asleep ? { x: 26.4, y: 22.2 } : { x: 27.4, y: 17.6 },
    face: o.asleep ? 'closed' : 'open',
    ears: 'up',
    legs: [],
    tucked: o.asleep ? [] : [[28.8, 26.6]],
    tail: [
      [10, 25],
      [8, 29],
      [16, 28.6],
      [23, 28],
    ],
    tailFront: true,
  };
}

export function poseAt(anim: Anim, i: number): Pose {
  const n = ANIMS[anim].frames;
  const t = (i % n) / n;
  const f = TAU * t;
  switch (anim) {
    case 'walk':
      return standing(t, { stride: 2.4, lift: 1.3 });
    case 'run':
      return standing(t, { stride: 4.2, lift: 1.8, run: true });
    case 'sit': {
      // Mostly still with a slow tail swish and an occasional blink.
      const p = sitting(t, { tail: 'swish' });
      if (i % n === 10 || i % n === 11) p.face = 'blink';
      return p;
    }
    case 'meow': {
      const open = i % n >= 3 && i % n <= 7;
      return sitting(t, { face: open ? 'meow' : 'open', headDy: open ? -0.7 : 0, tail: 'up' });
    }
    case 'groom': {
      const p = sitting(t, { face: i % 4 < 2 ? 'lick' : 'closed', headDy: 0.6 });
      const up = Math.sin(f * 2) * 0.8;
      p.legs = [
        { a: [22.2, 19], b: [22.6, GROUND], far: true },
        { a: [20.6, 18.5], b: [24.2, 15.4 + up], top: true },
      ];
      return p;
    }
    case 'eat': {
      const p = standing(0, { stride: 0.6, lift: 0 });
      const dip = i % 2 ? 0.8 : 0;
      p.head = { x: 29.4, y: 19.6 + dip };
      p.face = 'down';
      p.body.rot = 0.08;
      return p;
    }
    case 'sleep':
      return lying(t, { asleep: true });
    case 'loaf': {
      const p = lying(t, { asleep: false });
      if (i % n === 14 || i % n === 15) p.face = 'blink';
      return p;
    }
    case 'stretch': {
      const k = Math.sin(Math.PI * t); // 0 → 1 → 0
      const p = standing(0, { stride: 0, lift: 0 });
      p.body = { x: 17, y: 18.9 + k * 1.5, rx: 8.4 + k, ry: 4.6, rot: 0.25 * k };
      p.head = { x: 28 + k * 2, y: 13.3 + k * 6 };
      p.face = k > 0.6 ? 'closed' : 'open';
      p.legs = [
        { a: [14.4, 20], b: [14.4, GROUND], far: true },
        { a: [23.9, 20 + k * 1.5], b: [24 + k * 6, GROUND], far: true },
        { a: [12, 20.4], b: [12, GROUND] },
        { a: [22.5, 20.4 + k * 1.5], b: [22.5 + k * 7, GROUND] },
      ];
      return p;
    }
    case 'jump': {
      const h = Math.sin(Math.PI * t); // up and down
      const p = standing(0.25, { stride: 0, lift: 0 });
      const dy = -h * 5.2;
      p.body = { x: 17, y: 18.9 + dy, rx: 9, ry: 4.2, rot: -0.25 * Math.cos(Math.PI * t) };
      p.head = { x: 28, y: 12.6 + dy };
      p.legs = p.legs.map((l, k) => {
        const back = k % 2 === 0;
        const reach = h * (back ? -3 : 3);
        return {
          ...l,
          a: [l.a[0], l.a[1] + dy],
          b: [l.b[0] + reach, Math.min(GROUND, l.b[1] + dy + h * 1.5)],
        };
      });
      const [t0, t1, t2, t3] = p.tail;
      const up = ([x, y]: P): P => [x, y + dy];
      p.tail = [up(t0), up(t1), up(t2), up(t3)];
      return p;
    }
    case 'happy':
      return sitting(t, { face: 'happy', tail: 'up' });
    case 'grumpy': {
      const p = sitting(t, { face: 'grumpy', tail: 'lash' });
      p.ears = 'flat';
      return p;
    }
    case 'play': {
      const p = lying(0, { asleep: false });
      const reach = (Math.sin(f) + 1) / 2;
      p.body = { x: 17.5, y: 23, rx: 9, ry: 4.4, rot: 0.12 };
      p.head = { x: 27, y: 18.2 };
      p.tucked = [];
      p.legs = [{ a: [24, 23], b: [29 + reach * 5, 26.9 - reach * 3], top: true }];
      p.tail = [
        [9.8, 21.5],
        [5, 20],
        [3 + reach * 2, 16],
        [5, 13 + reach],
      ];
      p.tailFront = false;
      return p;
    }
    case 'scratch': {
      // Up on the hind legs, front paws on a post to the right, pulling down in turns.
      const k = Math.sin(f);
      return {
        body: { x: 19.2, y: 17.6, rx: 4.8, ry: 7.6, rot: -0.3, chest: true },
        haunch: { x: 16.4, y: 24.2, rx: 4.4, ry: 3.4 },
        head: { x: 23.4, y: 9.4 },
        face: i % n < 2 ? 'closed' : 'open',
        ears: 'up',
        legs: [
          { a: [22.4, 13.5], b: [28.4, 13.5 - k * 1.8], far: true },
          { a: [21.6, 14], b: [28, 15.5 + k * 1.8] },
        ],
        tucked: [[18, 26.9]],
        tail: [
          [12.6, 25.4],
          [7, 27.4],
          [4.6, 26.5 + k * 0.6],
          [4, 24 + k],
        ],
      };
    }
    case 'bat': {
      const k = Math.sin(f);
      const p = sitting(t, { face: 'open', tail: 'swish' });
      p.legs = [
        { a: [22.2, 19], b: [22.6, GROUND], far: true },
        { a: [20.6, 17.5], b: [26.4 + k * 1.6, 14.5 - Math.max(0, k) * 2.5], top: true },
      ];
      return p;
    }
    case 'knead': {
      const p = lying(0, { asleep: false });
      const up = i % 2;
      p.face = 'happy';
      p.tucked = [
        [27.4, 26.6 - up * 0.9],
        [30.4, 26.6 - (1 - up) * 0.9],
      ];
      return p;
    }
    case 'belly': {
      const k = Math.sin(f) * 0.8;
      return {
        body: { x: 18, y: 24.2, rx: 9, ry: 4.2, upsideDown: true },
        head: { x: 27.6, y: 22.6 },
        face: 'happy',
        ears: 'up',
        legs: [
          { a: [15, 22], b: [15.5 - k, 17.2], far: true },
          { a: [23.5, 22], b: [24.5 + k, 17], far: true },
          { a: [13, 22.4], b: [12 + k, 17.6] },
          { a: [21.5, 22.4], b: [20.8 - k, 17.2] },
        ],
        tail: [
          [9.6, 25],
          [5.6, 27.4],
          [4, 26 + k],
          [4.4, 23 + k],
        ],
      };
    }
    case 'pounce': {
      // Crouched low, rear end wiggling, tail tip twitching.
      const w = Math.sin(f * 2) * 0.5;
      return {
        body: { x: 17 + w, y: 22.4, rx: 8.6, ry: 3.8, rot: 0.1 },
        head: { x: 28, y: 18.4 },
        face: 'open',
        ears: 'up',
        legs: [
          { a: [13.6 + w, 23.5], b: [13 + w, GROUND], far: true },
          { a: [23.6, 24], b: [25, GROUND], far: true },
          { a: [12 + w, 24], b: [11.4 + w, GROUND] },
          { a: [22.4, 24.5], b: [24, GROUND] },
        ],
        tail: [
          [9.4, 21.8],
          [5.6, 21.6],
          [4, 22.6 + w * 2],
          [3.4, 20.6 + w * 3],
        ],
      };
    }
    case 'leapUp':
    case 'leapDown': {
      const up = anim === 'leapUp';
      const k = i % 2 ? 0.6 : 0;
      return {
        body: { x: 17.5, y: 19, rx: 9, ry: 4, rot: up ? -0.32 : 0.3 },
        head: up ? { x: 27.4, y: 10.6 } : { x: 28.4, y: 17.2 },
        face: 'open',
        ears: up ? 'up' : 'flat',
        legs: up
          ? [
              { a: [13.4, 21], b: [8.6 - k, 25.6], far: true },
              { a: [22.6, 17], b: [27.6, 13 - k], far: true },
              { a: [12, 21.6], b: [7.2 - k, 26] },
              { a: [21.4, 17.6], b: [26.6, 14.4 - k] },
            ]
          : [
              { a: [13.4, 17.4], b: [9.4, 15 - k], far: true },
              { a: [23.4, 22], b: [27.4, 26.4 + k], far: true },
              { a: [12, 18], b: [8, 16 - k] },
              { a: [22.2, 22.6], b: [25.6, 26.8 + k] },
            ],
        tail: up
          ? [
              [9.2, 20.5],
              [6, 22],
              [4.4, 23.4],
              [3, 23.4],
            ]
          : [
              [9.4, 17],
              [6, 15],
              [4.6, 12],
              [4.2, 9.5],
            ],
      };
    }
    case 'watch': {
      const p = sitting(t, { face: 'up', tail: 'swish', headDy: -0.4 });
      if (i % n === 16 || i % n === 17) p.face = 'blink';
      return p;
    }
    case 'sniff': {
      const p = standing(0, { stride: 0.4, lift: 0 });
      p.head = { x: 29.8, y: 15.8 + (i % 4 < 2 ? 0 : 0.6) };
      p.face = i % 4 < 2 ? 'down' : 'blink';
      return p;
    }
  }
}

// ── rasterizer ─────────────────────────────────────────────────────────────

const enum Part {
  None = 0,
  Body,
  Haunch,
  Leg,
  Paw,
  Tail,
  Head,
  Ear,
  EarIn,
}

interface Cell {
  part: Part;
  layer: number;
  far: boolean;
  /** Part-local coordinates for patterns (u along the part, v across). */
  u: number;
  v: number;
}

function hash(x: number, y: number): number {
  let h = (x * 374761393 + y * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function inEllipse(e: Ellipse, x: number, y: number, pad = 0) {
  const c = Math.cos(e.rot ?? 0);
  const s = Math.sin(e.rot ?? 0);
  const dx = x - e.x;
  const dy = y - e.y;
  const u = (dx * c + dy * s) / (e.rx + pad);
  const v = (-dx * s + dy * c) / (e.ry + pad);
  return { inside: u * u + v * v <= 1, u, v };
}

function inTriangle(p: P, a: P, b: P, c: P) {
  const d = (q: P, r: P, s: P) => (q[0] - s[0]) * (r[1] - s[1]) - (r[0] - s[0]) * (q[1] - s[1]);
  const d1 = d(p, a, b);
  const d2 = d(p, b, c);
  const d3 = d(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

function segDist(p: P, a: P, b: P) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2));
  const x = a[0] + t * dx - p[0];
  const y = a[1] + t * dy - p[1];
  return { d: Math.sqrt(x * x + y * y), t, len: Math.sqrt(len2) };
}

function bezier(c: Pose['tail'], t: number): P {
  const m = 1 - t;
  const k = [m * m * m, 3 * m * m * t, 3 * m * t * t, t * t * t];
  return [
    k[0]! * c[0][0] + k[1]! * c[1][0] + k[2]! * c[2][0] + k[3]! * c[3][0],
    k[0]! * c[0][1] + k[1]! * c[1][1] + k[2]! * c[2][1] + k[3]! * c[3][1],
  ];
}

function ears(pose: Pose): { outer: [P, P, P]; inner: [P, P, P] }[] {
  const { x, y } = pose.head;
  const flat = pose.ears === 'flat';
  const make = (side: -1 | 1) => {
    const cx = x + 0.8;
    const baseOut: P = [cx + side * 6.3, y - 1.4];
    const baseIn: P = [cx + side * 1.6, y - 4.5];
    const tip: P = flat ? [cx + side * 9.4, y - 4.6] : [cx + side * 5.6, y - 9.2];
    const cen: P = [(baseOut[0] + baseIn[0] + tip[0]) / 3, (baseOut[1] + baseIn[1] + tip[1]) / 3];
    const shrink = (p: P, k: number): P => [
      cen[0] + (p[0] - cen[0]) * k,
      cen[1] + (p[1] - cen[1]) * k,
    ];
    return {
      outer: [baseOut, baseIn, tip] as [P, P, P],
      inner: [shrink(baseOut, 0.45), shrink(baseIn, 0.45), shrink(tip, 0.55)] as [P, P, P],
    };
  };
  return [make(-1), make(1)];
}

function headShape(pose: Pose, fluffy: boolean) {
  const rx = 6.4 + (fluffy ? 0.5 : 0);
  const ry = 5.4 + (fluffy ? 0.3 : 0);
  return (x: number, y: number) => {
    const u = (x - pose.head.x - 0.4) / rx;
    const v = (y - pose.head.y) / ry;
    // A little boxier than an ellipse: kitten cheeks.
    return Math.pow(Math.abs(u), 2.5) + Math.pow(Math.abs(v), 2.1) <= 1;
  };
}

/** Rasterizes a pose into a label grid (no colors yet). */
function rasterize(pose: Pose, look: CatLook): Cell[] {
  const cells: Cell[] = Array.from({ length: FRAME_W * FRAME_H }, () => ({
    part: Part.None,
    layer: 0,
    far: false,
    u: 0,
    v: 0,
  }));
  let layer = 0;
  const put = (x: number, y: number, part: Part, far: boolean, u: number, v: number) => {
    const c = cells[y * FRAME_W + x]!;
    c.part = part;
    c.layer = layer;
    c.far = far;
    c.u = u;
    c.v = v;
  };
  /** Visits pixel centers (in pose coordinates), optionally only within a pose-space box. */
  const each = (
    fn: (x: number, y: number, p: P) => void,
    box?: [number, number, number, number],
  ) => {
    const [x0, y0, x1, y1] = box
      ? [
          Math.max(0, Math.floor(box[0])),
          Math.max(0, Math.floor(box[1] + OY)),
          Math.min(FRAME_W - 1, Math.ceil(box[2])),
          Math.min(FRAME_H - 1, Math.ceil(box[3] + OY)),
        ]
      : [0, 0, FRAME_W - 1, FRAME_H - 1];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) fn(x, y, [x + 0.5, y + 0.5 - OY]);
  };
  const legR = 1.3;
  const drawLeg = (l: Leg) => {
    layer++;
    each((x, y, p) => {
      const { d, t, len } = segDist(p, l.a, l.b);
      if (d > legR) return;
      const along = t * len;
      put(x, y, along > len - 1.4 ? Part.Paw : Part.Leg, !!l.far, along, t);
    });
  };
  const tailR = look.fluffy ? 1.9 : 1.45;
  const drawTail = () => {
    layer++;
    const pts: P[] = [];
    for (let i = 0; i <= 40; i++) pts.push(bezier(pose.tail, i / 40));
    const xs = pts.map((q) => q[0]);
    const ys = pts.map((q) => q[1]);
    const bb: [number, number, number, number] = [
      Math.min(...xs) - tailR - 1,
      Math.min(...ys) - tailR - 1,
      Math.max(...xs) + tailR + 1,
      Math.max(...ys) + tailR + 1,
    ];
    each((x, y, p) => {
      let best = { d: Infinity, t: 0 };
      for (let i = 0; i < pts.length - 1; i++) {
        const s = segDist(p, pts[i]!, pts[i + 1]!);
        if (s.d < best.d) best = { d: s.d, t: (i + s.t) / 40 };
      }
      const r = tailR * (1 - best.t * 0.25);
      if (best.d <= r) put(x, y, Part.Tail, false, best.t, 0);
    }, bb);
  };
  const drawEllipse = (e: Ellipse, part: Part, pad = 0) => {
    layer++;
    each((x, y, p) => {
      const r = inEllipse(e, p[0], p[1], pad);
      if (r.inside) put(x, y, part, false, r.u, r.v);
    });
  };

  for (const l of pose.legs) if (l.far && !l.top) drawLeg(l);
  if (!pose.tailFront) drawTail();
  drawEllipse(pose.body, Part.Body, look.fluffy ? 0.3 : 0);
  if (pose.haunch) drawEllipse(pose.haunch, Part.Haunch);
  for (const l of pose.legs) if (!l.far && !l.top) drawLeg(l);
  for (const t of pose.tucked ?? []) {
    layer++;
    each((x, y, p) => {
      const dx = (p[0] - t[0]) / 2.2;
      const dy = (p[1] - t[1]) / 1.3;
      if (dx * dx + dy * dy <= 1) put(x, y, Part.Paw, false, 0, 0);
    });
  }
  // Head and ears share a layer so there's no seam between them.
  layer++;
  const inHead = headShape(pose, look.fluffy);
  const earTris = ears(pose);
  each((x, y, p) => {
    for (const e of earTris) {
      if (inTriangle(p, ...e.inner)) return put(x, y, Part.EarIn, false, 0, 0);
      if (inTriangle(p, ...e.outer)) return put(x, y, Part.Ear, false, 0, 0);
    }
    if (inHead(p[0], p[1])) put(x, y, Part.Head, false, p[0] - pose.head.x, p[1] - pose.head.y);
  });
  if (pose.tailFront) drawTail();
  for (const l of pose.legs) if (l.top) drawLeg(l);
  return cells;
}

/** Parts that get an inner contour where they overlap something drawn earlier. */
const CONTOURED = new Set([Part.Head, Part.Ear, Part.Haunch, Part.Tail, Part.Paw, Part.Leg]);

type RGB = [number, number, number];

/** Renders one frame to RGBA (FRAME_W × FRAME_H), facing right. */
export function renderFrame(
  pose: Pose,
  look: CatLook,
  pal: Palette = palette(look),
): Uint8ClampedArray<ArrayBuffer> {
  const cells = rasterize(pose, look);
  const out = new Uint8ClampedArray(new ArrayBuffer(FRAME_W * FRAME_H * 4));
  const rgb = (hex: string) => hexToRgb(hex);
  const C = {
    base: rgb(pal.base),
    stripe: rgb(pal.stripe),
    light: rgb(pal.light),
    outline: rgb(pal.outline),
    inner: rgb(mix(pal.outline, pal.base, 0.35)),
    nose: rgb(pal.nose),
    earIn: rgb(pal.earIn),
    alt: rgb(pal.alt),
    alt2: rgb(pal.alt2),
    white: rgb('#ffffff'),
    pupil: rgb('#17122a'),
    eye: rgb(pal.eye),
    eye2: rgb(pal.eye2),
    tongue: rgb('#e76f86'),
    acc: rgb(look.accessoryColor),
    gold: rgb('#f2c14e'),
    goldDark: rgb('#c8902a'),
    goldLight: rgb('#fff1b8'),
    gem: rgb('#e2563a'),
    ribbon: rgb('#4a4fc4'),
    cap: rgb('#e2563a'),
    capLight: rgb('#f08a70'),
    blade: rgb('#f5b62e'),
    blade2: rgb('#4a9fe0'),
    hat: rgb('#8a9a5b'),
    hatDark: rgb('#6b7a42'),
    hatBand: rgb('#e2563a'),
  };
  const shade = (c: RGB, k: number): RGB =>
    c.map((v, i) => Math.round(v + (C.outline[i]! - v) * k)) as RGB;
  const set = (x: number, y: number, c: RGB) => {
    if (x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H) return;
    const i = (y * FRAME_W + x) * 4;
    out[i] = c[0];
    out[i + 1] = c[1];
    out[i + 2] = c[2];
    out[i + 3] = 255;
  };
  const at = (x: number, y: number) =>
    x < 0 || y < 0 || x >= FRAME_W || y >= FRAME_H ? undefined : cells[y * FRAME_W + x];

  const hx = Math.round(pose.head.x + 0.8);
  const hy = Math.round(pose.head.y) + OY;
  const pattern = look.pattern;
  const tabby = pattern === 'tabby';

  const fur = (x: number, y: number, c: Cell): RGB => {
    const fx = x - hx;
    const fy = y - hy;
    const patch = () => {
      const n = hash(Math.floor((x + 40) / 3.2), Math.floor((y + 40) / 2.6));
      return n < 0.34 ? C.alt : n < 0.58 ? C.alt2 : null;
    };
    switch (c.part) {
      case Part.Body:
      case Part.Haunch: {
        const chest = pose.body.chest;
        const belly =
          c.part === Part.Body &&
          (pose.body.upsideDown
            ? c.v < -0.3
            : chest
              ? c.u > 0.3 && c.v > -0.75
              : c.v > 0.42 || (c.u > 0.55 && c.v > -0.35));
        const bicolorBelly =
          pattern === 'bicolor' &&
          c.part === Part.Body &&
          (pose.body.upsideDown ? c.v < -0.1 : chest ? c.u > 0.05 : c.v > 0.1 || c.u > 0.45);
        if (bicolorBelly || (belly && pattern !== 'point')) return C.light;
        if (pattern === 'calico') return patch() ?? C.base;
        if (pattern === 'point') return c.v < -0.7 ? shade(C.base, 0.08) : C.base;
        if (tabby) {
          const v = pose.body.upsideDown ? -c.v : c.v;
          if (v < -0.82) return C.stripe; // dorsal line
          const k = c.u * 4.6 - v * 1.4;
          if (((k % 3.3) + 3.3) % 3.3 < 1.05 && v < 0.35) return C.stripe;
        }
        return C.base;
      }
      case Part.Leg:
        if (pattern === 'point') return C.alt;
        if (pattern === 'calico') return C.light;
        if (tabby && Math.floor(c.u / 1.6) % 2 === 1 && c.u > 1) return C.stripe;
        return C.base;
      case Part.Paw:
        if (look.socks || pattern === 'bicolor' || pattern === 'calico') return C.light;
        if (pattern === 'point') return C.alt;
        return tabby ? C.light : C.base;
      case Part.Tail:
        if (pattern === 'point') return C.alt;
        if (pattern === 'calico') return c.u > 0.5 ? C.alt2 : C.alt;
        if (tabby && (c.u > 0.86 || Math.floor(c.u * 9) % 2 === 1)) return C.stripe;
        return C.base;
      case Part.Ear:
        if (pattern === 'point') return C.alt;
        if (pattern === 'calico') return fx < 0 ? C.alt : C.alt2;
        return C.base;
      case Part.EarIn:
        return C.earIn;
      case Part.Head: {
        const mx = (fx + 0.2) / 3.3;
        const my = (fy - 1.9) / 2.1;
        const muzzle = mx * mx + my * my <= 1 || (fy >= 3 && Math.abs(fx) <= 2);
        if (pattern === 'point') {
          const d = Math.hypot(fx, (fy - 1) * 1.2);
          return d < 3.8 ? C.alt : d < 4.8 ? shade(C.alt, -0.4) : C.base;
        }
        if (muzzle && pattern !== 'solid') return C.light;
        if (pattern === 'bicolor' && fy >= -1 && Math.abs(fx) <= 1) return C.light; // blaze
        if (pattern === 'calico') return fx < 0 ? C.alt : fy < -1 ? C.alt2 : C.base;
        if (tabby) {
          // Forehead stripes (the "M") and cheek lines.
          if ((fy === -4 || fy === -3) && (fx === -2 || fx === 0 || fx === 2)) return C.stripe;
          if (fy === -2 && (fx === -1 || fx === 1)) return C.stripe;
          if ((fx === -5 || fx === 5) && fy === 1) return C.stripe;
          if ((fx === -6 || fx === 6) && fy === 2) return C.stripe;
        }
        return C.base;
      }
      default:
        return C.base;
    }
  };

  // Fur with far-side shading and inner contours.
  for (let y = 0; y < FRAME_H; y++) {
    for (let x = 0; x < FRAME_W; x++) {
      const c = cells[y * FRAME_W + x]!;
      if (c.part === Part.None) continue;
      let col = fur(x, y, c);
      if (c.far) col = shade(col, 0.28);
      if (CONTOURED.has(c.part)) {
        const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
        if (
          n.some(
            (m) =>
              m &&
              m.part !== Part.None &&
              m.layer < c.layer &&
              !(c.part === Part.Ear && m.part === Part.Head),
          )
        )
          col = C.inner;
      }
      set(x, y, col);
    }
  }
  // Fluffy: a few tufts along the top edges.
  if (look.fluffy) {
    for (let y = 1; y < FRAME_H; y++)
      for (let x = 0; x < FRAME_W; x++) {
        const c = cells[y * FRAME_W + x]!;
        const up = at(x, y - 1);
        if (
          c.part !== Part.None &&
          c.part !== Part.EarIn &&
          up?.part === Part.None &&
          hash(x, y) < 0.3
        ) {
          up.part = c.part;
          up.layer = c.layer;
          set(x, y - 1, fur(x, y - 1, { ...c }));
        }
      }
  }
  // Outer outline.
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      if (cells[y * FRAME_W + x]!.part !== Part.None) continue;
      const n = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
      if (n.some((m) => m && m.part !== Part.None)) set(x, y, C.outline);
    }

  // Face.
  const eyeL = C.eye2;
  const eyeR = C.eye;
  const eyes = (face: Face) => {
    for (const [side, iris] of [
      [-1, eyeL],
      [1, eyeR],
    ] as const) {
      const ex = side < 0 ? hx - 4 : hx + 2; // 3 px wide: ex..ex+2
      const o = C.outline;
      switch (face) {
        case 'open':
          set(ex, hy - 1, iris);
          set(ex + 1, hy - 1, C.pupil);
          set(ex + 2, hy - 1, C.white);
          set(ex, hy, iris);
          set(ex + 1, hy, C.pupil);
          set(ex + 2, hy, iris);
          break;
        case 'up':
          set(ex, hy - 1, iris);
          set(ex + 1, hy - 1, C.pupil);
          set(ex + 2, hy - 1, C.white);
          set(ex, hy, iris);
          set(ex + 1, hy, iris);
          set(ex + 2, hy, iris);
          break;
        case 'down':
          set(ex, hy, iris);
          set(ex + 1, hy, C.pupil);
          set(ex + 2, hy, iris);
          for (let k = 0; k < 3; k++) set(ex + k, hy - 1, o);
          break;
        case 'grumpy':
          for (let k = 0; k < 3; k++) set(ex + k, hy - 1, o);
          set(ex, hy, iris);
          set(ex + 1, hy, C.pupil);
          set(ex + 2, hy, iris);
          // Brows slanted towards the nose.
          set(side < 0 ? ex + 2 : ex, hy - 2, o);
          break;
        case 'happy':
        case 'meow':
          set(ex, hy, o);
          set(ex + 1, hy - 1, o);
          set(ex + 2, hy, o);
          break;
        case 'blink':
        case 'closed':
        case 'lick':
          for (let k = 0; k < 3; k++) set(ex + k, hy, o);
          break;
      }
    }
  };
  eyes(pose.face);
  set(hx, hy + 1, C.nose);
  if (pose.face === 'meow') {
    set(hx - 1, hy + 2, C.pupil);
    set(hx, hy + 2, C.pupil);
    set(hx + 1, hy + 2, C.pupil);
    set(hx, hy + 3, C.tongue);
  } else if (pose.face === 'lick') {
    set(hx - 1, hy + 2, C.outline);
    set(hx + 1, hy + 2, C.outline);
    set(hx, hy + 2, C.tongue);
    set(hx, hy + 3, C.tongue);
  } else {
    set(hx - 1, hy + 2, C.outline);
    set(hx + 1, hy + 2, C.outline);
  }
  // Blush when purring.
  if (pose.face === 'happy') {
    set(hx - 5, hy + 1, C.earIn);
    set(hx + 5, hy + 1, C.earIn);
  }

  // Accessories: a collar just under the head, a bell on it, or a bow by the right ear.
  if (look.accessory === 'collar' || look.accessory === 'bell') {
    const inHead = headShape(pose, look.fluffy);
    let bell: [number, number] | null = null;
    for (let y = hy + 2; y < FRAME_H; y++)
      for (let x = hx - 6; x <= hx + 6; x++) {
        const c = at(x, y);
        if (!c || c.part === Part.None || inHead(x + 0.5, y + 0.5 - OY)) continue;
        if (inHead(x + 0.5, y - 0.5 - OY)) {
          set(x, y, C.acc);
          if (x === hx - 1 && !bell) bell = [x, y + 1];
        }
      }
    if (look.accessory === 'bell' && bell) set(bell[0], bell[1], C.gold);
  } else if (look.accessory === 'bow') {
    const bx = hx + 4;
    const by = hy - 5;
    for (const [dx, dy] of [
      [0, 0],
      [0, 1],
      [2, 0],
      [2, 1],
    ] as const)
      set(bx + dx, by + dy, C.acc);
    set(bx + 1, by, shade(C.acc, 0.3));
  } else if (look.accessory === 'medal') {
    // A ribbon where the collar goes, with a cheese medal hanging where the bell would.
    const inHead = headShape(pose, look.fluffy);
    let hang: [number, number] | null = null;
    for (let y = hy + 2; y < FRAME_H; y++)
      for (let x = hx - 6; x <= hx + 6; x++) {
        const c = at(x, y);
        if (!c || c.part === Part.None || inHead(x + 0.5, y + 0.5 - OY)) continue;
        if (inHead(x + 0.5, y - 0.5 - OY)) {
          set(x, y, C.ribbon);
          if (x === hx - 1 && !hang) hang = [x, y + 1];
        }
      }
    if (hang) {
      const [mx, my] = hang;
      for (const [dx, dy] of [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ] as const)
        set(mx + dx, my + dy, C.gold);
      set(mx, my, C.goldLight);
      set(mx, my + 2, C.goldDark);
      set(mx + 1, my + 2, C.goldDark);
    }
  } else if (look.accessory !== 'none') {
    // Hats sit on the top of the head, between the ears.
    let top = hy;
    for (let y = 0; y < hy; y++)
      if ([-1, 0, 1].some((dx) => at(hx + dx, y)?.part === Part.Head)) {
        top = y;
        break;
      }
    const row = (y: number, x0: number, x1: number, c: RGB) => {
      for (let x = x0; x <= x1; x++) set(hx + x, y, c);
    };
    if (look.accessory === 'crown') {
      row(top - 1, -3, 3, C.goldDark);
      row(top - 2, -3, 3, C.gold);
      for (const dx of [-3, 0, 3]) set(hx + dx, top - 3, C.gold);
      set(hx, top - 2, C.gem);
    } else if (look.accessory === 'propeller') {
      row(top - 1, -3, 4, C.cap);
      row(top - 1, 4, 6, shade(C.cap, 0.35)); // visor
      row(top - 2, -2, 2, C.cap);
      set(hx - 1, top - 2, C.capLight);
      set(hx, top - 3, C.outline);
      row(top - 4, -3, -1, C.blade);
      row(top - 4, 1, 3, C.blade2);
      set(hx, top - 4, C.outline);
    } else if (look.accessory === 'fisher') {
      row(top - 1, -5, 5, C.hatDark);
      row(top - 2, -3, 3, C.hat);
      row(top - 3, -2, 2, C.hat);
      set(hx + 2, top - 2, C.hatBand);
      set(hx + 3, top - 2, C.hatBand);
    }
  }
  return out;
}
