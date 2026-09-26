import { GAME_RULES } from '@cathub/core';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('game rules', () => {
  it('the PocketBase finish route uses the same rules as core', () => {
    const src = readFileSync(
      new URL('../../../pocketbase/pb_hooks/lib/games.js', import.meta.url),
      'utf8',
    );
    const json = /\/\* RULES \*\/([\s\S]*?)\/\* END RULES \*\//.exec(src)?.[1];
    // An object literal (Prettier keeps it as JS, not JSON), so evaluate it.
    const hook: unknown = new Function(`return ${json!}`)();
    expect(hook).toEqual(JSON.parse(JSON.stringify(GAME_RULES)));
  });
});
