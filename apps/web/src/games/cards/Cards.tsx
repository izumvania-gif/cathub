import clsx from 'clsx';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CatSprite } from '../../cat/CatScene';
import { Button } from '../../components/ui';
import { sprite } from '../engine';
import type { GameProps } from '../registry';
import { sfx } from '../sound';
import {
  CARDS,
  canPlay,
  chooseRoom,
  endTurn,
  ENEMIES,
  intentOf,
  isBossRoom,
  leaveBox,
  newRun,
  playCard,
  RELICS,
  removeCard,
  rest,
  ROOM_INFO,
  ROOMS_PER_FLOOR,
  stats,
  takeReward,
  type CardKey,
  type EnemyKey,
  type Intent,
  type Run,
} from './logic';

const SAVE_KEY = 'cathub.cards.run';

function load(seed: number): Run {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) ?? 'null') as Run | null;
    if (saved && saved.version === 1 && saved.phase !== 'over') {
      // Saves from before cards had ids.
      if (saved.fight && !saved.fight.handIds) {
        saved.fight.handIds = saved.fight.hand.map((_, i) => i + 1);
        saved.nextCard = saved.fight.hand.length;
      }
      return saved;
    }
  } catch {
    /* broken save: start over */
  }
  return newRun(seed);
}

const ENEMY_ART: Record<EnemyKey, { rows: string[]; pal: Record<string, string> }> = {
  mouse: {
    rows: [
      '..pp........',
      '.pbbp.......',
      '.bbbbbb.....',
      'ebbbbbbbb.tt',
      'bbbbbbbbbt..',
      '.l.l..l.l...',
    ],
    pal: { b: '#a3a5b8', p: '#f2a7b8', e: '#17122a', t: '#f2a7b8', l: '#5a5d78' },
  },
  crow: {
    rows: [
      '...kkk......',
      '..kkekk.....',
      'yykkkkkk....',
      '..kkkkkkkk..',
      '...kkkkkkkkk',
      '....kkkkkk..',
      '.....y..y...',
    ],
    pal: { k: '#2b2d45', e: '#f5b62e', y: '#f5b62e' },
  },
  roach: {
    rows: [
      'a..........a',
      '.a........a.',
      '..bbbbbbbb..',
      '.bBbBbBbBbb.',
      'ebbbbbbbbbbb',
      '.l.l.l.l.l..',
    ],
    pal: { a: '#6b4a2e', b: '#8a5a32', B: '#a8703f', e: '#17122a', l: '#4a3220' },
  },
  rat: {
    rows: [
      '..pp..........',
      '.pbbp.........',
      '.bbbbbbb......',
      'ebbbbbbbbbb.tt',
      'bbbbbbbbbbbbt.',
      'bbbbbbbbbbb...',
      '.l.l...l.l....',
    ],
    pal: { b: '#6f6a78', p: '#e6a0b0', e: '#e2563a', t: '#e6a0b0', l: '#3c3a48' },
  },
  ratboss: {
    rows: [
      '..y.y.y.........',
      '..yyyyy.........',
      '..pbbbp.........',
      '.bbbbbbbb.......',
      'ebbbbbbbbbbbb.tt',
      'bbbbbbbbbbbbbbt.',
      'bbbbbbbbbbbbbb..',
      'bbbbbbbbbbbbb...',
      '.ll.ll...ll.ll..',
    ],
    pal: { b: '#5a5563', p: '#e6a0b0', e: '#e2563a', t: '#e6a0b0', l: '#2e2c38', y: '#f2c14e' },
  },
  vacuum: {
    rows: [
      '.....hhhh.......',
      '....h....h......',
      '..bbbbbbbbbbbb..',
      '.bbwwbbbbbbbbbb.',
      'bbbbbbbbbbbbbbbb',
      'brrrrrrrrrrrrrrb',
      'bbbbbbbbbbbbbbbn',
      'bbbbbbbbbbbbbbbn',
      '.bbbbbbbbbbbbbb.',
      '..kk........kk..',
    ],
    pal: { b: '#8a8fa6', w: '#c9cce0', r: '#e2563a', h: '#4b4f7a', n: '#4b4f7a', k: '#2b2d45' },
  },
  bath: {
    rows: [
      '..o.o.o..o.o....',
      '.ooooooooooooo..',
      'wwwwwwwwwwwwwwww',
      'wbbbbbbbbbbbbbbw',
      'wbbbbbbbbbbbbbbw',
      '.wwwwwwwwwwwwww.',
      '..w..........w..',
      '..g..........g..',
    ],
    pal: { o: '#ffffff', w: '#dfe3f0', b: '#8fc7de', g: '#c8902a' },
  },
};

