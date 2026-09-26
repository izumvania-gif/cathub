import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState } from 'react';
import { begin, drawCat, end, px, sprite, useLoop, useStage } from '../engine';
import type { GameProps } from '../registry';
import { sfx } from '../sound';
import {
  CAT_X,
  HELPERS,
  init,
  freeSlots,
  moveCat,
  place,
  rowAt,
  ROWS,
  rowY,
  SLOTS,
  START_FOOD,
  stats,
  step,
  W,
  WAVES,
  type HelperKind,
  type Mouse,
  type State,
} from './logic';

function art() {
  const mouse = (body: string, dark: string, extra: Record<string, string> = {}) => [
    sprite(['.pp......', 'bbbb.....', 'ebbbbbbtt', 'bbbbbbb..', '.l..l....'], {
      b: body,
      p: '#f2a7b8',
      e: '#17122a',
      t: '#f2a7b8',
      l: dark,
      ...extra,
    }),
    sprite(['.pp......', 'bbbb.....', 'ebbbbbbtt', 'bbbbbbb..', 'l..l.....'], {
      b: body,
      p: '#f2a7b8',
      e: '#17122a',
      t: '#f2a7b8',
      l: dark,
      ...extra,
    }),
  ];
  const fat = (f: string) =>
    sprite(['.pp........', 'bbbbb......', 'bbbbbbbbb..', 'ebbbbbbbbtt', 'bbbbbbbbb..', f], {
      b: '#7d7f95',
      p: '#f2a7b8',
      e: '#17122a',
      t: '#f2a7b8',
      l: '#4b4f7a',
    });
  const thief = (legs: string) =>
    sprite(['.pp....ss.', 'bbbb..ssss', 'kkbbbbssss', 'bbbbbbbss.', legs], {
      b: '#9a9cb0',
      p: '#f2a7b8',
      k: '#2b2d45',
      s: '#b5895a',
      l: '#4b4f7a',
    });
  return {
    mouse: mouse('#a3a5b8', '#5a5d78'),
    fast: mouse('#b58a64', '#6b4a2e'),
    fat: [fat('.l..l..l...'), fat('l..l..l....')],
    thief: [thief('.l..l.....'), thief('l..l......')],
    post: sprite(
      [
        '..bbbb..',
        '..rrrr..',
        '..rRrr..',
        '..rrrr..',
        '..rrRr..',
        '..rrrr..',
        '..rRrr..',
        '..rrrr..',
        '..rrRr..',
        '..rrrr..',
        'bbbbbbbb',
      ],
      { b: '#8a6a4a', r: '#e2cfa3', R: '#c9b384' },
    ),
    kitten: sprite(
      ['.o...o..', '.oo.oo..', '.oooooo.', 'oeooeoot', 'oooooo.t', '.oooooot', '.o.o.o..'],
      {
        o: '#f0a45a',
        e: '#17122a',
        t: '#d9863a',
      },
    ),
    yarn: sprite(['.rrr.', 'rRrrr', 'rrRrr', 'rrrRr', '.rrr.'], { r: '#e85d9c', R: '#f59ac2' }),
    bowl: sprite(['.ffffff.', 'bbbbbbbb', '.bbbbbb.'], { f: '#c9884a', b: '#4a4fc4' }),
  };
}

const TOOLS: Array<{ kind: HelperKind; emoji: string }> = [
  { kind: 'post', emoji: '🪵' },
  { kind: 'yarn', emoji: '🧶' },
  { kind: 'kitten', emoji: '🐱' },
];

