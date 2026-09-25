import PocketBase from 'pocketbase';
import { config } from './config';
import { log } from './log';

export type Heartbeat = {
  telegram_ok: boolean;
  telegram_ms: number;
  telegram_error: string;
  uptime_s: number;
};

export class PocketBaseClient {
  private readonly pb = new PocketBase(config.pbUrl);

  get enabled(): boolean {
    return Boolean(config.pbEmail && config.pbPassword);
  }

  private async ensureAuth(): Promise<void> {
    if (this.pb.authStore.isValid) return;
    await this.pb
      .collection('_superusers')
      .authWithPassword(config.pbEmail!, config.pbPassword!, { autoRefreshThreshold: 30 * 60 });
  }

  async writeHeartbeat(hb: Heartbeat): Promise<void> {
    await this.ensureAuth();
    await this.pb
      .collection('diagnostics')
      .create({ kind: 'heartbeat', bot_version: config.version, ...hb });
  }

  async pruneDiagnostics(): Promise<number> {
    await this.ensureAuth();
    const cutoff = new Date(Date.now() - config.diagnosticsRetentionMs)
      .toISOString()
      .replace('T', ' ');
    const old = await this.pb
      .collection('diagnostics')
      .getFullList({ filter: this.pb.filter('created < {:cutoff}', { cutoff }), fields: 'id' });
    for (const r of old) await this.pb.collection('diagnostics').delete(r.id);
    if (old.length) log.info(`pruned ${old.length} old diagnostics records`);
    return old.length;
  }
}
