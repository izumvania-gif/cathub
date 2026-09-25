import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BUBBLES,
  frameAt,
  initialState,
  MOOD_LABELS,
  nextAct,
  STILL,
  step,
  type CatState,
  type Mood,
  type Scene,
} from './behavior';
import { framesFor } from './frames';
import type { CatLook } from './look';
import { ANIMS, FRAME_FLOOR, FRAME_H, FRAME_W, type Anim } from './sprite';

function prefersReducedMotion() {
  return (
    typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/** A single animation in place (the loader, the lab). */
export function CatSprite({
  look,
  anim,
  scale = 3,
  flip = false,
  className,
  label,
}: {
  look: CatLook;
  anim: Anim;
  scale?: number;
  flip?: boolean;
  className?: string;
  label?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const frames = framesFor(look, anim);
    const draw = (i: number) => {
      ctx.clearRect(0, 0, FRAME_W, FRAME_H);
      ctx.save();
      if (flip) {
        ctx.translate(FRAME_W, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(frames[i % frames.length]!, 0, 0);
      ctx.restore();
    };
    if (prefersReducedMotion()) {
      draw(0);
      return;
    }
    let i = 0;
    draw(0);
    const id = setInterval(() => draw(++i), 1000 / ANIMS[anim].fps);
    return () => clearInterval(id);
  }, [look, anim, flip]);
  return (
    <canvas
      ref={ref}
      width={FRAME_W}
      height={FRAME_H}
      className={className}
      style={{ width: FRAME_W * scale, height: FRAME_H * scale, imageRendering: 'pixelated' }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

const ROOM_H = 38;
const FLOOR_Y = 33;

function drawBowl(ctx: CanvasRenderingContext2D, x: number, level: number) {
  // 12×5 bowl, seen from the side, with food heaped by level.
  const y = FLOOR_Y - 5;
  ctx.fillStyle = '#2b2d5c';
  ctx.fillRect(x + 1, y + 1, 10, 4);
  ctx.fillRect(x, y + 1, 12, 1);
  ctx.fillStyle = '#4a4fc4';
  ctx.fillRect(x + 2, y + 2, 8, 2);
  if (level > 0.05) {
    ctx.fillStyle = '#f5b62e';
    const h = level > 0.6 ? 2 : 1;
    ctx.fillRect(x + 2, y + 1 - h, 8, h);
    ctx.fillStyle = '#c98a14';
    ctx.fillRect(x + 4, y + 1 - h, 1, 1);
    ctx.fillRect(x + 7, y + 1 - h, 1, 1);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, x: number) {
  ctx.fillStyle = '#e2563a';
  ctx.fillRect(x, FLOOR_Y - 3, 3, 3);
  ctx.fillRect(x - 1, FLOOR_Y - 2, 5, 1);
  ctx.fillStyle = '#f2a58f';
  ctx.fillRect(x + 1, FLOOR_Y - 3, 1, 1);
}

/**
 * The cat's room: a strip with a floor and a bowl, the cat walking about and behaving by mood.
 * Pauses when hidden or off screen; with reduced motion it shows one still pose.
 */
export function CatScene({
  look,
  mood,
  name,
  bowlLevel = 0,
  scale = 3,
  onTap,
}: {
  look: CatLook;
  mood: Mood;
  name: string;
  bowlLevel?: number;
  scale?: number;
  onTap?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [width, setWidth] = useState(0);
  const state = useRef<CatState | null>(null);
  const moodRef = useRef(mood);

  const scene: Scene | null = useMemo(
    () =>
      width ? { width, bowlX: Math.max(0, width - 14 - 36), bedX: Math.min(4, width - 40) } : null,
    [width],
  );

  // Room width follows the container, in whole sprite pixels.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.floor(el.clientWidth / scale)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [scale]);

  // A mood change interrupts whatever the cat was doing.
  useEffect(() => {
    moodRef.current = mood;
    if (state.current && scene)
      state.current = nextAct({ ...state.current, ate: false }, mood, scene);
  }, [mood, scene]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !scene) return;
    const ctx = c.getContext('2d')!;
    const still = prefersReducedMotion();
    if (!state.current) state.current = initialState(scene);

    const render = () => {
      const s = state.current!;
      ctx.clearRect(0, 0, scene.width, ROOM_H);
      ctx.fillStyle = 'rgba(35,38,79,0.08)';
      ctx.fillRect(0, FLOOR_Y, scene.width, ROOM_H - FLOOR_Y);
      drawBowl(ctx, scene.bowlX + 36, bowlLevel);
      const act = s.act;
      const frames = framesFor(look, act);
      const f = still ? 0 : frameAt(act, s.t);
      const x = Math.round(s.x);
      if (act === 'play') drawBall(ctx, s.dir > 0 ? x + 36 : x + 1);
      ctx.save();
      if (s.dir < 0) {
        ctx.translate(x + FRAME_W, 0);
        ctx.scale(-1, 1);
      } else ctx.translate(x, 0);
      ctx.drawImage(frames[f % frames.length]!, 0, FLOOR_Y - FRAME_FLOOR);
      ctx.restore();
      const b = bubble.current;
      if (b) {
        const text = s.bubble;
        b.textContent = text ?? '';
        b.style.opacity = text ? '1' : '0';
        b.style.transform = `translateX(${(x + (s.dir > 0 ? 26 : 2)) * scale}px)`;
      }
    };

    if (still) {
      state.current = {
        ...state.current,
        act: STILL[moodRef.current],
        x: Math.round((scene.width - 40) / 2),
      };
      render();
      return;
    }

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let visible = true;
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, (now - last) / 1000);
      last = now;
      acc += dt;
      if (acc < 1 / 12 || !visible || document.hidden) return; // ~12 fps is plenty for pixel art
      state.current = step(state.current!, acc, moodRef.current, scene);
      acc = 0;
      render();
    };
    const io = new IntersectionObserver(([e]) => (visible = !!e?.isIntersecting));
    io.observe(c);
    raf = requestAnimationFrame(tick);
    render();
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
    };
  }, [scene, look, bowlLevel, scale]);

  const tap = () => {
    onTap?.();
    if (!state.current || prefersReducedMotion()) return;
    const s = state.current;
    const reaction: Anim = s.act === 'sleep' ? 'stretch' : Math.random() < 0.6 ? 'happy' : 'meow';
    state.current = {
      ...s,
      act: reaction,
      t: 0,
      dur: 2.2,
      targetX: null,
      bubble: BUBBLES[reaction] ?? null,
    };
    navigator.vibrate?.(15);
  };

  return (
    <div ref={wrap} className="relative w-full select-none" style={{ height: ROOM_H * scale }}>
      <span
        ref={bubble}
        aria-hidden
        className="bg-card text-ink pointer-events-none absolute top-0 left-0 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm transition-opacity"
        style={{ opacity: 0 }}
      />
      <button
        type="button"
        onClick={tap}
        className="block h-full w-full cursor-pointer"
        aria-label={`${name}: ${MOOD_LABELS[mood]}. Погладить`}
        data-mood={mood}
      >
        {scene ? (
          <canvas
            ref={canvas}
            width={scene.width}
            height={ROOM_H}
            style={{
              width: scene.width * scale,
              height: ROOM_H * scale,
              imageRendering: 'pixelated',
            }}
          />
        ) : null}
      </button>
    </div>
  );
}
