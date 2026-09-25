import { ROOM_CATALOG, STARTER_ITEMS as CORE_STARTER, type RoomItemKey } from '@cathub/core';
import type { Anim } from './sprite';

/**
 * The cat's room: a wall, a floor and the items bought with fish (docs/PLAN.md §6.7). Items are
 * drawn from rectangles in room pixels; each one offers "spots" where the cat does something.
 */
export const ROOM_H = 76;
export const FLOOR_Y = 70;

export type ItemKey = RoomItemKey;

/** Names and what the cat does with each item; prices are core's ROOM_CATALOG. */
export const ITEMS: Record<ItemKey, { label: string; price: number; does: string }> = {
  window: {
    label: 'Окно с подоконником',
    price: ROOM_CATALOG.window,
    does: 'сидит на подоконнике, смотрит на птиц',
  },
  box: { label: 'Коробка', price: ROOM_CATALOG.box, does: 'залезает и выглядывает' },
  ball: { label: 'Клубок ниток', price: ROOM_CATALOG.ball, does: 'охотится и гоняет' },
  rug: { label: 'Коврик', price: ROOM_CATALOG.rug, does: 'мнёт лапками, валяется' },
  plant: { label: 'Цветок на подоконник', price: ROOM_CATALOG.plant, does: 'нюхает' },
  picture: { label: 'Картина с рыбкой', price: ROOM_CATALOG.picture, does: 'украшает стену' },
  mouse: { label: 'Мышка на пружинке', price: ROOM_CATALOG.mouse, does: 'бьёт лапкой' },
  scratcher: { label: 'Когтеточка', price: ROOM_CATALOG.scratcher, does: 'точит когти' },
  garland: { label: 'Гирлянда', price: ROOM_CATALOG.garland, does: 'светится вечером' },
  bed: { label: 'Лежанка', price: ROOM_CATALOG.bed, does: 'спит в ней' },
  tree: {
    label: 'Домик-когтеточка',
    price: ROOM_CATALOG.tree,
    does: 'прячется в домик, спит наверху',
  },
  aquarium: { label: 'Аквариум', price: ROOM_CATALOG.aquarium, does: 'смотрит на рыбок' },
};

/** What every room starts with; the rest is bought with fish. */
export const STARTER_ITEMS = CORE_STARTER as readonly ItemKey[];

/** Shop order: cheapest first. */
export const SHOP_ORDER = (Object.keys(ITEMS) as ItemKey[]).sort(
  (a, b) => ITEMS[a].price - ITEMS[b].price,
);

export type SpotKind =
  'perch' | 'bed' | 'hide' | 'box' | 'watch' | 'scratch' | 'bat' | 'rug' | 'ball' | 'sniff';

export interface Spot {
  kind: SpotKind;
  item: ItemKey;
  /** Left edge of the cat frame. */
  x: number;
  /** Height above the floor the cat stands on. */
  y: number;
  dir: 1 | -1;
  /** Get there with a leap (up onto a perch, into a box). */
  leap?: boolean;
  /** The item's front layer covers the cat here. */
  inside?: boolean;
  acts: Anim[];
}

export interface Placed {
  key: ItemKey;
  x: number;
}

export interface Layout {
  width: number;
  items: Placed[];
  spots: Spot[];
  bowlX: number;
  /** Where a cat without a bed sleeps. */
  napX: number;
}

const W: Record<ItemKey, number> = {
  window: 34,
  tree: 26,
  bed: 26,
  box: 22,
  aquarium: 28,
  scratcher: 10,
  mouse: 8,
  ball: 5,
  rug: 60,
  plant: 9,
  picture: 16,
  garland: 0,
};

/** Fixed places as a share of the room width (items are set against the back wall). */
const PLACE: Record<ItemKey, number> = {
  tree: 0.01,
  window: 0.3,
  bed: 0.28,
  mouse: 0.44,
  box: 0.5,
  aquarium: 0.64,
  picture: 0.66,
  scratcher: 0.81,
  rug: 0.18,
  ball: 0.4,
  plant: 0.3,
  garland: 0,
};

