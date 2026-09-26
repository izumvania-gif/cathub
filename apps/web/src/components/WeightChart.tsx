import { motion } from 'motion/react';
import { useMemo, useRef, useState, type PointerEvent } from 'react';

export interface Point {
  at: Date;
  value: number;
  who?: string;
}

const W = 320;
const H = 150;
const PAD = { top: 12, right: 12, bottom: 22, left: 34 };

const fmtValue = (v: number) => v.toLocaleString('ru-RU', { maximumFractionDigits: 2 });

/** "Nice" step for 3–4 gridlines over the value range. */
function niceStep(range: number) {
  const raw = range / 3;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Single-series line chart over time (docs: dataviz skill — one axis, 2px line, ≥8px markers with
 * a surface ring, recessive grid, crosshair + tooltip on hover/touch). No legend: the card title
 * names the series.
 */
export function WeightChart({ points, unit, tz }: { points: Point[]; unit: string; tz: string }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [active, setActive] = useState<number | null>(null);

  const geo = useMemo(() => {
    const t0 = points[0]!.at.getTime();
    const t1 = Math.max(points.at(-1)!.at.getTime(), t0 + 86_400_000);
    const vals = points.map((p) => p.value);
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    if (hi - lo < 0.4) {
      const mid = (hi + lo) / 2;
      lo = mid - 0.2;
      hi = mid + 0.2;
    }
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;
    const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * (W - PAD.left - PAD.right);
    const y = (v: number) => PAD.top + (1 - (v - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
    const ticks: number[] = [];
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
    return { x, y, ticks, t0, t1 };
  }, [points]);

  const coords = points.map((p) => ({ cx: geo.x(p.at.getTime()), cy: geo.y(p.value) }));
  const path = coords
    .map((c, i) => `${i ? 'L' : 'M'}${c.cx.toFixed(1)},${c.cy.toFixed(1)}`)
    .join(' ');
  const dateFmt = new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'short',
    timeZone: tz,
  });
  const monthFmt = new Intl.DateTimeFormat('ru-RU', { month: 'short', timeZone: tz });

  const onMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = svgRef.current!.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0;
    for (let i = 1; i < coords.length; i++) {
      if (Math.abs(coords[i]!.cx - px) < Math.abs(coords[best]!.cx - px)) best = i;
    }
    setActive(best);
  };

  const a = active !== null ? points[active] : null;
  const ac = active !== null ? coords[active] : null;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="w-full touch-none select-none"
        role="img"
        aria-label={`График: ${unit}, ${points.length} измерений`}
      >
        {geo.ticks.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={geo.y(v)}
              y2={geo.y(v)}
              stroke="var(--line)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 6}
              y={geo.y(v) + 3.5}
              textAnchor="end"
              fontSize="10"
              fill="var(--ink-soft)"
            >
              {fmtValue(v)}
            </text>
          </g>
        ))}
        <text x={PAD.left} y={H - 6} fontSize="10" fill="var(--ink-soft)">
          {monthFmt.format(points[0]!.at)}
        </text>
        <text x={W - PAD.right} y={H - 6} fontSize="10" fill="var(--ink-soft)" textAnchor="end">
          {monthFmt.format(points.at(-1)!.at)}
        </text>
        {ac ? (
          <line
            x1={ac.cx}
            x2={ac.cx}
            y1={PAD.top}
            y2={H - PAD.bottom}
            stroke="var(--ink-soft)"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        ) : null}
        <motion.path
          d={path}
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          fill="none"
          stroke="var(--data)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {coords.map((c, i) => (
          <motion.circle
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 + (i / Math.max(1, coords.length - 1)) * 0.7, duration: 0.2 }}
            cx={c.cx}
            cy={c.cy}
            r={i === active ? 5.5 : 4}
            fill="var(--data)"
            stroke="var(--card)"
            strokeWidth="2"
          />
        ))}
        {/* hit area larger than the marks */}
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setActive(null)}
        />
      </svg>
      {a && ac ? (
        <div
          className="bg-ink text-paper pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-xl px-2.5 py-1.5 text-xs whitespace-nowrap shadow"
          style={{ left: `${(ac.cx / W) * 100}%`, top: `${(ac.cy / H) * 100}%`, marginTop: -10 }}
        >
          <span className="font-semibold">
            {fmtValue(a.value)} {unit}
          </span>
          <span className="text-paper/70"> · {dateFmt.format(a.at)}</span>
        </div>
      ) : null}
    </div>
  );
}
