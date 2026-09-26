import { useSyncExternalStore } from 'react';

/**
 * Game sounds, synthesized with WebAudio (no files to download). Off by default; the choice is
 * remembered per device. Everything is in C major so overlapping blips don't clash.
 */
const KEY = 'cathub.sound';
const listeners = new Set<() => void>();
let on = (() => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();
let ctx: AudioContext | null = null;

export function setSound(value: boolean) {
  on = value;
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* private mode */
  }
  if (value) audio(); // unlock inside the tap that turned it on
  listeners.forEach((l) => l());
}

export function useSound(): [boolean, (v: boolean) => void] {
  const value = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => on,
  );
  return [value, setSound];
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined' || !('AudioContext' in window)) return null;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

const NOTE = (n: number) => 440 * 2 ** ((n - 69) / 12); // MIDI note → Hz

function tone(
  midi: number,
  { at = 0, dur = 0.12, type = 'square' as OscillatorType, vol = 0.08, slide = 0 } = {},
) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(NOTE(midi), t);
  if (slide) osc.frequency.exponentialRampToValueAtTime(NOTE(midi + slide), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noise({ at = 0, dur = 0.08, vol = 0.06 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + at;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  const gain = a.createGain();
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  gain.gain.value = vol;
  src.buffer = buf;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start(t);
}

const SOUNDS = {
  jump: () => tone(72, { dur: 0.1, slide: 7, vol: 0.05 }),
  spring: () => tone(67, { dur: 0.22, slide: 17, vol: 0.06 }),
  coin: () => {
    tone(84, { dur: 0.06, vol: 0.05 });
    tone(91, { at: 0.06, dur: 0.12, vol: 0.05 });
  },
  hit: () => noise({ dur: 0.1, vol: 0.12 }),
  paw: () => {
    noise({ dur: 0.05, vol: 0.07 });
    tone(60, { dur: 0.06, type: 'triangle', vol: 0.08 });
  },
  catch: () => tone(76, { dur: 0.12, slide: 5, type: 'triangle', vol: 0.1 }),
  miss: () => tone(52, { dur: 0.16, slide: -3, type: 'triangle', vol: 0.08 }),
  card: () => tone(79, { dur: 0.05, type: 'triangle', vol: 0.06 }),
  block: () => tone(55, { dur: 0.12, type: 'triangle', vol: 0.1 }),
  place: () => tone(67, { dur: 0.08, type: 'triangle', vol: 0.08 }),
  bad: () => {
    tone(55, { dur: 0.12, vol: 0.05 });
    tone(50, { at: 0.1, dur: 0.18, vol: 0.05 });
  },
  win: () => [60, 64, 67, 72].forEach((n, i) => tone(n, { at: i * 0.09, dur: 0.18, vol: 0.06 })),
  lose: () =>
    [67, 64, 60, 55].forEach((n, i) =>
      tone(n, { at: i * 0.12, dur: 0.2, type: 'triangle', vol: 0.08 }),
    ),
} as const;

export type Sfx = keyof typeof SOUNDS;

export function sfx(name: Sfx) {
  if (on) SOUNDS[name]();
}