const clampX = (x: number, width: number) => Math.max(0, Math.min(width - 40, Math.round(x)));

export function layout(width: number, keys: readonly ItemKey[]): Layout {
  const owned = new Set(keys);
  const has = (k: ItemKey) => owned.has(k);
  const items: Placed[] = keys.map((key) => ({ key, x: Math.round(PLACE[key] * width) }));
  const at = (k: ItemKey) => items.find((i) => i.key === k)!.x;
  const spots: Spot[] = [];
  const bowlX = clampX(width - 14 - 36, width);
  if (has('window')) {
    const x = at('window');
    const perch: Anim[] = ['watch', 'loaf', 'sleep', 'groom'];
    spots.push({
      kind: 'perch',
      item: 'window',
      x: clampX(x, width),
      y: 26,
      dir: 1,
      leap: true,
      acts: perch,
    });
    if (has('plant'))
      spots.push({
        kind: 'sniff',
        item: 'plant',
        x: clampX(x + 34 - 31, width),
        y: 26,
        dir: 1,
        leap: true,
        acts: ['sniff'],
      });
  }
  if (has('tree')) {
    const x = at('tree');
    spots.push(
      {
        kind: 'perch',
        item: 'tree',
        x: clampX(x - 4, width),
        y: 36,
        dir: 1,
        leap: true,
        acts: ['loaf', 'sleep', 'watch', 'groom'],
      },
      { kind: 'hide', item: 'tree', x: clampX(x - 10, width), y: 0, dir: -1, acts: ['sit'] },
      {
        kind: 'scratch',
        item: 'tree',
        x: clampX(x + 22 - 12, width),
        y: 0,
        dir: -1,
        acts: ['scratch'],
      },
    );
  }
  if (has('bed'))
    spots.push({
      kind: 'bed',
      item: 'bed',
      x: clampX(at('bed') + 13 - 18.5, width),
      y: 1,
      dir: 1,
      inside: true,
      acts: ['sleep', 'loaf', 'knead'],
    });
  if (has('box'))
    spots.push({
      kind: 'box',
      item: 'box',
      x: clampX(at('box') + 11 - 17, width),
      y: 1,
      dir: -1,
      leap: true,
      inside: true,
      acts: ['sit', 'loaf', 'meow'],
    });
  if (has('aquarium'))
    spots.push({
      kind: 'watch',
      item: 'aquarium',
      x: clampX(at('aquarium') - 24, width),
      y: 0,
      dir: 1,
      acts: ['watch', 'bat'],
    });
  if (has('scratcher'))
    spots.push({
      kind: 'scratch',
      item: 'scratcher',
      x: clampX(at('scratcher') + 3 - 28, width),
      y: 0,
      dir: 1,
      acts: ['scratch'],
    });
  if (has('mouse'))
    spots.push({
      kind: 'bat',
      item: 'mouse',
      x: clampX(at('mouse') + 2 - 27, width),
      y: 0,
      dir: 1,
      acts: ['bat', 'pounce'],
    });
  if (has('rug')) {
    const r = at('rug');
    spots.push({
      kind: 'rug',
      item: 'rug',
      x: clampX(r + W.rug / 2 - 18.5, width),
      y: 0,
      dir: 1,
      acts: ['knead', 'belly', 'loaf', 'groom'],
    });
  }
  if (has('ball'))
    spots.push({ kind: 'ball', item: 'ball', x: 0, y: 0, dir: 1, acts: ['pounce', 'play'] });
  return { width, items, spots, bowlX, napX: clampX(has('rug') ? at('rug') + 6 : 4, width) };
}

// ── drawing ────────────────────────────────────────────────────────────────