export function Defense({ look, seed, paused, onEnd }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useStage(canvas, W, { minH: 150, maxH: 200 });
  const game = useRef<State | null>(null);
  const ended = useRef(false);
  const sprites = useMemo(() => art(), []);
  const [armed, setArmed] = useState<HelperKind | null>(null);
  const [hud, setHud] = useState({ wave: 1, cheese: 3, food: START_FOOD, banner: '' });

  useEffect(() => {
    if (!stage) return;
    game.current ??= init(seed, stage.h);
    game.current.h = stage.h;
  }, [stage, seed]);

  const choose = (row: number, x?: number) => {
    const s = game.current;
    if (!s || paused || s.over) return;
    if (armed) {
      if (place(s, armed, row, x)) setArmed(null);
      else {
        sfx('bad');
        navigator.vibrate?.(30);
      }
    } else moveCat(s, row);
  };

  /** A tap on the kitchen: which shelf (and where on it) in world pixels. */
  const tapAt = (e: React.PointerEvent<HTMLDivElement>) => {
    const c = canvas.current;
    if (!c || !stage) return;
    const box = c.getBoundingClientRect();
    const dpr = c.width / box.width;
    const x = ((e.clientX - box.left) * dpr - stage.ox) / stage.scale;
    const y = ((e.clientY - box.top) * dpr - stage.oy) / stage.scale;
    choose(rowAt(stage.h, y), x);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = game.current;
      if (!s) return;
      const n = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (n >= 0) choose(n);
      if (e.code === 'ArrowUp') choose(Math.max(0, s.cat.row - 1));
      if (e.code === 'ArrowDown') choose(Math.min(ROWS - 1, s.cat.row + 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop(
    (dt) => {
      const s = game.current;
      if (!s) return;
      step(s, dt);
      for (const e of s.events) {
        if (e === 'swat') sfx('paw');
        else if (e === 'catch') sfx('catch');
        else if (e === 'bite') {
          sfx('bad');
          navigator.vibrate?.(20);
        } else if (e === 'place') sfx('place');
        else if (e === 'wave') sfx('coin');
        else if (e === 'win') sfx('win');
        else if (e === 'lose') sfx('lose');
      }
      const banner =
        s.phase === 'break' && !s.over
          ? `Волна ${s.cleared + 1} из ${WAVES}`
          : s.over
            ? s.won
              ? 'Кухня спасена'
              : 'Мыши добрались до корма'
            : '';
      const next = { wave: Math.min(WAVES, s.cleared + 1), cheese: s.cheese, food: s.food, banner };
      if (
        next.wave !== hud.wave ||
        next.cheese !== hud.cheese ||
        next.food !== hud.food ||
        next.banner !== hud.banner
      )
        setHud(next);
      if (s.over && !ended.current) {
        ended.current = true;
        onEnd(stats(s), s.t * 1000);
      }
    },
    () => {
      const s = game.current;
      const ctx = canvas.current?.getContext('2d');
      if (!s || !ctx || !stage) return;
      const h = stage.h;
      begin(ctx, stage, '#e8e1d2');
      // Kitchen wall tiles.
      px(ctx, 0, 0, W, h, '#f1ece0');
      for (let y = 0; y < h; y += 10)
        for (let x = (y / 10) % 2 ? 5 : 0; x < W; x += 10) px(ctx, x, y, 9, 9, '#f6f2e9');
      for (let r = 0; r < ROWS; r++) {
        const fy = rowY(h, r);
        const top = r === 0 ? 0 : rowY(h, r - 1) + 4;
        // The cat's shelf is lit; a shelf flashes red when a mouse reaches the bowl.
        if (r === s.cat.row && !armed) {
          ctx.globalAlpha = 0.08;
          px(ctx, 0, top, W, fy - top, '#f5b62e');
          ctx.globalAlpha = 1;
        }
        if (s.bitten[r]! < 0.4) {
          ctx.globalAlpha = 0.25 * (1 - s.bitten[r]! / 0.4);
          px(ctx, 0, top, W, fy - top, '#e2563a');
          ctx.globalAlpha = 1;
        }
        // Shelf board and the bowl at its left end.
        px(ctx, 0, fy, W, 2, '#b98552');
        px(ctx, 0, fy + 2, W, 2, '#8f623a');
        ctx.drawImage(sprites.bowl, 1, fy - 3);
        // Empty cells for helpers; with a helper chosen, the free ones are outlined.
        const free = armed && armed !== 'yarn' ? new Set(freeSlots(s, r)) : null;
        SLOTS.forEach((x, i) => {
          px(ctx, x - 4, fy - 1, 8, 1, '#d8c7a6');
          if (free?.has(i)) {
            ctx.globalAlpha = 0.18;
            px(ctx, x - 4, fy - 12, 8, 11, '#4a4fc4');
            ctx.globalAlpha = 1;
            ctx.strokeStyle = '#4a4fc4';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 4.5, fy - 12.5, 9, 12);
          }
        });
        if (armed === 'yarn') {
          ctx.globalAlpha = 0.6;
          for (const dx of [8, 13, 18]) px(ctx, CAT_X + dx, fy - 4, 3, 1, '#e85d9c');
          ctx.globalAlpha = 1;
        }
      }
      // Helpers.
      for (const hp of s.helpers) {
        const fy = rowY(h, hp.row);
        const x = SLOTS[hp.slot]!;
        if (hp.kind === 'post') {
          ctx.globalAlpha = 0.5 + 0.5 * Math.min(1, hp.hp / HELPERS.post.hp);
          ctx.drawImage(sprites.post, x - 4, fy - sprites.post.height);
          ctx.globalAlpha = 1;
        } else {
          const hop = hp.swipe < 0.2 ? -2 : 0;
          ctx.drawImage(sprites.kitten, x - 4, fy - sprites.kitten.height + hop);
        }
      }
      // Yarn balls.
      for (const y of s.yarns) {
        ctx.save();
        const fy = rowY(h, y.row);
        ctx.translate(Math.round(y.x), fy - 3);
        ctx.rotate(Math.floor(y.x / 3) * (Math.PI / 2));
        ctx.drawImage(sprites.yarn, -2.5, -2.5);
        ctx.restore();
      }
      // Mice.
      for (const m of s.mice) drawMouse(ctx, m, sprites, rowY(h, m.row), s.t);
      // The cat, leaping between rows in an arc.
      const c = s.cat;
      const k = Math.min(1, c.leap / 0.22);
      const y0 = rowY(h, c.from);
      const y1 = rowY(h, c.row);
      const footY = y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 10;
      const anim = k < 1 ? (y1 < y0 ? 'leapUp' : 'leapDown') : c.swipe < 0.25 ? 'bat' : 'watch';
      drawCat(ctx, look, anim, k < 1 ? 0 : c.swipe < 0.25 ? c.swipe : s.t, CAT_X, footY, 1);
      end(ctx);
    },
    !paused && Boolean(stage),
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center gap-3 px-4 pb-2 text-sm font-semibold tabular-nums">
        <span>
          Волна {hud.wave}/{WAVES}
        </span>
        <span className="flex flex-1 items-center gap-2">
          <span className="text-ink-soft font-medium">Корм</span>
          <span
            className="bg-line h-2 flex-1 overflow-hidden rounded-full"
            role="meter"
            aria-label="Корм в миске"
            aria-valuemin={0}
            aria-valuemax={START_FOOD}
            aria-valuenow={hud.food}
          >
            <span
              className={clsx(
                'block h-full origin-left rounded-full transition-transform',
                hud.food > 50 ? 'bg-mint' : hud.food > 20 ? 'bg-amber' : 'bg-tomato',
              )}
              style={{ transform: `scaleX(${hud.food / START_FOOD})` }}
            />
          </span>
        </span>
        <span>🧀 {hud.cheese}</span>
      </div>
      <div className="relative min-h-0 flex-1 touch-none select-none">
        <canvas
          ref={canvas}
          className="absolute inset-0"
          role="img"
          aria-label="Кухня с тремя полками: коснитесь полки, чтобы кот прыгнул туда"
        />
        {/* Taps map to the drawn shelves; the buttons are for keyboards and screen readers. */}
        <div
          className="absolute inset-0"
          onPointerDown={(e) => {
            e.preventDefault();
            tapAt(e);
          }}
        />
        <div className="sr-only">
          {Array.from({ length: ROWS }, (_, r) => (
            <button key={r} type="button" onClick={() => choose(r)}>
              {armed ? `Поставить на полку ${r + 1}` : `Кот на полку ${r + 1}`}
            </button>
          ))}
        </div>
        {hud.banner ? (
          <p
            aria-live="polite"
            className="bg-card/90 font-display pointer-events-none absolute inset-x-8 top-1/3 rounded-2xl py-3 text-center text-lg font-semibold"
          >
            {hud.banner}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-3 gap-2 px-3 pt-2 pb-2">
        {TOOLS.map((t) => {
          const cost = HELPERS[t.kind].cost;
          const can = hud.cheese >= cost;
          return (
            <button
              key={t.kind}
              type="button"
              disabled={!can && armed !== t.kind}
              aria-pressed={armed === t.kind}
              onClick={() => setArmed((a) => (a === t.kind ? null : t.kind))}
              className="bg-card shadow-card aria-pressed:bg-ink aria-pressed:text-paper flex min-h-14 flex-col items-center justify-center rounded-2xl text-xs font-semibold transition-[transform,background-color] active:scale-[0.97] disabled:opacity-45"
            >
              <span aria-hidden className="text-lg leading-none">
                {t.emoji}
              </span>
              {HELPERS[t.kind].label} · {cost}🧀
            </button>
          );
        })}
      </div>
      <p className="text-ink-soft px-4 pb-2 text-center text-xs">
        {armed === 'yarn'
          ? 'Коснись полки: клубок покатится по ней'
          : armed
            ? 'Коснись свободной клетки в рамке. Ещё раз на кнопку: отмена'
            : 'Касание полки: кот прыгает туда и ловит мышей сам'}
      </p>
    </div>
  );
}

function drawMouse(
  ctx: CanvasRenderingContext2D,
  m: Mouse,
  sprites: ReturnType<typeof art>,
  floorY: number,
  t: number,
) {
  const frames = sprites[m.kind];
  const img = frames[m.gnawing ? Math.floor(t * 6) % 2 : Math.floor(t * 10 + m.id) % 2]!;
  if (m.hp <= 0) ctx.globalAlpha = Math.max(0, 1 - m.hurt / 0.25);
  if (m.hurt < 0.12 && m.hp > 0) ctx.globalAlpha = 0.5;
  ctx.drawImage(
    img,
    Math.round(m.x - 3),
    floorY - img.height + (m.hp <= 0 ? -Math.round(m.hurt * 20) : 0),
  );
  ctx.globalAlpha = 1;
}
