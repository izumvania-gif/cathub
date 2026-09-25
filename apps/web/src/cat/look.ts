/**
 * What the household's cat looks like (stored in `cats.appearance`). Only keys are stored; the
 * palette is derived here so the art can be retuned without migrating data.
 */
export type Coat = 'brown' | 'grey' | 'ginger' | 'black' | 'blue' | 'cream' | 'white';
export type Pattern = 'tabby' | 'solid' | 'bicolor' | 'calico' | 'point';
export type Eyes = 'green' | 'gold' | 'copper' | 'blue' | 'odd';
export type Accessory = 'none' | 'collar' | 'bell' | 'bow';

export interface CatLook {
  coat: Coat;
  pattern: Pattern;
  eyes: Eyes;
  fluffy: boolean;
  socks: boolean;
  accessory: Accessory;
  accessoryColor: string;
}

export interface Palette {
  base: string;
  stripe: string;
  light: string;
  outline: string;
  nose: string;
  earIn: string;
  eye: string;
  eye2: string;
  /** Second patch color (calico) or the points (colorpoint). */
  alt: string;
  alt2: string;
}

export const COATS: Record<Coat, { label: string; base: string; stripe: string; light: string }> = {
  brown: { label: 'Коричнево-серый', base: '#8a7b66', stripe: '#3f352c', light: '#e6dccb' },
  grey: { label: 'Серый', base: '#9a9a9c', stripe: '#4a4a52', light: '#ecebea' },
  ginger: { label: 'Рыжий', base: '#e39445', stripe: '#b4612a', light: '#f8e2c2' },
  black: { label: 'Чёрный', base: '#2f2d38', stripe: '#1f1d27', light: '#f5f2ec' },
  blue: { label: 'Голубой', base: '#8c95a6', stripe: '#737c8e', light: '#a9b1bf' },
  cream: { label: 'Кремовый', base: '#ead3ad', stripe: '#d2b184', light: '#faf1e2' },
  white: { label: 'Белый', base: '#f6f3ee', stripe: '#dcd6cc', light: '#ffffff' },
};

export const PATTERNS: Record<Pattern, string> = {
  tabby: 'Полосатый',
  solid: 'Однотонный',
  bicolor: 'С белым («смокинг»)',
  calico: 'Трёхцветный',
  point: 'Колор-пойнт',
};

export const EYES: Record<Eyes, { label: string; color: string }> = {
  green: { label: 'Зелёные', color: '#9fae45' },
  gold: { label: 'Жёлтые', color: '#e2b23a' },
  copper: { label: 'Медные', color: '#d9863a' },
  blue: { label: 'Голубые', color: '#6aa6e6' },
  odd: { label: 'Разные', color: '#6aa6e6' },
};

export const ACCESSORIES: Record<Accessory, string> = {
  none: 'Нет',
  collar: 'Ошейник',
  bell: 'Колокольчик',
  bow: 'Бантик',
};

const base: CatLook = {
  coat: 'brown',
  pattern: 'tabby',
  eyes: 'green',
  fluffy: false,
  socks: false,
  accessory: 'none',
  accessoryColor: '#e2563a',
};

export const PRESETS: { key: string; label: string; look: CatLook }[] = [
  { key: 'photo', label: 'Как на фото', look: base },
  { key: 'ginger', label: 'Рыжий', look: { ...base, coat: 'ginger', eyes: 'gold' } },
  {
    key: 'tuxedo',
    label: 'Чёрно-белый',
    look: { ...base, coat: 'black', pattern: 'bicolor', socks: true },
  },
  {
    key: 'british',
    label: 'Британец',
    look: { ...base, coat: 'blue', pattern: 'solid', eyes: 'copper', fluffy: true },
  },
  {
    key: 'calico',
    label: 'Трёхцветная',
    look: { ...base, coat: 'white', pattern: 'calico', eyes: 'gold' },
  },
  {
    key: 'siamese',
    label: 'Сиамский',
    look: { ...base, coat: 'cream', pattern: 'point', eyes: 'blue' },
  },
];

export const DEFAULT_LOOK = base;

/** Accepts whatever is stored (possibly partial or from an older version). */
export function normalizeLook(raw: unknown): CatLook {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<CatLook>;
  const pick = <T extends string>(v: unknown, allowed: Record<T, unknown>, d: T): T =>
    typeof v === 'string' && v in allowed ? (v as T) : d;
  return {
    coat: pick(r.coat, COATS, base.coat),
    pattern: pick(r.pattern, PATTERNS, base.pattern),
    eyes: pick(r.eyes, EYES, base.eyes),
    fluffy: r.fluffy === true,
    socks: r.socks === true,
    accessory: pick(r.accessory, ACCESSORIES, base.accessory),
    accessoryColor:
      typeof r.accessoryColor === 'string' && /^#[0-9a-f]{6}$/i.test(r.accessoryColor)
        ? r.accessoryColor
        : base.accessoryColor,
  };
}

export function randomLook(rand = Math.random): CatLook {
  const any = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  return {
    coat: any(Object.keys(COATS) as Coat[]),
    pattern: any(Object.keys(PATTERNS) as Pattern[]),
    eyes: any(Object.keys(EYES) as Eyes[]),
    fluffy: rand() < 0.3,
    socks: rand() < 0.3,
    accessory: any(Object.keys(ACCESSORIES) as Accessory[]),
    accessoryColor: any(['#e2563a', '#4a4fc4', '#35a374', '#f5b62e', '#e85d9c']),
  };
}

export function palette(look: CatLook): Palette {
  const c = COATS[look.coat];
  let { base: b, stripe, light } = c;
  let alt = '#e08a3c';
  const alt2 = '#34313a';
  if (look.pattern === 'calico') {
    b = '#f6f2ea';
    light = '#ffffff';
    stripe = '#d9d2c6';
  }
  if (look.pattern === 'point') {
    // Points take the chosen coat (brown → seal point, blue → blue point, ginger → flame point).
    const points: Partial<Record<Coat, string>> = {
      brown: '#57443a',
      grey: '#6b6b74',
      ginger: '#d27c3c',
      black: '#3a3134',
      blue: '#7a8394',
    };
    alt = points[look.coat] ?? '#57443a';
    b = '#efe3cf';
    stripe = '#e1d0b5';
    light = '#f8f1e4';
  }
  if (look.pattern === 'bicolor') light = '#f7f4ee';
  if (look.pattern === 'solid' && look.coat !== 'white') light = mix(b, '#ffffff', 0.18);
  const eye = EYES[look.eyes].color;
  return {
    base: b,
    stripe,
    light,
    outline: mix(look.coat === 'black' ? '#000000' : stripe, '#17122a', 0.6),
    nose: look.coat === 'blue' ? '#6f7686' : look.coat === 'black' ? '#3b3440' : '#d08a7c',
    earIn: '#e7aaa6',
    eye,
    eye2: look.eyes === 'odd' ? EYES.gold.color : eye,
    alt,
    alt2,
  };
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a: string, b: string, t: number): string {
  const x = hexToRgb(a);
  const y = hexToRgb(b);
  const c = x.map((v, i) => Math.round(v + (y[i]! - v) * t));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
