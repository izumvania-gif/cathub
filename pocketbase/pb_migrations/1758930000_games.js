/// <reference path="../pb_data/types.d.ts" />

// Mini-games (docs/PLAN.md, Phase 7). Runs and achievements are written only by the
// POST /api/cathub/games/finish hook, which prices a run and applies the daily cap; clients
// can read them. Game fish join the family balance.
migrate(
  (app) => {
    const MEMBER = '@request.auth.id != "" && household = @request.auth.household';
    const households = app.findCollectionByNameOrId('households');
    const users = app.findCollectionByNameOrId('users');
    const rel = (name, col, required = true) => ({
      name,
      type: 'relation',
      collectionId: col.id,
      maxSelect: 1,
      required,
      cascadeDelete: true,
    });

    app.save(
      new Collection({
        type: 'base',
        name: 'game_runs',
        listRule: MEMBER,
        viewRule: MEMBER,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          rel('household', households),
          rel('user', users),
          {
            name: 'game',
            type: 'select',
            maxSelect: 1,
            required: true,
            values: ['jump', 'defense', 'cards', 'fishing'],
          },
          { name: 'score', type: 'number', min: 0, onlyInt: true },
          { name: 'stats', type: 'json', maxSize: 2000 },
          { name: 'fish', type: 'number', min: 0, onlyInt: true },
          { name: 'duration_ms', type: 'number', min: 0, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE INDEX idx_game_runs_user ON game_runs (user, created)'],
      }),
    );

    app.save(
      new Collection({
        type: 'base',
        name: 'game_achievements',
        listRule: MEMBER,
        viewRule: MEMBER,
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          rel('household', households),
          rel('user', users),
          { name: 'key', type: 'text', required: true, max: 40 },
          { name: 'fish', type: 'number', min: 0, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_game_achievement_once ON game_achievements (user, key)'],
      }),
    );

    // Best score per person per game (family records).
    app.save(
      new Collection({
        type: 'view',
        name: 'game_records',
        listRule: 'household = @request.auth.household',
        viewRule: 'household = @request.auth.household',
        viewQuery: `
          SELECT (g.user || '_' || g.game) AS id, g.household AS household, g.user AS user,
            g.game AS game, MAX(g.score) AS best, COUNT(*) AS runs
          FROM game_runs g
          GROUP BY g.user, g.game, g.household`,
      }),
    );

    const balance = app.findCollectionByNameOrId('fish_balance');
    balance.viewQuery = `
          SELECT h.id AS id,
            COALESCE(c.fish, 0) AS from_tasks,
            COALESCE(b.fish, 0) AS from_bonuses,
            COALESCE(g.fish, 0) AS from_games,
            COALESCE(a.fish, 0) AS from_achievements,
            COALESCE(r.price, 0) AS spent
          FROM households h
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM completions GROUP BY household) c
            ON c.household = h.id
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM fish_bonuses GROUP BY household) b
            ON b.household = h.id
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM game_runs GROUP BY household) g
            ON g.household = h.id
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM game_achievements GROUP BY household) a
            ON a.household = h.id
          LEFT JOIN (SELECT household, SUM(price) AS price FROM room_items GROUP BY household) r
            ON r.household = h.id`;
    app.save(balance);
  },
  (app) => {
    const balance = app.findCollectionByNameOrId('fish_balance');
    balance.viewQuery = `
          SELECT h.id AS id,
            COALESCE(c.fish, 0) AS from_tasks,
            COALESCE(b.fish, 0) AS from_bonuses,
            COALESCE(r.price, 0) AS spent
          FROM households h
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM completions GROUP BY household) c
            ON c.household = h.id
          LEFT JOIN (SELECT household, SUM(fish) AS fish FROM fish_bonuses GROUP BY household) b
            ON b.household = h.id
          LEFT JOIN (SELECT household, SUM(price) AS price FROM room_items GROUP BY household) r
            ON r.household = h.id`;
    app.save(balance);
    for (const name of ['game_records', 'game_achievements', 'game_runs'])
      app.delete(app.findCollectionByNameOrId(name));
  },
);
