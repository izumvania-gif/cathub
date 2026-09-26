// Mini-game rules for the finish route (CommonJS, loaded with require()).
// GAME_RULES must equal GAME_RULES in packages/core/src/games.ts (a bot test checks this).
const GAME_RULES = /* RULES */ {
  dailyCap: 10,
  games: {
    jump: {
      stats: {
        score: {
          max: 100000,
          perSec: 40,
        },
        coins: {
          max: 5000,
          perSec: 6,
        },
      },
      minMs: 3000,
      maxMs: 3600000,
      tiers: [
        [50, 1],
        [150, 3],
        [300, 5],
        [500, 8],
      ],
    },
    defense: {
      stats: {
        score: {
          max: 600,
        },
        waves: {
          max: 5,
          perSec: 0.07,
        },
        food: {
          max: 100,
        },
      },
      minMs: 20000,
      maxMs: 3600000,
      tiers: [
        [100, 1],
        [300, 3],
        [500, 5],
        [590, 8],
      ],
    },
    cards: {
      stats: {
        score: {
          max: 500,
        },
        floors: {
          max: 3,
          perSec: 0.02,
        },
        hp: {
          max: 80,
        },
      },
      minMs: 30000,
      maxMs: 86400000,
      tiers: [
        [40, 1],
        [100, 3],
        [200, 5],
        [300, 8],
      ],
    },
    fishing: {
      stats: {
        score: {
          max: 600,
          perSec: 14,
        },
        caught: {
          max: 120,
          perSec: 2.5,
        },
        streak: {
          max: 120,
          perSec: 2.5,
        },
      },
      minMs: 20000,
      maxMs: 90000,
      tiers: [
        [10, 1],
        [30, 3],
        [60, 5],
        [100, 8],
      ],
    },
  },
  achievements: [
    {
      key: 'jump_200',
      game: 'jump',
      need: {
        score: 200,
      },
      fish: 10,
    },
    {
      key: 'jump_500',
      game: 'jump',
      need: {
        score: 500,
      },
      fish: 20,
    },
    {
      key: 'jump_1000',
      game: 'jump',
      need: {
        score: 1000,
      },
      accessory: 'propeller',
    },
    {
      key: 'defense_3',
      game: 'defense',
      need: {
        waves: 3,
      },
      fish: 10,
    },
    {
      key: 'defense_5',
      game: 'defense',
      need: {
        waves: 5,
      },
      fish: 20,
    },
    {
      key: 'defense_perfect',
      game: 'defense',
      need: {
        waves: 5,
        food: 100,
      },
      accessory: 'medal',
    },
    {
      key: 'cards_1',
      game: 'cards',
      need: {
        floors: 1,
      },
      fish: 10,
    },
    {
      key: 'cards_2',
      game: 'cards',
      need: {
        floors: 2,
      },
      fish: 20,
    },
    {
      key: 'cards_3',
      game: 'cards',
      need: {
        floors: 3,
      },
      accessory: 'crown',
    },
    {
      key: 'fishing_15',
      game: 'fishing',
      need: {
        caught: 15,
      },
      fish: 10,
    },
    {
      key: 'fishing_streak',
      game: 'fishing',
      need: {
        streak: 10,
      },
      fish: 20,
    },
    {
      key: 'fishing_30',
      game: 'fishing',
      need: {
        caught: 30,
      },
      accessory: 'fisher',
    },
  ],
}; /* END RULES */

/** Fish a run's score is worth before the daily cap. */
function gameFish(game, score) {
  let fish = 0;
  for (const [min, f] of GAME_RULES.games[game].tiers) if (score >= min) fish = f;
  return fish;
}

/** Every stat within its maximum and its per-second rate (same as core's plausible()). */
function plausible(game, stats, durationMs) {
  const rule = GAME_RULES.games[game];
  const secs = Math.max(durationMs, 0) / 1000;
  return Object.keys(rule.stats).every((k) => {
    const r = rule.stats[k];
    const v = stats[k] === undefined ? 0 : stats[k];
    return (
      Number.isInteger(v) &&
      v >= 0 &&
      v <= r.max &&
      (r.perSec === undefined || v <= r.perSec * secs + 1)
    );
  });
}

function achievementsMet(game, stats) {
  return GAME_RULES.achievements.filter(
    (a) => a.game === game && Object.keys(a.need).every((k) => (stats[k] || 0) >= a.need[k]),
  );
}

module.exports = { GAME_RULES, gameFish, plausible, achievementsMet };
