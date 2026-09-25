import { describe, expect, it } from 'vitest';
import { frameAt, initialState, step, type CatState, type Mood, type Scene } from './behavior';
import { normalizeLook, PRESETS, randomLook } from './look';
import { ANIMS, FRAME_H, FRAME_W, poseAt, renderFrame, type Anim } from './sprite';

/** Deterministic random for replaying behaviour. */
function seeded(seed = 1) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
}

describe('sprite', () => {
  it('every frame of every animation fits the frame with a margin and is not empty', () => {
    for (const p of PRESETS) {
      for (const a of Object.keys(ANIMS) as Anim[]) {
        for (let i = 0; i < ANIMS[a].frames; i++) {
          const px = renderFrame(poseAt(a, i), p.look);
          let filled = 0;
          for (let y = 0; y < FRAME_H; y++)
            for (let x = 0; x < FRAME_W; x++) {
              if (!px[(y * FRAME_W + x) * 4 + 3]) continue;
              filled++;
              // Nothing touches the frame edges (the cat would look cut off).
              expect(x > 0 && x < FRAME_W - 1 && y > 0, `${p.key} ${a}#${i} at ${x},${y}`).toBe(
                true,
              );
            }
          expect(filled).toBeGreaterThan(150);
        }
      }
    }
  });

  it('any random look renders', () => {
    const rand = seeded(7);
    for (let i = 0; i < 30; i++)
      expect(renderFrame(poseAt('walk', i), randomLook(rand)).length).toBe(FRAME_W * FRAME_H * 4);
  });

  it('normalizes stored looks', () => {
    expect(normalizeLook(null)).toEqual(PRESETS[0]!.look);
    expect(normalizeLook({ coat: 'ginger', pattern: 'nope', accessoryColor: 'red' })).toMatchObject(
      {
        coat: 'ginger',
        pattern: 'tabby',
        accessoryColor: '#e2563a',
      },
    );
  });
});

describe('behaviour', () => {
  const scene: Scene = { width: 120, bowlX: 70, bedX: 4 };
  const run = (mood: Mood, seconds: number, seed = 3) => {
    const rand = seeded(seed);
    let s: CatState = initialState(scene, rand);
    const acts = new Set<string>();
    for (let t = 0; t < seconds; t += 0.1) {
      s = step(s, 0.1, mood, scene, rand);
      acts.add(s.act);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(scene.width - 40);
    }
    return { s, acts };
  };

  it('a hungry cat goes to the bowl and meows there', () => {
    const { s, acts } = run('hungry', 30);
    expect(s.x).toBe(scene.bowlX);
    expect(acts.has('meow')).toBe(true);
  });

  it('a fed cat eats at the bowl, then grooms', () => {
    const { acts } = run('fed', 30);
    expect(acts.has('eat')).toBe(true);
    expect(acts.has('groom')).toBe(true);
  });

  it('a sleepy cat ends up asleep in its spot', () => {
    const { s } = run('sleepy', 30);
    expect(s.act).toBe('sleep');
    expect(s.x).toBe(scene.bedX);
  });

  it('a calm cat walks around and does various things', () => {
    const { acts } = run('calm', 120);
    expect(acts.has('walk')).toBe(true);
    expect(acts.size).toBeGreaterThanOrEqual(3);
  });

  it('one-shot animations hold their last frame', () => {
    expect(frameAt('jump', 100)).toBe(ANIMS.jump.frames - 1);
    expect(frameAt('walk', 100)).toBeLessThan(ANIMS.walk.frames);
  });
});
