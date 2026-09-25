import { useEffect, useMemo, useRef, useState } from 'react';
import {
  frameAt,
  initialState,
  MOOD_LABELS,
  react,
  replan,
  STILL,
  step,
  type CatState,
  type Mood,
} from './behavior';
import { framesFor } from './frames';
import type { CatLook } from './look';
import {
  drawBackground,
  drawBowlFood,
  drawFront,
  drawItems,
  FLOOR_Y,
  layout,
  ROOM_H,
  type ItemKey,
  type World,
} from './room';
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

/** Room width in sprite pixels: at least ~170 so everything fits, scaled by whole pixels. */
function fit(clientWidth: number) {
  const scale = Math.max(2, Math.floor(clientWidth / 170));
  return { scale, width: Math.floor(clientWidth / scale) };
}

/**
 * The cat's room: wall, window, floor, bought items and the cat moving about by mood.
 * Pauses when hidden or off screen; with reduced motion it shows one still pose.
 */
export function CatScene({
  look,
  mood,
  name,
  items,
  bowlLevel = 0,
  night = false,
  onTap,
}: {
  look: CatLook;
  mood: Mood;
  name: string;
  items: readonly ItemKey[];
  bowlLevel?: number;
  night?: boolean;
  onTap?: () => void;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const bubble = useRef<HTMLSpanElement>(null);
  const [size, setSize] = useState({ scale: 2, width: 0 });
  const state = useRef<CatState | null>(null);
  const moodRef = useRef(mood);
  const itemsKey = items.join(',');
  const room = useMemo(
    () =>
      size.width ? layout(size.width, itemsKey ? (itemsKey.split(',') as ItemKey[]) : []) : null,
    [size.width, itemsKey],
  );

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize(fit(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // A mood change (or a new room) interrupts whatever the cat was doing.
  useEffect(() => {
    moodRef.current = mood;
    if (state.current && room) state.current = replan(state.current, mood, room);
  }, [mood, room]);

  useEffect(() => {
    const c = canvas.current;
    if (!c || !room) return;
    const ctx = c.getContext('2d')!;
    const still = prefersReducedMotion();
    if (!state.current) state.current = replan(initialState(room), moodRef.current, room);
    const start = performance.now();

    const render = () => {
      const s = state.current!;
      const world: World = {
        night,
        time: still ? 0 : (performance.now() - start) / 1000,
        ballX: s.ball.x,
        wobble: s.wobble,
        catInside: s.spot?.inside || s.hidden ? s.spot!.kind : null,
        hiddenBlink: Math.floor(((performance.now() - start) / 1000) * 2) % 7 === 0,
      };
      drawBackground(ctx, room, world);
      drawItems(ctx, room, world);
      drawBowlFood(ctx, room, bowlLevel);
      const x = Math.round(s.x);
      const y = Math.round(s.y);
      if (!s.hidden) {
        const frames = framesFor(look, s.act);
        const f = still ? 0 : frameAt(s.act, s.t);
        ctx.save();
        if (s.dir < 0) {
          ctx.translate(x + FRAME_W, 0);
          ctx.scale(-1, 1);
        } else ctx.translate(x, 0);
        ctx.drawImage(frames[f % frames.length]!, 0, FLOOR_Y - FRAME_FLOOR - y);
        ctx.restore();
      }
      drawFront(ctx, room, world);
      const b = bubble.current;
      if (b) {
        const text = s.hidden ? null : s.bubble;
        b.textContent = text ?? '';
        b.style.opacity = text ? '1' : '0';
        const bx = (x + (s.dir > 0 ? 24 : 4)) * size.scale;
        const by = (FLOOR_Y - FRAME_FLOOR - y + 2) * size.scale - 20;
        b.style.transform = `translate(${bx}px, ${Math.max(0, by)}px)`;
      }
    };

    if (still) {
      state.current = { ...state.current, act: STILL[moodRef.current], hidden: false };
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
      if (acc < 1 / 12 || !visible || document.hidden) return; // ~12 fps suits pixel art
      state.current = step(state.current!, acc, moodRef.current, room);
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
  }, [room, look, bowlLevel, night, size.scale]);

  const tap = () => {
    onTap?.();
    if (!state.current || prefersReducedMotion()) return;
    state.current = react(state.current);
    navigator.vibrate?.(15);
  };

  return (
    <div
      ref={wrap}
      className="relative w-full overflow-hidden select-none"
      style={{ height: ROOM_H * size.scale }}
    >
      <button
        type="button"
        onClick={tap}
        className="block h-full w-full cursor-pointer"
        aria-label={`${name}: ${MOOD_LABELS[mood]}. Погладить`}
        data-mood={mood}
      >
        {room ? (
          <canvas
            ref={canvas}
            width={room.width}
            height={ROOM_H}
            className="mx-auto"
            style={{
              width: room.width * size.scale,
              height: ROOM_H * size.scale,
              imageRendering: 'pixelated',
            }}
          />
        ) : null}
      </button>
      <span
        ref={bubble}
        aria-hidden
        className="bg-card text-ink pointer-events-none absolute top-0 left-0 rounded-full px-2 py-0.5 text-xs font-semibold shadow-sm transition-opacity"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
