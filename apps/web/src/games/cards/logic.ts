/**
 * «Девять жизней», a small deck-builder. Three floors of five rooms; the fifth is a boss. The
 * whole run is plain JSON (the RNG state included), so it can be saved and continued later.
 * Pure logic, no DOM.
 */

// ── cards ─────────────────────────────────────────────────────────────────

export type CardKey =
  | 'scratch'
  | 'hiss'
  | 'pounce'
  | 'double'
  | 'ambush'
  | 'fluff'
  | 'purr'
  | 'yarn'
  | 'claws'
  | 'meow'
  | 'agile'
  | 'shelf'
  | 'flurry';

export interface CardDef {
  title: string;
  cost: number;
  text: string;
  kind: 'attack' | 'skill';
  dmg?: number;
  hits?: number;
  block?: number;
  heal?: number;
  draw?: number;
  str?: number;
  weaken?: number;
  /** Damage equals your block. */
  slam?: boolean;
  /** Used once per fight. */
  exhaust?: boolean;
}

export const CARDS: Record<CardKey, CardDef> = {
  scratch: { title: 'Царапка', cost: 1, kind: 'attack', dmg: 6, text: '6 урона' },
  hiss: { title: 'Шипение', cost: 1, kind: 'skill', block: 5, text: '5 защиты' },
  pounce: { title: 'Прыжок', cost: 1, kind: 'attack', dmg: 4, block: 4, text: '4 урона, 4 защиты' },
  double: {
    title: 'Двойная царапка',
    cost: 1,
    kind: 'attack',
    dmg: 4,
    hits: 2,
    text: '4 урона дважды',
  },
  ambush: { title: 'Засада', cost: 2, kind: 'attack', dmg: 14, text: '14 урона' },
  fluff: { title: 'Распушиться', cost: 1, kind: 'skill', block: 8, text: '8 защиты' },
  purr: {
    title: 'Мурр',
    cost: 1,
    kind: 'skill',
    heal: 5,
    exhaust: true,
    text: '+5 здоровья, один раз за бой',
  },
  yarn: { title: 'Клубок', cost: 0, kind: 'skill', draw: 2, text: 'Взять 2 карты' },
  claws: {
    title: 'Когти наготове',
    cost: 1,
    kind: 'skill',
    str: 2,
    exhaust: true,
    text: '+2 к урону до конца боя',
  },
  meow: { title: 'Мяу!', cost: 0, kind: 'skill', weaken: 2, text: 'Враг бьёт слабее 2 хода' },
  agile: {
    title: 'Ловкость',
    cost: 2,
    kind: 'skill',
    block: 12,
    draw: 1,
    text: '12 защиты, взять карту',
  },
  shelf: { title: 'С полки', cost: 1, kind: 'attack', slam: true, text: 'Урон равен защите' },
  flurry: {
    title: 'Лапа-молния',
    cost: 1,
    kind: 'attack',
    dmg: 3,
    hits: 3,
    text: '3 урона трижды',
  },
};

const STARTER: CardKey[] = [
  'scratch',
  'scratch',
  'scratch',
  'scratch',
  'scratch',
  'hiss',
  'hiss',
  'hiss',
  'hiss',
  'pounce',
];
const REWARD_POOL: CardKey[] = [
  'double',
  'ambush',
  'fluff',
  'purr',
  'yarn',
  'claws',
  'meow',
  'agile',
  'shelf',
  'flurry',
];

// ── enemies ───────────────────────────────────────────────────────────────

export type Intent =
  | { kind: 'atk'; dmg: number; times?: number }
  | { kind: 'def'; block: number; dmg?: number }
  | { kind: 'buff'; str: number }
  | { kind: 'weak'; turns: number };

export type EnemyKey = 'mouse' | 'crow' | 'roach' | 'rat' | 'ratboss' | 'vacuum' | 'bath';

export const ENEMIES: Record<
  EnemyKey,
  { title: string; hp: number; intents: Intent[]; boss?: boolean }