function useEnemyImages() {
  return useMemo(
    () =>
      Object.fromEntries(
        (Object.keys(ENEMY_ART) as EnemyKey[]).map((k) => [
          k,
          sprite(ENEMY_ART[k].rows, ENEMY_ART[k].pal).toDataURL(),
        ]),
      ) as Record<EnemyKey, string>,
    [],
  );
}

function intentText(i: Intent) {
  switch (i.kind) {
    case 'atk':
      return {
        icon: '⚔️',
        text: i.times ? `${i.dmg}×${i.times}` : String(i.dmg),
        label: `атакует на ${i.dmg}${i.times ? ` ${i.times} раза` : ''}`,
      };
    case 'def':
      return {
        icon: '🛡️',
        text: `${i.block}${i.dmg ? ` + ⚔️${i.dmg}` : ''}`,
        label: `защищается на ${i.block}${i.dmg ? ` и бьёт на ${i.dmg}` : ''}`,
      };
    case 'buff':
      return { icon: '💪', text: `+${i.str}`, label: `становится сильнее на ${i.str}` };
    case 'weak':
      return { icon: '😵', text: String(i.turns), label: `ослабит тебя на ${i.turns} хода` };
  }
}

export function Cards({ look, seed, paused, onEnd }: GameProps) {
  const [run, setRun] = useState<Run>(() => load(seed));
  const images = useEnemyImages();
  const ended = useRef(false);
  const prev = useRef(run);
  const [catAnim, setCatAnim] = useState<'sit' | 'bat' | 'grumpy'>('sit');
  const calm = useRef<ReturnType<typeof setTimeout>>(undefined);
  const flash = (a: 'bat' | 'grumpy') => {
    setCatAnim(a);
    clearTimeout(calm.current);
    calm.current = setTimeout(() => setCatAnim('sit'), 400);
  };

  // Damage and healing numbers that float up from the cat and the enemy.
  const [floats, setFloats] = useState<Array<{ id: number; who: 'cat' | 'enemy'; text: string }>>(
    [],
  );
  const floatId = useRef(0);
  const float = (who: 'cat' | 'enemy', text: string) => {
    const id = ++floatId.current;
    setFloats((xs) => [...xs, { id, who, text }]);
    setTimeout(() => setFloats((xs) => xs.filter((x) => x.id !== id)), 900);
  };
  // A card slides under the finger after a play; ignore a second tap that lands too soon.
  const lock = useRef(0);

  const act = (fn: (r: Run) => void) =>
    setRun((r) => {
      const next = structuredClone(r);
      fn(next);
      return next;
    });

  // Time actually spent playing (for the server's believability check).
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') act((r) => void (r.activeMs += 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [paused]);

  // Save after every change; sounds for what happened.
  useEffect(() => {
    const p = prev.current;
    prev.current = run;
    if (run.hp < p.hp) {
      sfx('hit');
      navigator.vibrate?.(15);
      flash('grumpy');
      float('cat', `−${p.hp - run.hp}`);
    } else if (run.hp > p.hp && run.phase === 'fight') float('cat', `+${run.hp - p.hp}`);
    const e0 = p.fight?.enemy;
    const e1 = run.fight?.enemy;
    if (e0 && e1) {
      if (e1.hp < e0.hp) {
        sfx('paw');
        flash('bat');
        float('enemy', `−${e0.hp - e1.hp}`);
      } else if (e1.block < e0.block && run.fight!.turn === p.fight!.turn) {
        sfx('block');
        float('enemy', '🛡️');
      }
    }
    if (p.phase === 'fight' && run.phase === 'reward') sfx('win');
    try {
      if (run.phase === 'over') localStorage.removeItem(SAVE_KEY);
      else localStorage.setItem(SAVE_KEY, JSON.stringify(run));
    } catch {
      /* private mode */
    }
    if (run.phase === 'over' && !ended.current) {
      ended.current = true;
      sfx(run.won ? 'win' : 'lose');
      onEnd(stats(run), run.activeMs);
    }
  }, [run, onEnd]);

  const f = run.fight;
  const enemy = f?.enemy;
  const intent = enemy ? intentText(intentOf(enemy)) : null;
  const stuck = Boolean(f && f.hand.every((_, i) => !canPlay(run, i)));

  return (
    <div className="absolute inset-0 flex flex-col overflow-y-auto px-3 pb-3">
      <div className="flex items-center gap-3 pb-2 text-sm font-semibold tabular-nums">
        <span aria-label={`Здоровье ${run.hp} из ${run.maxHp}`}>
          ❤️ {run.hp}/{run.maxHp}
        </span>
        <span className="text-ink-soft flex-1 font-medium">
          Этаж {Math.min(3, run.floor + 1)} ·{' '}
          {isBossRoom(run) ? 'босс' : `комната ${run.room + 1}/${ROOMS_PER_FLOOR}`}
        </span>
        <span className="flex gap-0.5">
          {run.relics.map((k) => (
            <span
              key={k}
              title={`${RELICS[k].title}: ${RELICS[k].text}`}
              aria-label={RELICS[k].title}
            >
              {RELICS[k].emoji}
            </span>
          ))}
        </span>
      </div>

      {run.phase === 'fight' && f && enemy && intent ? (
        <div className="flex flex-1 flex-col">
          <section className="bg-card shadow-card rounded-3xl p-3" aria-label="Бой">
            <div className="flex items-end justify-between gap-2">
              <div className="relative flex flex-col items-center">
                <Floats list={floats.filter((x) => x.who === 'cat')} />
                <CatSprite look={look} anim={catAnim} scale={3} />
                <span className="text-xs font-semibold tabular-nums">
                  {f.block ? `🛡️ ${f.block}` : ' '}
                  {f.weak ? ' 😵' : ''}
                </span>
              </div>
              <div className="relative flex flex-col items-center">
                <Floats list={floats.filter((x) => x.who === 'enemy')} />
                <span
                  className="bg-tint mb-1 rounded-full px-2.5 py-1 text-sm font-bold tabular-nums"
                  aria-label={`Следующий ход: ${ENEMIES[enemy.key].title} ${intent.label}`}
                >
                  {intent.icon} {intent.text}
                </span>
                <motion.img
                  key={enemy.hp}
                  src={images[enemy.key]}
                  alt={ENEMIES[enemy.key].title}
                  className="h-auto [image-rendering:pixelated]"
                  style={{ width: ENEMY_ART[enemy.key].rows[0]!.length * 8 }}
                  animate={{ x: [0, -5, 4, -2, 0] }}
                  transition={{ duration: 0.3 }}
                />
                <span className="text-xs font-semibold">{ENEMIES[enemy.key].title}</span>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3 text-xs tabular-nums">
              <span>
                ⚡ {f.energy} энергии{f.str ? ` · 💪+${f.str}` : ''}
              </span>
              <span className="flex items-center gap-1.5">
                <span
                  className="bg-line h-2 flex-1 overflow-hidden rounded-full"
                  role="meter"
                  aria-label={`Здоровье врага: ${enemy.hp} из ${enemy.max}`}
                  aria-valuemin={0}
                  aria-valuemax={enemy.max}
                  aria-valuenow={enemy.hp}
                >
                  <span
                    className="bg-tomato block h-full origin-left rounded-full transition-transform duration-300"
                    style={{ transform: `scaleX(${enemy.hp / enemy.max})` }}
                  />
                </span>
                {enemy.hp}
                {enemy.block ? ` 🛡️${enemy.block}` : ''}
              </span>
            </div>
          </section>

          <ul className="mt-3 grid grid-cols-3 gap-2" aria-label="Карты в руке">
            <AnimatePresence initial={false}>
              {f.hand.map((c, i) => (
                <motion.li
                  key={f.handIds[i] ?? `${f.turn}-${i}`}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -24, scale: 0.9 }}
                >
                  <CardButton
                    card={c}
                    disabled={paused || !canPlay(run, i)}
                    onClick={() => {
                      const now = performance.now();
                      if (now < lock.current) return;
                      lock.current = now + 220;
                      const id = f.handIds[i];
                      sfx('card');
                      // Play by id: the hand may have changed since this render.
                      act((r) => {
                        const at = r.fight ? r.fight.handIds.indexOf(id!) : -1;
                        if (at >= 0) playCard(r, at);
                      });
                    }}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          <div className="mt-auto flex items-center gap-3 pt-3">
            <span className="text-ink-soft text-xs tabular-nums">
              Колода {f.draw.length} · сброс {f.discard.length}
            </span>
            <Button
              className={clsx('flex-1', stuck && 'ring-amber ring-4')}
              disabled={paused}
              onClick={() => {
                const now = performance.now();
                if (now < lock.current) return;
                lock.current = now + 300;
                act(endTurn);
              }}
            >
              {stuck ? 'Конец хода: больше нечем' : 'Конец хода'}
            </Button>
          </div>
        </div>
      ) : null}

      {run.phase === 'map' ? (
        <Panel
          title={
            isBossRoom(run)
              ? `Босс этажа: ${ENEMIES[['ratboss', 'vacuum', 'bath'][run.floor] as EnemyKey].title}`
              : 'Куда дальше?'
          }
        >
          <div className="grid gap-2">
            {run.choices.map((k, i) => (
              <button
                key={`${k}-${i}`}
                type="button"
                disabled={paused}
                onClick={() => act((r) => chooseRoom(r, i))}
                className="bg-tint hover:bg-line flex min-h-16 items-center gap-3 rounded-2xl px-4 text-left transition-colors active:scale-[0.99]"
              >
                <span aria-hidden className="text-3xl">
                  {isBossRoom(run) ? '👑' : ROOM_INFO[k].emoji}
                </span>
                <span>
                  <b className="block">{isBossRoom(run) ? 'В бой' : ROOM_INFO[k].title}</b>
                  <span className="text-ink-soft text-sm">{ROOM_INFO[k].text}</span>
                </span>
              </button>
            ))}
          </div>
          <p className="text-ink-soft mt-3 text-xs">В колоде {run.deck.length} карт.</p>
        </Panel>
      ) : null}

      {run.phase === 'reward' ? (
        <Panel
          title={
            run.found
              ? `Победа и находка: ${RELICS[run.found].emoji} ${RELICS[run.found].title}`
              : 'Победа. Возьми карту'
          }
        >
          {run.found ? (
            <p className="text-ink-soft mb-2 text-sm">{RELICS[run.found].text}</p>
          ) : null}
          <ul className="grid grid-cols-3 gap-2">
            {run.reward.map((c, i) => (
              <li key={c}>
                <CardButton card={c} onClick={() => act((r) => takeReward(r, i))} />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => act((r) => takeReward(r, null))}
            className="text-ink-soft mt-3 min-h-11 w-full text-sm font-semibold"
          >
            Пропустить
          </button>
        </Panel>
      ) : null}

      {run.phase === 'rest' ? (
        <Panel title="🛏️ Лежанка">
          <p className="text-ink-soft text-sm">Кот сворачивается клубком и отдыхает.</p>
          <Button className="mt-3 w-full" onClick={() => act(rest)}>
            Поспать: +{Math.round(run.maxHp * 0.3)} здоровья
          </Button>
        </Panel>
      ) : null}

      {run.phase === 'bowl' ? (
        <Panel title="🥣 Миска">
          <p className="text-ink-soft text-sm">
            Убери карту, которая мешает. Колода станет ровнее.
          </p>
          <ul className="mt-3 grid grid-cols-3 gap-2">
            {run.deck.map((c, i) => (
              <li key={`${c}-${i}`}>
                <CardButton card={c} onClick={() => act((r) => removeCard(r, i))} />
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => act((r) => removeCard(r, null))}
            className="text-ink-soft mt-3 min-h-11 w-full text-sm font-semibold"
          >
            Ничего не убирать
          </button>
        </Panel>
      ) : null}

      {run.phase === 'box' ? (
        <Panel title="📦 Коробка">
          {run.found ? (
            <p>
              <span aria-hidden className="text-2xl">
                {RELICS[run.found].emoji}
              </span>{' '}
              <b>{RELICS[run.found].title}</b>
              <span className="text-ink-soft block text-sm">{RELICS[run.found].text}</span>
            </p>
          ) : (
            <p className="text-ink-soft text-sm">Пусто, но кот размялся: +5 к здоровью.</p>
          )}
          <Button className="mt-3 w-full" onClick={() => act(leaveBox)}>
            Дальше
          </Button>
        </Panel>
      ) : null}
    </div>
  );
}

function Floats({ list }: { list: Array<{ id: number; text: string }> }) {
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-1/2 z-10 flex justify-center"
    >
      <AnimatePresence>
        {list.map((x) => (
          <motion.span
            key={x.id}
            className={clsx(
              'font-display absolute text-2xl font-bold [text-shadow:0_0_3px_var(--card),0_0_6px_var(--card)]',
              x.text.startsWith('+') ? 'text-mint-ink' : 'text-tomato-ink',
            )}
            initial={{ y: 0, opacity: 0, scale: 0.7 }}
            animate={{ y: -28, opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          >
            {x.text}
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="bg-card shadow-card rounded-3xl p-4">
      <h2 className="font-display mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function CardButton({
  card,
  disabled,
  onClick,
}: {
  card: CardKey;
  disabled?: boolean;
  onClick: () => void;
}) {
  const c = CARDS[card];
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${c.title}, ${c.cost} энергии: ${c.text}`}
      className={clsx(
        'flex min-h-28 w-full flex-col rounded-2xl border-2 p-2 text-left transition-[transform,opacity] active:scale-[0.97] disabled:opacity-45',
        c.kind === 'attack' ? 'border-tomato/40 bg-tomato/8' : 'border-data/40 bg-data/8',
      )}
    >
      <span className="flex items-start gap-1.5">
        <span className="bg-ink text-paper flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold">
          {c.cost}
        </span>
        <span className="text-sm leading-tight font-semibold">{c.title}</span>
      </span>
      <span className="text-ink-soft mt-1 text-xs leading-snug">{c.text}</span>
    </button>
  );
}