const C = {
  ink: '#23264f',
  wallDay: '#f3eee6',
  wallNight: '#3a3d68',
  floorDay: '#dcc7a6',
  floorNight: '#6a5d63',
  board: 'rgba(35,38,79,0.12)',
  wood: '#c99a6a',
  woodDark: '#9a6c44',
  sisal: '#e3cf9e',
  sisalDark: '#c2a86f',
  plush: '#8f93d6',
  plushDark: '#6a6ec2',
  cushion: '#f3e6f0',
  rose: '#e7849b',
  roseDark: '#c75f7a',
  cardboard: '#d9a066',
  cardboardDark: '#b07a42',
  glass: '#bfe3ff',
  glassDark: '#9ccff5',
  water: '#7cc4ec',
  sand: '#e6cf98',
  weed: '#4f9e62',
  fish: '#f08c3a',
  fish2: '#f5b62e',
  sky: '#bfe3ff',
  night: '#2b2d5c',
  cloud: '#ffffff',
  moon: '#f8e7a6',
  pot: '#c96d4a',
  potDark: '#a45236',
  leaf: '#5aa66a',
  leafDark: '#3f7f4d',
  red: '#e2563a',
  redLight: '#f2a58f',
  mouse: '#a3a3b4',
  pink: '#f2a5b5',
  bulbs: ['#f5b62e', '#e2563a', '#35a374', '#6aa6e6', '#e85d9c'],
};

type Ctx = CanvasRenderingContext2D;

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), w, h);
}

/** A filled rectangle with a 1px outline. */
function box(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string, line = C.ink) {
  rect(ctx, x, y, w, h, line);
  rect(ctx, x + 1, y + 1, w - 2, h - 2, fill);
}

export interface World {
  night: boolean;
  /** Seconds since start, for idle animations (fish, bulbs, birds). */
  time: number;
  ballX: number;
  /** How hard the spring mouse is wobbling, 0…1. */
  wobble: number;
  catInside: SpotKind | null;
  hiddenBlink: boolean;
}

export function drawBackground(ctx: Ctx, l: Layout, w: World) {
  const F = FLOOR_Y;
  rect(ctx, 0, 0, l.width, F, w.night ? C.wallNight : C.wallDay);
  // Skirting board and floor boards.
  rect(ctx, 0, F - 2, l.width, 2, w.night ? '#2c2f55' : '#e2d8ca');
  rect(ctx, 0, F, l.width, ROOM_H - F, w.night ? C.floorNight : C.floorDay);
  for (let x = 7; x < l.width; x += 23) rect(ctx, x, F + 1, 1, ROOM_H - F, C.board);
  rect(ctx, 0, F, l.width, 1, C.board);
}

