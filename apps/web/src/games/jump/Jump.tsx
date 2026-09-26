import { Smartphone } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { begin, drawCat, end, px, sprite, useLoop, useStage } from '../engine';
import type { GameProps } from '../registry';
import { sfx } from '../sound';
import { climb, init, PLAT_W, score, stats, step, W, type Plat, type State } from './logic';

const TILT_KEY = 'cathub.tilt';

function art() {
  return {
    coin: sprite(['...oooo..t', '.oooooooot', 'oeoooooot.', '.oooooooot', '...oooo..t'], {
      o: '#f08a3c',
      t: '#f08a3c',
      e: '#17122a',
    }),
    nip: sprite(['..g.g..', '.ggggg.', 'gglgglg', '.ggggg.', '..gsg..', '...s...', '...s...'], {
      g: '#35a374',
      l: '#7fd4a8',
      s: '#2c8a61',
    }),
    vacuum: sprite(
      [
        '......hhh.......',
        '.....h...h......',
        '..bbbbbbbbbbb...',
        '.bbwbbbbbbbbbb..',
        'bbbbbbbbbbbbbbb.',
        'brrrrrrrrrrrrrb.',
        'bbbbbbbbbbbbbbbn',
        'bbbbbbbbbbbbbbbn',
        '.bbbbbbbbbbbbb..',
        '..kk.......kk...',
      ],
      { b: '#8a8fa6', w: '#c9cce0', r: '#e2563a', h: '#4b4f7a', n: '#4b4f7a', k: '#2b2d45' },
    ),
  };
}

const PLAT_COLORS: Record<Plat['kind'], [string, string, string]> = {
  shelf: ['#d19a62', '#a86e3e', '#7a4a28'],
  moving: ['#7fbde8', '#4a9fe0', '#2f78b8'],
  fragile: ['#ecd09a', '#d9b27a', '#b89160'],
};

function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, y: number) {
  const [top, mid, low] = PLAT_COLORS[p.kind];
  if (p.broken !== null) {
    // Two halves falling apart.
    const k = p.broken;
    const dy = k * k * 300;
    ctx.globalAlpha = Math.max(0, 1 - k / 0.6);
    px(ctx, p.x - k * 10, y + dy, PLAT_W / 2 - 1, 4, mid);
    px(ctx, p.x + PLAT_W / 2 + 1 + k * 10, y + dy, PLAT_W / 2 - 1, 4, mid);
    ctx.globalAlpha = 1;
    return;
  }
  px(ctx, p.x, y, PLAT_W, 1, top);
  px(ctx, p.x, y + 1, PLAT_W, 2, mid);
  px(ctx, p.x, y + 3, PLAT_W, 1, low);
  if (p.kind === 'shelf') {
    px(ctx, p.x + 3, y + 4, 2, 2, low);
    px(ctx, p.x + PLAT_W - 5, y + 4, 2, 2, low);
  } else if (p.kind === 'fragile') {
    px(ctx, p.x + PLAT_W / 2 - 2, y, 4, 4, '#f3e3b8'); // tape
    px(ctx, p.x + 6, y + 2, 1, 1, low);
    px(ctx, p.x + 19, y + 1, 1, 1, low);
  }
  if (p.cushion) {
    px(ctx, p.x + 5, y - 4, PLAT_W - 10, 4, '#e85d9c');
    px(ctx, p.x + 6, y - 5, PLAT_W - 12, 1, '#f59ac2');
    px(ctx, p.x + 7, y - 4, 3, 1, '#f59ac2');
  }
}

