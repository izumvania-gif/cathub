import { useEffect, useMemo, useRef } from 'react';
import { drawBackground, drawItems, layout, previewBox, type ItemKey } from './room';

/** A still thumbnail of one room item (with the window behind the plant), for the shop. */
export function ItemThumb({ item, height = 64 }: { item: ItemKey; height?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const l = useMemo(() => layout(180, item === 'plant' ? ['window', 'plant'] : [item]), [item]);
  const [x, y, w, h] = previewBox(l, item);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d')!;
    ctx.clearRect(0, 0, w, h);
    ctx.translate(-x, -y);
    const world = {
      night: false,
      time: 0,
      ballX: l.items.find((i) => i.key === 'ball')?.x ?? 0,
      wobble: 0,
      catInside: null,
      hiddenBlink: false,
    };
    drawBackground(ctx, l, world);
    drawItems(ctx, l, world);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [item, x, y, w, h, l]);
  // Fit the height; big items (the window) are scaled down a little, never below 1:1.
  const scale = Math.max(1, Math.min(height / h, 76 / w));
  return (
    <canvas
      ref={ref}
      width={w}
      height={h}
      aria-hidden
      className="rounded-xl"
      style={{ width: w * scale, height: h * scale, imageRendering: 'pixelated' }}
    />
  );
}
