import { ROOM_CATALOG } from '@cathub/core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('room prices', () => {
  it('the PocketBase purchase route charges the same prices as core', () => {
    const src = readFileSync(
      new URL('../../../pocketbase/pb_hooks/lib/room.js', import.meta.url),
      'utf8',
    );
    const hook = Object.fromEntries(
      [...src.matchAll(/^\s+(\w+): (\d+),$/gm)].map((m) => [m[1], Number(m[2])]),
    );
    expect(hook).toEqual({ ...ROOM_CATALOG });
  });
});