> = {
  mouse: {
    title: 'Мышь',
    hp: 14,
    intents: [
      { kind: 'atk', dmg: 5 },
      { kind: 'atk', dmg: 7 },
      { kind: 'def', block: 4, dmg: 3 },
    ],
  },
  crow: {
    title: 'Ворона',
    hp: 18,
    intents: [
      { kind: 'atk', dmg: 3, times: 2 },
      { kind: 'def', block: 6 },
      { kind: 'atk', dmg: 9 },
    ],
  },
  roach: {
    title: 'Таракан',
    hp: 13,
    intents: [
      { kind: 'atk', dmg: 4 },
      { kind: 'buff', str: 2 },
      { kind: 'atk', dmg: 4 },
    ],
  },
  rat: {
    title: 'Крыса',
    hp: 24,
    intents: [
      { kind: 'atk', dmg: 8 },
      { kind: 'def', block: 6, dmg: 5 },
      { kind: 'weak', turns: 2 },
    ],
  },
  ratboss: {
    title: 'Крыса-вожак',
    hp: 52,
    boss: true,
    intents: [
      { kind: 'atk', dmg: 9 },
      { kind: 'def', block: 8, dmg: 6 },
      { kind: 'buff', str: 3 },
      { kind: 'atk', dmg: 13 },
    ],
  },
  vacuum: {
    title: 'Пылесос',
    hp: 88,
    boss: true,
    intents: [
      { kind: 'atk', dmg: 8, times: 2 },
      { kind: 'def', block: 14, dmg: 8 },
      { kind: 'weak', turns: 2 },
      { kind: 'atk', dmg: 22 },
    ],
  },
  bath: {
    title: 'Ванна',
    hp: 100,
    boss: true,
    intents: [
      { kind: 'atk', dmg: 6, times: 3 },
      { kind: 'weak', turns: 2 },
      { kind: 'atk', dmg: 24 },
      { kind: 'def', block: 16, dmg: 8 },
    ],
  },
};

const FLOOR_ENEMIES: EnemyKey[][] = [
  ['mouse', 'crow', 'roach'],
  ['mouse', 'crow', 'rat', 'roach'],
  ['crow', 'rat', 'rat', 'roach'],
];
export const BOSSES: EnemyKey[] = ['ratboss', 'vacuum', 'bath'];
/** Regular enemies get tougher each floor. */
const FLOOR_SCALE = [1, 1.45, 1.8];

// ── relics ────────────────────────────────────────────────────────────────

export type RelicKey = 'bell' | 'collar' | 'oil' | 'luck' | 'pillow';

export const RELICS: Record<RelicKey, { title: string; emoji: string; text: string }> = {
  bell: { title: 'Колокольчик', emoji: '🔔', text: '+1 энергия в первый ход боя' },
  collar: { title: 'Ошейник', emoji: '📿', text: 'Бой начинается с 6 защиты' },
  oil: { title: 'Рыбий жир', emoji: '🐟', text: '+8 к здоровью' },
  luck: { title: 'Счастливый клубок', emoji: '🧶', text: '+1 карта в первый ход боя' },
  pillow: { title: 'Мятная подушка', emoji: '🌿', text: '+4 здоровья после каждого боя' },
};

// ── state ─────────────────────────────────────────────────────────────────

export type RoomKind = 'fight' | 'rest' | 'bowl' | 'box';
export const ROOM_INFO: Record<RoomKind, { title: string; emoji: string; text: string }> = {
  fight: { title: 'Бой', emoji: '⚔️', text: 'Победишь, выберешь новую карту' },
  rest: { title: 'Лежанка', emoji: '🛏️', text: 'Отдохнуть: +30% здоровья' },
  bowl: { title: 'Миска', emoji: '🥣', text: 'Убрать одну карту из колоды' },
  box: { title: 'Коробка', emoji: '📦', text: 'Внутри находка' },
};
export const ROOMS_PER_FLOOR = 5; // the last one is the boss

export interface Enemy {
  key: EnemyKey;
  hp: number;
  max: number;
  block: number;
  str: number;
  weak: number;
  turn: number;
  /** Damage dealt by the last scaled intents (the floor multiplier is baked in here). */
  scale: number;
}

export interface Fight {
  enemy: Enemy;
  hand: CardKey[];
  /** Stable ids for the cards in hand, so the UI can animate them without re-keying. */
  handIds: number[];
  draw: CardKey[];
  discard: CardKey[];
  exhausted: CardKey[];
  energy: number;
  block: number;
  str: number;
  weak: number;
  turn: number;
}

export type Phase = 'map' | 'fight' | 'reward' | 'rest' | 'bowl' | 'box' | 'over';

export interface Run {
  version: 1;
  rs: number;
  phase: Phase;
  floor: number; // 0..2
  room: number; // rooms done on this floor
  choices: RoomKind[];
  hp: number;
  maxHp: number;
  deck: CardKey[];
  /** Next id for a drawn card. */
  nextCard?: number;
  relics: RelicKey[];
  fight: Fight | null;
  reward: CardKey[];
  found: RelicKey | null;
  rooms: number;
  floors: number;
  won: boolean;
  activeMs: number;
  log: string[];
}

