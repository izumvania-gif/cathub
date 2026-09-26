import { useEffect, useMemo, useRef, useState } from 'react';
import { begin, drawCat, end, px, sprite, useLoop, useStage } from '../engine';
import type { GameProps } from '../registry';
import { sfx } from '../sound';
import {
  BAND,
  init,
  multiplier,
  stats,
  step,
  swimBottom,
  tap,
  timeLeft,
  W,
  type Fish,
  type State,
} from './logic';

const FISH_COLORS = ['#f08a3c', '#4a9fe0', '#e85d9c', '#35a374'];

function fishSprites() {
  const body = (c: string) =>
    sprite(['...bbbb..t', '.bbbbbbbtt', 'bebbbbbbt.', '.bbbbbbbtt', '...bbbb..t'], {
      b: c,
      t: c,
      e: '#17122a',
    });
  return {
    fish: FISH_COLORS.map(body),
    gold: sprite(['...gggg..t', '.gggwggggt', 'geggggggt.', '.ggggggggt', '...gggg..t'], {
      g: '#f2c14e',
      w: '#fff1b8',
      t: '#c8902a',
      e: '#17122a',
    }),
    ruff: sprite(['.s.s.s.s..', '.rrrrrrr.t', 'rerrrrrrtt', '.rrrrrrr.t', '.s.s.s.s..'], {
      r: '#8a8fa6',
      s: '#4b4f7a',
      t: '#6b7089',
      e: '#17122a',
    }),
  };
}

export function Fishing({ look, seed, paused, onEnd }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useStage(canvas, W, { minH: 150, maxH: 210 });
  const game = useRef<State | null>(null);
  const [hud, setHud] = useState({ left: 45, score: 0, mult: 1 });
  const ended = useRef(false);
  const art = useMemo(() => fishSprites(), []);

  useEffect(() => {
    if (!stage) return;
    game.current ??= init(seed, stage.h);
    game.current.h = stage.h;
  }, [stage, seed]);

  const hit = () => {
    const s = game.current;
    if (!s || paused || s.over) return;
    const r = tap(s);
    if (r === 'tired') return;
    sfx(r === 'miss' ? 'miss' : r === 'ruff' ? 'bad' : r === 'gold' ? 'coin' : 'catch');
    if (r !== 'miss') navigator.vibrate?.(8);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'Enter') {
        e.preventDefault();
        hit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  useLoop(
    (dt) => {
      const s = game.current;
      if (!s) return;
      step(s, dt);
      const next = { left: Math.ceil(timeLeft(s)), score: s.score, mult: multiplier(s.streak) };
      if (next.left !== hud.left || next.score !== hud.score || next.mult !== hud.mult)
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
      begin(ctx, stage, '#8fc7de');
      // Water, light from above.
      for (let y = 0; y < h; y += 4) {
        const k = y / h;
        const r = Math.round(0xc9 - k * 0x3a);
        const g = Math.round(0xe9 - k * 0x2c);
        const b = Math.round(0xf4 - k * 0x18);
        px(ctx, 0, y, W, 4, `rgb(${r},${g},${b})`);
      }
      // Surface and sand.
      px(ctx, 0, 0, W, 3, '#e6f6fb');
      px(ctx, 0, h - 16, W, 16, '#e8d7a8');
      px(ctx, 0, h - 16, W, 1, '#d9c48f');
      // Weed swaying.
      for (const [x, tall] of [
        [6, 30],
        [13, 22],
        [80, 34],
        [87, 24],
      ] as const)
        for (let k = 0; k < tall; k += 2) {
          const sway = Math.round(Math.sin(s.t * 1.6 + k * 0.25 + x) * (k / tall) * 3);
          px(ctx, x + sway, h - 16 - k, 2, 2, k % 4 ? '#35a374' : '#2c8a61');
        }
      // Bubbles.
      for (let i = 0; i < 6; i++) {
        const y = h - 20 - (((s.t * 18 + i * 37) % (h - 20)) | 0);
        px(ctx, 22 + i * 10 + Math.round(Math.sin(s.t * 2 + i) * 2), y, 1, 1, '#f3fbfe');
      }
      // The paw band (dim while the paw rests after a miss).
      ctx.globalAlpha = s.tired > 0 ? 0.08 : 0.28;
      px(ctx, W / 2 - BAND, 3, BAND * 2, swimBottom(h) + 8, '#ffffff');
      ctx.globalAlpha = 1;
      px(ctx, W / 2 - BAND, 3, 1, swimBottom(h) + 8, '#ffffff');
      px(ctx, W / 2 + BAND - 1, 3, 1, swimBottom(h) + 8, '#ffffff');
      // Fish.
      for (const f of s.fish) drawFish(ctx, f, art, h);
      // The cat, reaching up with a paw after a tap.
      const swiping = s.paw < 0.3;
      drawCat(
        ctx,
        look,
        swiping ? 'bat' : s.tired > 0 ? 'grumpy' : 'watch',
        swiping ? s.paw : s.t,
        W / 2 - 8,
        h - 6,
        1,
      );
      // Score pops.
      ctx.font = 'bold 7px Onest, sans-serif';
      ctx.textAlign = 'center';
      for (const p of s.pops) {
        ctx.globalAlpha = 1 - p.t / 0.8;
        ctx.fillStyle = p.text.startsWith('+') ? '#1f7a53' : '#b93a20';
        ctx.fillText(p.text, p.x, p.y - p.t * 16);
      }
      ctx.globalAlpha = 1;
      end(ctx);
    },
    !paused && Boolean(stage),
  );

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center justify-between px-4 pb-2 text-sm font-semibold tabular-nums">
        <span aria-label={`Осталось ${hud.left} секунд`}>⏱ {hud.left}</span>
        <span>
          {hud.score}
          {hud.mult > 1 ? <span className="text-mint-ink"> ×{hud.mult}</span> : null}
        </span>
      </div>
      <div
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          hit();
        }}
      >
        <canvas
          ref={canvas}
          className="absolute inset-0"
          role="img"
          aria-label="Аквариум: коснитесь, когда рыбка в светлой полосе"
        />
      </div>
    </div>
  );
}

function drawFish(
  ctx: CanvasRenderingContext2D,
  f: Fish,
  art: ReturnType<typeof fishSprites>,
  h: number,
) {
  const img = f.kind === 'fish' ? art.fish[f.color]! : art[f.kind];
  let x = f.x - img.width / 2;
  let y = f.y - img.height / 2;
  if (f.caught !== null) {
    // Flies down to the paw and fades.
    const k = f.caught / 0.4;
    x += (W / 2 - f.x) * k;
    y += (h - 30 - f.y) * k;
    ctx.globalAlpha = 1 - k;
  } else y += Math.round(Math.sin(f.x * 0.2) * 1);
  ctx.save();
  if (f.vx > 0) {
    ctx.translate(Math.round(x) + img.width, Math.round(y));
    ctx.scale(-1, 1);
    ctx.drawImage(img, 0, 0);
  } else ctx.drawImage(img, Math.round(x), Math.round(y));
  ctx.restore();
  ctx.globalAlpha = 1;
}