/** Items behind the cat. */
export function drawItems(ctx: Ctx, l: Layout, w: World) {
  const F = FLOOR_Y;
  const order: ItemKey[] = [
    'rug',
    'garland',
    'picture',
    'window',
    'plant',
    'tree',
    'aquarium',
    'scratcher',
    'bed',
    'box',
    'mouse',
    'ball',
  ];
  for (const key of order) {
    const it = l.items.find((i) => i.key === key);
    if (!it) continue;
    const x = it.x;
    switch (key) {
      case 'rug': {
        const y = F + 1;
        rect(ctx, x + 3, y, W.rug - 6, 4, C.rose);
        rect(ctx, x, y + 1, W.rug, 2, C.rose);
        for (let k = 6; k < W.rug - 6; k += 6) rect(ctx, x + k, y + 1, 3, 2, C.roseDark);
        rect(ctx, x + 3, y + 4, W.rug - 6, 1, C.roseDark);
        break;
      }
      case 'garland': {
        for (let k = 0; k < l.width; k++) {
          const sag = Math.round(Math.sin((k / l.width) * Math.PI * 6) * 2 + 4);
          rect(ctx, k, sag, 1, 1, '#4b4f7a');
          if (k % 9 === 4) {
            const i = Math.floor(k / 9);
            const on = !w.night || Math.floor(w.time * 2 + i) % 3 !== 0;
            const col = C.bulbs[i % C.bulbs.length]!;
            rect(ctx, k - 1, sag + 1, 3, 3, on ? col : '#6b6e8f');
            if (w.night && on) {
              ctx.globalAlpha = 0.25;
              rect(ctx, k - 3, sag - 1, 7, 7, col);
              ctx.globalAlpha = 1;
            }
          }
        }
        break;
      }
      case 'picture': {
        const y = F - 58;
        box(ctx, x, y, W.picture, 12, '#fdf7ea', C.woodDark);
        rect(ctx, x + 1, y + 1, W.picture - 2, 1, C.wood);
        // A fish.
        rect(ctx, x + 4, y + 5, 6, 3, C.fish);
        rect(ctx, x + 10, y + 4, 2, 5, C.fish);
        rect(ctx, x + 5, y + 5, 1, 1, C.ink);
        break;
      }
      case 'window': {
        const top = F - 26 - 30;
        const wx = x;
        box(ctx, wx, top, W.window, 30, w.night ? C.night : C.sky, C.woodDark);
        rect(ctx, wx + 1, top + 1, W.window - 2, 1, C.wood);
        if (w.night) {
          rect(ctx, wx + 23, top + 5, 4, 4, C.moon);
          rect(ctx, wx + 25, top + 5, 2, 2, C.night);
          for (const [sx, sy] of [
            [6, 6],
            [13, 11],
            [9, 20],
            [27, 17],
          ])
            rect(ctx, wx + sx!, top + sy!, 1, 1, '#ffffff');
        } else {
          const cx = wx + 4 + ((w.time * 1.5) % 30);
          if (cx < wx + W.window - 9) {
            rect(ctx, cx, top + 8, 7, 2, C.cloud);
            rect(ctx, cx + 2, top + 7, 3, 1, C.cloud);
          }
          // A bird now and then.
          const b = (w.time * 9) % 120;
          if (b < W.window - 4) {
            const by = top + 16 + Math.round(Math.sin(b / 4) * 2);
            const flap = Math.floor(w.time * 6) % 2;
            rect(ctx, wx + 2 + b, by, 1, 1, C.ink);
            rect(ctx, wx + 3 + b, by + flap, 1, 1, C.ink);
            rect(ctx, wx + 4 + b, by, 1, 1, C.ink);
          }
        }
        rect(ctx, wx + W.window / 2, top + 1, 1, 28, C.woodDark);
        rect(ctx, wx + 1, top + 14, W.window - 2, 1, C.woodDark);
        // Sill the cat can sit on.
        box(ctx, wx - 3, F - 26, W.window + 6, 3, C.wood, C.woodDark);
        break;
      }
      case 'plant': {
        const win = l.items.find((i) => i.key === 'window');
        if (!win) break;
        const px = win.x + W.window - 9;
        const py = F - 26;
        box(ctx, px + 1, py - 6, 7, 6, C.pot, C.potDark);
        rect(ctx, px, py - 7, 9, 2, C.potDark);
        for (const [dx, dy, h] of [
          [1, -12, 5],
          [3, -15, 8],
          [5, -13, 6],
          [7, -11, 4],
        ] as const) {
          rect(ctx, px + dx, py + dy, 2, h, C.leaf);
          rect(ctx, px + dx, py + dy, 1, h, C.leafDark);
        }
        break;
      }
      case 'tree': {
        const plat = F - 36;
        // Base, post, house, platform.
        box(ctx, x, F - 3, W.tree, 3, C.plush, C.plushDark);
        box(ctx, x + 17, plat + 3, 6, F - 3 - plat - 3, C.sisal, C.sisalDark);
        for (let y = plat + 5; y < F - 4; y += 2) rect(ctx, x + 18, y, 4, 1, C.sisalDark);
        box(ctx, x + 1, F - 18, 15, 15, C.plush, C.plushDark);
        rect(ctx, x + 5, F - 13, 7, 8, C.ink);
        rect(ctx, x + 6, F - 14, 5, 1, C.ink);
        if (w.catInside === 'hide' && !w.hiddenBlink) {
          rect(ctx, x + 6, F - 10, 1, 1, '#f5e663');
          rect(ctx, x + 9, F - 10, 1, 1, '#f5e663');
        }
        box(ctx, x - 1, plat, W.tree + 2, 4, C.plush, C.plushDark);
        // Pom-pom on a string, swinging.
        const sw = Math.round(Math.sin(w.time * 2.4) * 1.5);
        rect(ctx, x + W.tree - 2, plat + 4, 1, 6, '#6b6e8f');
        rect(ctx, x + W.tree - 3 + sw, plat + 10, 3, 3, C.red);
        break;
      }
      case 'aquarium': {
        const standTop = F - 13;
        box(ctx, x, standTop, W.aquarium, 13, C.wood, C.woodDark);
        rect(ctx, x + 3, standTop + 4, W.aquarium - 6, 1, C.woodDark);
        const tankTop = standTop - 17;
        box(ctx, x, tankTop, W.aquarium, 17, C.glass, '#5d6088');
        rect(ctx, x + 1, tankTop + 4, W.aquarium - 2, 12, C.water);
        rect(ctx, x + 1, tankTop + 14, W.aquarium - 2, 2, C.sand);
        for (const wx of [5, 20])
          for (let k = 0; k < 7; k++)
            rect(
              ctx,
              x + wx + Math.round(Math.sin(w.time * 2 + k) * 0.8),
              tankTop + 13 - k,
              1,
              1,
              C.weed,
            );
        // Two fish swimming back and forth.
        for (const [speed, row, col] of [
          [5, 7, C.fish],
          [3.4, 10, C.fish2],
        ] as const) {
          const span = W.aquarium - 9;
          const p = (w.time * speed) % (span * 2);
          const fx = p < span ? p : span * 2 - p;
          const right = p < span;
          rect(ctx, x + 3 + fx, tankTop + row, 4, 2, col);
          rect(ctx, x + 3 + fx + (right ? -1 : 4), tankTop + row - (right ? 0 : 0), 1, 2, col);
          rect(ctx, x + 3 + fx + (right ? 3 : 0), tankTop + row, 1, 1, C.ink);
        }
        // Bubbles.
        const bub = (w.time * 6) % 10;
        rect(ctx, x + 22, tankTop + 13 - Math.round(bub), 1, 1, '#ffffff');
        break;
      }
      case 'scratcher': {
        box(ctx, x, F - 3, W.scratcher, 3, C.plush, C.plushDark);
        box(ctx, x + 3, F - 27, 5, 24, C.sisal, C.sisalDark);
        for (let y = F - 25; y < F - 4; y += 2) rect(ctx, x + 4, y, 3, 1, C.sisalDark);
        box(ctx, x + 1, F - 29, 9, 3, C.plush, C.plushDark);
        break;
      }
      case 'bed': {
        // Back rim and cushion; the front rim goes over the cat (drawFront).
        rect(ctx, x + 1, F - 9, W.bed - 2, 8, C.roseDark);
        rect(ctx, x + 2, F - 10, W.bed - 4, 2, C.rose);
        rect(ctx, x + 3, F - 6, W.bed - 6, 4, C.cushion);
        drawBedFront(ctx, x);
        break;
      }
      case 'box': {
        const top = F - 13;
        rect(ctx, x, top, W.box, 13, C.cardboardDark);
        rect(ctx, x + 1, top + 1, W.box - 2, 11, '#8a5a2e');
        // Flaps.
        rect(ctx, x - 3, top - 3, 4, 3, C.cardboard);
        rect(ctx, x + W.box - 1, top - 3, 4, 3, C.cardboard);
        drawBoxFront(ctx, x);
        break;
      }
      case 'mouse': {
        const wob = Math.sin(w.time * 14) * w.wobble * 2.5 + Math.sin(w.time * 2) * 0.5;
        box(ctx, x, F - 2, W.mouse, 2, C.plush, C.plushDark);
        for (let k = 0; k < 9; k++)
          rect(ctx, x + 3 + (k % 2) + Math.round((wob * k) / 9), F - 3 - k, 1, 1, '#8a8ca8');
        const mx = x + 1 + Math.round(wob);
        const my = F - 16;
        rect(ctx, mx, my + 1, 6, 3, C.mouse);
        rect(ctx, mx + 1, my, 4, 1, C.mouse);
        rect(ctx, mx + 5, my, 2, 2, C.pink);
        rect(ctx, mx + 4, my + 1, 1, 1, C.ink);
        rect(ctx, mx - 2, my + 3, 2, 1, C.pink);
        break;
      }
      case 'ball': {
        const bx = Math.round(w.ballX);
        const rot = Math.floor(bx / 2) % 2;
        rect(ctx, bx, F - 4, 4, 4, C.red);
        rect(ctx, bx - 1, F - 3, 6, 2, C.red);
        rect(ctx, bx + rot, F - 3, 1, 2, C.redLight);
        rect(ctx, bx + 2 + rot, F - 4, 1, 2, C.redLight);
        // Loose thread.
        rect(ctx, bx + 5, F - 1, 4, 1, C.red);
        break;
      }
    }
  }
  // The bowl is always there.
  const bx = l.bowlX + 36;
  rect(ctx, bx, F - 4, 12, 4, C.ink);
  rect(ctx, bx - 1, F - 4, 14, 1, C.ink);
  rect(ctx, bx + 1, F - 3, 10, 2, '#4a4fc4');
}