function next(r: Run) {
  r.rs = (r.rs + 0x6d2b79f5) >>> 0;
  let t = r.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(r: Run, xs: readonly T[]) => xs[Math.floor(next(r) * xs.length)]!;
function shuffle<T>(r: Run, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(next(r) * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

export function newRun(seed: number): Run {
  const r: Run = {
    version: 1,
    rs: seed >>> 0,
    phase: 'map',
    floor: 0,
    room: 0,
    choices: [],
    hp: 40,
    maxHp: 40,
    deck: [...STARTER],
    relics: [],
    fight: null,
    reward: [],
    found: null,
    rooms: 0,
    floors: 0,
    won: false,
    activeMs: 0,
    log: [],
  };
  r.choices = roomChoices(r);
  return r;
}

export const isBossRoom = (r: Run) => r.room === ROOMS_PER_FLOOR - 1;

function roomChoices(r: Run): RoomKind[] {
  if (isBossRoom(r)) return ['fight'];
  if (r.room === 0) return ['fight', 'fight'];
  const pool: RoomKind[] = ['fight', 'fight', 'rest', 'bowl', 'box'];
  const a = pick(r, pool);
  let b = pick(r, pool);
  for (let i = 0; i < 5 && b === a && a !== 'fight'; i++) b = pick(r, pool);
  return [a, b];
}

// ── fights ────────────────────────────────────────────────────────────────

export function intentOf(e: Enemy): Intent {
  const list = ENEMIES[e.key].intents;
  const i = list[e.turn % list.length]!;
  const k = e.scale;
  if (i.kind === 'atk') return { ...i, dmg: Math.round(i.dmg * k) };
  if (i.kind === 'def')
    return { ...i, block: Math.round(i.block * k), dmg: i.dmg && Math.round(i.dmg * k) };
  return i;
}

function startFight(r: Run) {
  const boss = isBossRoom(r);
  const key = boss ? BOSSES[r.floor]! : pick(r, FLOOR_ENEMIES[r.floor]!);
  const scale = boss ? 1 : FLOOR_SCALE[r.floor]!;
  const max = Math.round(ENEMIES[key].hp * scale);
  r.fight = {
    enemy: { key, hp: max, max, block: 0, str: 0, weak: 0, turn: 0, scale },
    hand: [],
    handIds: [],
    draw: shuffle(r, r.deck),
    discard: [],
    exhausted: [],
    energy: 0,
    block: 0,
    str: 0,
    weak: 0,
    turn: 0,
  };
  r.phase = 'fight';
  startTurn(r);
}

function drawCards(r: Run, n: number) {
  const f = r.fight!;
  for (let i = 0; i < n; i++) {
    if (!f.draw.length) {
      if (!f.discard.length) return;
      f.draw = shuffle(r, f.discard);
      f.discard = [];
    }
    f.hand.push(f.draw.pop()!);
    r.nextCard = (r.nextCard ?? 0) + 1;
    f.handIds.push(r.nextCard);
  }
}

function startTurn(r: Run) {
  const f = r.fight!;
  const first = f.turn === 0;
  f.turn += 1;
  f.block = first && r.relics.includes('collar') ? 6 : 0;
  f.energy = 3 + (first && r.relics.includes('bell') ? 1 : 0);
  drawCards(r, 5 + (first && r.relics.includes('luck') ? 1 : 0));
}

const dealt = (base: number, str: number, weak: boolean) =>
  Math.max(0, Math.floor((base + str) * (weak ? 0.75 : 1)));

function hitEnemy(r: Run, amount: number) {
  const e = r.fight!.enemy;
  const through = Math.max(0, amount - e.block);
  e.block = Math.max(0, e.block - amount);
  e.hp = Math.max(0, e.hp - through);
}

export function canPlay(r: Run, i: number) {
  const f = r.fight;
  const c = f?.hand[i];
  return Boolean(r.phase === 'fight' && f && c && CARDS[c].cost <= f.energy);
}

/** Plays card i from the hand. Returns false if it can't be played. */
export function playCard(r: Run, i: number): boolean {
  if (!canPlay(r, i)) return false;
  const f = r.fight!;
  const key = f.hand[i]!;
  const c = CARDS[key];
  f.energy -= c.cost;
  f.hand.splice(i, 1);
  f.handIds.splice(i, 1);
  if (c.block) f.block += c.block;
  if (c.slam) hitEnemy(r, dealt(f.block, 0, f.weak > 0));
  if (c.dmg) for (let k = 0; k < (c.hits ?? 1); k++) hitEnemy(r, dealt(c.dmg, f.str, f.weak > 0));
  if (c.heal) r.hp = Math.min(r.maxHp, r.hp + c.heal);
  if (c.str) f.str += c.str;
  if (c.weaken) f.enemy.weak += c.weaken;
  (c.exhaust ? f.exhausted : f.discard).push(key);
  if (c.draw) drawCards(r, c.draw);
  if (f.enemy.hp <= 0) winFight(r);
  return true;
}

export function endTurn(r: Run) {
  if (r.phase !== 'fight') return;
  const f = r.fight!;
  f.discard.push(...f.hand);
  f.hand = [];
  f.handIds = [];
  // The enemy acts.
  const e = f.enemy;
  e.block = 0;
  const i = intentOf(e);
  const hitPlayer = (dmg: number) => {
    const amount = dealt(dmg, e.str, e.weak > 0);
    const through = Math.max(0, amount - f.block);
    f.block = Math.max(0, f.block - amount);
    r.hp = Math.max(0, r.hp - through);
  };
  if (i.kind === 'atk') for (let k = 0; k < (i.times ?? 1); k++) hitPlayer(i.dmg);
  else if (i.kind === 'def') {
    e.block = i.block;
    if (i.dmg) hitPlayer(i.dmg);
  } else if (i.kind === 'buff') e.str += i.str;
  else if (i.kind === 'weak') f.weak += i.turns;
  e.turn += 1;
  e.weak = Math.max(0, e.weak - 1);
  f.weak = Math.max(0, f.weak - (i.kind === 'weak' ? 0 : 1));
  if (r.hp <= 0) {
    r.phase = 'over';
    r.fight = null;
    return;
  }
  startTurn(r);
}

function winFight(r: Run) {
  const boss = isBossRoom(r);
  r.fight = null;
  r.rooms += 1;
  if (r.relics.includes('pillow')) r.hp = Math.min(r.maxHp, r.hp + 4);
  if (boss) {
    r.floors += 1;
    if (r.floor === BOSSES.length - 1) {
      r.won = true;
      r.phase = 'over';
      return;
    }
    // A boss drops a find and lets you catch your breath.
    r.hp = Math.min(r.maxHp, r.hp + Math.round(r.maxHp * 0.2));
    grantRelic(r);
  }
  r.reward = shuffle(r, REWARD_POOL).slice(0, 3);
  r.phase = 'reward';
}

// ── rooms ─────────────────────────────────────────────────────────────────

function advance(r: Run) {
  r.room += 1;
  if (r.room >= ROOMS_PER_FLOOR) {
    r.floor += 1;
    r.room = 0;
  }
  r.found = null;
  r.choices = roomChoices(r);
  r.phase = 'map';
}

export function chooseRoom(r: Run, i: number) {
  if (r.phase !== 'map') return;
  const kind = r.choices[i];
  if (!kind) return;
  if (kind === 'fight') startFight(r);
  else if (kind === 'rest') r.phase = 'rest';
  else if (kind === 'bowl') r.phase = 'bowl';
  else {
    grantRelic(r);
    r.phase = 'box';
  }
}

function grantRelic(r: Run) {
  const left = (Object.keys(RELICS) as RelicKey[]).filter((k) => !r.relics.includes(k));
  if (!left.length) {
    r.maxHp += 5;
    r.hp += 5;
    r.found = null;
    return;
  }
  const k = pick(r, left);
  r.relics.push(k);
  if (k === 'oil') {
    r.maxHp += 8;
    r.hp += 8;
  }
  r.found = k;
}

export function takeReward(r: Run, i: number | null) {
  if (r.phase !== 'reward') return;
  if (i !== null && r.reward[i]) r.deck.push(r.reward[i]!);
  r.reward = [];
  advance(r);
}

export function rest(r: Run) {
  if (r.phase !== 'rest') return;
  r.hp = Math.min(r.maxHp, r.hp + Math.round(r.maxHp * 0.3));
  r.rooms += 1;
  advance(r);
}

export function removeCard(r: Run, i: number | null) {
  if (r.phase !== 'bowl') return;
  if (i !== null && r.deck.length > 5) r.deck.splice(i, 1);
  r.rooms += 1;
  advance(r);
}

export function leaveBox(r: Run) {
  if (r.phase !== 'box') return;
  r.rooms += 1;
  advance(r);
}

// ── result ────────────────────────────────────────────────────────────────

export const score = (r: Run) => r.floors * 100 + r.rooms * 5 + (r.won ? r.hp : 0);
export const stats = (r: Run) => ({ score: score(r), floors: r.floors, hp: r.won ? r.hp : 0 });
