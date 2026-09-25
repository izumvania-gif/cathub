import { useState } from 'react';
import { CatSprite } from './CatScene';
import { ACCESSORIES, COATS, EYES, PATTERNS, PRESETS, randomLook, type CatLook } from './look';

/** Presets plus fine-tuning of the pixel cat's look (profile, onboarding, /cat-lab). */
export function LookEditor({
  look,
  onChange,
  collapsible = false,
}: {
  look: CatLook;
  onChange: (look: CatLook) => void;
  /** Start with presets only and a "Настроить" button. */
  collapsible?: boolean;
}) {
  const [open, setOpen] = useState(!collapsible);
  const set = <K extends keyof CatLook>(k: K, v: CatLook[K]) => onChange({ ...look, [k]: v });
  return (
    <div>
      <fieldset>
        <legend className="text-ink-soft mb-2 text-sm font-medium">Пресеты</legend>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => onChange(p.look)}
              aria-pressed={JSON.stringify(look) === JSON.stringify(p.look)}
              className="bg-card aria-pressed:ring-ink flex flex-col items-center rounded-2xl pt-1 pb-2 text-xs aria-pressed:ring-2"
            >
              <CatSprite look={p.look} anim="sit" scale={2} />
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      {open ? (
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Select
            label="Окрас"
            value={look.coat}
            options={COATS}
            onChange={(v) => set('coat', v)}
          />
          <Select
            label="Рисунок"
            value={look.pattern}
            options={PATTERNS}
            onChange={(v) => set('pattern', v)}
          />
          <Select label="Глаза" value={look.eyes} options={EYES} onChange={(v) => set('eyes', v)} />
          <Select
            label="Аксессуар"
            value={look.accessory}
            options={ACCESSORIES}
            onChange={(v) => set('accessory', v)}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={look.fluffy}
              onChange={(e) => set('fluffy', e.target.checked)}
            />
            Пушистый
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={look.socks}
              onChange={(e) => set('socks', e.target.checked)}
            />
            В носочках
          </label>
          <button
            type="button"
            onClick={() => onChange(randomLook())}
            className="bg-ink text-paper col-span-2 min-h-11 rounded-2xl font-medium"
          >
            🎲 Случайный кот
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-ink-soft mt-3 text-sm underline underline-offset-4"
        >
          Настроить окрас, глаза, аксессуары
        </button>
      )}
    </div>
  );
}

function Select<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Record<T, string | { label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <label className="grid min-w-0 gap-1">
      <span className="text-ink-soft">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className="bg-card border-line min-h-11 w-full min-w-0 rounded-2xl border px-3"
      >
        {(Object.keys(options) as T[]).map((k) => {
          const o = options[k];
          return (
            <option key={k} value={k}>
              {typeof o === 'string' ? o : o.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}
