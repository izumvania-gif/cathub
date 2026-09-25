import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { APP_URL, ICS_PORT, PB_PORT, SUPERUSER, TG_PORT, TG_URL } from './env';

const ROOT = resolve(import.meta.dirname, '../../..');

/** PocketBase binary: $PB_BIN, else the pinned version downloaded by scripts/pocketbase.sh. */
function pocketbaseBin(): string {
  if (process.env.PB_BIN) return process.env.PB_BIN;
  const version = readFileSync(join(ROOT, 'pocketbase/VERSION'), 'utf8').trim();
  const bin = join(ROOT, '.pocketbase', `pocketbase-${version}`);
  if (!existsSync(bin)) {
    const r = spawnSync('bash', [join(ROOT, 'scripts/pocketbase.sh'), '--version'], {
      stdio: 'inherit',
    });
    if (r.status !== 0) throw new Error('could not download PocketBase');
  }
  return bin;
}

async function waitFor(url: string, what: string, timeoutMs = 20_000) {
  const until = Date.now() + timeoutMs;
  while (Date.now() < until) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${what} did not start (${url})`);
}

export default async function globalSetup() {
  for (const f of ['apps/web/dist/index.html', 'apps/bot/dist/index.js']) {
    if (!existsSync(join(ROOT, f))) throw new Error(`${f} is missing — run "pnpm build" first`);
  }
  const bin = pocketbaseBin();
  const dataDir = mkdtempSync(join(tmpdir(), 'cathub-e2e-'));
  const procs: ChildProcess[] = [];
  const log = process.env.E2E_VERBOSE ? 'inherit' : 'ignore';

  spawnSync(bin, [
    'superuser',
    'upsert',
    SUPERUSER.email,
    SUPERUSER.password,
    `--dir=${dataDir}`,
    `--migrationsDir=${join(ROOT, 'pocketbase/pb_migrations')}`,
  ]);
  procs.push(
    spawn(
      bin,
      [
        'serve',
        `--http=127.0.0.1:${PB_PORT}`,
        `--dir=${dataDir}`,
        `--publicDir=${join(ROOT, 'apps/web/dist')}`,
        `--hooksDir=${join(ROOT, 'pocketbase/pb_hooks')}`,
        `--migrationsDir=${join(ROOT, 'pocketbase/pb_migrations')}`,
      ],
      // The calendar route proxies to the bot's internal .ics server.
      { stdio: log, env: { ...process.env, BOT_INTERNAL_URL: `http://127.0.0.1:${ICS_PORT}` } },
    ),
  );
  procs.push(
    spawn(process.execPath, [join(import.meta.dirname, 'mock-telegram.mjs'), String(TG_PORT)], {
      stdio: log,
    }),
  );
  await waitFor(`${APP_URL}/api/health`, 'PocketBase');
  await waitFor(`${TG_URL}/__health`, 'Telegram mock');

  procs.push(
    spawn(process.execPath, ['--no-deprecation', join(ROOT, 'apps/bot/dist/index.js')], {
      stdio: log,
      env: {
        ...process.env,
        BOT_TOKEN: '42:e2e-token',
        TELEGRAM_API_ROOT: TG_URL,
        PB_URL: APP_URL,
        PB_SUPERUSER_EMAIL: SUPERUSER.email,
        PB_SUPERUSER_PASSWORD: SUPERUSER.password,
        REMINDER_INTERVAL_MS: '1000',
        HEARTBEAT_INTERVAL_MS: '2000',
        GROUP_QUIET_HOURS: '00:00-00:00',
        ICS_PORT: String(ICS_PORT),
        APP_URL,
      },
    }),
  );

  return async () => {
    for (const p of procs.reverse()) p.kill('SIGTERM');
    rmSync(dataDir, { recursive: true, force: true });
  };
}
