import { useState } from 'react';
import { MOOD_LABELS, type Mood } from '../cat/behavior';
import { CatScene, CatSprite } from '../cat/CatScene';
import { ACCESSORIES, COATS, EYES, PATTERNS, PRESETS, randomLook, type CatLook } from '../cat/look';
import { ANIMS, type Anim } from '../cat/sprite';

/**
 * /cat-lab: every animation, coat and mood of the pixel cat on one screen, for agreeing on the
 * look before it goes into the app. Not linked from the UI.
 */
export function CatLab() {
  const [look, setLook] = useState<CatLook>(PRESETS[0]!.look);
  const [mood, setMood] = useState<Mood>('calm');
  const [bowl, setBowl] = useState(0.8);
  const set = <K extends keyof CatLook>(k: K, v: CatLook[K]) => setLook((l) => ({ ...l, [k]: v }));

  return (
    <main className="mx-auto max-w-lg px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl font-bold">Кот-лаборатория</h1>
      <p className="text-ink-soft mt-1 text-sm">Как выглядит и ведёт себя пиксельный кот</p>

      <section className="bg-card mt-5 overflow-hidden rounded-3xl pt-4">
        <CatScene look={look} mood={mood} name="Кузя" bowlLevel={bowl} />
      </section>

      <fieldset className="mt-4">
        <legend className="text-ink-soft mb-2 text-sm font-medium">Настроение</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(MOOD_LABELS) as Mood[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mood === m}
              onClick={() => {
                setMood(m);
                setBowl(m === 'hungry' ? 0 : m === 'fed' ? 1 : 0.5);
              }}
              className="bg-card aria-pressed:bg-ink aria-pressed:text-paper rounded-full px-3 py-1.5 text-sm"
            >
              {MOOD_LABELS[m]}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-5">
        <legend className="text-ink-soft mb-2 text-sm font-medium">Пресеты</legend>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setLook(p.look)}
              aria-pressed={JSON.stringify(look) === JSON.stringify(p.look)}
              className="bg-card aria-pressed:ring-ink flex flex-col items-center rounded-2xl pt-1 pb-2 text-xs aria-pressed:ring-2"
            >
              <CatSprite look={p.look} anim="sit" scale={2} />
              {p.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Select label="Окрас" value={look.coat} options={COATS} onChange={(v) => set('coat', v)} />
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
          onClick={() => setLook(randomLook())}
          className="bg-ink text-paper col-span-2 min-h-11 rounded-2xl font-medium"
        >
          🎲 Случайный кот
        </button>
      </div>

      <h2 className="mt-8 font-medium">Все анимации</h2>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {(Object.keys(ANIMS) as Anim[]).map((a) => (
          <figure key={a} className="bg-card flex flex-col items-center rounded-2xl pb-2">
            <CatSprite look={look} anim={a} scale={2} />
            <figcaption className="text-ink-soft text-xs">{ANIMS[a].label}</figcaption>
          </figure>
        ))}
      </div>
    </main>
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
