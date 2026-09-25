import { useState } from 'react';
import { MOOD_LABELS, type Mood } from '../cat/behavior';
import { CatScene, CatSprite } from '../cat/CatScene';
import { LookEditor } from '../cat/LookEditor';
import { PRESETS, type CatLook } from '../cat/look';
import { ITEMS, type ItemKey } from '../cat/room';
import { ANIMS, type Anim } from '../cat/sprite';

/**
 * /cat-lab: every animation, coat and mood of the pixel cat on one screen, for agreeing on the
 * look before it goes into the app. Not linked from the UI.
 */
export function CatLab() {
  const [look, setLook] = useState<CatLook>(PRESETS[0]!.look);
  const [mood, setMood] = useState<Mood>('calm');
  const [bowl, setBowl] = useState(0.8);
  const [items, setItems] = useState<ItemKey[]>(Object.keys(ITEMS) as ItemKey[]);
  const [night, setNight] = useState(false);

  return (
    <main className="mx-auto max-w-lg px-4 pt-6 pb-16">
      <h1 className="font-display text-2xl font-bold">Кот-лаборатория</h1>
      <p className="text-ink-soft mt-1 text-sm">Как выглядит и ведёт себя пиксельный кот</p>

      <section className="mt-5 overflow-hidden rounded-3xl">
        <CatScene
          look={look}
          mood={mood}
          name="Кузя"
          bowlLevel={bowl}
          items={items}
          night={night}
        />
      </section>

      <fieldset className="mt-4">
        <legend className="text-ink-soft mb-2 text-sm font-medium">
          Комната <span className="font-normal">(в приложении — покупки за 🐟)</span>
        </legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(ITEMS) as ItemKey[]).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={items.includes(k)}
              title={ITEMS[k].does}
              onClick={() =>
                setItems((xs) => (xs.includes(k) ? xs.filter((x) => x !== k) : [...xs, k]))
              }
              className="bg-card aria-pressed:bg-ink aria-pressed:text-paper rounded-full px-3 py-1.5 text-sm"
            >
              {ITEMS[k].label}
              {ITEMS[k].price ? ` · ${ITEMS[k].price} 🐟` : ''}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={night}
            onClick={() => setNight((n) => !n)}
            className="bg-card aria-pressed:bg-ink aria-pressed:text-paper rounded-full px-3 py-1.5 text-sm"
          >
            🌙 Вечер
          </button>
        </div>
      </fieldset>

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

      <div className="mt-5">
        <LookEditor look={look} onChange={setLook} />
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