export function Jump({ look, seed, paused, onEnd }: GameProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useStage(canvas, W, { minH: 180, maxH: 260 });
  const game = useRef<State | null>(null);
  const ended = useRef(false);
  // Touch: the cat heads for the finger (world x per pointer). Keys and tilt steer directly.
  const input = useRef({ touch: new Map<number, number>(), keys: 0, tilt: 0 });
  const sprites = useMemo(() => art(), []);
  const [hud, setHud] = useState({ score: 0, climb: 0 });
  const [tilt, setTilt] = useState(() => {
    try {
      return localStorage.getItem(TILT_KEY) === '1';
    } catch {
      return false;
    }
  });
  const canTilt = typeof window !== 'undefined' && 'DeviceOrientationEvent' in window;

  useEffect(() => {
    if (!stage) return;
    game.current ??= init(seed, stage.h);
    game.current.h = stage.h;
  }, [stage, seed]);

  // Keyboard: arrows or A/D.
  useEffect(() => {
    const keys = new Set<string>();
    const sync = () => {
      input.current.keys =
        (keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0) -
        (keys.has('ArrowLeft') || keys.has('KeyA') ? 1 : 0);
    };
    const down = (e: KeyboardEvent) => {
      if (!['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) return;
      e.preventDefault();
      keys.add(e.code);
      sync();
    };
    const up = (e: KeyboardEvent) => {
      keys.delete(e.code);
      sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Tilt: the phone's left-right lean steers.
  useEffect(() => {
    if (!tilt) {
      input.current.tilt = 0;
      return;
    }
    // The way the phone is held when tilt is switched on counts as "straight".
    let base: number | null = null;
    const on = (e: DeviceOrientationEvent) => {
      const g = e.gamma ?? 0;
      base ??= g;
      const d = g - base;
      input.current.tilt =
        Math.abs(d) < 2 ? 0 : Math.max(-1, Math.min(1, (d - Math.sign(d) * 2) / 12));
    };
    window.addEventListener('deviceorientation', on);
    return () => window.removeEventListener('deviceorientation', on);
  }, [tilt]);

  const toggleTilt = async () => {
    const next = !tilt;
    if (next) {
      const ask = (
        DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> }
      ).requestPermission;
      if (ask && (await ask().catch(() => 'denied')) !== 'granted') return;
    }
    setTilt(next);
    try {
      localStorage.setItem(TILT_KEY, next ? '1' : '0');
    } catch {
      /* private mode */
    }
  };

  const steering = () => {
    const i = input.current;
    const s = game.current;
    let touch = 0;
    // The newest finger wins; the speed eases off as the cat gets under it (no overshoot).
    const finger = [...i.touch.values()].at(-1);
    if (finger !== undefined && s) touch = Math.max(-1, Math.min(1, (finger - s.x) / 10));
    return Math.max(-1, Math.min(1, touch + i.keys + i.tilt));
  };

  useLoop(
    (dt) => {
      const s = game.current;
      if (!s) return;
      step(s, dt, steering());
      for (const e of s.events)
        sfx(
          e === 'jump'
            ? 'jump'
            : e === 'spring'
              ? 'spring'
              : e === 'coin'
                ? 'coin'
                : e === 'nip'
                  ? 'win'
                  : e === 'stomp'
                    ? 'paw'
                    : e === 'break'
                      ? 'hit'
                      : 'lose',
        );
      const next = { score: score(s), climb: climb(s) };
      if (next.score !== hud.score) setHud(next);
      if (s.over && !ended.current) {
        ended.current = true;
        navigator.vibrate?.(30);
        onEnd(stats(s), s.t * 1000);
      }
    },
    () => {
      const s = game.current;
      const ctx = canvas.current?.getContext('2d');
      if (!s || !ctx || !stage) return;
      const h = stage.h;
      const cam = s.camY;
      begin(ctx, stage, '#e9dfcc');
      // Wallpaper with slow parallax stripes and a height mark every 250.
      px(ctx, 0, 0, W, h, '#f4ecdd');
      const off = Math.floor((-cam * 0.5) % 16);
      for (let x = 4; x < W; x += 16)
        for (let y = -16 + off; y < h; y += 16) px(ctx, x, y, 2, 8, '#ede1ca');
      ctx.font = 'bold 6px Onest, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#c9b89a';
      for (let m = Math.ceil(-(cam + h) / 250) * 250; m <= -cam; m += 250) {
        if (m <= 0) continue;
        const y = -m - cam;
        px(ctx, 0, y, 8, 1, '#c9b89a');
        ctx.fillText(String(m / 10), 2, y - 2);
      }
      for (const p of s.plats) drawPlat(ctx, p, p.y - cam);
      for (const th of s.things) {
        if (th.gone) continue;
        const img = sprites[th.kind];
        const bob = th.kind === 'coin' ? Math.round(Math.sin(s.t * 4 + th.id) * 1) : 0;
        ctx.save();
        if (th.kind === 'vacuum' && th.vx > 0) {
          ctx.translate(Math.round(th.x + img.width / 2), Math.round(th.y - cam - img.height));
          ctx.scale(-1, 1);
          ctx.drawImage(img, 0, 0);
        } else
          ctx.drawImage(
            img,
            Math.round(th.x - img.width / 2),
            Math.round(th.y - cam - img.height + bob),
          );
        ctx.restore();
      }
      // The cat (also drawn across the edge when it wraps).
      const anim = s.nip > 0 ? 'happy' : s.vy < 0 ? 'leapUp' : 'leapDown';
      for (const dx of [-W, 0, W]) drawCat(ctx, look, anim, s.t, s.x + dx, s.y - cam, s.dir);
      if (s.nip > 0)
        for (let i = 0; i < 3; i++)
          px(ctx, s.x - 6 + i * 6, s.y - cam + 2 + ((s.t * 40 + i * 5) % 8), 2, 2, '#7fd4a8');
      // Where the finger is steering to.
      const finger = [...input.current.touch.values()].at(-1);
      if (finger !== undefined) {
        ctx.globalAlpha = 0.5;
        px(ctx, finger - 3, h - 4, 7, 1, '#23264f');
        px(ctx, finger - 2, h - 5, 5, 1, '#23264f');
        px(ctx, finger - 1, h - 6, 3, 1, '#23264f');
        px(ctx, finger, h - 7, 1, 1, '#23264f');
        ctx.globalAlpha = 1;
      }
      end(ctx);
    },
    !paused && Boolean(stage),
  );

  const touch = (e: React.PointerEvent<HTMLDivElement>, on: boolean) => {
    if (!on || !stage) return void input.current.touch.delete(e.pointerId);
    const box = e.currentTarget.getBoundingClientRect();
    const dpr = e.currentTarget.querySelector('canvas')!.width / box.width;
    const x = ((e.clientX - box.left) * dpr - stage.ox) / stage.scale;
    input.current.touch.set(e.pointerId, Math.max(0, Math.min(W, x)));
  };

  return (
    <div className="absolute inset-0 flex flex-col">
      <div className="flex items-center justify-between px-4 pb-2 text-sm font-semibold tabular-nums">
        <span>⬆ {Math.floor(hud.climb / 10)}</span>
        {canTilt ? (
          <button
            type="button"
            onClick={() => void toggleTilt()}
            aria-pressed={tilt}
            className="bg-tint aria-pressed:bg-ink aria-pressed:text-paper flex min-h-9 items-center gap-1 rounded-full px-3 text-xs"
          >
            <Smartphone className="size-4" /> Наклон
          </button>
        ) : null}
        <span>{hud.score}</span>
      </div>
      <div
        className="relative min-h-0 flex-1 touch-none select-none"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          touch(e, true);
        }}
        onPointerMove={(e) => input.current.touch.has(e.pointerId) && touch(e, true)}
        onPointerUp={(e) => touch(e, false)}
        onPointerCancel={(e) => touch(e, false)}
      >
        <canvas
          ref={canvas}
          className="absolute inset-0"
          role="img"
          aria-label="Кот прыгает по полкам: держите палец слева или справа, или стрелки"
        />
      </div>
    </div>
  );
}