export function drawBowlFood(ctx: Ctx, l: Layout, level: number) {
  if (level <= 0.05) return;
  const bx = l.bowlX + 36;
  const h = level > 0.6 ? 2 : 1;
  rect(ctx, bx + 1, FLOOR_Y - 4 - h, 10, h, '#f5b62e');
  rect(ctx, bx + 3, FLOOR_Y - 4 - h, 1, 1, '#c98a14');
  rect(ctx, bx + 7, FLOOR_Y - 4 - h, 1, 1, '#c98a14');
}

function drawBedFront(ctx: Ctx, x: number) {
  const F = FLOOR_Y;
  rect(ctx, x, F - 5, W.bed, 5, C.roseDark);
  rect(ctx, x + 1, F - 5, W.bed - 2, 3, C.rose);
  rect(ctx, x + 3, F - 4, W.bed - 6, 1, '#f3b6c5');
}

function drawBoxFront(ctx: Ctx, x: number) {
  const top = FLOOR_Y - 11;
  box(ctx, x, top, W.box, 11, C.cardboard, C.cardboardDark);
  rect(ctx, x + 3, top + 4, W.box - 6, 1, C.cardboardDark);
  rect(ctx, x + W.box / 2 - 2, top + 1, 4, 3, '#e8b983');
}

