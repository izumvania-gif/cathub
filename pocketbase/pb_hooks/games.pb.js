/// <reference path="../pb_data/types.d.ts" />

// Mini-games (docs/PLAN.md, Phase 7). The client reports a finished run; the server checks it
// is believable, prices it by score, applies the daily cap (rolling 24 hours per person) and
// grants achievements. Only this route writes game_runs and game_achievements.

// POST /api/cathub/games/finish { game, stats: { score, ... }, durationMs }
//   → { fish, capped, left, best, record, achievements: [{ key, fish, accessory }] }
routerAdd(
  'POST',
  '/api/cathub/games/finish',
  (e) => {
    const { GAME_RULES, gameFish, plausible, achievementsMet } = require(`${__hooks}/lib/games.js`);
    const household = e.auth.getString('household');
    if (!household) throw new BadRequestError('Вы не состоите в доме.');
    const body = e.requestInfo().body || {};
    const game = String(body.game || '');
    const rule = GAME_RULES.games[game];
    if (!rule) throw new BadRequestError('Такой игры нет.');
    const durationMs = Math.round(Number(body.durationMs) || 0);
    const raw = body.stats && typeof body.stats === 'object' ? body.stats : {};
    const stats = {};
    for (const k of Object.keys(rule.stats)) stats[k] = raw[k] === undefined ? 0 : Number(raw[k]);
    if (durationMs < 0 || durationMs > rule.maxMs || !plausible(game, stats, durationMs))
      throw new BadRequestError('Результат не похож на настоящий.');
    const counts = durationMs >= rule.minMs;
    const score = stats.score;

    let result;
    $app.runInTransaction((tx) => {
      const row = new DynamicModel({ used: 0, best: 0 });
      tx.db()
        .newQuery(
          `SELECT
            (SELECT COALESCE(SUM(fish), 0) FROM game_runs
              WHERE user = {:u} AND created > strftime('%Y-%m-%d %H:%M:%fZ', 'now', '-1 day')) AS used,
            (SELECT COALESCE(MAX(score), 0) FROM game_runs WHERE user = {:u} AND game = {:g}) AS best`,
        )
        .bind({ u: e.auth.id, g: game })
        .one(row);
      const full = counts ? gameFish(game, score) : 0;
      const fish = Math.max(0, Math.min(full, GAME_RULES.dailyCap - row.used));

      const run = new Record(tx.findCollectionByNameOrId('game_runs'));
      run.set('household', household);
      run.set('user', e.auth.id);
      run.set('game', game);
      run.set('score', score);
      run.set('stats', stats);
      run.set('fish', fish);
      run.set('duration_ms', durationMs);
      tx.save(run);

      const granted = [];
      if (counts) {
        const col = tx.findCollectionByNameOrId('game_achievements');
        for (const a of achievementsMet(game, stats)) {
          try {
            tx.findFirstRecordByFilter('game_achievements', 'user = {:u} && key = {:k}', {
              u: e.auth.id,
              k: a.key,
            });
            continue; // already earned
          } catch (_) {
            /* not yet */
          }
          const rec = new Record(col);
          rec.set('household', household);
          rec.set('user', e.auth.id);
          rec.set('key', a.key);
          rec.set('fish', a.fish || 0);
          tx.save(rec);
          granted.push({ key: a.key, fish: a.fish || 0, accessory: a.accessory || null });
        }
      }
      result = {
        fish,
        capped: fish < full,
        left: Math.max(0, GAME_RULES.dailyCap - row.used - fish),
        best: Math.max(row.best, score),
        record: score > row.best && score > 0,
        counted: counts,
        achievements: granted,
      };
    });
    return e.json(200, result);
  },
  $apis.requireAuth('users'),
);
