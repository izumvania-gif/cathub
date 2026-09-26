import { describe, expect, it } from 'vitest';
import { frameAt, initialState, replan, step, type CatState, type Mood } from './behavior';
import { ITEMS, layout, type ItemKey } from './room';
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
    // Collected and checked once: an expect() per pixel made this test slow.
    const touching: string[] = [];
    const sparse: string[] = [];
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
              if (!(x > 0 && x < FRAME_W - 1 && y > 0))
                touching.push(`${p.key} ${a}#${i} at ${x},${y}`);
            }
          if (filled <= 150) sparse.push(`${p.key} ${a}#${i}: ${filled}`);
        }
      }
    }
    expect(touching).toEqual([]);
    expect(sparse).toEqual([]);
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
  const all = Object.keys(ITEMS) as ItemKey[];
  const run = (mood: Mood, seconds: number, items: ItemKey[] = all, seed = 3) => {
    const room = layout(180, items);
    const rand = seeded(seed);
    let s: CatState = replan(initialState(room, rand), mood, room, rand);
    const acts = new Set<string>();
    const spots = new Set<string>();
    let maxY = 0;
    for (let t = 0; t < seconds; t += 0.1) {
      s = step(s, 0.1, mood, room, rand);
      acts.add(s.act);
      if (s.spot) spots.add(`${s.spot.kind}:${s.spot.item}`);
      maxY = Math.max(maxY, s.y);
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(room.width - 40);
      expect(s.y).toBeGreaterThanOrEqual(0);
    }
    return { s, acts, spots, maxY, room };
  };

  it('a hungry cat goes to the bowl and meows there, even from a perch', () => {
    const { s, acts } = run('hungry', 40);
    expect(s.x).toBe(layout(180, all).bowlX);
    expect(s.y).toBe(0);
    expect(acts.has('meow')).toBe(true);
  });

  it('a fed cat eats at the bowl, then grooms', () => {
    const { acts } = run('fed', 40);
    expect(acts.has('eat')).toBe(true);
    expect(acts.has('groom')).toBe(true);
  });

  it('a sleepy cat ends up asleep in the bed, or on the floor without one', () => {
    const withBed = run('sleepy', 60);
    expect(withBed.s.act).toBe('sleep');
    expect(withBed.s.spot?.item).toBe('bed');
    const bare = run('sleepy', 60, []);
    expect(bare.s.act).toBe('sleep');
    expect(bare.s.x).toBe(bare.room.napX);
  });

  it('a calm cat uses the room: jumps up to perches and plays with things', () => {
    const { acts, spots, maxY } = run('calm', 600);
    expect(acts.has('walk')).toBe(true);
    expect(acts.has('leapUp')).toBe(true);
    expect(acts.has('leapDown')).toBe(true);
    expect(maxY).toBeGreaterThan(20);
    expect(spots.size).toBeGreaterThanOrEqual(5);
  });

  it('a happy cat chases the ball and it rolls away', () => {
    const { acts, s } = run('happy', 300, ['ball', 'rug']);
    expect(acts.has('pounce')).toBe(true);
    expect(acts.has('play')).toBe(true);
    expect(s.ball.x).not.toBe(Math.round(180 * 0.42));
  });

  it('without items it only walks, sits and does things on the floor', () => {
    const { maxY, spots } = run('calm', 200, []);
    expect(maxY).toBe(0);
    expect(spots.size).toBe(0);
  });

  it('one-shot animations hold their last frame', () => {
    expect(frameAt('jump', 100)).toBe(ANIMS.jump.frames - 1);
    expect(frameAt('walk', 100)).toBeLessThan(ANIMS.walk.frames);
  });
});