/** Item parts in front of a cat that is inside them. */
export function drawFront(ctx: Ctx, l: Layout, w: World) {
  if (w.catInside === 'bed') {
    const it = l.items.find((i) => i.key === 'bed');
    if (it) drawBedFront(ctx, it.x);
  }
  if (w.catInside === 'box') {
    const it = l.items.find((i) => i.key === 'box');
    if (it) drawBoxFront(ctx, it.x);
  }
}

/** Where to crop an item for its shop thumbnail, in room pixels: [x, y, w, h]. */
export function previewBox(l: Layout, key: ItemKey): [number, number, number, number] {
  const F = FLOOR_Y;
  const x = l.items.find((i) => i.key === key)?.x ?? 0;
  const win = l.items.find((i) => i.key === 'window')?.x ?? 0;
  switch (key) {
    case 'window':
      return [x - 5, F - 58, 44, 36];
    case 'plant':
      return [win + 22, F - 46, 16, 22];
    case 'tree':
      return [x - 2, F - 40, 30, 42];
    case 'bed':
      return [x - 3, F - 14, 32, 17];
    case 'box':
      return [x - 5, F - 20, 32, 22];
    case 'aquarium':
      return [x - 3, F - 33, 34, 35];
    case 'scratcher':
      return [x - 6, F - 32, 22, 34];
    case 'mouse':
      return [x - 5, F - 19, 18, 21];
    case 'ball':
      return [x - 5, F - 9, 20, 12];
    case 'rug':
      return [x - 2, F - 8, W.rug + 4, 14];
    case 'picture':
      return [x - 3, F - 61, 22, 18];
    case 'garland':
      return [0, 0, 44, 14];
  }
}
