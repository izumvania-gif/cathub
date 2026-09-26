import {
  ACCESSORY_LABELS,
  ACHIEVEMENT_INFO,
  GAME_INFO,
  GAME_RULES,
  type GameKey,
} from '@cathub/core';
import { Pause, Play as PlayIcon, Volume2, VolumeX, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { Link, Redirect } from 'wouter';
import { CatSprite } from '../cat/CatScene';
import { CatLoader } from '../cat/CatLoader';
import { Button } from '../components/ui';
import { GAME_COMPONENTS, HOW_TO } from '../games/registry';
import { sfx, useSound } from '../games/sound';
import { useCatLook } from '../lib/catLook';
import { useFinishGame, useGameFishLeft, useGameRecords, type FinishResult } from '../lib/games';
import { useUser } from '../lib/auth';
import { errorMessage } from '../lib/pb';

/** ready: a 3-2-1 before real-time games; ending: a beat to see how the run ended. */
type Phase = 'intro' | 'ready' | 'play' | 'ending' | 'result';

const isGame = (k: string): k is GameKey => k in GAME_INFO;

export function Play({ game }: { game: string }) {
  if (!isGame(game)) return <Redirect to="/games" />;
  return <PlayGame game={game} />;
}

function PlayGame({ game }: { game: GameKey }) {
  const info = GAME_INFO[game];
  const look = useCatLook();
  const me = useUser();
  const records = useGameRecords();
  const fishLeft = useGameFishLeft();
  const finish = useFinishGame();
  const [sound, setSound] = useSound();
  const [phase, setPhase] = useState<Phase>('intro');
  const [seed, setSeed] = useState(() => Date.now() % 1_000_000);
  const [paused, setPaused] = useState(false);
  const [count, setCount] = useState(3);
  const [score, setScore] = useState(0);
  const [result, setResult] = useState<FinishResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const best = records.data?.find((r) => r.user === me?.id && r.game === game)?.best ?? 0;
  const Game = GAME_COMPONENTS[game];

  // Leaving the app mid-game pauses it.
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && setPaused(true);
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const start = () => {
    setSeed(Date.now() % 1_000_000);
    setResult(null);
    setError(null);
    setPaused(false);
    setCount(3);
    // Turn-based cards need no countdown.
    setPhase(game === 'cards' ? 'play' : 'ready');
  };

  // 3, 2, 1, go.
  useEffect(() => {
    if (phase !== 'ready') return;
    const t = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1);
        sfx('card');
      } else {
        setPhase('play');
        sfx('coin');
      }
    }, 550);
    return () => clearTimeout(t);
  }, [phase, count]);

  // Escape or P pauses a running game.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (phase === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase]);

  const onEnd = useCallback(
    (stats: Record<string, number>, activeMs: number) => {
      // Let the last moment sink in before the result card.
      setPhase('ending');
      setTimeout(() => setPhase((p) => (p === 'ending' ? 'result' : p)), 900);
      setScore(Math.round(stats.score ?? 0));
      finish(game, stats, activeMs)
        .then((r) => {
          setResult(r);
          if (r.record || r.achievements.length) sfx('win');
        })
        .catch((err) => setError(errorMessage(err)));
    },
    [finish, game],
  );

  return (
    <div
      className="bg-paper fixed inset-0 z-50 flex flex-col overscroll-none select-none [-webkit-touch-callout:none]"
      role="dialog"
      aria-label={info.title}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="flex items-center gap-1 px-2 pt-[max(env(safe-area-inset-top),0.5rem)] pb-1">
        <Link
          href="/games"
          aria-label="Выйти из игры"
          className="hover:bg-tint flex size-11 items-center justify-center rounded-full"
        >
          <X />
        </Link>
        <h1 className="font-display flex-1 truncate text-lg font-semibold">{info.title}</h1>
        {phase === 'play' && best > 0 ? (
          <span className="text-ink-soft px-1 text-sm whitespace-nowrap tabular-nums">
            🏆 {best}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => setSound(!sound)}
          aria-pressed={sound}
          aria-label="Звук"
          className="hover:bg-tint flex size-11 items-center justify-center rounded-full"
        >
          {sound ? <Volume2 /> : <VolumeX />}
        </button>
        {phase === 'play' ? (
          <button
            type="button"
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Продолжить' : 'Пауза'}
            className="hover:bg-tint flex size-11 items-center justify-center rounded-full"
          >
            {paused ? <PlayIcon /> : <Pause />}
          </button>
        ) : null}
      </header>

      <main className="relative min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        {phase !== 'intro' ? (
          <Suspense fallback={<CatLoader className="pt-24" />}>
            <Game
              key={seed}
              look={look}
              seed={seed}
              paused={paused || phase !== 'play'}
              onEnd={onEnd}
            />
          </Suspense>
        ) : null}

        <AnimatePresence>
          {phase === 'intro' ? (
            <Overlay key="intro">
              <div className="flex justify-center">
                <CatSprite look={look} anim="happy" scale={4} />
              </div>
              <p className="font-display mt-2 text-center text-xl font-semibold">{info.title}</p>
              <ul className="text-ink-soft mt-3 grid gap-1.5 text-sm">
                {HOW_TO[game].map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <p className="mt-4 text-center text-sm">
                {best > 0 ? (
                  <>
                    Твой рекорд: <b className="tabular-nums">{best}</b>.{' '}
                  </>
                ) : null}
                {fishLeft.left > 0
                  ? `Сегодня игры ещё дадут до ${fishLeft.left} 🐟.`
                  : 'Рыбки за игры на сегодня собраны, играем на рекорд.'}
              </p>
              <Button className="mt-4 w-full" onClick={start} autoFocus>
                Играть
              </Button>
            </Overlay>
          ) : null}

          {phase === 'ready' ? (
            <motion.div
              key="ready"
              className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              aria-live="assertive"
            >
              <motion.span
                key={count}
                className="bg-card shadow-lift font-display flex size-28 items-center justify-center rounded-full text-6xl font-semibold"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 500, damping: 26 }}
              >
                {count}
              </motion.span>
            </motion.div>
          ) : null}

          {phase === 'play' && paused ? (
            <Overlay key="pause">
              <p className="font-display text-center text-xl font-semibold">Пауза</p>
              <Button className="mt-4 w-full" onClick={() => setPaused(false)} autoFocus>
                Продолжить
              </Button>
              <Link
                href="/games"
                className="text-ink-soft mt-2 flex min-h-11 items-center justify-center text-sm font-semibold"
              >
                Выйти
              </Link>
            </Overlay>
          ) : null}

          {phase === 'result' ? (
            <Overlay key="result">
              <p className="text-ink-soft text-center text-sm">Итог</p>
              <p className="font-display text-center text-4xl font-semibold tabular-nums">
                {score}
              </p>
              {result?.record ? (
                <p className="text-mint-ink mt-1 text-center font-semibold">Новый рекорд</p>
              ) : null}
              <p className="mt-3 text-center">
                {error ? (
                  <span className="text-tomato-ink">{error}</span>
                ) : !result ? (
                  <span className="text-ink-soft">Считаем рыбок…</span>
                ) : result.fish > 0 ? (
                  <b>+{result.fish} 🐟 в копилку</b>
                ) : !result.counted ? (
                  <span className="text-ink-soft">Слишком короткая партия для рыбок.</span>
                ) : result.capped ? (
                  <span className="text-ink-soft">
                    Лимит на сегодня: {GAME_RULES.dailyCap} 🐟 из игр. Это была игра на рекорд.
                  </span>
                ) : (
                  <span className="text-ink-soft">Рыбки начинаются с чуть большего счёта.</span>
                )}
              </p>
              {result?.achievements.length ? (
                <ul className="mt-4 grid gap-2">
                  {result.achievements.map((a) => (
                    <li key={a.key} className="bg-tint flex items-center gap-3 rounded-2xl p-3">
                      {a.accessory ? (
                        <CatSprite
                          look={{ ...look, accessory: a.accessory }}
                          anim="sit"
                          scale={2}
                        />
                      ) : (
                        <span className="text-2xl">🏅</span>
                      )}
                      <span className="min-w-0 text-sm">
                        <b className="block">{ACHIEVEMENT_INFO[a.key]?.title}</b>
                        {a.accessory
                          ? `Новая награда: ${ACCESSORY_LABELS[a.accessory]}. Надень её коту в «Доме».`
                          : `+${a.fish} 🐟`}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <Button className="mt-5 w-full" onClick={start} autoFocus>
                Ещё раз
              </Button>
              <Link
                href="/games"
                className="text-ink-soft mt-2 flex min-h-11 items-center justify-center text-sm font-semibold"
              >
                К играм
              </Link>
            </Overlay>
          ) : null}
        </AnimatePresence>
      </main>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      className="absolute inset-0 z-10 flex items-center justify-center bg-[rgb(var(--shadow-rgb)/0.35)] p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-card shadow-lift max-h-full w-full max-w-sm overflow-y-auto rounded-[2rem] p-5"
        initial={{ y: 16, scale: 0.97 }}
        animate={{ y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
